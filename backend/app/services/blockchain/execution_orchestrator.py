"""
Execution Orchestrator for on-chain settlement.
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional, Tuple
from uuid import UUID

from sqlalchemy.orm import Session
from web3 import Web3
from web3.contract import Contract
from web3.exceptions import ContractLogicError

from app.core.config import settings
from app.models.approvals import Approval, ApprovalAction
from app.models.audit_records import AuditRecord
from app.models.compliance_decisions import ComplianceDecision, FinalDecision
from app.models.payment_intents import PaymentIntent, PaymentStatus
from app.services.governance.country_policy_service import get_current_policy_version
from app.services.notifications.alert_service import AlertService
from app.services.privacy.zk_service import generate_combined_proof

logger = logging.getLogger(__name__)


class ExecutionError(Exception):
    """Raised when settlement execution cannot proceed."""


class ExecutionOrchestrator:
    """Orchestrates complete on-chain settlement execution."""

    def __init__(self, db: Session):
        self.db = db
        self.w3_base = Web3(Web3.HTTPProvider(settings.BASE_SEPOLIA_RPC_URL))
        self.w3_polygon = Web3(Web3.HTTPProvider(settings.POLYGON_AMOY_RPC_URL))
        self._active_chain = "base"

    @staticmethod
    def _project_root() -> Path:
        # backend/app/services/blockchain/execution_orchestrator.py -> repo root
        return Path(__file__).resolve().parents[4]

    def _load_abi(self, contract_name: str) -> Any:
        artifact_path = (
            self._project_root()
            / "contracts"
            / "out"
            / f"{contract_name}.sol"
            / f"{contract_name}.json"
        )
        if not artifact_path.exists():
            raise ExecutionError(f"Contract artifact not found: {artifact_path}")
        with artifact_path.open("r", encoding="utf-8") as f:
            return json.load(f)["abi"]

    @staticmethod
    def _tx_hash_hex(tx_hash: Any) -> str:
        if isinstance(tx_hash, bytes):
            return Web3.to_hex(tx_hash)
        if isinstance(tx_hash, str):
            return tx_hash
        return Web3.to_hex(tx_hash)

    async def _wait_for_receipt(
        self,
        tx_hash: Any,
        w3: Web3,
        timeout: int = 120,
        poll_interval: int = 3,
    ) -> Dict[str, Any]:
        started = datetime.now(timezone.utc)
        while True:
            elapsed = (datetime.now(timezone.utc) - started).total_seconds()
            if elapsed > timeout:
                raise asyncio.TimeoutError(
                    f"Transaction {self._tx_hash_hex(tx_hash)} not confirmed within {timeout}s"
                )
            try:
                receipt = w3.eth.get_transaction_receipt(tx_hash)
                if receipt:
                    return dict(receipt)
            except Exception:
                pass
            await asyncio.sleep(poll_interval)

    def _payment_id_bytes32(self, payment_id: UUID, w3: Web3) -> bytes:
        return w3.keccak(text=str(payment_id))

    def _build_contract(self, w3: Web3, address: str, contract_name: str) -> Contract:
        return w3.eth.contract(
            address=Web3.to_checksum_address(address),
            abi=self._load_abi(contract_name),
        )

    def _choose_web3(self) -> Web3:
        """
        Use Base Sepolia when healthy, else fallback to Polygon Amoy.
        """
        if self.w3_base.is_connected():
            self._active_chain = "base"
            return self.w3_base
        if self.w3_polygon.is_connected():
            self._active_chain = "polygon"
            return self.w3_polygon
        raise ExecutionError("RPC failure: neither Base Sepolia nor Polygon Amoy is reachable")

    def _chain_name(self) -> str:
        return "Base Sepolia" if self._active_chain == "base" else "Polygon Amoy"

    @staticmethod
    def _approval_required(payment: PaymentIntent) -> bool:
        # Policy: large payments require dual approval.
        return float(payment.amount) > 100000.0

    @staticmethod
    def verify_approvals(db: Session, payment_id: UUID) -> Tuple[bool, str]:
        """
        Step 1: Verify compliance approval + required human approvals.
        """
        payment = db.query(PaymentIntent).filter(PaymentIntent.id == payment_id).first()
        if not payment:
            return False, "Payment not found"

        decision = (
            db.query(ComplianceDecision)
            .filter(ComplianceDecision.payment_id == payment_id)
            .order_by(ComplianceDecision.created_at.desc())
            .first()
        )
        if not decision:
            return False, "Compliance decision not found"
        if decision.final_decision != FinalDecision.approved:
            return False, f"Compliance final decision is {decision.final_decision.value}, not approved"

        approvals = db.query(Approval).filter(Approval.payment_id == payment_id).all()
        if not approvals:
            return False, "Required approval missing"

        approved_actions = [a for a in approvals if a.action == ApprovalAction.approve]
        if not approved_actions:
            return False, "No approved approval records found"

        if ExecutionOrchestrator._approval_required(payment) and len(approved_actions) < 2:
            return False, "Dual approval required but not satisfied"

        return True, "approved"

    @staticmethod
    def verify_policy_version(db: Session, payment_id: UUID) -> Tuple[bool, Dict[str, str]]:
        """
        Step 2: Verify policy version consistency.
        """
        decision = (
            db.query(ComplianceDecision)
            .filter(ComplianceDecision.payment_id == payment_id)
            .order_by(ComplianceDecision.created_at.desc())
            .first()
        )
        if not decision:
            raise ExecutionError("Compliance decision not found")

        decision_version = decision.policy_version or ""
        current_version = get_current_policy_version(db)
        is_current = decision_version == current_version

        if not is_current:
            payment = db.query(PaymentIntent).filter(PaymentIntent.id == payment_id).first()
            if payment:
                payment.status = PaymentStatus.revalidation
                db.add(payment)
                db.commit()

        return is_current, {
            "current_version": current_version,
            "decision_version": decision_version,
        }

    def _build_compliance_hash(
        self,
        payment: PaymentIntent,
        decision: ComplianceDecision,
    ) -> bytes:
        raw = "|".join(
            [
                str(payment.id),
                payment.sender_company,
                payment.receiver_company,
                str(payment.amount),
                payment.token,
                decision.final_decision.value,
                decision.policy_version or "",
            ]
        )
        return Web3.keccak(text=raw)

    async def load_contract_authorization(
        self,
        payment: PaymentIntent,
        decision: ComplianceDecision,
        w3: Web3,
    ) -> Tuple[bool, Optional[str]]:
        """
        Step 3: Verify authorization, authorize on-chain if missing.
        """
        contract = self._build_contract(
            w3,
            settings.PAYMENT_AUTHORIZATION_ADDRESS,
            "PaymentAuthorization",
        )
        payment_id_b32 = self._payment_id_bytes32(payment.id, w3)
        already_auth = contract.functions.isAuthorized(payment_id_b32).call()
        if already_auth:
            return True, None

        sender_addr = Web3.to_checksum_address(settings.BACKEND_WALLET_ADDRESS)
        receiver_addr = Web3.to_checksum_address(
            payment.receiver_wallet or settings.BACKEND_WALLET_ADDRESS
        )
        amount_u6 = int(float(payment.amount) * 10**6)
        token_address = (
            settings.MOCK_USDC_ADDRESS if payment.token.upper() == "USDC" else settings.MOCK_USDT_ADDRESS
        )
        corridor = f"{payment.source_country}-{payment.destination_country}"
        policy_version = decision.policy_version or "unknown"
        compliance_hash = self._build_compliance_hash(payment, decision)

        nonce = w3.eth.get_transaction_count(sender_addr)
        tx = contract.functions.authorizePayment(
            payment_id_b32,
            sender_addr,
            receiver_addr,
            amount_u6,
            Web3.to_checksum_address(token_address),
            corridor,
            policy_version,
            compliance_hash,
        ).build_transaction(
            {
                "from": sender_addr,
                "nonce": nonce,
                "gas": 500000,
                "gasPrice": w3.eth.gas_price,
                "chainId": w3.eth.chain_id,
            }
        )
        signed = w3.eth.account.sign_transaction(tx, settings.BACKEND_WALLET_PRIVATE_KEY)
        raw = getattr(signed, "rawTransaction", None) or getattr(signed, "raw_transaction")
        tx_hash = w3.eth.send_raw_transaction(raw)
        await self._wait_for_receipt(tx_hash, w3, timeout=120, poll_interval=3)
        return True, self._tx_hash_hex(tx_hash)

    def _ensure_gas_balance(self, w3: Web3, required_gas: int = 600000) -> None:
        wallet = Web3.to_checksum_address(settings.BACKEND_WALLET_ADDRESS)
        native_balance = w3.eth.get_balance(wallet)
        required_wei = required_gas * w3.eth.gas_price
        if native_balance < required_wei:
            raise ExecutionError(
                f"Insufficient wallet balance for gas. Need ~{required_wei} wei, have {native_balance} wei."
            )

    async def execute_token_transfer(self, payment: PaymentIntent, w3: Web3) -> Tuple[str, int]:
        """
        Step 4: Execute token transfer.
        """
        if payment.token.upper() == "USDC":
            token_address = settings.MOCK_USDC_ADDRESS
        elif payment.token.upper() == "USDT":
            token_address = settings.MOCK_USDT_ADDRESS
        else:
            raise ExecutionError(f"Unsupported token: {payment.token}")

        self._ensure_gas_balance(w3)
        token = self._build_contract(w3, token_address, "MockStablecoinERC20")
        sender_addr = Web3.to_checksum_address(settings.BACKEND_WALLET_ADDRESS)
        receiver_addr = Web3.to_checksum_address(
            payment.receiver_wallet or settings.BACKEND_WALLET_ADDRESS
        )
        amount_u6 = int(float(payment.amount) * 10**6)

        balance = token.functions.balanceOf(sender_addr).call()
        if int(balance) < amount_u6:
            raise ExecutionError(
                f"Insufficient token balance: need {amount_u6}, have {int(balance)}"
            )

        nonce = w3.eth.get_transaction_count(sender_addr)
        tx = token.functions.transfer(receiver_addr, amount_u6).build_transaction(
            {
                "from": sender_addr,
                "nonce": nonce,
                "gas": 250000,
                "gasPrice": w3.eth.gas_price,
                "chainId": w3.eth.chain_id,
            }
        )
        signed = w3.eth.account.sign_transaction(tx, settings.BACKEND_WALLET_PRIVATE_KEY)
        raw = getattr(signed, "rawTransaction", None) or getattr(signed, "raw_transaction")
        tx_hash = w3.eth.send_raw_transaction(raw)
        receipt = await self._wait_for_receipt(tx_hash, w3, timeout=120, poll_interval=3)
        return self._tx_hash_hex(tx_hash), int(receipt["blockNumber"])

    async def monitor_transaction(self, tx_hash: str, w3: Web3) -> Tuple[bool, Optional[str]]:
        """
        Step 5: Monitor tx status.
        """
        try:
            receipt = await self._wait_for_receipt(tx_hash, w3, timeout=120, poll_interval=3)
            if int(receipt.get("status", 0)) == 1:
                return True, None
            return False, "EVM revert (status=0)"
        except ContractLogicError as exc:
            return False, str(exc)
        except asyncio.TimeoutError:
            return False, "Transaction confirmation timeout"
        except Exception as exc:
            return False, str(exc)

    async def register_settlement_proof(self, payment: PaymentIntent, tx_hash: str, w3: Web3) -> str:
        """
        Step 6: Register settlement proof on-chain.
        """
        proof_bundle = generate_combined_proof(
            payment_id=str(payment.id),
            kyc_result={"kyc_status": "verified", "company_name": payment.sender_company},
            amount=float(payment.amount),
            policy_range=(0.0, 500000.0),
            approval_id=None,
        )
        zk_hash_hex = proof_bundle["combined_proof_hash"]
        payment_id_b32 = self._payment_id_bytes32(payment.id, w3)
        tx_hash_b32 = Web3.to_bytes(hexstr=tx_hash)
        zk_hash_b32 = Web3.to_bytes(hexstr="0x" + zk_hash_hex)

        registry = self._build_contract(
            w3,
            settings.SETTLEMENT_PROOF_REGISTRY_ADDRESS,
            "SettlementProofRegistry",
        )
        decision = (
            self.db.query(ComplianceDecision)
            .filter(ComplianceDecision.payment_id == payment.id)
            .order_by(ComplianceDecision.created_at.desc())
            .first()
        )
        policy_version = (decision.policy_version if decision else None) or "unknown"
        token_address = (
            settings.MOCK_USDC_ADDRESS if payment.token.upper() == "USDC" else settings.MOCK_USDT_ADDRESS
        )
        nonce = w3.eth.get_transaction_count(Web3.to_checksum_address(settings.BACKEND_WALLET_ADDRESS))
        tx = registry.functions.registerProof(
            payment_id_b32,
            tx_hash_b32,
            zk_hash_b32,
            "direct_transfer",
            policy_version,
            int(float(payment.amount) * 10**6),
            Web3.to_checksum_address(token_address),
        ).build_transaction(
            {
                "from": Web3.to_checksum_address(settings.BACKEND_WALLET_ADDRESS),
                "nonce": nonce,
                "gas": 500000,
                "gasPrice": w3.eth.gas_price,
                "chainId": w3.eth.chain_id,
            }
        )

        signed = w3.eth.account.sign_transaction(tx, settings.BACKEND_WALLET_PRIVATE_KEY)
        raw = getattr(signed, "rawTransaction", None) or getattr(signed, "raw_transaction")
        proof_tx_hash = w3.eth.send_raw_transaction(raw)
        await self._wait_for_receipt(proof_tx_hash, w3, timeout=120, poll_interval=3)
        return self._tx_hash_hex(proof_tx_hash)

    def save_audit_record(
        self,
        payment: PaymentIntent,
        tx_hash: str,
        proof_tx_hash: str,
        block_number: int,
    ) -> None:
        """
        Step 7: Save audit trail + update payment state.
        """
        audit_payload = {
            "tx_hash": tx_hash,
            "proof_tx_hash": proof_tx_hash,
            "block_number": block_number,
            "chain": self._chain_name(),
            "executed_at": datetime.now(timezone.utc).isoformat(),
        }
        audit = AuditRecord(
            payment_id=payment.id,
            tx_hash=tx_hash,
            on_chain_proof_hash=proof_tx_hash,
            report_path=json.dumps(audit_payload),
            zk_proof_reference=proof_tx_hash,
        )
        payment.status = PaymentStatus.executed
        payment.executed_at = datetime.now(timezone.utc)
        payment.revert_reason = None

        self.db.add(audit)
        self.db.add(payment)
        self.db.commit()

    async def send_notifications(
        self,
        payment: PaymentIntent,
        tx_hash: str,
        block_number: int,
        failed_reason: Optional[str] = None,
    ) -> None:
        """
        Step 8: Send Telegram and persist alert records.
        """
        if failed_reason:
            await AlertService.send_payment_alert(
                self.db,
                "settlement_failed",
                payment.id,
                {
                    "id": str(payment.id),
                    "source_country": payment.source_country,
                    "destination_country": payment.destination_country,
                    "amount": str(payment.amount),
                    "token": payment.token,
                    "tx_hash": tx_hash,
                },
                {
                    "block_reason": failed_reason,
                    "chain": self._chain_name(),
                },
            )
            return

        await AlertService.send_payment_alert(
            self.db,
            "settlement_executed",
            payment.id,
            {
                "id": str(payment.id),
                "source_country": payment.source_country,
                "destination_country": payment.destination_country,
                "amount": str(payment.amount),
                "token": payment.token,
                "tx_hash": tx_hash,
            },
            {
                "chain": self._chain_name(),
                "block_number": block_number,
            },
        )

    async def execute_settlement(self, payment_id: UUID) -> Dict[str, Any]:
        """
        Execute full 8-step settlement flow.
        """
        payment = self.db.query(PaymentIntent).filter(PaymentIntent.id == payment_id).first()
        if not payment:
            raise ExecutionError("Payment not found")

        approvals_ok, reason = self.verify_approvals(self.db, payment_id)
        if not approvals_ok:
            raise ExecutionError(reason)

        policy_ok, version_info = self.verify_policy_version(self.db, payment_id)
        if not policy_ok:
            raise ExecutionError(
                "Policy version mismatch. Revalidation required. "
                f"decision_version={version_info['decision_version']}, current_version={version_info['current_version']}"
            )

        decision = (
            self.db.query(ComplianceDecision)
            .filter(ComplianceDecision.payment_id == payment_id)
            .order_by(ComplianceDecision.created_at.desc())
            .first()
        )
        if not decision:
            raise ExecutionError("Compliance decision not found")

        w3 = self._choose_web3()

        tx_hash = ""
        try:
            await self.load_contract_authorization(payment, decision, w3)
            tx_hash, block_number = await self.execute_token_transfer(payment, w3)

            confirmed, fail_reason = await self.monitor_transaction(tx_hash, w3)
            if not confirmed:
                payment.status = PaymentStatus.failed
                payment.revert_reason = fail_reason
                self.db.add(payment)
                self.db.commit()
                await self.send_notifications(payment, tx_hash, 0, failed_reason=fail_reason)
                raise ExecutionError(f"Transfer transaction failed: {fail_reason}")

            proof_tx_hash = await self.register_settlement_proof(payment, tx_hash, w3)
            self.save_audit_record(payment, tx_hash, proof_tx_hash, block_number)
            await self.send_notifications(payment, tx_hash, block_number)

            return {
                "payment_id": str(payment.id),
                "tx_hash": tx_hash,
                "proof_tx_hash": proof_tx_hash,
                "block_number": block_number,
                "chain": self._chain_name(),
                "executed_at": datetime.now(timezone.utc).isoformat(),
                "status": "executed",
            }
        except ExecutionError:
            raise
        except Exception as exc:
            payment.status = PaymentStatus.failed
            payment.revert_reason = str(exc)
            self.db.add(payment)
            self.db.commit()
            if tx_hash:
                await self.send_notifications(payment, tx_hash, 0, failed_reason=str(exc))
            raise ExecutionError(f"Settlement execution failed: {exc}") from exc

import logging  # FIXED: C1
from typing import Any, Dict  # FIXED: C1
from uuid import UUID  # FIXED: C1

from web3 import Web3  # FIXED: C1

from app.core.config import settings  # FIXED: C1
from app.services.blockchain.abi_loader import load_contract_abi  # FIXED: C1

logger = logging.getLogger(__name__)  # FIXED: C1


class ContractService:  # FIXED: C1
    def __init__(self) -> None:  # FIXED: C1
        self.web3 = Web3(Web3.HTTPProvider(settings.BASE_SEPOLIA_RPC_URL))  # FIXED: C1
        self.contracts: Dict[str, Any] = {}  # FIXED: C1
        self._load_contracts()  # FIXED: C1

    def _artifact_name(self, logical_key: str) -> str:  # FIXED: C1
        mapping = settings.abi_logical_to_artifact  # FIXED: C1
        if logical_key not in mapping:  # FIXED: C1
            raise KeyError(f"Undefined ABI logical key: {logical_key}")  # FIXED: C1
        return mapping[logical_key]  # FIXED: C1

    def _load_contracts(self) -> None:  # FIXED: C1
        bindings = (  # FIXED: C1
            ("payment_auth", "payment_authorization", settings.CONTRACT_ADDRESS_COMPLIANCE),  # FIXED: C1
            ("proof_registry", "settlement_proof_registry", settings.CONTRACT_ADDRESS_SETTLEMENT),  # FIXED: C1
            ("policy_registry", "policy_registry", settings.CONTRACT_ADDRESS_REGISTRY),  # FIXED: C1
            ("mock_usdc", "mock_stablecoin", settings.MOCK_USDC_ADDRESS),  # FIXED: C1
            ("mock_usdt", "mock_stablecoin", settings.MOCK_USDT_ADDRESS),  # FIXED: C1
        )  # FIXED: C1
        try:  # FIXED: C1
            for slot, logical, addr in bindings:  # FIXED: C1
                if not str(addr or "").strip():  # FIXED: C1
                    logger.warning("Skipping contract %s — address empty in env", slot)  # FIXED: C1
                    continue  # FIXED: C1
                artifact = self._artifact_name(logical)  # FIXED: C1
                abi = load_contract_abi(artifact)  # FIXED: C1
                self.contracts[slot] = self.web3.eth.contract(  # FIXED: C1
                    address=Web3.to_checksum_address(addr),  # FIXED: C1
                    abi=abi,  # FIXED: C1
                )  # FIXED: C1
        except FileNotFoundError as exc:  # FIXED: C1
            logger.warning("Contract ABI load failed: %s", exc)  # FIXED: C1
        except Exception as exc:  # FIXED: C1
            logger.exception("Contract load error: %s", exc)  # FIXED: C1

    def get_payment_authorization_contract(self):  # FIXED: C1
        return self.contracts.get("payment_auth")  # FIXED: C1

    def get_settlement_proof_registry_contract(self):  # FIXED: C1
        return self.contracts.get("proof_registry")  # FIXED: C1

    def get_policy_registry_contract(self):  # FIXED: C1
        return self.contracts.get("policy_registry")  # FIXED: C1

    def get_mock_usdc_contract(self):  # FIXED: C1
        return self.contracts.get("mock_usdc")  # FIXED: C1

    def get_mock_usdt_contract(self):  # FIXED: C1
        return self.contracts.get("mock_usdt")  # FIXED: C1

    def authorize_payment_on_chain(  # FIXED: C1
        self,  # FIXED: C1
        payment_id: str,  # FIXED: C1
        sender: str,  # FIXED: C1
        receiver: str,  # FIXED: C1
        amount: int,  # FIXED: C1
        token: str,  # FIXED: C1
        corridor: str,  # FIXED: C1
        policy_version: str,  # FIXED: C1
        compliance_hash: str,  # FIXED: C1
    ) -> str:  # FIXED: C1
        contract = self.get_payment_authorization_contract()  # FIXED: C1
        if not contract:  # FIXED: C1
            raise RuntimeError("PaymentAuthorization contract not loaded")  # FIXED: C1

        nonce = self.web3.eth.get_transaction_count(settings.BACKEND_WALLET_ADDRESS)  # FIXED: C1

        try:  # FIXED: C1
            UUID(payment_id)  # FIXED: C1
            payment_id_bytes = self.web3.keccak(text=payment_id)  # FIXED: C1
        except ValueError:  # FIXED: C1
            if payment_id.startswith("0x") and len(payment_id) == 66:  # FIXED: C1
                payment_id_bytes = Web3.to_bytes(hexstr=payment_id)  # FIXED: C1
            else:  # FIXED: C1
                payment_id_bytes = self.web3.keccak(text=payment_id)  # FIXED: C1

        tx = contract.functions.authorizePayment(  # FIXED: C1
            payment_id_bytes,  # FIXED: C1
            Web3.to_checksum_address(sender),  # FIXED: C1
            Web3.to_checksum_address(receiver),  # FIXED: C1
            amount,  # FIXED: C1
            Web3.to_checksum_address(token),  # FIXED: C1
            corridor,  # FIXED: C1
            policy_version,  # FIXED: C1
            Web3.to_bytes(hexstr=compliance_hash),  # FIXED: C1
        ).build_transaction(  # FIXED: C1
            {  # FIXED: C1
                "from": settings.BACKEND_WALLET_ADDRESS,  # FIXED: C1
                "nonce": nonce,  # FIXED: C1
                "gas": 500000,  # FIXED: C1
                "gasPrice": self.web3.eth.gas_price,  # FIXED: C1
                "chainId": settings.BASE_SEPOLIA_CHAIN_ID,  # FIXED: C1
            }  # FIXED: C1
        )  # FIXED: C1

        signed_tx = self.web3.eth.account.sign_transaction(tx, settings.BACKEND_WALLET_PRIVATE_KEY)  # FIXED: C1
        raw_tx = getattr(signed_tx, "rawTransaction", None) or getattr(signed_tx, "raw_transaction")  # FIXED: C1
        tx_hash = self.web3.eth.send_raw_transaction(raw_tx)  # FIXED: C1

        receipt = self.web3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)  # FIXED: C1
        if receipt.status != 1:  # FIXED: C1
            raise RuntimeError(f"Transaction reverted: {tx_hash.hex()}")  # FIXED: C1

        return tx_hash.hex()  # FIXED: C1

    def register_proof_on_chain(  # FIXED: C1
        self,  # FIXED: C1
        payment_id: str,  # FIXED: C1
        tx_hash: str,  # FIXED: C1
        zk_proof_hash: str,  # FIXED: C1
        ai_decision: str,  # FIXED: C1
        policy_version: str,  # FIXED: C1
        amount: int,  # FIXED: C1
        token: str,  # FIXED: C1
    ) -> str:  # FIXED: C1
        contract = self.get_settlement_proof_registry_contract()  # FIXED: C1
        if not contract:  # FIXED: C1
            raise RuntimeError("SettlementProofRegistry contract not loaded")  # FIXED: C1
        nonce = self.web3.eth.get_transaction_count(settings.BACKEND_WALLET_ADDRESS)  # FIXED: C1

        tx = contract.functions.registerProof(  # FIXED: C1
            Web3.to_bytes(hexstr=payment_id),  # FIXED: C1
            Web3.to_bytes(hexstr=tx_hash),  # FIXED: C1
            Web3.to_bytes(hexstr=zk_proof_hash),  # FIXED: C1
            ai_decision,  # FIXED: C1
            policy_version,  # FIXED: C1
            amount,  # FIXED: C1
            token,  # FIXED: C1
        ).build_transaction(  # FIXED: C1
            {  # FIXED: C1
                "from": settings.BACKEND_WALLET_ADDRESS,  # FIXED: C1
                "nonce": nonce,  # FIXED: C1
                "gas": 500000,  # FIXED: C1
                "gasPrice": self.web3.eth.gas_price,  # FIXED: C1
                "chainId": settings.BASE_SEPOLIA_CHAIN_ID,  # FIXED: C1
            }  # FIXED: C1
        )  # FIXED: C1

        signed_tx = self.web3.eth.account.sign_transaction(tx, settings.BACKEND_WALLET_PRIVATE_KEY)  # FIXED: C1
        raw_tx = getattr(signed_tx, "rawTransaction", None) or getattr(signed_tx, "raw_transaction")  # FIXED: C1
        sent = self.web3.eth.send_raw_transaction(raw_tx)  # FIXED: C1
        return sent.hex()  # FIXED: C1

    def get_proof_from_chain(self, payment_id: str) -> Dict[str, Any]:  # FIXED: C1
        contract = self.get_settlement_proof_registry_contract()  # FIXED: C1
        proof = contract.functions.getProof(Web3.to_bytes(hexstr=payment_id)).call()  # FIXED: C1
        return {  # FIXED: C1
            "paymentId": proof[0].hex(),  # FIXED: C1
            "txHash": proof[1].hex(),  # FIXED: C1
            "zkProofHash": proof[2].hex(),  # FIXED: C1
            "aiDecision": proof[3],  # FIXED: C1
            "policyVersion": proof[4],  # FIXED: C1
            "amount": proof[5],  # FIXED: C1
            "token": proof[6],  # FIXED: C1
            "timestamp": proof[7],  # FIXED: C1
            "registrar": proof[8],  # FIXED: C1
        }  # FIXED: C1


_contract_service_instance: ContractService | None = None  # FIXED: C1


def get_contract_service() -> ContractService:  # FIXED: C1
    global _contract_service_instance  # FIXED: C1
    if _contract_service_instance is None:  # FIXED: C1
        _contract_service_instance = ContractService()  # FIXED: C1
    return _contract_service_instance  # FIXED: C1


class _LazyContractService:  # FIXED: C1
    def __init__(self) -> None:  # FIXED: C1
        self._instance = None  # FIXED: C1
        self._init_failed = False  # FIXED: C1
        self._failure_reason = None  # FIXED: C1

    def __getattr__(self, name: str):  # FIXED: C1
        if self._init_failed:  # FIXED: C1
            raise RuntimeError(  # FIXED: C1
                f"ContractService is unavailable: {self._failure_reason}. "  # FIXED: C1
                "Configure ABI paths and contract addresses in environment variables."  # FIXED: C1
            )  # FIXED: C1
        if self._instance is None:  # FIXED: C1
            try:  # FIXED: C1
                self._instance = get_contract_service()  # FIXED: C1
            except Exception as exc:  # FIXED: C1
                self._init_failed = True  # FIXED: C1
                self._failure_reason = str(exc)  # FIXED: C1
                raise RuntimeError(f"ContractService failed to initialize: {exc}") from exc  # FIXED: C1
        return getattr(self._instance, name)  # FIXED: C1

    def __bool__(self) -> bool:  # FIXED: C1
        return True  # FIXED: C1


contract_service = _LazyContractService()  # FIXED: C1

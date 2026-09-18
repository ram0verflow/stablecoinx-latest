import json
import os
from typing import Dict, Any
from web3 import Web3
from app.core.config import settings

class ContractService:
    def __init__(self):
        self.web3 = Web3(Web3.HTTPProvider(settings.BASE_SEPOLIA_RPC_URL))
        self.contracts = {}
        self._load_contracts()

    def _load_abi(self, contract_name: str) -> Dict[str, Any]:
        # Get the project root directory (two levels up from backend/app/services/blockchain/contract_service.py)
        current_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.abspath(os.path.join(current_dir, "..", "..", "..", ".."))
        base_path = os.path.join(project_root, "contracts", "out", f"{contract_name}.sol", f"{contract_name}.json")
        if not os.path.exists(base_path):
            raise FileNotFoundError(
                f"ABI artifact not found: {base_path}. "
                f"Run 'forge build' in the contracts/ directory first."
            )
        with open(base_path, "r") as f:
            artifact = json.load(f)
            return artifact["abi"]

    def _load_contracts(self):
        try:
            self.contracts["payment_auth"] = self.web3.eth.contract(
                address=settings.PAYMENT_AUTHORIZATION_ADDRESS,
                abi=self._load_abi("PaymentAuthorization")
            )
            self.contracts["proof_registry"] = self.web3.eth.contract(
                address=settings.SETTLEMENT_PROOF_REGISTRY_ADDRESS,
                abi=self._load_abi("SettlementProofRegistry")
            )
            self.contracts["policy_registry"] = self.web3.eth.contract(
                address=settings.POLICY_REGISTRY_ADDRESS,
                abi=self._load_abi("PolicyRegistry")
            )
            self.contracts["mock_usdc"] = self.web3.eth.contract(
                address=settings.MOCK_USDC_ADDRESS,
                abi=self._load_abi("MockStablecoinERC20")
            )
            self.contracts["mock_usdt"] = self.web3.eth.contract(
                address=settings.MOCK_USDT_ADDRESS,
                abi=self._load_abi("MockStablecoinERC20")
            )
        except FileNotFoundError as e:
            print(f"[ContractService] WARNING: {e}. Contract calls will fail until 'forge build' is run.")
        except Exception as e:
            print(f"[ContractService] WARNING: Failed to load contracts: {e}. Blockchain features disabled.")

    def get_payment_authorization_contract(self):
        return self.contracts["payment_auth"]

    def get_settlement_proof_registry_contract(self):
        return self.contracts["proof_registry"]

    def get_policy_registry_contract(self):
        return self.contracts["policy_registry"]

    def get_mock_usdc_contract(self):
        return self.contracts["mock_usdc"]

    def get_mock_usdt_contract(self):
        return self.contracts["mock_usdt"]

    def authorize_payment_on_chain(
        self, payment_id: str, sender: str, receiver: str, amount: int, 
        token: str, corridor: str, policy_version: str, compliance_hash: str
    ) -> str:
        contract = self.get_payment_authorization_contract()
        nonce = self.web3.eth.get_transaction_count(settings.BACKEND_WALLET_ADDRESS)
        
        tx = contract.functions.authorizePayment(
            Web3.to_bytes(hexstr=payment_id),
            sender,
            receiver,
            amount,
            token,
            corridor,
            policy_version,
            Web3.to_bytes(hexstr=compliance_hash)
        ).build_transaction({
            'from': settings.BACKEND_WALLET_ADDRESS,
            'nonce': nonce,
            'gas': 500000,
            'gasPrice': self.web3.eth.gas_price
        })

        signed_tx = self.web3.eth.account.sign_transaction(tx, settings.BACKEND_WALLET_PRIVATE_KEY)
        # Support both web3.py 5 (rawTransaction) and web3.py 6+ (raw_transaction)
        raw_tx = getattr(signed_tx, "rawTransaction", None) or getattr(signed_tx, "raw_transaction")
        tx_hash = self.web3.eth.send_raw_transaction(raw_tx)
        return tx_hash.hex()

    def register_proof_on_chain(
        self, payment_id: str, tx_hash: str, zk_proof_hash: str, 
        ai_decision: str, policy_version: str, amount: int, token: str
    ) -> str:
        contract = self.get_settlement_proof_registry_contract()
        nonce = self.web3.eth.get_transaction_count(settings.BACKEND_WALLET_ADDRESS)
        
        tx = contract.functions.registerProof(
            Web3.to_bytes(hexstr=payment_id),
            Web3.to_bytes(hexstr=tx_hash),
            Web3.to_bytes(hexstr=zk_proof_hash),
            ai_decision,
            policy_version,
            amount,
            token
        ).build_transaction({
            'from': settings.BACKEND_WALLET_ADDRESS,
            'nonce': nonce,
            'gas': 500000,
            'gasPrice': self.web3.eth.gas_price
        })

        signed_tx = self.web3.eth.account.sign_transaction(tx, settings.BACKEND_WALLET_PRIVATE_KEY)
        # Support both web3.py 5 (rawTransaction) and web3.py 6+ (raw_transaction)
        raw_tx = getattr(signed_tx, "rawTransaction", None) or getattr(signed_tx, "raw_transaction")
        tx_hash = self.web3.eth.send_raw_transaction(raw_tx)
        return tx_hash.hex()

    def get_proof_from_chain(self, payment_id: str) -> Dict[str, Any]:
        contract = self.get_settlement_proof_registry_contract()
        proof = contract.functions.getProof(Web3.to_bytes(hexstr=payment_id)).call()
        return {
            "paymentId": proof[0].hex(),
            "txHash": proof[1].hex(),
            "zkProofHash": proof[2].hex(),
            "aiDecision": proof[3],
            "policyVersion": proof[4],
            "amount": proof[5],
            "token": proof[6],
            "timestamp": proof[7],
            "registrar": proof[8]
        }

# Lazy singleton — initialized on first call to avoid startup crash
# when forge build has not been run yet.
_contract_service_instance: "ContractService | None" = None


def get_contract_service() -> "ContractService":
    """Return the singleton ContractService, initializing it on first call."""
    global _contract_service_instance
    if _contract_service_instance is None:
        _contract_service_instance = ContractService()
    return _contract_service_instance


class _LazyContractService:
    """
    Proxy that forwards all attribute access to the real ContractService.
    This allows `from ... import contract_service` to work correctly even
    though the real instance is created lazily.
    """
    def __getattr__(self, name: str):
        return getattr(get_contract_service(), name)

    def __bool__(self) -> bool:
        return True


# Backwards-compat alias — callers that do `from ... import contract_service`
# get a proxy that lazily initializes the real service on first use.
contract_service = _LazyContractService()

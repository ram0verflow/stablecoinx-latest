from app.services.blockchain.contract_service import ContractService
from app.core.config import settings

def test_contract_loading():
    try:
        service = ContractService()
        print("Successfully loaded all contracts!")
        print(f"Auth Address: {service.get_payment_authorization_contract().address}")
        print(f"Proof Registry Address: {service.get_settlement_proof_registry_contract().address}")
        print(f"Policy Registry Address: {service.get_policy_registry_contract().address}")
        print(f"USDC Address: {service.get_mock_usdc_contract().address}")
        print(f"USDT Address: {service.get_mock_usdt_contract().address}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_contract_loading()

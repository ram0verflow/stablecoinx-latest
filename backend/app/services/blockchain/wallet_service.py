from web3 import Web3
from app.core.config import settings
from app.core.blockchain_config import BASE_SEPOLIA, POLYGON_AMOY

class WalletService:
    def __init__(self):
        self.private_key = settings.BACKEND_WALLET_PRIVATE_KEY.strip() if settings.BACKEND_WALLET_PRIVATE_KEY else None
        self.address = settings.BACKEND_WALLET_ADDRESS.strip() if settings.BACKEND_WALLET_ADDRESS else None
        self.web3 = Web3(Web3.HTTPProvider(BASE_SEPOLIA["rpc"]))
        self.chain_id = BASE_SEPOLIA["chain_id"]

    def switch_to_polygon_amoy(self):
        """Reinitialize Web3 with POLYGON_AMOY_RPC_URL for fallback"""
        self.web3 = Web3(Web3.HTTPProvider(POLYGON_AMOY["rpc"]))
        self.chain_id = POLYGON_AMOY["chain_id"]

    def switch_to_base_sepolia(self):
        """Switch back to primary chain"""
        self.web3 = Web3(Web3.HTTPProvider(BASE_SEPOLIA["rpc"]))
        self.chain_id = BASE_SEPOLIA["chain_id"]

    def get_wallet_balance(self, address: str) -> dict:
        """Returns ETH balance in wei and ether"""
        if not address:
            return {"wei": 0, "ether": 0}
            
        address = self.web3.to_checksum_address(address)
        balance_wei = self.web3.eth.get_balance(address)
        balance_ether = float(self.web3.from_wei(balance_wei, "ether"))
        return {"wei": balance_wei, "ether": balance_ether}

    def sign_transaction(self, tx_dict: dict):
        """Signs with backend wallet"""
        if not self.private_key:
            raise Exception("Backend wallet private key not configured")
        
        # Ensure chain_id is in tx
        if "chainId" not in tx_dict:
            tx_dict["chainId"] = self.chain_id
            
        # Ensure nonce is in tx
        if "nonce" not in tx_dict and self.address:
            tx_dict["nonce"] = self.web3.eth.get_transaction_count(self.address)
            
        signed_tx = self.web3.eth.account.sign_transaction(tx_dict, self.private_key)
        return signed_tx

    def send_signed_transaction(self, signed_tx):
        """Broadcasts and returns tx hash"""
        tx_hash = self.web3.eth.send_raw_transaction(signed_tx.rawTransaction) # type: ignore
        return self.web3.to_hex(tx_hash)

    def get_transaction_receipt(self, tx_hash: str):
        """Returns receipt"""
        return self.web3.eth.wait_for_transaction_receipt(tx_hash)

wallet_service = WalletService()

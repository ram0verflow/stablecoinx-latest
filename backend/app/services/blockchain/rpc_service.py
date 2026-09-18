from web3 import Web3
from app.core.config import settings
from app.core.blockchain_config import BASE_SEPOLIA, POLYGON_AMOY

class RPCService:
    def __init__(self):
        self.base_sepolia_web3 = Web3(Web3.HTTPProvider(BASE_SEPOLIA["rpc"]))
        self.polygon_amoy_web3 = Web3(Web3.HTTPProvider(POLYGON_AMOY["rpc"]))

    def get_base_sepolia_web3(self):
        """Returns Web3 instance for Base Sepolia"""
        return self.base_sepolia_web3

    def get_polygon_amoy_web3(self):
        """Returns Web3 instance for Polygon Amoy"""
        return self.polygon_amoy_web3

    def get_web3_by_chain(self, chain: str) -> Web3:
        if chain.lower() == "polygon_amoy":
            return self.polygon_amoy_web3
        return self.base_sepolia_web3

    def check_rpc_health(self, chain: str = "base_sepolia") -> bool:
        """Returns True/False based on RPC connection health"""
        web3 = self.get_web3_by_chain(chain)
        try:
            return web3.is_connected()
        except Exception:
            return False

    def get_gas_price(self, chain: str = "base_sepolia") -> float:
        """Returns current gas price in gwei"""
        web3 = self.get_web3_by_chain(chain)
        gas_price_wei = web3.eth.gas_price
        return float(web3.from_wei(gas_price_wei, "gwei"))

    def estimate_gas(self, chain: str, tx: dict) -> int:
        """Returns gas estimate for a transaction"""
        web3 = self.get_web3_by_chain(chain)
        return web3.eth.estimate_gas(tx)

rpc_service = RPCService()

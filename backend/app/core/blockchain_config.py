from app.core.config import settings

BASE_SEPOLIA = {
  "chain_id": 84532,
  "name": "Base Sepolia",
  "rpc": settings.BASE_SEPOLIA_RPC_URL,
  "explorer": "https://sepolia.basescan.org"
}

POLYGON_AMOY = {
  "chain_id": 80002,
  "name": "Polygon Amoy",
  "rpc": settings.POLYGON_AMOY_RPC_URL,
  "explorer": "https://amoy.polygonscan.com"
}

from app.core.config import settings

BASE_SEPOLIA = {
  "chain_id": settings.BASE_SEPOLIA_CHAIN_ID,  # FIXED: env-audit-chain-id
  "name": "Base Sepolia",
  "rpc": settings.BASE_SEPOLIA_RPC_URL,
  "explorer": "https://sepolia.basescan.org"
}

POLYGON_AMOY = {
  "chain_id": settings.POLYGON_AMOY_CHAIN_ID,  # FIXED: env-audit-chain-id
  "name": "Polygon Amoy",
  "rpc": settings.POLYGON_AMOY_RPC_URL,
  "explorer": "https://amoy.polygonscan.com"
}

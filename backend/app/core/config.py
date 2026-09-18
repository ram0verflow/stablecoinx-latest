from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # Supabase
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    # Database
    DATABASE_URL: str = "postgresql://localhost:5432/settleguard"

    # JWT
    JWT_SECRET_KEY: str = "super-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # Blockchain
    ALCHEMY_API_KEY: str = ""
    BASE_SEPOLIA_RPC_URL: str = ""
    POLYGON_AMOY_RPC_URL: str = ""
    BACKEND_WALLET_PRIVATE_KEY: str = ""
    BACKEND_WALLET_ADDRESS: str = ""

    # Contract addresses
    PAYMENT_AUTHORIZATION_ADDRESS: str = ""
    SETTLEMENT_PROOF_REGISTRY_ADDRESS: str = ""
    POLICY_REGISTRY_ADDRESS: str = ""
    MOCK_USDC_ADDRESS: str = ""
    MOCK_USDT_ADDRESS: str = ""

    # AI
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "gemma:2b"
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama3-8b-8192"

    # Redis
    REDIS_URL: str = "redis://localhost:6379"

    # Graph DB
    NEO4J_URI: str = ""
    NEO4J_USERNAME: str = "neo4j"
    NEO4J_PASSWORD: str = ""

    # Telegram
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_CHAT_ID: str = ""

    # App
    ENVIRONMENT: str = "development"
    BACKEND_PORT: int = 8000
    FRONTEND_URL: str = "http://localhost:5173"
    BACKEND_URL: str = "http://localhost:8000"
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    # Privacy infra
    ZK_PROVER_URL: str = "http://localhost:3001"
    FHE_GATEWAY_URL: str = "http://localhost:3002"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    model_config = {
        "env_file": (".env", "../.env"),
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


settings = Settings()

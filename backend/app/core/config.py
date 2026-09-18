import json  # FIXED: C3
from typing import Any, Dict, List  # FIXED: C3

from pydantic import Field, field_validator, model_validator  # FIXED: C3
from pydantic_settings import BaseSettings  # FIXED: C3


class Settings(BaseSettings):  # FIXED: C3
    # Supabase  # FIXED: C3
    SUPABASE_URL: str = Field(...)  # FIXED: C3
    SUPABASE_ANON_KEY: str = Field(...)  # FIXED: C3
    SUPABASE_SERVICE_ROLE_KEY: str = Field("")  # FIXED: C3
    SUPABASE_SERVICE_KEY: str = Field("")  # FIXED: C3

    # Database  # FIXED: C3
    DATABASE_URL: str = Field(...)  # FIXED: C3

    # JWT  # FIXED: C3
    JWT_SECRET_KEY: str = Field(...)  # FIXED: C3
    JWT_ALGORITHM: str = "HS256"  # FIXED: C3
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60  # FIXED: C3

    # Blockchain  # FIXED: C3
    ALCHEMY_API_KEY: str = Field("")  # FIXED: C3
    BASE_SEPOLIA_RPC_URL: str = Field(...)  # FIXED: C3
    POLYGON_AMOY_RPC_URL: str = Field("")  # FIXED: C3
    BACKEND_WALLET_PRIVATE_KEY: str = Field(...)  # FIXED: C3
    BACKEND_WALLET_ADDRESS: str = Field("")  # FIXED: C3

    # Canonical contract env names (preferred)  # FIXED: PHASE5
    CONTRACT_ADDRESS_SETTLEMENT: str = Field("")  # FIXED: PHASE5
    CONTRACT_ADDRESS_COMPLIANCE: str = Field("")  # FIXED: PHASE5
    CONTRACT_ADDRESS_TREASURY: str = Field("")  # FIXED: PHASE5
    CONTRACT_ADDRESS_REGISTRY: str = Field("")  # FIXED: PHASE5

    # Legacy contract addresses (filled from canonical via validator when empty)  # FIXED: PHASE5
    PAYMENT_AUTHORIZATION_ADDRESS: str = Field("")  # FIXED: PHASE5
    SETTLEMENT_PROOF_REGISTRY_ADDRESS: str = Field("")  # FIXED: PHASE5
    POLICY_REGISTRY_ADDRESS: str = Field("")  # FIXED: PHASE5
    MOCK_USDC_ADDRESS: str = Field("")  # FIXED: PHASE5
    MOCK_USDT_ADDRESS: str = Field("")  # FIXED: PHASE5

    # AI  # FIXED: C3
    OLLAMA_BASE_URL: str = Field(...)  # FIXED: C3
    OLLAMA_MODEL: str = Field(...)  # FIXED: PHASE5
    GROQ_API_KEY: str = Field(...)  # FIXED: C3
    GROQ_MODEL: str = Field(...)  # FIXED: PHASE5 — value from env only (see GROQ_MODEL in .env)

    # Chain/runtime constants  # FIXED: C3
    BASE_SEPOLIA_CHAIN_ID: int = Field(...)  # FIXED: C3
    POLYGON_AMOY_CHAIN_ID: int = 80002  # FIXED: PHASE5
    CONTRACT_ABI_PATH: str = Field(...)  # FIXED: C3
    CONTRACT_ABI_ARTIFACT_MAP: str = Field("")  # FIXED: C1

    # Treasury controls defaults (overridable via env)  # FIXED: C3
    TREASURY_DAILY_LIMIT: float = 500000.0  # FIXED: C3
    PAYROLL_BATCH_CAP: float = 50000.0  # FIXED: C3

    # Redis  # FIXED: C3
    REDIS_URL: str = Field(...)  # FIXED: C3

    # Graph DB  # FIXED: C3
    NEO4J_URI: str = Field(...)  # FIXED: C3
    NEO4J_USERNAME: str = Field(...)  # FIXED: C3
    NEO4J_USER: str = Field("")  # FIXED: C3
    NEO4J_PASSWORD: str = Field(...)  # FIXED: C3

    # Telegram  # FIXED: C3
    TELEGRAM_BOT_TOKEN: str = Field(...)  # FIXED: C3
    TELEGRAM_CHAT_ID: str = Field(...)  # FIXED: C3

    # App  # FIXED: C3
    APP_ENV: str = Field(...)  # FIXED: C3
    ENVIRONMENT: str = Field("")  # FIXED: C3
    BACKEND_PORT: int = 8000  # FIXED: C3
    FRONTEND_URL: str = Field("")  # FIXED: PHASE5
    BACKEND_URL: str = Field("")  # FIXED: PHASE5
    CORS_ORIGINS: str = Field("")  # FIXED: S2
    ALLOWED_ORIGINS: str = Field("")  # FIXED: S2

    # Privacy infra  # FIXED: PHASE5
    ZK_PROVER_URL: str = Field("")  # FIXED: PHASE5
    FHE_GATEWAY_URL: str = Field("")  # FIXED: PHASE5

    model_config = {  # FIXED: C3
        "env_file": (".env", "../.env"),  # FIXED: C3
        "env_file_encoding": "utf-8",  # FIXED: C3
        "extra": "ignore",  # FIXED: C3
    }  # FIXED: C3

    @field_validator("JWT_SECRET_KEY")  # FIXED: C3
    @classmethod  # FIXED: C3
    def validate_jwt_secret_length(cls, v: str) -> str:  # FIXED: C3
        if not v or len(v) < 32:  # FIXED: C3
            raise ValueError("JWT_SECRET_KEY must be set and at least 32 characters long")  # FIXED: C3
        return v  # FIXED: C3

    @field_validator("APP_ENV")  # FIXED: C3
    @classmethod  # FIXED: C3
    def validate_app_env(cls, v: str) -> str:  # FIXED: C3
        allowed = ("demo", "staging", "production", "development")  # FIXED: C3
        if v not in allowed:  # FIXED: C3
            raise ValueError(f"APP_ENV must be one of {allowed}")  # FIXED: C3
        return v  # FIXED: C3

    @field_validator("OLLAMA_MODEL", "GROQ_MODEL", mode="before")  # FIXED: C3
    @classmethod  # FIXED: C3
    def strip_model_names(cls, v: Any) -> Any:  # FIXED: C3
        return v.strip() if isinstance(v, str) else v  # FIXED: C3

    @model_validator(mode="after")  # FIXED: C3
    def sync_aliases_and_addresses(self) -> "Settings":  # FIXED: C3
        if not self.SUPABASE_SERVICE_KEY.strip() and self.SUPABASE_SERVICE_ROLE_KEY.strip():  # FIXED: C3
            self.SUPABASE_SERVICE_KEY = self.SUPABASE_SERVICE_ROLE_KEY  # FIXED: C3
        if not self.NEO4J_USER.strip() and self.NEO4J_USERNAME.strip():  # FIXED: C3
            self.NEO4J_USER = self.NEO4J_USERNAME  # FIXED: C3
        if not self.ENVIRONMENT.strip():  # FIXED: C3
            self.ENVIRONMENT = self.APP_ENV  # FIXED: C3
        if not self.CONTRACT_ADDRESS_COMPLIANCE.strip() and self.PAYMENT_AUTHORIZATION_ADDRESS.strip():  # FIXED: PHASE5
            self.CONTRACT_ADDRESS_COMPLIANCE = self.PAYMENT_AUTHORIZATION_ADDRESS  # FIXED: PHASE5
        if not self.PAYMENT_AUTHORIZATION_ADDRESS.strip() and self.CONTRACT_ADDRESS_COMPLIANCE.strip():  # FIXED: PHASE5
            self.PAYMENT_AUTHORIZATION_ADDRESS = self.CONTRACT_ADDRESS_COMPLIANCE  # FIXED: PHASE5
        if not self.CONTRACT_ADDRESS_SETTLEMENT.strip() and self.SETTLEMENT_PROOF_REGISTRY_ADDRESS.strip():  # FIXED: PHASE5
            self.CONTRACT_ADDRESS_SETTLEMENT = self.SETTLEMENT_PROOF_REGISTRY_ADDRESS  # FIXED: PHASE5
        if not self.SETTLEMENT_PROOF_REGISTRY_ADDRESS.strip() and self.CONTRACT_ADDRESS_SETTLEMENT.strip():  # FIXED: PHASE5
            self.SETTLEMENT_PROOF_REGISTRY_ADDRESS = self.CONTRACT_ADDRESS_SETTLEMENT  # FIXED: PHASE5
        if not self.CONTRACT_ADDRESS_REGISTRY.strip() and self.POLICY_REGISTRY_ADDRESS.strip():  # FIXED: PHASE5
            self.CONTRACT_ADDRESS_REGISTRY = self.POLICY_REGISTRY_ADDRESS  # FIXED: PHASE5
        if not self.POLICY_REGISTRY_ADDRESS.strip() and self.CONTRACT_ADDRESS_REGISTRY.strip():  # FIXED: PHASE5
            self.POLICY_REGISTRY_ADDRESS = self.CONTRACT_ADDRESS_REGISTRY  # FIXED: PHASE5
        if not self.CONTRACT_ADDRESS_TREASURY.strip() and self.MOCK_USDC_ADDRESS.strip():  # FIXED: PHASE5
            self.CONTRACT_ADDRESS_TREASURY = self.MOCK_USDC_ADDRESS  # FIXED: PHASE5
        if not self.MOCK_USDC_ADDRESS.strip() and self.CONTRACT_ADDRESS_TREASURY.strip():  # FIXED: PHASE5
            self.MOCK_USDC_ADDRESS = self.CONTRACT_ADDRESS_TREASURY  # FIXED: PHASE5
        return self  # FIXED: C3

    @property  # FIXED: C1
    def abi_logical_to_artifact(self) -> Dict[str, str]:  # FIXED: C1
        raw = self.CONTRACT_ABI_ARTIFACT_MAP.strip()  # FIXED: C1
        if raw:  # FIXED: C1
            return json.loads(raw)  # FIXED: C1
        return {  # FIXED: C1
            "payment_authorization": "PaymentAuthorization",  # FIXED: C1
            "settlement_proof_registry": "SettlementProofRegistry",  # FIXED: C1
            "policy_registry": "PolicyRegistry",  # FIXED: C1
            "mock_stablecoin": "MockStablecoinERC20",  # FIXED: C1
        }  # FIXED: C1

    @property  # FIXED: S2
    def cors_allowed_origins_list(self) -> List[str]:  # FIXED: S2
        primary = self.ALLOWED_ORIGINS.strip() or self.CORS_ORIGINS.strip()  # FIXED: S2
        return [o.strip() for o in primary.split(",") if o.strip()]  # FIXED: S2

    def validate_config(self) -> None:  # FIXED: C3
        required = [  # FIXED: C3
            "DATABASE_URL",  # FIXED: C3
            "REDIS_URL",  # FIXED: C3
            "JWT_SECRET_KEY",  # FIXED: C3
            "SUPABASE_URL",  # FIXED: C3
            "SUPABASE_ANON_KEY",  # FIXED: C3
            "SUPABASE_SERVICE_KEY",  # FIXED: C3
            "OLLAMA_BASE_URL",  # FIXED: C3
            "OLLAMA_MODEL",  # FIXED: C3
            "GROQ_API_KEY",  # FIXED: C3
            "GROQ_MODEL",  # FIXED: C3
            "NEO4J_URI",  # FIXED: C3
            "NEO4J_USER",  # FIXED: C3
            "NEO4J_PASSWORD",  # FIXED: C3
            "TELEGRAM_BOT_TOKEN",  # FIXED: C3
            "TELEGRAM_CHAT_ID",  # FIXED: C3
            "BACKEND_WALLET_PRIVATE_KEY",  # FIXED: C3
            "CONTRACT_ABI_PATH",  # FIXED: C3
            "BASE_SEPOLIA_CHAIN_ID",  # FIXED: C3
            "BASE_SEPOLIA_RPC_URL",  # FIXED: C3
            "CONTRACT_ADDRESS_SETTLEMENT",  # FIXED: C3
            "CONTRACT_ADDRESS_COMPLIANCE",  # FIXED: C3
            "CONTRACT_ADDRESS_TREASURY",  # FIXED: C3
            "CONTRACT_ADDRESS_REGISTRY",  # FIXED: C3
            "APP_ENV",  # FIXED: C3
        ]  # FIXED: C3
        missing = [k for k in required if not str(getattr(self, k, "") or "").strip()]  # FIXED: C3
        if missing:  # FIXED: C3
            raise RuntimeError(  # FIXED: C3
                "Startup failed — missing environment variables: " + ", ".join(missing)  # FIXED: C3
            )  # FIXED: C3


settings = Settings()  # FIXED: C3

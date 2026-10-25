"""Application configuration management using Pydantic Settings."""

from functools import lru_cache
from typing import List, Optional, Union
from pydantic import SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuration settings loaded from environment variables and .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # Application details
    APP_NAME: str = "CyberPulse Backend"
    APP_VERSION: str = "0.1.0"
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"

    # Server binding & hosting platform adaptation
    BACKEND_HOST: str = "127.0.0.1"
    BACKEND_PORT: int = 8000
    PORT: Optional[int] = None

    # Static distribution directory override
    FRONTEND_DIST_DIR: Optional[str] = None

    @model_validator(mode="after")
    def resolve_server_port(self) -> "Settings":
        """Support hosting platforms that inject PORT (e.g., Render, Cloud Run, Railway)."""
        if self.PORT is not None:
            self.BACKEND_PORT = self.PORT
        return self

    # Cross-Origin Resource Sharing (CORS)
    BACKEND_CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    # Cloudflare Radar API settings
    # Using SecretStr ensures credentials are never accidentally logged or exposed in stack traces
    CLOUDFLARE_API_TOKEN: Union[SecretStr, None] = None
    CLOUDFLARE_API_BASE_URL: str = "https://api.cloudflare.com/client/v4/radar"

    # Reliability & Caching parameters
    CACHE_TTL_SECONDS: int = 900  # 15 minutes default TTL
    CACHE_MAX_STALE_SECONDS: int = 86400  # 24 hours maximum stale age
    CACHE_PARTIAL_TTL_SECONDS: int = 30  # 30 seconds for short-lived partial upstream responses
    RADAR_REQUEST_TIMEOUT_SECONDS: float = 15.0
    RADAR_MAX_RETRIES: int = 2
    BACKEND_RATE_LIMIT_PER_MINUTE: int = 60
    TRUSTED_PROXIES: Union[List[str], str] = []

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, value: Union[str, List[str]]) -> List[str]:
        """Convert a comma-separated string of origins into a list if needed."""
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        if isinstance(value, list):
            return value
        return ["http://localhost:5173", "http://127.0.0.1:5173"]

    @field_validator("TRUSTED_PROXIES", mode="before")
    @classmethod
    def assemble_trusted_proxies(cls, value: Union[str, List[str]]) -> List[str]:
        """Convert a comma-separated string of trusted proxy IPs/CIDRs into a list."""
        if isinstance(value, str):
            return [proxy.strip() for proxy in value.split(",") if proxy.strip()]
        if isinstance(value, list):
            return value
        return []

    @property
    def is_cloudflare_configured(self) -> bool:
        """Check whether a valid, non-placeholder Cloudflare API token is present."""
        if not self.CLOUDFLARE_API_TOKEN:
            return False
        token = self.CLOUDFLARE_API_TOKEN.get_secret_value().strip()
        # Ensure it's not empty and not the placeholder from .env.example
        return bool(token and token != "your_cloudflare_api_token_here")

    def get_cloudflare_token(self) -> Union[str, None]:
        """Safely retrieve the raw token value if configured."""
        if self.is_cloudflare_configured and self.CLOUDFLARE_API_TOKEN is not None:
            return self.CLOUDFLARE_API_TOKEN.get_secret_value()
        return None


@lru_cache
def get_settings() -> Settings:
    """Return a cached singleton instance of Settings."""
    return Settings()

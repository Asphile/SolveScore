import os
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "sqlite:///./solvescore.db"

    secret_key: str = "insecure-dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 480

    ai_provider: str = "stub"
    ai_api_key: str = ""

    file_storage_path: str = "./uploads"
    max_document_size_mb: int = 25
    max_video_size_mb: int = 500

    frontend_origin: str = "http://localhost:5173"

    default_max_participants: int = 20

    @property
    def frontend_origins(self) -> list[str]:
        """Comma-separated FRONTEND_ORIGIN support, e.g. for allowing both the
        production Cloudflare Pages URL and localhost during a migration.
        """
        return [origin.strip() for origin in self.frontend_origin.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
os.makedirs(settings.file_storage_path, exist_ok=True)

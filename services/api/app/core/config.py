"""Configuración central de APACH (variables de entorno)."""
from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="APACH_", extra="ignore")

    env: str = Field(default="development", description="development | demo | test | production")
    database_url: str = "postgresql+psycopg://apach:apach_dev@localhost:5433/apach"
    storage_dir: Path = Path("./storage")
    shared_content_dir: Path = Path(__file__).resolve().parents[4] / "packages" / "shared" / "content"

    session_ttl_hours: int = 12
    cookie_secure: bool = False
    cookie_samesite: str = "lax"
    cors_origins: list[str] = ["http://localhost:5173"]

    max_upload_mb: int = 10
    max_docx_uncompressed_mb: int = 60
    max_docx_entries: int = 2000

    login_max_failures: int = 5
    login_window_minutes: int = 15

    activation_token_hours: int = 72
    reset_token_minutes: int = 60
    # Solo en development/demo: devuelve el enlace de activación/restablecimiento al ADMIN.
    expose_dev_links: bool = True
    public_base_url: str = "http://localhost:5173"
    institutional_contact: str = "Coordinación académica ECC"
    welcome_video_url: str = ""

    @property
    def is_production(self) -> bool:
        return self.env == "production"

    @property
    def dev_links_enabled(self) -> bool:
        return self.expose_dev_links and not self.is_production


@lru_cache
def get_settings() -> Settings:
    return Settings()

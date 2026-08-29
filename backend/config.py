"""Application configuration loaded from environment variables."""

import os
from pathlib import Path
from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent

# Vercel serverless: only /tmp is writable
IS_VERCEL = bool(os.environ.get("VERCEL"))

if IS_VERCEL:
    _data_dir = Path("/tmp") / "app_data"
else:
    _data_dir = BASE_DIR / "data"

class Settings(BaseSettings):
    APP_NAME: str = "AI Network Compliance Auditor"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = not IS_VERCEL  # Disable debug on Vercel by default

    # Database
    DATABASE_URL: str = f"sqlite:///{_data_dir / 'app.db'}"

    # File storage paths
    UPLOAD_DIR: Path = _data_dir / "uploads"
    REPORTS_DIR: Path = _data_dir / "reports"

    # Gemini AI
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.0-flash"

    # Compliance rules directory
    RULES_DIR: Path = BASE_DIR / "compliance_rules"

    # CORS — additional origins (comma-separated) for deployed frontends
    CORS_ORIGINS: str = ""

    class Config:
        env_file = BASE_DIR / ".env"
        env_file_encoding = "utf-8"

    def ensure_dirs(self):
        """Create required directories if they don't exist."""
        self.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        self.REPORTS_DIR.mkdir(parents=True, exist_ok=True)

settings = Settings()
settings.ensure_dirs()

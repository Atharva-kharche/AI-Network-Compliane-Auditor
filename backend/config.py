"""Application configuration loaded from environment variables."""

import os
from pathlib import Path
from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent

class Settings(BaseSettings):
    APP_NAME: str = "AI Network Compliance Auditor"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str = f"sqlite:///{BASE_DIR / 'data' / 'app.db'}"

    # File storage paths
    UPLOAD_DIR: Path = BASE_DIR / "data" / "uploads"
    REPORTS_DIR: Path = BASE_DIR / "data" / "reports"

    # Gemini AI
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.0-flash"

    # Compliance rules directory
    RULES_DIR: Path = BASE_DIR / "compliance_rules"

    class Config:
        env_file = BASE_DIR / ".env"
        env_file_encoding = "utf-8"

    def ensure_dirs(self):
        """Create required directories if they don't exist."""
        self.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        self.REPORTS_DIR.mkdir(parents=True, exist_ok=True)

settings = Settings()
settings.ensure_dirs()

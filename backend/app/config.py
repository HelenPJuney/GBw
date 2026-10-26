"""
WINDLENS Configuration Module

Centralised application configuration using pydantic-settings.
All configurable values are documented and loaded from environment variables.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # --- Elexon API ---
    ELEXON_BASE_URL: str = "https://data.elexon.co.uk/bmrs/api/v1"
    ELEXON_API_KEY: Optional[str] = None  # Not required for public endpoints

    # --- Analysis Period ---
    ANALYSIS_START_DATE: str = "2026-01-01"
    ANALYSIS_END_DATE: str = "2026-01-31"
    # Forecast publication lookback into December for pre-Jan forecasts
    FORECAST_LOOKBACK_DAYS: int = 3

    # --- Decision Cutoff Policy ---
    # "end_of_preceding_day" => cutoff is 23:59:59.999999 of the day before the delivery date
    DECISION_CUTOFF_POLICY: str = "end_of_preceding_day"

    # --- Data Storage ---
    DATA_DIR: str = "data"
    CACHE_TTL_SECONDS: int = 3600  # 1 hour cache TTL

    # --- Server ---
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    # --- HTTP Client ---
    HTTP_TIMEOUT_SECONDS: int = 60
    HTTP_MAX_RETRIES: int = 3
    HTTP_RETRY_DELAY_SECONDS: float = 2.0
    # Respectful rate limiting: minimum seconds between API requests
    REQUEST_RATE_LIMIT_SECONDS: float = 0.5

    # --- Logging ---
    LOG_LEVEL: str = "INFO"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()

"""
WINDLENS Data Service

Handles data ingestion, validation, normalization, caching, and storage.
Responsible for fetching from both Elexon endpoints, filtering WIND records,
parsing timestamps, deduplication, and persisting to Parquet files.
"""

import logging
import os
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
import pytz

from app.clients.elexon import elexon_client, ElexonAPIError
from app.config import settings

logger = logging.getLogger("windlens.data_service")

UK_TZ = pytz.timezone("Europe/London")


class DataService:
    """Manages data ingestion, caching, and retrieval for WINDLENS."""

    def __init__(self):
        self._actuals_cache: Optional[pd.DataFrame] = None
        self._forecasts_cache: Optional[pd.DataFrame] = None
        self._cache_timestamp: Optional[float] = None
        self._fetch_errors: List[str] = []
        self._fetch_warnings: List[str] = []
        self._raw_fuelhh_count: int = 0
        self._raw_windfor_count: int = 0
        self._duplicate_actuals: int = 0
        self._duplicate_forecasts: int = 0
        self._matched_cache: Optional[pd.DataFrame] = None
        self.data_dir = settings.DATA_DIR
        os.makedirs(self.data_dir, exist_ok=True)

    def _is_cache_valid(self) -> bool:
        if self._cache_timestamp is None:
            return False
        return (time.time() - self._cache_timestamp) < settings.CACHE_TTL_SECONDS

    def _resolve_data_path(self, filename: str) -> str:
        candidates = [
            os.path.join(self.data_dir, filename),
            os.path.join("..", self.data_dir, filename),
            os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data", filename),
            os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "backend", "data", filename),
        ]
        for c in candidates:
            if os.path.exists(c):
                return c
        return os.path.join(self.data_dir, filename)

    def _actuals_parquet_path(self) -> str:
        return self._resolve_data_path("actuals_wind_jan2026.parquet")

    def _forecasts_parquet_path(self) -> str:
        return self._resolve_data_path("forecasts_windfor_jan2026.parquet")

    def _metadata_path(self) -> str:
        return self._resolve_data_path("metadata.json")

    def _load_persisted_metadata(self):
        meta_path = self._metadata_path()
        if os.path.exists(meta_path):
            try:
                import json
                with open(meta_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self._raw_fuelhh_count = data.get("raw_fuelhh_count", self._raw_fuelhh_count)
                    self._raw_windfor_count = data.get("raw_windfor_count", self._raw_windfor_count)
                    self._duplicate_actuals = data.get("duplicate_actuals_removed", self._duplicate_actuals)
                    self._duplicate_forecasts = data.get("duplicate_forecasts_removed", self._duplicate_forecasts)
            except Exception as e:
                logger.warning(f"Could not load metadata from {meta_path}: {e}")

    def _save_persisted_metadata(self):
        meta_path = self._metadata_path()
        try:
            import json
            payload = {
                "raw_fuelhh_count": self._raw_fuelhh_count,
                "raw_windfor_count": self._raw_windfor_count,
                "duplicate_actuals_removed": self._duplicate_actuals,
                "duplicate_forecasts_removed": self._duplicate_forecasts,
                "last_fetch": datetime.now(timezone.utc).isoformat(),
            }
            with open(meta_path, "w", encoding="utf-8") as f:
                json.dump(payload, f, indent=2)
        except Exception as e:
            logger.warning(f"Could not save metadata to {meta_path}: {e}")

    async def get_actuals(self) -> pd.DataFrame:
        """Return validated WIND actual generation for Jan 2026."""
        if self._actuals_cache is not None and self._is_cache_valid():
            return self._actuals_cache.copy()

        # Try loading from Parquet
        path = self._actuals_parquet_path()
        if os.path.exists(path):
            logger.info(f"Loading actuals from {path}")
            self._actuals_cache = pd.read_parquet(path)
            self._cache_timestamp = time.time()
            self._load_persisted_metadata()
            if self._raw_fuelhh_count == 0 and self._actuals_cache is not None:
                self._raw_fuelhh_count = len(self._actuals_cache)
            return self._actuals_cache.copy()

        # Fetch from API
        await self._fetch_and_process_actuals()
        return self._actuals_cache.copy() if self._actuals_cache is not None else pd.DataFrame()

    async def get_forecasts(self) -> pd.DataFrame:
        """Return validated WINDFOR forecasts covering Jan 2026 delivery intervals."""
        if self._forecasts_cache is not None and self._is_cache_valid():
            return self._forecasts_cache.copy()

        path = self._forecasts_parquet_path()
        if os.path.exists(path):
            logger.info(f"Loading forecasts from {path}")
            self._forecasts_cache = pd.read_parquet(path)
            self._cache_timestamp = time.time()
            self._load_persisted_metadata()
            if self._raw_windfor_count == 0 and self._forecasts_cache is not None:
                self._raw_windfor_count = len(self._forecasts_cache)
            return self._forecasts_cache.copy()

        await self._fetch_and_process_forecasts()
        return self._forecasts_cache.copy() if self._forecasts_cache is not None else pd.DataFrame()

    async def get_matched(self) -> pd.DataFrame:
        """Return cached matched actuals and eligible forecasts."""
        if self._matched_cache is not None and self._is_cache_valid():
            return self._matched_cache.copy()

        actuals = await self.get_actuals()
        forecasts = await self.get_forecasts()
        if actuals.empty or forecasts.empty:
            return pd.DataFrame()

        from app.services.forecast_selection import select_eligible_forecasts
        self._matched_cache = select_eligible_forecasts(forecasts, actuals)
        return self._matched_cache.copy()

    async def _fetch_and_process_actuals(self):
        """Fetch FUELHH data for Jan 2026, filter to WIND, validate, and cache."""
        self._fetch_errors = []
        self._fetch_warnings = []

        try:
            raw_data = await elexon_client.fetch_fuelhh_chunked(
                start_date=settings.ANALYSIS_START_DATE,
                end_date=settings.ANALYSIS_END_DATE,
            )
            self._raw_fuelhh_count = len(raw_data)
            logger.info(f"Fetched {len(raw_data)} total FUELHH records")
        except ElexonAPIError as e:
            error_msg = f"Failed to fetch FUELHH data: {e}"
            logger.error(error_msg)
            self._fetch_errors.append(error_msg)
            self._actuals_cache = pd.DataFrame()
            return

        if not raw_data:
            self._fetch_warnings.append("FUELHH API returned zero records")
            self._actuals_cache = pd.DataFrame()
            return

        df = pd.DataFrame(raw_data)
        self._validate_fuelhh_schema(df)

        # Filter to WIND only
        df = df[df["fuelType"] == "WIND"].copy()
        logger.info(f"WIND records after filtering: {len(df)}")

        # Parse timestamps
        df["startTime"] = pd.to_datetime(df["startTime"], utc=True)
        df["publishTime"] = pd.to_datetime(df["publishTime"], utc=True)

        # Restrict to January 2026 delivery intervals
        jan_start = pd.Timestamp("2026-01-01T00:00:00", tz="UTC")
        feb_start = pd.Timestamp("2026-02-01T00:00:00", tz="UTC")
        df = df[(df["startTime"] >= jan_start) & (df["startTime"] < feb_start)]

        # Validate numeric values
        df["generation"] = pd.to_numeric(df["generation"], errors="coerce")
        invalid_count = df["generation"].isna().sum()
        if invalid_count > 0:
            self._fetch_warnings.append(f"{invalid_count} records had non-numeric generation values")
        df = df.dropna(subset=["generation"])

        # Deduplicate: business key = (startTime, fuelType)
        # Keep latest publishTime if duplicates exist
        before_dedup = len(df)
        df = df.sort_values("publishTime", ascending=False)
        df = df.drop_duplicates(subset=["startTime"], keep="first")
        self._duplicate_actuals = before_dedup - len(df)
        if self._duplicate_actuals > 0:
            logger.info(f"Removed {self._duplicate_actuals} duplicate actual records (kept latest publishTime)")

        df = df.sort_values("startTime").reset_index(drop=True)

        # Add UK local time column
        df["startTime_uk"] = df["startTime"].dt.tz_convert(UK_TZ)

        # Persist to Parquet
        df.to_parquet(self._actuals_parquet_path(), index=False)
        logger.info(f"Saved {len(df)} actual WIND records to Parquet")

        self._actuals_cache = df
        self._cache_timestamp = time.time()
        self._save_persisted_metadata()

    async def _fetch_and_process_forecasts(self):
        """Fetch WINDFOR data covering Jan 2026 delivery intervals, validate, and cache."""
        self._fetch_errors = []
        self._fetch_warnings = []

        # Forecasts published from late December through end of January
        # to capture forecasts published before Jan 1 delivery intervals
        lookback_start = "2025-12-28T00:00:00Z"
        publish_end = "2026-02-01T00:00:00Z"

        try:
            raw_data = await elexon_client.fetch_windfor_chunked(
                publish_from=lookback_start,
                publish_to=publish_end,
                chunk_hours=24,
            )
            self._raw_windfor_count = len(raw_data)
            logger.info(f"Fetched {len(raw_data)} total WINDFOR records")
        except ElexonAPIError as e:
            error_msg = f"Failed to fetch WINDFOR data: {e}"
            logger.error(error_msg)
            self._fetch_errors.append(error_msg)
            self._forecasts_cache = pd.DataFrame()
            return

        if not raw_data:
            self._fetch_warnings.append("WINDFOR API returned zero records")
            self._forecasts_cache = pd.DataFrame()
            return

        df = pd.DataFrame(raw_data)
        self._validate_windfor_schema(df)

        # Parse timestamps
        df["startTime"] = pd.to_datetime(df["startTime"], utc=True)
        df["publishTime"] = pd.to_datetime(df["publishTime"], utc=True)

        # Filter to delivery intervals in January 2026
        jan_start = pd.Timestamp("2026-01-01T00:00:00", tz="UTC")
        feb_start = pd.Timestamp("2026-02-01T00:00:00", tz="UTC")
        df = df[(df["startTime"] >= jan_start) & (df["startTime"] < feb_start)]

        # Validate generation values
        df["generation"] = pd.to_numeric(df["generation"], errors="coerce")
        invalid_count = df["generation"].isna().sum()
        if invalid_count > 0:
            self._fetch_warnings.append(f"{invalid_count} forecast records had non-numeric generation values")
        df = df.dropna(subset=["generation"])

        # Deduplicate: same (startTime, publishTime) with same generation
        before_dedup = len(df)
        df = df.drop_duplicates(subset=["startTime", "publishTime"], keep="first")
        self._duplicate_forecasts = before_dedup - len(df)
        if self._duplicate_forecasts > 0:
            logger.info(f"Removed {self._duplicate_forecasts} duplicate forecast records")

        df = df.sort_values(["startTime", "publishTime"]).reset_index(drop=True)

        # Add UK local time columns
        df["startTime_uk"] = df["startTime"].dt.tz_convert(UK_TZ)
        df["publishTime_uk"] = df["publishTime"].dt.tz_convert(UK_TZ)

        # Persist
        df.to_parquet(self._forecasts_parquet_path(), index=False)
        logger.info(f"Saved {len(df)} forecast records to Parquet")

        self._forecasts_cache = df
        self._cache_timestamp = time.time()
        self._save_persisted_metadata()

    def _validate_fuelhh_schema(self, df: pd.DataFrame):
        required = {"startTime", "publishTime", "fuelType", "generation"}
        missing = required - set(df.columns)
        if missing:
            raise ValueError(f"FUELHH response missing required fields: {missing}")

    def _validate_windfor_schema(self, df: pd.DataFrame):
        required = {"startTime", "publishTime", "generation"}
        missing = required - set(df.columns)
        if missing:
            raise ValueError(f"WINDFOR response missing required fields: {missing}")

    def get_fetch_metadata(self) -> Dict[str, Any]:
        return {
            "raw_fuelhh_count": self._raw_fuelhh_count,
            "raw_windfor_count": self._raw_windfor_count,
            "duplicate_actuals_removed": self._duplicate_actuals,
            "duplicate_forecasts_removed": self._duplicate_forecasts,
            "errors": list(self._fetch_errors),
            "warnings": list(self._fetch_warnings),
            "last_fetch": datetime.now(timezone.utc).isoformat() if self._cache_timestamp else None,
        }

    async def refresh_data(self):
        """Force re-fetch from Elexon APIs."""
        # Remove cached Parquet files
        for path in [self._actuals_parquet_path(), self._forecasts_parquet_path()]:
            if os.path.exists(path):
                os.remove(path)
        self._actuals_cache = None
        self._forecasts_cache = None
        self._matched_cache = None
        self._cache_timestamp = None
        await self._fetch_and_process_actuals()
        await self._fetch_and_process_forecasts()


# Singleton
data_service = DataService()

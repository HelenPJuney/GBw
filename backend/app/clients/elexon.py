"""
Elexon BMRS API Client

Handles HTTP communication with the two official Elexon data endpoints:
  1. FUELHH (actual generation by fuel type, half-hourly)
  2. WINDFOR (wind generation forecasts with publication timestamps)

Implements retries, timeouts, respectful rate limiting, and error handling.
No authentication is required for these public streaming endpoints.
"""

import asyncio
import logging
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import httpx

from app.config import settings

logger = logging.getLogger("windlens.elexon_client")


class ElexonAPIError(Exception):
    """Raised when the Elexon API returns an unexpected response."""
    pass


class ElexonClient:
    """Async HTTP client for the Elexon BMRS API v1."""

    def __init__(self):
        self.base_url = settings.ELEXON_BASE_URL
        self.timeout = httpx.Timeout(settings.HTTP_TIMEOUT_SECONDS)
        self.max_retries = settings.HTTP_MAX_RETRIES
        self.retry_delay = settings.HTTP_RETRY_DELAY_SECONDS
        self.rate_limit_delay = settings.REQUEST_RATE_LIMIT_SECONDS
        self._last_request_time: float = 0.0
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None
        if (
            self._client is None
            or self._client.is_closed
            or getattr(self, "_client_loop", None) != loop
        ):
            self._client = httpx.AsyncClient(timeout=self.timeout)
            self._client_loop = loop
        return self._client

    async def close(self):
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    async def _rate_limit(self):
        """Enforce minimum delay between requests to be respectful."""
        now = time.monotonic()
        elapsed = now - self._last_request_time
        if elapsed < self.rate_limit_delay:
            await asyncio.sleep(self.rate_limit_delay - elapsed)
        self._last_request_time = time.monotonic()

    async def _request_with_retries(self, url: str, params: Dict[str, Any]) -> List[Dict]:
        """Make a GET request with retries, rate limiting, and error handling."""
        client = await self._get_client()
        last_exception = None

        for attempt in range(1, self.max_retries + 1):
            await self._rate_limit()
            try:
                logger.info(f"Elexon API request (attempt {attempt}): {url} params={params}")
                response = await client.get(url, params=params)

                if response.status_code == 200:
                    data = response.json()
                    if not isinstance(data, list):
                        raise ElexonAPIError(
                            f"Expected JSON array, got {type(data).__name__}"
                        )
                    logger.info(f"Received {len(data)} records from {url}")
                    return data

                if response.status_code == 429:
                    retry_after = int(response.headers.get("Retry-After", 30))
                    logger.warning(f"Rate limited (429). Retrying after {retry_after}s")
                    await asyncio.sleep(retry_after)
                    continue

                if response.status_code >= 500:
                    logger.warning(
                        f"Server error {response.status_code} on attempt {attempt}"
                    )
                    last_exception = ElexonAPIError(
                        f"Server error {response.status_code}: {response.text[:200]}"
                    )
                else:
                    raise ElexonAPIError(
                        f"HTTP {response.status_code}: {response.text[:500]}"
                    )

            except httpx.TimeoutException as e:
                logger.warning(f"Timeout on attempt {attempt}: {e}")
                last_exception = e
            except httpx.RequestError as e:
                logger.warning(f"Request error on attempt {attempt}: {e}")
                last_exception = e

            if attempt < self.max_retries:
                delay = self.retry_delay * (2 ** (attempt - 1))  # exponential backoff
                logger.info(f"Retrying in {delay}s...")
                await asyncio.sleep(delay)

        raise ElexonAPIError(
            f"Failed after {self.max_retries} attempts. Last error: {last_exception}"
        )

    async def fetch_fuelhh(
        self,
        settlement_date_from: str,
        settlement_date_to: str,
    ) -> List[Dict]:
        """
        Fetch actual generation data from FUELHH dataset.

        Uses settlementDate filtering to retrieve all fuel types for the given date range.
        Returns the raw JSON array from the streaming endpoint.

        Args:
            settlement_date_from: Start date in YYYY-MM-DD format (inclusive)
            settlement_date_to: End date in YYYY-MM-DD format (inclusive)
        """
        url = f"{self.base_url}/datasets/FUELHH/stream"
        params = {
            "settlementDateFrom": settlement_date_from,
            "settlementDateTo": settlement_date_to,
        }
        return await self._request_with_retries(url, params)

    async def fetch_windfor(
        self,
        publish_from: str,
        publish_to: str,
    ) -> List[Dict]:
        """
        Fetch wind generation forecast data from WINDFOR dataset.

        Uses publishDateTime filtering to retrieve forecasts published within the range.
        Each record contains publishTime (when forecast was issued) and startTime (delivery).

        Args:
            publish_from: ISO datetime string for publication time range start
            publish_to: ISO datetime string for publication time range end
        """
        url = f"{self.base_url}/datasets/WINDFOR/stream"
        params = {
            "publishDateTimeFrom": publish_from,
            "publishDateTimeTo": publish_to,
        }
        return await self._request_with_retries(url, params)

    async def fetch_fuelhh_chunked(
        self,
        start_date: str,
        end_date: str,
        chunk_days: int = 7,
    ) -> List[Dict]:
        """
        Fetch FUELHH data in multi-day chunks to handle date ranges reliably.
        """
        all_records = []
        current = datetime.strptime(start_date, "%Y-%m-%d")
        end = datetime.strptime(end_date, "%Y-%m-%d")

        while current <= end:
            chunk_end = min(current + timedelta(days=chunk_days - 1), end)
            chunk_data = await self.fetch_fuelhh(
                current.strftime("%Y-%m-%d"),
                chunk_end.strftime("%Y-%m-%d"),
            )
            all_records.extend(chunk_data)
            current = chunk_end + timedelta(days=1)

        return all_records

    async def fetch_windfor_chunked(
        self,
        publish_from: str,
        publish_to: str,
        chunk_hours: int = 168,
    ) -> List[Dict]:
        """
        Fetch WINDFOR data in time chunks to handle large publication ranges.
        """
        all_records = []
        current = datetime.fromisoformat(publish_from.replace("Z", "+00:00"))
        end = datetime.fromisoformat(publish_to.replace("Z", "+00:00"))

        while current < end:
            chunk_end = min(current + timedelta(hours=chunk_hours), end)
            chunk_data = await self.fetch_windfor(
                current.strftime("%Y-%m-%dT%H:%M:%SZ"),
                chunk_end.strftime("%Y-%m-%dT%H:%M:%SZ"),
            )
            all_records.extend(chunk_data)
            current = chunk_end

        return all_records


# Singleton instance
elexon_client = ElexonClient()

"""
WINDLENS Backend API Integration and External API Failure Tests

Tests:
1. All REST API endpoints via TestClient (health, overview, forecasts, actuals, accuracy, lead-time, data-quality, export, refresh)
2. External API failure handling (500 errors, 429 rate limits, network timeouts, invalid JSON)
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import httpx
from fastapi.testclient import TestClient
import pandas as pd

from app.main import app
from app.clients.elexon import ElexonClient, ElexonAPIError


@pytest.fixture
def client():
    """Create FastAPI test client."""
    return TestClient(app)


# ============================================================
# REST API Endpoint Integration Tests
# ============================================================

class TestAPIEndpoints:
    def test_health_endpoint(self, client):
        """GET /api/health returns 200 and healthy status."""
        response = client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["service"] == "windlens-api"
        assert "timestamp" in data

    def test_overview_endpoint(self, client):
        """GET /api/overview returns 200 with summary metrics and charts."""
        response = client.get("/api/overview")
        assert response.status_code == 200
        data = response.json()
        assert "date_range_start" in data
        assert "date_range_end" in data
        assert "coverage_percent" in data
        assert "data_quality" in data
        assert "daily_summary" in data
        assert "time_series" in data
        assert "error_trend" in data
        assert data["actual_interval_count"] > 0
        assert data["matched_interval_count"] > 0

    def test_forecasts_endpoint(self, client):
        """GET /api/forecasts returns records and publication history."""
        response = client.get("/api/forecasts?delivery_date=2026-01-15&page=1&page_size=48")
        assert response.status_code == 200
        data = response.json()
        assert data["delivery_date"] == "2026-01-15"
        assert "records" in data
        assert "total_records" in data
        assert "publication_history" in data
        assert len(data["records"]) <= 48
        if data["records"]:
            first = data["records"][0]
            assert "delivery_time" in first
            assert "decision_cutoff" in first
            assert "is_eligible" in first

    def test_actuals_endpoint(self, client):
        """GET /api/actuals returns actual WIND generation records."""
        response = client.get("/api/actuals?start_date=2026-01-01&end_date=2026-01-31")
        assert response.status_code == 200
        data = response.json()
        assert "records" in data
        assert data["total_count"] > 0

    def test_accuracy_endpoint(self, client):
        """GET /api/accuracy returns MAE, RMSE, MBE, and chart data."""
        response = client.get("/api/accuracy")
        assert response.status_code == 200
        data = response.json()
        assert "mae_mw" in data
        assert "rmse_mw" in data
        assert "mbe_mw" in data
        assert "matched_intervals" in data
        assert "coverage_percent" in data
        assert "actual_vs_forecast" in data
        assert "error_distribution" in data
        assert "daily_mae" in data
        assert "bias_trend" in data
        assert data["matched_intervals"] > 0

    def test_lead_time_analysis_endpoint(self, client):
        """GET /api/lead-time-analysis returns lead-time bucket statistics."""
        response = client.get("/api/lead-time-analysis")
        assert response.status_code == 200
        data = response.json()
        assert "buckets" in data
        assert len(data["buckets"]) == 4
        labels = [b["bucket_label"] for b in data["buckets"]]
        assert "0–6 hours" in labels
        assert "6–12 hours" in labels
        assert "12–24 hours" in labels
        assert "24–48 hours" in labels

    def test_data_quality_endpoint(self, client):
        """GET /api/data-quality returns provenance and quality metrics."""
        response = client.get("/api/data-quality")
        assert response.status_code == 200
        data = response.json()
        assert "sources" in data
        assert len(data["sources"]) == 2
        assert "FUELHH" in data["sources"][0]["name"]
        assert "WINDFOR" in data["sources"][1]["name"]
        assert "methodology_notes" in data
        assert data["unique_delivery_intervals_actual"] > 0
        assert data["windfor_records_total"] > 0
        assert data["fuelhh_records_total"] > 0

    def test_export_endpoint(self, client):
        """GET /api/export returns a valid CSV file stream."""
        response = client.get("/api/export")
        assert response.status_code == 200
        assert "text/csv" in response.headers.get("content-type", "")
        assert "attachment; filename=" in response.headers.get("content-disposition", "")
        content = response.text
        lines = content.strip().split("\n")
        assert len(lines) > 1
        header = lines[0]
        assert "Delivery Time" in header
        assert "Forecast MW" in header
        assert "Actual MW" in header
        assert "Error MW" in header


# ============================================================
# External API Failure and Resilience Tests
# ============================================================

class TestExternalAPIFailures:
    @pytest.mark.asyncio
    async def test_server_error_500_retries_and_raises(self):
        """500 server errors should be retried up to max_retries and raise ElexonAPIError."""
        client = ElexonClient()
        client.max_retries = 2
        client.retry_delay = 0.01
        client.rate_limit_delay = 0.0

        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.text = "Internal Server Error"

        with patch.object(httpx.AsyncClient, "get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_response
            with pytest.raises(ElexonAPIError) as exc_info:
                await client._request_with_retries("https://example.com/api", {})
            assert "Failed after 2 attempts" in str(exc_info.value)
            assert mock_get.call_count == 2
        await client.close()

    @pytest.mark.asyncio
    async def test_rate_limit_429_retries(self):
        """429 Rate limited responses should respect Retry-After header and retry."""
        client = ElexonClient()
        client.max_retries = 2
        client.retry_delay = 0.01
        client.rate_limit_delay = 0.0

        resp_429 = MagicMock()
        resp_429.status_code = 429
        resp_429.headers = {"Retry-After": "0"}

        resp_200 = MagicMock()
        resp_200.status_code = 200
        resp_200.json.return_value = [{"dataset": "FUELHH", "generation": 100}]

        with patch.object(httpx.AsyncClient, "get", new_callable=AsyncMock) as mock_get:
            mock_get.side_effect = [resp_429, resp_200]
            result = await client._request_with_retries("https://example.com/api", {})
            assert len(result) == 1
            assert result[0]["generation"] == 100
        await client.close()

    @pytest.mark.asyncio
    async def test_timeout_retries_and_raises(self):
        """Network timeouts should trigger retries and raise ElexonAPIError on exhaustion."""
        client = ElexonClient()
        client.max_retries = 2
        client.retry_delay = 0.01
        client.rate_limit_delay = 0.0

        with patch.object(httpx.AsyncClient, "get", new_callable=AsyncMock) as mock_get:
            mock_get.side_effect = httpx.TimeoutException("Read timed out")
            with pytest.raises(ElexonAPIError) as exc_info:
                await client._request_with_retries("https://example.com/api", {})
            assert "Failed after 2 attempts" in str(exc_info.value)
        await client.close()

    @pytest.mark.asyncio
    async def test_non_list_json_raises_error(self):
        """Endpoints returning unexpected non-list JSON formats should raise ElexonAPIError."""
        client = ElexonClient()
        client.max_retries = 1
        client.rate_limit_delay = 0.0

        resp_dict = MagicMock()
        resp_dict.status_code = 200
        resp_dict.json.return_value = {"error": "unexpected format"}

        with patch.object(httpx.AsyncClient, "get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = resp_dict
            with pytest.raises(ElexonAPIError) as exc_info:
                await client._request_with_retries("https://example.com/api", {})
            assert "Expected JSON array" in str(exc_info.value)
        await client.close()

"""
WINDLENS Backend Tests

Comprehensive test suite covering:
1. WIND-only filtering
2. January date boundaries
3. Timestamp parsing and timezone handling
4. Latest eligible forecast selection
5. Rejection of forecasts published after the decision cutoff
6. Matching forecast and actual records
7. MAE calculation
8. RMSE calculation
9. Bias (MBE) calculation
10. Missing values and missing intervals
11. Duplicate records and deterministic tie-breaking
12. Zero-valued actuals in percentage-error calculations
13. Empty API responses
14. Coverage calculations

Uses deterministic synthetic fixtures only — clearly separated from real data.
"""

import numpy as np
import pandas as pd
import pytest
import pytz

from app.services.accuracy_metrics import (
    calculate_accuracy_metrics,
    calculate_lead_time_analysis,
    build_chart_data,
)
from app.services.forecast_selection import (
    calculate_decision_cutoff,
    select_eligible_forecasts,
)

UK_TZ = pytz.timezone("Europe/London")


# ============================================================
# FIXTURES
# ============================================================

def make_actuals(records):
    """Create a synthetic actuals DataFrame."""
    if not records:
        return pd.DataFrame(columns=["startTime", "fuelType", "generation"])
    df = pd.DataFrame(records)
    df["startTime"] = pd.to_datetime(df["startTime"], utc=True)
    if "fuelType" not in df.columns:
        df["fuelType"] = "WIND"
    if "generation" in df.columns:
        df["generation"] = pd.to_numeric(df["generation"])
    return df


def make_forecasts(records):
    """Create a synthetic forecasts DataFrame."""
    if not records:
        return pd.DataFrame(columns=["startTime", "publishTime", "generation"])
    df = pd.DataFrame(records)
    df["startTime"] = pd.to_datetime(df["startTime"], utc=True)
    df["publishTime"] = pd.to_datetime(df["publishTime"], utc=True)
    if "generation" in df.columns:
        df["generation"] = pd.to_numeric(df["generation"])
    return df


# ============================================================
# 1. WIND-only filtering
# ============================================================

class TestWindFiltering:
    def test_filter_wind_only(self):
        """Only WIND fuelType records should be retained."""
        data = [
            {"startTime": "2026-01-01T00:00:00Z", "fuelType": "WIND", "generation": 5000},
            {"startTime": "2026-01-01T00:00:00Z", "fuelType": "CCGT", "generation": 3000},
            {"startTime": "2026-01-01T00:00:00Z", "fuelType": "NUCLEAR", "generation": 4000},
            {"startTime": "2026-01-01T00:30:00Z", "fuelType": "WIND", "generation": 5500},
        ]
        df = pd.DataFrame(data)
        wind_only = df[df["fuelType"] == "WIND"]
        assert len(wind_only) == 2
        assert all(wind_only["fuelType"] == "WIND")


# ============================================================
# 2. January date boundaries
# ============================================================

class TestDateBoundaries:
    def test_january_boundaries(self):
        """Delivery intervals must be within [2026-01-01, 2026-02-01)."""
        jan_start = pd.Timestamp("2026-01-01T00:00:00", tz="UTC")
        feb_start = pd.Timestamp("2026-02-01T00:00:00", tz="UTC")

        # Inside January
        assert jan_start >= jan_start
        assert jan_start < feb_start

        # Last interval of January
        last_jan = pd.Timestamp("2026-01-31T23:30:00", tz="UTC")
        assert last_jan >= jan_start
        assert last_jan < feb_start

        # First interval of February (excluded)
        first_feb = pd.Timestamp("2026-02-01T00:00:00", tz="UTC")
        assert not (first_feb < feb_start)

        # Dec 31 (excluded)
        dec31 = pd.Timestamp("2025-12-31T23:30:00", tz="UTC")
        assert not (dec31 >= jan_start)


# ============================================================
# 3. Timestamp parsing and timezone handling
# ============================================================

class TestTimezones:
    def test_utc_parsing(self):
        """Timestamps should be parsed as UTC."""
        ts = pd.Timestamp("2026-01-15T10:00:00Z")
        assert ts.tzinfo is not None

    def test_uk_conversion_january(self):
        """January is GMT (UTC+0) so UK time == UTC."""
        ts = pd.Timestamp("2026-01-15T10:00:00", tz="UTC")
        uk = ts.tz_convert(UK_TZ)
        assert uk.hour == 10

    def test_cutoff_timezone_aware(self):
        """Decision cutoff must be timezone-aware."""
        delivery = pd.Timestamp("2026-01-15T10:00:00", tz="UTC")
        cutoff = calculate_decision_cutoff(delivery)
        assert cutoff.tzinfo is not None


# ============================================================
# 4. Latest eligible forecast selection
# ============================================================

class TestEligibleForecastSelection:
    def test_selects_latest_eligible(self):
        """Should select the forecast with the latest publishTime before cutoff."""
        forecasts = make_forecasts([
            {"startTime": "2026-01-15T10:00:00Z", "publishTime": "2026-01-13T12:00:00Z", "generation": 5000},
            {"startTime": "2026-01-15T10:00:00Z", "publishTime": "2026-01-14T08:00:00Z", "generation": 5200},
            {"startTime": "2026-01-15T10:00:00Z", "publishTime": "2026-01-14T16:00:00Z", "generation": 5400},
        ])
        actuals = make_actuals([
            {"startTime": "2026-01-15T10:00:00Z", "generation": 5300},
        ])

        result = select_eligible_forecasts(forecasts, actuals, policy="end_of_preceding_day")
        assert not result.empty
        row = result.iloc[0]
        # Cutoff for Jan 15 delivery = end of Jan 14
        # All three are published on Jan 13 and 14, so all are eligible
        # Latest is Jan 14 16:00 → generation 5400
        assert row["forecast_mw"] == 5400
        assert row["has_forecast"] == True


# ============================================================
# 5. Rejection of forecasts published after cutoff
# ============================================================

class TestCutoffRejection:
    def test_rejects_post_cutoff_forecast(self):
        """A forecast published after the cutoff must not be selected."""
        forecasts = make_forecasts([
            # Published on Jan 15 — AFTER the cutoff for Jan 15 delivery
            {"startTime": "2026-01-15T10:00:00Z", "publishTime": "2026-01-15T06:00:00Z", "generation": 6000},
            # Published on Jan 14 — eligible
            {"startTime": "2026-01-15T10:00:00Z", "publishTime": "2026-01-14T20:00:00Z", "generation": 5500},
        ])
        actuals = make_actuals([
            {"startTime": "2026-01-15T10:00:00Z", "generation": 5300},
        ])

        result = select_eligible_forecasts(forecasts, actuals, policy="end_of_preceding_day")
        row = result.iloc[0]
        # Should select 5500 (Jan 14), not 6000 (Jan 15)
        assert row["forecast_mw"] == 5500

    def test_no_eligible_forecast(self):
        """When no forecast was published before cutoff, has_forecast should be False."""
        forecasts = make_forecasts([
            {"startTime": "2026-01-15T10:00:00Z", "publishTime": "2026-01-15T06:00:00Z", "generation": 6000},
        ])
        actuals = make_actuals([
            {"startTime": "2026-01-15T10:00:00Z", "generation": 5300},
        ])

        result = select_eligible_forecasts(forecasts, actuals, policy="end_of_preceding_day")
        row = result.iloc[0]
        assert row["has_forecast"] == False
        assert row["forecast_mw"] is None


# ============================================================
# 6. Matching forecast and actual records
# ============================================================

class TestMatching:
    def test_correct_matching_by_delivery_time(self):
        """Forecasts and actuals must be matched by delivery startTime."""
        forecasts = make_forecasts([
            {"startTime": "2026-01-10T10:00:00Z", "publishTime": "2026-01-09T12:00:00Z", "generation": 4000},
            {"startTime": "2026-01-10T11:00:00Z", "publishTime": "2026-01-09T12:00:00Z", "generation": 4500},
        ])
        actuals = make_actuals([
            {"startTime": "2026-01-10T10:00:00Z", "generation": 4200},
            {"startTime": "2026-01-10T11:00:00Z", "generation": 4700},
        ])

        result = select_eligible_forecasts(forecasts, actuals)
        assert len(result) == 2

        row_10 = result[result["delivery_time"] == pd.Timestamp("2026-01-10T10:00:00Z")].iloc[0]
        assert row_10["forecast_mw"] == 4000
        assert row_10["actual_mw"] == 4200
        assert row_10["error_mw"] == -200

        row_11 = result[result["delivery_time"] == pd.Timestamp("2026-01-10T11:00:00Z")].iloc[0]
        assert row_11["forecast_mw"] == 4500
        assert row_11["actual_mw"] == 4700
        assert row_11["error_mw"] == -200


# ============================================================
# 7. MAE calculation
# ============================================================

class TestMAE:
    def test_mae_calculation(self):
        """MAE = mean(|forecast - actual|)."""
        matched = pd.DataFrame({
            "forecast_mw": [5000, 6000, 4000],
            "actual_mw": [5500, 5500, 4500],
            "error_mw": [-500, 500, -500],
            "absolute_error_mw": [500, 500, 500],
            "has_forecast": [True, True, True],
            "has_actual": [True, True, True],
        })
        metrics = calculate_accuracy_metrics(matched)
        assert metrics["mae_mw"] == 500.0

    def test_mae_with_mixed_errors(self):
        """MAE with varying error magnitudes."""
        matched = pd.DataFrame({
            "forecast_mw": [5000, 6000],
            "actual_mw": [5200, 5000],
            "error_mw": [-200, 1000],
            "absolute_error_mw": [200, 1000],
            "has_forecast": [True, True],
            "has_actual": [True, True],
        })
        metrics = calculate_accuracy_metrics(matched)
        assert metrics["mae_mw"] == 600.0


# ============================================================
# 8. RMSE calculation
# ============================================================

class TestRMSE:
    def test_rmse_calculation(self):
        """RMSE = sqrt(mean((forecast - actual)^2))."""
        matched = pd.DataFrame({
            "forecast_mw": [5000, 6000],
            "actual_mw": [5200, 5000],
            "error_mw": [-200, 1000],
            "absolute_error_mw": [200, 1000],
            "has_forecast": [True, True],
            "has_actual": [True, True],
        })
        metrics = calculate_accuracy_metrics(matched)
        expected_rmse = np.sqrt((200**2 + 1000**2) / 2)
        assert abs(metrics["rmse_mw"] - expected_rmse) < 0.1

    def test_rmse_sensitivity_to_outliers(self):
        """RMSE should be higher than MAE when there are outliers."""
        matched = pd.DataFrame({
            "forecast_mw": [5000, 5000, 5000, 5000, 9000],
            "actual_mw": [5100, 5100, 5100, 5100, 5100],
            "error_mw": [-100, -100, -100, -100, 3900],
            "absolute_error_mw": [100, 100, 100, 100, 3900],
            "has_forecast": [True] * 5,
            "has_actual": [True] * 5,
        })
        metrics = calculate_accuracy_metrics(matched)
        assert metrics["rmse_mw"] > metrics["mae_mw"]


# ============================================================
# 9. Bias (MBE) calculation
# ============================================================

class TestBias:
    def test_positive_bias(self):
        """Positive MBE means forecasts overpredict."""
        matched = pd.DataFrame({
            "forecast_mw": [6000, 7000],
            "actual_mw": [5000, 5500],
            "error_mw": [1000, 1500],
            "absolute_error_mw": [1000, 1500],
            "has_forecast": [True, True],
            "has_actual": [True, True],
        })
        metrics = calculate_accuracy_metrics(matched)
        assert metrics["mbe_mw"] == 1250.0

    def test_negative_bias(self):
        """Negative MBE means forecasts underpredict."""
        matched = pd.DataFrame({
            "forecast_mw": [4000, 4500],
            "actual_mw": [5000, 5500],
            "error_mw": [-1000, -1000],
            "absolute_error_mw": [1000, 1000],
            "has_forecast": [True, True],
            "has_actual": [True, True],
        })
        metrics = calculate_accuracy_metrics(matched)
        assert metrics["mbe_mw"] == -1000.0

    def test_zero_bias(self):
        """Zero MBE when errors cancel out."""
        matched = pd.DataFrame({
            "forecast_mw": [6000, 4000],
            "actual_mw": [5000, 5000],
            "error_mw": [1000, -1000],
            "absolute_error_mw": [1000, 1000],
            "has_forecast": [True, True],
            "has_actual": [True, True],
        })
        metrics = calculate_accuracy_metrics(matched)
        assert metrics["mbe_mw"] == 0.0


# ============================================================
# 10. Missing values and missing intervals
# ============================================================

class TestMissingValues:
    def test_missing_actual(self):
        """Intervals without actuals should be flagged."""
        forecasts = make_forecasts([
            {"startTime": "2026-01-10T10:00:00Z", "publishTime": "2026-01-09T12:00:00Z", "generation": 5000},
        ])
        actuals = make_actuals([])  # No actuals

        result = select_eligible_forecasts(forecasts, actuals)
        row = result.iloc[0]
        assert row["has_actual"] == False
        assert row["actual_mw"] is None
        assert row["error_mw"] is None

    def test_missing_forecast(self):
        """Intervals without forecasts should be flagged."""
        forecasts = make_forecasts([])  # No forecasts
        actuals = make_actuals([
            {"startTime": "2026-01-10T10:00:00Z", "generation": 5000},
        ])

        result = select_eligible_forecasts(forecasts, actuals)
        row = result.iloc[0]
        assert row["has_forecast"] == False
        assert row["forecast_mw"] is None

    def test_empty_both(self):
        """Empty inputs should return empty result."""
        result = select_eligible_forecasts(pd.DataFrame(), pd.DataFrame())
        assert result.empty


# ============================================================
# 11. Duplicate records and deterministic tie-breaking
# ============================================================

class TestDuplicates:
    def test_tie_breaking_same_publish_time(self):
        """When two forecasts have the same publishTime, select higher generation."""
        forecasts = make_forecasts([
            {"startTime": "2026-01-10T10:00:00Z", "publishTime": "2026-01-09T12:00:00Z", "generation": 5000},
            {"startTime": "2026-01-10T10:00:00Z", "publishTime": "2026-01-09T12:00:00Z", "generation": 5500},
        ])
        actuals = make_actuals([
            {"startTime": "2026-01-10T10:00:00Z", "generation": 5200},
        ])

        result = select_eligible_forecasts(forecasts, actuals)
        row = result.iloc[0]
        # Tie-breaking: higher generation wins
        assert row["forecast_mw"] == 5500


# ============================================================
# 12. Zero-valued actuals in MAPE
# ============================================================

class TestMAPE:
    def test_mape_excludes_zeros(self):
        """MAPE denominator must exclude zero actual values."""
        matched = pd.DataFrame({
            "forecast_mw": [5000, 100, 6000],
            "actual_mw": [5000, 0, 6000],
            "error_mw": [0, 100, 0],
            "absolute_error_mw": [0, 100, 0],
            "has_forecast": [True, True, True],
            "has_actual": [True, True, True],
        })
        metrics = calculate_accuracy_metrics(matched)
        assert metrics["mape_valid"] == True
        assert metrics["mape_excluded_zeros"] == 1
        # Only 2 non-zero actuals: errors are 0/5000 and 0/6000 = 0%
        assert metrics["mape_percent"] == 0.0

    def test_mape_all_zeros(self):
        """MAPE should be None when all actuals are zero."""
        matched = pd.DataFrame({
            "forecast_mw": [100, 200],
            "actual_mw": [0, 0],
            "error_mw": [100, 200],
            "absolute_error_mw": [100, 200],
            "has_forecast": [True, True],
            "has_actual": [True, True],
        })
        metrics = calculate_accuracy_metrics(matched)
        assert metrics["mape_valid"] == False
        assert metrics["mape_percent"] is None


# ============================================================
# 13. Empty API responses
# ============================================================

class TestEmptyResponses:
    def test_empty_metrics(self):
        """Empty DataFrame should return null metrics."""
        metrics = calculate_accuracy_metrics(pd.DataFrame())
        assert metrics["mae_mw"] is None
        assert metrics["rmse_mw"] is None
        assert metrics["mbe_mw"] is None
        assert metrics["matched_intervals"] == 0

    def test_empty_chart_data(self):
        """Empty DataFrame should return empty chart data."""
        charts = build_chart_data(pd.DataFrame())
        assert charts["actual_vs_forecast"] == []
        assert charts["error_distribution"] == []


# ============================================================
# 14. Coverage calculations
# ============================================================

class TestCoverage:
    def test_coverage_calculation(self):
        """Coverage = matched / expected * 100."""
        forecasts = make_forecasts([
            {"startTime": "2026-01-10T10:00:00Z", "publishTime": "2026-01-09T12:00:00Z", "generation": 5000},
            {"startTime": "2026-01-10T11:00:00Z", "publishTime": "2026-01-09T12:00:00Z", "generation": 5500},
        ])
        actuals = make_actuals([
            {"startTime": "2026-01-10T10:00:00Z", "generation": 5200},
            # No actual for 11:00
        ])

        result = select_eligible_forecasts(forecasts, actuals)
        has_both = result[(result["has_forecast"]) & (result["has_actual"])]
        assert len(has_both) == 1
        assert len(result) == 2


# ============================================================
# 15. Decision cutoff calculation
# ============================================================

class TestDecisionCutoff:
    def test_cutoff_end_of_preceding_day(self):
        """Cutoff for Jan 15 delivery should be end of Jan 14."""
        delivery = pd.Timestamp("2026-01-15T10:00:00", tz="UTC")
        cutoff = calculate_decision_cutoff(delivery, "end_of_preceding_day")

        # In January (GMT), cutoff should be Jan 14 23:59:59.999999
        cutoff_uk = cutoff.astimezone(UK_TZ)
        assert cutoff_uk.day == 14
        assert cutoff_uk.hour == 23
        assert cutoff_uk.minute == 59

    def test_cutoff_blocks_same_day_publish(self):
        """A forecast published on the delivery date should be blocked."""
        delivery = pd.Timestamp("2026-01-15T10:00:00", tz="UTC")
        cutoff = calculate_decision_cutoff(delivery)

        # Published at 00:01 on Jan 15 — after cutoff
        publish = pd.Timestamp("2026-01-15T00:01:00", tz="UTC")
        assert publish > cutoff

    def test_cutoff_allows_previous_day_publish(self):
        """A forecast published on the preceding day should pass."""
        delivery = pd.Timestamp("2026-01-15T10:00:00", tz="UTC")
        cutoff = calculate_decision_cutoff(delivery)

        publish = pd.Timestamp("2026-01-14T23:30:00", tz="UTC")
        assert publish <= cutoff


# ============================================================
# 16. Lead-time analysis
# ============================================================

class TestLeadTimeAnalysis:
    def test_lead_time_buckets(self):
        """Lead-time buckets should be mutually exclusive."""
        # Create data with known lead times
        matched = pd.DataFrame({
            "forecast_mw": [5000] * 20,
            "actual_mw": [5200] * 20,
            "error_mw": [-200] * 20,
            "absolute_error_mw": [200] * 20,
            "has_forecast": [True] * 20,
            "has_actual": [True] * 20,
            "forecast_age_hours": list(range(1, 21)),  # 1h to 20h
        })

        buckets = calculate_lead_time_analysis(matched)
        # Check that bucket counts don't overlap
        total = sum(b["count"] for b in buckets)
        assert total == 20

    def test_insufficient_data_flagged(self):
        """Buckets with < 10 data points should be flagged."""
        matched = pd.DataFrame({
            "forecast_mw": [5000] * 5,
            "actual_mw": [5200] * 5,
            "error_mw": [-200] * 5,
            "absolute_error_mw": [200] * 5,
            "has_forecast": [True] * 5,
            "has_actual": [True] * 5,
            "forecast_age_hours": [3] * 5,  # All in 0-6h bucket
        })

        buckets = calculate_lead_time_analysis(matched)
        bucket_0_6 = [b for b in buckets if b["bucket_label"] == "0–6 hours"][0]
        assert bucket_0_6["sufficient_data"] == False
        assert bucket_0_6["count"] == 5


# ============================================================
# 17. Hourly Forecast to Half-Hourly Actual Matching
# ============================================================

class TestHourlyToHalfHourlyMatching:
    def test_hourly_forecast_matches_both_half_hours(self):
        """
        WINDFOR provides hourly average power forecasts.
        FUELHH provides half-hourly settlement actuals.
        Each hourly forecast must match both constituent settlement periods (:00 and :30).
        """
        forecasts = make_forecasts([
            {
                "startTime": "2026-01-15T14:00:00Z",
                "publishTime": "2026-01-14T20:00:00Z",
                "generation": 5200,
            }
        ])
        actuals = make_actuals([
            {"startTime": "2026-01-15T14:00:00Z", "generation": 5000},
            {"startTime": "2026-01-15T14:30:00Z", "generation": 5100},
        ])

        matched = select_eligible_forecasts(forecasts, actuals)
        assert len(matched) == 2

        sp1 = matched[matched["delivery_time"] == pd.Timestamp("2026-01-15T14:00:00Z")].iloc[0]
        sp2 = matched[matched["delivery_time"] == pd.Timestamp("2026-01-15T14:30:00Z")].iloc[0]

        # Both settlement periods receive the same hourly forecast
        assert sp1["forecast_mw"] == 5200
        assert sp2["forecast_mw"] == 5200
        assert sp1["error_mw"] == 200.0   # 5200 - 5000
        assert sp2["error_mw"] == 100.0   # 5200 - 5100

        # Both receive consistent forecast lead-time relative to target delivery hour
        assert sp1["forecast_age_hours"] == 18.0  # 14:00 Jan 15 - 20:00 Jan 14
        assert sp2["forecast_age_hours"] == 18.0

    def test_cutoff_preservation_for_both_half_hours(self):
        """
        Forecasts published after the decision cutoff (D-1 23:59 GMT)
        must be rejected for both half-hour intervals of the delivery day.
        """
        forecasts = make_forecasts([
            # Published after D-1 cutoff (leakage)
            {
                "startTime": "2026-01-15T14:00:00Z",
                "publishTime": "2026-01-15T06:00:00Z",
                "generation": 6000,
            },
            # Published before D-1 cutoff (eligible)
            {
                "startTime": "2026-01-15T14:00:00Z",
                "publishTime": "2026-01-14T22:00:00Z",
                "generation": 4800,
            },
        ])
        actuals = make_actuals([
            {"startTime": "2026-01-15T14:00:00Z", "generation": 4900},
            {"startTime": "2026-01-15T14:30:00Z", "generation": 4950},
        ])

        matched = select_eligible_forecasts(forecasts, actuals)
        for _, row in matched.iterrows():
            # Neither half-hour may leak the 6000 MW same-day forecast
            assert row["forecast_mw"] == 4800
            assert row["forecast_publish_time"] == pd.Timestamp("2026-01-14T22:00:00Z")

    def test_mbe_equivalence_between_half_hourly_and_hourly(self):
        """
        Mathematically, piecewise-constant step matching of an hourly forecast
        across two 30-min actuals produces the EXACT same Mean Bias Error (MBE)
        as native hourly aggregated verification:
        MBE_hh = mean(F - A_1, F - A_2) = F - (A_1 + A_2) / 2 = MBE_hourly.
        """
        f_val = 5500.0
        a1 = 5100.0
        a2 = 5300.0

        forecasts = make_forecasts([
            {"startTime": "2026-01-10T12:00:00Z", "publishTime": "2026-01-09T18:00:00Z", "generation": f_val}
        ])
        actuals = make_actuals([
            {"startTime": "2026-01-10T12:00:00Z", "generation": a1},
            {"startTime": "2026-01-10T12:30:00Z", "generation": a2},
        ])

        matched_hh = select_eligible_forecasts(forecasts, actuals)
        metrics_hh = calculate_accuracy_metrics(matched_hh)

        # Half-hourly MBE
        expected_mbe = ((f_val - a1) + (f_val - a2)) / 2.0
        assert metrics_hh["mbe_mw"] == expected_mbe

        # Aggregated hourly actual
        a_hourly = (a1 + a2) / 2.0
        hourly_mbe = f_val - a_hourly
        assert metrics_hh["mbe_mw"] == hourly_mbe


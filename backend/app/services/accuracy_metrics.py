"""
WINDLENS Accuracy Metrics Service

Calculates forecast accuracy metrics from matched forecast/actual pairs.
All calculations use the Python backend as the authoritative source.

Metrics:
- MAE (Mean Absolute Error): mean(|forecast - actual|)
- RMSE (Root Mean Squared Error): sqrt(mean((forecast - actual)^2))
- MBE (Mean Bias Error): mean(forecast - actual)
  Positive = forecasts overpredict, Negative = forecasts underpredict
- MAPE (Mean Absolute Percentage Error): mean(|forecast - actual| / actual) * 100
  Only valid when actual values support the calculation (excludes zeros).

Lead-time bucket analysis compares accuracy across forecast publication
lead times: 0-6h, 6-12h, 12-24h, 24-48h before delivery.
"""

import logging
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

logger = logging.getLogger("windlens.accuracy_metrics")

# Lead-time buckets (hours before delivery)
LEAD_TIME_BUCKETS = [
    {"label": "0–6 hours", "min_hours": 0, "max_hours": 6},
    {"label": "6–12 hours", "min_hours": 6, "max_hours": 12},
    {"label": "12–24 hours", "min_hours": 12, "max_hours": 24},
    {"label": "24–48 hours", "min_hours": 24, "max_hours": 48},
]

# Minimum number of data points for a bucket to be considered reliable
MIN_BUCKET_SIZE = 10


def calculate_accuracy_metrics(matched_df: pd.DataFrame) -> Dict[str, Any]:
    """
    Calculate accuracy metrics from a DataFrame of matched forecast/actual pairs.

    Args:
        matched_df: DataFrame with columns including:
            - forecast_mw, actual_mw, error_mw, absolute_error_mw
            - has_forecast, has_actual

    Returns:
        Dictionary of computed metrics with coverage metadata.
    """
    if matched_df.empty:
        return _empty_metrics()

    # Filter to records with both forecast and actual
    valid = matched_df[(matched_df["has_forecast"]) & (matched_df["has_actual"])].copy()

    if valid.empty:
        return _empty_metrics(total=len(matched_df))

    errors = valid["error_mw"].values
    abs_errors = valid["absolute_error_mw"].values
    forecasts = valid["forecast_mw"].values
    actuals = valid["actual_mw"].values

    mae = float(np.mean(abs_errors))
    rmse = float(np.sqrt(np.mean(errors ** 2)))
    mbe = float(np.mean(errors))

    # MAPE: exclude zero actuals
    nonzero_mask = actuals != 0
    nonzero_count = int(np.sum(nonzero_mask))
    zero_count = int(np.sum(~nonzero_mask))

    mape = None
    mape_valid = False
    if nonzero_count > 0:
        mape = float(np.mean(np.abs(errors[nonzero_mask]) / np.abs(actuals[nonzero_mask])) * 100)
        mape_valid = True

    return {
        "mae_mw": round(mae, 2),
        "rmse_mw": round(rmse, 2),
        "mbe_mw": round(mbe, 2),
        "mape_percent": round(mape, 2) if mape is not None else None,
        "mape_valid": mape_valid,
        "mape_excluded_zeros": zero_count,
        "matched_intervals": len(valid),
        "total_records": len(matched_df),
    }


def calculate_lead_time_analysis(matched_df: pd.DataFrame) -> List[Dict[str, Any]]:
    """
    Compare forecast accuracy across lead-time buckets.

    Lead time = hours between forecast publication and delivery start.
    Buckets are mutually exclusive: [min_hours, max_hours).
    """
    if matched_df.empty:
        return [_empty_bucket(b) for b in LEAD_TIME_BUCKETS]

    valid = matched_df[
        (matched_df["has_forecast"]) &
        (matched_df["has_actual"]) &
        (matched_df["forecast_age_hours"].notna())
    ].copy()

    results = []
    for bucket in LEAD_TIME_BUCKETS:
        mask = (
            (valid["forecast_age_hours"] >= bucket["min_hours"]) &
            (valid["forecast_age_hours"] < bucket["max_hours"])
        )
        bucket_data = valid[mask]

        if len(bucket_data) < MIN_BUCKET_SIZE:
            results.append({
                "bucket_label": bucket["label"],
                "min_hours": bucket["min_hours"],
                "max_hours": bucket["max_hours"],
                "count": len(bucket_data),
                "mae_mw": None,
                "rmse_mw": None,
                "mbe_mw": None,
                "sufficient_data": False,
            })
        else:
            errors = bucket_data["error_mw"].values
            abs_errors = bucket_data["absolute_error_mw"].values
            results.append({
                "bucket_label": bucket["label"],
                "min_hours": bucket["min_hours"],
                "max_hours": bucket["max_hours"],
                "count": len(bucket_data),
                "mae_mw": round(float(np.mean(abs_errors)), 2),
                "rmse_mw": round(float(np.sqrt(np.mean(errors ** 2))), 2),
                "mbe_mw": round(float(np.mean(errors)), 2),
                "sufficient_data": True,
            })

    return results


def build_chart_data(matched_df: pd.DataFrame) -> Dict[str, List[Dict]]:
    """
    Prepare chart-ready data structures for the frontend.

    Returns:
        Dictionary with keys:
        - actual_vs_forecast: time series of matched pairs
        - error_distribution: histogram data
        - daily_mae: daily MAE trend
        - bias_trend: daily bias trend
    """
    if matched_df.empty:
        return {
            "actual_vs_forecast": [],
            "error_distribution": [],
            "daily_mae": [],
            "bias_trend": [],
        }

    valid = matched_df[
        (matched_df["has_forecast"]) & (matched_df["has_actual"])
    ].copy()

    # Actual vs Forecast time series
    avf = []
    for _, row in matched_df.iterrows():
        avf.append({
            "time": row["delivery_time_uk"],
            "actual": row["actual_mw"] if row["has_actual"] else None,
            "forecast": row["forecast_mw"] if row["has_forecast"] else None,
        })

    # Error distribution (histogram bins)
    error_dist = []
    if not valid.empty:
        errors = valid["error_mw"].values
        bin_edges = np.linspace(errors.min(), errors.max(), 25)
        counts, edges = np.histogram(errors, bins=bin_edges)
        for i in range(len(counts)):
            error_dist.append({
                "bin_start": round(float(edges[i]), 1),
                "bin_end": round(float(edges[i + 1]), 1),
                "count": int(counts[i]),
                "label": f"{round(float(edges[i]), 0)}",
            })

    # Daily MAE
    daily_mae = []
    if not valid.empty:
        valid_copy = valid.copy()
        valid_copy["date"] = pd.to_datetime(valid_copy["delivery_time_uk"]).dt.date
        for date, group in valid_copy.groupby("date"):
            daily_mae.append({
                "date": str(date),
                "mae": round(float(group["absolute_error_mw"].mean()), 2),
                "count": len(group),
            })

    # Daily bias trend
    bias_trend = []
    if not valid.empty:
        valid_copy = valid.copy()
        valid_copy["date"] = pd.to_datetime(valid_copy["delivery_time_uk"]).dt.date
        for date, group in valid_copy.groupby("date"):
            bias_trend.append({
                "date": str(date),
                "bias": round(float(group["error_mw"].mean()), 2),
                "count": len(group),
            })

    return {
        "actual_vs_forecast": avf,
        "error_distribution": error_dist,
        "daily_mae": daily_mae,
        "bias_trend": bias_trend,
    }


def build_daily_summary(matched_df: pd.DataFrame) -> List[Dict]:
    """Build daily aggregated summary for the overview dashboard."""
    if matched_df.empty:
        return []

    df = matched_df.copy()
    df["date"] = pd.to_datetime(df["delivery_time_uk"]).dt.date

    summary = []
    for date, group in df.groupby("date"):
        actual_vals = group[group["has_actual"]]["actual_mw"]
        forecast_vals = group[group["has_forecast"]]["forecast_mw"]
        matched = group[(group["has_actual"]) & (group["has_forecast"])]

        entry = {
            "date": str(date),
            "avg_actual": round(float(actual_vals.mean()), 1) if not actual_vals.empty else None,
            "avg_forecast": round(float(forecast_vals.mean()), 1) if not forecast_vals.empty else None,
            "max_actual": round(float(actual_vals.max()), 1) if not actual_vals.empty else None,
            "min_actual": round(float(actual_vals.min()), 1) if not actual_vals.empty else None,
            "intervals": len(group),
            "matched": len(matched),
        }
        if not matched.empty:
            entry["mae"] = round(float(matched["absolute_error_mw"].mean()), 2)
        else:
            entry["mae"] = None
        summary.append(entry)

    return summary


def build_error_trend(matched_df: pd.DataFrame) -> List[Dict]:
    """Build error trend for the overview chart."""
    if matched_df.empty:
        return []

    valid = matched_df[
        (matched_df["has_forecast"]) & (matched_df["has_actual"])
    ].copy()

    if valid.empty:
        return []

    trend = []
    for _, row in valid.iterrows():
        trend.append({
            "time": row["delivery_time_uk"],
            "error": round(float(row["error_mw"]), 1),
            "absolute_error": round(float(row["absolute_error_mw"]), 1),
        })

    return trend


def _empty_metrics(total: int = 0) -> Dict[str, Any]:
    return {
        "mae_mw": None,
        "rmse_mw": None,
        "mbe_mw": None,
        "mape_percent": None,
        "mape_valid": False,
        "mape_excluded_zeros": 0,
        "matched_intervals": 0,
        "total_records": total,
    }


def _empty_bucket(bucket: Dict) -> Dict[str, Any]:
    return {
        "bucket_label": bucket["label"],
        "min_hours": bucket["min_hours"],
        "max_hours": bucket["max_hours"],
        "count": 0,
        "mae_mw": None,
        "rmse_mw": None,
        "mbe_mw": None,
        "sufficient_data": False,
    }

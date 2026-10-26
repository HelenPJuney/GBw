"""
WINDLENS Forecast Selection Service

Implements the critical business logic for selecting the most recent forecast
that was actually available by the decision cutoff for each delivery interval.

Key concepts:
- Decision cutoff: the latest time at which a forecast could have been used
  for a purchasing decision. Default policy: end of the preceding calendar day
  in UK local time.
- Eligible forecast: a forecast whose publishTime is <= the decision cutoff
  for the corresponding delivery interval.
- Selected forecast: the eligible forecast with the latest publishTime.

Tie-breaking rule: if multiple forecasts share the same latest publishTime
for a delivery interval, select the one with the highest generation value
(deterministic, documented).

IMPORTANT: This prevents future information leakage. A forecast published
after the cutoff must never influence the decision-time baseline.
"""

import logging
from datetime import datetime, time, timedelta, timezone
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
import pytz

from app.config import settings

logger = logging.getLogger("windlens.forecast_selection")

UK_TZ = pytz.timezone("Europe/London")


def calculate_decision_cutoff(delivery_time: pd.Timestamp, policy: str = None) -> pd.Timestamp:
    """
    Calculate the decision cutoff for a given delivery interval.

    Args:
        delivery_time: The delivery interval start time (UTC-aware).
        policy: The cutoff policy. Default is 'end_of_preceding_day'.

    Returns:
        Timezone-aware cutoff timestamp.

    Policy: 'end_of_preceding_day'
        The cutoff is 23:59:59.999999 of the UK calendar day before
        the delivery date. For a delivery on 2026-01-15 at any time,
        the cutoff is 2026-01-14 23:59:59.999999 Europe/London.
        Since January is GMT (UTC+0), this equals 2026-01-14T23:59:59.999999Z.
    """
    if policy is None:
        policy = settings.DECISION_CUTOFF_POLICY

    if policy == "end_of_preceding_day":
        # Convert delivery time to UK local
        delivery_uk = delivery_time.astimezone(UK_TZ)
        # Get the date of delivery
        delivery_date = delivery_uk.date()
        # Cutoff is end of the preceding day in UK time
        preceding_day = delivery_date - timedelta(days=1)
        cutoff_uk = UK_TZ.localize(
            datetime.combine(preceding_day, time(23, 59, 59, 999999))
        )
        # Convert back to UTC for consistent comparison
        return cutoff_uk.astimezone(pytz.UTC)
    else:
        raise ValueError(f"Unknown cutoff policy: {policy}")


def select_eligible_forecasts(
    forecasts_df: pd.DataFrame,
    actuals_df: pd.DataFrame,
    policy: str = None,
) -> pd.DataFrame:
    """
    For each delivery interval, select the most recent forecast that was
    available by the decision cutoff and match it with actual generation.

    Args:
        forecasts_df: DataFrame with columns [startTime, publishTime, generation]
        actuals_df: DataFrame with columns [startTime, generation]
        policy: Decision cutoff policy name.

    Returns:
        DataFrame with columns:
        - delivery_time: UTC timestamp of delivery interval
        - delivery_time_uk: UK local time string
        - decision_cutoff: UTC cutoff timestamp
        - forecast_publish_time: publishTime of selected forecast (or None)
        - forecast_mw: selected forecast generation (or None)
        - actual_mw: actual generation (or None)
        - error_mw: forecast - actual (or None)
        - absolute_error_mw: |forecast - actual| (or None)
        - forecast_age_hours: hours between publish and delivery
        - is_eligible: whether a forecast was found
        - has_actual: whether actual generation exists
        - has_forecast: whether a forecast was selected
    """
    if policy is None:
        policy = settings.DECISION_CUTOFF_POLICY

    if forecasts_df.empty and actuals_df.empty:
        return pd.DataFrame()

    # Collect all unique delivery intervals from both sources
    all_delivery_times = set()
    if not actuals_df.empty:
        all_delivery_times.update(actuals_df["startTime"].unique())
    if not forecasts_df.empty:
        all_delivery_times.update(forecasts_df["startTime"].unique())

    # Filter to January 2026 only
    jan_start = pd.Timestamp("2026-01-01T00:00:00", tz="UTC")
    feb_start = pd.Timestamp("2026-02-01T00:00:00", tz="UTC")
    all_delivery_times = sorted([
        t for t in all_delivery_times
        if jan_start <= t < feb_start
    ])

    # Pre-group for O(1) instant lookups across intervals
    actuals_by_time = {}
    if not actuals_df.empty:
        for t, group in actuals_df.groupby("startTime"):
            actuals_by_time[t] = group

    forecasts_by_time = {}
    if not forecasts_df.empty:
        for t, group in forecasts_df.groupby("startTime"):
            forecasts_by_time[t] = group

    results = []

    for delivery_time in all_delivery_times:
        cutoff = calculate_decision_cutoff(delivery_time, policy)

        # Find eligible forecasts: published <= cutoff AND for this delivery interval
        # WINDFOR is published hourly; FUELHH is half-hourly.
        # Match exact half-hour if present, otherwise match the containing hour.
        target_hour = delivery_time.floor("h") if hasattr(delivery_time, "floor") else pd.Timestamp(delivery_time).floor("h")
        
        candidates = forecasts_by_time.get(delivery_time)
        if candidates is None or candidates.empty:
            candidates = forecasts_by_time.get(target_hour)

        eligible = pd.DataFrame()
        if candidates is not None and not candidates.empty:
            eligible = candidates[candidates["publishTime"] <= cutoff]

        # Select the most recent eligible forecast
        forecast_publish_time = None
        forecast_mw = None
        has_forecast = False

        if not eligible.empty:
            # Sort by publishTime descending, then generation descending (tie-breaking)
            eligible_sorted = eligible.sort_values(
                ["publishTime", "generation"], ascending=[False, False]
            )
            selected = eligible_sorted.iloc[0]
            forecast_publish_time = selected["publishTime"]
            forecast_mw = float(selected["generation"])
            has_forecast = True

        # Find actual generation
        actual_mw = None
        has_actual = False
        actual_rows = actuals_by_time.get(delivery_time)
        if actual_rows is not None and not actual_rows.empty:
            actual_mw = float(actual_rows.iloc[0]["generation"])
            has_actual = True

        # Calculate errors
        error_mw = None
        absolute_error_mw = None
        if has_forecast and has_actual:
            error_mw = forecast_mw - actual_mw
            absolute_error_mw = abs(error_mw)

        # Forecast age (hours before delivery)
        # Lead time is measured from forecast publication to delivery start.
        # When an hourly forecast is matched to constituent half-hours,
        # the lead time is measured relative to the start of the target hour.
        forecast_age_hours = None
        if forecast_publish_time is not None:
            ref_delivery = delivery_time if delivery_time in forecasts_by_time else target_hour
            delta = ref_delivery - forecast_publish_time
            forecast_age_hours = max(0.0, delta.total_seconds() / 3600.0)

        # UK local time display
        delivery_uk = delivery_time.astimezone(UK_TZ)

        results.append({
            "delivery_time": delivery_time,
            "delivery_time_uk": delivery_uk.strftime("%Y-%m-%d %H:%M"),
            "decision_cutoff": cutoff,
            "decision_cutoff_uk": cutoff.astimezone(UK_TZ).strftime("%Y-%m-%d %H:%M"),
            "forecast_publish_time": forecast_publish_time,
            "forecast_mw": forecast_mw,
            "actual_mw": actual_mw,
            "error_mw": error_mw,
            "absolute_error_mw": absolute_error_mw,
            "forecast_age_hours": forecast_age_hours,
            "is_eligible": has_forecast,
            "has_actual": has_actual,
            "has_forecast": has_forecast,
        })

    return pd.DataFrame(results)


def get_publication_history(
    forecasts_df: pd.DataFrame,
    delivery_date: str,
) -> List[Dict]:
    """
    Get the chronological publication history for all forecasts
    targeting delivery intervals on a specific date.

    Returns a list of dicts sorted by publishTime then startTime.
    """
    if forecasts_df.empty:
        return []

    # Filter to delivery intervals on the specified date
    date_start = pd.Timestamp(f"{delivery_date}T00:00:00", tz="UTC")
    date_end = date_start + pd.Timedelta(days=1)

    mask = (forecasts_df["startTime"] >= date_start) & (forecasts_df["startTime"] < date_end)
    day_forecasts = forecasts_df[mask].copy()

    if day_forecasts.empty:
        return []

    day_forecasts = day_forecasts.sort_values(["publishTime", "startTime"])

    history = []
    for _, row in day_forecasts.iterrows():
        publish_uk = row["publishTime"].astimezone(UK_TZ)
        delivery_uk = row["startTime"].astimezone(UK_TZ)
        history.append({
            "publish_time": row["publishTime"].isoformat(),
            "publish_time_uk": publish_uk.strftime("%Y-%m-%d %H:%M"),
            "delivery_time": row["startTime"].isoformat(),
            "delivery_time_uk": delivery_uk.strftime("%Y-%m-%d %H:%M"),
            "generation_mw": float(row["generation"]),
        })

    return history

"""
WINDLENS API Route Handlers

Implements the REST API endpoints that the React frontend consumes.
All data processing and metric calculations are performed server-side.
"""

import csv
import io
import logging
from datetime import datetime, timezone
from typing import Optional

import pandas as pd
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.config import settings
from app.schemas.responses import (
    AccuracyMetrics,
    ActualRecord,
    ActualsResponse,
    DataQualityInfo,
    DataQualityResponse,
    ForecastExplorerResponse,
    ForecastRecord,
    HealthResponse,
    LeadTimeAnalysisResponse,
    LeadTimeBucket,
    OverviewResponse,
)
from app.services.accuracy_metrics import (
    build_chart_data,
    build_daily_summary,
    build_error_trend,
    calculate_accuracy_metrics,
    calculate_lead_time_analysis,
)
from app.services.data_service import data_service
from app.services.forecast_selection import (
    get_publication_history,
    select_eligible_forecasts,
)

logger = logging.getLogger("windlens.api")

router = APIRouter(prefix="/api")


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        timestamp=datetime.now(timezone.utc).isoformat()
    )


@router.get("/overview")
async def get_overview(
    start_date: str = Query(default="2026-01-01"),
    end_date: str = Query(default="2026-01-31"),
):
    """
    Dashboard overview with summary statistics and chart data.
    Returns key metrics for the analysis period.
    """
    matched = await data_service.get_matched()
    actuals = await data_service.get_actuals()
    forecasts = await data_service.get_forecasts()
    meta = data_service.get_fetch_metadata()

    if matched.empty:
        dq = DataQualityInfo(
            total_expected_intervals=1488,
            actual_records_count=len(actuals),
            forecast_records_count=len(forecasts),
            matched_intervals=0,
            missing_actual_count=1488,
            missing_forecast_count=1488,
            coverage_percent=0.0,
            date_range_start=start_date,
            date_range_end=end_date,
            decision_cutoff_policy=settings.DECISION_CUTOFF_POLICY,
            last_fetch_timestamp=meta.get("last_fetch"),
            api_errors=meta.get("errors", []),
            warnings=meta.get("warnings", []),
        )
        return OverviewResponse(
            date_range_start=start_date,
            date_range_end=end_date,
            actual_interval_count=len(actuals),
            forecast_record_count=len(forecasts),
            matched_interval_count=0,
            coverage_percent=0.0,
            data_quality=dq,
        )

    # Calculate metrics
    metrics = calculate_accuracy_metrics(matched)
    daily = build_daily_summary(matched)
    error_trend = build_error_trend(matched)

    # Time series for charts (sampled for performance)
    chart_data = build_chart_data(matched)

    # Coverage
    has_both = matched[(matched["has_forecast"]) & (matched["has_actual"])]
    missing_actual = matched[~matched["has_actual"]]
    missing_forecast = matched[~matched["has_forecast"]]

    # Latest forecast publication
    latest_pub = None
    if not forecasts.empty:
        latest_pub = forecasts["publishTime"].max().isoformat()

    # Average values
    avg_actual = None
    avg_forecast = None
    if has_both is not None and not has_both.empty:
        avg_actual = round(float(has_both["actual_mw"].mean()), 1)
        avg_forecast = round(float(has_both["forecast_mw"].mean()), 1)

    total_expected = 1488  # January 2026 = 31 days * 48 half-hours
    coverage = round(len(has_both) / total_expected * 100, 1) if total_expected > 0 else 0

    dq = DataQualityInfo(
        total_expected_intervals=total_expected,
        actual_records_count=len(actuals),
        forecast_records_count=len(forecasts),
        matched_intervals=len(has_both),
        missing_actual_count=len(missing_actual),
        missing_forecast_count=len(missing_forecast),
        coverage_percent=coverage,
        duplicate_records_removed=meta.get("duplicate_actuals_removed", 0) + meta.get("duplicate_forecasts_removed", 0),
        date_range_start=start_date,
        date_range_end=end_date,
        decision_cutoff_policy=settings.DECISION_CUTOFF_POLICY,
        last_fetch_timestamp=meta.get("last_fetch"),
        api_errors=meta.get("errors", []),
        warnings=meta.get("warnings", []),
    )

    return OverviewResponse(
        date_range_start=start_date,
        date_range_end=end_date,
        actual_interval_count=len(actuals),
        forecast_record_count=len(forecasts),
        matched_interval_count=len(has_both),
        latest_forecast_publish_time=latest_pub,
        avg_actual_generation_mw=avg_actual,
        avg_forecast_generation_mw=avg_forecast,
        mae_mw=metrics.get("mae_mw"),
        rmse_mw=metrics.get("rmse_mw"),
        mbe_mw=metrics.get("mbe_mw"),
        coverage_percent=coverage,
        data_quality=dq,
        daily_summary=daily,
        time_series=chart_data["actual_vs_forecast"],
        error_trend=error_trend,
    )


@router.get("/forecasts")
async def get_forecasts(
    delivery_date: str = Query(default="2026-01-15"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=48, ge=1, le=200),
):
    """
    Forecast explorer: inspect forecasts for a specific delivery date.
    Shows eligible vs ineligible forecasts, publication history, and errors.
    """
    actuals = await data_service.get_actuals()
    forecasts = await data_service.get_forecasts()

    # Filter to the specific date for the selection
    date_start = pd.Timestamp(f"{delivery_date}T00:00:00", tz="UTC")
    date_end = date_start + pd.Timedelta(days=1)

    # Filter actuals to this date
    if not actuals.empty:
        day_actuals = actuals[
            (actuals["startTime"] >= date_start) & (actuals["startTime"] < date_end)
        ]
    else:
        day_actuals = pd.DataFrame()

    # For forecasts, we need all forecasts published before the cutoff
    # that target this date's delivery intervals
    if not forecasts.empty:
        day_forecasts = forecasts[
            (forecasts["startTime"] >= date_start) & (forecasts["startTime"] < date_end)
        ]
    else:
        day_forecasts = pd.DataFrame()

    matched = select_eligible_forecasts(day_forecasts, day_actuals)

    total_records = len(matched) if not matched.empty else 0

    # Pagination
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size

    records = []
    if not matched.empty:
        page_data = matched.iloc[start_idx:end_idx]
        for _, row in page_data.iterrows():
            records.append(ForecastRecord(
                delivery_time=row["delivery_time"].isoformat(),
                delivery_time_uk=row["delivery_time_uk"],
                decision_cutoff=row["decision_cutoff"].isoformat(),
                forecast_publish_time=row["forecast_publish_time"].isoformat() if row["forecast_publish_time"] is not None and pd.notna(row["forecast_publish_time"]) else None,
                forecast_mw=round(float(row["forecast_mw"]), 1) if pd.notna(row.get("forecast_mw")) and row["forecast_mw"] is not None else None,
                actual_mw=round(float(row["actual_mw"]), 1) if pd.notna(row.get("actual_mw")) and row["actual_mw"] is not None else None,
                error_mw=round(float(row["error_mw"]), 2) if row.get("error_mw") is not None and pd.notna(row.get("error_mw")) else None,
                absolute_error_mw=round(float(row["absolute_error_mw"]), 2) if row.get("absolute_error_mw") is not None and pd.notna(row.get("absolute_error_mw")) else None,
                forecast_age_hours=round(float(row["forecast_age_hours"]), 1) if row.get("forecast_age_hours") is not None and pd.notna(row.get("forecast_age_hours")) else None,
                is_eligible=bool(row["is_eligible"]),
                has_actual=bool(row["has_actual"]),
                has_forecast=bool(row["has_forecast"]),
            ))

    # Publication history
    pub_history = get_publication_history(forecasts, delivery_date)

    return ForecastExplorerResponse(
        delivery_date=delivery_date,
        decision_cutoff_policy=settings.DECISION_CUTOFF_POLICY,
        records=records,
        total_records=total_records,
        page=page,
        page_size=page_size,
        publication_history=pub_history,
    )


@router.get("/actuals")
async def get_actuals(
    start_date: str = Query(default="2026-01-01"),
    end_date: str = Query(default="2026-01-31"),
):
    """Return actual WIND generation for the date range."""
    actuals = await data_service.get_actuals()

    if actuals.empty:
        return ActualsResponse(
            date_range_start=start_date,
            date_range_end=end_date,
            records=[],
            total_count=0,
        )

    records = []
    for _, row in actuals.iterrows():
        records.append(ActualRecord(
            delivery_time=row["startTime"].isoformat(),
            delivery_time_uk=row["startTime_uk"].strftime("%Y-%m-%d %H:%M"),
            generation_mw=float(row["generation"]),
            settlement_period=int(row.get("settlementPeriod", 0)) if "settlementPeriod" in row.index else 0,
        ))

    return ActualsResponse(
        date_range_start=start_date,
        date_range_end=end_date,
        records=records,
        total_count=len(records),
    )


@router.get("/accuracy")
async def get_accuracy(
    start_date: str = Query(default="2026-01-01"),
    end_date: str = Query(default="2026-01-31"),
):
    """
    Forecast accuracy metrics with chart data.
    """
    matched = await data_service.get_matched()

    if matched.empty:
        return AccuracyMetrics(
            matched_intervals=0,
            expected_intervals=1488,
            coverage_percent=0.0,
            date_range_start=start_date,
            date_range_end=end_date,
            decision_cutoff_policy=settings.DECISION_CUTOFF_POLICY,
        )

    metrics = calculate_accuracy_metrics(matched)
    chart_data = build_chart_data(matched)

    has_both = matched[(matched["has_forecast"]) & (matched["has_actual"])]
    total_expected = 1488
    coverage = round(len(has_both) / total_expected * 100, 1)

    avg_lead = None
    if not has_both.empty and "forecast_age_hours" in has_both.columns:
        valid_ages = has_both["forecast_age_hours"].dropna()
        if not valid_ages.empty:
            avg_lead = round(float(valid_ages.mean()), 1)

    return AccuracyMetrics(
        mae_mw=metrics["mae_mw"],
        rmse_mw=metrics["rmse_mw"],
        mbe_mw=metrics["mbe_mw"],
        mape_percent=metrics["mape_percent"],
        mape_valid=metrics["mape_valid"],
        mape_excluded_zeros=metrics["mape_excluded_zeros"],
        matched_intervals=len(has_both),
        expected_intervals=total_expected,
        coverage_percent=coverage,
        date_range_start=start_date,
        date_range_end=end_date,
        decision_cutoff_policy=settings.DECISION_CUTOFF_POLICY,
        avg_forecast_lead_time_hours=avg_lead,
        actual_vs_forecast=chart_data["actual_vs_forecast"],
        error_distribution=chart_data["error_distribution"],
        daily_mae=chart_data["daily_mae"],
        bias_trend=chart_data["bias_trend"],
    )


@router.get("/lead-time-analysis")
async def get_lead_time_analysis(
    start_date: str = Query(default="2026-01-01"),
    end_date: str = Query(default="2026-01-31"),
):
    """Lead-time bucket analysis comparing forecast accuracy by publication timing."""
    matched = await data_service.get_matched()
    buckets_data = calculate_lead_time_analysis(matched)

    buckets = [LeadTimeBucket(**b) for b in buckets_data]

    return LeadTimeAnalysisResponse(
        buckets=buckets,
        decision_cutoff_policy=settings.DECISION_CUTOFF_POLICY,
        date_range_start=start_date,
        date_range_end=end_date,
    )


@router.get("/data-quality")
async def get_data_quality():
    """Data provenance and quality report."""
    actuals = await data_service.get_actuals()
    forecasts = await data_service.get_forecasts()
    meta = data_service.get_fetch_metadata()
    matched = await data_service.get_matched()

    unique_actual_intervals = len(actuals["startTime"].unique()) if not actuals.empty else 0
    unique_forecast_intervals = len(forecasts["startTime"].unique()) if not forecasts.empty else 0

    unmatched_actual = 0
    unmatched_forecast = 0
    missing_actuals = 0
    missing_forecasts = 0

    if not matched.empty:
        unmatched_actual = int((~matched["has_forecast"] & matched["has_actual"]).sum())
        unmatched_forecast = int((matched["has_forecast"] & ~matched["has_actual"]).sum())
        missing_actuals = int((~matched["has_actual"]).sum())
        missing_forecasts = int((~matched["has_forecast"]).sum())

    return DataQualityResponse(
        sources=[
            {
                "name": "FUELHH (Actual Generation by Fuel Type)",
                "url": "https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream",
                "api_url": f"{settings.ELEXON_BASE_URL}/datasets/FUELHH/stream",
                "description": "Half-hourly actual generation by fuel type. Filtered to fuelType=WIND.",
            },
            {
                "name": "WINDFOR (Wind Generation Forecast)",
                "url": "https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream",
                "api_url": f"{settings.ELEXON_BASE_URL}/datasets/WINDFOR/stream",
                "description": "Wind generation forecasts with publication timestamps for forecast selection.",
            },
        ],
        last_fetch_timestamp=meta.get("last_fetch"),
        requested_period_start="2026-01-01T00:00:00Z",
        requested_period_end="2026-02-01T00:00:00Z",
        fuelhh_records_total=meta.get("raw_fuelhh_count", 0) or len(actuals),
        fuelhh_wind_records=len(actuals),
        windfor_records_total=meta.get("raw_windfor_count", 0) or len(forecasts),
        unique_delivery_intervals_actual=unique_actual_intervals,
        unique_delivery_intervals_forecast=unique_forecast_intervals,
        duplicate_actual_records=meta.get("duplicate_actuals_removed", 0),
        duplicate_forecast_records=meta.get("duplicate_forecasts_removed", 0),
        missing_actual_values=missing_actuals,
        missing_forecast_values=missing_forecasts,
        unmatched_actual_intervals=unmatched_actual,
        unmatched_forecast_intervals=unmatched_forecast,
        decision_cutoff_policy=settings.DECISION_CUTOFF_POLICY,
        methodology_notes=[
            "Actual generation is filtered from FUELHH dataset where fuelType='WIND'.",
            "Forecasts use WINDFOR dataset with publishTime for eligibility determination.",
            f"Decision cutoff policy: '{settings.DECISION_CUTOFF_POLICY}' — end of the preceding UK calendar day.",
            "For each delivery interval, the eligible forecast with the latest publishTime is selected.",
            "Tie-breaking: if multiple forecasts share the same publishTime, the one with higher generation is selected.",
            "WINDFOR provides hourly average power forecasts (MW); FUELHH provides half-hourly settlement actuals (MW).",
            "Each hourly forecast is matched to both half-hour actual intervals within that hour via piecewise-constant step mapping.",
            "Lead-time for each hourly forecast is measured from publishTime to the delivery hour start (target_hour).",
            "January 2026 has 1,488 expected half-hourly intervals (31 days × 48 periods).",
            "Timestamps are stored internally as UTC; displayed to users in Europe/London time.",
            "MAPE excludes intervals where actual generation is zero to avoid division by zero.",
        ],
        api_errors=meta.get("errors", []),
        warnings=meta.get("warnings", []),
    )


@router.get("/export")
async def export_csv(
    start_date: str = Query(default="2026-01-01"),
    end_date: str = Query(default="2026-01-31"),
):
    """Export matched forecast/actual data as CSV."""
    matched = await data_service.get_matched()

    if matched.empty:
        raise HTTPException(status_code=404, detail="No data available for export")

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Delivery Time (UTC)",
        "Delivery Time (UK)",
        "Decision Cutoff (UTC)",
        "Forecast Published (UTC)",
        "Forecast MW",
        "Actual MW",
        "Error MW",
        "Absolute Error MW",
        "Forecast Age (hours)",
        "Eligible",
        "Has Actual",
        "Has Forecast",
    ])

    for _, row in matched.iterrows():
        writer.writerow([
            row["delivery_time"].isoformat() if pd.notna(row["delivery_time"]) else "",
            row["delivery_time_uk"],
            row["decision_cutoff"].isoformat() if pd.notna(row["decision_cutoff"]) else "",
            row["forecast_publish_time"].isoformat() if row["forecast_publish_time"] is not None and pd.notna(row["forecast_publish_time"]) else "",
            row["forecast_mw"] if pd.notna(row.get("forecast_mw")) else "",
            row["actual_mw"] if pd.notna(row.get("actual_mw")) else "",
            round(row["error_mw"], 2) if row["error_mw"] is not None and pd.notna(row.get("error_mw")) else "",
            round(row["absolute_error_mw"], 2) if row["absolute_error_mw"] is not None and pd.notna(row.get("absolute_error_mw")) else "",
            round(row["forecast_age_hours"], 1) if row["forecast_age_hours"] is not None and pd.notna(row.get("forecast_age_hours")) else "",
            row["is_eligible"],
            row["has_actual"],
            row["has_forecast"],
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=windlens_export_{start_date}_{end_date}.csv"
        },
    )


@router.post("/refresh")
async def refresh_data():
    """Force refresh data from Elexon APIs."""
    await data_service.refresh_data()
    return {"status": "ok", "message": "Data refreshed from Elexon APIs"}

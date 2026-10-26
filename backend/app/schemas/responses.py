"""
WINDLENS Pydantic Response Schemas

Defines typed response models for all API endpoints.
These schemas enforce consistent response structure and support
automatic OpenAPI documentation generation.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ---------- Shared ----------

class DataQualityInfo(BaseModel):
    """Data quality and coverage metadata included with analytical responses."""
    total_expected_intervals: int = Field(description="Expected 30-min intervals for the analysis period")
    actual_records_count: int = Field(description="Number of actual WIND generation records retrieved")
    forecast_records_count: int = Field(description="Number of WINDFOR forecast records retrieved")
    matched_intervals: int = Field(description="Intervals with both forecast and actual values")
    missing_actual_count: int = Field(description="Delivery intervals lacking actual generation data")
    missing_forecast_count: int = Field(description="Delivery intervals lacking eligible forecast data")
    coverage_percent: float = Field(description="Percentage of expected intervals with matched data")
    duplicate_records_removed: int = Field(default=0)
    date_range_start: str = Field(description="Analysis period start (ISO)")
    date_range_end: str = Field(description="Analysis period end (ISO)")
    decision_cutoff_policy: str = Field(description="Policy used to select eligible forecasts")
    last_fetch_timestamp: Optional[str] = Field(default=None)
    api_errors: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)


# ---------- Overview ----------

class OverviewResponse(BaseModel):
    """Summary dashboard statistics for the analysis period."""
    date_range_start: str
    date_range_end: str
    actual_interval_count: int
    forecast_record_count: int
    matched_interval_count: int
    latest_forecast_publish_time: Optional[str] = None
    avg_actual_generation_mw: Optional[float] = None
    avg_forecast_generation_mw: Optional[float] = None
    mae_mw: Optional[float] = None
    rmse_mw: Optional[float] = None
    mbe_mw: Optional[float] = None
    coverage_percent: float
    data_quality: DataQualityInfo
    # Time series for charts
    daily_summary: List[Dict[str, Any]] = Field(default_factory=list)
    time_series: List[Dict[str, Any]] = Field(default_factory=list)
    error_trend: List[Dict[str, Any]] = Field(default_factory=list)


# ---------- Forecasts ----------

class ForecastRecord(BaseModel):
    """A single delivery interval with forecast details and eligibility."""
    delivery_time: str
    delivery_time_uk: str
    decision_cutoff: str
    forecast_publish_time: Optional[str] = None
    forecast_mw: Optional[float] = None
    actual_mw: Optional[float] = None
    error_mw: Optional[float] = None
    absolute_error_mw: Optional[float] = None
    forecast_age_hours: Optional[float] = None
    is_eligible: bool = False
    has_actual: bool = False
    has_forecast: bool = False


class ForecastExplorerResponse(BaseModel):
    """Forecast exploration results for a specific delivery date."""
    delivery_date: str
    decision_cutoff_policy: str
    records: List[ForecastRecord]
    total_records: int
    page: int = 1
    page_size: int = 48
    publication_history: List[Dict[str, Any]] = Field(default_factory=list)


# ---------- Actuals ----------

class ActualRecord(BaseModel):
    delivery_time: str
    delivery_time_uk: str
    generation_mw: float
    settlement_period: int


class ActualsResponse(BaseModel):
    date_range_start: str
    date_range_end: str
    records: List[ActualRecord]
    total_count: int


# ---------- Accuracy ----------

class AccuracyMetrics(BaseModel):
    """Forecast accuracy metrics with full coverage metadata."""
    mae_mw: Optional[float] = None
    rmse_mw: Optional[float] = None
    mbe_mw: Optional[float] = None
    mape_percent: Optional[float] = None
    mape_valid: bool = False
    mape_excluded_zeros: int = 0
    mape_denominator_policy: str = "Excludes intervals where actual generation is zero"
    matched_intervals: int
    expected_intervals: int
    coverage_percent: float
    date_range_start: str
    date_range_end: str
    decision_cutoff_policy: str
    avg_forecast_lead_time_hours: Optional[float] = None
    # Chart data
    actual_vs_forecast: List[Dict[str, Any]] = Field(default_factory=list)
    error_distribution: List[Dict[str, Any]] = Field(default_factory=list)
    daily_mae: List[Dict[str, Any]] = Field(default_factory=list)
    bias_trend: List[Dict[str, Any]] = Field(default_factory=list)


# ---------- Lead-time Analysis ----------

class LeadTimeBucket(BaseModel):
    """Accuracy metrics for a specific forecast lead-time range."""
    bucket_label: str
    min_hours: float
    max_hours: float
    count: int
    mae_mw: Optional[float] = None
    rmse_mw: Optional[float] = None
    mbe_mw: Optional[float] = None
    sufficient_data: bool = True


class LeadTimeAnalysisResponse(BaseModel):
    buckets: List[LeadTimeBucket]
    decision_cutoff_policy: str
    note: str = "Lead-time is measured from forecast publication to delivery start."
    date_range_start: str
    date_range_end: str


# ---------- Data Quality ----------

class DataQualityResponse(BaseModel):
    """Full data provenance and quality report."""
    sources: List[Dict[str, str]]
    last_fetch_timestamp: Optional[str] = None
    requested_period_start: str
    requested_period_end: str
    fuelhh_records_total: int
    fuelhh_wind_records: int
    windfor_records_total: int
    unique_delivery_intervals_actual: int
    unique_delivery_intervals_forecast: int
    duplicate_actual_records: int
    duplicate_forecast_records: int
    missing_actual_values: int
    missing_forecast_values: int
    unmatched_actual_intervals: int
    unmatched_forecast_intervals: int
    decision_cutoff_policy: str
    methodology_notes: List[str]
    api_errors: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)


# ---------- Health ----------

class HealthResponse(BaseModel):
    status: str = "ok"
    service: str = "windlens-api"
    version: str = "1.0.0"
    timestamp: str

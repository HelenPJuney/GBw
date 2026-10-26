export interface DataQualityInfo {
  total_expected_intervals: number;
  actual_records_count: number;
  forecast_records_count: number;
  matched_intervals: number;
  missing_actual_count: number;
  missing_forecast_count: number;
  coverage_percent: number;
  duplicate_records_removed: number;
  date_range_start: string;
  date_range_end: string;
  decision_cutoff_policy: string;
  last_fetch_timestamp?: string | null;
  api_errors: string[];
  warnings: string[];
}

export interface OverviewResponse {
  date_range_start: string;
  date_range_end: string;
  actual_interval_count: number;
  forecast_record_count: number;
  matched_interval_count: number;
  latest_forecast_publish_time?: string | null;
  avg_actual_generation_mw?: number | null;
  avg_forecast_generation_mw?: number | null;
  mae_mw?: number | null;
  rmse_mw?: number | null;
  mbe_mw?: number | null;
  coverage_percent: number;
  data_quality: DataQualityInfo;
  daily_summary: Array<{
    date: string;
    avg_actual?: number | null;
    avg_forecast?: number | null;
    max_actual?: number | null;
    min_actual?: number | null;
    intervals: number;
    matched: number;
    mae?: number | null;
  }>;
  time_series: Array<{
    time: string;
    actual?: number | null;
    forecast?: number | null;
  }>;
  error_trend: Array<{
    time: string;
    error: number;
    absolute_error: number;
  }>;
}

export interface ForecastRecord {
  delivery_time: string;
  delivery_time_uk: string;
  decision_cutoff: string;
  forecast_publish_time?: string | null;
  forecast_mw?: number | null;
  actual_mw?: number | null;
  error_mw?: number | null;
  absolute_error_mw?: number | null;
  forecast_age_hours?: number | null;
  is_eligible: boolean;
  has_actual: boolean;
  has_forecast: boolean;
}

export interface PublicationHistoryItem {
  publish_time: string;
  publish_time_uk: string;
  delivery_time: string;
  delivery_time_uk: string;
  generation_mw: number;
}

export interface ForecastExplorerResponse {
  delivery_date: string;
  decision_cutoff_policy: string;
  records: ForecastRecord[];
  total_records: number;
  page: number;
  page_size: number;
  publication_history: PublicationHistoryItem[];
}

export interface AccuracyMetrics {
  mae_mw?: number | null;
  rmse_mw?: number | null;
  mbe_mw?: number | null;
  mape_percent?: number | null;
  mape_valid: boolean;
  mape_excluded_zeros: number;
  mape_denominator_policy: string;
  matched_intervals: number;
  expected_intervals: number;
  coverage_percent: number;
  date_range_start: string;
  date_range_end: string;
  decision_cutoff_policy: string;
  avg_forecast_lead_time_hours?: number | null;
  actual_vs_forecast: Array<{
    time: string;
    actual?: number | null;
    forecast?: number | null;
  }>;
  error_distribution: Array<{
    bin_start: number;
    bin_end: number;
    count: number;
    label: string;
  }>;
  daily_mae: Array<{
    date: string;
    mae: number;
    count: number;
  }>;
  bias_trend: Array<{
    date: string;
    bias: number;
    count: number;
  }>;
}

export interface LeadTimeBucket {
  bucket_label: string;
  min_hours: number;
  max_hours: number;
  count: number;
  mae_mw?: number | null;
  rmse_mw?: number | null;
  mbe_mw?: number | null;
  sufficient_data: boolean;
}

export interface LeadTimeAnalysisResponse {
  buckets: LeadTimeBucket[];
  decision_cutoff_policy: string;
  note: string;
  date_range_start: string;
  date_range_end: string;
}

export interface ElexonSourceInfo {
  name: string;
  url: string;
  api_url: string;
  description: string;
}

export interface DataQualityResponse {
  sources: ElexonSourceInfo[];
  last_fetch_timestamp?: string | null;
  requested_period_start: string;
  requested_period_end: string;
  fuelhh_records_total: number;
  fuelhh_wind_records: number;
  windfor_records_total: number;
  unique_delivery_intervals_actual: number;
  unique_delivery_intervals_forecast: number;
  duplicate_actual_records: number;
  duplicate_forecast_records: number;
  missing_actual_values: number;
  missing_forecast_values: number;
  unmatched_actual_intervals: number;
  unmatched_forecast_intervals: number;
  decision_cutoff_policy: string;
  methodology_notes: string[];
  api_errors: string[];
  warnings: string[];
}

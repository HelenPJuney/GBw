import type {
  AccuracyMetrics,
  DataQualityResponse,
  ForecastExplorerResponse,
  LeadTimeAnalysisResponse,
  OverviewResponse,
} from '../types/api';

const API_BASE = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '')}/api`
  : '/api';

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error ${response.status}: ${errorText || response.statusText}`);
  }
  return response.json();
}

export const apiService = {
  async getOverview(startDate = '2026-01-01', endDate = '2026-01-31'): Promise<OverviewResponse> {
    return fetchJson<OverviewResponse>(`${API_BASE}/overview?start_date=${startDate}&end_date=${endDate}`);
  },

  async getForecasts(
    deliveryDate = '2026-01-15',
    page = 1,
    pageSize = 48
  ): Promise<ForecastExplorerResponse> {
    return fetchJson<ForecastExplorerResponse>(
      `${API_BASE}/forecasts?delivery_date=${deliveryDate}&page=${page}&page_size=${pageSize}`
    );
  },

  async getAccuracy(startDate = '2026-01-01', endDate = '2026-01-31'): Promise<AccuracyMetrics> {
    return fetchJson<AccuracyMetrics>(`${API_BASE}/accuracy?start_date=${startDate}&end_date=${endDate}`);
  },

  async getLeadTimeAnalysis(
    startDate = '2026-01-01',
    endDate = '2026-01-31'
  ): Promise<LeadTimeAnalysisResponse> {
    return fetchJson<LeadTimeAnalysisResponse>(
      `${API_BASE}/lead-time-analysis?start_date=${startDate}&end_date=${endDate}`
    );
  },

  async getDataQuality(): Promise<DataQualityResponse> {
    return fetchJson<DataQualityResponse>(`${API_BASE}/data-quality`);
  },

  getExportUrl(startDate = '2026-01-01', endDate = '2026-01-31'): string {
    return `${API_BASE}/export?start_date=${startDate}&end_date=${endDate}`;
  },

  async refreshData(): Promise<{ status: string; message: string }> {
    const response = await fetch(`${API_BASE}/refresh`, { method: 'POST' });
    if (!response.ok) {
      throw new Error(`Failed to refresh data: ${response.statusText}`);
    }
    return response.json();
  },
};

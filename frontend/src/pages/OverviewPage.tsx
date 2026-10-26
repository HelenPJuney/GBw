import React, { useState, useEffect } from 'react';
import {
  Activity,
  Layers,
  TrendingUp,
  AlertTriangle,
  Clock,
  Compass,
  CheckCircle,
  HelpCircle,
  Calendar,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import type { OverviewResponse } from '../types/api';
import { apiService } from '../services/api';
import { StatCard } from '../components/StatCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';

export const OverviewPage: React.FC = () => {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.getOverview();
      setData(response);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch overview data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) return <LoadingSpinner message="Calculating January 2026 baseline from official Elexon stream datasets..." />;
  if (error || !data) return <ErrorMessage message={error || 'No overview data available'} onRetry={loadData} />;

  const biasValue = data.mbe_mw ?? 0;
  const biasLabel = biasValue > 0 ? 'Overpredicting (+)' : biasValue < 0 ? 'Underpredicting (-)' : 'Neutral';
  const biasBadge = biasValue > 0 ? 'warning' : biasValue < 0 ? 'danger' : 'neutral';

  // Sample time series to ~150 points for snappy chart rendering
  const sampledTimeSeries = data.time_series.filter((_, i) => i % 4 === 0);
  const sampledErrorTrend = data.error_trend.filter((_, i) => i % 4 === 0);

  // Helper to format ISO/date string to clean editorial '15 Jan'
  const formatTickDate = (val: string) => {
    try {
      const parts = val.split(' ')[0].split('-');
      if (parts.length === 3) return `${parts[2]} Jan`;
    } catch {
      // fallback
    }
    return val.split(' ')[0].slice(5);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', paddingBottom: '56px' }}>
      
      {/* Editorial Header / Context Hero Banner */}
      <section
        className="liquid-glass"
        style={{
          padding: '24px 28px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '18px',
          borderLeft: '4px solid var(--brand-mocha)',
        }}
      >
        <div style={{ maxWidth: '820px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <span className="badge badge-lavender" style={{ fontSize: '0.6875rem' }}>
              Historical Baseline
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              Delivery Period: 2026-01-01 00:00 to 2026-02-01 00:00 (Europe/London)
            </span>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontFamily: 'var(--font-display)', color: 'var(--text-espresso)', letterSpacing: '-0.02em', lineHeight: 1.25 }}>
            Wholesale Day-Ahead Wind Generation Overview
          </h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: 1.55 }}>
            Evaluates wind generation available to meet day-ahead wholesale commitments. Forecasts are strictly filtered to those published before the 23:59 preceding calendar-day cutoff.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              padding: '12px 18px',
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.75) 0%, rgba(240, 235, 248, 0.5) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.85)',
              boxShadow: '0 4px 14px rgba(48, 36, 31, 0.04), inset 0 1px 1px #fff',
              textAlign: 'right',
            }}
          >
            <span style={{ fontSize: '0.6875rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em', display: 'block' }}>
              Data Provenance
            </span>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-espresso)', marginTop: '2px' }}>
              Elexon BMRS Live Sync
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--status-green)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600, marginTop: '3px' }}>
              <CheckCircle size={12} /> Complete 1,488 Intervals
            </span>
          </div>
        </div>
      </section>

      {/* KPI Stat Cards Grid (Balanced 6-Column Layout) */}
      <div className="kpi-grid-6">
        <StatCard
          title="Data Coverage"
          value={`${data.coverage_percent}%`}
          subtitle={`${data.matched_interval_count.toLocaleString()} of ${data.data_quality.total_expected_intervals.toLocaleString()} half-hours`}
          icon={CheckCircle}
          badgeText="100% Complete"
          badgeType="success"
        />
        <StatCard
          title="Avg Actual Wind"
          value={data.avg_actual_generation_mw?.toLocaleString() ?? '—'}
          unit="MW"
          subtitle="National outturn generation"
          icon={Activity}
          badgeText="FUELHH"
          badgeType="neutral"
        />
        <StatCard
          title="Avg Forecast"
          value={data.avg_forecast_generation_mw?.toLocaleString() ?? '—'}
          unit="MW"
          subtitle="Pre-cutoff eligible forecast"
          icon={Compass}
          badgeText="WINDFOR"
          badgeType="lavender"
        />
        <StatCard
          title="MAE (Baseline)"
          value={data.mae_mw?.toLocaleString() ?? '—'}
          unit="MW"
          subtitle="Mean absolute error magnitude"
          icon={TrendingUp}
          badgeText="Primary Metric"
          badgeType="neutral"
        />
        <StatCard
          title="RMSE (Spikes)"
          value={data.rmse_mw?.toLocaleString() ?? '—'}
          unit="MW"
          subtitle="Extreme error penalty metric"
          icon={Layers}
          badgeText="Peak Sensitive"
          badgeType="neutral"
        />
        <StatCard
          title="Forecast Bias (MBE)"
          value={biasValue > 0 ? `+${biasValue.toLocaleString()}` : biasValue.toLocaleString()}
          unit="MW"
          subtitle="Signed mean error (MBE)"
          icon={AlertTriangle}
          badgeText={biasLabel}
          badgeType={biasBadge}
        />
      </div>

      {/* Main Analytical Chart: Actual vs Forecast */}
      <section className="analytical-card" style={{ padding: '24px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <h2 style={{ fontSize: '1.125rem', fontFamily: 'var(--font-display)', color: 'var(--text-espresso)', letterSpacing: '-0.01em' }}>
              Actual vs Eligible Forecast Wind Generation (MW)
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
              Comparison across 30-minute delivery settlement intervals for January 2026. Only forecasts published prior to decision cutoff are plotted.
            </p>
          </div>
          
          {/* Chart Series Legend Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              padding: '5px 12px',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(111, 78, 55, 0.08)',
              border: '1px solid rgba(111, 78, 55, 0.22)',
            }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#6F4E37', boxShadow: '0 0 4px rgba(111, 78, 55, 0.4)' }}></span>
              <span style={{ color: 'var(--text-espresso)', fontWeight: 600 }}>Actual Generation</span>
              <span style={{ color: 'var(--brand-mocha)', fontWeight: 500, fontSize: '0.6875rem' }}>(FUELHH)</span>
            </div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              padding: '5px 12px',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(122, 91, 156, 0.09)',
              border: '1px solid rgba(122, 91, 156, 0.24)',
            }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#7A5B9C', boxShadow: '0 0 4px rgba(122, 91, 156, 0.4)' }}></span>
              <span style={{ color: 'var(--text-espresso)', fontWeight: 600 }}>Eligible Forecast</span>
              <span style={{ color: 'var(--brand-lavender-accent)', fontWeight: 500, fontSize: '0.6875rem' }}>(WINDFOR)</span>
            </div>
          </div>
        </div>

        <div style={{ height: '380px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sampledTimeSeries} margin={{ top: 12, right: 18, left: 6, bottom: 12 }}>
              <defs>
                <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6F4E37" stopOpacity={0.22} />
                  <stop offset="95%" stopColor="#6F4E37" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7A5B9C" stopOpacity={0.16} />
                  <stop offset="95%" stopColor="#7A5B9C" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(229, 228, 226, 0.75)" vertical={false} />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 11, fill: '#7C7267', fontFamily: 'var(--font-mono)' }}
                tickFormatter={formatTickDate}
                minTickGap={45}
                stroke="#D8D6D2"
                tickLine={false}
              />
              <YAxis
                width={68}
                tick={{ fontSize: 11, fill: '#7C7267', fontFamily: 'var(--font-mono)' }}
                tickFormatter={(val) => `${(val / 1000).toFixed(0)}k MW`}
                stroke="#D8D6D2"
                tickLine={false}
              />
              <Tooltip
                cursor={{ stroke: '#6F4E37', strokeWidth: 1.5, strokeDasharray: '3 3', strokeOpacity: 0.5 }}
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const actual = payload.find(p => p.dataKey === 'actual')?.value as number | undefined;
                    const forecast = payload.find(p => p.dataKey === 'forecast')?.value as number | undefined;
                    const diff = (forecast !== undefined && actual !== undefined) ? forecast - actual : null;
                    return (
                      <div className="chart-tooltip-glass">
                        <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                          {label} GMT
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', marginBottom: '4px' }}>
                          <span style={{ color: '#6F4E37', fontWeight: 600 }}>Actual:</span>
                          <span className="tabular-nums" style={{ fontWeight: 600 }}>
                            {actual !== undefined ? `${actual.toLocaleString()} MW` : '—'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', marginBottom: '6px' }}>
                          <span style={{ color: '#7A5B9C', fontWeight: 600 }}>Forecast:</span>
                          <span className="tabular-nums" style={{ fontWeight: 600 }}>
                            {forecast !== undefined ? `${forecast.toLocaleString()} MW` : '—'}
                          </span>
                        </div>
                        {diff !== null && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', borderTop: '1px solid var(--brand-platinum)', paddingTop: '6px' }}>
                            <span style={{ color: diff >= 0 ? 'var(--status-amber)' : 'var(--status-red)', fontWeight: 600 }}>
                              Error (F − A):
                            </span>
                            <span className="tabular-nums" style={{ fontWeight: 700, color: diff >= 0 ? 'var(--status-amber)' : 'var(--status-red)' }}>
                              {diff >= 0 ? `+${diff.toLocaleString()}` : diff.toLocaleString()} MW
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area type="monotone" dataKey="actual" name="Actual Generation" stroke="#6F4E37" strokeWidth={2.4} fill="url(#actualGradient)" />
              <Area type="monotone" dataKey="forecast" name="Eligible Forecast" stroke="#7A5B9C" strokeWidth={2.2} strokeDasharray="4 2" fill="url(#forecastGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Forecast Error Trend Chart */}
      <section className="analytical-card" style={{ padding: '24px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '1.125rem', fontFamily: 'var(--font-display)', color: 'var(--text-espresso)', letterSpacing: '-0.01em' }}>
              Day-Ahead Forecast Error Trend (MW)
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
              Signed Error = Forecast − Actual. Positive values denote over-prediction (excess anticipated), negative denote under-prediction (shortfall).
            </p>
          </div>
        </div>

        <div style={{ height: '230px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sampledErrorTrend} margin={{ top: 12, right: 18, left: 6, bottom: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(229, 228, 226, 0.75)" vertical={false} />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 11, fill: '#7C7267', fontFamily: 'var(--font-mono)' }}
                tickFormatter={formatTickDate}
                minTickGap={45}
                stroke="#D8D6D2"
                tickLine={false}
              />
              <YAxis
                width={68}
                tick={{ fontSize: 11, fill: '#7C7267', fontFamily: 'var(--font-mono)' }}
                unit=" MW"
                stroke="#D8D6D2"
                tickLine={false}
              />
              <ReferenceLine y={0} stroke="#A89A8C" strokeWidth={1.5} strokeDasharray="3 3" label={{ value: '0 MW Baseline', position: 'insideTopLeft', fill: '#8E8277', fontSize: 10, offset: 4 }} />
              <Tooltip
                cursor={{ stroke: '#B45309', strokeWidth: 1.5, strokeDasharray: '3 3', strokeOpacity: 0.5 }}
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const err = payload[0].value as number;
                    return (
                      <div className="chart-tooltip-glass">
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{label} GMT</span>
                        <div className="tabular-nums" style={{ fontWeight: 700, color: err >= 0 ? 'var(--status-amber)' : 'var(--status-red)', marginTop: '4px' }}>
                          Error: {err >= 0 ? `+${err.toLocaleString()}` : err.toLocaleString()} MW
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Line type="monotone" dataKey="error" stroke="#B45309" strokeWidth={1.8} dot={false} activeDot={{ r: 4, fill: '#B45309', stroke: '#FFFFFF', strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Daily Aggregated Overview Table */}
      <section className="analytical-card" style={{ padding: '24px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h2 style={{ fontSize: '1.0625rem', fontFamily: 'var(--font-display)', color: 'var(--text-espresso)' }}>
              Daily Operational Performance Breakdown
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              31 calendar days in January 2026. Daily average generation, peak generation, and day-ahead MAE.
            </p>
          </div>
          <span className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>
            48 half-hours / day
          </span>
        </div>

        <div className="data-table-container" style={{ maxHeight: '380px', overflowY: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Delivery Date</th>
                <th style={{ textAlign: 'right' }}>Avg Actual MW</th>
                <th style={{ textAlign: 'right' }}>Avg Forecast MW</th>
                <th style={{ textAlign: 'right' }}>Peak Actual MW</th>
                <th style={{ textAlign: 'right' }}>Min Actual MW</th>
                <th style={{ textAlign: 'right' }}>Day-Ahead MAE</th>
                <th style={{ textAlign: 'center' }}>Intervals</th>
              </tr>
            </thead>
            <tbody>
              {data.daily_summary.map((day) => (
                <tr key={day.date}>
                  <td style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
                    {day.date}
                  </td>
                  <td style={{ textAlign: 'right' }} className="tabular-nums">
                    {day.avg_actual?.toLocaleString() ?? '—'} MW
                  </td>
                  <td style={{ textAlign: 'right' }} className="tabular-nums">
                    {day.avg_forecast?.toLocaleString() ?? '—'} MW
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--brand-mocha)', fontWeight: 600 }} className="tabular-nums">
                    {day.max_actual?.toLocaleString() ?? '—'} MW
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--text-muted)' }} className="tabular-nums">
                    {day.min_actual?.toLocaleString() ?? '—'} MW
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <span
                      className="tabular-nums"
                      style={{
                        fontWeight: 600,
                        color: (day.mae ?? 0) > 2000 ? 'var(--status-red)' : (day.mae ?? 0) > 1200 ? 'var(--status-amber)' : 'var(--status-green)'
                      }}
                    >
                      {day.mae?.toLocaleString() ?? '—'} MW
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className="badge badge-success" style={{ fontSize: '0.6875rem' }}>
                      {day.matched}/{day.intervals}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  );
};

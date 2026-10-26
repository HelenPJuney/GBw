import React, { useState, useEffect } from 'react';
import {
  BarChart2,
  TrendingUp,
  Clock,
  Layers,
  AlertCircle,
  Calendar,
  CheckCircle,
  HelpCircle,
  Info,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Cell,
} from 'recharts';
import type { AccuracyMetrics, LeadTimeAnalysisResponse } from '../types/api';
import { apiService } from '../services/api';
import { StatCard } from '../components/StatCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';

export const AccuracyPage: React.FC = () => {
  const [startDate, setStartDate] = useState('2026-01-01');
  const [endDate, setEndDate] = useState('2026-01-31');
  const [accuracy, setAccuracy] = useState<AccuracyMetrics | null>(null);
  const [leadTime, setLeadTime] = useState<LeadTimeAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [accRes, leadRes] = await Promise.all([
        apiService.getAccuracy(startDate, endDate),
        apiService.getLeadTimeAnalysis(startDate, endDate),
      ]);
      setAccuracy(accRes);
      setLeadTime(leadRes);
    } catch (err: any) {
      setError(err.message || 'Failed to calculate accuracy metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [startDate, endDate]);

  if (loading) return <LoadingSpinner message="Calculating statistical accuracy metrics across 1,488 matched intervals..." />;
  if (error || !accuracy) return <ErrorMessage message={error || 'Failed to load accuracy metrics'} onRetry={loadData} />;

  const bias = accuracy.mbe_mw ?? 0;
  const biasInterpretation = bias > 0 ? 'Overpredicting (+)' : bias < 0 ? 'Underpredicting (-)' : 'Neutral';

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
      
      {/* Editorial Header with Date Range Filter */}
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
        <div style={{ maxWidth: '780px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <span className="badge badge-lavender" style={{ fontSize: '0.6875rem' }}>
              Statistical Verification
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              Deterministic Server-Side Python Calculations
            </span>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontFamily: 'var(--font-display)', color: 'var(--text-espresso)', letterSpacing: '-0.02em', lineHeight: 1.25 }}>
            Forecast Accuracy & Uncertainty Analytics
          </h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: 1.55 }}>
            Rigorous statistical evaluation of day-ahead wind generation forecasts against verified Elexon actuals across the wholesale procurement horizon.
          </p>
        </div>

        {/* Date Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 600 }}>From:</label>
            <input
              type="date"
              className="form-input"
              value={startDate}
              min="2026-01-01"
              max="2026-01-31"
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 600 }}>To:</label>
            <input
              type="date"
              className="form-input"
              value={endDate}
              min="2026-01-01"
              max="2026-01-31"
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Core KPI Cards (Balanced 6-Column Layout) */}
      <div className="kpi-grid-6">
        <StatCard
          title="MAE (Baseline)"
          value={accuracy.mae_mw?.toLocaleString() ?? '—'}
          unit="MW"
          subtitle="mean(|Forecast − Actual|)"
          icon={TrendingUp}
          badgeText="Primary Metric"
          badgeType="neutral"
        />
        <StatCard
          title="RMSE (Spikes)"
          value={accuracy.rmse_mw?.toLocaleString() ?? '—'}
          unit="MW"
          subtitle="sqrt(mean((F − A)²))"
          icon={Layers}
          badgeText="Penalty Sensitive"
          badgeType="neutral"
        />
        <StatCard
          title="Forecast Bias (MBE)"
          value={bias > 0 ? `+${bias.toLocaleString()}` : bias.toLocaleString()}
          unit="MW"
          subtitle="Signed mean error"
          icon={AlertCircle}
          badgeText={biasInterpretation}
          badgeType={bias > 0 ? 'warning' : bias < 0 ? 'danger' : 'neutral'}
        />
        <StatCard
          title="MAPE (Percent)"
          value={accuracy.mape_valid && accuracy.mape_percent !== null ? `${accuracy.mape_percent}%` : 'Conditionally Valid'}
          subtitle={`Excludes ${accuracy.mape_excluded_zeros} zeros`}
          icon={BarChart2}
          badgeText={accuracy.mape_valid ? 'Valid Sample' : 'Filtered'}
          badgeType="neutral"
        />
        <StatCard
          title="Matched Sample"
          value={accuracy.matched_intervals.toLocaleString()}
          unit="periods"
          subtitle="30-minute delivery periods"
          icon={CheckCircle}
          badgeText={`${accuracy.coverage_percent}% Coverage`}
          badgeType="success"
        />
        <StatCard
          title="Avg Forecast Age"
          value={accuracy.avg_forecast_lead_time_hours ?? '—'}
          unit="hours"
          subtitle="Lead time before delivery"
          icon={Clock}
          badgeText="Pre-Cutoff"
          badgeType="lavender"
        />
      </div>

      {/* Conditional MAPE Policy Disclaimer Banner */}
      <section className="liquid-glass" style={{ padding: '14px 20px', borderLeft: '3px solid var(--brand-lavender-accent)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Info size={18} color="var(--brand-lavender-accent)" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            <strong>MAPE Denominator Policy Disclosure:</strong> {accuracy.mape_denominator_policy}. Zero actual values have been safely excluded to avoid division-by-zero distortion.
          </span>
        </div>
      </section>

      {/* Two Column Section: Lead-Time Bucket Analysis & Error Distribution */}
      <div className="grid-2-col">
        
        {/* Lead-Time Bucket Analysis */}
        <section className="analytical-card" style={{ padding: '24px 28px' }}>
          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1.125rem', fontFamily: 'var(--font-display)', color: 'var(--text-espresso)', letterSpacing: '-0.01em' }}>
              Forecast Accuracy by Lead-Time Bucket
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
              Compares MAE (MW) across forecast publication lead times before delivery.
            </p>
          </div>

          <div style={{ height: '250px', width: '100%' }}>
            {leadTime && leadTime.buckets ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={leadTime.buckets} margin={{ top: 12, right: 18, left: 6, bottom: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(229, 228, 226, 0.75)" vertical={false} />
                  <XAxis dataKey="bucket_label" tick={{ fontSize: 11, fill: '#7C7267', fontFamily: 'var(--font-mono)' }} stroke="#D8D6D2" tickLine={false} />
                  <YAxis width={68} tick={{ fontSize: 11, fill: '#7C7267', fontFamily: 'var(--font-mono)' }} tickFormatter={(val) => `${val.toLocaleString()} MW`} stroke="#D8D6D2" tickLine={false} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const b = payload[0].payload;
                        return (
                          <div className="chart-tooltip-glass">
                            <div style={{ fontWeight: 600, color: 'var(--text-espresso)', marginBottom: '6px' }}>{b.bucket_label}</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', marginBottom: '2px' }}>
                              <span>MAE:</span>
                              <strong className="tabular-nums">{b.mae_mw?.toLocaleString() ?? '—'} MW</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', marginBottom: '2px' }}>
                              <span>RMSE:</span>
                              <strong className="tabular-nums">{b.rmse_mw?.toLocaleString() ?? '—'} MW</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px' }}>
                              <span>Bias:</span>
                              <strong className="tabular-nums">{b.mbe_mw !== null && b.mbe_mw !== undefined ? (b.mbe_mw >= 0 ? `+${b.mbe_mw}` : b.mbe_mw) : '—'} MW</strong>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px', borderTop: '1px solid var(--brand-platinum)', paddingTop: '4px' }}>
                              Sample: {b.count} intervals ({b.sufficient_data ? 'Sufficient' : 'Insufficient'})
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="mae_mw" fill="#6F4E37" radius={[5, 5, 0, 0]} name="MAE (MW)">
                    {leadTime.buckets.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.sufficient_data ? '#6F4E37' : '#D6D5D2'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>No lead-time data</p>
            )}
          </div>

          {/* Lead-Time Summary Badges */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginTop: '16px' }}>
            {leadTime?.buckets.map((b, idx) => (
              <div
                key={idx}
                style={{
                  background: 'rgba(244, 243, 241, 0.75)',
                  border: '1px solid var(--brand-platinum)',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  textAlign: 'center',
                }}
              >
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'block', fontWeight: 500 }}>{b.bucket_label}</span>
                <span className="tabular-nums" style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-espresso)', marginTop: '2px', display: 'block' }}>
                  {b.mae_mw ? `${b.mae_mw.toLocaleString()} MW` : 'N/A'}
                </span>
                <span style={{ fontSize: '0.6875rem', display: 'block', color: b.sufficient_data ? 'var(--status-green)' : 'var(--status-amber)', fontWeight: 600, marginTop: '2px' }}>
                  {b.count} samples
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Error Distribution Histogram */}
        <section className="analytical-card" style={{ padding: '24px 28px' }}>
          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1.125rem', fontFamily: 'var(--font-display)', color: 'var(--text-espresso)', letterSpacing: '-0.01em' }}>
              Forecast Error Distribution
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
              Frequency histogram of signed error (MW = Forecast − Actual). Symmetrical curve indicates balanced forecasting.
            </p>
          </div>

          <div style={{ height: '250px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={accuracy.error_distribution} margin={{ top: 12, right: 18, left: 6, bottom: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(229, 228, 226, 0.75)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#7C7267', fontFamily: 'var(--font-mono)' }} unit=" MW" minTickGap={30} stroke="#D8D6D2" tickLine={false} />
                <YAxis width={50} tick={{ fontSize: 11, fill: '#7C7267', fontFamily: 'var(--font-mono)' }} stroke="#D8D6D2" tickLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const bin = payload[0].payload;
                      return (
                        <div className="chart-tooltip-glass">
                          <div>Error Bin: <strong className="tabular-nums">{bin.bin_start} to {bin.bin_end} MW</strong></div>
                          <div style={{ marginTop: '2px' }}>Intervals: <strong className="tabular-nums">{bin.count}</strong></div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="count" fill="#7A5B9C" radius={[4, 4, 0, 0]} name="Count" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '16px' }}>
            <span>← Underprediction Shortfall (Negative Error)</span>
            <span>Overprediction Excess (Positive Error) →</span>
          </div>
        </section>

      </div>

      {/* Two Column Section: Daily MAE Trend & Daily Forecast Bias Trend */}
      <div className="grid-2-col">
        
        {/* Daily MAE Trend */}
        <section className="analytical-card" style={{ padding: '24px 28px' }}>
          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1.125rem', fontFamily: 'var(--font-display)', color: 'var(--text-espresso)', letterSpacing: '-0.01em' }}>
              Daily MAE Trend (MW)
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
              Daily mean absolute error across January 2026. Highlights volatile weather days where forecast uncertainty surged.
            </p>
          </div>

          <div style={{ height: '230px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={accuracy.daily_mae} margin={{ top: 12, right: 18, left: 6, bottom: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(229, 228, 226, 0.75)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#7C7267', fontFamily: 'var(--font-mono)' }}
                  tickFormatter={formatTickDate}
                  minTickGap={30}
                  stroke="#D8D6D2"
                  tickLine={false}
                />
                <YAxis width={68} tick={{ fontSize: 11, fill: '#7C7267', fontFamily: 'var(--font-mono)' }} unit=" MW" stroke="#D8D6D2" tickLine={false} />
                <Tooltip
                  cursor={{ stroke: '#6F4E37', strokeWidth: 1.5, strokeDasharray: '3 3', strokeOpacity: 0.5 }}
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="chart-tooltip-glass">
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{label}</span>
                          <div className="tabular-nums" style={{ fontWeight: 600, color: 'var(--brand-mocha)', marginTop: '4px' }}>
                            Daily MAE: {payload[0].value?.toLocaleString()} MW
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line type="monotone" dataKey="mae" stroke="#6F4E37" strokeWidth={2.2} dot={{ r: 3, fill: '#6F4E37' }} activeDot={{ r: 5, fill: '#6F4E37', stroke: '#FFFFFF', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Daily Forecast Bias Trend */}
        <section className="analytical-card" style={{ padding: '24px 28px' }}>
          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1.125rem', fontFamily: 'var(--font-display)', color: 'var(--text-espresso)', letterSpacing: '-0.01em' }}>
              Daily Forecast Bias Trend (MBE MW)
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
              Daily mean signed bias. Reveals systematic multi-day overprediction or underprediction regimes.
            </p>
          </div>

          <div style={{ height: '230px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={accuracy.bias_trend} margin={{ top: 12, right: 18, left: 6, bottom: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(229, 228, 226, 0.75)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#7C7267', fontFamily: 'var(--font-mono)' }}
                  tickFormatter={formatTickDate}
                  minTickGap={30}
                  stroke="#D8D6D2"
                  tickLine={false}
                />
                <YAxis width={68} tick={{ fontSize: 11, fill: '#7C7267', fontFamily: 'var(--font-mono)' }} unit=" MW" stroke="#D8D6D2" tickLine={false} />
                <ReferenceLine y={0} stroke="#A89A8C" strokeWidth={1.5} strokeDasharray="3 3" label={{ value: '0 MW Baseline', position: 'insideTopLeft', fill: '#8E8277', fontSize: 10, offset: 4 }} />
                <Tooltip
                  cursor={{ stroke: '#7A5B9C', strokeWidth: 1.5, strokeDasharray: '3 3', strokeOpacity: 0.5 }}
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const bVal = payload[0].value as number;
                      return (
                        <div className="chart-tooltip-glass">
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{label}</span>
                          <div className="tabular-nums" style={{ fontWeight: 600, color: bVal >= 0 ? 'var(--status-amber)' : 'var(--status-red)', marginTop: '4px' }}>
                            Bias: {bVal >= 0 ? `+${bVal.toLocaleString()}` : bVal.toLocaleString()} MW
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line type="monotone" dataKey="bias" stroke="#7A5B9C" strokeWidth={2.2} dot={{ r: 3, fill: '#7A5B9C' }} activeDot={{ r: 5, fill: '#7A5B9C', stroke: '#FFFFFF', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

      </div>

    </div>
  );
};

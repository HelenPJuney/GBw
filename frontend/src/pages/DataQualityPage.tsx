import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Database,
  FileCheck,
  Server,
  Layers,
  Clock,
} from 'lucide-react';
import type { DataQualityResponse } from '../types/api';
import { apiService } from '../services/api';
import { StatCard } from '../components/StatCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';

export const DataQualityPage: React.FC = () => {
  const [data, setData] = useState<DataQualityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.getDataQuality();
      setData(response);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data quality metrics');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setRefreshMessage(null);
    try {
      const res = await apiService.refreshData();
      setRefreshMessage(res.message);
      await loadData();
    } catch (err: any) {
      setError(`Refresh failed: ${err.message}`);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) return <LoadingSpinner message="Auditing data provenance and quality indicators..." />;
  if (error || !data) return <ErrorMessage message={error || 'Unable to load data provenance'} onRetry={loadData} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', paddingBottom: '48px' }}>
      
      {/* Editorial Header */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
            <span className="badge badge-success" style={{ fontSize: '0.6875rem' }}>
              Audited Provenance
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              100% Real Elexon BMRS Ingestion — No Synthetic Sample Data
            </span>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontFamily: 'var(--font-display)', color: 'var(--text-espresso)', letterSpacing: '-0.02em' }}>
            Data Quality, Provenance & Audit Trail
          </h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.5 }}>
            Full traceability of the two official Elexon streaming endpoints, record normalization, and completeness metrics for January 2026.
          </p>
        </div>

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="btn-secondary"
          style={{ opacity: refreshing ? 0.6 : 1 }}
        >
          <RefreshCw size={15} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          {refreshing ? 'Syncing...' : 'Force Refresh from Elexon'}
        </button>
      </section>

      {refreshMessage && (
        <section className="liquid-glass" style={{ padding: '12px 18px', borderLeft: '4px solid var(--status-green)' }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--status-green)', fontWeight: 600 }}>
            {refreshMessage}
          </span>
        </section>
      )}

      {/* Provenance Stat Cards (Balanced 6-Column Layout) */}
      <div className="kpi-grid-6">
        <StatCard
          title="Raw FUELHH"
          value={data.fuelhh_records_total.toLocaleString()}
          unit="records"
          subtitle="Total raw stream payload"
          icon={Database}
          badgeText="Source 1"
          badgeType="neutral"
        />
        <StatCard
          title="WIND Actuals"
          value={data.fuelhh_wind_records.toLocaleString()}
          unit="records"
          subtitle="1,488 half-hours retained"
          icon={FileCheck}
          badgeText="100% Retained"
          badgeType="success"
        />
        <StatCard
          title="WINDFOR Total"
          value={data.windfor_records_total.toLocaleString()}
          unit="records"
          subtitle="Forecast revisions logged"
          icon={Layers}
          badgeText="Source 2"
          badgeType="lavender"
        />
        <StatCard
          title="Deduplicated"
          value={(data.duplicate_actual_records + data.duplicate_forecast_records).toLocaleString()}
          unit="records"
          subtitle="Deterministic key dedup"
          icon={CheckCircle2}
          badgeText="Clean Keying"
          badgeType="success"
        />
        <StatCard
          title="Missing Actuals"
          value={data.missing_actual_values}
          subtitle="Unreported delivery periods"
          icon={AlertTriangle}
          badgeText={data.missing_actual_values === 0 ? 'Zero Missing' : 'Check Intervals'}
          badgeType={data.missing_actual_values === 0 ? 'success' : 'warning'}
        />
        <StatCard
          title="Unmatched"
          value={data.unmatched_actual_intervals}
          subtitle="Actuals lacking forecast"
          icon={Clock}
          badgeText={data.unmatched_actual_intervals === 0 ? 'Full Pairing' : 'Unmatched'}
          badgeType={data.unmatched_actual_intervals === 0 ? 'success' : 'neutral'}
        />
      </div>

      {/* The Two Official Elexon Data Sources Cards */}
      <div className="grid-2-col">
        
        {/* Source 1: FUELHH */}
        <section className="analytical-card" style={{ padding: '22px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '9px',
                backgroundColor: 'var(--brand-mocha-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--brand-mocha)',
                flexShrink: 0,
              }}>
                <Server size={18} />
              </div>
              <div>
                <h2 style={{ fontSize: '1rem', fontFamily: 'var(--font-display)', color: 'var(--text-espresso)' }}>
                  API 1: FUELHH Stream (Actuals)
                </h2>
                <span className="badge badge-neutral" style={{ fontSize: '0.6875rem' }}>
                  Dataset: FUELHH • Half-Hourly Resolution
                </span>
              </div>
            </div>
            <a
              href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream"
              target="_blank"
              rel="noreferrer"
              className="btn-secondary"
              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
            >
              Docs <ExternalLink size={12} />
            </a>
          </div>

          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <p style={{ lineHeight: 1.5 }}>
              Provides half-hourly actual electricity generation by fuel type for Great Britain. The stream returns generation outturn records for all energy technologies.
            </p>
            <div style={{ background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.75) 0%, rgba(240, 235, 248, 0.45) 100%)', border: '1px solid rgba(255, 255, 255, 0.85)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', lineHeight: 1.6, boxShadow: 'inset 0 1px 1px #fff' }}>
              <strong>Endpoint:</strong> <code>https://data.elexon.co.uk/bmrs/api/v1/datasets/FUELHH/stream</code><br/>
              <strong>Filter:</strong> <code>settlementDateFrom=2026-01-01&settlementDateTo=2026-01-31</code><br/>
              <strong>Extraction:</strong> <code>fuelType == 'WIND'</code> (national wind aggregation)
            </div>
          </div>
        </section>

        {/* Source 2: WINDFOR */}
        <section className="analytical-card" style={{ padding: '22px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '9px',
                backgroundColor: 'var(--brand-lavender)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--brand-lavender-accent)',
                flexShrink: 0,
              }}>
                <Server size={18} />
              </div>
              <div>
                <h2 style={{ fontSize: '1rem', fontFamily: 'var(--font-display)', color: 'var(--text-espresso)' }}>
                  API 2: WINDFOR Stream (Forecasts)
                </h2>
                <span className="badge badge-lavender" style={{ fontSize: '0.6875rem' }}>
                  Dataset: WINDFOR • Multi-Horizon Forecasts
                </span>
              </div>
            </div>
            <a
              href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream"
              target="_blank"
              rel="noreferrer"
              className="btn-secondary"
              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
            >
              Docs <ExternalLink size={12} />
            </a>
          </div>

          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <p style={{ lineHeight: 1.5 }}>
              Provides national wind generation forecasts published by National Grid ESO. Contains both publication timestamp (<code>publishTime</code>) and delivery interval start time (<code>startTime</code>).
            </p>
            <div style={{ background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.75) 0%, rgba(240, 235, 248, 0.45) 100%)', border: '1px solid rgba(255, 255, 255, 0.85)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', lineHeight: 1.6, boxShadow: 'inset 0 1px 1px #fff' }}>
              <strong>Endpoint:</strong> <code>https://data.elexon.co.uk/bmrs/api/v1/datasets/WINDFOR/stream</code><br/>
              <strong>Lookback Window:</strong> <code>publishDateTimeFrom=2025-12-28T00:00:00Z</code><br/>
              <strong>Selection Rule:</strong> <code>publishTime &lt;= decision_cutoff</code> (D-1 23:59 GMT)
            </div>
          </div>
        </section>

      </div>

      {/* Methodology Notes */}
      <section className="analytical-card" style={{ padding: '22px 24px' }}>
        <h2 style={{ fontSize: '1.0625rem', fontFamily: 'var(--font-display)', color: 'var(--text-espresso)', marginBottom: '14px' }}>
          Data Engineering & Forecast Selection Methodology
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px' }}>
          {data.methodology_notes.map((note, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                fontSize: '0.8125rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.75) 0%, rgba(245, 242, 250, 0.5) 100%)',
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(255, 255, 255, 0.85)',
                boxShadow: '0 2px 8px rgba(48, 36, 31, 0.02), inset 0 1px 1px #fff',
              }}
            >
              <CheckCircle2 size={16} color="var(--status-green)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>{note}</span>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
};

import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Clock,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  History,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Info,
} from 'lucide-react';
import type { ForecastExplorerResponse, ForecastRecord } from '../types/api';
import { apiService } from '../services/api';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';

export const ForecastExplorerPage: React.FC = () => {
  const [deliveryDate, setDeliveryDate] = useState('2026-01-15');
  const [timeFilter, setTimeFilter] = useState<'all' | 'morning' | 'day' | 'evening'>('all');
  const [data, setData] = useState<ForecastExplorerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Sorting
  const [sortField, setSortField] = useState<keyof ForecastRecord>('delivery_time_uk');
  const [sortAsc, setSortAsc] = useState(true);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 24;

  const loadData = async (date: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.getForecasts(date, 1, 48);
      setData(response);
    } catch (err: any) {
      setError(err.message || 'Failed to load forecast data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(deliveryDate);
    setCurrentPage(1);
  }, [deliveryDate]);

  // Filter records by time-of-day
  const filteredRecords = useMemo(() => {
    if (!data?.records) return [];
    return data.records.filter((rec) => {
      const hour = parseInt(rec.delivery_time_uk.split(' ')[1].split(':')[0], 10);
      if (timeFilter === 'morning') return hour >= 0 && hour < 8;
      if (timeFilter === 'day') return hour >= 8 && hour < 16;
      if (timeFilter === 'evening') return hour >= 16 && hour <= 23;
      return true;
    });
  }, [data?.records, timeFilter]);

  // Sort records
  const sortedRecords = useMemo(() => {
    return [...filteredRecords].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      if (aVal < bVal) return sortAsc ? -1 : 1;
      if (aVal > bVal) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [filteredRecords, sortField, sortAsc]);

  // Paginated records
  const totalPages = Math.ceil(sortedRecords.length / pageSize) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedRecords.slice(start, start + pageSize);
  }, [sortedRecords, currentPage, pageSize]);

  const handleSort = (field: keyof ForecastRecord) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  if (loading) return <LoadingSpinner message={`Inspecting forecast eligibility for ${deliveryDate}...`} />;
  if (error || !data) return <ErrorMessage message={error || 'Unable to display forecasts'} onRetry={() => loadData(deliveryDate)} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', paddingBottom: '48px' }}>
      
      {/* Critical Business Logic Callout Banner */}
      <section className="liquid-glass" style={{ padding: '24px 28px', borderLeft: '4px solid var(--brand-mocha)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '9px',
              background: 'var(--brand-mocha-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--brand-mocha)',
              flexShrink: 0,
            }}
          >
            <Info size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span className="badge badge-mocha" style={{ fontSize: '0.6875rem' }}>Core Rule</span>
              <h2 style={{ fontSize: '1rem', fontFamily: 'var(--font-display)', color: 'var(--text-espresso)' }}>
                Forecast Eligibility & Decision Cutoff Rule
              </h2>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              A forecast published after the decision cutoff is <strong>strictly ineligible</strong> for a day-ahead procurement commitment, regardless of whether it exists in the database.
              Under the reference policy (<code>end_of_preceding_day</code>), only forecasts published on or before <strong>23:59 GMT of the preceding day</strong> are selected to prevent future information leakage.
            </p>
          </div>
        </div>
      </section>

      {/* Liquid-Glass Filter Toolbar */}
      <section
        className="liquid-glass"
        style={{
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        
        {/* Date Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={15} color="var(--brand-mocha)" />
            Delivery Date:
          </label>
          <input
            type="date"
            className="form-input"
            value={deliveryDate}
            min="2026-01-01"
            max="2026-01-31"
            onChange={(e) => setDeliveryDate(e.target.value)}
          />
          <span className="badge badge-lavender" style={{ fontSize: '0.75rem' }}>
            Cutoff: {data.records[0]?.decision_cutoff.split('T')[0]} 23:59 GMT
          </span>
        </div>

        {/* Time-of-Day Filter Segmented Control */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Window:
          </span>
          {(['all', 'morning', 'day', 'evening'] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTimeFilter(t); setCurrentPage(1); }}
              className={timeFilter === t ? 'btn-primary' : 'btn-secondary'}
              style={{
                padding: '5px 12px',
                fontSize: '0.75rem',
                textTransform: 'capitalize',
                background: timeFilter === t ? 'var(--brand-mocha)' : undefined,
              }}
            >
              {t === 'all' ? 'All (48)' : t === 'morning' ? '00:00 - 08:00' : t === 'day' ? '08:00 - 16:00' : '16:00 - 24:00'}
            </button>
          ))}
        </div>

        {/* Publication History Drawer Toggle */}
        <button
          onClick={() => setShowHistory(!showHistory)}
          className={showHistory ? 'btn-primary' : 'btn-secondary'}
          style={{ padding: '6px 14px', fontSize: '0.8125rem' }}
        >
          <History size={15} />
          {showHistory ? 'Hide Publication Log' : `View Revisions (${data.publication_history.length})`}
        </button>
      </section>

      {/* Publication History Drawer (Collapsible) */}
      {showHistory && (
        <section className="analytical-card" style={{ padding: '20px 24px', border: '1px solid rgba(122, 91, 156, 0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <h3 style={{ fontSize: '0.9375rem', fontFamily: 'var(--font-display)', color: 'var(--text-espresso)' }}>
                Chronological WINDFOR Publication Log for {deliveryDate}
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Shows all forecast revisions received from National Grid ESO targeting delivery intervals on this date.
              </p>
            </div>
            <span className="badge badge-lavender" style={{ fontSize: '0.75rem' }}>
              {data.publication_history.length} Revisions Logged
            </span>
          </div>

          <div className="data-table-container" style={{ maxHeight: '280px', overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Published Time (UK GMT)</th>
                  <th>Target Delivery Interval</th>
                  <th style={{ textAlign: 'right' }}>Predicted Generation</th>
                  <th style={{ textAlign: 'center' }}>Lead-Time to Delivery</th>
                </tr>
              </thead>
              <tbody>
                {data.publication_history.slice(0, 100).map((pub, idx) => {
                  const pubD = new Date(pub.publish_time);
                  const delD = new Date(pub.delivery_time);
                  const leadHours = ((delD.getTime() - pubD.getTime()) / (1000 * 3600)).toFixed(1);
                  return (
                    <tr key={idx}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>{pub.publish_time_uk}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>{pub.delivery_time_uk}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }} className="tabular-nums">
                        {pub.generation_mw.toLocaleString()} MW
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="badge badge-neutral" style={{ fontSize: '0.6875rem' }}>
                          {leadHours}h ahead
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Main 30-Minute Interval Table */}
      <section className="analytical-card" style={{ padding: '22px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '1.0625rem', fontFamily: 'var(--font-display)', color: 'var(--text-espresso)' }}>
              Half-Hourly Settlement Delivery Intervals
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Showing {sortedRecords.length} intervals for {deliveryDate}. Sorted by {String(sortField)}.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Page {currentPage} of {totalPages}</span>
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(p => p - 1)}
              className="btn-secondary"
              style={{ padding: '4px 8px', opacity: currentPage <= 1 ? 0.4 : 1 }}
              aria-label="Previous Page"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
              className="btn-secondary"
              style={{ padding: '4px 8px', opacity: currentPage >= totalPages ? 0.4 : 1 }}
              aria-label="Next Page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('delivery_time_uk')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Delivery Time (UK) <ArrowUpDown size={12} />
                  </div>
                </th>
                <th>Decision Cutoff</th>
                <th>Forecast Published</th>
                <th style={{ textAlign: 'center' }}>Forecast Lead</th>
                <th onClick={() => handleSort('forecast_mw')} style={{ cursor: 'pointer', textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                    Forecast MW <ArrowUpDown size={12} />
                  </div>
                </th>
                <th onClick={() => handleSort('actual_mw')} style={{ cursor: 'pointer', textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                    Actual MW <ArrowUpDown size={12} />
                  </div>
                </th>
                <th onClick={() => handleSort('error_mw')} style={{ cursor: 'pointer', textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                    Error (F − A) <ArrowUpDown size={12} />
                  </div>
                </th>
                <th onClick={() => handleSort('absolute_error_mw')} style={{ cursor: 'pointer', textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                    Absolute Error <ArrowUpDown size={12} />
                  </div>
                </th>
                <th style={{ textAlign: 'center' }}>Eligibility</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRecords.map((row, idx) => {
                const isOver = (row.error_mw ?? 0) > 0;
                const isUnder = (row.error_mw ?? 0) < 0;
                return (
                  <tr key={idx}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.8125rem' }}>
                      {row.delivery_time_uk}
                    </td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {row.decision_cutoff.split('T')[0]} 23:59
                    </td>
                    <td style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                      {row.forecast_publish_time ? (
                        <span>{row.forecast_publish_time.replace('T', ' ').slice(0, 16)}</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>None prior to cutoff</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {row.forecast_age_hours !== null && row.forecast_age_hours !== undefined ? (
                        <span className="badge badge-neutral" style={{ fontSize: '0.6875rem' }}>
                          {row.forecast_age_hours}h lead
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--brand-mocha)' }} className="tabular-nums">
                      {row.forecast_mw !== null && row.forecast_mw !== undefined ? `${row.forecast_mw.toLocaleString()} MW` : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-espresso)' }} className="tabular-nums">
                      {row.actual_mw !== null && row.actual_mw !== undefined ? `${row.actual_mw.toLocaleString()} MW` : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: isOver ? 'var(--status-amber)' : isUnder ? 'var(--status-red)' : 'var(--text-muted)' }} className="tabular-nums">
                      {row.error_mw !== null && row.error_mw !== undefined ? (
                        `${isOver ? '+' : ''}${row.error_mw.toLocaleString()} MW`
                      ) : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }} className="tabular-nums">
                      {row.absolute_error_mw !== null && row.absolute_error_mw !== undefined ? `${row.absolute_error_mw.toLocaleString()} MW` : '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {row.is_eligible ? (
                        <span className="badge badge-success" style={{ fontSize: '0.6875rem' }} title="Published prior to decision cutoff">
                          <CheckCircle2 size={11} /> Eligible
                        </span>
                      ) : (
                        <span className="badge badge-danger" style={{ fontSize: '0.6875rem' }} title="No forecast available before cutoff">
                          <XCircle size={11} /> Ineligible
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Showing {paginatedRecords.length} of {sortedRecords.length} records
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(p => p - 1)}
              className="btn-secondary"
              style={{ opacity: currentPage <= 1 ? 0.4 : 1 }}
            >
              Previous
            </button>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, padding: '0 4px' }} className="tabular-nums">
              Page {currentPage} of {totalPages}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
              className="btn-secondary"
              style={{ opacity: currentPage >= totalPages ? 0.4 : 1 }}
            >
              Next
            </button>
          </div>
        </div>
      </section>

    </div>
  );
};

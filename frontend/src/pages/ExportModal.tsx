import React, { useState } from 'react';
import { X, Download, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import { apiService } from '../services/api';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose }) => {
  const [startDate, setStartDate] = useState('2026-01-01');
  const [endDate, setEndDate] = useState('2026-01-31');

  if (!isOpen) return null;

  const handleDownload = () => {
    const url = apiService.getExportUrl(startDate, endDate);
    window.open(url, '_blank');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="liquid-glass"
        style={{
          width: '100%',
          maxWidth: '520px',
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          padding: '24px 28px',
          boxShadow: '0 24px 60px -12px rgba(48, 36, 31, 0.22)',
          border: '1px solid rgba(229, 228, 226, 0.95)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'var(--brand-mocha-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--brand-mocha)',
              flexShrink: 0,
            }}>
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.125rem', fontFamily: 'var(--font-display)', color: 'var(--text-espresso)' }}>
                Export Analysis Dataset
              </h2>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                Download validated 30-min forecast & actual pairs
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(244, 243, 241, 0.8)',
              border: '1px solid var(--brand-platinum)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all var(--transition-fast)',
            }}
            aria-label="Close export modal"
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', margin: '20px 0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Start Date
              </label>
              <input
                type="date"
                className="form-input"
                style={{ width: '100%' }}
                value={startDate}
                min="2026-01-01"
                max="2026-01-31"
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                End Date
              </label>
              <input
                type="date"
                className="form-input"
                style={{ width: '100%' }}
                value={endDate}
                min="2026-01-01"
                max="2026-01-31"
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div style={{ background: 'rgba(244, 243, 241, 0.75)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--brand-platinum)' }}>
            <h3 style={{ fontSize: '0.8125rem', color: 'var(--text-espresso)', marginBottom: '8px' }}>
              Exported Fields Included:
            </h3>
            <ul style={{ listStyle: 'none', fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={13} color="var(--status-green)" /> Delivery Time (UTC & UK)</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={13} color="var(--status-green)" /> Decision Cutoff (UTC)</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={13} color="var(--status-green)" /> Forecast Published (UTC)</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={13} color="var(--status-green)" /> Forecast MW & Actual MW</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={13} color="var(--status-green)" /> Error & Absolute Error MW</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={13} color="var(--status-green)" /> Eligibility & Lead-Time Age</li>
            </ul>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button onClick={handleDownload} className="btn-primary">
            <Download size={15} />
            Download CSV
          </button>
        </div>
      </div>
    </div>
  );
};

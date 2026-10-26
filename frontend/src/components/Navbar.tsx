import React from 'react';
import { Wind, BarChart3, Search, ShieldCheck, Download, Calendar, Clock } from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenExport: () => void;
  lastFetchTime?: string | null;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  onOpenExport,
}) => {
  return (
    <header className="navbar-glass">
      <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '12px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          
          {/* Logo & Product Identity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '11px',
                backgroundColor: 'var(--brand-mocha)',
                backgroundImage: 'linear-gradient(135deg, #7E593F 0%, #5A3F2C 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                boxShadow: '0 3px 10px rgba(111, 78, 55, 0.28), inset 0 1px 1px rgba(255, 255, 255, 0.35)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                flexShrink: 0,
              }}
            >
              <Wind size={20} color="#FAF8F5" strokeWidth={2.2} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: '1.25rem',
                    letterSpacing: '0.03em',
                    color: 'var(--text-espresso)',
                    lineHeight: 1.2,
                  }}
                >
                  WINDLENS
                </span>
                <span className="badge badge-lavender" style={{ fontSize: '0.6875rem', padding: '2px 7px' }}>
                  UK BMRS
                </span>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '-0.01em' }}>
                UK Wind Forecast Intelligence • Wholesale Day-Ahead Procurement
              </p>
            </div>
          </div>

          {/* Navigation Glass Segmented Control */}
          <nav
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: 'rgba(235, 233, 230, 0.65)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              padding: '4px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(229, 228, 226, 0.9)',
              boxShadow: '0 1px 3px rgba(48, 36, 31, 0.03) inset',
            }}
          >
            <button
              id="tab-overview"
              onClick={() => onSelectTab('overview')}
              className={`nav-tab ${currentTab === 'overview' ? 'active' : ''}`}
            >
              <BarChart3 size={15} />
              Overview
            </button>
            <button
              id="tab-explorer"
              onClick={() => onSelectTab('explorer')}
              className={`nav-tab ${currentTab === 'explorer' ? 'active' : ''}`}
            >
              <Search size={15} />
              Forecast Explorer
            </button>
            <button
              id="tab-accuracy"
              onClick={() => onSelectTab('accuracy')}
              className={`nav-tab ${currentTab === 'accuracy' ? 'active' : ''}`}
            >
              <BarChart3 size={15} />
              Accuracy Analytics
            </button>
            <button
              id="tab-data-quality"
              onClick={() => onSelectTab('data-quality')}
              className={`nav-tab ${currentTab === 'data-quality' ? 'active' : ''}`}
            >
              <ShieldCheck size={15} />
              Data Quality & Sources
            </button>
          </nav>

          {/* Context Badges & Primary Action */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 11px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(255, 255, 255, 0.8)',
                border: '1px solid var(--brand-platinum)',
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                boxShadow: '0 1px 2px rgba(48, 36, 31, 0.02)',
              }}
            >
              <Calendar size={13} color="var(--brand-mocha)" />
              <span style={{ fontWeight: 600 }}>Jan 2026 Baseline</span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 11px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(255, 255, 255, 0.8)',
                border: '1px solid var(--brand-platinum)',
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                boxShadow: '0 1px 2px rgba(48, 36, 31, 0.02)',
              }}
            >
              <Clock size={13} color="var(--brand-mocha)" />
              <span style={{ fontWeight: 500 }}>Cutoff: D-1 23:59 GMT</span>
            </div>

            <button
              id="btn-export-csv"
              onClick={onOpenExport}
              className="btn-primary"
              title="Export analysis results as CSV"
            >
              <Download size={14} />
              Export CSV
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};

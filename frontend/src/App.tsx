import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { OverviewPage } from './pages/OverviewPage';
import { ForecastExplorerPage } from './pages/ForecastExplorerPage';
import { AccuracyPage } from './pages/AccuracyPage';
import { DataQualityPage } from './pages/DataQualityPage';
import { ExportModal } from './pages/ExportModal';
import { ExternalLink, ShieldCheck } from 'lucide-react';

export const App: React.FC = () => {
  const getTabFromHash = (): 'overview' | 'explorer' | 'accuracy' | 'data-quality' => {
    const hash = window.location.hash.replace('#', '');
    if (hash === 'explorer' || hash === 'accuracy' || hash === 'data-quality') {
      return hash;
    }
    return 'overview';
  };

  const [currentTab, setCurrentTab] = useState<'overview' | 'explorer' | 'accuracy' | 'data-quality'>(getTabFromHash);
  const [isExportOpen, setIsExportOpen] = useState(false);

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentTab(getTabFromHash());
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleSelectTab = (tab: string) => {
    setCurrentTab(tab as any);
    window.location.hash = tab;
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Ambient Liquid Light Canvas (Refracting Fluid Orbs behind glass) */}
      <div className="liquid-canvas-bg" aria-hidden="true">
        <div className="liquid-orb liquid-orb-1" />
        <div className="liquid-orb liquid-orb-2" />
        <div className="liquid-orb liquid-orb-3" />
        <div className="liquid-orb liquid-orb-4" />
      </div>

      {/* Top Glass Navigation */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        onOpenExport={() => setIsExportOpen(true)}
      />

      {/* Main Content Viewport */}
      <main style={{ flex: 1, maxWidth: '1440px', width: '100%', margin: '0 auto', padding: '24px', position: 'relative', zIndex: 1 }}>
        {currentTab === 'overview' && <OverviewPage />}
        {currentTab === 'explorer' && <ForecastExplorerPage />}
        {currentTab === 'accuracy' && <AccuracyPage />}
        {currentTab === 'data-quality' && <DataQualityPage />}
      </main>

      {/* Export CSV Modal */}
      <ExportModal isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} />

      {/* Editorial Footer */}
      <footer style={{
        background: 'rgba(250, 248, 245, 0.75)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.8)',
        boxShadow: '0 -4px 20px rgba(48, 36, 31, 0.03)',
        padding: '24px',
        marginTop: 'auto',
        position: 'relative',
        zIndex: 1,
      }}>
        <div style={{
          maxWidth: '1440px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          fontSize: '0.8125rem',
          color: 'var(--text-secondary)',
        }}>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-espresso)' }}>
              WINDLENS — UK Wind Forecast Intelligence Portal
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Decision-support and historical forecast evaluation platform for wholesale electricity day-ahead procurement.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <a
              href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream"
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              Elexon FUELHH API <ExternalLink size={12} />
            </a>
            <a
              href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream"
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              Elexon WINDFOR API <ExternalLink size={12} />
            </a>
            <span style={{ color: 'var(--brand-mocha)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ShieldCheck size={14} /> Production MVP
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;

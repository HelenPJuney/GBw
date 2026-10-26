import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  icon: LucideIcon;
  badgeText?: string;
  badgeType?: 'success' | 'warning' | 'danger' | 'neutral' | 'lavender' | 'mocha';
  highlightColor?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  unit,
  subtitle,
  icon: Icon,
  badgeText,
  badgeType = 'neutral',
  highlightColor = 'var(--brand-mocha)',
}) => {
  return (
    <div
      className="liquid-glass liquid-glass-interactive"
      style={{
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: '144px',
        position: 'relative',
        borderRadius: 'var(--radius-lg)',
      }}
    >
      {/* Top Row: Eyebrow Category & Status Badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontSize: '0.71875rem',
            fontWeight: 700,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            lineHeight: 1.2,
          }}
        >
          {title}
        </span>
        {badgeText && (
          <span
            className={`badge badge-${badgeType}`}
            style={{
              fontSize: '0.6875rem',
              padding: '2px 8px',
              fontWeight: 600,
              lineHeight: 1.3,
              flexShrink: 0,
            }}
          >
            {badgeText}
          </span>
        )}
      </div>

      {/* Middle Row: Prominent Numerical Metric Value & Unit */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', margin: '8px 0 6px 0' }}>
        <span
          className="tabular-nums"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1.45rem, 1.8vw, 1.75rem)',
            fontWeight: 700,
            color: 'var(--text-espresso)',
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
          }}
        >
          {value !== null && value !== undefined ? value : '—'}
        </span>
        {unit && (
          <span
            style={{
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-sans)',
            }}
          >
            {unit}
          </span>
        )}
      </div>

      {/* Bottom Row: Full-Width Explanatory Subtitle with Micro-Icon (Never Truncated) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '7px',
          paddingTop: '8px',
          borderTop: '1px solid rgba(229, 228, 226, 0.65)',
          marginTop: 'auto',
        }}
      >
        <div
          style={{
            width: '20px',
            height: '20px',
            borderRadius: '5px',
            backgroundColor: 'var(--brand-mocha-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: highlightColor,
            flexShrink: 0,
            marginTop: '1px',
          }}
        >
          <Icon size={12} strokeWidth={2.4} />
        </div>
        <span
          style={{
            fontSize: '0.75rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.35,
            whiteSpace: 'normal',
            wordBreak: 'break-word',
          }}
          title={subtitle}
        >
          {subtitle || ''}
        </span>
      </div>
    </div>
  );
};

import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, onRetry }) => {
  return (
    <div className="liquid-glass" style={{ padding: '24px', margin: '24px 0', borderLeft: '4px solid var(--status-red)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
        <AlertCircle size={22} color="var(--status-red)" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div style={{ flex: 1 }}>
          <h4 style={{ color: 'var(--status-red)', marginBottom: '4px' }}>
            Data Retrieval Warning
          </h4>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: onRetry ? '12px' : '0' }}>
            {message}
          </p>
          {onRetry && (
            <button onClick={onRetry} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8125rem' }}>
              <RefreshCw size={14} />
              Retry Request
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

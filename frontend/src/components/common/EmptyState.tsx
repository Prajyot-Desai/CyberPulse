import React from 'react';
import { ShieldAlert } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  hint?: string;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = <ShieldAlert size={36} color="var(--accent-orange)" />,
  title,
  description,
  action,
  hint,
  className = '',
}) => {
  return (
    <div
      className={`empty-state ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '36px 20px',
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        border: '1px dashed var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        minHeight: '220px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: 'rgba(255, 255, 255, 0.04)',
          marginBottom: '14px',
        }}
        aria-hidden="true"
      >
        {icon}
      </div>

      <h4
        style={{
          fontSize: '15px',
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: '6px',
        }}
      >
        {title}
      </h4>

      <p
        style={{
          fontSize: '13px',
          color: 'var(--text-secondary)',
          maxWidth: '460px',
          lineHeight: '1.5',
          marginBottom: hint || action ? '16px' : '0',
        }}
      >
        {description}
      </p>

      {hint && (
        <code
          style={{
            display: 'inline-block',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            color: 'var(--accent-cyan)',
            padding: '4px 10px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid rgba(0, 229, 255, 0.2)',
            marginBottom: action ? '14px' : '0',
          }}
        >
          {hint}
        </code>
      )}

      {action && <div>{action}</div>}
    </div>
  );
};

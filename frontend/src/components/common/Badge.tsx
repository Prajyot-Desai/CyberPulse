import React from 'react';

export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'orange';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  pulse?: boolean;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  pulse = false,
  className = '',
}) => {
  const variantStyles: Record<BadgeVariant, { bg: string; text: string; border: string; pulseClass: string }> = {
    success: {
      bg: 'var(--accent-green-muted)',
      text: 'var(--accent-green)',
      border: 'rgba(0, 230, 118, 0.3)',
      pulseClass: 'pulse-green',
    },
    warning: {
      bg: 'var(--accent-amber-muted)',
      text: 'var(--accent-amber)',
      border: 'rgba(255, 171, 0, 0.3)',
      pulseClass: 'pulse-amber',
    },
    error: {
      bg: 'var(--accent-red-muted)',
      text: 'var(--accent-red)',
      border: 'rgba(255, 51, 68, 0.3)',
      pulseClass: 'pulse-red',
    },
    info: {
      bg: 'var(--accent-cyan-muted)',
      text: 'var(--accent-cyan)',
      border: 'rgba(0, 229, 255, 0.3)',
      pulseClass: 'pulse-cyan',
    },
    orange: {
      bg: 'var(--accent-orange-muted)',
      text: 'var(--accent-orange)',
      border: 'rgba(255, 94, 0, 0.3)',
      pulseClass: 'pulse-amber',
    },
    neutral: {
      bg: 'rgba(255, 255, 255, 0.06)',
      text: 'var(--text-secondary)',
      border: 'var(--border-subtle)',
      pulseClass: '',
    },
  };

  const style = variantStyles[variant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '3px 10px',
        borderRadius: 'var(--radius-full)',
        backgroundColor: style.bg,
        color: style.text,
        border: `1px solid ${style.border}`,
        fontSize: '11px',
        fontFamily: 'var(--font-mono)',
        letterSpacing: '0.03em',
        textTransform: 'uppercase',
      }}
    >
      {pulse && <span className={`pulse-indicator ${style.pulseClass}`} aria-hidden="true" />}
      {children}
    </span>
  );
};

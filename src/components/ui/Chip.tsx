import React from 'react';

const TONES = {
  neutral: 'bg-surface-container text-on-surface-variant',
  primary: 'bg-primary-fixed text-on-primary-fixed-variant',
  secondary: 'bg-secondary-fixed text-on-secondary-fixed',
  accent: 'bg-tertiary-fixed text-on-tertiary-fixed',
} as const;

interface ChipProps {
  tone?: keyof typeof TONES;
  icon?: string;
  className?: string;
  children: React.ReactNode;
}

/** Petite étiquette (langue, ton, statut). */
export const Chip: React.FC<ChipProps> = ({ tone = 'neutral', icon, className = '', children }) => (
  <span
    className={`${TONES[tone]} inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap ${className}`}
  >
    {icon && <span className="material-symbols-outlined text-[13px]">{icon}</span>}
    {children}
  </span>
);

import React from 'react';

const VARIANTS = {
  primary: 'bg-primary-container text-white shadow-raised hover:bg-primary',
  secondary: 'bg-surface-container text-on-surface hover:bg-surface-container-high',
  accent: 'bg-tertiary-fixed text-on-tertiary-fixed hover:bg-tertiary-fixed-dim',
  ghost: 'text-primary-container hover:bg-tertiary-fixed-faint',
} as const;

const SIZES = {
  sm: 'h-9 px-4 text-xs gap-1.5',
  md: 'h-11 px-5 text-sm gap-2',
  lg: 'h-14 px-6 text-base gap-2',
} as const;

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  /** Icône Material Symbols affichée avant le texte. */
  icon?: string;
  fullWidth?: boolean;
}

/** Bouton texte de l'app, en pilule. */
export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  icon,
  fullWidth = false,
  className = '',
  type = 'button',
  children,
  ...rest
}) => (
  <button
    type={type}
    className={`${VARIANTS[variant]} ${SIZES[size]} ${
      fullWidth ? 'w-full' : ''
    } rounded-full font-bold inline-flex items-center justify-center active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
    {...rest}
  >
    {icon && (
      <span className="material-symbols-outlined text-[1.25em]" aria-hidden="true">
        {icon}
      </span>
    )}
    {children}
  </button>
);

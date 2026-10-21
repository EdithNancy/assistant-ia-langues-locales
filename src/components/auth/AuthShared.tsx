import React, { useState } from 'react';
import { BRAND_ASSETS } from '../../data/mockData';

interface AuthHeaderProps {
  title: string;
  onBack?: () => void;
}

export const AuthHeader: React.FC<AuthHeaderProps> = ({ title, onBack }) => (
  <header className="sticky top-0 z-40 w-full bg-[#f9f9fb]/90 backdrop-blur-xl shadow-[0_1px_12px_rgba(0,51,49,0.04)]">
    <div className="h-16 px-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          aria-label="Retour"
          className="w-9 h-9 flex items-center justify-center rounded-full text-[#1a1c1d] hover:bg-[#edeef0] active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-[24px]">arrow_back</span>
        </button>
        <img src={BRAND_ASSETS.logo} alt="Logo IvoirAI" className="h-9 w-9 rounded-xl object-contain" />
        <span className="hidden min-[360px]:inline text-xl font-semibold text-[#1a1c1d] tracking-tight">IvoirAI</span>
      </div>

      <span className="text-[15px] sm:text-[17px] font-medium text-[#3f4948]">{title}</span>

      <div className="w-10 h-10 rounded-full bg-[#003331] flex items-center justify-center text-white">
        <span className="material-symbols-outlined text-[20px]">person</span>
      </div>
    </div>
  </header>
);

/** Formats up to 10 Ivorian digits as "07 01 23 45 67". */
export const formatIvorianPhone = (raw: string) =>
  raw
    .replace(/\D/g, '')
    .slice(0, 10)
    .replace(/(\d{2})(?=\d)/g, '$1 ');

export const phoneDigits = (formatted: string) => formatted.replace(/\D/g, '');

interface PasswordFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
}

export const PasswordField: React.FC<PasswordFieldProps> = ({
  value,
  onChange,
  placeholder = '••••••••••••',
  autoComplete = 'current-password',
}) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="h-14 rounded-2xl bg-[#f3f3f5] flex items-center gap-3 px-4 focus-within:ring-2 focus-within:ring-[#004b49]/30 transition-all">
      <span className="material-symbols-outlined text-[22px] text-[#3f4948]">lock</span>
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="flex-1 min-w-0 bg-transparent outline-none text-[15px] text-[#1a1c1d] placeholder:text-[#bfc8c7] tracking-widest"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        className="text-[#3f4948] hover:text-[#003331] transition-colors"
      >
        <span className="material-symbols-outlined text-[22px]">
          {visible ? 'visibility_off' : 'visibility'}
        </span>
      </button>
    </div>
  );
};

export const OrDivider: React.FC<{ label: string; className?: string }> = ({ label, className = '' }) => (
  <div className={`flex items-center gap-4 ${className}`}>
    <span className="flex-1 h-px bg-[#e2e2e4]" />
    <span className="text-xs font-semibold text-[#3f4948] tracking-wide">{label}</span>
    <span className="flex-1 h-px bg-[#e2e2e4]" />
  </div>
);

export const GoogleIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

export const AppleIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M16.37 12.6c-.02-2.3 1.88-3.4 1.97-3.46-1.07-1.57-2.74-1.78-3.33-1.8-1.42-.14-2.77.83-3.49.83-.72 0-1.83-.81-3.01-.79-1.55.02-2.98.9-3.78 2.29-1.61 2.8-.41 6.94 1.16 9.21.77 1.11 1.68 2.36 2.88 2.31 1.16-.05 1.59-.75 2.99-.75 1.4 0 1.79.75 3.01.72 1.24-.02 2.03-1.13 2.79-2.25.88-1.29 1.24-2.54 1.26-2.6-.03-.01-2.42-.93-2.45-3.7zM14.08 5.84c.64-.77 1.07-1.85.95-2.92-.92.04-2.03.61-2.69 1.38-.59.68-1.11 1.78-.97 2.83 1.02.08 2.07-.52 2.71-1.29z" />
  </svg>
);

/** Small inline error message used by both auth forms. */
export const FormError: React.FC<{ message: string | null }> = ({ message }) =>
  message ? (
    <p className="flex items-center gap-1.5 text-[13px] font-medium text-[#ba1a1a]">
      <span className="material-symbols-outlined text-[18px]">error</span>
      {message}
    </p>
  ) : null;

/** Pastille des méthodes de connexion pas encore disponibles. */
export const ComingSoonBadge: React.FC = () => (
  <span className="absolute -top-2 right-3 px-2 py-0.5 rounded-full bg-[#ffdbd2] text-[#9e4229] text-xs font-bold">
    Bientôt
  </span>
);

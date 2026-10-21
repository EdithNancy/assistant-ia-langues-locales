import React from 'react';
import { Language } from '../types';

export interface LanguageOption {
  key: Language;
  label: string;
  /** Précision affichée en plus léger, ex. « (Akan) ». */
  hint?: string;
}

interface LanguageToggleProps {
  value: Language;
  onChange: (language: Language) => void;
  options: readonly LanguageOption[];
  className?: string;
  /** Couleur de la pastille des options non sélectionnées. */
  inactiveDotClassName?: string;
}

/** Sélecteur segmenté Baoulé / Dioula partagé par l'accueil et l'atelier. */
export const LanguageToggle: React.FC<LanguageToggleProps> = ({
  value,
  onChange,
  options,
  className = '',
  inactiveDotClassName = 'bg-transparent',
}) => (
  <div
    role="radiogroup"
    aria-label="Langue d'apprentissage"
    className={`bg-surface-container p-1 rounded-full flex items-center shadow-inner ${className}`}
  >
    {options.map(({ key, label, hint }) => {
      const selected = value === key;
      return (
        <button
          key={key}
          role="radio"
          aria-checked={selected}
          onClick={() => onChange(key)}
          className={`flex-1 min-w-0 py-2 px-3 rounded-full text-xs font-bold transition-all duration-300 flex items-center justify-center gap-1.5 ${
            selected ? 'bg-primary-container text-white shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${selected ? 'bg-tertiary-fixed' : inactiveDotClassName}`}
          ></span>
          <span className="truncate">
            {label}
            {hint && <span className="font-normal opacity-80 text-[11px]"> {hint}</span>}
          </span>
        </button>
      );
    })}
  </div>
);

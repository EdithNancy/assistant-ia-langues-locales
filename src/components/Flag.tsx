import React from 'react';

export type FlagCountry = 'ci' | 'fr';

/** Bandes verticales de chaque drapeau, de gauche à droite. */
const STRIPES: Record<FlagCountry, readonly [string, string, string]> = {
  ci: ['#F77F00', '#FFFFFF', '#009E60'],
  fr: ['#002395', '#FFFFFF', '#ED2939'],
};

const LABEL: Record<FlagCountry, string> = {
  ci: "Côte d'Ivoire",
  fr: 'France',
};

interface FlagProps {
  country: FlagCountry;
  /** Largeur via Tailwind (ex. `w-5`) ; la hauteur suit le ratio 3:2. */
  className?: string;
  /** Décoratif par défaut ; passer `true` si le drapeau est la seule indication. */
  labelled?: boolean;
}

/** Drapeau dessiné en SVG : identique sur tous les systèmes (les emojis drapeaux ne s'affichent pas sous Windows). */
export const Flag: React.FC<FlagProps> = ({ country, className = 'w-5', labelled = false }) => (
  <svg
    viewBox="0 0 3 2"
    className={`shrink-0 rounded-[3px] ring-1 ring-black/10 ${className}`}
    role={labelled ? 'img' : undefined}
    aria-label={labelled ? LABEL[country] : undefined}
    aria-hidden={labelled ? undefined : true}
  >
    {STRIPES[country].map((color, i) => (
      <rect key={i} x={i} width="1" height="2" fill={color} />
    ))}
  </svg>
);

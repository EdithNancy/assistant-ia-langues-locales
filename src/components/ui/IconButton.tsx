import React from 'react';

const SIZES = {
  sm: 'w-8 h-8',
  md: 'w-9 h-9',
  lg: 'w-10 h-10',
  xl: 'w-11 h-11',
} as const;

interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Nom de l'icône Material Symbols (à déclarer dans index.html). */
  icon: string;
  size?: keyof typeof SIZES;
  /** Taille de l'icône, ex. `text-[18px]`. */
  iconClassName?: string;
}

/** Bouton rond ne contenant qu'une icône. Toujours lui donner un nom (`aria-label` ou `title`). */
export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  size = 'md',
  iconClassName = 'text-[18px]',
  className = '',
  type = 'button',
  ...rest
}) => (
  <button
    type={type}
    className={`${SIZES[size]} rounded-full flex items-center justify-center shrink-0 transition-all ${className}`}
    {...rest}
  >
    <span className={`material-symbols-outlined ${iconClassName}`}>{icon}</span>
  </button>
);

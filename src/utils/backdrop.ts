import type { MouseEvent } from 'react';

/**
 * Ferme une fenêtre quand on clique sur son fond (et pas sur son contenu).
 * Au clavier, la fermeture passe par Échap (hook useEscapeKey).
 */
export const closeOnBackdrop =
  (close: () => void) =>
  (event: MouseEvent<HTMLElement>) => {
    if (event.target === event.currentTarget) close();
  };

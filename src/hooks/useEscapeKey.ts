import { useEffect, useRef } from 'react';

/** Appelle `onEscape` quand l'utilisateur appuie sur Échap, tant que `active` est vrai. */
export const useEscapeKey = (active: boolean, onEscape: () => void) => {
  const callbackRef = useRef(onEscape);
  callbackRef.current = onEscape;

  useEffect(() => {
    if (!active) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') callbackRef.current();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [active]);
};

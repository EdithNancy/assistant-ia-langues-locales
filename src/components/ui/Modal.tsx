import React, { useEffect, useRef } from 'react';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { closeOnBackdrop } from '../../utils/backdrop';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface ModalProps {
  onClose: () => void;
  children: React.ReactNode;
  /** Classes du panneau (taille, fond, arrondi, espacements). */
  className?: string;
  /** Classes du fond (position du panneau : centré, en bas…). */
  overlayClassName?: string;
  /** `false` : un clic sur le fond ne ferme pas (choix importants comme un consentement). */
  dismissOnBackdrop?: boolean;
  'aria-labelledby'?: string;
  'aria-label'?: string;
}

const DEFAULT_OVERLAY =
  'fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in';

/**
 * Fenêtre de dialogue de l'app : fond cliquable, Échap, focus placé puis gardé dans la fenêtre
 * puis rendu à l'élément d'origine, défilement de la page bloqué.
 * Monter le composant l'ouvre ; le démonter le ferme.
 */
export const Modal: React.FC<ModalProps> = ({
  onClose,
  children,
  className = '',
  overlayClassName = DEFAULT_OVERLAY,
  dismissOnBackdrop = true,
  ...aria
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  useEscapeKey(true, onClose);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    // Focus sur la fenêtre elle-même : annoncée par les lecteurs d'écran, sans anneau sur un bouton
    panel?.focus();

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    // Tab et Maj+Tab tournent à l'intérieur de la fenêtre
    const trapTab = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !panel) return;
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (document.activeElement === panel) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', trapTab);

    return () => {
      window.removeEventListener('keydown', trapTab);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  return (
    <div
      onClick={dismissOnBackdrop ? closeOnBackdrop(onClose) : undefined}
      role="presentation"
      className={overlayClassName}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={`outline-none ${className}`}
        {...aria}
      >
        {children}
      </div>
    </div>
  );
};

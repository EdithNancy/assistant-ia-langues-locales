import React, { useCallback, useEffect, useRef, useState } from 'react';

/** Couleurs de la marque pour les confettis. */
const COLORS = ['#62fae3', '#3cddc7', '#fe8b6d', '#9e4229', '#ffdbd2', '#004b49', '#F77F00'];
const PIECES = 36;
const DURATION_MS = 2600;

interface Piece {
  id: number;
  left: number;
  drift: number;
  delay: number;
  duration: number;
  rotate: number;
  color: string;
  round: boolean;
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Petite célébration (confettis aux couleurs de la marque) pour les réussites :
 * quiz terminé, série de jours… Ignorée si l'utilisateur demande moins d'animations.
 * Renvoie `celebrate()` à appeler sur l'événement, et `confetti` à placer dans le rendu.
 */
export const useCelebration = () => {
  const [pieces, setPieces] = useState<Piece[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const celebrate = useCallback(() => {
    if (prefersReducedMotion()) return;
    const seed = Date.now();
    setPieces(
      Array.from({ length: PIECES }, (_, i) => ({
        id: seed + i,
        left: Math.random() * 100,
        drift: (Math.random() - 0.5) * 40,
        delay: Math.random() * 0.35,
        duration: 1.6 + Math.random() * 0.9,
        rotate: Math.random() * 360,
        color: COLORS[i % COLORS.length],
        round: i % 3 === 0,
      }))
    );
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setPieces([]), DURATION_MS + 400);
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  const confetti =
    pieces.length > 0 ? (
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[70] overflow-hidden">
        {pieces.map((p) => (
          <span
            key={p.id}
            className={`confetti-piece ${p.round ? 'rounded-full' : 'rounded-[2px]'}`}
            style={
              {
                left: `${p.left}%`,
                background: p.color,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
                '--confetti-drift': `${p.drift}vw`,
                '--confetti-rotate': `${p.rotate}deg`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
    ) : null;

  return { celebrate, confetti };
};

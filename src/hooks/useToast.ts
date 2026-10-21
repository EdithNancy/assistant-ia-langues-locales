import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Message éphémère. Un nouveau message remplace le précédent et repart pour toute la durée
 * (l'ancien minuteur ne l'efface plus trop tôt).
 */
export const useToast = (durationMs = 2500) => {
  const [toast, setToast] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback(
    (message: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setToast(message);
      timerRef.current = setTimeout(() => setToast(null), durationMs);
    },
    [durationMs]
  );

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  return { toast, showToast };
};

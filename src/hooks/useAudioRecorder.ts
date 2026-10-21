import { useCallback, useEffect, useRef, useState } from 'react';

export type RecorderStatus = 'idle' | 'recording';
export type RecorderError = 'permission' | 'unsupported' | 'no-microphone' | null;

const MAX_DURATION_MS = 30_000;

/**
 * Enregistre la voix avec MediaRecorder.
 * `start()` demande l'accès au micro ; `stop()` renvoie l'audio enregistré (ou `null`).
 * `level` (0 à 1) suit le volume en direct pour l'animer à l'écran.
 */
export const useAudioRecorder = () => {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [error, setError] = useState<RecorderError>(null);
  const [level, setLevel] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const frameRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resolveStopRef = useRef<((blob: Blob | null) => void) | null>(null);

  const cleanup = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    frameRef.current = null;
    timeoutRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => undefined);
    audioCtxRef.current = null;
    setLevel(0);
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const trackLevel = (stream: MediaStream) => {
    try {
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(analyser);
      audioCtxRef.current = ctx;
      const data = new Uint8Array(analyser.fftSize);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const v of data) sum += ((v - 128) / 128) ** 2;
        setLevel(Math.min(1, Math.sqrt(sum / data.length) * 4));
        frameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // Le niveau est décoratif : l'enregistrement continue sans
    }
  };

  const stop = useCallback((): Promise<Blob | null> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') return Promise.resolve(null);
    return new Promise((resolve) => {
      resolveStopRef.current = resolve;
      recorder.stop();
    });
  }, []);

  const start = useCallback(async (): Promise<boolean> => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('unsupported');
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = chunksRef.current.length
          ? new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
          : null;
        cleanup();
        setStatus('idle');
        resolveStopRef.current?.(blob);
        resolveStopRef.current = null;
      };
      recorderRef.current = recorder;
      recorder.start();
      trackLevel(stream);
      timeoutRef.current = setTimeout(() => void stop(), MAX_DURATION_MS);
      setStatus('recording');
      return true;
    } catch (err) {
      cleanup();
      const name = err instanceof DOMException ? err.name : '';
      setError(name === 'NotFoundError' ? 'no-microphone' : 'permission');
      return false;
    }
  }, [cleanup, stop]);

  return { status, error, level, start, stop };
};

/** Message à afficher pour chaque erreur du micro. */
export const recorderErrorMessage: Record<Exclude<RecorderError, null>, string> = {
  permission: "Accès au micro refusé. Autorisez-le dans les réglages du navigateur.",
  unsupported: "Ce navigateur ne permet pas l'enregistrement vocal.",
  'no-microphone': 'Aucun micro détecté sur cet appareil.',
};

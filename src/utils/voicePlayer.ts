import { api, isMockApi, TextLanguage } from '../services';
import { soundEngine } from './audio';

/**
 * Lecteur de voix unique pour toute l'app.
 * Demande l'audio au modèle TTS (api.synthesize) ; si aucun audio n'est disponible,
 * il se rabat sur la voix du navigateur (française, donc approximative pour le Baoulé et le Dioula).
 * Un seul son à la fois : lancer une lecture arrête la précédente.
 */
class VoicePlayer {
  private audio: HTMLAudioElement | null = null;
  private objectUrl: string | null = null;
  private token = 0;

  async speak(text: string, language: TextLanguage, rate = 1, onEnd?: () => void) {
    this.stop();
    const token = ++this.token;

    let audioUrl: string | null = null;
    try {
      ({ audioUrl } = await api.synthesize(text, language));
    } catch {
      audioUrl = null;
    }

    // Une autre lecture (ou un stop) a eu lieu pendant l'appel réseau
    if (token !== this.token) {
      if (audioUrl?.startsWith('blob:')) URL.revokeObjectURL(audioUrl);
      return;
    }

    if (!audioUrl) {
      soundEngine.speak(text, rate, onEnd);
      return;
    }

    const audio = new Audio(audioUrl);
    audio.playbackRate = rate;
    this.audio = audio;
    this.objectUrl = audioUrl.startsWith('blob:') ? audioUrl : null;

    audio.onended = () => {
      this.release();
      onEnd?.();
    };
    audio.onerror = () => {
      this.release();
      soundEngine.speak(text, rate, onEnd);
    };
    audio.play().catch(() => audio.onerror?.(new Event('error')));
  }

  stop() {
    this.token++;
    soundEngine.stopSpeech();
    this.audio?.pause();
    this.release();
  }

  private release() {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.audio = null;
    this.objectUrl = null;
  }
}

export const voicePlayer = new VoicePlayer();

/** Libellé honnête de la voix utilisée, à afficher à côté des lecteurs. */
export const VOICE_LABEL = isMockApi ? 'Voix de secours (navigateur)' : 'Voix naturelle';

/**
 * Web Audio API synthesizer for African tonal languages & speech player
 */

class SoundEngine {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // Play a pleasant tonal acoustic note simulating West African Balafon or flute tone
  playTone(freq: number = 440, duration: number = 0.4, type: OscillatorType = 'sine') {
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      // Attack and release
      gain.gain.setValueAtTime(0.01, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // AudioContext unavailable or blocked by browser policy
    }
  }

  /**
   * Play tonal high / mid / low melodic sequence for language training.
   * Accepts any tone label ("Haut", "Ton Moyen-Haut", "Ton Haut-Bas"…): the keywords inside decide the melody.
   */
  playTonePitch(pitch: string) {
    let ctx: AudioContext;
    try {
      ctx = this.getContext();
    } catch {
      return; // AudioContext unavailable or blocked by browser policy
    }
    const now = ctx.currentTime;

    const playHarmonic = (f: number, startOffset: number, length: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + startOffset);
      gain.gain.setValueAtTime(0.2, now + startOffset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + startOffset + length);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + startOffset);
      osc.stop(now + startOffset + length);
    };

    if (pitch.includes('Haut-Bas')) {
      playHarmonic(587.33, 0, 0.25); // D5
      playHarmonic(293.66, 0.2, 0.35); // D4
    } else if (pitch.includes('Haut')) {
      playHarmonic(523.25, 0, 0.35); // C5
    } else if (pitch.includes('Bas')) {
      playHarmonic(261.63, 0, 0.35); // C4
    } else {
      playHarmonic(392.00, 0, 0.35); // G4
    }
  }

  // Play celebratory chime for quiz & exercise success
  playSuccess() {
    try {
      this.getContext();
      const notes = [392.00, 523.25, 659.25, 783.99]; // G4, C5, E5, G5
      notes.forEach((freq, idx) => {
        setTimeout(() => {
          this.playTone(freq, 0.35, 'triangle');
        }, idx * 110);
      });
    } catch {
      // fallback
    }
  }

  // Play speech utterance using speech synthesis with fallback tone
  speak(text: string, rate: number = 1.0, onEnd?: () => void) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = rate;
      utterance.pitch = 1.05;
      utterance.lang = 'fr-FR';

      // Pick a warm voice if available
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(v => v.lang.includes('fr') && !v.name.includes('Google') && !v.name.includes('Compact')) || voices.find(v => v.lang.includes('fr'));
      if (preferred) {
        utterance.voice = preferred;
      }

      if (onEnd) {
        utterance.addEventListener('end', onEnd, { once: true });
        utterance.addEventListener('error', onEnd, { once: true });
      }

      // Play soft acoustic prelude
      this.playTone(440, 0.1, 'sine');
      window.speechSynthesis.speak(utterance);
    } else {
      // Fallback melody
      this.playTone(440, 0.5);
      if (onEnd) setTimeout(onEnd, 1000);
    }
  }

  stopSpeech() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }
}

export const soundEngine = new SoundEngine();

/** Préférences d'affichage propres à cet appareil. */
export interface Preferences {
  /** Mode « voix d'abord » : lecture automatique des réponses et textes agrandis. */
  voiceFirst: boolean;
}

const STORAGE_KEY = 'ivoirai.preferences';
const DEFAULTS: Preferences = { voiceFirst: false };

export const loadPreferences = (): Preferences => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        const { voiceFirst } = parsed as Partial<Preferences>;
        return { voiceFirst: typeof voiceFirst === 'boolean' ? voiceFirst : DEFAULTS.voiceFirst };
      }
    }
  } catch {
    // Stockage indisponible ou contenu corrompu
  }
  return DEFAULTS;
};

export const savePreferences = (preferences: Preferences) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Stockage indisponible : la préférence vaut pour cette visite
  }
};

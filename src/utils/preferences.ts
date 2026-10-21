/** Préférences d'affichage propres à cet appareil. */
export type ThemePreference = 'system' | 'light' | 'dark';

export interface Preferences {
  /** Mode « voix d'abord » : lecture automatique des réponses et textes agrandis. */
  voiceFirst: boolean;
  /** Apparence : suit le téléphone, ou forcée en clair / sombre. */
  theme: ThemePreference;
}

const STORAGE_KEY = 'ivoirai.preferences';
const DEFAULTS: Preferences = { voiceFirst: false, theme: 'system' };
const THEMES: readonly ThemePreference[] = ['system', 'light', 'dark'];

export const loadPreferences = (): Preferences => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        const { voiceFirst, theme } = parsed as Partial<Preferences>;
        return {
          voiceFirst: typeof voiceFirst === 'boolean' ? voiceFirst : DEFAULTS.voiceFirst,
          theme: theme && THEMES.includes(theme) ? theme : DEFAULTS.theme,
        };
      }
    }
  } catch {
    // Stockage indisponible ou contenu corrompu
  }
  return DEFAULTS;
};

/** Enregistre les préférences modifiées, en gardant les autres. */
export const savePreferences = (update: Partial<Preferences>) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...loadPreferences(), ...update }));
  } catch {
    // Stockage indisponible : la préférence vaut pour cette visite
  }
};

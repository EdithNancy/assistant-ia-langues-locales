import { useCallback, useEffect, useState } from 'react';
import { loadPreferences, savePreferences, ThemePreference } from '../utils/preferences';

const DARK_QUERY = '(prefers-color-scheme: dark)';
/** Couleur de la barre du navigateur mobile, selon le thème. */
const THEME_COLOR = { light: '#004b49', dark: '#0e1415' } as const;

const resolve = (preference: ThemePreference): 'light' | 'dark' => {
  if (preference !== 'system') return preference;
  return window.matchMedia?.(DARK_QUERY).matches ? 'dark' : 'light';
};

const apply = (preference: ThemePreference) => {
  const theme = resolve(preference);
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
};

/** Apparence de l'app : suit le téléphone (« system ») ou forcée en clair / sombre. */
export const useTheme = () => {
  const [theme, setThemeState] = useState<ThemePreference>(() => loadPreferences().theme);

  useEffect(() => {
    apply(theme);
    if (theme !== 'system' || !window.matchMedia) return;
    const media = window.matchMedia(DARK_QUERY);
    const follow = () => apply('system');
    media.addEventListener('change', follow);
    return () => media.removeEventListener('change', follow);
  }, [theme]);

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next);
    savePreferences({ theme: next });
  }, []);

  return { theme, setTheme };
};

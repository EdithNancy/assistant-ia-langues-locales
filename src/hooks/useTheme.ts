import { useCallback, useEffect, useState } from 'react';
import { loadPreferences, savePreferences, ThemePreference } from '../utils/preferences';

/** Couleur de la barre du navigateur mobile, selon le thème. */
const THEME_COLOR: Record<ThemePreference, string> = { light: '#004b49', dark: '#0e1415' };

/** Apparence de l'app : clair par défaut, sombre si l'utilisateur le choisit (mémorisé). */
export const useTheme = () => {
  const [theme, setThemeState] = useState<ThemePreference>(() => loadPreferences().theme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
  }, [theme]);

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next);
    savePreferences({ theme: next });
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [setTheme, theme]);

  return { theme, setTheme, toggleTheme };
};

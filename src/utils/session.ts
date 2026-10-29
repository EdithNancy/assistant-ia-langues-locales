import { Language } from '../types';

/**
 * Session conservée dans le navigateur pour survivre au rafraîchissement.
 * Les jetons d'authentification sont conservés séparément dans sessionStorage.
 */
export interface Session {
  language: Language;
}

const STORAGE_KEY = 'ivoirai.session';
const LANGUAGES: readonly Language[] = ['baoule', 'dioula', 'bete'];

export const loadSession = (): Session | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      LANGUAGES.includes((parsed as Session).language)
    ) {
      return parsed as Session;
    }
  } catch {
    // Stockage indisponible (navigation privée) ou contenu corrompu
  }
  return null;
};

export const saveSession = (session: Session) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Stockage indisponible : la session reste en mémoire seulement
  }
};

export const clearSession = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Rien à nettoyer
  }
};

/**
 * Consentement vocal (cahier des charges, section RGPD : recueil explicite du consentement).
 * Conservé dans le navigateur ; à transmettre à l'API quand elle gérera les comptes.
 */
export interface VoiceConsent {
  /** Date ISO de l'acceptation. */
  acceptedAt: string;
  /** Accord facultatif pour réutiliser les enregistrements anonymisés afin d'améliorer les modèles. */
  improveModel: boolean;
}

const STORAGE_KEY = 'ivoirai.voiceConsent';

export const loadVoiceConsent = (): VoiceConsent | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as VoiceConsent).acceptedAt === 'string' &&
      typeof (parsed as VoiceConsent).improveModel === 'boolean'
    ) {
      return parsed as VoiceConsent;
    }
  } catch {
    // Stockage indisponible ou contenu corrompu : on redemandera
  }
  return null;
};

export const saveVoiceConsent = (consent: VoiceConsent) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
  } catch {
    // Stockage indisponible : le consentement vaut pour cette visite seulement
  }
};

export const clearVoiceConsent = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Rien à nettoyer
  }
};

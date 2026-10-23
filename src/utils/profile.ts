/**
 * Informations du compte, saisies à l'inscription et modifiables dans Réglages.
 * Conservées dans le navigateur en attendant l'API de comptes.
 * Le mot de passe n'est jamais stocké ici.
 */
export interface UserProfile {
  fullName: string;
  email: string;
  /** 10 chiffres sans indicatif, ex. "0701234567". */
  phone: string;
  /** Photo choisie par l'utilisateur (data URL) ou URL d'une image ; null = initiales. */
  photo: string | null;
}

const STORAGE_KEY = 'ivoirai.profile';

/** Compte de démonstration affiché tant que personne ne s'est inscrit. */
export const DEMO_PROFILE: UserProfile = {
  fullName: 'Edith Kouadio',
  email: 'kouadioedith440@gmail.com',
  phone: '',
  photo: null,
};

const asString = (value: unknown, fallback: string) => (typeof value === 'string' ? value : fallback);

export const loadProfile = (): UserProfile | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const p = parsed as Partial<UserProfile>;
    return {
      fullName: asString(p.fullName, ''),
      email: asString(p.email, ''),
      phone: asString(p.phone, ''),
      photo: typeof p.photo === 'string' ? p.photo : null,
    };
  } catch {
    // Stockage indisponible ou contenu corrompu
    return null;
  }
};

/** Enregistre le profil. Renvoie false si le navigateur a refusé (photo trop lourde, navigation privée). */
export const saveProfile = (profile: UserProfile): boolean => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    return true;
  } catch {
    return false;
  }
};

/** Prénom affiché dans les salutations : premier mot du nom. */
export const firstName = (fullName: string) => fullName.trim().split(/\s+/)[0] ?? '';

/** Deux initiales pour l'avatar sans photo. */
export const initials = (fullName: string) =>
  fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');

/**
 * Réduit une image choisie par l'utilisateur à un carré de `size` px en JPEG,
 * pour qu'elle tienne dans le stockage du navigateur (quelques dizaines de Ko).
 */
export const resizeImageFile = (file: File, size = 256): Promise<string> =>
  new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('not-an-image'));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('no-canvas'));
        return;
      }
      // Recadrage centré en carré
      ctx.drawImage(
        img,
        (img.naturalWidth - side) / 2,
        (img.naturalHeight - side) / 2,
        side,
        side,
        0,
        0,
        size,
        size
      );
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('unreadable'));
    };
    img.src = url;
  });

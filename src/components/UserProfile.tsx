import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { BRAND_ASSETS } from '../data/mockData';
import { DEMO_PROFILE, initials, loadProfile, resizeImageFile, saveProfile, UserProfile } from '../utils/profile';

interface UserProfileContextValue {
  profile: UserProfile;
  /** Modifie une partie du profil. Renvoie false si l'enregistrement a échoué (stockage plein). */
  updateProfile: (update: Partial<UserProfile>) => boolean;
}

const UserProfileContext = createContext<UserProfileContextValue | null>(null);

export const useUserProfile = () => {
  const value = useContext(UserProfileContext);
  if (!value) throw new Error('useUserProfile doit être utilisé dans UserProfileProvider');
  return value;
};

/** Sans compte enregistré : le profil de démonstration, avec sa photo. */
const initialProfile = (): UserProfile =>
  loadProfile() ?? { ...DEMO_PROFILE, photo: BRAND_ASSETS.edithProfile };

export const UserProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<UserProfile>(initialProfile);

  const updateProfile = useCallback(
    (update: Partial<UserProfile>) => {
      const next = { ...profile, ...update };
      if (!saveProfile(next)) return false;
      setProfile(next);
      return true;
    },
    [profile]
  );

  return (
    <UserProfileContext.Provider value={{ profile, updateProfile }}>{children}</UserProfileContext.Provider>
  );
};

/**
 * Choix d'une nouvelle photo de profil : `pick()` ouvre le sélecteur de fichiers,
 * `input` est l'élément caché à placer dans le rendu.
 */
export const usePhotoPicker = () => {
  const { updateProfile } = useUserProfile();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permet de rechoisir le même fichier
    if (!file) return;
    try {
      const photo = await resizeImageFile(file);
      setError(updateProfile({ photo }) ? null : 'Photo non enregistrée : stockage du navigateur indisponible.');
    } catch {
      setError('Ce fichier n’est pas une image lisible (JPG, PNG, WebP…).');
    }
  };

  const input = (
    <input ref={inputRef} type="file" accept="image/*" onChange={handleChange} className="hidden" tabIndex={-1} />
  );

  return { input, pick: () => inputRef.current?.click(), error };
};

interface AvatarProps {
  className?: string;
  /** Taille du texte des initiales, ex. `text-sm`. */
  textClassName?: string;
}

/** Photo de l'utilisateur, ou ses initiales s'il n'en a pas choisi. */
export const UserAvatar: React.FC<AvatarProps> = ({ className = 'w-8 h-8', textClassName = 'text-xs' }) => {
  const { profile } = useUserProfile();
  if (profile.photo) {
    return <img src={profile.photo} alt={`Photo de ${profile.fullName}`} className={`rounded-full object-cover ${className}`} />;
  }
  return (
    <span
      role="img"
      aria-label={`Initiales de ${profile.fullName || 'l’utilisateur'}`}
      className={`rounded-full bg-primary-container text-white font-bold flex items-center justify-center select-none ${className} ${textClassName}`}
    >
      {initials(profile.fullName) || <span className="material-symbols-outlined text-[1.4em]">person</span>}
    </span>
  );
};

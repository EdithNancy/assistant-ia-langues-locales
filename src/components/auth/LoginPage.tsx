import React, { useState } from 'react';
import { Language } from '../../types';
import {
  AuthHeader,
  ComingSoonBadge,
  FormError,
  GoogleIcon,
  PasswordField,
} from './AuthShared';
import { useUserProfile } from '../UserProfile';
import { ApiError, authApi, clearAuthTokens, saveAuthTokens } from '../../services';
import type { UserProfile } from '../../utils/profile';

interface LoginPageProps {
  onAuthenticated: (language: Language) => void;
  onGoToRegister: () => void;
  onBack?: () => void;
}

/** Hero emblem: soundwave bars inside a gradient ring with a dashed halo. */
const LoginEmblem = () => (
  <div className="relative w-40 h-40 flex items-center justify-center">
    <div className="absolute inset-0 rounded-full border border-dashed border-outline-variant" />
    <div className="absolute inset-3 rounded-full bg-primary-fixed/60" />
    <div className="relative w-28 h-28 rounded-full p-[5px] bg-gradient-to-br from-secondary via-on-secondary-fixed-variant to-primary-container shadow-raised">
      <div className="w-full h-full rounded-full bg-surface-container-lowest flex items-center justify-center">
        <svg viewBox="0 0 64 40" className="w-16 h-10" aria-hidden="true">
          <rect x="2" y="10" width="7" height="20" rx="3.5" fill="#3cddc7" />
          <rect x="15" y="2" width="7" height="36" rx="3.5" fill="#9e4229" />
          <circle cx="32" cy="20" r="6" fill="#004b49" />
          <rect x="42" y="2" width="7" height="36" rx="3.5" fill="#fe8b6d" />
          <rect x="55" y="10" width="7" height="20" rx="3.5" fill="#004b49" />
        </svg>
      </div>
    </div>
  </div>
);

export const LoginPage: React.FC<LoginPageProps> = ({ onAuthenticated, onGoToRegister, onBack }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [language, setLanguage] = useState<Language>('baoule');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { updateProfile } = useUserProfile();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError('Entrez une adresse email valide.');
      return;
    }
    if (!password) {
      setError('Entrez votre mot de passe.');
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const normalizedEmail = email.trim();
      const tokens = await authApi.login(normalizedEmail, password);
      saveAuthTokens(tokens);
      const user = await authApi.profile(tokens.accessToken);
      const profile: UserProfile = {
        fullName: user.full_name ?? '',
        email: user.email ?? normalizedEmail,
        phone: user.phone_number?.replace(/^\+225/, '').replace(/\D/g, '') ?? '',
        photo: null,
      };
      if (!updateProfile(profile)) {
        throw new ApiError('Impossible d’enregistrer le profil dans le navigateur.', null);
      }
      onAuthenticated(language);
    } catch (cause) {
      clearAuthTokens();
      setError(cause instanceof Error ? cause.message : 'Connexion impossible. Réessayez.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <AuthHeader title="Connexion" onBack={onBack} />

      <main className="flex-1 px-5 pt-6 pb-8 flex flex-col items-center">
        {/* Sur ordinateur, le panneau de marque à gauche joue déjà ce rôle */}
        <div className="lg:hidden">
          <LoginEmblem />
        </div>

        <span className="mt-2 lg:mt-6 text-[15px] font-semibold text-secondary inline-flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
          Akwaba nimbâ ! • Bon retour
        </span>

        <h1 className="mt-2 text-[24px] min-[380px]:text-[28px] font-bold text-primary tracking-tight text-center">
          Connexion à votre espace
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-on-surface-variant text-center text-balance">
          Reprenez vos conversations orales enrichies en Baoulé et Dioula.
        </p>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="mt-8 w-full rounded-3xl bg-surface-container-lowest p-5 shadow-soft flex flex-col gap-5"
        >
          <div className="flex flex-col gap-2">
            <label htmlFor="login-email" className="text-[13px] font-semibold text-on-surface-variant uppercase tracking-wide">
              Adresse email
            </label>
            <div className="h-14 rounded-2xl bg-surface-container-low flex items-center gap-3 px-4 focus-within:ring-2 focus-within:ring-primary-container/30 transition-all">
              <span className="material-symbols-outlined text-[22px] text-on-surface-variant">mail</span>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="aya.kouassi@email.ci"
                className="flex-1 min-w-0 bg-transparent outline-none text-[16px] text-on-surface placeholder:text-outline-variant"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-on-surface-variant uppercase tracking-wide">Mot de passe</span>
              <button
                type="button"
                disabled
                title="Réinitialisation du mot de passe bientôt disponible"
                className="text-[13px] font-semibold text-secondary hover:underline disabled:opacity-60 disabled:no-underline disabled:cursor-not-allowed"
              >
                Oublié ?
              </button>
            </div>
            <PasswordField value={password} onChange={setPassword} />
          </div>

          {/* Session language */}
          <div className="rounded-2xl bg-surface-container-low p-3 pl-4 flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-[14px] font-medium text-on-surface-variant">
              <span className="material-symbols-outlined text-[22px]">record_voice_over</span>
              <span className="whitespace-nowrap">
                Langue<span className="hidden min-[420px]:inline"> de session</span>
              </span>
            </span>
            <div className="flex p-1 rounded-full bg-surface-container-lowest">
              {(
                [
                  { key: 'baoule', label: 'Baoulé' },
                  { key: 'dioula', label: 'Dioula' },
                ] as const
              ).map((lang) => (
                <button
                  key={lang.key}
                  type="button"
                  onClick={() => setLanguage(lang.key)}
                  className={`px-4 py-1.5 rounded-full text-[15px] font-medium transition-all ${
                    language === lang.key ? 'bg-primary text-white' : 'text-on-surface-variant'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

          <FormError message={error} />

          <button
            type="submit"
            disabled={isLoading}
            className="h-16 rounded-full bg-primary-container text-white text-[18px] font-semibold flex items-center justify-center gap-2 shadow-raised hover:bg-primary active:scale-[0.98] disabled:opacity-70 transition-all"
          >
            {isLoading ? (
              <span className="w-5 h-5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            ) : (
              <>
                Se connecter
                <span className="material-symbols-outlined text-[22px]">arrow_forward</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => onAuthenticated(language)}
            className="h-12 -mt-1 rounded-full text-[15px] font-semibold text-primary-container hover:bg-tertiary-fixed-faint active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[20px]">account_circle</span>
            Essayer sans compte (démo)
          </button>

          <details className="group rounded-2xl border border-surface-container">
            <summary className="list-none cursor-pointer select-none px-4 h-12 flex items-center justify-between text-[14px] font-medium text-on-surface-variant [&::-webkit-details-marker]:hidden">
              Autres méthodes de connexion
              <span className="material-symbols-outlined text-[20px] transition-transform group-open:rotate-180">
                expand_more
              </span>
            </summary>
            <div className="grid grid-cols-2 gap-3 px-3 pb-3 pt-2">
              <button
                type="button"
                disabled
                title="Bientôt disponible"
                className="relative h-14 rounded-2xl bg-surface-container-low flex items-center justify-center gap-2 text-[14px] font-medium text-on-surface disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <ComingSoonBadge />
                <span className="material-symbols-outlined text-[22px] text-primary-container">fingerprint</span>
                Empreinte
              </button>
              <button
                type="button"
                disabled
                title="Bientôt disponible"
                className="relative h-14 rounded-2xl bg-surface-container-low flex items-center justify-center gap-2 text-[14px] font-medium text-on-surface disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <ComingSoonBadge />
                <GoogleIcon className="w-5 h-5" />
                Google
              </button>
            </div>
          </details>
        </form>

        <p className="mt-6 text-[15px] text-on-surface-variant text-center leading-relaxed">
          Vous n’avez pas encore de compte ?{' '}
          <button
            type="button"
            onClick={onGoToRegister}
            className="font-semibold text-secondary underline underline-offset-4"
          >
            S’inscrire gratuitement
          </button>
        </p>

        <p className="mt-4 flex items-center gap-2 text-[13px] text-on-surface-variant">
          <span className="material-symbols-outlined text-[18px]">verified_user</span>
          Préservation linguistique Akan &amp; Mandingue certifiée
        </p>
      </main>
    </div>
  );
};

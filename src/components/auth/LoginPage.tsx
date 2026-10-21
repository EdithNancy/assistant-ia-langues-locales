import React, { useState } from 'react';
import { Language } from '../../types';
import {
  AuthHeader,
  FormError,
  GoogleIcon,
  OrDivider,
  PasswordField,
  formatIvorianPhone,
  phoneDigits,
} from './AuthShared';

interface LoginPageProps {
  onAuthenticated: (language: Language) => void;
  onGoToRegister: () => void;
  onBack?: () => void;
}

type LoginMethod = 'phone' | 'email';

/** Hero emblem: soundwave bars inside a gradient ring with a dashed halo. */
const LoginEmblem = () => (
  <div className="relative w-40 h-40 flex items-center justify-center">
    <div className="absolute inset-0 rounded-full border border-dashed border-[#bfc8c7]" />
    <div className="absolute inset-3 rounded-full bg-[#b1eeea]/60" />
    <div className="relative w-28 h-28 rounded-full p-[5px] bg-gradient-to-br from-[#9e4229] via-[#7e2b14] to-[#004b49] shadow-lg">
      <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
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
  const [method, setMethod] = useState<LoginMethod>('phone');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [language, setLanguage] = useState<Language>('baoule');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (method === 'phone' && phoneDigits(phone).length !== 10) {
      setError('Entrez un numéro ivoirien valide à 10 chiffres.');
      return;
    }
    if (method === 'email' && !/^\S+@\S+\.\S+$/.test(email)) {
      setError('Entrez une adresse email valide.');
      return;
    }
    if (!password) {
      setError('Entrez votre mot de passe.');
      return;
    }
    setError(null);
    setIsLoading(true);
    // TODO: brancher sur l'API d'authentification réelle
    setTimeout(() => onAuthenticated(language), 900);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <AuthHeader title="Connexion" onBack={onBack} />

      <main className="flex-1 px-5 pt-6 pb-8 flex flex-col items-center">
        <LoginEmblem />

        <span className="-mt-2 px-4 py-1.5 rounded-full bg-[#ffdbd2] text-[#9e4229] text-[15px] font-medium">
          ✨ Akwaba nimbâ ! • Bon retour
        </span>

        <h1 className="mt-4 text-[24px] min-[380px]:text-[28px] font-bold text-[#003331] tracking-tight text-center">
          Connexion à votre espace
        </h1>
        <p className="mt-2 text-[17px] leading-relaxed text-[#3f4948] text-center">
          Reprenez vos conversations orales enrichies en Baoulé et Dioula.
        </p>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="mt-8 w-full rounded-[28px] bg-white p-5 shadow-[0_8px_40px_rgba(0,51,49,0.06)] flex flex-col gap-5"
        >
          {/* Phone / email switch */}
          <div className="grid grid-cols-2 p-1.5 rounded-full bg-[#edeef0]">
            {(
              [
                { key: 'phone', icon: 'smartphone', label: 'Numéro (+225)' },
                { key: 'email', icon: 'alternate_email', label: 'Email' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setMethod(tab.key);
                  setError(null);
                }}
                className={`h-12 rounded-full flex items-center justify-center gap-1.5 sm:gap-2 text-[13px] min-[380px]:text-[15px] font-medium transition-all ${
                  method === tab.key ? 'bg-white text-[#1a1c1d] shadow-sm' : 'text-[#3f4948]'
                }`}
              >
                <span className="material-symbols-outlined text-[22px]">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {method === 'phone' ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-3">
                <label htmlFor="login-phone" className="text-[13px] font-semibold text-[#3f4948] uppercase tracking-wide">
                  Numéro mobile Côte d’Ivoire
                </label>
                <span className="text-[12px] font-medium text-[#004b49] tracking-wide text-right">
                  Orange • MTN • Moov • Wave
                </span>
              </div>
              <div className="h-14 rounded-2xl bg-[#f3f3f5] flex items-center gap-3 px-4 focus-within:ring-2 focus-within:ring-[#004b49]/30 transition-all">
                <span className="text-xl leading-none">🇨🇮</span>
                <span className="text-[17px] font-semibold text-[#1a1c1d]">+225</span>
                <input
                  id="login-phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  value={phone}
                  onChange={(e) => setPhone(formatIvorianPhone(e.target.value))}
                  placeholder="07 01 23 45 67"
                  className="flex-1 min-w-0 ml-3 bg-transparent outline-none text-[18px] tracking-wider text-[#1a1c1d] placeholder:text-[#bfc8c7]"
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <label htmlFor="login-email" className="text-[13px] font-semibold text-[#3f4948] uppercase tracking-wide">
                Adresse email
              </label>
              <div className="h-14 rounded-2xl bg-[#f3f3f5] flex items-center gap-3 px-4 focus-within:ring-2 focus-within:ring-[#004b49]/30 transition-all">
                <span className="material-symbols-outlined text-[22px] text-[#3f4948]">mail</span>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="aya.kouassi@email.ci"
                  className="flex-1 min-w-0 bg-transparent outline-none text-[16px] text-[#1a1c1d] placeholder:text-[#bfc8c7]"
                />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-[#3f4948] uppercase tracking-wide">Mot de passe</span>
              <button type="button" className="text-[13px] font-semibold text-[#9e4229] hover:underline">
                Oublié ?
              </button>
            </div>
            <PasswordField value={password} onChange={setPassword} />
          </div>

          {/* Session language */}
          <div className="rounded-2xl bg-[#f3f3f5] p-3 pl-4 flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-[14px] font-medium text-[#3f4948]">
              <span className="material-symbols-outlined text-[22px]">record_voice_over</span>
              Langue de session
            </span>
            <div className="flex p-1 rounded-full bg-white">
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
                    language === lang.key ? 'bg-[#003331] text-white' : 'text-[#3f4948]'
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
            className="h-16 rounded-full bg-[#004b49] text-white text-[18px] font-semibold flex items-center justify-center gap-2 shadow-[0_10px_24px_rgba(0,75,73,0.25)] hover:bg-[#003331] active:scale-[0.98] disabled:opacity-70 transition-all"
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
            className="min-h-16 rounded-2xl bg-[#e0faf6] px-4 py-3 flex items-center gap-3 text-[#004b49] hover:bg-[#cdf5ef] active:scale-[0.98] transition-all"
          >
            <span className="material-symbols-outlined text-[26px]">fingerprint</span>
            <span className="flex-1 text-center text-[15px] font-medium leading-snug">
              Connexion rapide par Empreinte / Face ID
            </span>
          </button>

          <OrDivider label="OU CONTINUER AVEC" className="mt-1" />

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onAuthenticated(language)}
              className="h-16 rounded-2xl bg-[#f3f3f5] flex items-center justify-center gap-3 text-[16px] font-medium text-[#1a1c1d] hover:bg-[#edeef0] active:scale-[0.98] transition-all"
            >
              <GoogleIcon className="w-6 h-6" />
              Google
            </button>
            <button
              type="button"
              onClick={() => onAuthenticated(language)}
              className="h-16 rounded-2xl bg-[#f3f3f5] flex items-center justify-center gap-3 text-[16px] font-medium text-[#1a1c1d] hover:bg-[#edeef0] active:scale-[0.98] transition-all"
            >
              <span className="material-symbols-outlined text-[24px]">account_circle</span>
              Invité Démo
            </button>
          </div>
        </form>

        <p className="mt-8 text-[17px] text-[#3f4948] text-center leading-relaxed">
          Vous n’avez pas encore de compte ?{' '}
          <button
            type="button"
            onClick={onGoToRegister}
            className="font-semibold text-[#9e4229] underline underline-offset-4"
          >
            S’inscrire gratuitement
          </button>
        </p>

        <p className="mt-4 flex items-center gap-2 text-[13px] text-[#3f4948]">
          <span className="material-symbols-outlined text-[18px]">verified_user</span>
          Préservation linguistique Akan &amp; Mandingue certifiée
        </p>
      </main>
    </div>
  );
};

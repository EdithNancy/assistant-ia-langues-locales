import React, { useState } from 'react';
import { Flag } from '../Flag';
import { useUserProfile } from '../UserProfile';
import { Language } from '../../types';
import {
  AppleIcon,
  AuthHeader,
  ComingSoonBadge,
  formatIvorianPhone,
  FormError,
  GoogleIcon,
  OrDivider,
  PasswordField,
  passwordScore,
  phoneDigits,
  STRENGTH_LABELS,
} from './AuthShared';

interface RegisterPageProps {
  onAuthenticated: (language: Language) => void;
  onGoToLogin: () => void;
  onBack?: () => void;
}

const LANGUAGE_CHOICES = [
  {
    key: 'baoule' as const,
    name: 'Baoulé',
    family: 'Famille Akan',
    greeting: '« N’zassa »',
    icon: 'eco',
    iconBg: 'bg-primary text-white',
    chip: 'bg-primary-fixed/70 text-primary-container',
  },
  {
    key: 'dioula' as const,
    name: 'Dioula',
    family: 'Famille Mandé',
    greeting: '« I nice »',
    icon: 'light_mode',
    iconBg: 'bg-secondary-container text-on-secondary-fixed',
    chip: 'bg-secondary-fixed text-secondary',
  },
];

export const RegisterPage: React.FC<RegisterPageProps> = ({ onAuthenticated, onGoToLogin, onBack }) => {
  const [language, setLanguage] = useState<Language>('baoule');
  const [fullName, setFullName] = useState('');
  const [useEmail, setUseEmail] = useState(false);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { updateProfile } = useUserProfile();
  const score = passwordScore(password);
  const isContactValid = useEmail
    ? /^\S+@\S+\.\S+$/.test(email)
    : phoneDigits(phone).length === 10;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return setError('Indiquez votre nom ou prénom.');
    if (!isContactValid)
      return setError(useEmail ? 'Entrez une adresse email valide.' : 'Entrez un numéro ivoirien valide à 10 chiffres.');
    if (score < 3) return setError('Mot de passe : 8 caractères minimum, avec un chiffre et un symbole.');
    if (!acceptedTerms) return setError('Veuillez accepter les conditions d’utilisation.');
    setError(null);
    setIsLoading(true);
    // TODO: brancher sur l'API d'inscription réelle (le mot de passe n'est pas conservé ici)
    updateProfile({
      fullName: fullName.trim(),
      email: useEmail ? email.trim() : '',
      phone: useEmail ? '' : phoneDigits(phone),
      photo: null,
    });
    setTimeout(() => onAuthenticated(language), 900);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <AuthHeader title="Inscription" onBack={onBack} />

      <main className="flex-1 px-5 pt-6 pb-8 flex flex-col items-center">
        {/* Hero emblem */}
        <div className="relative w-24 h-24 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-tertiary-fixed/20 blur-md" />
          <div className="relative w-20 h-20 rounded-full bg-primary flex items-center justify-center shadow-raised">
            <div className="w-12 h-12 rounded-full border border-dashed border-tertiary-fixed-dim/60 flex items-center justify-center">
              <svg viewBox="0 0 32 20" className="w-7 h-5" aria-hidden="true">
                <rect x="0" y="6" width="3" height="8" rx="1.5" fill="#3cddc7" />
                <rect x="5" y="2" width="3" height="16" rx="1.5" fill="#3cddc7" />
                <circle cx="16" cy="10" r="5" fill="#fe8b6d" />
                <circle cx="16" cy="10" r="1.8" fill="#fff" />
                <rect x="24" y="2" width="3" height="16" rx="1.5" fill="#fe8b6d" />
                <rect x="29" y="6" width="3" height="8" rx="1.5" fill="#ffb4a1" />
              </svg>
            </div>
          </div>
        </div>

        <span className="mt-4 px-4 py-1.5 rounded-full bg-secondary-fixed text-on-secondary-fixed-variant text-[13px] font-medium inline-flex items-center gap-2">
          <Flag country="ci" className="w-4" />
          Rejoignez la communauté ivoirienne
        </span>

        <h1 className="mt-4 text-[34px] leading-tight font-bold text-primary tracking-tight text-center">
          Créer un compte IvoirAI
        </h1>
        <p className="mt-2 text-[16px] leading-relaxed text-on-surface-variant text-center">
          Apprenez, traduisez et conversez naturellement au quotidien en langues locales.
        </p>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="mt-8 w-full rounded-3xl bg-surface-container-lowest p-5 shadow-soft flex flex-col gap-5"
        >
          {/* Priority language */}
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <span className="flex items-start gap-2 text-[14px] font-medium text-on-surface">
                <span className="material-symbols-outlined text-[22px] text-secondary">translate</span>
                Langue d’apprentissage prioritaire
              </span>
              <span className="shrink-0 px-2.5 py-0.5 rounded-full bg-tertiary-fixed-faint text-primary-container text-[12px] font-semibold">
                Personnalisé
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {LANGUAGE_CHOICES.map((choice) => {
                const selected = language === choice.key;
                return (
                  <button
                    key={choice.key}
                    type="button"
                    onClick={() => setLanguage(choice.key)}
                    aria-pressed={selected}
                    className={`relative text-left rounded-2xl p-4 flex flex-col gap-1 transition-all active:scale-[0.98] ${
                      selected
                        ? 'bg-surface-container-low ring-2 ring-on-surface'
                        : 'bg-surface-container ring-1 ring-transparent hover:ring-outline-variant'
                    }`}
                  >
                    <span className="flex items-center justify-between">
                      <span className={`w-9 h-9 rounded-full flex items-center justify-center ${choice.iconBg}`}>
                        <span className="material-symbols-outlined text-[20px]">{choice.icon}</span>
                      </span>
                      <span className={`material-symbols-outlined text-[22px] ${selected ? 'text-on-surface' : 'text-outline-variant'}`}>
                        {selected ? 'check_circle' : 'radio_button_unchecked'}
                      </span>
                    </span>
                    <span className="mt-3 text-[20px] font-semibold text-on-surface">{choice.name}</span>
                    <span className="text-[13px] text-on-surface-variant">{choice.family}</span>
                    <span className={`mt-1 self-start px-2 py-0.5 rounded-xl text-xs font-medium ${choice.chip}`}>
                      {choice.greeting}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Name */}
          <div className="flex flex-col gap-2">
            <label htmlFor="register-name" className="text-[14px] font-medium text-on-surface">
              Nom complet ou prénom
            </label>
            <div className="h-13 rounded-2xl bg-surface-container-low flex items-center gap-3 px-4 focus-within:ring-2 focus-within:ring-primary-container/30 transition-all">
              <span className="material-symbols-outlined text-[22px] text-on-surface-variant">badge</span>
              <input
                id="register-name"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Koffi Aya Marcelle"
                className="flex-1 min-w-0 bg-transparent outline-none text-[16px] text-on-surface placeholder:text-outline-variant"
              />
            </div>
          </div>

          {/* Phone or email */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="register-contact" className="text-[14px] font-medium text-on-surface">
                {useEmail ? 'Adresse email' : 'Numéro WhatsApp / Téléphone'}
              </label>
              <button
                type="button"
                onClick={() => {
                  setUseEmail((v) => !v);
                  setError(null);
                }}
                className="shrink-0 text-[12px] font-semibold text-secondary hover:underline"
              >
                {useEmail ? 'Utiliser un numéro' : 'Utiliser un email'}
              </button>
            </div>

            {useEmail ? (
              <div className="h-13 rounded-2xl bg-surface-container-low flex items-center gap-3 px-4 focus-within:ring-2 focus-within:ring-primary-container/30 transition-all">
                <span className="material-symbols-outlined text-[22px] text-on-surface-variant">mail</span>
                <input
                  id="register-contact"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="aya.kouassi@email.ci"
                  className="flex-1 min-w-0 bg-transparent outline-none text-[16px] text-on-surface placeholder:text-outline-variant"
                />
                {isContactValid && <span className="material-symbols-outlined text-[22px] text-on-surface">check_circle</span>}
              </div>
            ) : (
              <div className="flex gap-2">
                <div className="h-13 shrink-0 rounded-2xl bg-surface-container-low flex items-center gap-1.5 px-3 min-[400px]:gap-2 min-[400px]:px-4">
                  <Flag country="ci" className="w-6" labelled />
                  <span className="text-[15px] font-medium text-on-surface">+225</span>
                  {/* Wrapper : la feuille Google des icônes impose display:inline-block sur l'icône elle-même */}
                  <span className="flex max-[359px]:hidden">
                    <span className="material-symbols-outlined text-[18px] text-on-surface-variant">expand_more</span>
                  </span>
                </div>
                <div className="h-13 flex-1 min-w-0 rounded-2xl bg-surface-container-low flex items-center gap-1.5 px-3 focus-within:ring-2 focus-within:ring-primary-container/30 transition-all">
                  <input
                    id="register-contact"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    value={phone}
                    onChange={(e) => setPhone(formatIvorianPhone(e.target.value))}
                    placeholder="05 84 92 10 33"
                    className="flex-1 min-w-0 bg-transparent outline-none text-[16px] text-on-surface placeholder:text-outline-variant"
                  />
                  {/* Coche masquée sur très petit écran : elle couperait le numéro */}
                  {isContactValid && (
                    <span className="flex max-[369px]:hidden">
                      <span className="material-symbols-outlined text-[22px] text-on-surface">check_circle</span>
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Password + strength meter */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-medium text-on-surface">Mot de passe</span>
              <span className="flex items-center gap-1 text-[12px] font-medium text-on-surface">
                <span className="material-symbols-outlined text-[16px]">shield</span>
                Sécurisé
              </span>
            </div>
            <PasswordField value={password} onChange={setPassword} autoComplete="new-password" />
            <div className="mt-1 grid grid-cols-3 gap-2">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-colors ${
                    i < score ? (i === 2 ? 'bg-primary-container' : 'bg-secondary-soft') : 'bg-surface-container-highest'
                  }`}
                />
              ))}
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <span className="font-medium text-on-surface">
                Force : {password ? STRENGTH_LABELS[score] : '—'}
              </span>
              <span className="text-on-surface-variant">8+ car., chiffre &amp; symbole</span>
            </div>
          </div>

          {/* Terms */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="peer sr-only"
            />
            <span className="mt-0.5 shrink-0 w-6 h-6 rounded-xl border-2 border-primary flex items-center justify-center peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary-container/40 transition-colors">
              {acceptedTerms && <span className="material-symbols-outlined text-[18px] text-white">check</span>}
            </span>
            <span className="text-[13px] leading-snug text-on-surface-variant">
              J’accepte les{' '}
              <span className="font-medium text-on-surface underline underline-offset-2">conditions d’utilisation</span> et
              la charte d’honneur de préservation du patrimoine linguistique ivoirien.
            </span>
          </label>

          <FormError message={error} />

          <button
            type="submit"
            disabled={isLoading}
            className="h-16 rounded-full bg-primary text-white text-[18px] font-semibold flex items-center justify-center gap-2 shadow-raised hover:bg-primary-container active:scale-[0.98] disabled:opacity-70 transition-all"
          >
            {isLoading ? (
              <span className="w-5 h-5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            ) : (
              <>
                <span className="material-symbols-outlined text-[24px] text-tertiary-fixed">auto_awesome</span>
                Créer mon compte gratuit
              </>
            )}
          </button>
        </form>

        <OrDivider label="ou s’inscrire avec" className="mt-6 w-full" />

        <div className="mt-4 w-full grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled
            title="Bientôt disponible"
            className="relative h-12 rounded-full bg-surface-container-lowest flex items-center justify-center gap-2 text-[15px] font-medium text-on-surface shadow-soft hover:bg-surface-container-low active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            <ComingSoonBadge />
            <GoogleIcon />
            Google
          </button>
          <button
            type="button"
            disabled
            title="Bientôt disponible"
            className="relative h-12 rounded-full bg-surface-container-lowest flex items-center justify-center gap-2 text-[15px] font-medium text-on-surface shadow-soft hover:bg-surface-container-low active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            <ComingSoonBadge />
            <AppleIcon />
            Apple
          </button>
        </div>

        <div className="mt-6 w-full rounded-2xl bg-tertiary-fixed-faint p-4 flex items-center gap-4">
          <span className="shrink-0 w-11 h-11 rounded-full bg-primary flex items-center justify-center text-tertiary-fixed">
            <span className="material-symbols-outlined text-[22px]">verified_user</span>
          </span>
          <div>
            <p className="text-[14px] font-semibold text-on-surface">IA éthique et préservation vivante</p>
            <p className="text-[13px] leading-snug text-on-surface-variant">
              Vos enregistrements vocaux restent anonymes et contribuent au patrimoine national.
            </p>
          </div>
        </div>

        <p className="mt-8 text-[16px] text-on-surface-variant text-center">
          Déjà inscrit ?{' '}
          <button type="button" onClick={onGoToLogin} className="text-[18px] font-semibold text-secondary hover:underline">
            Se connecter
          </button>
        </p>
      </main>
    </div>
  );
};

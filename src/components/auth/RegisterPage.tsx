import React, { useState } from 'react';
import { Flag } from '../Flag';
import { Language } from '../../types';
import {
  AppleIcon,
  AuthHeader,
  ComingSoonBadge,
  FormError,
  GoogleIcon,
  OrDivider,
  PasswordField,
  formatIvorianPhone,
  phoneDigits,
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
    iconBg: 'bg-[#003331] text-white',
    chip: 'bg-[#b1eeea]/70 text-[#004b49]',
  },
  {
    key: 'dioula' as const,
    name: 'Dioula',
    family: 'Famille Mandé',
    greeting: '« I nice »',
    icon: 'light_mode',
    iconBg: 'bg-[#fe8b6d] text-[#3c0800]',
    chip: 'bg-[#ffdbd2] text-[#9e4229]',
  },
];

/** 0–3 score: length >= 8, contains a digit, contains a symbol. */
const passwordScore = (pwd: string) =>
  [pwd.length >= 8, /\d/.test(pwd), /[^A-Za-z0-9]/.test(pwd)].filter(Boolean).length;

const STRENGTH_LABELS = ['Faible', 'Faible', 'Moyenne', 'Robuste'];

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
    // TODO: brancher sur l'API d'inscription réelle
    setTimeout(() => onAuthenticated(language), 900);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <AuthHeader title="Inscription" onBack={onBack} />

      <main className="flex-1 px-5 pt-6 pb-8 flex flex-col items-center">
        {/* Hero emblem */}
        <div className="relative w-24 h-24 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-[#62fae3]/20 blur-md" />
          <div className="relative w-20 h-20 rounded-full bg-[#003331] flex items-center justify-center shadow-[0_8px_24px_rgba(0,51,49,0.35)]">
            <div className="w-12 h-12 rounded-full border border-dashed border-[#3cddc7]/60 flex items-center justify-center">
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

        <span className="mt-4 px-4 py-1.5 rounded-full bg-[#ffdbd2] text-[#7e2b14] text-[13px] font-medium inline-flex items-center gap-2">
          <Flag country="ci" className="w-4" />
          Rejoignez la communauté ivoirienne
        </span>

        <h1 className="mt-4 text-[34px] leading-tight font-bold text-[#003331] tracking-tight text-center">
          Créer un compte IvoirAI
        </h1>
        <p className="mt-2 text-[16px] leading-relaxed text-[#3f4948] text-center">
          Apprenez, traduisez et conversez naturellement au quotidien en langues locales.
        </p>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="mt-8 w-full rounded-[28px] bg-white p-5 shadow-[0_8px_40px_rgba(0,51,49,0.06)] flex flex-col gap-5"
        >
          {/* Priority language */}
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <span className="flex items-start gap-2 text-[14px] font-medium text-[#1a1c1d]">
                <span className="material-symbols-outlined text-[22px] text-[#9e4229]">translate</span>
                Langue d’apprentissage prioritaire
              </span>
              <span className="shrink-0 px-2.5 py-0.5 rounded-full bg-[#e0faf6] text-[#004b49] text-[12px] font-semibold">
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
                        ? 'bg-[#f3f3f5] ring-2 ring-[#1a1c1d]'
                        : 'bg-[#edeef0] ring-1 ring-transparent hover:ring-[#bfc8c7]'
                    }`}
                  >
                    <span className="flex items-center justify-between">
                      <span className={`w-9 h-9 rounded-full flex items-center justify-center ${choice.iconBg}`}>
                        <span className="material-symbols-outlined text-[20px]">{choice.icon}</span>
                      </span>
                      <span className={`material-symbols-outlined text-[22px] ${selected ? 'text-[#1a1c1d]' : 'text-[#bfc8c7]'}`}>
                        {selected ? 'check_circle' : 'radio_button_unchecked'}
                      </span>
                    </span>
                    <span className="mt-3 text-[20px] font-semibold text-[#1a1c1d]">{choice.name}</span>
                    <span className="text-[13px] text-[#3f4948]">{choice.family}</span>
                    <span className={`mt-1 self-start px-2 py-0.5 rounded-md text-xs font-medium ${choice.chip}`}>
                      {choice.greeting}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Name */}
          <div className="flex flex-col gap-2">
            <label htmlFor="register-name" className="text-[14px] font-medium text-[#1a1c1d]">
              Nom complet ou prénom
            </label>
            <div className="h-13 rounded-2xl bg-[#f3f3f5] flex items-center gap-3 px-4 focus-within:ring-2 focus-within:ring-[#004b49]/30 transition-all">
              <span className="material-symbols-outlined text-[22px] text-[#3f4948]">badge</span>
              <input
                id="register-name"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Koffi Aya Marcelle"
                className="flex-1 min-w-0 bg-transparent outline-none text-[16px] text-[#1a1c1d] placeholder:text-[#bfc8c7]"
              />
            </div>
          </div>

          {/* Phone or email */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="register-contact" className="text-[14px] font-medium text-[#1a1c1d]">
                {useEmail ? 'Adresse email' : 'Numéro WhatsApp / Téléphone'}
              </label>
              <button
                type="button"
                onClick={() => {
                  setUseEmail((v) => !v);
                  setError(null);
                }}
                className="shrink-0 text-[12px] font-semibold text-[#9e4229] hover:underline"
              >
                {useEmail ? 'Utiliser un numéro' : 'Utiliser un email'}
              </button>
            </div>

            {useEmail ? (
              <div className="h-13 rounded-2xl bg-[#f3f3f5] flex items-center gap-3 px-4 focus-within:ring-2 focus-within:ring-[#004b49]/30 transition-all">
                <span className="material-symbols-outlined text-[22px] text-[#3f4948]">mail</span>
                <input
                  id="register-contact"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="aya.kouassi@email.ci"
                  className="flex-1 min-w-0 bg-transparent outline-none text-[16px] text-[#1a1c1d] placeholder:text-[#bfc8c7]"
                />
                {isContactValid && <span className="material-symbols-outlined text-[22px] text-[#1a1c1d]">check_circle</span>}
              </div>
            ) : (
              <div className="flex gap-2">
                <div className="h-13 shrink-0 rounded-2xl bg-[#f3f3f5] flex items-center gap-2 px-4">
                  <Flag country="ci" className="w-6" labelled />
                  <span className="text-[15px] font-medium text-[#1a1c1d]">+225</span>
                  <span className="material-symbols-outlined text-[18px] text-[#3f4948]">expand_more</span>
                </div>
                <div className="h-13 flex-1 min-w-0 rounded-2xl bg-[#f3f3f5] flex items-center gap-2 px-4 focus-within:ring-2 focus-within:ring-[#004b49]/30 transition-all">
                  <input
                    id="register-contact"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    value={phone}
                    onChange={(e) => setPhone(formatIvorianPhone(e.target.value))}
                    placeholder="05 84 92 10 33"
                    className="flex-1 min-w-0 bg-transparent outline-none text-[16px] tracking-wide text-[#1a1c1d] placeholder:text-[#bfc8c7]"
                  />
                  {isContactValid && <span className="material-symbols-outlined text-[22px] text-[#1a1c1d]">check_circle</span>}
                </div>
              </div>
            )}
          </div>

          {/* Password + strength meter */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-medium text-[#1a1c1d]">Mot de passe</span>
              <span className="flex items-center gap-1 text-[12px] font-medium text-[#1a1c1d]">
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
                    i < score ? (i === 2 ? 'bg-[#004b49]' : 'bg-[#e87a5d]') : 'bg-[#e2e2e4]'
                  }`}
                />
              ))}
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <span className="font-medium text-[#1a1c1d]">
                Force : {password ? STRENGTH_LABELS[score] : '—'}
              </span>
              <span className="text-[#3f4948]">8+ car., chiffre &amp; symbole</span>
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
            <span className="mt-0.5 shrink-0 w-6 h-6 rounded-md border-2 border-[#003331] flex items-center justify-center peer-checked:bg-[#003331] peer-focus-visible:ring-2 peer-focus-visible:ring-[#004b49]/40 transition-colors">
              {acceptedTerms && <span className="material-symbols-outlined text-[18px] text-white">check</span>}
            </span>
            <span className="text-[13px] leading-snug text-[#3f4948]">
              J’accepte les{' '}
              <span className="font-medium text-[#1a1c1d] underline underline-offset-2">conditions d’utilisation</span> et
              la charte d’honneur de préservation du patrimoine linguistique ivoirien.
            </span>
          </label>

          <FormError message={error} />

          <button
            type="submit"
            disabled={isLoading}
            className="h-16 rounded-full bg-[#003331] text-white text-[18px] font-semibold flex items-center justify-center gap-2 shadow-[0_10px_24px_rgba(0,51,49,0.3)] hover:bg-[#004b49] active:scale-[0.98] disabled:opacity-70 transition-all"
          >
            {isLoading ? (
              <span className="w-5 h-5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            ) : (
              <>
                <span className="material-symbols-outlined text-[24px] text-[#62fae3]">auto_awesome</span>
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
            className="relative h-12 rounded-full bg-white flex items-center justify-center gap-2 text-[15px] font-medium text-[#1a1c1d] shadow-sm hover:bg-[#f3f3f5] active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            <ComingSoonBadge />
            <GoogleIcon />
            Google
          </button>
          <button
            type="button"
            disabled
            title="Bientôt disponible"
            className="relative h-12 rounded-full bg-white flex items-center justify-center gap-2 text-[15px] font-medium text-[#1a1c1d] shadow-sm hover:bg-[#f3f3f5] active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            <ComingSoonBadge />
            <AppleIcon />
            Apple
          </button>
        </div>

        <div className="mt-6 w-full rounded-2xl bg-[#e0faf6] p-4 flex items-center gap-4">
          <span className="shrink-0 w-11 h-11 rounded-full bg-[#003331] flex items-center justify-center text-[#62fae3]">
            <span className="material-symbols-outlined text-[22px]">verified_user</span>
          </span>
          <div>
            <p className="text-[14px] font-semibold text-[#1a1c1d]">IA éthique et préservation vivante</p>
            <p className="text-[13px] leading-snug text-[#3f4948]">
              Vos enregistrements vocaux restent anonymes et contribuent au patrimoine national.
            </p>
          </div>
        </div>

        <p className="mt-8 text-[16px] text-[#3f4948] text-center">
          Déjà inscrit ?{' '}
          <button type="button" onClick={onGoToLogin} className="text-[18px] font-semibold text-[#9e4229] hover:underline">
            Se connecter
          </button>
        </p>
      </main>
    </div>
  );
};

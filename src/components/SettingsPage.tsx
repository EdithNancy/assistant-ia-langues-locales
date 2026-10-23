import React, { useState } from 'react';
import { Language } from '../types';
import { useToast } from '../hooks/useToast';
import { Toast } from './Toast';
import { Button } from './ui/Button';
import { Flag } from './Flag';
import { UserAvatar, usePhotoPicker, useUserProfile } from './UserProfile';
import {
  formatIvorianPhone,
  FormError,
  PasswordField,
  passwordScore,
  phoneDigits,
  STRENGTH_LABELS,
} from './auth/AuthShared';

interface SettingsPageProps {
  currentLanguage: Language;
  onLanguageChange: (lang: Language) => void;
  onLogout: () => void;
}

const LANGUAGE_CHOICES: readonly { key: Language; label: string; hint: string; disabled?: boolean }[] = [
  { key: 'baoule', label: 'Baoulé', hint: 'Famille Akan' },
  { key: 'dioula', label: 'Dioula', hint: 'Famille Mandé' },
  { key: 'bete', label: 'Bété', hint: 'Bientôt', disabled: true },
];

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

const INPUT_CLASS =
  'w-full h-14 px-5 rounded-2xl bg-surface-container-low border border-surface-container text-[16px] font-medium text-on-surface placeholder:text-outline outline-none focus:border-primary-container/40 focus:ring-2 focus:ring-primary-container/20 transition-all';

const Section: React.FC<{ title: string; subtitle: string; children: React.ReactNode }> = ({
  title,
  subtitle,
  children,
}) => (
  <section className="rounded-[28px] border border-surface-container-high bg-surface-container-lowest p-5 sm:p-7 lg:p-8 flex flex-col gap-6">
    <header>
      <h2 className="text-xl font-extrabold text-on-surface tracking-tight">{title}</h2>
      <p className="mt-1 text-sm text-on-surface-variant">{subtitle}</p>
    </header>
    {children}
  </section>
);

const Field: React.FC<{ label: string; htmlFor: string; hint?: string; children: React.ReactNode }> = ({
  label,
  htmlFor,
  hint,
  children,
}) => (
  <div className="flex flex-col gap-2.5">
    <label htmlFor={htmlFor} className="text-sm font-bold text-on-surface">
      {label}
    </label>
    {children}
    {hint && <p className="text-xs text-on-surface-variant">{hint}</p>}
  </div>
);

/** Page Réglages : informations du compte, langue d'apprentissage et mot de passe. */
export const SettingsPage: React.FC<SettingsPageProps> = ({ currentLanguage, onLanguageChange, onLogout }) => {
  const { profile, updateProfile } = useUserProfile();
  const photoPicker = usePhotoPicker();
  const { toast, showToast } = useToast(2500);

  // --- Informations du compte (enregistrées ensemble) ---
  const [fullName, setFullName] = useState(profile.fullName);
  const [email, setEmail] = useState(profile.email);
  const [phone, setPhone] = useState(formatIvorianPhone(profile.phone));
  const [language, setLanguage] = useState<Language>(currentLanguage);
  const [accountError, setAccountError] = useState<string | null>(null);

  const isDirty =
    fullName.trim() !== profile.fullName ||
    email.trim() !== profile.email ||
    phoneDigits(phone) !== profile.phone ||
    language !== currentLanguage;

  const resetAccount = () => {
    setFullName(profile.fullName);
    setEmail(profile.email);
    setPhone(formatIvorianPhone(profile.phone));
    setLanguage(currentLanguage);
    setAccountError(null);
  };

  const saveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    const digits = phoneDigits(phone);
    if (!fullName.trim()) return setAccountError('Indiquez votre nom ou prénom.');
    if (email.trim() && !EMAIL_PATTERN.test(email.trim())) return setAccountError('Adresse email invalide.');
    if (digits && digits.length !== 10) return setAccountError('Le numéro doit contenir 10 chiffres.');
    if (!email.trim() && !digits) return setAccountError('Gardez au moins un email ou un numéro pour vous connecter.');

    // TODO: envoyer à l'API de comptes quand elle existera
    if (!updateProfile({ fullName: fullName.trim(), email: email.trim(), phone: digits })) {
      return setAccountError('Enregistrement impossible : stockage du navigateur indisponible.');
    }
    if (language !== currentLanguage) onLanguageChange(language);
    setAccountError(null);
    showToast('Modifications enregistrées');
  };

  // --- Mot de passe (formulaire séparé) ---
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const score = passwordScore(newPassword);

  const savePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) return setPasswordError('Entrez votre mot de passe actuel.');
    if (score < 3) return setPasswordError('Nouveau mot de passe : 8 caractères minimum, avec un chiffre et un symbole.');
    if (newPassword !== confirmPassword) return setPasswordError('Les deux nouveaux mots de passe ne correspondent pas.');
    if (newPassword === currentPassword) return setPasswordError('Le nouveau mot de passe doit être différent de l’actuel.');
    // TODO: vérifier l'actuel et enregistrer le nouveau via l'API (rien n'est stocké dans le navigateur)
    setPasswordError(null);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    showToast('Mot de passe mis à jour');
  };

  return (
    <div className="w-full max-w-3xl mx-auto pb-10">
      <Toast message={toast} icon="check_circle" />

      <header className="pt-2 pb-8 lg:pt-6 lg:pb-10">
        <p className="text-sm font-semibold text-on-surface-variant">Votre compte, votre voix, vos langues</p>
        <h1 className="mt-2 text-4xl lg:text-5xl font-extrabold text-on-surface tracking-tight">Réglages</h1>
      </header>

      <div className="flex flex-col gap-6">
        <form onSubmit={saveAccount} noValidate className="flex flex-col gap-6">
          <Section title="Profil" subtitle="Ce qu’Aya et l’application affichent pour vous.">
            <div className="flex flex-wrap items-center gap-4">
              <UserAvatar className="w-20 h-20 ring-4 ring-primary-container/15" textClassName="text-2xl" />
              <div className="flex flex-wrap gap-2">
                <Button onClick={photoPicker.pick} variant="secondary" size="sm" icon="photo_camera">
                  Changer la photo
                </Button>
                {profile.photo && (
                  <Button
                    onClick={() => updateProfile({ photo: null })}
                    variant="ghost"
                    size="sm"
                    icon="delete"
                    className="text-error! hover:bg-error-container"
                  >
                    Retirer
                  </Button>
                )}
              </div>
              {photoPicker.input}
              {photoPicker.error && <p className="w-full text-xs font-medium text-error">{photoPicker.error}</p>}
            </div>

            <Field label="Nom complet ou prénom" htmlFor="settings-name">
              <input
                id="settings-name"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Koffi Aya Marcelle"
                className={INPUT_CLASS}
              />
            </Field>
          </Section>

          <Section title="Coordonnées" subtitle="Pour vous connecter et récupérer votre compte.">
            <Field label="Adresse email" htmlFor="settings-email">
              <input
                id="settings-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="aya.kouassi@email.ci"
                className={INPUT_CLASS}
              />
            </Field>

            <Field label="Numéro WhatsApp / Téléphone" htmlFor="settings-phone" hint="Orange, MTN, Moov ou Wave.">
              <div className="flex gap-2">
                <span className="h-14 shrink-0 px-4 rounded-2xl bg-surface-container-low border border-surface-container flex items-center gap-2 text-[16px] font-bold text-on-surface">
                  <Flag country="ci" className="w-6" labelled />
                  +225
                </span>
                <input
                  id="settings-phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  value={phone}
                  onChange={(e) => setPhone(formatIvorianPhone(e.target.value))}
                  placeholder="07 01 23 45 67"
                  className={`${INPUT_CLASS} min-w-0`}
                />
              </div>
            </Field>
          </Section>

          <Section title="Langue d’apprentissage" subtitle="La langue utilisée par défaut par Aya et dans les leçons.">
            <div role="radiogroup" aria-label="Langue d’apprentissage" className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {LANGUAGE_CHOICES.map((choice) => {
                const selected = language === choice.key;
                return (
                  <button
                    key={choice.key}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={choice.disabled}
                    onClick={() => setLanguage(choice.key)}
                    className={`h-16 px-5 rounded-2xl border text-left flex items-center justify-between gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${
                      selected
                        ? 'bg-primary border-primary text-white'
                        : 'bg-surface-container-low border-surface-container text-on-surface hover:border-outline-variant'
                    }`}
                  >
                    <span className="flex flex-col min-w-0">
                      <span className="text-[16px] font-bold truncate">{choice.label}</span>
                      <span className={`text-xs ${selected ? 'text-white/70' : 'text-on-surface-variant'}`}>
                        {choice.hint}
                      </span>
                    </span>
                    {selected && <span className="w-2.5 h-2.5 shrink-0 rounded-full bg-tertiary-fixed" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          </Section>

          {/* Barre d'enregistrement : apparaît dès qu'il y a une modification et reste visible en bas de l'écran */}
          {(isDirty || accountError) && (
            <div className="sticky bottom-24 lg:bottom-6 z-20 rounded-[28px] border border-surface-container-high bg-surface-container-lowest/95 backdrop-blur-md shadow-raised p-2 pl-5 flex flex-wrap items-center justify-between gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
              {accountError ? (
                <FormError message={accountError} />
              ) : (
                <span className="text-sm font-semibold text-on-surface-variant">Modifications non enregistrées</span>
              )}
              <div className="flex gap-2 ml-auto">
                <Button onClick={resetAccount} variant="secondary" size="md">
                  Annuler
                </Button>
                <Button type="submit" size="md" icon="check" disabled={!isDirty}>
                  Enregistrer
                </Button>
              </div>
            </div>
          )}
        </form>

        <form onSubmit={savePassword} noValidate>
          <Section title="Mot de passe" subtitle="8 caractères minimum, avec un chiffre et un symbole.">
            <Field label="Mot de passe actuel" htmlFor="settings-current-password">
              <PasswordField
                id="settings-current-password"
                value={currentPassword}
                onChange={setCurrentPassword}
                autoComplete="current-password"
              />
            </Field>
            <Field label="Nouveau mot de passe" htmlFor="settings-new-password">
              <PasswordField
                id="settings-new-password"
                value={newPassword}
                onChange={setNewPassword}
                autoComplete="new-password"
              />
              <div className="grid grid-cols-3 gap-2" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className={`h-1.5 rounded-full transition-colors ${
                      i < score ? (i === 2 ? 'bg-primary-container' : 'bg-secondary-container') : 'bg-surface-container-highest'
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs font-medium text-on-surface">
                Force : {newPassword ? STRENGTH_LABELS[score] : '—'}
              </span>
            </Field>
            <Field label="Confirmer le nouveau mot de passe" htmlFor="settings-confirm-password">
              <PasswordField
                id="settings-confirm-password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                autoComplete="new-password"
              />
            </Field>

            <FormError message={passwordError} />
            <Button type="submit" size="lg" icon="lock" className="self-start">
              Mettre à jour le mot de passe
            </Button>
          </Section>
        </form>

        <Section title="Session" subtitle="Vos réglages restent enregistrés sur cet appareil.">
          <Button
            onClick={onLogout}
            variant="secondary"
            size="lg"
            icon="logout"
            className="self-start text-error! hover:bg-error-container"
          >
            Se déconnecter
          </Button>
        </Section>
      </div>
    </div>
  );
};

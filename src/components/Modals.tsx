import React, { useState } from 'react';
import { ThemePreference } from '../utils/preferences';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import { Modal } from './ui/Modal';
import { LANGUAGE_LABEL } from '../data/languages';
import { BRAND_ASSETS, CULTURAL_STORIES, VOCABULARY_LIST } from '../data/mockData';
import { Language } from '../types';
import { soundEngine } from '../utils/audio';
import { voicePlayer } from '../utils/voicePlayer';
import { useVoiceConsent } from './VoiceConsent';

interface StoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StoryModal: React.FC<StoryModalProps> = ({ isOpen, onClose }) => {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  if (!isOpen) return null;
  const story = CULTURAL_STORIES[0];

  const handlePlayProverb = () => {
    if (isPlayingAudio) {
      voicePlayer.stop();
      setIsPlayingAudio(false);
      return;
    }
    setIsPlayingAudio(true);
    soundEngine.playTonePitch('Haut');
    voicePlayer.speak(story.audioPhrase, 'baoule', 0.9, () => {
      setIsPlayingAudio(false);
    });
  };

  return (
    <Modal onClose={onClose} overlayClassName="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in" className="w-full max-w-md bg-surface-container-lowest rounded-3xl p-5 shadow-overlay flex flex-col gap-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200 border border-surface-container">
        <div className="relative w-full h-44 rounded-2xl overflow-hidden shadow-soft">
          <img
            alt={story.title}
            src={story.image}
            decoding="async"
            className="w-full h-full object-cover"
          />
          <IconButton aria-label="Fermer" onClick={onClose} icon="close" size="sm" iconClassName="text-[18px]" className="absolute top-3 right-3 bg-black/40 text-white backdrop-blur-xs hover:bg-black/60" />
          <span className="absolute bottom-3 left-3 px-2.5 py-1 rounded-full bg-primary/80 backdrop-blur-xs text-tertiary-fixed text-[11px] font-bold">
            {story.category}
          </span>
        </div>

        <div>
          <h3 className="text-lg font-bold text-on-surface leading-snug">
            {story.title}
          </h3>
          <span className="text-xs text-outline">Lecture : {story.readTime}</span>
        </div>

        <p className="text-xs text-on-surface-variant leading-relaxed whitespace-pre-line">
          {story.content}
        </p>

        {/* Audio Proverb Player Card */}
        <div className="p-3.5 rounded-2xl bg-secondary-fixed/40 border border-secondary-fixed flex items-center justify-between gap-3">
          <div className="flex flex-col min-w-0">
            <span className="text-[11px] text-secondary font-bold uppercase tracking-wider">
              Proverbe en Baoulé
            </span>
            <p className="text-xs font-bold text-on-secondary-fixed truncate mt-0.5">
              « {story.audioPhrase} »
            </p>
            <span className="text-[11px] text-on-secondary-fixed-variant truncate">
              {story.audioTranslation}
            </span>
          </div>

          <button aria-label={isPlayingAudio ? 'Mettre en pause' : 'Écouter le proverbe'}
            onClick={handlePlayProverb}
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-90 ${
              isPlayingAudio
                ? 'bg-secondary text-white animate-pulse'
                : 'bg-secondary text-white shadow-soft'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">
              {isPlayingAudio ? 'pause' : 'volume_up'}
            </span>
          </button>
        </div>

        <Button onClick={onClose} size="sm" fullWidth>
          Fermer l'histoire
        </Button>
      </Modal>
  );
};

interface VocabularyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VocabularyModal: React.FC<VocabularyModalProps> = ({ isOpen, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  if (!isOpen) return null;

  const filtered = VOCABULARY_LIST.filter(
    (v) =>
      v.word.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.meaning.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Modal onClose={onClose} overlayClassName="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in" className="w-full max-w-md bg-surface-container-lowest rounded-3xl p-5 shadow-overlay flex flex-col gap-3 max-h-[85vh] overflow-y-auto animate-in zoom-in-95 duration-200 border border-surface-container">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-base font-bold text-on-surface">
              Lexique & expressions essentielles
            </h3>
            <p className="text-xs text-on-surface-variant">Vocabulaire pratique Baoulé & Dioula</p>
          </div>
          <IconButton aria-label="Fermer" onClick={onClose} icon="close" size="sm" iconClassName="text-[18px]" className="bg-surface-container text-on-surface-variant" />
        </div>

        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher un mot, un marché, une salutation..."
            className="w-full h-10 pl-9 pr-4 rounded-xl bg-surface-container-low text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container"
          />
          <span className="material-symbols-outlined absolute left-2.5 top-2.5 text-outline text-[18px]">
            search
          </span>
        </div>

        <div className="flex flex-col gap-2 pt-1 overflow-y-auto max-h-[50vh]">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="p-3 rounded-2xl bg-surface border border-surface-container flex items-center justify-between"
            >
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-primary-container">{item.word}</span>
                  <span className="text-[11px] text-outline">{item.phonetic}</span>
                  <span className="px-1.5 py-0.2 rounded bg-surface-container text-[9px] font-bold uppercase text-on-surface-variant">
                    {item.language}
                  </span>
                </div>
                <span className="text-xs text-on-surface font-medium mt-0.5">
                  {item.meaning}
                </span>
                <span className="text-xs text-outline italic mt-0.5">
                  « {item.example} » ({item.exampleMeaning})
                </span>
              </div>

              <IconButton aria-label="Écouter la prononciation" onClick={() => {
                  soundEngine.playTonePitch(item.tone);
                  voicePlayer.speak(item.word, item.language, 0.9);
                }} icon="volume_up" size="sm" iconClassName="text-[18px]" className="bg-surface-container hover:bg-primary-fixed text-primary-container active:scale-90 transition-transform ml-2" />
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-full bg-primary-container text-white text-xs font-bold active:scale-95 transition-transform"
        >
          Fermer le lexique
        </button>
      </Modal>
  );
};

const THEME_OPTIONS: readonly { key: ThemePreference; label: string; icon: string }[] = [
  { key: 'system', label: 'Auto', icon: 'brightness_auto' },
  { key: 'light', label: 'Clair', icon: 'light_mode' },
  { key: 'dark', label: 'Sombre', icon: 'dark_mode' },
];

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLanguage: Language;
  voiceFirst: boolean;
  onToggleVoiceFirst: () => void;
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
  onLogout: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  currentLanguage,
  voiceFirst,
  onToggleVoiceFirst,
  theme,
  onThemeChange,
  onLogout,
}) => {
  const { consent, withdraw } = useVoiceConsent();
  if (!isOpen) return null;

  return (
    <Modal onClose={onClose} overlayClassName="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in" className="w-full max-w-sm bg-surface-container-lowest rounded-3xl p-5 shadow-overlay flex flex-col gap-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200 border border-surface-container">
        <div className="flex justify-between items-center">
          <h3 className="text-base font-bold text-on-surface">Mon profil IvoirAI</h3>
          <IconButton aria-label="Fermer" onClick={onClose} icon="close" size="sm" iconClassName="text-[18px]" className="bg-surface-container text-on-surface-variant" />
        </div>

        <div className="flex flex-col items-center text-center gap-2">
          <div className="relative">
            <img
              src={BRAND_ASSETS.edithProfile}
              alt="Portrait Edith"
              className="w-20 h-20 rounded-full object-cover shadow-soft ring-4 ring-primary-container/20"
            />
            <span className="absolute bottom-0 right-1 w-4 h-4 bg-tertiary-fixed rounded-full ring-2 ring-white"></span>
          </div>

          <div>
            <h4 className="text-base font-bold text-on-surface">Edith Kouadio</h4>
            <span className="text-xs text-on-surface-variant">kouadioedith440@gmail.com</span>
          </div>

          <div className="flex items-center gap-2 mt-1">
            <span className="px-3 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed text-xs font-bold">
              Intermédiaire B2
            </span>
            <span className="px-3 py-1 rounded-full bg-primary-fixed text-on-primary-fixed text-xs font-bold">
              840 XP
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-2 border-t border-surface-container">
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface-container-low">
            <span className="text-xs text-on-surface font-semibold">Tuteur IA actif</span>
            <span className="text-xs text-primary-container font-bold">Aya d'Abidjan</span>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface-container-low">
            <span className="text-xs text-on-surface font-semibold">Langue favorite</span>
            <span className="text-xs text-primary-container font-bold">
              {LANGUAGE_LABEL[currentLanguage]}
            </span>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface-container-low">
            <span className="text-xs text-on-surface font-semibold">Série de connexion</span>
            <span className="text-xs text-secondary font-bold inline-flex items-center gap-1">
              7 jours consécutifs
              <span className="material-symbols-outlined fill text-[16px]">local_fire_department</span>
            </span>
          </div>

          <VoiceFirstSwitch checked={voiceFirst} onToggle={onToggleVoiceFirst} />

          <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-surface-container-low">
            <span className="text-xs text-on-surface font-semibold">Apparence</span>
            <div role="radiogroup" aria-label="Apparence" className="flex p-0.5 rounded-full bg-surface-container">
              {THEME_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  role="radio"
                  aria-checked={theme === option.key}
                  onClick={() => onThemeChange(option.key)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors ${
                    theme === option.key ? 'bg-primary-container text-white' : 'text-on-surface-variant'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">{option.icon}</span>
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-surface-container-low">
            <div className="flex flex-col min-w-0">
              <span className="text-xs text-on-surface font-semibold">Utilisation de ma voix</span>
              <span className="text-xs text-on-surface-variant">
                {consent
                  ? `Acceptée le ${new Date(consent.acceptedAt).toLocaleDateString('fr-FR')}${
                      consent.improveModel ? ' • aide à l’amélioration' : ''
                    }`
                  : 'Non accordée : demandée au premier enregistrement'}
              </span>
            </div>
            {consent && (
              <button
                onClick={withdraw}
                className="shrink-0 px-3 py-1.5 rounded-full bg-surface-container-lowest text-error text-xs font-bold border border-surface-container active:scale-95 transition-transform"
              >
                Retirer
              </button>
            )}
          </div>
        </div>

        <Button onClick={onClose} size="sm" fullWidth>
          Retour à l'application
        </Button>
        <button
          onClick={onLogout}
          className="w-full py-2.5 -mt-2 rounded-full text-error text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-error-container transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">logout</span>
          Se déconnecter
        </button>
      </Modal>
  );
};

/** Interrupteur du mode « voix d'abord », partagé par le profil et l'accueil. */
export const VoiceFirstSwitch: React.FC<{ checked: boolean; onToggle: () => void }> = ({
  checked,
  onToggle,
}) => (
  <button
    role="switch"
    aria-checked={checked}
    onClick={onToggle}
    className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-surface-container-low text-left w-full"
  >
    <span className="flex flex-col min-w-0">
      <span className="text-xs text-on-surface font-semibold">Mode voix d’abord</span>
      <span className="text-xs text-on-surface-variant">Réponses lues à voix haute, textes agrandis</span>
    </span>
    <span
      className={`relative w-11 h-6 rounded-full shrink-0 transition-colors ${
        checked ? 'bg-primary-container' : 'bg-outline-variant'
      }`}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-surface-container-lowest shadow transition-all ${
          checked ? 'left-[22px]' : 'left-0.5'
        }`}
      />
    </span>
  </button>
);

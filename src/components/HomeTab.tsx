import React, { useState } from 'react';
import { LanguageToggle } from './LanguageToggle';
import { useToast } from '../hooks/useToast';
import { Toast } from './Toast';
import { Language } from '../types';
import { soundEngine } from '../utils/audio';
import { voicePlayer } from '../utils/voicePlayer';

interface HomeTabProps {
  currentLanguage: Language;
  onLanguageChange: (lang: Language) => void;
  onOpenVoiceSession: () => void;
  onNavigateTab: (tab: 'discussions' | 'traduire' | 'apprendre') => void;
  onOpenStoryModal: () => void;
  onOpenVocabularyModal: () => void;
  onSelectDiscussion: (title: string, lang: Language) => void;
  voiceFirst: boolean;
  onToggleVoiceFirst: () => void;
}

const handlePlayHelp = () => {
  voicePlayer.speak(
    "Bienvenue sur IvoirAI. Appuyez sur le grand bouton micro pour parler à Aya en Baoulé ou en Dioula. Elle vous répondra à voix haute.",
    'fr',
    0.95
  );
};

export const HomeTab: React.FC<HomeTabProps> = ({
  currentLanguage,
  onLanguageChange,
  onOpenVoiceSession,
  onNavigateTab,
  onOpenStoryModal,
  onOpenVocabularyModal,
  onSelectDiscussion,
  voiceFirst,
  onToggleVoiceFirst,
}) => {
  const [isPlayingWord, setIsPlayingWord] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const { toast: toastMessage, showToast } = useToast(2500);

  const handlePlayWord = () => {
    if (isPlayingWord) return;
    setIsPlayingWord(true);
    soundEngine.playTonePitch(currentLanguage === 'dioula' ? 'Moyen' : 'Haut');
    voicePlayer.speak(
      currentLanguage === 'dioula' ? 'An Sɔgɔma. Bonjour !' : 'Akwaba ! Bienvenue !',
      currentLanguage,
      0.9,
      () => setIsPlayingWord(false)
    );
  };

  const handleToggleBookmark = () => {
    setIsBookmarked(!isBookmarked);
    showToast(
      !isBookmarked
        ? 'Expression enregistrée dans votre lexique personnel !'
        : 'Expression retirée des favoris.'
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 w-full gap-5 lg:gap-6 pb-10">
      {/* Toast Notification */}
      <Toast message={toastMessage} icon="check_circle" />

      {/* Top User Profile & Welcome Bar */}
      <section className="lg:col-span-7 flex items-center justify-between bg-white p-4 lg:p-5 rounded-3xl shadow-[0_4px_20px_-2px_rgba(0,75,73,0.05)] border border-[#edeef0]/60">
        <div className="flex flex-col min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#3f4948]">
            Bienvenue
          </p>
          <h2 className="text-2xl lg:text-3xl font-bold text-[#1a1c1d] truncate mt-1">
            Akwaba, Edith
          </h2>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {voiceFirst && (
            <button
              onClick={handlePlayHelp}
              aria-label="Écouter l'aide"
              className="w-11 h-11 rounded-full bg-[#ffdbd2] text-[#3c0800] flex items-center justify-center active:scale-95 transition-transform"
            >
              <span className="material-symbols-outlined text-[22px]">help</span>
            </button>
          )}
          <button
            onClick={onToggleVoiceFirst}
            aria-pressed={voiceFirst}
            className={`h-11 px-3 rounded-full flex items-center gap-1.5 text-xs font-bold transition-colors active:scale-95 ${
              voiceFirst ? 'bg-[#004b49] text-white' : 'bg-[#f3f3f5] text-[#3f4948] hover:bg-[#edeef0]'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">record_voice_over</span>
            <span className="hidden min-[400px]:inline">Mode voix</span>
          </button>
        </div>
      </section>

      {/* Interactive Language Toggle Pill */}
      <section className="lg:col-span-5 flex justify-center lg:justify-end items-center w-full">
        <LanguageToggle
          value={currentLanguage}
          onChange={onLanguageChange}
          className="w-full max-w-sm"
          options={[
            { key: 'baoule', label: 'Baoulé', hint: '(Akan)' },
            { key: 'dioula', label: 'Dioula', hint: '(Mandé)' },
          ]}
        />
      </section>

      {/* Hero Voice Interactive Card */}
      <section className="lg:col-span-7 flex flex-col justify-center relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#004b49] via-[#003331] to-[#002422] text-white p-6 lg:p-10 shadow-[0_16px_36px_-6px_rgba(0,43,41,0.35)]">
        {/* Traditional Geometric Accent Watermark Pattern */}
        <svg
          className="absolute -right-8 -top-8 w-52 h-52 text-[#62fae3] opacity-10 pointer-events-none"
          fill="currentColor"
          viewBox="0 0 100 100"
        >
          <path d="M50 0 L100 50 L50 100 L0 50 Z M50 20 L80 50 L50 80 L20 50 Z" />
          <circle cx="50" cy="50" r="12" />
          <polygon
            fill="none"
            points="50,5 95,50 50,95 5,50"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>

        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#004c43]/80 backdrop-blur-md text-[#62fae3] text-xs font-semibold mb-2 shadow-xs border border-[#62fae3]/20">
            <span className="material-symbols-outlined text-[14px]">graphic_eq</span>
            <span>Reconnaissance vocale ivoirienne</span>
          </div>

          <h3 className="text-xl lg:text-3xl font-bold text-white max-w-xs lg:max-w-md leading-snug">
            {currentLanguage === 'baoule'
              ? 'Parlez en Baoulé authentique'
              : 'Parlez en Dioula véhiculaire'}
          </h3>

          <p className="text-xs lg:text-sm text-[#7ebab7] mt-1.5 max-w-xs lg:max-w-md leading-relaxed">
            L'IA comprend vos dialectes, intonations et accents ivoiriens sans filtre.
          </p>

          {/* Central Floating Microphone with Animated Waves */}
          <div className="relative my-6 flex items-center justify-center">
            {/* Concentric Glow Pulse Rings */}
            <div className="absolute w-28 h-28 rounded-full bg-[#62fae3]/20 animate-ping opacity-60 pointer-events-none"></div>
            <div className="absolute w-24 h-24 rounded-full bg-[#3cddc7]/30 animate-pulse pointer-events-none"></div>

            {/* Interactive Orb Button */}
            <button
              onClick={onOpenVoiceSession}
              aria-label="Démarrer la discussion vocale"
              className="relative z-20 w-20 h-20 rounded-full bg-gradient-to-tr from-[#3cddc7] to-[#62fae3] text-[#003331] flex items-center justify-center shadow-[0_0_32px_8px_rgba(60,221,199,0.45)] hover:scale-105 active:scale-95 transition-all duration-200 group"
            >
              <span className="material-symbols-outlined text-[36px] font-bold group-hover:scale-110 transition-transform">
                mic
              </span>
            </button>
          </div>

          <button
            type="button"
            onClick={onOpenVoiceSession}
            className="flex items-center gap-2 cursor-pointer hover:opacity-90 active:scale-95 transition-all"
          >
            <span className="w-2 h-2 rounded-full bg-[#fe8b6d] animate-pulse"></span>
            <span className="text-xs text-white font-semibold tracking-wide">
              Appuyez pour parler en direct
            </span>
          </button>
        </div>
      </section>

      {/* Daily Learning Card: Mot du Jour */}
      <section className="lg:col-span-5 bg-white p-5 lg:p-6 rounded-3xl shadow-[0_6px_24px_-4px_rgba(0,75,73,0.06)] relative overflow-hidden border border-[#edeef0]/60">
        <div className="absolute top-0 left-0 w-2 h-full bg-[#9e4229]"></div>

        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#9e4229] text-[18px]">lightbulb</span>
              <span className="text-xs uppercase tracking-wider text-[#9e4229] font-bold">
                Mot du jour • {currentLanguage === 'dioula' ? 'Dioula' : 'Baoulé'}
              </span>
            </div>

            <h4 className="text-xl text-[#1a1c1d] font-extrabold mt-1">
              {currentLanguage === 'dioula' ? 'An Sɔgɔma' : 'Akwaba !'}
            </h4>
            <span className="text-xs text-[#707978] font-medium tracking-tight mt-0.5">
              {currentLanguage === 'dioula' ? '[ An Sɔ-gɔ-ma ]' : '[ Ah-kwah-bah ]'}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handlePlayWord}
              aria-label="Écouter la prononciation"
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all shadow-sm active:scale-95 ${
                isPlayingWord
                  ? 'bg-[#62fae3] text-[#003331] animate-pulse'
                  : 'bg-[#ffdbd2] text-[#3c0800] hover:scale-105'
              }`}
            >
              <span className="material-symbols-outlined text-[22px]">
                {isPlayingWord ? 'graphic_eq' : 'volume_up'}
              </span>
            </button>

            <button
              onClick={handleToggleBookmark}
              aria-label="Sauvegarder dans mon lexique"
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors active:scale-95 ${
                isBookmarked
                  ? 'bg-[#fe8b6d]/30 text-[#9e4229]'
                  : 'bg-[#f3f3f5] text-[#3f4948] hover:text-[#9e4229]'
              }`}
            >
              <span
                className={`material-symbols-outlined text-[22px] ${
                  isBookmarked ? 'fill' : ''
                }`}
              >
                bookmark
              </span>
            </button>
          </div>
        </div>

        {/* Meaning & Cultural Context */}
        <div className="mt-4 p-3.5 rounded-2xl bg-[#f3f3f5]">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2 mb-1">
            <span className="text-xs text-[#1a1c1d] font-bold">Traduction :</span>
            <span className="text-xs text-[#9e4229] font-bold">
              {currentLanguage === 'dioula'
                ? '« Bonjour / Bonne matinée »'
                : '« Bienvenue / Sois le bienvenu »'}
            </span>
          </div>
          <p className="text-xs text-[#3f4948] italic">
            {currentLanguage === 'dioula'
              ? '« An sɔgɔma, i ka kɛnɛ wa ? »'
              : '« Akwaba o awlo nun, an nian amun bo »'}
          </p>
          <span className="text-xs text-[#707978] block mt-0.5">
            {currentLanguage === 'dioula'
              ? '(Bonjour, te portes-tu bien ?)'
              : '(Bienvenue dans notre maison, installez-vous paisiblement)'}
          </span>
        </div>

        {/* Pronunciation Micro Tip */}
        <div className="mt-3 flex items-center gap-2 text-[#3f4948] text-xs pt-1">
          <span className="material-symbols-outlined text-[#fe8b6d] text-[18px] shrink-0">
            record_voice_over
          </span>
          <span>
            {currentLanguage === 'dioula' ? (
              <>
                Le <strong>« ɔ »</strong> s'ouvre légèrement comme dans « port » en français
                d'Abidjan.
              </>
            ) : (
              <>
                Le <strong>« kwa »</strong> se prononce avec une douce glissade tonale montante.
              </>
            )}
          </span>
        </div>
      </section>

      {/* Quick Actions Grid */}
      <section className="lg:col-span-12 flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm lg:text-base font-bold text-[#1a1c1d]">Pratique Rapide</h3>
          <button
            disabled
            onClick={() => onNavigateTab('apprendre')}
            className="text-xs text-[#9e4229] font-bold hover:underline"
          >
            Explorer tout
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4">
          {/* Action 1: Traduire */}
          <button
            onClick={() => onNavigateTab('traduire')}
            className="bg-white p-4 lg:p-5 rounded-3xl shadow-[0_4px_16px_-2px_rgba(0,75,73,0.04)] hover:shadow-md transition-all flex flex-col justify-between text-left group active:scale-[0.98] border border-[#edeef0]/60"
          >
            <div className="w-12 h-12 rounded-2xl bg-[#b1eeea] text-[#00201f] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[26px]">translate</span>
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#1a1c1d] leading-tight">Traduire</h4>
              <p className="text-xs text-[#3f4948] mt-1">Instant voice & texte</p>
            </div>
          </button>

          {/* Action 2: Tuteur IA */}
          <button
            onClick={() => onNavigateTab('discussions')}
            className="bg-white p-4 lg:p-5 rounded-3xl shadow-[0_4px_16px_-2px_rgba(0,75,73,0.04)] hover:shadow-md transition-all flex flex-col justify-between text-left group active:scale-[0.98] border border-[#edeef0]/60"
          >
            <div className="w-12 h-12 rounded-2xl bg-[#ffdbd2] text-[#3c0800] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[26px]">psychology</span>
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#1a1c1d] leading-tight">Tuteur IA</h4>
              <p className="text-xs text-[#3f4948] mt-1">Correction vocale</p>
            </div>
          </button>

          {/* Action 3: Vocabulaire */}
          <button
            onClick={onOpenVocabularyModal}
            className="bg-white p-4 lg:p-5 rounded-3xl shadow-[0_4px_16px_-2px_rgba(0,75,73,0.04)] hover:shadow-md transition-all flex flex-col justify-between text-left group active:scale-[0.98] border border-[#edeef0]/60"
          >
            <div className="w-12 h-12 rounded-2xl bg-[#004c43] text-[#62fae3] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[26px]">storefront</span>
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#1a1c1d] leading-tight">Vocabulaire</h4>
              <p className="text-xs text-[#3f4948] mt-1">Marché & Salutations</p>
            </div>
          </button>

          {/* Action 4: Histoires */}
          <button
            onClick={onOpenStoryModal}
            className="bg-white p-4 lg:p-5 rounded-3xl shadow-[0_4px_16px_-2px_rgba(0,75,73,0.04)] hover:shadow-md transition-all flex flex-col justify-between text-left group active:scale-[0.98] border border-[#edeef0]/60"
          >
            <div className="w-12 h-12 rounded-2xl bg-[#edeef0] text-[#9e4229] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[26px]">auto_stories</span>
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#1a1c1d] leading-tight">Histoires</h4>
              <p className="text-xs text-[#3f4948] mt-1">Contes & sagesses</p>
            </div>
          </button>
        </div>
      </section>

      {/* Cultural Inspiration & Visual Strip */}
      {/* <section
        onClick={onOpenStoryModal}
        className="bg-white p-4 rounded-3xl shadow-[0_4px_16px_-2px_rgba(0,75,73,0.04)] flex items-center gap-4 cursor-pointer hover:shadow-md transition-all border border-[#edeef0]/60 group"
      >
        <div className="relative w-20 h-20 rounded-2xl overflow-hidden shrink-0 shadow-sm">
          <img
            alt="Pagne Baoulé tissé"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            src={BRAND_ASSETS.baouleTextile}
          />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-xs text-[#9e4229] font-bold uppercase">
            Patrimoine Oral
          </span>
          <h5 className="text-sm text-[#1a1c1d] font-bold truncate mt-0.5">
            La sagesse du pagne Baoulé
          </h5>
          <p className="text-xs text-[#3f4948] line-clamp-2 mt-1 leading-relaxed">
            Découvrez les proverbes ancestraux tissés dans les motifs traditionnels avec l'écoute guidée.
          </p>
        </div>
      </section> */}

      {/* Recent Discussions Section */}
      <section className="lg:col-span-12 flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm lg:text-base font-bold text-[#1a1c1d]">Discussions Récentes</h3>
          <button
            onClick={() => onNavigateTab('discussions')}
            className="text-xs text-[#9e4229] font-bold hover:underline"
          >
            Historique
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 lg:gap-4">
          {/* Card 1 */}
          <div
            className="relative bg-white p-3.5 rounded-3xl shadow-[0_2px_12px_rgba(0,75,73,0.03)] hover:shadow-md transition-all flex items-center justify-between gap-3 cursor-pointer border border-[#edeef0]/60 active:scale-[0.99]"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-[#fe8b6d]/20 text-[#9e4229] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[24px]">shopping_bag</span>
              </div>
              <div className="flex flex-col min-w-0">
                <h4 className="text-sm text-[#1a1c1d] font-bold truncate">
                  Négociation au Marché de Treichville
                </h4>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs text-[#707978]">
                  <span className="px-2 py-0.5 rounded-full bg-[#edeef0] text-[11px] text-[#1a1c1d] font-bold">
                    Dioula
                  </span>
                  <span>•</span>
                  <span>Il y a 2h</span>
                  <span>•</span>
                  <span className="text-[#3f4948]">3 messages</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => onSelectDiscussion('Négociation au Marché de Treichville', 'dioula')}
              aria-label="Continuer la discussion : Négociation au Marché de Treichville"
              className="after:absolute after:inset-0 after:rounded-3xl w-9 h-9 rounded-full bg-[#f3f3f5] text-[#3f4948] flex items-center justify-center shrink-0 hover:bg-[#003331] hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>

          {/* Card 2 */}
          <div
            className="relative bg-white p-3.5 rounded-3xl shadow-[0_2px_12px_rgba(0,75,73,0.03)] hover:shadow-md transition-all flex items-center justify-between gap-3 cursor-pointer border border-[#edeef0]/60 active:scale-[0.99]"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-[#004b49]/10 text-[#004b49] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[24px]">handshake</span>
              </div>
              <div className="flex flex-col min-w-0">
                <h4 className="text-sm text-[#1a1c1d] font-bold truncate">
                  Salutations traditionnelles en pays Baoulé
                </h4>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs text-[#707978]">
                  <span className="px-2 py-0.5 rounded-full bg-[#edeef0] text-[11px] text-[#1a1c1d] font-bold">
                    Baoulé
                  </span>
                  <span>•</span>
                  <span>Hier</span>
                  <span>•</span>
                  <span className="text-[#3f4948] flex items-center gap-0.5">
                    <span className="material-symbols-outlined text-[14px] text-[#3cddc7]">
                      mic
                    </span>
                    1m 45s
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={() => onSelectDiscussion('Salutations traditionnelles en pays Baoulé', 'baoule')}
              aria-label="Continuer la discussion : Salutations traditionnelles en pays Baoulé"
              className="after:absolute after:inset-0 after:rounded-3xl w-9 h-9 rounded-full bg-[#f3f3f5] text-[#3f4948] flex items-center justify-center shrink-0 hover:bg-[#003331] hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

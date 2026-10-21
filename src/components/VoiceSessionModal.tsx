import React, { useEffect, useState } from 'react';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { BRAND_ASSETS } from '../data/mockData';
import { Language } from '../types';
import { soundEngine } from '../utils/audio';
import { voicePlayer } from '../utils/voicePlayer';

interface VoiceSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialLanguage?: Language;
}

const formatTimer = (totalSecs: number) => {
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

export const VoiceSessionModal: React.FC<VoiceSessionModalProps> = ({
  isOpen,
  onClose,
  initialLanguage = 'dioula',
}) => {
  const [currentDialect, setCurrentDialect] = useState<Language>(initialLanguage);
  const [isMuted, setIsMuted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [seconds, setSeconds] = useState(161); // 02:41
  const [speakingState, setSpeakingState] = useState<'listening' | 'speaking' | 'paused'>(
    'listening'
  );
  const [accuracyScore, setAccuracyScore] = useState(94);

  // Active transcription based on language
  const [currentPhrase] = useState({
    dioula: {
      text: '« I ka kɛnɛ wa ? Mun lo b\'i fɛ bi ? »',
      phonetics: ['[i-ka-kɛ-nɛ]', '[wa]', '[mun-lo-bi-fɛ]'],
      tone: 'Ton : Interrogatif monté',
      translation: '« Comment vas-tu ? Qu\'aimerais-tu explorer ou faire aujourd\'hui ? »',
      feedback: 'Voyelle nasale « ɛ » bien articulée',
    },
    baoule: {
      text: '« Akwaba ! Nzoué o ? N kplo kɛ n wun wɔ. »',
      phonetics: ['[ah-kwah-bah]', '[n-zoo-eh]', '[n-kplo-keh]'],
      tone: 'Ton : Accueil & Salutation haute',
      translation: '« Bienvenue ! Comment te portes-tu ? Je suis ravie de converser avec toi. »',
      feedback: 'Élévation tonale sur « Nzoué » excellente',
    },
  });

  useEffect(() => {
    if (!isOpen) return;
    let timer: NodeJS.Timeout;
    if (!isPaused) {
      timer = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isOpen, isPaused]);

  useEscapeKey(isOpen, () => {
    voicePlayer.stop();
    onClose();
  });

  if (!isOpen) return null;

  const handleOrbClick = () => {
    if (isPaused) return;

    if (speakingState === 'listening') {
      setSpeakingState('speaking');
      soundEngine.playTonePitch(currentDialect === 'dioula' ? 'Ton Haut-Bas' : 'Ton Haut');
      const textToSpeak =
        currentDialect === 'dioula'
          ? 'I ka kɛnɛ wa ? Mun lo bi fɛ bi ? N bɛ kɔfɛ.'
          : 'Akwaba ! Nzoué o ? N kplo kɛ n wun wɔ.';

      voicePlayer.speak(textToSpeak, currentDialect, 0.95, () => {
        setSpeakingState('listening');
        setAccuracyScore(Math.min(99, 90 + Math.floor(Math.random() * 9)));
      });
    } else {
      voicePlayer.stop();
      setSpeakingState('listening');
    }
  };

  const toggleDialect = () => {
    const next = currentDialect === 'dioula' ? 'baoule' : 'dioula';
    setCurrentDialect(next);
    soundEngine.playTone(520, 0.2);
  };

  const togglePause = () => {
    const nextPaused = !isPaused;
    setIsPaused(nextPaused);
    if (nextPaused) {
      voicePlayer.stop();
      setSpeakingState('paused');
    } else {
      setSpeakingState('listening');
    }
    soundEngine.playTone(330, 0.2);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    soundEngine.playTone(isMuted ? 440 : 220, 0.15);
  };

  const handleEndCall = () => {
    voicePlayer.stop();
    soundEngine.playTone(280, 0.3);
    onClose();
  };

  const activeContent =
    currentDialect === 'baoule'
      ? currentPhrase.baoule
      : currentPhrase.dioula;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Session vocale"
      className="fixed inset-0 z-50 bg-[#f9f9fb] flex flex-col justify-between overflow-y-auto animate-in fade-in duration-300"
    >
      {/* Top Header Bar */}
      <div className="sticky top-0 z-10 w-full bg-[#f9f9fb]/90 backdrop-blur-md px-4 sm:px-6 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-2 border-b border-[#edeef0]">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              aria-label="Retour"
              className="w-10 h-10 -ml-1 rounded-full flex items-center justify-center text-[#1a1c1d] hover:bg-[#edeef0] active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-[24px]">arrow_back</span>
            </button>
            <img
              src={BRAND_ASSETS.logo}
              alt="Logo"
              className="h-7 w-7 object-contain"
            />
            <h1 className="text-base font-bold text-[#1a1c1d] tracking-tight">
              Session vocale
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleDialect}
              className="px-2.5 py-1 rounded-full bg-[#ffdbd2] text-[#9e4229] text-xs font-bold active:scale-95 transition-all flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[14px]">swap_horiz</span>
              <span>{currentDialect === 'dioula' ? 'Dioula' : 'Baoulé'}</span>
            </button>
            <img
              src={BRAND_ASSETS.edithProfile}
              alt="Edith"
              className="w-7 h-7 rounded-full object-cover ring-1 ring-[#004b49]/20"
            />
          </div>
        </div>
      </div>

      {/* Main Vocal Content Area */}
      <div className="flex-1 max-w-md sm:max-w-lg lg:max-w-xl w-full mx-auto px-4 sm:px-6 py-4 lg:py-8 flex flex-col justify-between gap-4">
        {/* Floating Session Context Controls */}
        <div className="flex items-center justify-between w-full">
          {/* Center Status: Live Timer Pill & Dialect selector */}
          <div className="flex items-center gap-2 w-full">
            <div className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full bg-[#e2e2e4] shadow-xs flex-1 min-w-0">
              <span className="w-2 h-2 rounded-full bg-[#9e4229] animate-ping"></span>
              <span className="w-2 h-2 rounded-full bg-[#9e4229] -ml-3.5"></span>
              <span className="text-xs font-bold text-[#1a1c1d] tracking-wide uppercase whitespace-nowrap">
                En direct • {formatTimer(seconds)}
              </span>
            </div>

            <button
              onClick={toggleDialect}
              className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-full bg-[#003331] text-white text-xs font-bold active:scale-95 transition-all shadow-sm flex-1 min-w-0"
            >
              <span className="truncate">{currentDialect === 'dioula' ? 'Dioula (Mandé)' : 'Baoulé (Akan)'}</span>
              {/* <span className="material-symbols-outlined text-[16px]">arrow_drop_down</span> */}
            </button>
          </div>
        </div>

        {/* AI Companion Avatar Badge */}
        <div className="flex items-center justify-center gap-3">
          <div className="relative">
            <img
              className="w-11 h-11 rounded-full object-cover shadow-sm ring-2 ring-[#004b49]/20"
              alt="Aya Tuteur"
              src={BRAND_ASSETS.ayaAvatar}
            />
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#3cddc7] ring-2 ring-[#f9f9fb]"></span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-[#1a1c1d] leading-tight">
              Aya d'IvoirAI
            </span>
            <span className="text-xs text-[#3f4948]">
              Tuteur vocal natif • Abidjan
            </span>
          </div>
        </div>

        {/* Central Visualizer: 3D Organic Glowing Voice Sphere & Particle Halo */}
        <div className="relative w-full flex flex-col items-center justify-center py-2">
          {/* Halo Aura Layer 1 */}
          <div className="absolute w-64 h-64 rounded-full bg-gradient-to-tr from-[#95d1ce]/20 via-[#62fae3]/30 to-[#fe8b6d]/20 blur-2xl animate-pulse pointer-events-none"></div>

          {/* Outer Resonant SVG Wave Ripples */}
          <svg className="w-72 h-72 absolute pointer-events-none" fill="none" viewBox="0 0 300 300">
            <circle
              className="text-[#3cddc7] opacity-25"
              cx="150"
              cy="150"
              r="130"
              stroke="currentColor"
              strokeDasharray="6 8"
              strokeWidth="1.5"
            >
              <animateTransform
                attributeName="transform"
                dur="24s"
                from="0 150 150"
                repeatCount="indefinite"
                to="360 150 150"
                type="rotate"
              />
            </circle>
            <circle
              className="text-[#fe8b6d] opacity-30"
              cx="150"
              cy="150"
              r="112"
              stroke="currentColor"
              strokeDasharray="3 5"
              strokeWidth="1.2"
            >
              <animateTransform
                attributeName="transform"
                dur="18s"
                from="360 150 150"
                repeatCount="indefinite"
                to="0 150 150"
                type="rotate"
              />
            </circle>
          </svg>

          {/* Central Liquid Audio Orb Container */}
          <div
            id="voice-orb"
            role="button"
            tabIndex={0}
            aria-label={speakingState === 'speaking' ? 'Interrompre Aya' : 'Écouter la réponse d’Aya'}
            onClick={handleOrbClick}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleOrbClick();
              }
            }}
            className={`relative z-10 w-44 h-44 rounded-full p-2 flex items-center justify-center cursor-pointer transition-all duration-300 shadow-[0_12px_40px_rgba(0,51,49,0.2)] ${
              speakingState === 'speaking'
                ? 'scale-105 shadow-[0_0_50px_rgba(98,250,227,0.5)]'
                : 'hover:scale-105 active:scale-95'
            }`}
          >
            {/* Multilayered Liquid Gradients */}
            <div className="w-full h-full rounded-full bg-gradient-to-br from-[#004b49] via-[#003331] to-[#9e4229] flex items-center justify-center relative overflow-hidden">
              {/* Liquid Organic Wave Reflections */}
              <div className="absolute -top-10 -left-10 w-36 h-36 rounded-full bg-[#3cddc7]/40 blur-xl animate-pulse"></div>
              <div className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full bg-[#fe8b6d]/45 blur-lg"></div>

              {/* Pulsing Sound Wave Core Motif */}
              <div className="flex items-center gap-1.5 z-20">
                <span
                  className={`w-1.5 rounded-full bg-white/80 transition-all ${
                    speakingState === 'speaking'
                      ? 'h-8 animate-[bounce_0.8s_infinite_100ms]'
                      : 'h-6'
                  }`}
                ></span>
                <span
                  className={`w-1.5 rounded-full bg-white transition-all ${
                    speakingState === 'speaking'
                      ? 'h-14 animate-[bounce_1s_infinite_200ms]'
                      : 'h-11'
                  }`}
                ></span>
                <span
                  className={`w-2 rounded-full bg-[#62fae3] shadow-xs transition-all ${
                    speakingState === 'speaking'
                      ? 'h-18 animate-[bounce_0.7s_infinite_50ms]'
                      : 'h-16'
                  }`}
                ></span>
                <span
                  className={`w-1.5 rounded-full bg-white transition-all ${
                    speakingState === 'speaking'
                      ? 'h-12 animate-[bounce_0.9s_infinite_300ms]'
                      : 'h-10'
                  }`}
                ></span>
                <span
                  className={`w-1.5 rounded-full bg-white/70 transition-all ${
                    speakingState === 'speaking'
                      ? 'h-7 animate-[bounce_0.75s_infinite_150ms]'
                      : 'h-5'
                  }`}
                ></span>
              </div>
            </div>
          </div>

          {/* Real-time Audio EQ Indicator & Status */}
          <div className="mt-5 flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#edeef0] shadow-xs">
              <div className="flex items-end gap-1 h-3.5 px-0.5">
                <span
                  className={`w-1 bg-[#003331] rounded-full transition-all ${
                    speakingState === 'speaking'
                      ? 'h-3.5 animate-pulse'
                      : 'h-2'
                  }`}
                ></span>
                <span
                  className={`w-1 bg-[#004c43] rounded-full transition-all ${
                    speakingState === 'speaking'
                      ? 'h-4 animate-pulse delay-75'
                      : 'h-3.5'
                  }`}
                ></span>
                <span
                  className={`w-1 bg-[#9e4229] rounded-full transition-all ${
                    speakingState === 'speaking'
                      ? 'h-3 animate-pulse delay-150'
                      : 'h-2.5'
                  }`}
                ></span>
                <span
                  className={`w-1 bg-[#004b49] rounded-full transition-all ${
                    speakingState === 'speaking'
                      ? 'h-4 animate-pulse delay-200'
                      : 'h-3'
                  }`}
                ></span>
              </div>
              <span className="text-xs font-bold text-[#1a1c1d]">
                {isPaused
                  ? 'Conversation en pause'
                  : speakingState === 'speaking'
                  ? `Aya formule sa réponse en ${currentDialect === 'dioula' ? 'Dioula' : 'Baoulé'}...`
                  : 'Aya écoute votre accent...'}
              </span>
            </div>
            <p className="text-xs text-[#3f4948] text-center max-w-[280px]">
              Parlez naturellement. Le modèle détecte les tons hauts et bas.
            </p>
          </div>
        </div>

        {/* Live Transcript Glassmorphism Card */}
        <div className="w-full bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-sm border border-[#edeef0] flex flex-col gap-2 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#9e4229] text-[18px]">
                record_voice_over
              </span>
              <span className="text-xs text-[#3f4948] font-bold uppercase tracking-wider">
                Transcription en direct
              </span>
            </div>

            <span className="px-2 py-0.5 rounded-full bg-[#ffdbd2] text-[#3c0800] text-[11px] font-bold">
              {activeContent.tone}
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <p className="text-base font-bold text-[#1a1c1d] tracking-tight">
              {activeContent.text}
            </p>

            <div className="flex items-center gap-1.5 flex-wrap">
              {activeContent.phonetics.map((syl: string, i: number) => (
                <React.Fragment key={i}>
                  <span className="px-1.5 py-0.5 rounded bg-[#edeef0] text-[#3f4948] text-xs font-mono">
                    {syl}
                  </span>
                  {i < activeContent.phonetics.length - 1 && (
                    <span className="text-[#bfc8c7] text-xs">•</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="pt-1 flex items-start gap-2 border-t border-[#edeef0]/60">
            <span className="material-symbols-outlined text-[#707978] text-[16px] mt-0.5">
              translate
            </span>
            <p className="text-xs text-[#3f4948] italic">
              {activeContent.translation}
            </p>
          </div>
        </div>

        {/* Live Audio Feedback Snapshot Card */}
        <div className="w-full bg-[#edeef0] rounded-2xl p-3.5 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#004c43] text-white flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">graphic_eq</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-[#1a1c1d] truncate">
                Précision tonale
              </span>
              <span className="text-xs text-[#3f4948] truncate">
                {activeContent.feedback}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0 px-2.5 py-1 rounded-full bg-[#b1eeea] text-[#00201f] text-xs font-extrabold">
            <span>{accuracyScore}%</span>
          </div>
        </div>

        {/* Floating Dock Action Controls */}
        <div className="w-full pt-1 pb-[calc(1rem+env(safe-area-inset-bottom))] flex items-center justify-between gap-2">
          {/* Mute Mic Button */}
          <button
            onClick={toggleMute}
            className={`flex-1 h-13 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all shadow-xs active:scale-95 ${
              isMuted
                ? 'bg-[#ffdad6] text-[#ba1a1a]'
                : 'bg-[#e2e2e4] text-[#1a1c1d] hover:bg-[#d9dadc]'
            }`}
          >
            <span className="material-symbols-outlined text-[22px]">
              {isMuted ? 'mic_off' : 'mic'}
            </span>
            <span className="text-[11px] font-semibold">
              {isMuted ? 'Coupé' : 'Micro'}
            </span>
          </button>

          {/* Pause Session Button */}
          <button
            onClick={togglePause}
            className={`flex-1 h-13 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all shadow-xs active:scale-95 ${
              isPaused
                ? 'bg-[#b1eeea] text-[#00201f]'
                : 'bg-[#e2e2e4] text-[#1a1c1d] hover:bg-[#d9dadc]'
            }`}
          >
            <span className="material-symbols-outlined text-[22px]">
              {isPaused ? 'play_circle' : 'pause_circle'}
            </span>
            <span className="text-[11px] font-semibold">
              {isPaused ? 'Reprendre' : 'Pause'}
            </span>
          </button>

          {/* Language Switch Dialect Button */}
          <button
            onClick={toggleDialect}
            className="flex-1 h-13 rounded-2xl bg-[#e2e2e4] hover:bg-[#d9dadc] active:scale-95 text-[#1a1c1d] flex flex-col items-center justify-center gap-0.5 transition-all shadow-xs"
          >
            <span className="material-symbols-outlined text-[22px]">swap_horiz</span>
            <span className="text-[11px] font-semibold">
              {currentDialect === 'dioula' ? 'Baoulé' : 'Dioula'}
            </span>
          </button>

          {/* End Call Red Button */}
          <button
            onClick={handleEndCall}
            aria-label="Terminer la session vocale"
            className="w-13 h-13 rounded-2xl bg-[#ba1a1a] hover:bg-[#93000a] active:scale-90 text-white flex items-center justify-center transition-all shadow-md shrink-0"
          >
            <span className="material-symbols-outlined text-[26px]">call_end</span>
          </button>
        </div>
      </div>
    </div>
  );
};

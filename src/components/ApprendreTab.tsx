import React, { useState } from 'react';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { LEARNING_MODULES, QUIZ_QUESTIONS } from '../data/mockData';
import { Language, LearningModule, QuizQuestion } from '../types';
import { soundEngine } from '../utils/audio';
import { voicePlayer, VOICE_LABEL } from '../utils/voicePlayer';

interface ApprendreTabProps {
  currentLanguage: Language;
  onLanguageChange: (lang: Language) => void;
  onOpenVoiceSession: () => void;
}

export const ApprendreTab: React.FC<ApprendreTabProps> = ({
  currentLanguage,
  onLanguageChange,
  onOpenVoiceSession,
}) => {
  const [isPlayingNative, setIsPlayingNative] = useState(false);
  const [isRecordingUser, setIsRecordingUser] = useState(false);
  const [userScore, setUserScore] = useState(96);
  const [hasPracticed, setHasPracticed] = useState(true);
  const [selectedModule, setSelectedModule] = useState<LearningModule | null>(null);
  useEscapeKey(selectedModule !== null, () => setSelectedModule(null));
  const [isQuizOpen, setIsQuizOpen] = useState(false);
  useEscapeKey(isQuizOpen, () => setIsQuizOpen(false));
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizSelectedOption, setQuizSelectedOption] = useState<string | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [isQuizComplete, setIsQuizComplete] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const currentExercise =
    currentLanguage === 'dioula'
      ? {
          title: 'Exercice du Jour • Niveau Débutant',
          french: '« Merci beaucoup pour votre accueil chaleureux. »',
          dialectLabel: 'Dioula véhiculaire',
          tone: 'Ton Haut',
          phrase: 'I ni ce kosɛbɛ ! I dansé.',
          phonetics: '[Ee nee tché koh-seh-beh ! Ee dahn-say]',
          speakerLocation: 'Abidjan (Treichville)',
        }
      : {
          title: 'Exercice du Jour • Niveau Débutant',
          french: '« Merci beaucoup pour votre accueil chaleureux. »',
          dialectLabel: 'Baoulé authentique',
          tone: 'Ton Haut',
          phrase: 'Mo kpa kpa ! Akwaba kpa.',
          phonetics: '[Moh kpah kpah ! Ah-kwah-bah kpah]',
          speakerLocation: 'Yamoussoukro',
        };

  const handlePlayNative = () => {
    if (isPlayingNative) {
      voicePlayer.stop();
      setIsPlayingNative(false);
      return;
    }

    setIsPlayingNative(true);
    soundEngine.playTonePitch('Ton Haut');
    voicePlayer.speak(currentExercise.phrase, currentLanguage, 0.9, () => {
      setIsPlayingNative(false);
    });
  };

  const handleToggleRecord = () => {
    if (isRecordingUser) {
      setIsRecordingUser(false);
      soundEngine.playSuccess();
      const generatedScore = Math.floor(92 + Math.random() * 7);
      setUserScore(generatedScore);
      setHasPracticed(true);
      showToast(`Bravo ! Score IA : ${generatedScore}% - Accent tonique maîtrisé !`);
    } else {
      setIsRecordingUser(true);
      soundEngine.playTone(660, 0.2);
      showToast('Écoute de votre articulation... Répétez maintenant !');
    }
  };

  // Interactive Quiz Handlers
  const handleStartQuiz = () => {
    setQuizIndex(0);
    setQuizSelectedOption(null);
    setQuizScore(0);
    setIsQuizComplete(false);
    setIsQuizOpen(true);
    // Play initial audio question
    setTimeout(() => {
      soundEngine.playTonePitch(QUIZ_QUESTIONS[0].correctTone);
      voicePlayer.speak(QUIZ_QUESTIONS[0].proverb, currentLanguage, 0.9);
    }, 400);
  };

  const handlePlayQuizAudio = (q: QuizQuestion) => {
    soundEngine.playTonePitch(q.correctTone);
    voicePlayer.speak(q.proverb, currentLanguage, 0.85);
  };

  const handleAnswerQuiz = (option: 'Haut' | 'Bas' | 'Moyen') => {
    if (quizSelectedOption) return;
    setQuizSelectedOption(option);

    const curQ = QUIZ_QUESTIONS[quizIndex];
    const isCorrect = option === curQ.correctTone;

    if (isCorrect) {
      soundEngine.playSuccess();
      setQuizScore((prev) => prev + 1);
    } else {
      soundEngine.playTone(220, 0.3);
    }

    setTimeout(() => {
      if (quizIndex < QUIZ_QUESTIONS.length - 1) {
        const nextIdx = quizIndex + 1;
        setQuizIndex(nextIdx);
        setQuizSelectedOption(null);
        handlePlayQuizAudio(QUIZ_QUESTIONS[nextIdx]);
      } else {
        setIsQuizComplete(true);
      }
    }, 1500);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 lg:items-start w-full pb-10 gap-5 lg:gap-6">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-20 lg:top-24 left-1/2 lg:left-[calc(50%+8rem)] -translate-x-1/2 z-50 max-w-[calc(100vw-2rem)] px-4 py-2 rounded-full bg-[#003331] text-white text-xs font-semibold shadow-lg animate-in fade-in flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px] text-[#62fae3]">check_circle</span>
          <span>{toast}</span>
        </div>
      )}

      {/* Top Greeting & Streak Banner */}
      <section className="lg:col-span-12 flex flex-col space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-6 lg:items-center">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            <span className="text-xs text-[#9e4229] font-bold uppercase tracking-wider">
              Tuteur Vocal & Culture
            </span>
            <h2 className="text-xl lg:text-2xl text-[#1a1c1d] font-bold leading-tight">
              Atelier de Langues
            </h2>
            <p className="text-xs text-[#3f4948]">
              Pratiquez l'oral et enrichissez votre vocabulaire au quotidien.
            </p>
          </div>
          <div className="p-2.5 bg-[#ffdbd2] text-[#3c0800] rounded-2xl shadow-xs flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[24px]">school</span>
          </div>
        </div>

        {/* Streak Card */}
        <div className="bg-gradient-to-r from-[#004b49] via-[#003331] to-[#084f4d] rounded-2xl p-4 text-white shadow-md relative overflow-hidden">
          <div className="absolute -right-6 -bottom-6 w-28 h-28 bg-[#62fae3]/10 rounded-full blur-xl pointer-events-none"></div>

          <div className="relative z-10 flex items-center justify-between gap-2">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-[#fe8b6d] text-[#75240e] flex items-center justify-center shadow-inner">
                <span className="material-symbols-outlined text-[26px]">
                  local_fire_department
                </span>
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-x-1.5">
                  <span className="text-sm font-bold text-[#62fae3]">
                    7 jours consécutifs
                  </span>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#62fae3]"></span>
                  <span className="text-xs text-[#7ebab7]">Série active</span>
                </div>
                <p className="text-xs text-[#edeef0] opacity-90">
                  42 mots et locutions maîtrisés
                </p>
              </div>
            </div>

            <button
              onClick={() => showToast('Historique des 30 derniers jours consultable')}
              aria-label="Voir statistiques"
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all flex items-center justify-center text-white"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>

          {/* Weekly Progress Micro-Dots */}
          <div className="grid grid-cols-7 gap-1.5 mt-3 pt-3 bg-white/5 rounded-xl px-2.5 py-1.5 border border-white/5">
            {['L', 'M', 'M', 'J', 'V', 'S'].map((day, idx) => (
              <div key={idx} className="flex flex-col items-center">
                <span className="text-[11px] text-[#62fae3] opacity-75">{day}</span>
                <span className="material-symbols-outlined text-[14px] text-[#62fae3]">
                  check_circle
                </span>
              </div>
            ))}
            <div className="flex flex-col items-center">
              <span className="text-[11px] text-[#fe8b6d] font-bold">D</span>
              <span className="w-3.5 h-3.5 rounded-full bg-[#fe8b6d] flex items-center justify-center text-[11px] font-bold text-[#75240e]">
                7
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Segmented Language Control */}
      <section className="lg:col-span-12 w-full">
        <div className="bg-[#edeef0] p-1 rounded-full flex relative shadow-inner lg:max-w-md">
          <button
            onClick={() => onLanguageChange('baoule')}
            className={`flex-1 py-2 px-3 rounded-full text-xs font-bold transition-all duration-300 flex items-center justify-center space-x-1.5 ${
              currentLanguage === 'baoule'
                ? 'bg-[#004b49] text-white shadow-sm'
                : 'text-[#3f4948] hover:text-[#1a1c1d]'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                currentLanguage === 'baoule' ? 'bg-[#62fae3]' : 'bg-[#bfc8c7]'
              }`}
            ></span>
            <span className="truncate">Baoulé (Centre & Sud)</span>
          </button>

          <button
            onClick={() => onLanguageChange('dioula')}
            className={`flex-1 py-2 px-3 rounded-full text-xs font-bold transition-all duration-300 flex items-center justify-center space-x-1.5 ${
              currentLanguage === 'dioula'
                ? 'bg-[#004b49] text-white shadow-sm'
                : 'text-[#3f4948] hover:text-[#1a1c1d]'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                currentLanguage === 'dioula' ? 'bg-[#62fae3]' : 'bg-[#bfc8c7]'
              }`}
            ></span>
            <span className="truncate">Dioula (Nord & Commerce)</span>
          </button>
        </div>
      </section>

      {/* Pronunciation Trainer Hero Interactive Widget */}
      <section className="lg:col-span-7 lg:row-span-2 bg-white rounded-3xl p-5 lg:p-6 shadow-sm space-y-4 border border-[#edeef0]">
        {/* Card Header Tag & Progress */}
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-[#ffdbd2]/60 text-[#7e2b14] rounded-full">
            <span className="material-symbols-outlined text-[14px] text-[#9e4229]">
              record_voice_over
            </span>
            <span className="text-xs font-bold">{currentExercise.title}</span>
          </div>
          <span className="text-xs text-[#707978] font-semibold">Vocale #24</span>
        </div>

        {/* Linguistic Phrase Container */}
        <div className="bg-[#f3f3f5] rounded-2xl p-4 space-y-3">
          <div>
            <p className="text-xs text-[#707978] font-bold uppercase tracking-wider">
              Français
            </p>
            <p className="text-sm text-[#1a1c1d] font-semibold mt-0.5">
              {currentExercise.french}
            </p>
          </div>

          <div className="pt-2 border-t border-[#edeef0]">
            <div className="flex items-center justify-between">
              <p className="text-xs text-[#003331] font-bold uppercase tracking-wider flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px]">translate</span>
                <span>{currentExercise.dialectLabel}</span>
              </p>
              <span className="px-2 py-0.5 rounded bg-[#3cddc7]/30 text-[#005047] text-[11px] font-bold">
                {currentExercise.tone}
              </span>
            </div>
            <p className="text-lg text-[#004b49] font-extrabold tracking-tight mt-1">
              {currentExercise.phrase}
            </p>
            <p className="text-xs text-[#9e4229] font-medium tracking-wide mt-0.5">
              {currentExercise.phonetics}
            </p>
          </div>
        </div>

        {/* Audio Player Native Speaker */}
        <div className="flex items-center justify-between p-3 bg-[#edeef0] rounded-2xl">
          <div className="flex items-center space-x-3">
            <button
              onClick={handlePlayNative}
              aria-label="Écouter le locuteur natif"
              className={`w-11 h-11 rounded-full flex items-center justify-center shadow-md active:scale-90 transition-transform ${
                isPlayingNative ? 'bg-[#62fae3] text-[#003331]' : 'bg-[#003331] text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[22px]">
                {isPlayingNative ? 'pause' : 'play_arrow'}
              </span>
            </button>
            <div>
              <p className="text-xs font-bold text-[#1a1c1d]">
                Locuteur natif ({currentExercise.speakerLocation})
              </p>
              <p className="text-xs text-[#3f4948]">
                {VOICE_LABEL}
              </p>
            </div>
          </div>

          {/* Animated Waveform Simulation */}
          <div className="flex items-center space-x-1 h-6 pr-2">
            {[8, 16, 24, 12, 20].map((h, i) => (
              <div
                key={i}
                style={{
                  height: isPlayingNative ? `${Math.max(6, (h * 1.3) % 24)}px` : `${h}px`,
                }}
                className={`w-1 rounded-full transition-all duration-200 ${
                  isPlayingNative ? 'bg-[#004c43] animate-pulse' : 'bg-[#004c43]/40'
                }`}
              ></div>
            ))}
          </div>
        </div>

        {/* Record Mic Interactive Button */}
        <div className="flex flex-col items-center py-2 space-y-2">
          <div className="relative flex items-center justify-center">
            {isRecordingUser && (
              <div className="absolute w-20 h-20 rounded-full bg-[#fe8b6d]/40 animate-ping"></div>
            )}
            <button
              onClick={handleToggleRecord}
              aria-label="Enregistrer votre voix"
              className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-all duration-200 ${
                isRecordingUser
                  ? 'bg-[#ba1a1a] text-white scale-105'
                  : 'bg-gradient-to-tr from-[#9e4229] to-[#fe8b6d] text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[30px]">
                {isRecordingUser ? 'stop' : 'mic'}
              </span>
            </button>
          </div>
          <span
            className={`text-xs font-semibold ${
              isRecordingUser ? 'text-[#9e4229] animate-pulse font-bold' : 'text-[#3f4948]'
            }`}
          >
            {isRecordingUser
              ? 'Écoute active... Parlez maintenant !'
              : 'Appuyez pour enregistrer votre voix'}
          </span>
        </div>

        {/* AI Feedback Score Widget */}
        {hasPracticed && (
          <div className="bg-[#f3f3f5] rounded-2xl p-4 space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-[#004c43] text-white flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                </div>
                <span className="text-sm font-bold text-[#003331]">
                  Score IA : {userScore}%
                </span>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-[#b1eeea] text-[#084f4d] font-bold">
                🌟 Magistral
              </span>
            </div>

            {/* Meter Visual */}
            <div className="w-full bg-[#e2e2e4] rounded-full h-2 overflow-hidden">
              <div
                style={{ width: `${userScore}%` }}
                className="bg-gradient-to-r from-[#004c43] to-[#3cddc7] h-2 rounded-full transition-all duration-500"
              ></div>
            </div>

            {/* Feedback Criteria Details */}
            <div className="grid grid-cols-3 gap-2 pt-1 text-center">
              <div className="bg-white p-2.5 rounded-xl shadow-xs border border-[#edeef0]">
                <span className="material-symbols-outlined text-[#004c43] text-[18px]">
                  graphic_eq
                </span>
                <p className="text-[11px] text-[#707978] mt-0.5">Intonation</p>
                <p className="text-xs text-[#003331] font-bold">Excellente</p>
              </div>

              <div className="bg-white p-2.5 rounded-xl shadow-xs border border-[#edeef0]">
                <span className="material-symbols-outlined text-[#004c43] text-[18px]">
                  speed
                </span>
                <p className="text-[11px] text-[#707978] mt-0.5">Rythme</p>
                <p className="text-xs text-[#003331] font-bold">Fluide</p>
              </div>

              <div className="bg-white p-2.5 rounded-xl shadow-xs border border-[#edeef0]">
                <span className="material-symbols-outlined text-[#9e4229] text-[18px]">
                  verified
                </span>
                <p className="text-[11px] text-[#707978] mt-0.5">Accent tonique</p>
                <p className="text-xs text-[#9e4229] font-bold">Parfait</p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Categorized Learning Modules */}
      <section className="lg:col-span-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold text-[#1a1c1d]">Modules d'Immersion</h3>
            <p className="text-xs text-[#3f4948]">
              Thématiques adaptées aux contextes de vie ivoiriens.
            </p>
          </div>
          <button
            onClick={() => showToast('4 modules interactifs disponibles')}
            className="text-xs text-[#004b49] font-bold flex items-center hover:underline"
          >
            Tout voir
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          </button>
        </div>

        {/* Modules Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-3">
          {LEARNING_MODULES.map((mod) => (
            <div
              key={mod.id}
              className="relative bg-white p-3 rounded-2xl shadow-xs flex flex-col justify-between space-y-2.5 hover:bg-[#f9f9fb] transition-all cursor-pointer border border-[#edeef0] group active:scale-[0.98]"
            >
              <button
                type="button"
                onClick={() => setSelectedModule(mod)}
                aria-label={`Ouvrir le module ${mod.title}`}
                className="absolute inset-0 z-10 rounded-2xl"
              />
              <div className="space-y-2">
                <div className="w-full h-24 rounded-xl overflow-hidden relative shadow-xs">
                  <img
                    alt={mod.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    src={mod.imageUrl}
                  />
                  {mod.tag && (
                    <span
                      className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        mod.tag === 'Populaire'
                          ? 'bg-[#9e4229] text-white'
                          : mod.tag === 'Acquis'
                          ? 'bg-[#b1eeea] text-[#084f4d]'
                          : 'bg-[#fe8b6d] text-[#75240e]'
                      }`}
                    >
                      {mod.tag}
                    </span>
                  )}
                </div>

                <div>
                  <h4 className="text-xs font-bold text-[#1a1c1d] leading-tight line-clamp-1">
                    {mod.title}
                  </h4>
                  <p className="text-xs text-[#707978] mt-0.5 truncate">
                    {mod.subtitle}
                  </p>
                </div>
              </div>

              {mod.progress === 100 ? (
                <div className="flex items-center space-x-1.5 py-1 px-2 rounded-lg bg-[#edeef0] text-[#003331] text-[11px] font-bold">
                  <span className="material-symbols-outlined text-[14px] text-[#004c43]">
                    verified
                  </span>
                  <span>Terminé à 100% ✅</span>
                </div>
              ) : (
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-[11px] text-[#3f4948]">
                    <span>Progression</span>
                    <span className="font-bold text-[#004b49]">{mod.progress}%</span>
                  </div>
                  <div className="w-full bg-[#e2e2e4] rounded-full h-1.5 overflow-hidden">
                    <div
                      style={{ width: `${mod.progress}%` }}
                      className="bg-[#004b49] h-1.5 rounded-full"
                    ></div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Daily Audio Quiz Card */}
      <section className="lg:col-span-5 bg-gradient-to-br from-[#ffdbd2] via-[#f3f3f5] to-white rounded-3xl p-5 shadow-xs relative overflow-hidden border border-[#edeef0]">
        <div className="flex items-start justify-between gap-3 relative z-10">
          <div className="space-y-2 max-w-[70%]">
            <div className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-[#9e4229] text-white text-[11px] font-bold">
              <span className="material-symbols-outlined text-[12px]">headphones</span>
              <span>Défi d'écoute</span>
            </div>

            <h4 className="text-base text-[#1a1c1d] font-bold leading-tight">
              Testez votre oreille (Quiz Audio)
            </h4>

            <p className="text-xs text-[#3f4948]">
              Distinguez le ton haut et le ton bas sur 3 proverbes d'affilée pour gagner 50 XP.
            </p>

            <div className="pt-2">
              <button
                onClick={handleStartQuiz}
                className="px-4 py-2.5 rounded-full bg-[#004b49] text-white text-xs font-bold shadow-md hover:bg-[#003331] active:scale-95 transition-all inline-flex items-center space-x-2"
              >
                <span className="material-symbols-outlined text-[18px]">play_circle</span>
                <span>Lancer le Quiz Audio</span>
              </button>
            </div>
          </div>

          <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-2xl bg-[#fe8b6d]/30 flex items-center justify-center text-[#9e4229] shadow-xs">
            <span className="material-symbols-outlined text-[42px]">hearing</span>
          </div>
        </div>
      </section>

      {/* Interactive Module Detail Modal */}
      {selectedModule && (
        <div
          onClick={() => setSelectedModule(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md bg-white rounded-3xl p-5 shadow-2xl flex flex-col gap-4 max-h-[85vh] overflow-y-auto animate-in zoom-in-95 duration-200"
          >
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs text-[#9e4229] font-bold uppercase">
                  {selectedModule.category}
                </span>
                <h3 className="text-lg font-bold text-[#1a1c1d]">
                  {selectedModule.title}
                </h3>
                <p className="text-xs text-[#3f4948]">{selectedModule.subtitle}</p>
              </div>
              <button
                onClick={() => setSelectedModule(null)}
                className="w-8 h-8 rounded-full bg-[#edeef0] flex items-center justify-center text-[#3f4948]"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {selectedModule.lessons.map((lesson, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-[#f3f3f5] border border-[#edeef0] flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#004b49]">
                      Leçon {idx + 1} : {lesson.title}
                    </span>
                    <button
                      onClick={() => {
                        soundEngine.playTonePitch('Haut');
                        voicePlayer.speak(lesson.phrase, currentLanguage, 0.9);
                      }}
                      className="w-8 h-8 rounded-full bg-[#004b49] text-white flex items-center justify-center active:scale-90 transition-transform"
                    >
                      <span className="material-symbols-outlined text-[16px]">volume_up</span>
                    </button>
                  </div>
                  <p className="text-xs text-[#3f4948]">{lesson.description}</p>
                  <p className="text-sm font-bold text-[#1a1c1d] mt-1">
                    « {lesson.phrase} »
                  </p>
                  <span className="text-xs text-[#9e4229] italic">
                    {lesson.translation}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                showToast(`Session pratique sur "${selectedModule.title}" lancée`);
                setSelectedModule(null);
                onOpenVoiceSession();
              }}
              className="w-full py-2.5 rounded-full bg-[#004b49] text-white text-xs font-bold active:scale-95 transition-transform"
            >
              Pratiquer vocalement avec Aya
            </button>
          </div>
        </div>
      )}

      {/* Interactive Quiz Modal */}
      {isQuizOpen && (
        <div
          onClick={() => setIsQuizOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200"
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#9e4229]">headphones</span>
                <span className="text-sm font-bold text-[#1a1c1d]">Quiz Tonalité Ivoirienne</span>
              </div>
              <button
                onClick={() => setIsQuizOpen(false)}
                className="w-7 h-7 rounded-full bg-[#edeef0] flex items-center justify-center text-[#3f4948]"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>

            {!isQuizComplete ? (
              <>
                <div className="flex items-center justify-between text-xs text-[#3f4948]">
                  <span>
                    Question {quizIndex + 1} sur {QUIZ_QUESTIONS.length}
                  </span>
                  <span className="font-bold text-[#004b49]">
                    Score : {quizScore} / {QUIZ_QUESTIONS.length}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-[#f3f3f5] flex flex-col items-center text-center gap-2 border border-[#edeef0]">
                  <span className="text-xs text-[#9e4229] font-bold uppercase">
                    {QUIZ_QUESTIONS[quizIndex].language}
                  </span>
                  <p className="text-lg font-extrabold text-[#004b49]">
                    {QUIZ_QUESTIONS[quizIndex].proverb}
                  </p>
                  <span className="text-xs text-[#707978]">
                    {QUIZ_QUESTIONS[quizIndex].phonetic}
                  </span>
                  <span className="text-xs text-[#1a1c1d] italic">
                    « {QUIZ_QUESTIONS[quizIndex].french} »
                  </span>

                  <button
                    onClick={() => handlePlayQuizAudio(QUIZ_QUESTIONS[quizIndex])}
                    className="mt-2 px-3 py-1.5 rounded-full bg-[#004b49] text-white text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-transform"
                  >
                    <span className="material-symbols-outlined text-[16px]">volume_up</span>
                    <span>Réécouter la voix</span>
                  </button>
                </div>

                <p className="text-xs text-[#1a1c1d] font-bold text-center">
                  Quel est le ton dominant de cette expression ?
                </p>

                <div className="grid grid-cols-3 gap-2">
                  {(['Haut', 'Moyen', 'Bas'] as const).map((opt) => {
                    const isSelected = quizSelectedOption === opt;
                    const isCorrect = opt === QUIZ_QUESTIONS[quizIndex].correctTone;
                    let btnStyle = 'bg-[#edeef0] text-[#1a1c1d] hover:bg-[#e2e2e4]';

                    if (quizSelectedOption) {
                      if (isCorrect) {
                        btnStyle = 'bg-[#62fae3] text-[#00201c] font-bold ring-2 ring-[#004b49]';
                      } else if (isSelected) {
                        btnStyle = 'bg-[#ffdad6] text-[#ba1a1a] font-bold';
                      }
                    }

                    return (
                      <button
                        key={opt}
                        disabled={!!quizSelectedOption}
                        onClick={() => handleAnswerQuiz(opt)}
                        className={`py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${btnStyle}`}
                      >
                        Ton {opt}
                      </button>
                    );
                  })}
                </div>

                {quizSelectedOption && (
                  <p className="text-xs text-[#3f4948] bg-[#f9f9fb] p-2.5 rounded-xl text-center leading-relaxed">
                    {QUIZ_QUESTIONS[quizIndex].explanation}
                  </p>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center text-center gap-3 py-3 animate-in zoom-in-90">
                <div className="w-16 h-16 rounded-full bg-[#b1eeea] text-[#00201f] flex items-center justify-center shadow-md">
                  <span className="material-symbols-outlined text-[36px]">celebration</span>
                </div>
                <h4 className="text-lg font-bold text-[#004b49]">Félicitations !</h4>
                <p className="text-xs text-[#3f4948]">
                  Vous avez obtenu un score de <strong>{quizScore} sur {QUIZ_QUESTIONS.length}</strong>.
                  Vous remportez <span className="text-[#9e4229] font-bold">+50 XP</span> pour votre oreille ivoirienne !
                </p>
                <button
                  onClick={() => setIsQuizOpen(false)}
                  className="w-full py-2.5 rounded-full bg-[#004b49] text-white text-xs font-bold active:scale-95 transition-transform mt-2"
                >
                  Continuer mon entraînement
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

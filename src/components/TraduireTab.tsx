import React, { useEffect, useRef, useState } from 'react';
import { categoryIcon, LANGUAGE_LABEL } from '../data/languages';
import { Flag } from './Flag';
import { closeOnBackdrop } from '../utils/backdrop';
import { useToast } from '../hooks/useToast';
import { Toast } from './Toast';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { recorderErrorMessage, useAudioRecorder } from '../hooks/useAudioRecorder';
import { api, TextLanguage, TranslateResult } from '../services';
import { useVoiceConsent } from './VoiceConsent';
import { VOCABULARY_LIST } from '../data/mockData';
import { Language, VocabularyItem } from '../types';
import { soundEngine } from '../utils/audio';
import { voicePlayer } from '../utils/voicePlayer';

const LANG_SUBTITLE: Record<TextLanguage, string> = {
  fr: 'Standard',
  baoule: 'Akan authentique',
  dioula: 'Marché / véhiculaire',
  bete: 'Krou',
};

type SourceLanguage = TextLanguage | 'auto';

/** Langues proposées dans les sélecteurs (le Bété est hors périmètre V1). */
const TARGET_OPTIONS: readonly TextLanguage[] = ['fr', 'baoule', 'dioula'];
const SOURCE_OPTIONS: readonly SourceLanguage[] = ['auto', ...TARGET_OPTIONS];

/** Option suivante dans la liste, en sautant celle déjà prise de l'autre côté. */
const nextOption = <T extends SourceLanguage>(options: readonly T[], current: T, other: SourceLanguage): T => {
  let i = options.indexOf(current);
  do {
    i = (i + 1) % options.length;
  } while (options[i] === other);
  return options[i];
};

const sourceLabel = (lang: SourceLanguage) => (lang === 'auto' ? 'Détection auto' : LANGUAGE_LABEL[lang]);

const playVocabAudio = (text: string, tone: string, language: Language) => {
  soundEngine.playTonePitch(tone);
  voicePlayer.speak(text, language, 1.0);
};

interface TraduireTabProps {
  currentLanguage: Language;
  onLanguageChange: (lang: Language) => void;
  /** Lit automatiquement la traduction d'une phrase dictée. */
  voiceFirst: boolean;
}

export const TraduireTab: React.FC<TraduireTabProps> = ({
  currentLanguage,
  onLanguageChange,
  voiceFirst,
}) => {
  const [sourceLang, setSourceLang] = useState<SourceLanguage>('fr');
  const [targetLang, setTargetLang] = useState<TextLanguage>(
    currentLanguage === 'dioula' ? 'dioula' : 'baoule'
  );
  const [lastTrans, setLastTrans] = useState<TranslateResult | null>(null);
  /** Clé de la dernière demande terminée (succès ou échec). */
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const [translateFailed, setTranslateFailed] = useState(false);
  const speakNextResultRef = useRef(false);
  const [retryCount, setRetryCount] = useState(0);
  const [sourceText, setSourceText] = useState('Combien coûte le régime de bananes plantain ?');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioSpeedIdx, setAudioSpeedIdx] = useState(0);
  const recorder = useAudioRecorder();
  const { ensureConsent } = useVoiceConsent();
  const isDictating = recorder.status === 'recording';
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(true);
  const [savedExpressions, setSavedExpressions] = useState<VocabularyItem[]>(VOCABULARY_LIST);
  const { toast, showToast } = useToast(2200);
  const [isDualMicModalOpen, setIsDualMicModalOpen] = useState(false);
  useEscapeKey(isDualMicModalOpen, () => setIsDualMicModalOpen(false));

  // Texte vidé : on n'affiche plus l'ancienne traduction
  const hasText = sourceText.trim() !== '';
  const currentTrans = hasText ? lastTrans : null;
  // Une traduction est en cours tant que la demande actuelle n'a pas reçu de réponse
  const requestKey = [sourceText.trim(), sourceLang, targetLang, retryCount].join('|');
  const isTranslatingShown = hasText && settledKey !== requestKey;

  const speeds = ['0.8x', '1.0x', '0.5x'];

  const handleSwap = () => {
    // En détection auto, la langue reconnue devient la nouvelle cible
    const resolvedSource =
      sourceLang === 'auto' ? currentTrans?.detectedSource ?? 'fr' : sourceLang;
    const newTarget =
      resolvedSource === targetLang ? nextOption(TARGET_OPTIONS, targetLang, targetLang) : resolvedSource;
    setSourceLang(targetLang);
    setTargetLang(newTarget);
    if (currentTrans?.translation) setSourceText(currentTrans.translation);
    if (newTarget !== 'fr') onLanguageChange(newTarget);
    soundEngine.playTone(520, 0.15);
  };

  const handleChangeSource = () => {
    const next = nextOption(SOURCE_OPTIONS, sourceLang, targetLang);
    setSourceLang(next);
    showToast(`Langue source : ${sourceLabel(next)}`);
  };

  const handleChangeTarget = () => {
    const next = nextOption(TARGET_OPTIONS, targetLang, sourceLang);
    setTargetLang(next);
    if (next !== 'fr') onLanguageChange(next);
    else showToast('Langue cible : Français');
  };

  const handleClear = () => {
    setSourceText('');
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setSourceText(text);
        showToast('Texte collé !');
      }
    } catch {
      setSourceText('An bɛ taa yɔrɔ juman ?');
      showToast('Exemple de phrase inséré !');
    }
  };

  const handleVoiceInput = async () => {
    if (isTranscribing) return;
    if (!isDictating) {
      if (!(await ensureConsent())) {
        showToast('Sans votre accord, vous pouvez taper votre phrase.');
        return;
      }
      if (await recorder.start()) {
        soundEngine.playTone(600, 0.15);
        showToast('Je vous écoute… appuyez sur Stop pour terminer.');
      }
      return;
    }
    const audio = await recorder.stop();
    if (!audio) return;
    setIsTranscribing(true);
    try {
      const hint = sourceLang === 'fr' || sourceLang === 'auto' ? undefined : sourceLang;
      const { text } = await api.transcribe(audio, hint);
      speakNextResultRef.current = voiceFirst;
      setSourceText(text);
      showToast('Dictée vocale transcrite !');
    } catch {
      showToast('La transcription a échoué. Réessayez.');
    } finally {
      setIsTranscribing(false);
    }
  };

  useEffect(() => {
    if (recorder.error) showToast(recorderErrorMessage[recorder.error]);
  }, [recorder.error, showToast]);

  // Traduit à chaque modification, après une courte pause de frappe
  useEffect(() => {
    const text = sourceText.trim();
    if (!text) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const result = await api.translate({ text, source: sourceLang, target: targetLang });
        if (!cancelled) {
          setLastTrans(result);
          setTranslateFailed(false);
          if (speakNextResultRef.current) {
            speakNextResultRef.current = false;
            voicePlayer.speak(result.translation, targetLang);
          }
        }
      } catch {
        if (!cancelled) setTranslateFailed(true);
      } finally {
        if (!cancelled) setSettledKey(requestKey);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // requestKey inclut retryCount : c'est lui qui relance la traduction après « Réessayer ».
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [requestKey, sourceText, sourceLang, targetLang]);

  const handlePlayAudio = () => {
    if (isPlayingAudio || !currentTrans) return;
    setIsPlayingAudio(true);
    soundEngine.playTonePitch(currentTrans.tone);

    const speedVal = parseFloat(speeds[audioSpeedIdx].replace('x', ''));
    voicePlayer.speak(currentTrans.translation, targetLang, speedVal, () => {
      setIsPlayingAudio(false);
    });
  };

  const handleToggleSpeed = () => {
    const nextIdx = (audioSpeedIdx + 1) % speeds.length;
    setAudioSpeedIdx(nextIdx);
    soundEngine.playTone(400, 0.1);
  };

  const handleCopy = async () => {
    if (!currentTrans) return;
    try {
      await navigator.clipboard.writeText(currentTrans.translation);
      showToast('Traduction copiée dans le presse-papiers !');
    } catch {
      showToast('Copie impossible sur cet appareil.');
    }
  };

  const handleShare = () => {
    if (!currentTrans) return;
    if (navigator.share) {
      navigator
        .share({
          title: 'Traduction IvoirAI',
          text: [currentTrans.translation, currentTrans.phonetic].filter(Boolean).join(' '),
        })
        .catch(() => undefined); // partage annulé par l'utilisateur
    } else {
      void handleCopy();
    }
  };

  const toggleFavoriteItem = (id: string) => {
    setSavedExpressions((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, isFavorite: !item.isFavorite } : item
      )
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 w-full pb-10 gap-4 lg:gap-6">
      {/* Toast Notification */}
      <Toast message={toast} icon="check_circle" />

      {/* Screen Title & Header */}
      <div className="lg:col-span-2 flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#3cddc7] animate-pulse"></div>
          <span className="text-base lg:text-lg font-bold text-[#003331]">Traducteur culturel</span>
        </div>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#b1eeea] text-[#00201f] text-xs font-bold shadow-xs">
          <span className="material-symbols-outlined text-[14px]">psychology</span>
          IA Contextuelle
        </span>
      </div>

      {/* Language Direction Toggle Pill */}
      <div className="lg:col-span-2 relative flex items-center justify-between bg-[#f3f3f5] p-1.5 rounded-full shadow-xs border border-[#edeef0]">
        {/* Source Language Button */}
        <button
          onClick={handleChangeSource}
          aria-label={`Langue source : ${sourceLabel(sourceLang)}. Changer`}
          className="flex-1 min-w-0 flex items-center justify-center gap-2 py-2.5 px-2 sm:px-3 rounded-full bg-white text-[#1a1c1d] shadow-sm transition-all active:scale-95 text-left border border-[#edeef0]"
        >
          {sourceLang === 'auto' ? (
            <span className="material-symbols-outlined text-[20px] text-[#004b49]">language</span>
          ) : (
            <Flag country={sourceLang === 'fr' ? 'fr' : 'ci'} />
          )}
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-[#1a1c1d] truncate">
              {sourceLabel(sourceLang)}
            </span>
            <span className="text-[11px] text-[#3f4948] truncate -mt-0.5">
              {sourceLang !== 'auto'
                ? LANG_SUBTITLE[sourceLang]
                : currentTrans
                ? `Détecté : ${LANGUAGE_LABEL[currentTrans.detectedSource]}`
                : 'Langue reconnue seule'}
            </span>
          </div>
          <span className="material-symbols-outlined text-[16px] text-[#707978] ml-auto">
            expand_more
          </span>
        </button>

        {/* Swap Button */}
        <div className="relative z-10 px-1">
          <button
            onClick={handleSwap}
            aria-label="Permuter les langues"
            className="w-10 h-10 rounded-full bg-[#9e4229] hover:bg-[#7e2b14] text-white flex items-center justify-center shadow-md active:scale-90 transition-transform duration-300"
          >
            <span className="material-symbols-outlined text-[20px]">swap_horiz</span>
          </button>
        </div>

        {/* Target Language Button */}
        <button
          onClick={handleChangeTarget}
          aria-label={`Langue cible : ${LANGUAGE_LABEL[targetLang]}. Changer`}
          className="flex-1 min-w-0 flex items-center justify-center gap-2 py-2.5 px-2 sm:px-3 rounded-full bg-white text-[#1a1c1d] shadow-sm transition-all active:scale-95 text-left border border-[#edeef0]"
        >
          <Flag country={targetLang === 'fr' ? 'fr' : 'ci'} />
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-[#004b49] truncate">
              {LANGUAGE_LABEL[targetLang]}
            </span>
            <span className="text-[11px] text-[#9e4229] font-semibold truncate -mt-0.5">
              {LANG_SUBTITLE[targetLang]}
            </span>
          </div>
          <span className="material-symbols-outlined text-[16px] text-[#707978] ml-auto">
            expand_more
          </span>
        </button>
      </div>

      {/* Source Input Box */}
      <div className="flex flex-col bg-white rounded-3xl p-4 lg:p-5 shadow-sm relative transition-all border border-[#edeef0] focus-within:ring-2 focus-within:ring-[#004b49]/20">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-bold text-[#707978] uppercase tracking-wider">
            Texte source
          </span>
          {sourceText && (
            <button
              onClick={handleClear}
              aria-label="Effacer le texte"
              className="w-7 h-7 rounded-full bg-[#edeef0] flex items-center justify-center text-[#3f4948] hover:text-[#1a1c1d] transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          )}
        </div>

        <textarea
          value={sourceText}
          onChange={(e) => setSourceText(e.target.value)}
          className="w-full flex-1 lg:min-h-40 bg-transparent resize-none text-sm lg:text-base text-[#1a1c1d] placeholder:text-[#bfc8c7] focus:outline-none leading-relaxed"
          rows={3}
          placeholder="Tapez ou dictez une phrase..."
        />

        <div className="flex items-center justify-between pt-2 mt-1 border-t border-[#edeef0]/60">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePaste}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#f3f3f5] text-[#3f4948] text-xs font-semibold active:scale-95 transition-transform hover:bg-[#edeef0]"
            >
              <span className="material-symbols-outlined text-[16px]">content_paste</span>
              Coller
            </button>

            <button
              onClick={handleVoiceInput}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold active:scale-95 transition-transform ${
                isDictating
                  ? 'bg-[#ba1a1a] text-white animate-pulse'
                  : 'bg-[#ffdbd2] text-[#3c0800] hover:bg-[#ffb4a1]'
              }`}
            >
              <span className={`material-symbols-outlined text-[16px] ${isDictating ? '' : 'text-[#9e4229]'} ${isTranscribing ? 'animate-spin' : ''}`}>
                {isTranscribing ? 'progress_activity' : isDictating ? 'stop' : 'mic'}
              </span>
              {isTranscribing ? 'Transcription…' : isDictating ? 'Stop' : 'Parler'}
            </button>
          </div>

          <span className="text-xs text-[#707978] font-medium">
            {sourceText.length} car.
          </span>
        </div>
      </div>

      {/* Translation Result Card */}
      <div
        aria-live="polite"
        aria-busy={isTranslatingShown}
        className={`bg-[#004b49] text-white rounded-3xl p-5 lg:p-6 shadow-md relative overflow-hidden transition-opacity ${
          isTranslatingShown && currentTrans ? 'opacity-70' : ''
        }`}
      >
        <div className="absolute -right-10 -bottom-10 w-36 h-36 rounded-full bg-[#00c5b1]/20 pointer-events-none blur-2xl"></div>

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#62fae3]"></span>
            <span className="text-xs text-[#62fae3] tracking-wide uppercase font-bold">
              Traduction {LANGUAGE_LABEL[targetLang]}
            </span>
          </div>
          {currentTrans?.tone && (
            <span className="text-[11px] bg-[#00332d]/60 px-2.5 py-0.5 rounded-full text-[#b1eeea] font-semibold border border-[#62fae3]/20">
              {currentTrans.tone}
            </span>
          )}
        </div>

        {currentTrans ? (
          <>
          <p className="text-lg text-white font-bold leading-snug mb-2">
            {currentTrans.translation}
          </p>

          {/* Phonetics Guide */}
          {currentTrans.phonetic && (
            <div className="bg-[#00332d]/40 rounded-xl px-3 py-2 mb-3 inline-block w-full border border-white/5">
              <span className="text-[11px] text-[#3cddc7] block font-bold mb-0.5">
                Guide phonétique
              </span>
              <p className="text-xs text-[#edeef0] italic tracking-wide">
                {currentTrans.phonetic}
              </p>
            </div>
          )}

          {/* Merchant Tip */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 mb-4 flex items-start gap-2.5 border border-white/10">
            <span className="material-symbols-outlined text-[#ffdbd2] text-[20px] shrink-0 mt-0.5">
              lightbulb
            </span>
            <p className="text-xs text-white leading-relaxed">
              <span className="font-bold text-[#ffdbd2]">Astuce marchande : </span>
              {currentTrans.tip}
            </p>
          </div>

          {/* Action Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2">
              <button
                onClick={handlePlayAudio}
                aria-label="Écouter la traduction"
                className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-xs shadow-sm active:scale-95 transition-all ${
                  isPlayingAudio
                    ? 'bg-[#fe8b6d] text-[#75240e] animate-pulse'
                    : 'bg-[#62fae3] text-[#00201c] hover:bg-[#3cddc7]'
                }`}
              >
                <span className="material-symbols-outlined text-[18px] fill">volume_up</span>
                <span>{isPlayingAudio ? 'Lecture...' : 'Écouter'}</span>
              </button>

              <button
                onClick={handleToggleSpeed}
                className="px-2.5 py-2 rounded-full bg-[#00332d]/50 text-[#b1eeea] text-xs font-bold active:scale-90 transition-transform hover:bg-[#00332d]"
              >
                {speeds[audioSpeedIdx]}
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={handleCopy}
                aria-label="Copier la traduction"
                className="w-9 h-9 rounded-full bg-[#00332d]/50 text-white flex items-center justify-center active:scale-90 transition-transform hover:bg-[#00332d]"
              >
                <span className="material-symbols-outlined text-[18px]">content_copy</span>
              </button>

              <button
                onClick={handleShare}
                aria-label="Partager la traduction"
                className="w-9 h-9 rounded-full bg-[#00332d]/50 text-white flex items-center justify-center active:scale-90 transition-transform hover:bg-[#00332d]"
              >
                <span className="material-symbols-outlined text-[18px]">share</span>
              </button>

              <button
                onClick={() => {
                  setIsBookmarked(!isBookmarked);
                  showToast(
                    !isBookmarked
                      ? 'Ajouté aux favoris !'
                      : 'Retiré des favoris'
                  );
                }}
                aria-label="Sauvegarder l'expression"
                className={`w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-transform ${
                  isBookmarked ? 'bg-[#9e4229] text-white' : 'bg-[#00332d]/50 text-white'
                }`}
              >
                <span className={`material-symbols-outlined text-[18px] ${isBookmarked ? 'fill' : ''}`}>
                  star
                </span>
              </button>
            </div>
          </div>
          </>
        ) : (
          <p className="relative text-sm text-[#b1eeea] py-6 flex items-center gap-2">
            {isTranslatingShown && (
              <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
            )}
            {translateFailed && hasText
              ? 'La traduction a échoué. Vérifiez votre connexion.'
              : isTranslatingShown
              ? 'Traduction en cours…'
              : 'Saisissez ou dictez une phrase pour la traduire.'}
            {translateFailed && hasText && !isTranslatingShown && (
              <button
                onClick={() => setRetryCount((n) => n + 1)}
                className="ml-auto px-3 py-1.5 rounded-full bg-[#62fae3] text-[#00201c] text-xs font-bold active:scale-95 transition-transform"
              >
                Réessayer
              </button>
            )}
          </p>
        )}
      </div>

      {/* Key Expressions & Memorized List */}
      <div className="lg:col-span-2 pt-2 flex flex-col space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[#9e4229] text-[20px]">
              auto_stories
            </span>
            <span className="text-sm font-bold text-[#1a1c1d]">
              Expressions clés & mémorisées
            </span>
          </div>
          <button
            onClick={() => showToast('Tous les termes du lexique sont affichés.')}
            className="text-xs text-[#9e4229] font-bold"
          >
            Voir tout
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 lg:gap-3">
          {savedExpressions.map((item) => (
            <div
              key={item.id}
              className="bg-white p-3.5 rounded-2xl shadow-xs flex items-center justify-between border border-[#edeef0] hover:bg-[#f9f9fb] transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#edeef0] flex items-center justify-center text-[#004b49] shrink-0">
                  <span className="material-symbols-outlined text-[20px]">{categoryIcon(item.category)}</span>
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#1a1c1d] truncate">
                      {item.word}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-[#edeef0] text-[11px] text-[#3f4948] font-semibold">
                      {LANGUAGE_LABEL[item.language]}
                    </span>
                  </div>
                  <span className="text-xs text-[#3f4948] truncate">
                    {item.meaning}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => playVocabAudio(item.word, item.tone, item.language)}
                  aria-label={`Prononcer ${item.word}`}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#3f4948] hover:text-[#004b49] active:scale-90 transition-transform"
                >
                  <span className="material-symbols-outlined text-[18px]">volume_up</span>
                </button>

                <button
                  onClick={() => toggleFavoriteItem(item.id)}
                  aria-label="Favoris"
                  className={`w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-transform ${
                    item.isFavorite ? 'text-[#9e4229]' : 'text-[#707978]'
                  }`}
                >
                  <span
                    className={`material-symbols-outlined text-[20px] ${
                      item.isFavorite ? 'fill' : ''
                    }`}
                  >
                    star
                  </span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mode conversation immédiate Banner */}
      <div className="lg:col-span-2 relative overflow-hidden rounded-2xl bg-[#edeef0] p-4 lg:p-5 flex items-center justify-between gap-3 shadow-xs border border-[#edeef0]">
        <div className="flex items-center gap-3 z-10 min-w-0">
          <div className="w-12 h-12 rounded-full bg-[#9e4229] flex items-center justify-center text-white shadow-md shrink-0">
            <span className="material-symbols-outlined text-[24px]">record_voice_over</span>
          </div>
          <div>
            <p className="text-sm font-bold text-[#1a1c1d]">Mode conversation immédiate</p>
            <p className="text-xs text-[#3f4948]">Traduction simultanée à deux micros</p>
          </div>
        </div>

        <button
          onClick={() => setIsDualMicModalOpen(true)}
          className="z-10 px-3.5 py-1.5 rounded-full bg-[#003331] text-white text-xs active:scale-95 transition-transform shrink-0 font-semibold shadow-sm"
        >
          Lancer
        </button>

        <div className="absolute -right-4 -bottom-6 w-24 h-24 rounded-full bg-[#95d1ce]/20 pointer-events-none blur-xl"></div>
      </div>

      {/* Dual Mic Conversation Modal */}
      {isDualMicModalOpen && (
        <div
          onClick={closeOnBackdrop(() => setIsDualMicModalOpen(false))}
          role="presentation"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in"
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200"
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#9e4229]">record_voice_over</span>
                <h3 className="text-base font-bold text-[#1a1c1d]">
                  Traduction instantanée à deux
                </h3>
              </div>
              <button
                onClick={() => setIsDualMicModalOpen(false)}
                className="w-8 h-8 rounded-full bg-[#edeef0] flex items-center justify-center text-[#3f4948]"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <p className="text-xs text-[#3f4948]">
              Posez le téléphone entre vous et votre interlocuteur au marché ou dans la rue.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => {
                  soundEngine.playTone(440, 0.2);
                  showToast('Micro 1 (Français) activé !');
                }}
                className="p-4 rounded-2xl bg-[#ffdbd2] text-[#3c0800] flex flex-col items-center gap-2 active:scale-95 transition-all"
              >
                <Flag country="fr" className="w-8" />
                <span className="text-xs font-bold">Interlocuteur 1</span>
                <span className="text-[11px] text-[#7e2b14]">Français</span>
                <div className="w-10 h-10 rounded-full bg-[#9e4229] text-white flex items-center justify-center shadow-xs">
                  <span className="material-symbols-outlined text-[20px]">mic</span>
                </div>
              </button>

              <button
                onClick={() => {
                  soundEngine.playTone(520, 0.2);
                  showToast('Micro 2 (Dioula/Baoulé) activé !');
                }}
                className="p-4 rounded-2xl bg-[#b1eeea] text-[#00201f] flex flex-col items-center gap-2 active:scale-95 transition-all"
              >
                <Flag country="ci" className="w-8" />
                <span className="text-xs font-bold">Interlocuteur 2</span>
                <span className="text-[11px] text-[#084f4d]">{LANGUAGE_LABEL[targetLang]}</span>
                <div className="w-10 h-10 rounded-full bg-[#004b49] text-white flex items-center justify-center shadow-xs">
                  <span className="material-symbols-outlined text-[20px]">mic</span>
                </div>
              </button>
            </div>

            <button
              onClick={() => setIsDualMicModalOpen(false)}
              className="w-full py-2.5 rounded-full bg-[#003331] text-white text-xs font-bold active:scale-95 transition-transform mt-2"
            >
              Fermer le mode direct
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

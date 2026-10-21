import React, { useEffect, useRef, useState } from 'react';
import { Chip } from './ui/Chip';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import { Modal } from './ui/Modal';
import { categoryIcon, LANGUAGE_LABEL } from '../data/languages';
import { Flag } from './Flag';
import { useToast } from '../hooks/useToast';
import { Toast } from './Toast';
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
    setLastTrans(null); // une nouvelle phrase ne doit pas afficher l'ancienne traduction
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
          <div className="w-2.5 h-2.5 rounded-full bg-tertiary-fixed-dim animate-pulse"></div>
          <span className="text-base lg:text-lg font-bold text-primary">Traducteur culturel</span>
        </div>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary-fixed text-on-primary-fixed text-xs font-bold shadow-soft">
          <span className="material-symbols-outlined text-[14px]">psychology</span>
          IA Contextuelle
        </span>
      </div>

      {/* Language Direction Toggle Pill */}
      <div className="lg:col-span-2 relative flex items-center justify-between bg-surface-container-low p-1.5 rounded-full shadow-soft border border-surface-container">
        {/* Source Language Button */}
        <button
          onClick={handleChangeSource}
          aria-label={`Langue source : ${sourceLabel(sourceLang)}. Changer`}
          className="flex-1 min-w-0 flex items-center justify-center gap-2 py-2.5 px-2 sm:px-3 rounded-full bg-surface-container-lowest text-on-surface shadow-soft transition-all active:scale-95 text-left border border-surface-container"
        >
          {sourceLang === 'auto' ? (
            <span className="material-symbols-outlined text-[20px] text-primary-container">language</span>
          ) : (
            <Flag country={sourceLang === 'fr' ? 'fr' : 'ci'} />
          )}
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-on-surface truncate">
              {sourceLabel(sourceLang)}
            </span>
            <span className="text-[11px] text-on-surface-variant truncate -mt-0.5">
              {sourceLang !== 'auto'
                ? LANG_SUBTITLE[sourceLang]
                : currentTrans
                ? `Détecté : ${LANGUAGE_LABEL[currentTrans.detectedSource]}`
                : 'Langue reconnue seule'}
            </span>
          </div>
          <span className="material-symbols-outlined text-[16px] text-outline ml-auto">
            expand_more
          </span>
        </button>

        {/* Swap Button */}
        <div className="relative z-10 px-1">
          <IconButton onClick={handleSwap} aria-label="Permuter les langues" icon="swap_horiz" size="lg" iconClassName="text-[20px]" className="bg-secondary hover:bg-on-secondary-fixed-variant text-white shadow-raised active:scale-90 transition-transform duration-300" />
        </div>

        {/* Target Language Button */}
        <button
          onClick={handleChangeTarget}
          aria-label={`Langue cible : ${LANGUAGE_LABEL[targetLang]}. Changer`}
          className="flex-1 min-w-0 flex items-center justify-center gap-2 py-2.5 px-2 sm:px-3 rounded-full bg-surface-container-lowest text-on-surface shadow-soft transition-all active:scale-95 text-left border border-surface-container"
        >
          <Flag country={targetLang === 'fr' ? 'fr' : 'ci'} />
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-primary-container truncate">
              {LANGUAGE_LABEL[targetLang]}
            </span>
            <span className="text-[11px] text-secondary font-semibold truncate -mt-0.5">
              {LANG_SUBTITLE[targetLang]}
            </span>
          </div>
          <span className="material-symbols-outlined text-[16px] text-outline ml-auto">
            expand_more
          </span>
        </button>
      </div>

      {/* Source Input Box */}
      <div className="flex flex-col bg-surface-container-lowest rounded-3xl p-4 lg:p-5 shadow-soft relative transition-all border border-surface-container focus-within:ring-2 focus-within:ring-primary-container/20">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-bold text-outline uppercase tracking-wider">
            Texte source
          </span>
          {sourceText && (
            <button
              onClick={handleClear}
              aria-label="Effacer le texte"
              className="w-7 h-7 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          )}
        </div>

        <textarea
          value={sourceText}
          onChange={(e) => setSourceText(e.target.value)}
          className="w-full flex-1 lg:min-h-40 bg-transparent resize-none text-sm lg:text-base text-on-surface placeholder:text-outline-variant focus:outline-none leading-relaxed"
          rows={3}
          placeholder="Tapez ou dictez une phrase..."
        />

        <div className="flex items-center justify-between pt-2 mt-1 border-t border-surface-container/60">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePaste}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-surface-container-low text-on-surface-variant text-xs font-semibold active:scale-95 transition-transform hover:bg-surface-container"
            >
              <span className="material-symbols-outlined text-[16px]">content_paste</span>
              Coller
            </button>

            <button
              onClick={handleVoiceInput}
              style={isDictating ? { boxShadow: `0 0 0 ${2 + recorder.level * 10}px rgba(186, 26, 26, 0.18)` } : undefined}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold active:scale-95 transition-[transform,box-shadow] duration-75 ${
                isDictating
                  ? 'bg-error text-white animate-pulse'
                  : 'bg-secondary-fixed text-on-secondary-fixed hover:bg-secondary-fixed-dim'
              }`}
            >
              <span className={`material-symbols-outlined text-[16px] ${isDictating ? '' : 'text-secondary'} ${isTranscribing ? 'animate-spin' : ''}`}>
                {isTranscribing ? 'progress_activity' : isDictating ? 'stop' : 'mic'}
              </span>
              {isTranscribing ? 'Transcription…' : isDictating ? 'Stop' : 'Parler'}
            </button>
          </div>

          <span className="text-xs text-outline font-medium">
            {sourceText.length} car.
          </span>
        </div>
      </div>

      {/* Translation Result Card */}
      <div
        aria-live="polite"
        aria-busy={isTranslatingShown}
        className={`bg-primary-container text-white rounded-3xl p-5 lg:p-6 shadow-raised relative overflow-hidden transition-opacity ${
          isTranslatingShown && currentTrans ? 'opacity-70' : ''
        }`}
      >
        <div className="absolute -right-10 -bottom-10 w-36 h-36 rounded-full bg-on-tertiary-container/20 pointer-events-none blur-2xl"></div>

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-tertiary-fixed"></span>
            <span className="text-xs text-tertiary-fixed tracking-wide uppercase font-bold">
              Traduction {LANGUAGE_LABEL[targetLang]}
            </span>
          </div>
          {currentTrans?.tone && (
            <span className="text-[11px] bg-tertiary/60 px-2.5 py-0.5 rounded-full text-primary-fixed font-semibold border border-tertiary-fixed/20">
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
            <div className="bg-tertiary/40 rounded-xl px-3 py-2 mb-3 inline-block w-full border border-white/5">
              <span className="text-[11px] text-tertiary-fixed-dim block font-bold mb-0.5">
                Guide phonétique
              </span>
              <p className="text-xs text-surface-container italic tracking-wide">
                {currentTrans.phonetic}
              </p>
            </div>
          )}

          {/* Merchant Tip */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 mb-4 flex items-start gap-2.5 border border-white/10">
            <span className="material-symbols-outlined text-secondary-fixed text-[20px] shrink-0 mt-0.5">
              lightbulb
            </span>
            <p className="text-xs text-white leading-relaxed">
              <span className="font-bold text-secondary-fixed">Astuce marchande : </span>
              {currentTrans.tip}
            </p>
          </div>

          {/* Action Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2">
              <button
                onClick={handlePlayAudio}
                aria-label="Écouter la traduction"
                className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-xs shadow-soft active:scale-95 transition-all ${
                  isPlayingAudio
                    ? 'bg-secondary-container text-on-secondary-container animate-pulse'
                    : 'bg-tertiary-fixed text-on-tertiary-fixed hover:bg-tertiary-fixed-dim'
                }`}
              >
                <span className="material-symbols-outlined text-[18px] fill">volume_up</span>
                <span>{isPlayingAudio ? 'Lecture...' : 'Écouter'}</span>
              </button>

              <button
                onClick={handleToggleSpeed}
                className="px-2.5 py-2 rounded-full bg-tertiary/50 text-primary-fixed text-xs font-bold active:scale-90 transition-transform hover:bg-tertiary"
              >
                {speeds[audioSpeedIdx]}
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <IconButton onClick={handleCopy} aria-label="Copier la traduction" icon="content_copy" iconClassName="text-[18px]" className="bg-tertiary/50 text-white active:scale-90 transition-transform hover:bg-tertiary" />

              <IconButton onClick={handleShare} aria-label="Partager la traduction" icon="share" iconClassName="text-[18px]" className="bg-tertiary/50 text-white active:scale-90 transition-transform hover:bg-tertiary" />

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
                  isBookmarked ? 'bg-secondary text-white' : 'bg-tertiary/50 text-white'
                }`}
              >
                <span className={`material-symbols-outlined text-[18px] ${isBookmarked ? 'fill' : ''}`}>
                  star
                </span>
              </button>
            </div>
          </div>
          </>
        ) : isTranslatingShown && !translateFailed ? (
          <div className="relative flex flex-col gap-3 py-1" role="status">
            <span className="sr-only">Traduction en cours…</span>
            <span className="skeleton h-6 w-4/5 rounded-xl" />
            <span className="skeleton h-9 w-full rounded-xl" />
            <span className="skeleton h-14 w-full rounded-2xl" />
          </div>
        ) : (
          <p className="relative text-sm text-primary-fixed py-6 flex items-center gap-2">
            {translateFailed && hasText
              ? 'La traduction a échoué. Vérifiez votre connexion.'
              : isTranslatingShown
              ? 'Traduction en cours…'
              : 'Saisissez ou dictez une phrase pour la traduire.'}
            {translateFailed && hasText && !isTranslatingShown && (
              <button
                onClick={() => setRetryCount((n) => n + 1)}
                className="ml-auto px-3 py-1.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed text-xs font-bold active:scale-95 transition-transform"
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
            <span className="material-symbols-outlined text-secondary text-[20px]">
              auto_stories
            </span>
            <span className="text-sm font-bold text-on-surface">
              Expressions clés & mémorisées
            </span>
          </div>
          <button
            onClick={() => showToast('Tous les termes du lexique sont affichés.')}
            className="text-xs text-secondary font-bold"
          >
            Voir tout
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 lg:gap-3">
          {savedExpressions.map((item) => (
            <div
              key={item.id}
              className="bg-surface-container-lowest p-3.5 rounded-2xl shadow-soft flex items-center justify-between border border-surface-container hover:bg-surface transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-primary-container shrink-0">
                  <span className="material-symbols-outlined text-[20px]">{categoryIcon(item.category)}</span>
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-on-surface truncate">
                      {item.word}
                    </span>
                    <Chip>{LANGUAGE_LABEL[item.language]}</Chip>
                  </div>
                  <span className="text-xs text-on-surface-variant truncate">
                    {item.meaning}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <IconButton onClick={() => playVocabAudio(item.word, item.tone, item.language)} aria-label={`Prononcer ${item.word}`} icon="volume_up" size="sm" iconClassName="text-[18px]" className="text-on-surface-variant hover:text-primary-container active:scale-90 transition-transform" />

                <button
                  onClick={() => toggleFavoriteItem(item.id)}
                  aria-label="Favoris"
                  className={`w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-transform ${
                    item.isFavorite ? 'text-secondary' : 'text-outline'
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
      <div className="lg:col-span-2 relative overflow-hidden rounded-2xl bg-surface-container p-4 lg:p-5 flex items-center justify-between gap-3 shadow-soft border border-surface-container">
        <div className="flex items-center gap-3 z-10 min-w-0">
          <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-white shadow-raised shrink-0">
            <span className="material-symbols-outlined text-[24px]">record_voice_over</span>
          </div>
          <div>
            <p className="text-sm font-bold text-on-surface">Mode conversation immédiate</p>
            <p className="text-xs text-on-surface-variant">Traduction simultanée à deux micros</p>
          </div>
        </div>

        <Button onClick={() => setIsDualMicModalOpen(true)} size="sm" className="z-10 shrink-0">
          Lancer
        </Button>

        <div className="absolute -right-4 -bottom-6 w-24 h-24 rounded-full bg-primary-fixed-dim/20 pointer-events-none blur-xl"></div>
      </div>

      {/* Dual Mic Conversation Modal */}
      {isDualMicModalOpen && (
        <Modal onClose={() => setIsDualMicModalOpen(false)} overlayClassName="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in" className="w-full max-w-sm bg-surface-container-lowest rounded-3xl p-5 shadow-overlay flex flex-col gap-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">record_voice_over</span>
                <h3 className="text-base font-bold text-on-surface">
                  Traduction instantanée à deux
                </h3>
              </div>
              <IconButton aria-label="Fermer" onClick={() => setIsDualMicModalOpen(false)} icon="close" size="sm" iconClassName="text-[18px]" className="bg-surface-container text-on-surface-variant" />
            </div>

            <p className="text-xs text-on-surface-variant">
              Posez le téléphone entre vous et votre interlocuteur au marché ou dans la rue.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => {
                  soundEngine.playTone(440, 0.2);
                  showToast('Micro 1 (Français) activé !');
                }}
                className="p-4 rounded-2xl bg-secondary-fixed text-on-secondary-fixed flex flex-col items-center gap-2 active:scale-95 transition-all"
              >
                <Flag country="fr" className="w-8" />
                <span className="text-xs font-bold">Interlocuteur 1</span>
                <span className="text-[11px] text-on-secondary-fixed-variant">Français</span>
                <div className="w-10 h-10 rounded-full bg-secondary text-white flex items-center justify-center shadow-soft">
                  <span className="material-symbols-outlined text-[20px]">mic</span>
                </div>
              </button>

              <button
                onClick={() => {
                  soundEngine.playTone(520, 0.2);
                  showToast('Micro 2 (Dioula/Baoulé) activé !');
                }}
                className="p-4 rounded-2xl bg-primary-fixed text-on-primary-fixed flex flex-col items-center gap-2 active:scale-95 transition-all"
              >
                <Flag country="ci" className="w-8" />
                <span className="text-xs font-bold">Interlocuteur 2</span>
                <span className="text-[11px] text-on-primary-fixed-variant">{LANGUAGE_LABEL[targetLang]}</span>
                <div className="w-10 h-10 rounded-full bg-primary-container text-white flex items-center justify-center shadow-soft">
                  <span className="material-symbols-outlined text-[20px]">mic</span>
                </div>
              </button>
            </div>

            <button
              onClick={() => setIsDualMicModalOpen(false)}
              className="w-full py-2.5 rounded-full bg-primary text-white text-xs font-bold active:scale-95 transition-transform mt-2"
            >
              Fermer le mode direct
            </button>
          </Modal>
      )}
    </div>
  );
};

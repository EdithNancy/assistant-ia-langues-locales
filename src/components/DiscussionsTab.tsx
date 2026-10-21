import React, { useEffect, useState } from 'react';
import { IconButton } from './ui/IconButton';
import { Modal } from './ui/Modal';
import { LANGUAGE_LABEL } from '../data/languages';
import { Flag } from './Flag';
import { useToast } from '../hooks/useToast';
import { Toast } from './Toast';
import { BRAND_ASSETS, INITIAL_CHAT_MESSAGES } from '../data/mockData';
import { ChatMessage, Language } from '../types';
import { recorderErrorMessage, useAudioRecorder } from '../hooks/useAudioRecorder';
import { api } from '../services';
import { useVoiceConsent } from './VoiceConsent';
import { soundEngine } from '../utils/audio';
import { voicePlayer, VOICE_LABEL } from '../utils/voicePlayer';

/** Heure courante au format « 09:42 ». */
const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

interface DiscussionsTabProps {
  currentLanguage: Language;
  onLanguageChange: (lang: Language) => void;
  onOpenVoiceSession: () => void;
  onBackToHome: () => void;
  /** Lit automatiquement chaque réponse d'Aya. */
  voiceFirst: boolean;
}

export const DiscussionsTab: React.FC<DiscussionsTabProps> = ({
  currentLanguage,
  onLanguageChange,
  onOpenVoiceSession,
  onBackToHome,
  voiceFirst,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_CHAT_MESSAGES);
  const [inputText, setInputText] = useState('');
  const [isDialectModalOpen, setIsDialectModalOpen] = useState(false);
  const [isPlayingAudioId, setIsPlayingAudioId] = useState<string | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const recorder = useAudioRecorder();
  const { ensureConsent } = useVoiceConsent();
  const isRecording = recorder.status === 'recording';
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isAiTyping, setIsAiTyping] = useState(false);
  /** Dernier message resté sans réponse, pour proposer « Réessayer ». */
  const [failedText, setFailedText] = useState<string | null>(null);
  const [ratings, setRatings] = useState<Record<string, 'up' | 'down'>>({});
  /** Message dont on demande la raison du pouce bas. */
  const [commentingId, setCommentingId] = useState<string | null>(null);
  const [feedbackComment, setFeedbackComment] = useState('');
  const { toast, showToast } = useToast(2200);

  const handleCharInsert = (char: string) => {
    setInputText((prev) => prev + char);
  };

  const handlePlayMessageAudio = (msg: ChatMessage) => {
    if (isPlayingAudioId === msg.id) {
      voicePlayer.stop();
      setIsPlayingAudioId(null);
      return;
    }

    setIsPlayingAudioId(msg.id);
    if (msg.tone) {
      soundEngine.playTonePitch(msg.tone);
    }
    voicePlayer.speak(msg.text, msg.language ?? currentLanguage, playbackSpeed, () => {
      setIsPlayingAudioId(null);
    });
  };

  const requestReply = async (userText: string) => {
    setFailedText(null);
    setIsAiTyping(true);
    try {
      const reply = await api.chat({ message: userText, language: currentLanguage });
      const aiMsg: ChatMessage = {
        ...reply,
        id: `ai-${Date.now()}`,
        sender: 'ai',
        timestamp: now(),
        language: currentLanguage,
      };
      setMessages((prev) => [...prev, aiMsg]);
      if (voiceFirst) handlePlayMessageAudio(aiMsg);
      else soundEngine.playTonePitch('Haut');
    } catch {
      setFailedText(userText);
    } finally {
      setIsAiTyping(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || isAiTyping) return;
    const userText = inputText.trim();
    setInputText('');

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      timestamp: now(),
      text: userText,
      language: currentLanguage,
    };

    setMessages((prev) => [...prev, userMsg]);
    soundEngine.playTone(480, 0.1);

    // Indication non bloquante : la langue reconnue s'affiche sous le message
    api
      .detectLanguage(userText)
      .then(({ language }) =>
        setMessages((prev) =>
          prev.map((m) => (m.id === userMsg.id ? { ...m, detectedLanguage: language } : m))
        )
      )
      .catch(() => undefined);

    await requestReply(userText);
  };

  const handleMicToggle = async () => {
    if (isTranscribing) return;
    if (!isRecording) {
      if (!(await ensureConsent())) {
        showToast('Sans votre accord, vous pouvez écrire votre message.');
        return;
      }
      const started = await recorder.start();
      if (started) {
        soundEngine.playTone(660, 0.15);
        showToast('Je vous écoute… appuyez à nouveau pour terminer.');
      }
      return;
    }

    soundEngine.playTone(330, 0.15);
    const audio = await recorder.stop();
    if (!audio) return;
    setIsTranscribing(true);
    try {
      const { text } = await api.transcribe(audio, currentLanguage);
      setInputText(text);
    } catch {
      showToast("La transcription a échoué. Réessayez ou écrivez votre message.");
    } finally {
      setIsTranscribing(false);
    }
  };

  // Affiche l'erreur du micro (refus d'accès, pas de micro…) dès qu'elle survient
  useEffect(() => {
    if (recorder.error) showToast(recorderErrorMessage[recorder.error]);
  }, [recorder.error, showToast]);

  const sendFeedback = async (messageId: string, rating: 'up' | 'down', comment?: string) => {
    setRatings((prev) => ({ ...prev, [messageId]: rating }));
    try {
      await api.sendFeedback({ messageId, rating, comment });
      showToast(rating === 'up' ? 'Merci pour votre retour !' : 'Merci, Aya va s’améliorer.');
    } catch {
      showToast("Votre avis n'a pas pu être envoyé.");
    }
  };

  const handleThumbDown = (messageId: string) => {
    setRatings((prev) => ({ ...prev, [messageId]: 'down' }));
    setFeedbackComment('');
    setCommentingId(messageId);
  };

  const submitComment = (messageId: string) => {
    setCommentingId(null);
    void sendFeedback(messageId, 'down', feedbackComment.trim() || undefined);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('Texte copié !');
  };

  return (
    <div className="flex flex-col w-full lg:max-w-4xl lg:mx-auto relative pb-28 lg:pb-32">
      {/* Toast */}
      <Toast message={toast} icon="info" />

      {/* In-Chat Top Navigation Subheader */}
      <div className="sticky top-14 lg:top-16 z-20 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-4 py-2 bg-surface/95 backdrop-blur-md flex items-center justify-between gap-2 border-b border-surface-container lg:border lg:rounded-2xl lg:bg-white/95">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={onBackToHome}
            aria-label="Retour"
            className="w-10 h-10 -ml-1 rounded-full flex items-center justify-center text-on-surface hover:bg-surface-container active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[24px]">arrow_back</span>
          </button>

          <div className="relative shrink-0">
            <img
              alt="Aya AI Avatar"
              className="w-10 h-10 rounded-full object-cover bg-primary-fixed p-0.5 shadow-soft ring-1 ring-primary-container/20"
              src={BRAND_ASSETS.ayaAvatar}
            />
            <span
              className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-tertiary-fixed border-2 border-white flex items-center justify-center"
              title="En ligne"
            >
              <span className="w-1 h-1 rounded-full bg-primary animate-pulse"></span>
            </span>
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-on-surface font-bold truncate">Aya</span>
              <span className="text-[11px] px-1.5 py-0.2 rounded-xl bg-primary-fixed text-on-primary-fixed-variant font-bold">
                Tuteur IA
              </span>
            </div>
            <span className="text-xs text-on-tertiary-fixed-variant flex items-center gap-1 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-tertiary-fixed"></span> À l'écoute
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setIsDialectModalOpen(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-surface-container hover:bg-surface-container-highest transition-colors text-on-surface active:scale-95"
          >
            <Flag country="ci" className="w-4" />
            <span className="text-xs font-bold text-primary">
              {LANGUAGE_LABEL[currentLanguage]}
            </span>
            <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
              expand_more
            </span>
          </button>

          <IconButton onClick={onOpenVoiceSession} aria-label="Lancer la session vocale en direct" icon="call" iconClassName="text-[22px]" className="text-primary-container hover:bg-surface-container transition-colors" />
        </div>
      </div>

      {/* Messages Stream */}
      <div className="flex flex-col gap-5 pt-3 pb-24">
        {/* Day Timestamp Divider */}
        <div className="flex items-center justify-center my-1">
          <div className="px-3 py-1 rounded-full bg-surface-container-high text-on-surface-variant text-xs font-semibold shadow-soft">
            Aujourd'hui • Dialogue oral & écrit
          </div>
        </div>

        {messages.map((msg) => {
          const isAi = msg.sender === 'ai';
          const isPlaying = isPlayingAudioId === msg.id;

          if (!isAi) {
            // User Message Bubble
            return (
              <div
                key={msg.id}
                className="flex flex-col gap-1 max-w-[90%] sm:max-w-[75%] lg:max-w-[65%] ml-auto items-end animate-in fade-in slide-in-from-bottom-2 duration-300"
              >
                <div className="flex items-center gap-1 text-xs text-on-surface-variant">
                  <span>{msg.timestamp}</span>
                  <span className="font-bold text-primary-container">Moi</span>
                </div>
                <div className="bg-primary-container text-white rounded-3xl rounded-tr-sm p-4 shadow-raised flex flex-col gap-1.5">
                  <p className="text-sm leading-relaxed">{msg.text}</p>
                  <div className="flex items-center justify-end gap-1 text-on-primary-container text-[11px]">
                    <span>
                      Envoyé
                      {msg.detectedLanguage && ` • ${LANGUAGE_LABEL[msg.detectedLanguage]} reconnu`}
                    </span>
                    <span className="material-symbols-outlined text-[14px]">done_all</span>
                  </div>
                </div>
              </div>
            );
          }

          // AI Response Bubble
          return (
            <div
              key={msg.id}
              className="flex flex-col gap-1 max-w-[95%] sm:max-w-[85%] lg:max-w-[75%] mr-auto animate-in fade-in slide-in-from-bottom-2 duration-300"
            >
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-primary-container font-bold">Aya (IvoirAI)</span>
                <span className="text-on-surface-variant">{msg.timestamp}</span>
              </div>

              <div className="bg-surface-container-lowest rounded-3xl rounded-tl-sm p-4 shadow-soft flex flex-col gap-3 text-on-surface border border-surface-container">
                {/* Main Text */}
                <p className="text-sm leading-relaxed text-on-surface font-medium">
                  {msg.text}
                </p>

                {/* If there is a phonetic breakdown or audio bar */}
                <div className="bg-surface-container-low rounded-2xl p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <button
                      onClick={() => handlePlayMessageAudio(msg)}
                      aria-label="Écouter le message"
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-raised transition-all active:scale-95 ${
                        isPlaying
                          ? 'bg-tertiary-fixed text-primary'
                          : 'bg-primary text-white hover:scale-105'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[22px]">
                        {isPlaying ? 'pause' : 'play_arrow'}
                      </span>
                    </button>

                    {/* Soundwave Simulation */}
                    <div className="flex-1 flex items-center gap-[3px] h-6 px-1">
                      {[6, 14, 22, 10, 8, 18, 22, 12, 6, 16, 10, 7, 14, 18, 8].map(
                        (h, idx) => (
                          <span
                            key={idx}
                            style={{ height: isPlaying ? `${Math.max(4, (h * (idx % 2 + 1)) % 22)}px` : `${h}px` }}
                            className={`w-1 rounded-full transition-all duration-200 ${
                              isPlaying
                                ? 'bg-primary-container animate-pulse'
                                : 'bg-primary-container/40'
                            }`}
                          ></span>
                        )
                      )}
                    </div>
                    <span className="text-xs text-on-surface-variant font-semibold">
                      {msg.audioDuration || '0:06'}
                    </span>
                  </div>

                  {/* Speed Controls */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1 bg-surface-container rounded-full p-0.5">
                      {[0.75, 1, 1.25].map((speed) => (
                        <button
                          key={speed}
                          onClick={() => setPlaybackSpeed(speed)}
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold transition-all ${
                            playbackSpeed === speed
                              ? 'bg-white text-primary shadow-soft'
                              : 'text-on-surface-variant'
                          }`}
                        >
                          {speed}x
                        </button>
                      ))}
                    </div>

                    <span className="text-xs text-on-surface-variant flex items-center gap-1 font-semibold">
                      <span className="material-symbols-outlined text-[14px] text-tertiary-container">
                        record_voice_over
                      </span>
                      {VOICE_LABEL}
                    </span>
                  </div>
                </div>

                {/* Phonetics & Tone Pill if present */}
                {msg.phonetic && (
                  <div className="flex items-center flex-wrap gap-2 pt-1">
                    <span className="px-2 py-1 rounded-xl bg-surface-container-high text-xs text-on-surface font-mono font-medium">
                      {msg.phonetic}
                    </span>
                    {msg.tone && (
                      <span className="px-2 py-0.5 rounded-xl bg-secondary-fixed text-on-secondary-fixed text-[11px] font-bold flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">graphic_eq</span>
                        {msg.tone}
                      </span>
                    )}
                  </div>
                )}

                {/* Linguistic Cultural Breakdown if present */}
                {msg.linguisticBreakdown && msg.linguisticBreakdown.length > 0 && (
                  <div className="bg-surface rounded-2xl p-3.5 flex flex-col gap-2 border border-surface-container">
                    <div className="flex items-center gap-1.5 text-secondary text-xs font-bold">
                      <span className="material-symbols-outlined text-[18px]">lightbulb</span>
                      <span>
                        Décomposition du parler {currentLanguage === 'dioula' ? 'Mandé' : 'Akan'} :
                      </span>
                    </div>

                    <ul className="flex flex-col gap-1.5 text-xs text-on-surface-variant">
                      {msg.linguisticBreakdown.map((item, idx) => (
                        <li key={idx} className="flex items-baseline gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-secondary shrink-0"></span>
                          <span>
                            <strong className="text-on-surface font-semibold">
                              {item.term} :
                            </strong>{' '}
                            {item.meaning}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Actions Footer */}
                <div className="flex items-center justify-between pt-1 border-t border-surface-container/60 text-on-surface-variant">
                  <div className="flex items-center gap-1">
                    <IconButton onClick={() => handleCopy(msg.text)} title="Copier le texte" icon="content_copy" size="sm" iconClassName="text-[18px]" className="hover:bg-surface-container transition-colors" />
                    <IconButton onClick={onOpenVoiceSession} title="Pratiquer la prononciation" icon="graphic_eq" size="sm" iconClassName="text-[18px]" className="hover:bg-surface-container transition-colors" />
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => void sendFeedback(msg.id, 'up')}
                      aria-pressed={ratings[msg.id] === 'up'}
                      aria-label="Réponse utile"
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                        ratings[msg.id] === 'up'
                          ? 'text-primary-container bg-primary-fixed'
                          : 'hover:bg-surface-container'
                      }`}
                      title="Utile"
                    >
                      <span className={`material-symbols-outlined text-[18px] ${ratings[msg.id] === 'up' ? 'fill' : ''}`}>thumb_up</span>
                    </button>
                    <button
                      onClick={() => handleThumbDown(msg.id)}
                      aria-pressed={ratings[msg.id] === 'down'}
                      aria-label="Réponse à améliorer"
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                        ratings[msg.id] === 'down'
                          ? 'text-secondary bg-secondary-fixed'
                          : 'hover:bg-surface-container'
                      }`}
                      title="À améliorer"
                    >
                      <span className={`material-symbols-outlined text-[18px] ${ratings[msg.id] === 'down' ? 'fill' : ''}`}>
                        thumb_down
                      </span>
                    </button>
                  </div>
                </div>

                {commentingId === msg.id && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      submitComment(msg.id);
                    }}
                    className="flex flex-col gap-2 p-3 rounded-2xl bg-surface border border-surface-container"
                  >
                    <label htmlFor={`feedback-${msg.id}`} className="text-xs font-bold text-on-surface">
                      Qu'est-ce qui n'allait pas ? (facultatif)
                    </label>
                    <input
                      id={`feedback-${msg.id}`}
                      value={feedbackComment}
                      onChange={(e) => setFeedbackComment(e.target.value)}
                      placeholder="Ex. : mauvaise traduction, mauvais ton…"
                      className="h-10 px-3 rounded-xl bg-surface-container-lowest border border-surface-container text-sm focus:outline-none focus:ring-2 focus:ring-primary-container/30"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => submitComment(msg.id)}
                        className="px-3 py-1.5 rounded-full text-xs font-bold text-on-surface-variant"
                      >
                        Passer
                      </button>
                      <button
                        type="submit"
                        className="px-3 py-1.5 rounded-full bg-primary-container text-white text-xs font-bold"
                      >
                        Envoyer
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          );
        })}

        {isAiTyping && (
          <div role="status" className="animate-in fade-in duration-300 flex items-center gap-2 mr-auto px-4 py-3 rounded-3xl rounded-tl-sm bg-surface-container-lowest border border-surface-container text-sm text-on-surface-variant">
            <span className="flex gap-1" aria-hidden="true">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-container animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-primary-container animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-primary-container animate-bounce" />
            </span>
            Aya réfléchit…
          </div>
        )}

        {failedText && !isAiTyping && (
          <div role="alert" className="animate-in fade-in slide-in-from-bottom-2 duration-300 flex flex-wrap items-center gap-3 mr-auto px-4 py-3 rounded-2xl bg-error-container text-sm text-on-error-container">
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px]">error</span>
              Aya n'a pas pu répondre.
            </span>
            <button
              onClick={() => void requestReply(failedText)}
              className="px-3 py-1.5 rounded-full bg-surface-container-lowest text-on-error-container text-xs font-bold active:scale-95 transition-transform"
            >
              Réessayer
            </button>
          </div>
        )}
      </div>

      {/* Sticky Bottom Composer Section */}
      <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] lg:bottom-0 left-0 right-0 lg:left-64 z-30 bg-gradient-to-t from-surface via-surface/95 to-transparent pt-3 pb-2 lg:pb-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl lg:max-w-4xl mx-auto flex flex-col gap-2">
          {/* Special African Characters Toolbar */}
          <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-full bg-surface-container-lowest shadow-soft border border-surface-container">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs text-on-surface-variant font-bold px-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px] text-primary-container">
                  keyboard_alt
                </span>
                <span className="hidden min-[400px]:inline">Touches :</span>
              </span>
              <div className="flex items-center gap-1">
                {['ɛ', 'ɔ', 'ɲ', 'ŋ', 'ʼ'].map((char) => (
                  <button
                    key={char}
                    onClick={() => handleCharInsert(char)}
                    className="w-7 h-7 rounded-xl bg-surface-container hover:bg-primary-fixed hover:text-on-primary-fixed text-sm font-bold text-on-surface flex items-center justify-center active:scale-90 transition-all"
                  >
                    {char}
                  </button>
                ))}
              </div>
            </div>
            <span className="text-[11px] text-primary-container font-bold px-1">
              {LANGUAGE_LABEL[currentLanguage]}
            </span>
          </div>

          {/* Main Input Controls */}
          <div className="flex items-center gap-2">
            {/* Attachment Button */}
            <button
              onClick={() => showToast('Ajout d’image ou audio contextuel')}
              aria-label="Joindre un document"
              className="w-12 h-12 rounded-full bg-surface-container-lowest text-on-surface-variant hover:text-primary-container flex items-center justify-center shadow-raised active:scale-95 transition-all shrink-0 border border-surface-container"
            >
              <span className="material-symbols-outlined text-[24px]">add</span>
            </button>

            {/* Rounded Text Input Container */}
            <div className="flex-1 h-12 rounded-full bg-surface-container-lowest shadow-raised px-4 flex items-center justify-between gap-2 border border-surface-container focus-within:ring-2 focus-within:ring-primary-container/30">
              <input
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendMessage();
                }}
                className="w-full bg-transparent text-sm text-on-surface placeholder:text-outline focus:outline-none"
                placeholder={`Écrivez en Français ou ${currentLanguage === 'dioula' ? 'Dioula' : 'Baoulé'}...`}
                type="text"
              />
              {inputText ? (
                <IconButton onClick={handleSendMessage} aria-label="Envoyer le message" icon="send" size="sm" iconClassName="text-[18px]" className="bg-primary-container text-white active:scale-90 transition-transform" />
              ) : (
                <IconButton onClick={handleMicToggle} title="Activer le micro" icon="graphic_eq" size="sm" iconClassName="text-[20px]" className="text-on-surface-variant hover:text-secondary transition-colors" />
              )}
            </div>

            {/* Animated Microphone / Trigger */}
            <div className="relative shrink-0">
              {isRecording && (
                <div
                  style={{ transform: `scale(${1 + recorder.level * 0.6})` }}
                  className="absolute -inset-1.5 rounded-full bg-tertiary-fixed opacity-60 blur-xs transition-transform duration-75 pointer-events-none"
                ></div>
              )}
              <button
                onClick={handleMicToggle}
                aria-label={isRecording ? "Arrêter l'enregistrement" : "Parler vocalement à l'IA"}
                className={`relative w-12 h-12 rounded-full flex items-center justify-center shadow-raised hover:scale-105 active:scale-95 transition-all ${
                  isRecording
                    ? 'bg-error text-white'
                    : 'bg-primary-container text-tertiary-fixed'
                }`}
              >
                <span className={`material-symbols-outlined text-[24px] ${isTranscribing ? 'animate-spin' : ''}`}>
                  {isTranscribing ? 'progress_activity' : isRecording ? 'stop' : 'mic'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Language / Dialect Selection Modal Drawer */}
      {isDialectModalOpen && (
        <Modal onClose={() => setIsDialectModalOpen(false)} overlayClassName="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/40 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in" className="w-full max-w-md bg-surface-container-lowest rounded-t-3xl sm:rounded-3xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-5 shadow-overlay flex flex-col gap-4 animate-in slide-in-from-bottom duration-300">
            <div className="sm:hidden w-12 h-1.5 bg-outline-variant/60 rounded-full mx-auto"></div>

            <div className="flex justify-between items-center">
              <div>
                <span className="text-lg font-bold text-on-surface">
                  Sélectionner la langue
                </span>
                <p className="text-xs text-on-surface-variant">
                  L'IA s'adapte immédiatement aux tonalités locales.
                </p>
              </div>
              <IconButton aria-label="Fermer" onClick={() => setIsDialectModalOpen(false)} icon="close" iconClassName="text-[20px]" className="bg-surface-container text-on-surface-variant" />
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={() => {
                  onLanguageChange('baoule');
                  setIsDialectModalOpen(false);
                  showToast('Langue changée : Baoulé (Akan)');
                }}
                className={`flex items-center justify-between p-3.5 rounded-2xl transition-all ${
                  currentLanguage === 'baoule'
                    ? 'bg-primary-fixed/50 ring-1 ring-primary-container/30'
                    : 'bg-surface-container-low hover:bg-surface-container'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Flag country="ci" className="w-8" />
                  <div className="text-left">
                    <span className="text-sm font-bold text-on-primary-fixed block">
                      Baoulé (Akan)
                    </span>
                    <span className="text-xs text-on-primary-fixed-variant">
                      Régions Centre & V-Baoulé • Audio vocal actif
                    </span>
                  </div>
                </div>
                {currentLanguage === 'baoule' && (
                  <span className="material-symbols-outlined text-primary text-[24px]">
                    check_circle
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  onLanguageChange('dioula');
                  setIsDialectModalOpen(false);
                  showToast('Langue changée : Dioula (Mandé)');
                }}
                className={`flex items-center justify-between p-3.5 rounded-2xl transition-all ${
                  currentLanguage === 'dioula'
                    ? 'bg-primary-fixed/50 ring-1 ring-primary-container/30'
                    : 'bg-surface-container-low hover:bg-surface-container'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Flag country="ci" className="w-8" />
                  <div className="text-left">
                    <span className="text-sm font-bold text-on-surface block">
                      Dioula (Mandé)
                    </span>
                    <span className="text-xs text-on-surface-variant">
                      Langue véhiculaire commerciale • Synthèse fluide
                    </span>
                  </div>
                </div>
                {currentLanguage === 'dioula' && (
                  <span className="material-symbols-outlined text-primary text-[24px]">
                    check_circle
                  </span>
                )}
              </button>

              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-surface-container-low opacity-75">
                <div className="flex items-center gap-3">
                  <Flag country="ci" className="w-8 opacity-60" />
                  <div className="text-left">
                    <span className="text-sm font-bold text-on-surface block">
                      Bété (Krou)
                    </span>
                    <span className="text-xs text-on-surface-variant">
                      Gagnoa, Daloa • En cours d'entraînement
                    </span>
                  </div>
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-bold">
                  Bientôt
                </span>
              </div>
            </div>
          </Modal>
      )}
    </div>
  );
};

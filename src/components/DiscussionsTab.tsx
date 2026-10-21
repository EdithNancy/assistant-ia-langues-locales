import React, { useEffect, useState } from 'react';
import { BRAND_ASSETS, INITIAL_CHAT_MESSAGES } from '../data/mockData';
import { ChatMessage, Language } from '../types';
import { recorderErrorMessage, useAudioRecorder } from '../hooks/useAudioRecorder';
import { api } from '../services';
import { useVoiceConsent } from './VoiceConsent';
import { soundEngine } from '../utils/audio';
import { voicePlayer, VOICE_LABEL } from '../utils/voicePlayer';

interface DiscussionsTabProps {
  currentLanguage: Language;
  onLanguageChange: (lang: Language) => void;
  onOpenVoiceSession: () => void;
  onBackToHome: () => void;
}

export const DiscussionsTab: React.FC<DiscussionsTabProps> = ({
  currentLanguage,
  onLanguageChange,
  onOpenVoiceSession,
  onBackToHome,
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
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

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
      soundEngine.playTonePitch(msg.tone as any);
    }
    voicePlayer.speak(msg.text, msg.language ?? currentLanguage, playbackSpeed, () => {
      setIsPlayingAudioId(null);
    });
  };

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;
    const userText = inputText.trim();
    setInputText('');

    const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      timestamp: now(),
      text: userText,
      language: currentLanguage,
    };

    setMessages((prev) => [...prev, userMsg]);
    soundEngine.playTone(480, 0.1);

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
      soundEngine.playTonePitch('Haut');
    } catch {
      showToast("Aya n'a pas pu répondre. Vérifiez votre connexion.");
    }
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
  }, [recorder.error]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('Texte copié !');
  };

  return (
    <div className="flex flex-col w-full lg:max-w-4xl lg:mx-auto relative pb-28 lg:pb-32">
      {/* Toast */}
      {toast && (
        <div className="fixed top-20 lg:top-24 left-1/2 lg:left-[calc(50%+8rem)] -translate-x-1/2 z-50 max-w-[calc(100vw-2rem)] px-4 py-2 rounded-full bg-[#003331] text-white text-xs font-semibold shadow-lg animate-in fade-in flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px] text-[#62fae3]">info</span>
          <span>{toast}</span>
        </div>
      )}

      {/* In-Chat Top Navigation Subheader */}
      <div className="sticky top-14 lg:top-16 z-20 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-4 py-2 bg-[#f9f9fb]/95 backdrop-blur-md flex items-center justify-between gap-2 border-b border-[#edeef0] lg:border lg:rounded-2xl lg:bg-white/95">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={onBackToHome}
            aria-label="Retour"
            className="w-10 h-10 -ml-1 rounded-full flex items-center justify-center text-[#1a1c1d] hover:bg-[#edeef0] active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[24px]">arrow_back</span>
          </button>

          <div className="relative shrink-0">
            <img
              alt="Aya AI Avatar"
              className="w-10 h-10 rounded-full object-cover bg-[#b1eeea] p-0.5 shadow-xs ring-1 ring-[#004b49]/20"
              src={BRAND_ASSETS.ayaAvatar}
            />
            <span
              className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#62fae3] border-2 border-white flex items-center justify-center"
              title="En ligne"
            >
              <span className="w-1 h-1 rounded-full bg-[#003331] animate-pulse"></span>
            </span>
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-[#1a1c1d] font-bold truncate">Aya</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-[#b1eeea] text-[#084f4d] font-bold">
                Tuteur IA
              </span>
            </div>
            <span className="text-xs text-[#005047] flex items-center gap-1 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#62fae3]"></span> À l'écoute
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setIsDialectModalOpen(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#edeef0] hover:bg-[#e2e2e4] transition-colors text-[#1a1c1d] active:scale-95"
          >
            <span className="text-xs">🇨🇮</span>
            <span className="text-xs font-bold text-[#003331] capitalize">
              {currentLanguage}
            </span>
            <span className="material-symbols-outlined text-[16px] text-[#3f4948]">
              expand_more
            </span>
          </button>

          <button
            onClick={onOpenVoiceSession}
            aria-label="Lancer la session vocale en direct"
            className="w-9 h-9 rounded-full flex items-center justify-center text-[#004b49] hover:bg-[#edeef0] transition-colors"
          >
            <span className="material-symbols-outlined text-[22px]">call</span>
          </button>
        </div>
      </div>

      {/* Messages Stream */}
      <div className="flex flex-col gap-5 pt-3 pb-24">
        {/* Day Timestamp Divider */}
        <div className="flex items-center justify-center my-1">
          <div className="px-3 py-1 rounded-full bg-[#e8e8ea] text-[#3f4948] text-xs font-semibold shadow-xs">
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
                className="flex flex-col gap-1 max-w-[90%] sm:max-w-[75%] lg:max-w-[65%] ml-auto items-end animate-in fade-in"
              >
                <div className="flex items-center gap-1 text-[11px] text-[#3f4948]">
                  <span>{msg.timestamp}</span>
                  <span className="font-bold text-[#004b49]">Moi</span>
                </div>
                <div className="bg-[#004b49] text-white rounded-3xl rounded-tr-sm p-4 shadow-[0_4px_20px_-2px_rgba(0,75,73,0.15)] flex flex-col gap-1.5">
                  <p className="text-sm leading-relaxed">{msg.text}</p>
                  <div className="flex items-center justify-end gap-1 text-[#7ebab7] text-[10px]">
                    <span>Envoyé</span>
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
              className="flex flex-col gap-1 max-w-[95%] sm:max-w-[85%] lg:max-w-[75%] mr-auto animate-in fade-in"
            >
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="text-[#004b49] font-bold">Aya (IvoirAI)</span>
                <span className="text-[#3f4948]">{msg.timestamp}</span>
              </div>

              <div className="bg-white rounded-3xl rounded-tl-sm p-4 shadow-[0_4px_20px_-2px_rgba(0,75,73,0.06)] flex flex-col gap-3 text-[#1a1c1d] border border-[#edeef0]">
                {/* Main Text */}
                <p className="text-sm leading-relaxed text-[#1a1c1d] font-medium">
                  {msg.text}
                </p>

                {/* If there is a phonetic breakdown or audio bar */}
                <div className="bg-[#f3f3f5] rounded-2xl p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <button
                      onClick={() => handlePlayMessageAudio(msg)}
                      aria-label="Écouter le message"
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-md transition-all active:scale-95 ${
                        isPlaying
                          ? 'bg-[#62fae3] text-[#003331]'
                          : 'bg-[#003331] text-white hover:scale-105'
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
                                ? 'bg-[#004b49] animate-pulse'
                                : 'bg-[#004b49]/40'
                            }`}
                          ></span>
                        )
                      )}
                    </div>
                    <span className="text-[11px] text-[#3f4948] font-semibold">
                      {msg.audioDuration || '0:06'}
                    </span>
                  </div>

                  {/* Speed Controls */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1 bg-[#edeef0] rounded-full p-0.5">
                      {[0.75, 1, 1.25].map((speed) => (
                        <button
                          key={speed}
                          onClick={() => setPlaybackSpeed(speed)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all ${
                            playbackSpeed === speed
                              ? 'bg-white text-[#003331] shadow-xs'
                              : 'text-[#3f4948]'
                          }`}
                        >
                          {speed}x
                        </button>
                      ))}
                    </div>

                    <span className="text-[11px] text-[#3f4948] flex items-center gap-1 font-semibold">
                      <span className="material-symbols-outlined text-[14px] text-[#004c43]">
                        record_voice_over
                      </span>
                      {VOICE_LABEL}
                    </span>
                  </div>
                </div>

                {/* Phonetics & Tone Pill if present */}
                {msg.phonetic && (
                  <div className="flex items-center flex-wrap gap-2 pt-1">
                    <span className="px-2 py-1 rounded-lg bg-[#e8e8ea] text-[11px] text-[#1a1c1d] font-mono font-medium">
                      {msg.phonetic}
                    </span>
                    {msg.tone && (
                      <span className="px-2 py-0.5 rounded-md bg-[#ffdbd2] text-[#3c0800] text-[10px] font-bold flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">graphic_eq</span>
                        {msg.tone}
                      </span>
                    )}
                  </div>
                )}

                {/* Linguistic Cultural Breakdown if present */}
                {msg.linguisticBreakdown && msg.linguisticBreakdown.length > 0 && (
                  <div className="bg-[#f9f9fb] rounded-2xl p-3.5 flex flex-col gap-2 border border-[#edeef0]">
                    <div className="flex items-center gap-1.5 text-[#9e4229] text-xs font-bold">
                      <span className="material-symbols-outlined text-[18px]">lightbulb</span>
                      <span>
                        Décomposition du parler {currentLanguage === 'dioula' ? 'Mandé' : 'Akan'} :
                      </span>
                    </div>

                    <ul className="flex flex-col gap-1.5 text-xs text-[#3f4948]">
                      {msg.linguisticBreakdown.map((item, idx) => (
                        <li key={idx} className="flex items-baseline gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#9e4229] shrink-0"></span>
                          <span>
                            <strong className="text-[#1a1c1d] font-semibold">
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
                <div className="flex items-center justify-between pt-1 border-t border-[#edeef0]/60 text-[#3f4948]">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleCopy(msg.text)}
                      className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#edeef0] transition-colors"
                      title="Copier le texte"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        content_copy
                      </span>
                    </button>
                    <button
                      onClick={onOpenVoiceSession}
                      className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#edeef0] transition-colors"
                      title="Pratiquer la prononciation"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        graphic_eq
                      </span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setLikedMap((prev) => ({ ...prev, [msg.id]: true }));
                        showToast('Merci pour votre retour !');
                      }}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                        likedMap[msg.id]
                          ? 'text-[#004b49] bg-[#b1eeea]'
                          : 'hover:bg-[#edeef0]'
                      }`}
                      title="Utile"
                    >
                      <span className="material-symbols-outlined text-[18px]">thumb_up</span>
                    </button>
                    <button
                      onClick={() => showToast('Remarque notée pour améliorer Aya.')}
                      className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#edeef0] transition-colors"
                      title="À améliorer"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        thumb_down
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sticky Bottom Composer Section */}
      <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] lg:bottom-0 left-0 right-0 lg:left-64 z-30 bg-gradient-to-t from-[#f9f9fb] via-[#f9f9fb]/95 to-transparent pt-3 pb-2 lg:pb-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl lg:max-w-4xl mx-auto flex flex-col gap-2">
          {/* Special African Characters Toolbar */}
          <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-full bg-white shadow-[0_2px_12px_rgba(0,75,73,0.08)] border border-[#edeef0]">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[11px] text-[#3f4948] font-bold px-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px] text-[#004b49]">
                  keyboard_alt
                </span>
                <span className="hidden min-[400px]:inline">Touches :</span>
              </span>
              <div className="flex items-center gap-1">
                {['ɛ', 'ɔ', 'ɲ', 'ŋ', 'ʼ'].map((char) => (
                  <button
                    key={char}
                    onClick={() => handleCharInsert(char)}
                    className="w-7 h-7 rounded-lg bg-[#edeef0] hover:bg-[#b1eeea] hover:text-[#00201f] text-sm font-bold text-[#1a1c1d] flex items-center justify-center active:scale-90 transition-all"
                  >
                    {char}
                  </button>
                ))}
              </div>
            </div>
            <span className="text-[10px] text-[#004b49] font-bold px-1 capitalize">
              {currentLanguage}
            </span>
          </div>

          {/* Main Input Controls */}
          <div className="flex items-center gap-2">
            {/* Attachment Button */}
            <button
              onClick={() => showToast('Ajout d’image ou audio contextuel')}
              aria-label="Joindre un document"
              className="w-12 h-12 rounded-full bg-white text-[#3f4948] hover:text-[#004b49] flex items-center justify-center shadow-md active:scale-95 transition-all shrink-0 border border-[#edeef0]"
            >
              <span className="material-symbols-outlined text-[24px]">add</span>
            </button>

            {/* Rounded Text Input Container */}
            <div className="flex-1 h-12 rounded-full bg-white shadow-md px-4 flex items-center justify-between gap-2 border border-[#edeef0] focus-within:ring-2 focus-within:ring-[#004b49]/30">
              <input
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendMessage();
                }}
                className="w-full bg-transparent text-sm text-[#1a1c1d] placeholder:text-[#707978] focus:outline-none"
                placeholder={`Écrivez en Français ou ${currentLanguage === 'dioula' ? 'Dioula' : 'Baoulé'}...`}
                type="text"
              />
              {inputText ? (
                <button
                  onClick={handleSendMessage}
                  aria-label="Envoyer le message"
                  className="w-8 h-8 rounded-full bg-[#004b49] text-white flex items-center justify-center shrink-0 active:scale-90 transition-transform"
                >
                  <span className="material-symbols-outlined text-[18px]">send</span>
                </button>
              ) : (
                <button
                  onClick={handleMicToggle}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#3f4948] hover:text-[#9e4229] transition-colors"
                  title="Activer le micro"
                >
                  <span className="material-symbols-outlined text-[20px]">graphic_eq</span>
                </button>
              )}
            </div>

            {/* Animated Microphone / Trigger */}
            <div className="relative shrink-0">
              {isRecording && (
                <div
                  style={{ transform: `scale(${1 + recorder.level * 0.6})` }}
                  className="absolute -inset-1.5 rounded-full bg-[#62fae3] opacity-60 blur-xs transition-transform duration-75 pointer-events-none"
                ></div>
              )}
              <button
                onClick={handleMicToggle}
                aria-label={isRecording ? "Arrêter l'enregistrement" : "Parler vocalement à l'IA"}
                className={`relative w-12 h-12 rounded-full flex items-center justify-center shadow-[0_4px_16px_rgba(0,75,73,0.3)] hover:scale-105 active:scale-95 transition-all ${
                  isRecording
                    ? 'bg-[#ba1a1a] text-white'
                    : 'bg-[#004b49] text-[#62fae3]'
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
        <div
          onClick={() => setIsDialectModalOpen(false)}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/40 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-t-[32px] sm:rounded-[32px] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-5 shadow-2xl flex flex-col gap-4 animate-in slide-in-from-bottom duration-300"
          >
            <div className="sm:hidden w-12 h-1.5 bg-[#bfc8c7]/60 rounded-full mx-auto"></div>

            <div className="flex justify-between items-center">
              <div>
                <span className="text-lg font-bold text-[#1a1c1d]">
                  Sélectionner la langue
                </span>
                <p className="text-xs text-[#3f4948]">
                  L'IA s'adapte immédiatement aux tonalités locales.
                </p>
              </div>
              <button
                onClick={() => setIsDialectModalOpen(false)}
                className="w-9 h-9 rounded-full bg-[#edeef0] flex items-center justify-center text-[#3f4948]"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={() => {
                  onLanguageChange('baoule');
                  setIsDialectModalOpen(false);
                  showToast('Langue changée : Baoulé (Akan)');
                }}
                className={`flex items-center justify-between p-3.5 rounded-2xl transition-all ${
                  currentLanguage === 'baoule'
                    ? 'bg-[#b1eeea]/50 ring-1 ring-[#004b49]/30'
                    : 'bg-[#f3f3f5] hover:bg-[#edeef0]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🇨🇮</span>
                  <div className="text-left">
                    <span className="text-sm font-bold text-[#00201f] block">
                      Baoulé (Akan)
                    </span>
                    <span className="text-xs text-[#084f4d]">
                      Régions Centre & V-Baoulé • Audio vocal actif
                    </span>
                  </div>
                </div>
                {currentLanguage === 'baoule' && (
                  <span className="material-symbols-outlined text-[#003331] text-[24px]">
                    check_circle
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  onLanguageChange('dioula');
                  setIsDialectModalOpen(false);
                  showToast('Langue changée : Dioula (Mandé)');
                }}
                className={`flex items-center justify-between p-3.5 rounded-2xl transition-all ${
                  currentLanguage === 'dioula'
                    ? 'bg-[#b1eeea]/50 ring-1 ring-[#004b49]/30'
                    : 'bg-[#f3f3f5] hover:bg-[#edeef0]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🌍</span>
                  <div className="text-left">
                    <span className="text-sm font-bold text-[#1a1c1d] block">
                      Dioula (Mandé)
                    </span>
                    <span className="text-xs text-[#3f4948]">
                      Langue véhiculaire commerciale • Synthèse fluide
                    </span>
                  </div>
                </div>
                {currentLanguage === 'dioula' && (
                  <span className="material-symbols-outlined text-[#003331] text-[24px]">
                    check_circle
                  </span>
                )}
              </button>

              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#f3f3f5] opacity-75">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🌿</span>
                  <div className="text-left">
                    <span className="text-sm font-bold text-[#1a1c1d] block">
                      Bété (Krou)
                    </span>
                    <span className="text-xs text-[#3f4948]">
                      Gagnoa, Daloa • En cours d'entraînement
                    </span>
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#ffdbd2] text-[#3c0800] font-bold">
                  Bientôt
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { VOCABULARY_LIST } from '../data/mockData';
import { Language, VocabularyItem } from '../types';
import { soundEngine } from '../utils/audio';

interface TraduireTabProps {
  currentLanguage: Language;
  onLanguageChange: (lang: Language) => void;
  onOpenVoiceSession: () => void;
}

export const TraduireTab: React.FC<TraduireTabProps> = ({
  currentLanguage,
  onLanguageChange,
  onOpenVoiceSession,
}) => {
  const [sourceLang, setSourceLang] = useState<'fr' | Language>('fr');
  const [targetLang, setTargetLang] = useState<Language>(
    currentLanguage === 'dioula' ? 'dioula' : 'baoule'
  );
  const [sourceText, setSourceText] = useState('Combien coûte le régime de bananes plantain ?');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioSpeedIdx, setAudioSpeedIdx] = useState(0);
  const [isDictating, setIsDictating] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(true);
  const [savedExpressions, setSavedExpressions] = useState<VocabularyItem[]>(VOCABULARY_LIST);
  const [toast, setToast] = useState<string | null>(null);
  const [isDualMicModalOpen, setIsDualMicModalOpen] = useState(false);

  const speeds = ['0.8x', '1.0x', '0.5x'];

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const handleSwap = () => {
    if (sourceLang === 'fr') {
      setSourceLang(targetLang);
      setTargetLang(currentLanguage);
      setSourceText(
        targetLang === 'dioula'
          ? 'Barana yiriwari nin bɛ sɔngɔ jolibɔ ?'
          : 'Alokô kpɛkun nga ɔ to nzen ?'
      );
    } else {
      setSourceLang('fr');
      setSourceText('Combien coûte le régime de bananes plantain ?');
    }
    soundEngine.playTone(520, 0.15);
  };

  const handleClear = () => {
    setSourceText('');
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setSourceText(text);
        showToast('Texte collé !');
      }
    } catch {
      setSourceText('An bɛ taa yɔrɔ juman ?');
      showToast('Exemple de phrase inséré !');
    }
  };

  const handleVoiceInput = () => {
    setIsDictating(true);
    soundEngine.playTone(600, 0.15);
    showToast('Écoute de votre voix...');
    setTimeout(() => {
      setIsDictating(false);
      setSourceText('Où puis-je trouver un bon taxi pour aller au Plateau ?');
      showToast('Dictée vocale transcrite avec succès !');
    }, 2400);
  };

  const getTranslationData = () => {
    const isDioula = targetLang === 'dioula';
    const textLower = sourceText.toLowerCase();

    if (textLower.includes('banane') || textLower.includes('combien')) {
      if (isDioula) {
        return {
          translation: 'Barana yiriwari nin bɛ sɔngɔ jolibɔ ?',
          phonetic: '[Bah-rah-nah yee-ree-wah-ree neen bɛh sɔn-gɔ joh-lee-bɔ]',
          tone: 'Ton Haut-Bas',
          tip: 'Au marché d\'Abidjan, dites simplement « Barana nin joli ? » pour un échange naturel et direct avec le commerçant.',
        };
      } else {
        return {
          translation: 'Alokô kpɛkun nga ɔ to nzen ?',
          phonetic: '[Ah-loh-koh kpeh-koon ngah oh toh n-zen ?]',
          tone: 'Ton Moyen',
          tip: 'Pour le plantain mûr au marché baoulé, précisez « alokô » pour le plantain doux à frire.',
        };
      }
    }

    if (textLower.includes('taxi') || textLower.includes('plateau')) {
      if (isDioula) {
        return {
          translation: 'N bɛ se ka wotoro sɔrɔ ka taa Plató yɔrɔ juman ?',
          phonetic: '[N beh seh kah woh-toh-roh soh-roh kah tah Plah-toh ?]',
          tone: 'Ton Montant',
          tip: 'À Abidjan, les wôro-wôro ou taxis compteurs ont des codes de négociation simples : donnez la destination et demandez « c’est combien ? »',
        };
      } else {
        return {
          translation: 'N wun loto kpa kɔ Plató nuan nun ?',
          phonetic: '[N woon loh-toh kpah koh Plah-toh nwan noon]',
          tone: 'Ton Moyen-Haut',
          tip: 'En Baoulé, le voyage se bénit en souhaitant « Atin kpa » (bonne route).',
        };
      }
    }

    if (isDioula) {
      return {
        translation: 'Aw ni ce kosɛbɛ, an bɛ kɔfɛ !',
        phonetic: '[Ow nee tché koh-seh-beh, an beh koh-feh]',
        tone: 'Ton Haut',
        tip: 'Une salutation chaleureuse ouvre toujours les meilleures opportunités en pays mandé.',
      };
    } else {
      return {
        translation: 'Mo kpa kpa ! Akwaba awlo nun.',
        phonetic: '[Moh kpah kpah ! Ah-kwah-bah ow-loh noon]',
        tone: 'Ton Haut',
        tip: 'Le mot « Akwaba » est le trésor d’accueil de toute la Côte d’Ivoire.',
      };
    }
  };

  const currentTrans = getTranslationData();

  const handlePlayAudio = () => {
    if (isPlayingAudio) return;
    setIsPlayingAudio(true);
    soundEngine.playTonePitch(currentTrans.tone as any);

    const speedVal = parseFloat(speeds[audioSpeedIdx].replace('x', ''));
    soundEngine.speak(currentTrans.translation, speedVal, () => {
      setIsPlayingAudio(false);
    });
  };

  const handleToggleSpeed = () => {
    const nextIdx = (audioSpeedIdx + 1) % speeds.length;
    setAudioSpeedIdx(nextIdx);
    soundEngine.playTone(400, 0.1);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(currentTrans.translation);
    showToast('Traduction copiée dans le presse-papiers !');
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Traduction IvoirAI',
        text: `${currentTrans.translation} (${currentTrans.phonetic})`,
      });
    } else {
      handleCopy();
    }
  };

  const toggleFavoriteItem = (id: string) => {
    setSavedExpressions((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, isFavorite: !item.isFavorite } : item
      )
    );
  };

  const playVocabAudio = (text: string, tone: string) => {
    soundEngine.playTonePitch(tone as any);
    soundEngine.speak(text, 1.0);
  };

  return (
    <div className="flex flex-col w-full pb-10 space-y-4">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-[#003331] text-white text-xs font-semibold shadow-lg animate-in fade-in flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px] text-[#62fae3]">check_circle</span>
          <span>{toast}</span>
        </div>
      )}

      {/* Screen Title & Header */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#3cddc7] animate-pulse"></div>
          <span className="text-base font-bold text-[#003331]">Traducteur Culturel</span>
        </div>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#b1eeea] text-[#00201f] text-[11px] font-bold shadow-xs">
          <span className="material-symbols-outlined text-[14px]">psychology</span>
          IA Contextuelle
        </span>
      </div>

      {/* Language Direction Toggle Pill */}
      <div className="relative flex items-center justify-between bg-[#f3f3f5] p-1.5 rounded-full shadow-xs border border-[#edeef0]">
        {/* Source Language Button */}
        <button
          onClick={() => {
            showToast('Langue source : Français Standard');
          }}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-full bg-white text-[#1a1c1d] shadow-sm transition-all active:scale-95 text-left border border-[#edeef0]"
        >
          <span className="text-base leading-none">
            {sourceLang === 'fr' ? '🇫🇷' : '🇨🇮'}
          </span>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-[#1a1c1d] truncate">
              {sourceLang === 'fr'
                ? 'Français'
                : sourceLang === 'dioula'
                ? 'Dioula'
                : 'Baoulé'}
            </span>
            <span className="text-[10px] text-[#3f4948] truncate -mt-0.5">Standard</span>
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
          onClick={() => {
            const next = targetLang === 'dioula' ? 'baoule' : 'dioula';
            setTargetLang(next);
            onLanguageChange(next);
            showToast(`Langue cible : ${next === 'dioula' ? 'Dioula' : 'Baoulé'}`);
          }}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-full bg-white text-[#1a1c1d] shadow-sm transition-all active:scale-95 text-left border border-[#edeef0]"
        >
          <span className="text-base leading-none">🇨🇮</span>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-[#004b49] truncate capitalize">
              {targetLang}
            </span>
            <span className="text-[10px] text-[#9e4229] font-semibold truncate -mt-0.5">
              {targetLang === 'dioula' ? 'Marché / Véhiculaire' : 'Akan Authentique'}
            </span>
          </div>
          <span className="material-symbols-outlined text-[16px] text-[#707978] ml-auto">
            expand_more
          </span>
        </button>
      </div>

      {/* Source Input Box */}
      <div className="bg-white rounded-3xl p-4 shadow-sm relative transition-all border border-[#edeef0] focus-within:ring-2 focus-within:ring-[#004b49]/20">
        <div className="flex justify-between items-center mb-2">
          <span className="text-[11px] font-bold text-[#707978] uppercase tracking-wider">
            Texte Source
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
          className="w-full bg-transparent resize-none text-sm text-[#1a1c1d] placeholder:text-[#bfc8c7] focus:outline-none leading-relaxed"
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
              <span className="material-symbols-outlined text-[16px] text-[#9e4229]">
                {isDictating ? 'sync' : 'mic'}
              </span>
              {isDictating ? 'Écoute...' : 'Parler'}
            </button>
          </div>

          <span className="text-[11px] text-[#707978] font-medium">
            {sourceText.length} car.
          </span>
        </div>
      </div>

      {/* Translation Result Card */}
      <div className="bg-[#004b49] text-white rounded-3xl p-5 shadow-md relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-36 h-36 rounded-full bg-[#00c5b1]/20 pointer-events-none blur-2xl"></div>

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#62fae3]"></span>
            <span className="text-xs text-[#62fae3] tracking-wide uppercase font-bold">
              Traduction {targetLang === 'dioula' ? 'Dioula' : 'Baoulé'}
            </span>
          </div>
          <span className="text-[10px] bg-[#00332d]/60 px-2.5 py-0.5 rounded-full text-[#b1eeea] font-semibold border border-[#62fae3]/20">
            {currentTrans.tone}
          </span>
        </div>

        <p className="text-lg text-white font-bold leading-snug mb-2">
          {currentTrans.translation}
        </p>

        {/* Phonetics Guide */}
        <div className="bg-[#00332d]/40 rounded-xl px-3 py-2 mb-3 inline-block w-full border border-white/5">
          <span className="text-[10px] text-[#3cddc7] block font-bold mb-0.5">
            Guide Phonétique
          </span>
          <p className="text-xs text-[#edeef0] italic tracking-wide">
            {currentTrans.phonetic}
          </p>
        </div>

        {/* Merchant Tip */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 mb-4 flex items-start gap-2.5 border border-white/10">
          <span className="material-symbols-outlined text-[#ffdbd2] text-[20px] shrink-0 mt-0.5">
            lightbulb
          </span>
          <p className="text-xs text-white leading-relaxed">
            <span className="font-bold text-[#ffdbd2]">Astuce marchande : </span>
            {currentTrans.tip}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between pt-1">
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
              className="px-2.5 py-2 rounded-full bg-[#00332d]/50 text-[#b1eeea] text-[11px] font-bold active:scale-90 transition-transform hover:bg-[#00332d]"
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
                    ? 'Ajouté aux favoris !'
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
      </div>

      {/* Key Expressions & Memorized List */}
      <div className="pt-2 flex flex-col space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[#9e4229] text-[20px]">
              auto_stories
            </span>
            <span className="text-sm font-bold text-[#1a1c1d]">
              Expressions Clés & Mémorisées
            </span>
          </div>
          <button
            onClick={() => showToast('Tous les termes du lexique sont affichés.')}
            className="text-xs text-[#9e4229] font-bold"
          >
            Voir tout
          </button>
        </div>

        <div className="flex flex-col space-y-2.5">
          {savedExpressions.map((item) => (
            <div
              key={item.id}
              className="bg-white p-3.5 rounded-2xl shadow-xs flex items-center justify-between border border-[#edeef0] hover:bg-[#f9f9fb] transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#edeef0] flex items-center justify-center text-[#004b49] shrink-0">
                  <span className="material-symbols-outlined text-[20px]">
                    {item.word === "N'zue"
                      ? 'water_drop'
                      : item.word === 'I ni ce'
                      ? 'handshake'
                      : 'fitness_center'}
                  </span>
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#1a1c1d] truncate">
                      {item.word}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-[#edeef0] text-[10px] text-[#3f4948] font-semibold capitalize">
                      {item.language}
                    </span>
                  </div>
                  <span className="text-xs text-[#3f4948] truncate">
                    {item.meaning}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => playVocabAudio(item.word, item.tone)}
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

      {/* Mode Conversation Immédiate Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-[#edeef0] p-4 flex items-center justify-between shadow-xs border border-[#edeef0]">
        <div className="flex items-center gap-3 z-10">
          <div className="w-12 h-12 rounded-full bg-[#9e4229] flex items-center justify-center text-white shadow-md shrink-0">
            <span className="material-symbols-outlined text-[24px]">record_voice_over</span>
          </div>
          <div>
            <p className="text-sm font-bold text-[#1a1c1d]">Mode Conversation Immédiate</p>
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
          onClick={() => setIsDualMicModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-200"
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#9e4229]">record_voice_over</span>
                <h3 className="text-base font-bold text-[#1a1c1d]">
                  Traduction Instantanée à 2
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
                  showToast('Micro 1 (Français) activé !');
                }}
                className="p-4 rounded-2xl bg-[#ffdbd2] text-[#3c0800] flex flex-col items-center gap-2 active:scale-95 transition-all"
              >
                <span className="text-2xl">🇫🇷</span>
                <span className="text-xs font-bold">Interlocuteur 1</span>
                <span className="text-[10px] text-[#7e2b14]">Français</span>
                <div className="w-10 h-10 rounded-full bg-[#9e4229] text-white flex items-center justify-center shadow-xs">
                  <span className="material-symbols-outlined text-[20px]">mic</span>
                </div>
              </button>

              <button
                onClick={() => {
                  soundEngine.playTone(520, 0.2);
                  showToast('Micro 2 (Dioula/Baoulé) activé !');
                }}
                className="p-4 rounded-2xl bg-[#b1eeea] text-[#00201f] flex flex-col items-center gap-2 active:scale-95 transition-all"
              >
                <span className="text-2xl">🇨🇮</span>
                <span className="text-xs font-bold">Interlocuteur 2</span>
                <span className="text-[10px] text-[#084f4d] capitalize">{targetLang}</span>
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

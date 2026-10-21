import React, { useState } from 'react';
import { BRAND_ASSETS, CULTURAL_STORIES, VOCABULARY_LIST } from '../data/mockData';
import { Language, VocabularyItem } from '../types';
import { soundEngine } from '../utils/audio';
import { voicePlayer } from '../utils/voicePlayer';

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
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-3xl p-5 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200 border border-[#edeef0]"
      >
        <div className="relative w-full h-44 rounded-2xl overflow-hidden shadow-sm">
          <img
            alt={story.title}
            src={story.image}
            className="w-full h-full object-cover"
          />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center backdrop-blur-xs hover:bg-black/60"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
          <span className="absolute bottom-3 left-3 px-2.5 py-1 rounded-full bg-[#003331]/80 backdrop-blur-xs text-[#62fae3] text-[10px] font-bold">
            {story.category}
          </span>
        </div>

        <div>
          <h3 className="text-lg font-bold text-[#1a1c1d] leading-snug">
            {story.title}
          </h3>
          <span className="text-xs text-[#707978]">Lecture : {story.readTime}</span>
        </div>

        <p className="text-xs text-[#3f4948] leading-relaxed whitespace-pre-line">
          {story.content}
        </p>

        {/* Audio Proverb Player Card */}
        <div className="p-3.5 rounded-2xl bg-[#ffdbd2]/40 border border-[#ffdbd2] flex items-center justify-between gap-3">
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] text-[#9e4229] font-bold uppercase tracking-wider">
              Proverbe en Baoulé
            </span>
            <p className="text-xs font-bold text-[#3c0800] truncate mt-0.5">
              « {story.audioPhrase} »
            </p>
            <span className="text-[10px] text-[#7e2b14] truncate">
              {story.audioTranslation}
            </span>
          </div>

          <button
            onClick={handlePlayProverb}
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-90 ${
              isPlayingAudio
                ? 'bg-[#9e4229] text-white animate-pulse'
                : 'bg-[#9e4229] text-white shadow-sm'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">
              {isPlayingAudio ? 'pause' : 'volume_up'}
            </span>
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-full bg-[#004b49] text-white text-xs font-bold active:scale-95 transition-transform"
        >
          Fermer l'histoire
        </button>
      </div>
    </div>
  );
};

interface VocabularyModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLanguage: Language;
}

export const VocabularyModal: React.FC<VocabularyModalProps> = ({
  isOpen,
  onClose,
  currentLanguage,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  if (!isOpen) return null;

  const filtered = VOCABULARY_LIST.filter(
    (v) =>
      v.word.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.meaning.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-3xl p-5 shadow-2xl flex flex-col gap-3 max-h-[85vh] overflow-y-auto animate-in zoom-in-95 duration-200 border border-[#edeef0]"
      >
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-base font-bold text-[#1a1c1d]">
              Lexique & Expressions Essentielles
            </h3>
            <p className="text-xs text-[#3f4948]">Vocabulaire pratique Baoulé & Dioula</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#edeef0] flex items-center justify-center text-[#3f4948]"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher un mot, un marché, une salutation..."
            className="w-full h-10 pl-9 pr-4 rounded-xl bg-[#f3f3f5] text-xs text-[#1a1c1d] focus:outline-none focus:ring-1 focus:ring-[#004b49]"
          />
          <span className="material-symbols-outlined absolute left-2.5 top-2.5 text-[#707978] text-[18px]">
            search
          </span>
        </div>

        <div className="flex flex-col gap-2 pt-1 overflow-y-auto max-h-[50vh]">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="p-3 rounded-2xl bg-[#f9f9fb] border border-[#edeef0] flex items-center justify-between"
            >
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-[#004b49]">{item.word}</span>
                  <span className="text-[10px] text-[#707978]">{item.phonetic}</span>
                  <span className="px-1.5 py-0.2 rounded bg-[#edeef0] text-[9px] font-bold uppercase text-[#3f4948]">
                    {item.language}
                  </span>
                </div>
                <span className="text-xs text-[#1a1c1d] font-medium mt-0.5">
                  {item.meaning}
                </span>
                <span className="text-[11px] text-[#707978] italic mt-0.5">
                  « {item.example} » ({item.exampleMeaning})
                </span>
              </div>

              <button
                onClick={() => {
                  soundEngine.playTonePitch(item.tone as any);
                  voicePlayer.speak(item.word, item.language, 0.9);
                }}
                className="w-8 h-8 rounded-full bg-[#edeef0] hover:bg-[#b1eeea] text-[#004b49] flex items-center justify-center shrink-0 active:scale-90 transition-transform ml-2"
              >
                <span className="material-symbols-outlined text-[18px]">volume_up</span>
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-full bg-[#004b49] text-white text-xs font-bold active:scale-95 transition-transform"
        >
          Fermer le lexique
        </button>
      </div>
    </div>
  );
};

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLanguage: Language;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  currentLanguage,
}) => {
  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200 border border-[#edeef0]"
      >
        <div className="flex justify-between items-center">
          <h3 className="text-base font-bold text-[#1a1c1d]">Mon Profil IvoirAI</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#edeef0] flex items-center justify-center text-[#3f4948]"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div className="flex flex-col items-center text-center gap-2">
          <div className="relative">
            <img
              src={BRAND_ASSETS.edithProfile}
              alt="Portrait Edith"
              className="w-20 h-20 rounded-full object-cover shadow-sm ring-4 ring-[#004b49]/20"
            />
            <span className="absolute bottom-0 right-1 w-4 h-4 bg-[#62fae3] rounded-full ring-2 ring-white"></span>
          </div>

          <div>
            <h4 className="text-base font-bold text-[#1a1c1d]">Edith Kouadio</h4>
            <span className="text-xs text-[#3f4948]">kouadioedith440@gmail.com</span>
          </div>

          <div className="flex items-center gap-2 mt-1">
            <span className="px-3 py-1 rounded-full bg-[#ffdbd2] text-[#3c0800] text-xs font-bold">
              Intermédiaire B2
            </span>
            <span className="px-3 py-1 rounded-full bg-[#b1eeea] text-[#00201f] text-xs font-bold">
              840 XP
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-2 border-t border-[#edeef0]">
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#f3f3f5]">
            <span className="text-xs text-[#1a1c1d] font-semibold">Tuteur IA actif</span>
            <span className="text-xs text-[#004b49] font-bold">Aya d'Abidjan</span>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#f3f3f5]">
            <span className="text-xs text-[#1a1c1d] font-semibold">Langue favorite</span>
            <span className="text-xs text-[#004b49] font-bold capitalize">
              {currentLanguage}
            </span>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#f3f3f5]">
            <span className="text-xs text-[#1a1c1d] font-semibold">Série de connexion</span>
            <span className="text-xs text-[#9e4229] font-bold">7 jours consécutifs 🔥</span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-full bg-[#004b49] text-white text-xs font-bold active:scale-95 transition-transform"
        >
          Retour à l'application
        </button>
      </div>
    </div>
  );
};

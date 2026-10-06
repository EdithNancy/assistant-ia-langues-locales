import React from 'react';

export type TabKey = 'accueil' | 'discussions' | 'vocal' | 'apprendre' | 'traduire';

interface BottomNavProps {
  currentTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  onStartVoiceSession: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onTabChange,
  onStartVoiceSession,
}) => {
  return (
    <nav className="fixed bottom-0 w-full z-40 bg-[#f9f9fb]/92 backdrop-blur-xl border-t border-[#edeef0]/80 shadow-[0_-4px_24px_rgba(0,75,73,0.06)]">
      <div className="relative flex justify-around items-center h-16 px-2 max-w-md mx-auto">
        {/* Accueil */}
        <button
          onClick={() => onTabChange('accueil')}
          className={`flex flex-col items-center justify-center min-w-[56px] h-12 transition-all duration-200 ${
            currentTab === 'accueil'
              ? 'text-[#004b49] font-bold scale-105'
              : 'text-[#3f4948] hover:text-[#1a1c1d]'
          }`}
        >
          <span
            className={`material-symbols-outlined text-[24px] ${
              currentTab === 'accueil' ? 'fill' : ''
            }`}
          >
            home
          </span>
          <span className="text-[10px] mt-0.5 tracking-tight font-medium">Accueil</span>
        </button>

        {/* Discussions */}
        <button
          onClick={() => onTabChange('discussions')}
          className={`flex flex-col items-center justify-center min-w-[56px] h-12 transition-all duration-200 ${
            currentTab === 'discussions'
              ? 'text-[#004b49] font-bold scale-105'
              : 'text-[#3f4948] hover:text-[#1a1c1d]'
          }`}
        >
          <span
            className={`material-symbols-outlined text-[24px] ${
              currentTab === 'discussions' ? 'fill' : ''
            }`}
          >
            chat_bubble
          </span>
          <span className="text-[10px] mt-0.5 tracking-tight font-medium">Discussions</span>
        </button>

        {/* Central Vocal Action Button */}
        <div className="relative -top-5 flex flex-col items-center justify-center">
          <div className="relative group">
            {/* Glowing animated halo */}
            <div className="absolute -inset-2 rounded-full bg-[#62fae3]/30 blur-md animate-pulse"></div>

            <button
              onClick={onStartVoiceSession}
              aria-label="Lancer la session vocale en direct"
              className="relative w-14 h-14 rounded-full bg-gradient-to-tr from-[#003331] via-[#004b49] to-[#005a57] text-white flex items-center justify-center shadow-[0_4px_24px_rgba(45,212,191,0.4)] hover:scale-105 active:scale-95 transition-all duration-300 ring-4 ring-[#f9f9fb]"
            >
              <span className="material-symbols-outlined text-[28px] text-[#62fae3]">
                mic
              </span>
            </button>
          </div>
          <span className="text-[10px] text-[#004b49] font-bold mt-1 tracking-tight">
            Vocal
          </span>
        </div>

        {/* Apprendre */}
        <button
          onClick={() => onTabChange('apprendre')}
          className={`flex flex-col items-center justify-center min-w-[56px] h-12 transition-all duration-200 ${
            currentTab === 'apprendre'
              ? 'text-[#004b49] font-bold scale-105'
              : 'text-[#3f4948] hover:text-[#1a1c1d]'
          }`}
        >
          <span
            className={`material-symbols-outlined text-[24px] ${
              currentTab === 'apprendre' ? 'fill' : ''
            }`}
          >
            school
          </span>
          <span className="text-[10px] mt-0.5 tracking-tight font-medium">Apprendre</span>
        </button>

        {/* Traduire */}
        <button
          onClick={() => onTabChange('traduire')}
          className={`flex flex-col items-center justify-center min-w-[56px] h-12 transition-all duration-200 ${
            currentTab === 'traduire'
              ? 'text-[#004b49] font-bold scale-105'
              : 'text-[#3f4948] hover:text-[#1a1c1d]'
          }`}
        >
          <span
            className={`material-symbols-outlined text-[24px] ${
              currentTab === 'traduire' ? 'fill' : ''
            }`}
          >
            translate
          </span>
          <span className="text-[10px] mt-0.5 tracking-tight font-medium">Traduire</span>
        </button>
      </div>

      {/* iOS style bottom bar indicator */}
      <div className="w-full flex justify-center pb-2">
        <div className="w-32 h-1 bg-[#1a1c1d]/20 rounded-full"></div>
      </div>
    </nav>
  );
};

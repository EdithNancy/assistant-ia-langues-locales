import React from 'react';
import { BRAND_ASSETS } from '../data/mockData';
import { NAV_ITEMS, TabKey } from './BottomNav';

interface SidebarProps {
  currentTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  onStartVoiceSession: () => void;
  onOpenProfile: () => void;
}

/** Navigation latérale affichée uniquement sur grand écran (lg+). Remplace la BottomNav. */
export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  onStartVoiceSession,
  onOpenProfile,
}) => {
  return (
    <aside className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-64 flex-col bg-white border-r border-[#edeef0] shadow-[4px_0_24px_rgba(0,75,73,0.04)]">
      {/* Brand */}
      <div className="h-16 px-5 flex items-center gap-3 border-b border-[#edeef0]/60">
        <div className="relative">
          <img src={BRAND_ASSETS.logo} alt="IvoirAI Brand Logo" className="h-9 w-9 object-contain" />
          <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#62fae3] ring-1 ring-white"></span>
        </div>
        <div className="flex flex-col">
          <span className="text-base font-extrabold text-[#003331] tracking-tight leading-none">
            IvoirAI
          </span>
          <span className="text-xs text-[#3f4948] font-medium mt-0.5">Baoulé & Dioula</span>
        </div>
      </div>

      {/* Vocal CTA */}
      <div className="px-4 pt-5">
        <button
          onClick={onStartVoiceSession}
          aria-label="Lancer la session vocale en direct"
          className="w-full h-12 rounded-2xl bg-gradient-to-tr from-[#003331] via-[#004b49] to-[#005a57] text-white flex items-center justify-center gap-2 font-bold text-sm shadow-[0_4px_24px_rgba(45,212,191,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <span className="material-symbols-outlined text-[22px] text-[#62fae3]">mic</span>
          Session vocale
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 pt-5 flex flex-col gap-1" aria-label="Navigation principale">
        <span className="px-3 pb-1 text-xs font-bold uppercase tracking-wider text-[#707978]">
          Menu
        </span>
        {NAV_ITEMS.map((item) => {
          const isActive = currentTab === item.key;
          return (
            <button
              key={item.key}
              disabled={item.disabled}
              onClick={() => onTabChange(item.key)}
              aria-current={isActive ? 'page' : undefined}
              className={`h-11 px-3 rounded-xl flex items-center gap-3 text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                isActive
                  ? 'bg-[#b1eeea]/50 text-[#004b49] font-bold'
                  : 'text-[#3f4948] font-medium hover:bg-[#f3f3f5] hover:text-[#1a1c1d]'
              }`}
            >
              <span className={`material-symbols-outlined text-[22px] ${isActive ? 'fill' : ''}`}>
                {item.icon}
              </span>
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Profile */}
      <button
        onClick={onOpenProfile}
        className="m-3 p-3 rounded-2xl flex items-center gap-3 bg-[#f3f3f5] hover:bg-[#edeef0] transition-colors text-left"
      >
        <img
          src={BRAND_ASSETS.edithProfile}
          alt="Profil Edith"
          className="w-9 h-9 rounded-full object-cover ring-2 ring-[#004b49]/20"
        />
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-bold text-[#1a1c1d] truncate">Edith</span>
          <span className="text-xs text-[#3f4948]">Voir mon profil</span>
        </div>
      </button>
    </aside>
  );
};

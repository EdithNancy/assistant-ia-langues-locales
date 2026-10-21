import React from 'react';
import { BRAND_ASSETS } from '../data/mockData';

interface HeaderProps {
  title: string;
  onOpenNotifications: () => void;
  onOpenProfile: () => void;
  currentTime?: string;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  onOpenNotifications,
  onOpenProfile,
}) => {
  return (
    <header className="fixed top-0 inset-x-0 lg:left-64 z-30 bg-[#f9f9fb]/90 backdrop-blur-xl border-b border-[#edeef0]/60 transition-all pt-[env(safe-area-inset-top)]">
      {/* Main Top Bar */}
      <div className="h-14 lg:h-16 px-4 sm:px-6 lg:px-8 max-w-2xl lg:max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Logo masqué sur desktop : déjà présent dans la barre latérale */}
          <div className="relative group cursor-pointer lg:hidden">
            <img
              src={BRAND_ASSETS.logo}
              alt="IvoirAI Brand Logo"
              className="h-8 w-8 object-contain transition-transform duration-300 group-hover:scale-105"
            />
            <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#62fae3] ring-1 ring-white"></span>
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-bold text-[#004b49] uppercase tracking-wider leading-none">
              IvoirAI
            </span>
            <h1 className="text-lg lg:text-xl font-bold text-[#1a1c1d] tracking-tight leading-tight">
              {title}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onOpenNotifications}
            aria-label="Notifications"
            className="relative w-10 h-10 flex items-center justify-center rounded-full text-[#3f4948] hover:bg-[#edeef0] active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[22px]">notifications</span>
            <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-[#9e4229] shadow-xs"></span>
          </button>

          <button
            onClick={onOpenProfile}
            aria-label="Profil utilisateur"
            className="w-10 h-10 flex items-center justify-center rounded-full relative group active:scale-95 transition-all"
          >
            <img
              src={BRAND_ASSETS.edithProfile}
              alt="Profil Edith"
              className="w-8 h-8 rounded-full object-cover ring-2 ring-[#004b49]/20 group-hover:ring-[#004b49] transition-all"
            />
          </button>
        </div>
      </div>
    </header>
  );
};

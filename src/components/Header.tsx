import React from 'react';
import { BRAND_ASSETS } from '../data/mockData';
import { IconButton } from './ui/IconButton';

interface HeaderProps {
  title: string;
  onOpenNotifications: () => void;
  onOpenProfile: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  currentTime?: string;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  onOpenNotifications,
  onOpenProfile,
  isDark,
  onToggleTheme,
}) => {
  return (
    <header className="fixed top-0 inset-x-0 lg:left-64 z-30 bg-surface/90 backdrop-blur-xl border-b border-surface-container/60 transition-all pt-[env(safe-area-inset-top)]">
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
            <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-tertiary-fixed ring-1 ring-white"></span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-primary-container uppercase tracking-wider leading-none">
              IvoirAI
            </span>
            <h1 className="text-lg lg:text-xl font-bold text-on-surface tracking-tight leading-tight">
              {title}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <IconButton
            onClick={onToggleTheme}
            aria-label={isDark ? 'Activer le mode clair' : 'Activer le mode sombre'}
            aria-pressed={isDark}
            title={isDark ? 'Mode clair' : 'Mode sombre'}
            icon={isDark ? 'light_mode' : 'dark_mode'}
            size="lg"
            iconClassName="text-[22px]"
            className="text-on-surface-variant hover:bg-surface-container active:scale-95"
          />

          <button
            onClick={onOpenNotifications}
            aria-label="Notifications"
            className="relative w-10 h-10 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[22px]">notifications</span>
            <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-secondary shadow-soft"></span>
          </button>

          <button
            onClick={onOpenProfile}
            aria-label="Profil utilisateur"
            className="w-10 h-10 flex items-center justify-center rounded-full relative group active:scale-95 transition-all"
          >
            <img
              src={BRAND_ASSETS.edithProfile}
              alt="Profil Edith"
              className="w-8 h-8 rounded-full object-cover ring-2 ring-primary-container/20 group-hover:ring-primary-container transition-all"
            />
          </button>
        </div>
      </div>
    </header>
  );
};

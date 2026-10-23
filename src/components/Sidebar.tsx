import React from 'react';
import { BRAND_ASSETS } from '../data/mockData';
import { NAV_ITEMS, TabKey } from './BottomNav';
import { UserAvatar, useUserProfile } from './UserProfile';
import { firstName } from '../utils/profile';

interface SidebarProps {
  /** Onglet actif ; absent sur les pages hors menu (Réglages). */
  currentTab?: TabKey;
  onTabChange: (tab: TabKey) => void;
  onStartVoiceSession: () => void;
  onOpenProfile: () => void;
  isSettingsActive: boolean;
  onOpenSettings: () => void;
}

/** Navigation latérale affichée uniquement sur grand écran (lg+). Remplace la BottomNav. */
export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  onStartVoiceSession,
  onOpenProfile,
  isSettingsActive,
  onOpenSettings,
}) => {
  const { profile } = useUserProfile();
  return (
    <aside className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-64 flex-col bg-surface-container-lowest border-r border-surface-container shadow-soft">
      {/* Brand */}
      <div className="h-16 px-5 flex items-center gap-3 border-b border-surface-container/60">
        <div className="relative">
          <img src={BRAND_ASSETS.logo} alt="IvoirAI Brand Logo" className="h-9 w-9 object-contain" />
          <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-tertiary-fixed ring-1 ring-white"></span>
        </div>
        <div className="flex flex-col">
          <span className="text-base font-extrabold text-primary tracking-tight leading-none">
            IvoirAI
          </span>
          <span className="text-xs text-on-surface-variant font-medium mt-0.5">Baoulé & Dioula</span>
        </div>
      </div>

      {/* Vocal CTA */}
      <div className="px-4 pt-5">
        <button
          onClick={onStartVoiceSession}
          aria-label="Lancer la session vocale en direct"
          className="w-full h-12 rounded-2xl bg-gradient-to-tr from-primary via-primary-container to-primary-bright text-white flex items-center justify-center gap-2 font-bold text-sm shadow-glow hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <span className="material-symbols-outlined text-[22px] text-tertiary-fixed">mic</span>
          Session vocale
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 pt-5 flex flex-col gap-1" aria-label="Navigation principale">
        <span className="px-3 pb-1 text-xs font-bold uppercase tracking-wider text-outline">
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
                  ? 'bg-primary-fixed/50 text-primary-container font-bold'
                  : 'text-on-surface-variant font-medium hover:bg-surface-container-low hover:text-on-surface'
              }`}
            >
              <span className={`material-symbols-outlined text-[22px] ${isActive ? 'fill' : ''}`}>
                {item.icon}
              </span>
              {item.label}
            </button>
          );
        })}

        <span className="mt-4 px-3 pb-1 text-xs font-bold uppercase tracking-wider text-outline">
          Compte
        </span>
        <button
          onClick={onOpenSettings}
          aria-current={isSettingsActive ? 'page' : undefined}
          className={`h-11 px-3 rounded-xl flex items-center gap-3 text-sm transition-all ${
            isSettingsActive
              ? 'bg-primary-fixed/50 text-primary-container font-bold'
              : 'text-on-surface-variant font-medium hover:bg-surface-container-low hover:text-on-surface'
          }`}
        >
          <span className={`material-symbols-outlined text-[22px] ${isSettingsActive ? 'fill' : ''}`}>settings</span>
          Réglages
        </button>
      </nav>

      {/* Profile */}
      <button
        onClick={onOpenProfile}
        className="m-3 p-3 rounded-2xl flex items-center gap-3 bg-surface-container-low hover:bg-surface-container transition-colors text-left"
      >
        <UserAvatar className="w-9 h-9 shrink-0 ring-2 ring-primary-container/20" />
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-bold text-on-surface truncate">{firstName(profile.fullName) || 'Mon compte'}</span>
          <span className="text-xs text-on-surface-variant">Voir mon profil</span>
        </div>
      </button>
    </aside>
  );
};

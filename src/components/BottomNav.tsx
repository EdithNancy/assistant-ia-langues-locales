import React from 'react';

export type TabKey = 'accueil' | 'discussions' | 'vocal' | 'apprendre' | 'traduire';

/** Onglets de navigation classiques (le bouton « Vocal » est traité à part). */
export type NavTabKey = Exclude<TabKey, 'vocal'>;

export interface NavItem {
  key: NavTabKey;
  label: string;
  icon: string;
  disabled?: boolean;
}

/** Configuration partagée entre la barre du bas (mobile) et la barre latérale (desktop). */
export const NAV_ITEMS: readonly NavItem[] = [
  { key: 'accueil', label: 'Accueil', icon: 'home' },
  { key: 'discussions', label: 'Discussions', icon: 'chat_bubble' },
  { key: 'apprendre', label: 'Apprendre', icon: 'school', disabled: true },
  { key: 'traduire', label: 'Traduire', icon: 'translate' },
];

interface BottomNavProps {
  currentTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  onStartVoiceSession: () => void;
}

const NavButton: React.FC<{
  item: NavItem;
  isActive: boolean;
  onClick: () => void;
}> = ({ item, isActive, onClick }) => (
  <button
    disabled={item.disabled}
    onClick={onClick}
    aria-current={isActive ? 'page' : undefined}
    title={item.disabled ? 'Bientôt disponible' : undefined}
    className={`flex flex-col items-center justify-center min-w-[56px] h-12 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed ${
      isActive ? 'text-primary-container font-bold scale-105' : 'text-on-surface-variant hover:text-on-surface'
    }`}
  >
    <span className={`material-symbols-outlined text-[24px] ${isActive ? 'fill' : ''}`}>
      {item.icon}
    </span>
    <span className="text-[11px] mt-0.5 tracking-tight font-medium">{item.label}</span>
  </button>
);

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onTabChange,
  onStartVoiceSession,
}) => {
  const [left, right] = [NAV_ITEMS.slice(0, 2), NAV_ITEMS.slice(2)];

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-surface/92 backdrop-blur-xl border-t border-surface-container/80 shadow-soft pb-[env(safe-area-inset-bottom)]">
      <div className="relative flex justify-around items-center h-16 px-2 max-w-2xl mx-auto">
        {left.map((item) => (
          <NavButton
            key={item.key}
            item={item}
            isActive={currentTab === item.key}
            onClick={() => onTabChange(item.key)}
          />
        ))}

        {/* Central Vocal Action Button */}
        <div className="relative -top-5 flex flex-col items-center justify-center">
          <div className="relative group">
            {/* Glowing animated halo */}
            <div className="absolute -inset-2 rounded-full bg-tertiary-fixed/30 blur-md animate-pulse"></div>

            <button
              onClick={onStartVoiceSession}
              aria-label="Lancer la session vocale en direct"
              className="relative w-14 h-14 rounded-full bg-gradient-to-tr from-primary via-primary-container to-primary-bright text-white flex items-center justify-center shadow-glow hover:scale-105 active:scale-95 transition-all duration-300 ring-4 ring-surface"
            >
              <span className="material-symbols-outlined text-[28px] text-tertiary-fixed">mic</span>
            </button>
          </div>
          <span className="text-[11px] text-primary-container font-bold mt-1 tracking-tight">Vocal</span>
        </div>

        {right.map((item) => (
          <NavButton
            key={item.key}
            item={item}
            isActive={currentTab === item.key}
            onClick={() => onTabChange(item.key)}
          />
        ))}
      </div>
    </nav>
  );
};

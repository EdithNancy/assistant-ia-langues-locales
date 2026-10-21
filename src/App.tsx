import React, { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { Header } from './components/Header';
import { BottomNav, NavTabKey, TabKey } from './components/BottomNav';
import { Sidebar } from './components/Sidebar';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { HomeTab } from './components/HomeTab';
import { DiscussionsTab } from './components/DiscussionsTab';
import { TraduireTab } from './components/TraduireTab';
import { ApprendreTab } from './components/ApprendreTab';
import { VoiceSessionModal } from './components/VoiceSessionModal';
import { ProfileModal, StoryModal, VocabularyModal } from './components/Modals';
import { LoginPage } from './components/auth/LoginPage';
import { RegisterPage } from './components/auth/RegisterPage';
import { BRAND_ASSETS } from './data/mockData';
import { Language } from './types';
import { soundEngine } from './utils/audio';
import { loadPreferences, savePreferences } from './utils/preferences';
import { loadSession, saveSession } from './utils/session';

/** Une URL par onglet : le rafraîchissement et le bouton Retour fonctionnent. */
const TAB_PATHS: Record<NavTabKey, string> = {
  accueil: '/accueil',
  discussions: '/discussions',
  traduire: '/traduire',
  apprendre: '/apprendre',
};

const AUTH_PATHS = { login: '/connexion', register: '/inscription' } as const;

const tabFromPath = (pathname: string): NavTabKey | null =>
  (Object.keys(TAB_PATHS) as NavTabKey[]).find((tab) => TAB_PATHS[tab] === pathname) ?? null;

export default function App() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(() => loadSession() !== null);
  const [currentLanguage, setCurrentLanguage] = useState<Language>(
    () => loadSession()?.language ?? 'baoule'
  );
  const [voiceFirst, setVoiceFirst] = useState(() => loadPreferences().voiceFirst);
  const isOnline = useOnlineStatus();
  const currentTab: NavTabKey = tabFromPath(pathname) ?? 'accueil';
  const setCurrentTab = (tab: NavTabKey) => navigate(TAB_PATHS[tab]);
  const [isVoiceSessionOpen, setIsVoiceSessionOpen] = useState(false);
  const [isStoryModalOpen, setIsStoryModalOpen] = useState(false);
  const [isVocabularyModalOpen, setIsVocabularyModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [notificationToast, setNotificationToast] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    soundEngine.playTone(540, 0.15);
    setNotificationToast(msg);
    setTimeout(() => setNotificationToast(null), 3000);
  };

  const handleTabChange = (tab: TabKey) => {
    if (tab === 'vocal') {
      setIsVoiceSessionOpen(true);
      return;
    }
    soundEngine.playTone(400, 0.08);
    setCurrentTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLanguageChange = (lang: Language) => {
    setCurrentLanguage(lang);
    saveSession({ language: lang });
    soundEngine.playTonePitch(lang === 'dioula' ? 'Moyen' : 'Haut');
    showNotification(
      lang === 'dioula'
        ? 'Mode Dioula (Mandé) activé'
        : 'Mode Baoulé (Akan) activé'
    );
  };

  const handleToggleVoiceFirst = () => {
    const next = !voiceFirst;
    setVoiceFirst(next);
    savePreferences({ voiceFirst: next });
    showNotification(next ? 'Mode voix d’abord activé' : 'Mode voix d’abord désactivé');
  };

  const handleStartVoiceSession = () => {
    setIsVoiceSessionOpen(true);
  };

  const handleSelectDiscussion = (title: string, lang: Language) => {
    setCurrentLanguage(lang);
    saveSession({ language: lang });
    setCurrentTab('discussions');
    showNotification(`Ouverture de la discussion : ${title}`);
  };

  const handleAuthenticated = (lang: Language) => {
    setCurrentLanguage(lang);
    saveSession({ language: lang });
    setIsAuthenticated(true);
    navigate(TAB_PATHS.accueil, { replace: true });
    window.scrollTo({ top: 0 });
    showNotification(lang === 'dioula' ? 'I ni ce ! Bienvenue sur IvoirAI' : 'Akwaba ! Bienvenue sur IvoirAI');
  };

  if (!isAuthenticated) {
    const isRegister = pathname === AUTH_PATHS.register;
    if (!isRegister && pathname !== AUTH_PATHS.login) {
      return <Navigate to={AUTH_PATHS.login} replace />;
    }
    const goTo = (view: keyof typeof AUTH_PATHS) => {
      navigate(AUTH_PATHS[view]);
      window.scrollTo({ top: 0 });
    };
    return (
      <div className="min-h-screen bg-[#f9f9fb] text-[#1a1c1d] lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        {/* Panneau de marque : visible uniquement sur grand écran */}
        <AuthBrandPanel />

        <div className="w-full max-w-md lg:max-w-lg mx-auto min-h-screen bg-[#f9f9fb] relative shadow-[0_0_50px_rgba(0,51,49,0.08)] lg:shadow-none">
          {!isRegister ? (
            <LoginPage onAuthenticated={handleAuthenticated} onGoToRegister={() => goTo('register')} />
          ) : (
            <RegisterPage
              onAuthenticated={handleAuthenticated}
              onGoToLogin={() => goTo('login')}
              onBack={() => goTo('login')}
            />
          )}
        </div>
      </div>
    );
  }

  // Connecté : les pages d'auth et les URL inconnues renvoient vers l'accueil
  if (tabFromPath(pathname) === null) {
    return <Navigate to={TAB_PATHS.accueil} replace />;
  }

  const getHeaderTitle = () => {
    switch (currentTab) {
      case 'discussions':
        return 'Discussions';
      case 'apprendre':
        return 'Apprendre';
      case 'traduire':
        return 'Traduire';
      default:
        return 'Accueil';
    }
  };

  return (
    <div className={`min-h-screen bg-[#f9f9fb] text-[#1a1c1d] ${voiceFirst ? 'voice-first' : ''}`}>
      {/* Desktop Side Navigation (lg+) */}
      <Sidebar
        currentTab={currentTab}
        onTabChange={handleTabChange}
        onStartVoiceSession={handleStartVoiceSession}
        onOpenProfile={() => setIsProfileModalOpen(true)}
      />

      {/* Container wrapper: pleine largeur sur mobile, décalé de la barre latérale sur desktop */}
      <div className="w-full min-h-screen bg-[#f9f9fb] flex flex-col relative lg:pl-64">
        {/* Top Header */}
        <Header
          title={getHeaderTitle()}
          onOpenNotifications={() =>
            showNotification(
              'Aya : Nouveau proverbe du jour disponible en audio !'
            )
          }
          onOpenProfile={() => setIsProfileModalOpen(true)}
        />

        {/* Bandeau hors connexion */}
        {!isOnline && (
          <div
            role="status"
            className="fixed top-[calc(3.5rem+env(safe-area-inset-top))] lg:top-16 inset-x-0 lg:left-64 z-30 px-4 py-2 bg-[#9e4229] text-white text-xs font-semibold flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[16px]">wifi_off</span>
            Hors connexion : Aya, la traduction et la voix sont indisponibles.
          </div>
        )}

        {/* Floating Notification Toast */}
        {notificationToast && (
          <div className="fixed top-20 lg:top-24 left-1/2 lg:left-[calc(50%+8rem)] -translate-x-1/2 z-50 max-w-[calc(100vw-2rem)] px-4 py-2 rounded-full bg-[#003331] text-white text-xs font-semibold shadow-xl flex items-center gap-2 border border-[#62fae3]/20 animate-in fade-in slide-in-from-top-2 duration-200">
            <span className="material-symbols-outlined text-[16px] text-[#62fae3]">
              notifications_active
            </span>
            <span>{notificationToast}</span>
          </div>
        )}

        {/* Tab Content Stream */}
        <main className="flex-1 w-full max-w-2xl lg:max-w-6xl mx-auto pt-22 lg:pt-24 pb-28 lg:pb-10 px-4 sm:px-6 lg:px-8">
          {currentTab === 'accueil' && (
            <HomeTab
              currentLanguage={currentLanguage}
              onLanguageChange={handleLanguageChange}
              onOpenVoiceSession={handleStartVoiceSession}
              onNavigateTab={(tab) => setCurrentTab(tab)}
              onOpenStoryModal={() => setIsStoryModalOpen(true)}
              onOpenVocabularyModal={() => setIsVocabularyModalOpen(true)}
              onOpenProfile={() => setIsProfileModalOpen(true)}
              onSelectDiscussion={handleSelectDiscussion}
              voiceFirst={voiceFirst}
              onToggleVoiceFirst={handleToggleVoiceFirst}
            />
          )}

          {currentTab === 'discussions' && (
            <DiscussionsTab
              currentLanguage={currentLanguage}
              onLanguageChange={handleLanguageChange}
              onOpenVoiceSession={handleStartVoiceSession}
              onBackToHome={() => setCurrentTab('accueil')}
              voiceFirst={voiceFirst}
            />
          )}

          {currentTab === 'traduire' && (
            <TraduireTab
              currentLanguage={currentLanguage}
              onLanguageChange={handleLanguageChange}
              onOpenVoiceSession={handleStartVoiceSession}
              voiceFirst={voiceFirst}
            />
          )}

          {currentTab === 'apprendre' && (
            <ApprendreTab
              currentLanguage={currentLanguage}
              onLanguageChange={handleLanguageChange}
              onOpenVoiceSession={handleStartVoiceSession}
            />
          )}
        </main>

        {/* Bottom Floating Navigation (mobile & tablette uniquement) */}
        <BottomNav
          currentTab={currentTab}
          onTabChange={handleTabChange}
          onStartVoiceSession={handleStartVoiceSession}
        />

        {/* Voice Session Live Modal */}
        <VoiceSessionModal
          isOpen={isVoiceSessionOpen}
          onClose={() => setIsVoiceSessionOpen(false)}
          initialLanguage={currentLanguage}
        />

        {/* Story Modal */}
        <StoryModal
          isOpen={isStoryModalOpen}
          onClose={() => setIsStoryModalOpen(false)}
        />

        {/* Vocabulary Modal */}
        <VocabularyModal
          isOpen={isVocabularyModalOpen}
          onClose={() => setIsVocabularyModalOpen(false)}
          currentLanguage={currentLanguage}
        />

        {/* Profile Modal */}
        <ProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          currentLanguage={currentLanguage}
          voiceFirst={voiceFirst}
          onToggleVoiceFirst={handleToggleVoiceFirst}
        />
      </div>
    </div>
  );
}

/** Panneau gauche de l'écran d'authentification, affiché à partir de lg. */
const AuthBrandPanel = () => (
  <aside className="hidden lg:flex sticky top-0 h-screen flex-col justify-between overflow-hidden bg-gradient-to-br from-[#004b49] via-[#003331] to-[#002422] text-white p-10 xl:p-14">
    {/* Motif géométrique traditionnel */}
    <svg
      className="absolute -right-24 -bottom-24 w-[28rem] h-[28rem] text-[#62fae3] opacity-10 pointer-events-none"
      fill="currentColor"
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      <path d="M50 0 L100 50 L50 100 L0 50 Z M50 20 L80 50 L50 80 L20 50 Z" />
      <circle cx="50" cy="50" r="12" />
    </svg>

    <div className="relative flex items-center gap-3">
      <img src={BRAND_ASSETS.logo} alt="Logo IvoirAI" className="h-11 w-11 rounded-xl bg-white/10 p-1 object-contain" />
      <span className="text-xl font-bold tracking-tight">IvoirAI</span>
    </div>

    <div className="relative max-w-md">
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#004c43]/80 text-[#62fae3] text-xs font-semibold border border-[#62fae3]/20">
        <span className="material-symbols-outlined text-[14px]">graphic_eq</span>
        Reconnaissance vocale ivoirienne
      </span>
      <h2 className="mt-5 text-4xl xl:text-5xl font-extrabold leading-tight">
        Parlez, apprenez et traduisez en Baoulé & Dioula.
      </h2>
      <p className="mt-4 text-[#7ebab7] text-base leading-relaxed">
        L'IA comprend vos dialectes, intonations et accents ivoiriens sans filtre.
      </p>

      <ul className="mt-8 flex flex-col gap-3 text-sm">
        {[
          { icon: 'mic', label: 'Conversations vocales en direct avec Aya' },
          { icon: 'translate', label: 'Traduction contextuelle et culturelle' },
          { icon: 'school', label: 'Apprentissage des tons et proverbes' },
        ].map((f) => (
          <li key={f.icon} className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-[#62fae3]">
              <span className="material-symbols-outlined text-[20px]">{f.icon}</span>
            </span>
            {f.label}
          </li>
        ))}
      </ul>
    </div>
  </aside>
);

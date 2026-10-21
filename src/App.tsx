import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { Header } from './components/Header';
import { BottomNav, NavTabKey, TabKey } from './components/BottomNav';
import { Sidebar } from './components/Sidebar';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { useTheme } from './hooks/useTheme';
import { useToast } from './hooks/useToast';
import { Toast } from './components/Toast';
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
import { clearSession, loadSession, saveSession } from './utils/session';

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
  const { theme, setTheme } = useTheme();
  const currentTab: NavTabKey = tabFromPath(pathname) ?? 'accueil';
  const setCurrentTab = (tab: NavTabKey) => navigate(TAB_PATHS[tab], { viewTransition: true });
  const [isVoiceSessionOpen, setIsVoiceSessionOpen] = useState(false);
  const [isStoryModalOpen, setIsStoryModalOpen] = useState(false);
  const [isVocabularyModalOpen, setIsVocabularyModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const { toast: notificationToast, showToast } = useToast(3000);

  const showNotification = (msg: string) => {
    soundEngine.playTone(540, 0.15);
    showToast(msg);
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

  const handleLogout = () => {
    clearSession();
    setIsProfileModalOpen(false);
    setIsAuthenticated(false);
    navigate(AUTH_PATHS.login, { replace: true });
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
    showNotification(`Ouverture de la discussion : ${title}`);
  };

  const handleAuthenticated = (lang: Language) => {
    setCurrentLanguage(lang);
    saveSession({ language: lang });
    setIsAuthenticated(true);
    navigate(TAB_PATHS.accueil, { replace: true, viewTransition: true });
    window.scrollTo({ top: 0 });
    showNotification(lang === 'dioula' ? 'I ni ce ! Bienvenue sur IvoirAI' : 'Akwaba ! Bienvenue sur IvoirAI');
  };

  if (!isAuthenticated) {
    const isRegister = pathname === AUTH_PATHS.register;
    if (!isRegister && pathname !== AUTH_PATHS.login) {
      return <Navigate to={AUTH_PATHS.login} replace />;
    }
    const goTo = (view: keyof typeof AUTH_PATHS) => {
      navigate(AUTH_PATHS[view], { viewTransition: true });
      window.scrollTo({ top: 0 });
    };
    return (
      <div className="min-h-screen bg-surface text-on-surface lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        {/* Panneau de marque : visible uniquement sur grand écran */}
        <AuthBrandPanel />

        <div className="w-full max-w-md lg:max-w-lg mx-auto min-h-screen bg-surface relative shadow-soft lg:shadow-none">
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
    <div className={`min-h-screen bg-surface text-on-surface ${voiceFirst ? 'voice-first' : ''}`}>
      {/* Desktop Side Navigation (lg+) */}
      <Sidebar
        currentTab={currentTab}
        onTabChange={handleTabChange}
        onStartVoiceSession={handleStartVoiceSession}
        onOpenProfile={() => setIsProfileModalOpen(true)}
      />

      {/* Container wrapper: pleine largeur sur mobile, décalé de la barre latérale sur desktop */}
      <div className="w-full min-h-screen bg-surface flex flex-col relative lg:pl-64">
        {/* Top Header */}
        <Header
          title={getHeaderTitle()}
          onOpenNotifications={() =>
            showNotification(
              'Aya : Nouveau proverbe du jour disponible en audio !'
            )
          }
          onOpenProfile={() => setIsProfileModalOpen(true)}
        />

        {/* Bandeau hors connexion */}
        {!isOnline && (
          <div
            role="status"
            className="fixed top-[calc(3.5rem+env(safe-area-inset-top))] lg:top-16 inset-x-0 lg:left-64 z-30 px-4 py-2 bg-secondary text-white text-xs font-semibold flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[16px]">wifi_off</span>
            Hors connexion : Aya, la traduction et la voix sont indisponibles.
          </div>
        )}

        {/* Floating Notification Toast */}
        <Toast
          message={notificationToast}
          icon="notifications_active"
          className="shadow-raised border border-tertiary-fixed/20"
        />

        {/* Tab Content Stream */}
        <main
          className={`flex-1 w-full max-w-2xl lg:max-w-6xl mx-auto pb-28 lg:pb-10 px-4 sm:px-6 lg:px-8 ${
            isOnline ? 'pt-22 lg:pt-24' : 'pt-32 lg:pt-32' // place pour le bandeau hors connexion
          }`}
        >
          {currentTab === 'accueil' && (
            <HomeTab
              currentLanguage={currentLanguage}
              onLanguageChange={handleLanguageChange}
              onOpenVoiceSession={handleStartVoiceSession}
              onNavigateTab={(tab) => setCurrentTab(tab)}
              onOpenStoryModal={() => setIsStoryModalOpen(true)}
              onOpenVocabularyModal={() => setIsVocabularyModalOpen(true)}
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
        />

        {/* Profile Modal */}
        <ProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          currentLanguage={currentLanguage}
          voiceFirst={voiceFirst}
          onToggleVoiceFirst={handleToggleVoiceFirst}
          theme={theme}
          onThemeChange={setTheme}
          onLogout={handleLogout}
        />
      </div>
    </div>
  );
}

/** Panneau gauche de l'écran d'authentification, affiché à partir de lg. */
const AuthBrandPanel = () => (
  <aside className="hidden lg:flex sticky top-0 h-screen flex-col justify-between overflow-hidden bg-gradient-to-br from-primary-container via-primary to-primary-deep text-white p-10 xl:p-14">
    {/* Motif géométrique traditionnel */}
    <svg
      className="absolute -right-24 -bottom-24 w-[28rem] h-[28rem] text-tertiary-fixed opacity-10 pointer-events-none"
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
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-tertiary-container/80 text-tertiary-fixed text-xs font-semibold border border-tertiary-fixed/20">
        <span className="material-symbols-outlined text-[14px]">graphic_eq</span>
        Reconnaissance vocale ivoirienne
      </span>
      <h2 className="mt-5 text-4xl xl:text-5xl font-extrabold leading-tight">
        Parlez, apprenez et traduisez en Baoulé & Dioula.
      </h2>
      <p className="mt-4 text-on-primary-container text-base leading-relaxed">
        L'IA comprend vos dialectes, intonations et accents ivoiriens sans filtre.
      </p>

      <ul className="mt-8 flex flex-col gap-3 text-sm">
        {[
          { icon: 'mic', label: 'Conversations vocales en direct avec Aya' },
          { icon: 'translate', label: 'Traduction contextuelle et culturelle' },
          { icon: 'school', label: 'Apprentissage des tons et proverbes' },
        ].map((f) => (
          <li key={f.icon} className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-tertiary-fixed">
              <span className="material-symbols-outlined text-[20px]">{f.icon}</span>
            </span>
            {f.label}
          </li>
        ))}
      </ul>
    </div>
  </aside>
);

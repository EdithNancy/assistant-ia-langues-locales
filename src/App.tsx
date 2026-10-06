import React, { useState } from 'react';
import { Header } from './components/Header';
import { BottomNav, TabKey } from './components/BottomNav';
import { HomeTab } from './components/HomeTab';
import { DiscussionsTab } from './components/DiscussionsTab';
import { TraduireTab } from './components/TraduireTab';
import { ApprendreTab } from './components/ApprendreTab';
import { VoiceSessionModal } from './components/VoiceSessionModal';
import { ProfileModal, StoryModal, VocabularyModal } from './components/Modals';
import { Language } from './types';
import { soundEngine } from './utils/audio';

export default function App() {
  const [currentTab, setCurrentTab] = useState<TabKey>('accueil');
  const [currentLanguage, setCurrentLanguage] = useState<Language>('baoule');
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
    soundEngine.playTonePitch(lang === 'dioula' ? 'Moyen' : 'Haut');
    showNotification(
      lang === 'dioula'
        ? 'Mode Dioula (Mandé) activé'
        : 'Mode Baoulé (Akan) activé'
    );
  };

  const handleStartVoiceSession = () => {
    setIsVoiceSessionOpen(true);
  };

  const handleSelectDiscussion = (title: string, lang: Language) => {
    setCurrentLanguage(lang);
    setCurrentTab('discussions');
    showNotification(`Ouverture de la discussion : ${title}`);
  };

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
    <div className="min-h-screen bg-[#f9f9fb] text-[#1a1c1d] flex flex-col items-center">
      {/* Container wrapper: mobile-first constraint on desktop with elegant shadow */}
      <div className="w-full max-w-md min-h-screen bg-[#f9f9fb] flex flex-col relative shadow-[0_0_50px_rgba(0,51,49,0.08)]">
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

        {/* Floating Notification Toast */}
        {notificationToast && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-[#003331] text-white text-xs font-semibold shadow-xl flex items-center gap-2 border border-[#62fae3]/20 animate-in fade-in slide-in-from-top-2 duration-200">
            <span className="material-symbols-outlined text-[16px] text-[#62fae3]">
              notifications_active
            </span>
            <span>{notificationToast}</span>
          </div>
        )}

        {/* Tab Content Stream */}
        <main className="flex-1 w-full pt-22 pb-24 px-4">
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
            />
          )}

          {currentTab === 'discussions' && (
            <DiscussionsTab
              currentLanguage={currentLanguage}
              onLanguageChange={handleLanguageChange}
              onOpenVoiceSession={handleStartVoiceSession}
              onBackToHome={() => setCurrentTab('accueil')}
            />
          )}

          {currentTab === 'traduire' && (
            <TraduireTab
              currentLanguage={currentLanguage}
              onLanguageChange={handleLanguageChange}
              onOpenVoiceSession={handleStartVoiceSession}
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

        {/* Bottom Floating Navigation */}
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
        />
      </div>
    </div>
  );
}

import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router';
import App from './App.tsx';
import {VoiceConsentProvider} from './components/VoiceConsent';
import {UserProfileProvider} from './components/UserProfile';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <UserProfileProvider>
      <VoiceConsentProvider>
        <App />
      </VoiceConsentProvider>
    </UserProfileProvider>
  </BrowserRouter>
);

// Cache hors ligne (public/sw.js), en production seulement pour ne pas gêner le rechargement à chaud
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}

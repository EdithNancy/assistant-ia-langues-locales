import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router';
import App from './App.tsx';
import {VoiceConsentProvider} from './components/VoiceConsent';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <VoiceConsentProvider>
      <App />
    </VoiceConsentProvider>
  </BrowserRouter>
);

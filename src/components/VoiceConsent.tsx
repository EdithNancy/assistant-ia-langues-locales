import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import {
  clearVoiceConsent,
  loadVoiceConsent,
  saveVoiceConsent,
  VoiceConsent,
} from '../utils/consent';

interface VoiceConsentContextValue {
  consent: VoiceConsent | null;
  /** Résout `true` si l'utilisateur a déjà accepté ou accepte maintenant. */
  ensureConsent: () => Promise<boolean>;
  withdraw: () => void;
}

const VoiceConsentContext = createContext<VoiceConsentContextValue | null>(null);

export const useVoiceConsent = () => {
  const value = useContext(VoiceConsentContext);
  if (!value) throw new Error('useVoiceConsent doit être utilisé dans VoiceConsentProvider');
  return value;
};

export const VoiceConsentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [consent, setConsent] = useState<VoiceConsent | null>(loadVoiceConsent);
  const [isAsking, setIsAsking] = useState(false);
  const resolveRef = useRef<((accepted: boolean) => void) | null>(null);

  const ensureConsent = useCallback(() => {
    if (consent) return Promise.resolve(true);
    setIsAsking(true);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, [consent]);

  const answer = (accepted: VoiceConsent | null) => {
    if (accepted) {
      saveVoiceConsent(accepted);
      setConsent(accepted);
    }
    setIsAsking(false);
    resolveRef.current?.(accepted !== null);
    resolveRef.current = null;
  };

  const withdraw = useCallback(() => {
    clearVoiceConsent();
    setConsent(null);
  }, []);

  return (
    <VoiceConsentContext.Provider value={{ consent, ensureConsent, withdraw }}>
      {children}
      {isAsking && <VoiceConsentDialog onAnswer={answer} />}
    </VoiceConsentContext.Provider>
  );
};

const VoiceConsentDialog: React.FC<{ onAnswer: (consent: VoiceConsent | null) => void }> = ({
  onAnswer,
}) => {
  const [accepted, setAccepted] = useState(false);
  const [improveModel, setImproveModel] = useState(false);

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="consent-title"
        className="w-full max-w-md bg-white rounded-t-[32px] sm:rounded-3xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-5 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-2xl bg-[#b1eeea] text-[#00201f] flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[24px]">mic</span>
          </span>
          <h2 id="consent-title" className="text-lg font-bold text-[#1a1c1d] leading-tight">
            Avant d'utiliser votre voix
          </h2>
        </div>

        <ul className="flex flex-col gap-2 text-sm text-[#3f4948] leading-relaxed">
          <li className="flex gap-2">
            <span className="material-symbols-outlined text-[18px] text-[#004b49] shrink-0">graphic_eq</span>
            Votre enregistrement est envoyé à IvoirAI pour être transcrit, puis traité.
          </li>
          <li className="flex gap-2">
            <span className="material-symbols-outlined text-[18px] text-[#004b49] shrink-0">shield_person</span>
            Les informations personnelles sont retirées avant tout stockage.
          </li>
          <li className="flex gap-2">
            <span className="material-symbols-outlined text-[18px] text-[#004b49] shrink-0">undo</span>
            Vous pouvez retirer votre accord à tout moment depuis votre profil.
          </li>
        </ul>

        <label className="flex items-start gap-3 p-3 rounded-2xl bg-[#f3f3f5] cursor-pointer">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-0.5 w-5 h-5 accent-[#004b49] shrink-0"
          />
          <span className="text-sm text-[#1a1c1d] font-medium">
            J'accepte que ma voix soit enregistrée et envoyée pour être transcrite.
            <span className="text-[#ba1a1a]"> *</span>
          </span>
        </label>

        <label className="flex items-start gap-3 p-3 rounded-2xl bg-[#f3f3f5] cursor-pointer">
          <input
            type="checkbox"
            checked={improveModel}
            onChange={(e) => setImproveModel(e.target.checked)}
            className="mt-0.5 w-5 h-5 accent-[#004b49] shrink-0"
          />
          <span className="text-sm text-[#3f4948]">
            Facultatif : mes enregistrements anonymisés peuvent servir à améliorer la reconnaissance
            du Baoulé et du Dioula.
          </span>
        </label>

        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            onClick={() => onAnswer(null)}
            className="h-12 rounded-full bg-[#edeef0] text-[#1a1c1d] text-sm font-bold active:scale-95 transition-transform"
          >
            Refuser
          </button>
          <button
            disabled={!accepted}
            onClick={() => onAnswer({ acceptedAt: new Date().toISOString(), improveModel })}
            className="h-12 rounded-full bg-[#004b49] text-white text-sm font-bold active:scale-95 transition-transform disabled:opacity-40 disabled:active:scale-100"
          >
            Accepter
          </button>
        </div>
      </div>
    </div>
  );
};

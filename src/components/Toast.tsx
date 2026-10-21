import React from 'react';

interface ToastProps {
  message: string | null;
  icon?: string;
  className?: string;
}

/** Bulle de notification centrée sur la zone de contenu, annoncée aux lecteurs d'écran. */
export const Toast: React.FC<ToastProps> = ({ message, icon = 'check_circle', className = '' }) => (
  <div role="status" aria-live="polite" className="contents">
    {message && (
      <div
        className={`fixed top-20 lg:top-24 left-1/2 lg:left-[calc(50%+8rem)] -translate-x-1/2 z-50 max-w-[calc(100vw-2rem)] px-4 py-2 rounded-full bg-[#003331] text-white text-xs font-semibold shadow-lg animate-in fade-in slide-in-from-top-2 duration-200 flex items-center gap-2 ${className}`}
      >
        <span className="material-symbols-outlined text-[16px] text-[#62fae3]">{icon}</span>
        <span>{message}</span>
      </div>
    )}
  </div>
);

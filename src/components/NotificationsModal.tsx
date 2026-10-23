import React, { useRef, useState } from 'react';
import { AppNotification } from '../hooks/useNotifications';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import { Modal } from './ui/Modal';

const TONE_CLASSES: Record<AppNotification['tone'], string> = {
  primary: 'bg-primary-fixed text-on-primary-fixed',
  secondary: 'bg-secondary-fixed text-on-secondary-fixed',
  tertiary: 'bg-tertiary-fixed-faint text-primary-container',
};

/** Part de la largeur à parcourir pour qu'un glissement supprime la notification. */
const SWIPE_THRESHOLD = 0.35;
/** En dessous de ce déplacement (px), le geste compte comme un simple appui. */
const TAP_TOLERANCE = 6;
const EXIT_MS = 200;

interface SwipeableNotificationProps {
  notification: AppNotification;
  onRemove: () => void;
  onRead: () => void;
}

/** Une notification : glisser à gauche ou à droite la supprime, un appui la marque comme lue. */
const SwipeableNotification: React.FC<SwipeableNotificationProps> = ({ notification, onRemove, onRead }) => {
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const startX = useRef<number | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  const leave = (direction: 1 | -1) => {
    setIsLeaving(true);
    setOffset(direction * (rowRef.current?.offsetWidth ?? 400) * 1.1);
    setTimeout(onRemove, EXIT_MS);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    // Les boutons gardent leur comportement normal
    if ((e.target as HTMLElement).closest('button') || isLeaving) return;
    startX.current = e.clientX;
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (startX.current === null) return;
    setOffset(e.clientX - startX.current);
  };

  const handlePointerEnd = () => {
    if (startX.current === null) return;
    startX.current = null;
    setIsDragging(false);
    const width = rowRef.current?.offsetWidth ?? 1;
    if (Math.abs(offset) > width * SWIPE_THRESHOLD) {
      leave(offset > 0 ? 1 : -1);
      return;
    }
    if (Math.abs(offset) < TAP_TOLERANCE && !notification.read) onRead();
    setOffset(0);
  };

  const progress = Math.min(Math.abs(offset) / ((rowRef.current?.offsetWidth ?? 1) * SWIPE_THRESHOLD), 1);

  return (
    <li
      className={`relative overflow-hidden rounded-2xl transition-[max-height,opacity,margin] ${
        isLeaving ? 'max-h-0 opacity-0 -mb-2' : 'max-h-60'
      }`}
      style={{ transitionDuration: `${EXIT_MS}ms`, transitionDelay: isLeaving ? `${EXIT_MS / 2}ms` : '0ms' }}
    >
      {/* Fond révélé pendant le glissement */}
      <div
        aria-hidden="true"
        className={`absolute inset-0 flex items-center px-5 bg-error text-white ${
          offset > 0 ? 'justify-start' : 'justify-end'
        }`}
        style={{ opacity: offset === 0 ? 0 : 0.35 + progress * 0.65 }}
      >
        <span
          className="material-symbols-outlined text-[22px]"
          style={{ transform: `scale(${0.7 + progress * 0.4})` }}
        >
          delete
        </span>
      </div>

      <div
        ref={rowRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        className={`relative flex items-start gap-3 p-3 rounded-2xl touch-pan-y select-none cursor-grab active:cursor-grabbing ${
          notification.read ? 'bg-surface-container-low' : 'bg-surface-container'
        }`}
        style={{
          transform: `translateX(${offset}px)`,
          transition: isDragging ? 'none' : `transform ${EXIT_MS}ms ease-out`,
        }}
      >
        <span
          className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${TONE_CLASSES[notification.tone]}`}
        >
          <span className="material-symbols-outlined text-[20px]">{notification.icon}</span>
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {!notification.read && (
              <span className="w-2 h-2 shrink-0 rounded-full bg-secondary" aria-label="Non lue" />
            )}
            <p className={`text-sm text-on-surface truncate ${notification.read ? 'font-semibold' : 'font-bold'}`}>
              {notification.title}
            </p>
          </div>
          <p className="mt-0.5 text-xs leading-snug text-on-surface-variant">{notification.body}</p>
          <p className="mt-1 text-[11px] font-medium text-outline">{notification.time}</p>
        </div>

        <IconButton
          onClick={() => leave(-1)}
          aria-label={`Supprimer la notification : ${notification.title}`}
          title="Supprimer"
          icon="delete"
          size="sm"
          iconClassName="text-[18px]"
          className="-mr-1 text-on-surface-variant hover:bg-error-container hover:text-error"
        />
      </div>
    </li>
  );
};

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  unreadCount: number;
  onRemove: (id: string) => void;
  onRead: (id: string) => void;
  onMarkAllRead: () => void;
  onClearAll: () => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  notifications,
  unreadCount,
  onRemove,
  onRead,
  onMarkAllRead,
  onClearAll,
}) => {
  if (!isOpen) return null;

  return (
    <Modal
      onClose={onClose}
      aria-labelledby="notifications-title"
      className="w-full max-w-sm bg-surface-container-lowest rounded-3xl p-5 shadow-overlay flex flex-col gap-4 max-h-[90vh] animate-in zoom-in-95 duration-200 border border-surface-container"
    >
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <h3 id="notifications-title" className="text-base font-bold text-on-surface">
            Notifications
          </h3>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-secondary text-white text-[11px] font-bold">
              {unreadCount} non lue{unreadCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <IconButton
          aria-label="Fermer"
          onClick={onClose}
          icon="close"
          size="sm"
          iconClassName="text-[18px]"
          className="bg-surface-container text-on-surface-variant"
        />
      </div>

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center text-center gap-2 py-10">
          <span className="w-14 h-14 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface-variant">
            <span className="material-symbols-outlined text-[28px]">notifications_off</span>
          </span>
          <p className="text-sm font-bold text-on-surface">Aucune notification</p>
          <p className="text-xs text-on-surface-variant">Vous êtes à jour. Akwaba !</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 -mt-1">
            <p className="flex items-center gap-1 text-[11px] text-outline">
              <span className="material-symbols-outlined text-[16px]">swipe</span>
              Glissez une notification pour la supprimer
            </p>
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllRead}
                className="shrink-0 flex items-center gap-1 text-xs font-bold text-primary-container hover:underline"
              >
                <span className="material-symbols-outlined text-[16px]">done_all</span>
                Tout lire
              </button>
            )}
          </div>

          <ul className="flex flex-col gap-2 overflow-y-auto overflow-x-hidden -mx-1 px-1" aria-label="Liste des notifications">
            {notifications.map((n) => (
              <SwipeableNotification
                key={n.id}
                notification={n}
                onRemove={() => onRemove(n.id)}
                onRead={() => onRead(n.id)}
              />
            ))}
          </ul>
        </>
      )}

      <Button onClick={onClose} size="sm" fullWidth>
        Retour à l'application
      </Button>
      {notifications.length > 0 && (
        <button
          onClick={onClearAll}
          className="w-full py-2.5 -mt-2 rounded-full text-error text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-error-container transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
          Tout effacer
        </button>
      )}
    </Modal>
  );
};

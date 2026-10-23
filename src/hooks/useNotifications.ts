import { useCallback, useEffect, useState } from 'react';

export interface AppNotification {
  id: string;
  /** Icône Material Symbols. */
  icon: string;
  tone: 'primary' | 'secondary' | 'tertiary';
  title: string;
  body: string;
  time: string;
  read: boolean;
}

const STORAGE_KEY = 'ivoirai.notifications';

/** Notifications de démonstration, en attendant qu'elles viennent de l'API. */
export const DEFAULT_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'proverbe-du-jour',
    icon: 'record_voice_over',
    tone: 'primary',
    title: 'Nouveau proverbe du jour',
    body: 'Aya a enregistré le proverbe du jour en audio. Écoutez-le et répétez après elle.',
    time: 'Il y a 5 min',
    read: false,
  },
  {
    id: 'serie-7-jours',
    icon: 'local_fire_department',
    tone: 'secondary',
    title: '7 jours consécutifs !',
    body: 'Bravo, votre série continue. Une courte leçon aujourd’hui pour la garder.',
    time: 'Il y a 2 h',
    read: false,
  },
  {
    id: 'module-marche',
    icon: 'storefront',
    tone: 'tertiary',
    title: 'Module « Marché » à 85 %',
    body: 'Plus que 2 leçons pour maîtriser le vocabulaire de la négociation.',
    time: 'Hier',
    read: false,
  },
  {
    id: 'discussion-salutations',
    icon: 'chat_bubble',
    tone: 'primary',
    title: 'Aya vous a répondu',
    body: 'Votre question sur les salutations traditionnelles en pays Baoulé a une réponse.',
    time: 'Hier',
    read: true,
  },
  {
    id: 'nouvelles-expressions',
    icon: 'auto_stories',
    tone: 'tertiary',
    title: '6 nouvelles expressions Dioula',
    body: 'Le lexique s’enrichit : salutations du matin et formules de remerciement.',
    time: 'Il y a 3 jours',
    read: true,
  },
];

const isNotification = (value: unknown): value is AppNotification => {
  if (typeof value !== 'object' || value === null) return false;
  const n = value as Partial<AppNotification>;
  return typeof n.id === 'string' && typeof n.title === 'string' && typeof n.read === 'boolean';
};

const load = (): AppNotification[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter(isNotification);
    }
  } catch {
    // Stockage indisponible ou contenu corrompu
  }
  return DEFAULT_NOTIFICATIONS;
};

/** Liste des notifications : lues / non lues et suppressions mémorisées dans le navigateur. */
export const useNotifications = () => {
  const [notifications, setNotifications] = useState<AppNotification[]>(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
    } catch {
      // Stockage indisponible : l'état vaut pour cette visite
    }
  }, [notifications]);

  const remove = useCallback((id: string) => {
    setNotifications((list) => list.filter((n) => n.id !== id));
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifications((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((list) => list.map((n) => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => setNotifications([]), []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, unreadCount, remove, markRead, markAllRead, clearAll };
};

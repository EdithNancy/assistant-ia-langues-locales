import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_NOTIFICATIONS, useNotifications } from '../hooks/useNotifications';
import { NotificationsModal } from './NotificationsModal';

const renderModal = () => {
  const handlers = { onRemove: vi.fn(), onRead: vi.fn(), onMarkAllRead: vi.fn(), onClearAll: vi.fn() };
  render(
    <NotificationsModal
      isOpen
      onClose={vi.fn()}
      notifications={DEFAULT_NOTIFICATIONS}
      unreadCount={3}
      {...handlers}
    />
  );
  return handlers;
};

describe('NotificationsModal', () => {
  it('supprime une notification avec son bouton', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { onRemove } = renderModal();
    await userEvent.click(screen.getByRole('button', { name: /supprimer la notification : nouveau proverbe/i }));
    act(() => vi.advanceTimersByTime(300));
    expect(onRemove).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('supprime une notification glissée au-delà du seuil, pas en deçà', () => {
    vi.useFakeTimers();
    const { onRemove, onRead } = renderModal();
    const row = within(screen.getByRole('list')).getAllByRole('listitem')[0].lastElementChild as HTMLElement;
    // jsdom ne mesure pas les largeurs : on en impose une de 300 px (seuil = 105 px)
    Object.defineProperty(row, 'offsetWidth', { value: 300 });
    row.setPointerCapture = vi.fn();

    fireEvent.pointerDown(row, { clientX: 200, pointerId: 1 });
    fireEvent.pointerMove(row, { clientX: 150, pointerId: 1 });
    fireEvent.pointerUp(row, { clientX: 150, pointerId: 1 });
    act(() => vi.advanceTimersByTime(300));
    expect(onRemove).not.toHaveBeenCalled();
    expect(onRead).not.toHaveBeenCalled();

    fireEvent.pointerDown(row, { clientX: 200, pointerId: 1 });
    fireEvent.pointerMove(row, { clientX: 40, pointerId: 1 });
    fireEvent.pointerUp(row, { clientX: 40, pointerId: 1 });
    act(() => vi.advanceTimersByTime(300));
    expect(onRemove).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('marque comme lue au simple appui', () => {
    const { onRead } = renderModal();
    const row = within(screen.getByRole('list')).getAllByRole('listitem')[0].lastElementChild as HTMLElement;
    row.setPointerCapture = vi.fn();
    fireEvent.pointerDown(row, { clientX: 100, pointerId: 1 });
    fireEvent.pointerUp(row, { clientX: 100, pointerId: 1 });
    expect(onRead).toHaveBeenCalledTimes(1);
  });
});

describe('useNotifications', () => {
  it('compte les non lues et mémorise les suppressions', () => {
    const { result, unmount } = renderHook(() => useNotifications());
    expect(result.current.unreadCount).toBe(3);

    act(() => result.current.remove(DEFAULT_NOTIFICATIONS[0].id));
    act(() => result.current.markAllRead());
    expect(result.current.notifications).toHaveLength(DEFAULT_NOTIFICATIONS.length - 1);
    expect(result.current.unreadCount).toBe(0);
    unmount();

    // Rechargement : l'état est retrouvé
    const reloaded = renderHook(() => useNotifications());
    expect(reloaded.result.current.notifications).toHaveLength(DEFAULT_NOTIFICATIONS.length - 1);
    expect(reloaded.result.current.unreadCount).toBe(0);
  });
});

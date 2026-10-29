import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginPage } from './LoginPage';
import { UserProfileProvider } from '../UserProfile';
import { loadProfile } from '../../utils/profile';
import { authApi } from '../../services';

const renderLogin = () => {
  const onAuthenticated = vi.fn();
  render(
    <UserProfileProvider>
      <LoginPage onAuthenticated={onAuthenticated} onGoToRegister={vi.fn()} />
    </UserProfileProvider>
  );
  return { onAuthenticated, user: userEvent.setup() };
};

beforeEach(() => {
  sessionStorage.clear();
  vi.spyOn(authApi, 'login').mockResolvedValue({
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
  });
  vi.spyOn(authApi, 'profile').mockResolvedValue({
    full_name: 'Aya Kouassi',
    email: 'aya@example.ci',
    phone_number: '+2250701234567',
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('LoginPage', () => {
  it('refuse une adresse email invalide', async () => {
    const { onAuthenticated, user } = renderLogin();
    await user.type(screen.getByLabelText(/adresse email/i), 'email-invalide');
    await user.click(screen.getByRole('button', { name: /se connecter/i }));

    expect(screen.getByText(/adresse email valide/i)).toBeInTheDocument();
    expect(onAuthenticated).not.toHaveBeenCalled();
    expect(authApi.login).not.toHaveBeenCalled();
  });

  it('connecte via le backend, charge le profil et conserve les jetons pour la session', async () => {
    const { onAuthenticated, user } = renderLogin();
    await user.type(screen.getByLabelText(/adresse email/i), 'aya@example.ci');
    await user.type(screen.getByPlaceholderText('••••••••••••'), 'secret');
    await user.click(screen.getByRole('button', { name: /se connecter/i }));

    await vi.waitFor(() => expect(onAuthenticated).toHaveBeenCalledWith('baoule'));
    expect(authApi.login).toHaveBeenCalledWith('aya@example.ci', 'secret');
    expect(authApi.profile).toHaveBeenCalledWith('test-access-token');
    expect(loadProfile()).toMatchObject({ fullName: 'Aya Kouassi', email: 'aya@example.ci', phone: '0701234567' });
    expect(sessionStorage.getItem('ivoirai.access_token')).toBe('test-access-token');
    expect(sessionStorage.getItem('ivoirai.refresh_token')).toBe('test-refresh-token');
  });

  it('affiche une erreur du backend sans authentifier', async () => {
    vi.spyOn(authApi, 'login').mockRejectedValue(new Error('Identifiants invalides'));
    const { onAuthenticated, user } = renderLogin();
    await user.type(screen.getByLabelText(/adresse email/i), 'aya@example.ci');
    await user.type(screen.getByPlaceholderText('••••••••••••'), 'incorrect');
    await user.click(screen.getByRole('button', { name: /se connecter/i }));

    expect(await screen.findByText('Identifiants invalides')).toBeInTheDocument();
    expect(onAuthenticated).not.toHaveBeenCalled();
  });

  it('affiche Google et l’empreinte comme bientôt disponibles', () => {
    renderLogin();
    expect(screen.getByRole('button', { name: /google/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /empreinte/i })).toBeDisabled();
  });
});

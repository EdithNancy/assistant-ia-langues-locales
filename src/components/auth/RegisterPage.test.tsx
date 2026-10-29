import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authApi } from '../../services';
import { UserProfileProvider } from '../UserProfile';
import { RegisterPage } from './RegisterPage';

describe('RegisterPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.spyOn(authApi, 'register').mockResolvedValue();
    vi.spyOn(authApi, 'login').mockResolvedValue({
      accessToken: 'register-access-token',
      refreshToken: 'register-refresh-token',
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

  it('crée le compte avec les champs du Gateway puis ouvre une session', async () => {
    const onAuthenticated = vi.fn();
    const user = userEvent.setup();
    render(
      <UserProfileProvider>
        <RegisterPage onAuthenticated={onAuthenticated} onGoToLogin={vi.fn()} />
      </UserProfileProvider>
    );

    await user.type(screen.getByLabelText(/nom complet ou prénom/i), 'Aya Kouassi');
    await user.type(screen.getByLabelText(/adresse email/i), 'aya@example.ci');
    await user.type(screen.getByLabelText(/numéro whatsapp/i), '0701234567');
    await user.type(screen.getByPlaceholderText('••••••••••••'), 'Akwaba123!');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /créer mon compte gratuit/i }));

    await vi.waitFor(() => expect(onAuthenticated).toHaveBeenCalledWith('baoule'));
    expect(authApi.register).toHaveBeenCalledWith({
      full_name: 'Aya Kouassi',
      email: 'aya@example.ci',
      phone_number: '+2250701234567',
      password: 'Akwaba123!',
    });
    expect(authApi.login).toHaveBeenCalledWith('aya@example.ci', 'Akwaba123!');
    expect(sessionStorage.getItem('ivoirai.access_token')).toBe('register-access-token');
  }, 15_000);
});

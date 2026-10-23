import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { loadProfile, saveProfile } from '../utils/profile';
import { SettingsPage } from './SettingsPage';
import { UserProfileProvider } from './UserProfile';

const renderSettings = () => {
  saveProfile({ fullName: 'Koffi Aya', email: 'aya@email.ci', phone: '', photo: null });
  const onLanguageChange = vi.fn();
  render(
    <UserProfileProvider>
      <SettingsPage currentLanguage="baoule" onLanguageChange={onLanguageChange} onLogout={vi.fn()} />
    </UserProfileProvider>
  );
  return { onLanguageChange, user: userEvent.setup() };
};

describe('SettingsPage', () => {
  it('pré-remplit puis enregistre nom, téléphone et langue', async () => {
    const { onLanguageChange, user } = renderSettings();
    const name = screen.getByLabelText(/nom complet/i);
    expect(name).toHaveValue('Koffi Aya');

    await user.clear(name);
    await user.type(name, 'Aya Marcelle');
    await user.type(screen.getByLabelText(/téléphone/i), '0584921033');
    await user.click(screen.getByRole('radio', { name: /dioula/i }));
    await user.click(screen.getByRole('button', { name: /^enregistrer$/i }));

    expect(loadProfile()).toMatchObject({ fullName: 'Aya Marcelle', email: 'aya@email.ci', phone: '0584921033' });
    expect(onLanguageChange).toHaveBeenCalledWith('dioula');
  });

  it('refuse un email invalide sans rien enregistrer', async () => {
    const { user } = renderSettings();
    const email = screen.getByLabelText(/adresse email/i);
    await user.clear(email);
    await user.type(email, 'pas-un-email');
    await user.click(screen.getByRole('button', { name: /^enregistrer$/i }));

    expect(screen.getByText(/adresse email invalide/i)).toBeInTheDocument();
    expect(loadProfile()?.email).toBe('aya@email.ci');
  });

  it('exige deux nouveaux mots de passe identiques', async () => {
    const { user } = renderSettings();
    await user.type(screen.getByLabelText(/mot de passe actuel/i), 'ancien');
    await user.type(screen.getByLabelText(/^nouveau mot de passe/i), 'Nouveau#2026');
    await user.type(screen.getByLabelText(/confirmer/i), 'Nouveau#2025');
    await user.click(screen.getByRole('button', { name: /mettre à jour le mot de passe/i }));

    expect(screen.getByText(/ne correspondent pas/i)).toBeInTheDocument();
  });
});

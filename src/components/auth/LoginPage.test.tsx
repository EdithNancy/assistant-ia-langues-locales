import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LoginPage } from './LoginPage';

const renderLogin = () => {
  const onAuthenticated = vi.fn();
  render(<LoginPage onAuthenticated={onAuthenticated} onGoToRegister={vi.fn()} />);
  return { onAuthenticated, user: userEvent.setup() };
};

describe('LoginPage', () => {
  it('refuse un numéro incomplet', async () => {
    const { onAuthenticated, user } = renderLogin();
    await user.type(screen.getByLabelText(/numéro mobile/i), '0701');
    await user.click(screen.getByRole('button', { name: /se connecter/i }));

    expect(screen.getByText(/numéro ivoirien valide/i)).toBeInTheDocument();
    expect(onAuthenticated).not.toHaveBeenCalled();
  });

  it('connecte avec un numéro et un mot de passe valides', async () => {
    const { onAuthenticated, user } = renderLogin();
    await user.type(screen.getByLabelText(/numéro mobile/i), '0701234567');
    await user.type(screen.getByPlaceholderText('••••••••••••'), 'secret');
    await user.click(screen.getByRole('button', { name: /se connecter/i }));

    await vi.waitFor(() => expect(onAuthenticated).toHaveBeenCalledWith('baoule'), { timeout: 2000 });
  });

  it('affiche Google et l’empreinte comme bientôt disponibles', () => {
    renderLogin();
    expect(screen.getByRole('button', { name: /google/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /empreinte/i })).toBeDisabled();
  });
});

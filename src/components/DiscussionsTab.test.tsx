import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { api } from '../services';
import { DiscussionsTab } from './DiscussionsTab';
import { VoiceConsentProvider } from './VoiceConsent';

const renderTab = () =>
  render(
    <VoiceConsentProvider>
      <DiscussionsTab
        currentLanguage="baoule"
        onLanguageChange={vi.fn()}
        onOpenVoiceSession={vi.fn()}
        onBackToHome={vi.fn()}
        voiceFirst={false}
      />
    </VoiceConsentProvider>
  );

describe('DiscussionsTab', () => {
  it("envoie un message et affiche la réponse d'Aya", async () => {
    const user = userEvent.setup();
    renderTab();
    await user.type(screen.getByPlaceholderText(/écrivez/i), 'bonjour{Enter}');

    expect(screen.getByText('bonjour')).toBeInTheDocument();
    expect(await screen.findByText('« Akwaba ! Nzoué o ? »', {}, { timeout: 2000 })).toBeInTheDocument();
  });

  it('propose de réessayer quand Aya ne répond pas', async () => {
    const chat = vi.spyOn(api, 'chat').mockRejectedValueOnce(new Error('réseau'));
    const user = userEvent.setup();
    renderTab();
    await user.type(screen.getByPlaceholderText(/écrivez/i), 'merci{Enter}');

    expect(await screen.findByText(/n'a pas pu répondre/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /réessayer/i }));
    expect(await screen.findByText('« Mo n’dri kpa kpa ! »', {}, { timeout: 2000 })).toBeInTheDocument();
    expect(chat).toHaveBeenCalledTimes(2);
  });
});

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TraduireTab } from './TraduireTab';
import { VoiceConsentProvider } from './VoiceConsent';

const renderTab = () =>
  render(
    <VoiceConsentProvider>
      <TraduireTab currentLanguage="baoule" onLanguageChange={vi.fn()} voiceFirst={false} />
    </VoiceConsentProvider>
  );

/** Carte du résultat : seule zone marquée aria-busy pendant la traduction. */
const resultCard = () => document.querySelector<HTMLElement>('[aria-busy]')!;

describe('TraduireTab', () => {
  it('traduit la phrase d’exemple du français vers le baoulé', async () => {
    renderTab();
    expect(
      await within(resultCard()).findByText('Alokô kpɛkun nga ɔ to nzen ?', {}, { timeout: 2000 })
    ).toBeInTheDocument();
  });

  it('inverse les langues et retraduit vers le français', async () => {
    const user = userEvent.setup();
    renderTab();
    await within(resultCard()).findByText('Alokô kpɛkun nga ɔ to nzen ?', {}, { timeout: 2000 });

    await user.click(screen.getByRole('button', { name: /permuter les langues/i }));

    expect(screen.getByRole('textbox')).toHaveValue('Alokô kpɛkun nga ɔ to nzen ?');
    expect(
      await within(resultCard()).findByText(
        'Combien coûte le régime de bananes plantain ?',
        {},
        { timeout: 2000 }
      )
    ).toBeInTheDocument();
  });

  it('invite à saisir une phrase quand le texte est vide', async () => {
    const user = userEvent.setup();
    renderTab();
    await user.clear(screen.getByRole('textbox'));
    expect(await screen.findByText(/saisissez ou dictez une phrase/i)).toBeInTheDocument();
  });
});

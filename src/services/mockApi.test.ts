import { describe, expect, it } from 'vitest';
import { mockApi } from './mockApi';

describe('mockApi.translate', () => {
  it('traduit du français vers le baoulé', async () => {
    const result = await mockApi.translate({
      text: 'Combien coûte le régime de bananes plantain ?',
      source: 'fr',
      target: 'baoule',
    });
    expect(result.translation).toBe('Alokô kpɛkun nga ɔ to nzen ?');
    expect(result.detectedSource).toBe('fr');
  });

  it('traduit du dioula vers le français', async () => {
    const result = await mockApi.translate({
      text: 'Barana yiriwari nin bɛ sɔngɔ jolibɔ ?',
      source: 'dioula',
      target: 'fr',
    });
    expect(result.translation).toBe('Combien coûte le régime de bananes plantain ?');
    expect(result.phonetic).toBe('');
  });

  it('détecte la langue source en mode auto', async () => {
    const result = await mockApi.translate({
      text: 'Barana yiriwari nin bɛ sɔngɔ jolibɔ ?',
      source: 'auto',
      target: 'fr',
    });
    expect(result.detectedSource).toBe('dioula');
  });
});

describe('mockApi.detectLanguage', () => {
  it.each([
    ['Bonjour, comment allez-vous ?', 'fr'],
    ['I ni ce kosɛbɛ', 'dioula'],
    ['Akwaba ! Nzoué o ?', 'baoule'],
  ])('« %s » -> %s', async (text, expected) => {
    expect((await mockApi.detectLanguage(text)).language).toBe(expected);
  });
});

describe('mockApi.chat', () => {
  it('répond à une salutation dans la langue demandée', async () => {
    const reply = await mockApi.chat({ message: 'bonjour', language: 'dioula' });
    expect(reply.text).toContain('An sɔgɔma');
    expect(reply.linguisticBreakdown?.length).toBeGreaterThan(0);
  });
});

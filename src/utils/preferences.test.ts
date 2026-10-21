import { describe, expect, it } from 'vitest';
import { loadPreferences, savePreferences } from './preferences';

describe('préférences', () => {
  it('valeurs par défaut : mode voix désactivé, thème du système', () => {
    expect(loadPreferences()).toEqual({ voiceFirst: false, theme: 'system' });
  });

  it('une modification garde les autres préférences', () => {
    savePreferences({ theme: 'dark' });
    savePreferences({ voiceFirst: true });
    expect(loadPreferences()).toEqual({ voiceFirst: true, theme: 'dark' });
  });

  it('ignore un thème inconnu', () => {
    localStorage.setItem('ivoirai.preferences', JSON.stringify({ voiceFirst: true, theme: 'violet' }));
    expect(loadPreferences()).toEqual({ voiceFirst: true, theme: 'system' });
  });
});

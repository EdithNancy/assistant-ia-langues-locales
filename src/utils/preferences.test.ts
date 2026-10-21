import { describe, expect, it } from 'vitest';
import { loadPreferences, savePreferences } from './preferences';

describe('préférences', () => {
  it('valeurs par défaut : mode voix désactivé, thème clair', () => {
    expect(loadPreferences()).toEqual({ voiceFirst: false, theme: 'light' });
  });

  it('une modification garde les autres préférences', () => {
    savePreferences({ theme: 'dark' });
    savePreferences({ voiceFirst: true });
    expect(loadPreferences()).toEqual({ voiceFirst: true, theme: 'dark' });
  });

  it('ignore un thème inconnu (dont l’ancien « system »)', () => {
    localStorage.setItem('ivoirai.preferences', JSON.stringify({ voiceFirst: true, theme: 'system' }));
    expect(loadPreferences()).toEqual({ voiceFirst: true, theme: 'light' });
  });
});

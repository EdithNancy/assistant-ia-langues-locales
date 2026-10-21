import { describe, expect, it } from 'vitest';
import { clearSession, loadSession, saveSession } from './session';

describe('session', () => {
  it('est vide au départ', () => {
    expect(loadSession()).toBeNull();
  });

  it('conserve puis efface la langue choisie', () => {
    saveSession({ language: 'dioula' });
    expect(loadSession()).toEqual({ language: 'dioula' });
    clearSession();
    expect(loadSession()).toBeNull();
  });

  it('ignore un contenu corrompu ou une langue inconnue', () => {
    localStorage.setItem('ivoirai.session', '{pas du json');
    expect(loadSession()).toBeNull();
    localStorage.setItem('ivoirai.session', JSON.stringify({ language: 'klingon' }));
    expect(loadSession()).toBeNull();
  });
});

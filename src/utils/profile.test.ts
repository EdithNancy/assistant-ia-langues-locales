import { describe, expect, it } from 'vitest';
import { firstName, initials, loadProfile, saveProfile } from './profile';

describe('profile', () => {
  it('est vide au départ', () => {
    expect(loadProfile()).toBeNull();
  });

  it('conserve le profil enregistré', () => {
    const profile = { fullName: 'Koffi Aya', email: 'aya@email.ci', phone: '0701234567', photo: null };
    expect(saveProfile(profile)).toBe(true);
    expect(loadProfile()).toEqual(profile);
  });

  it('complète un contenu incomplet et ignore un contenu corrompu', () => {
    localStorage.setItem('ivoirai.profile', JSON.stringify({ fullName: 'Aya' }));
    expect(loadProfile()).toEqual({ fullName: 'Aya', email: '', phone: '', photo: null });
    localStorage.setItem('ivoirai.profile', '{pas du json');
    expect(loadProfile()).toBeNull();
  });

  it('calcule prénom et initiales', () => {
    expect(firstName('  Koffi Aya Marcelle ')).toBe('Koffi');
    expect(initials('Koffi Aya Marcelle')).toBe('KA');
    expect(initials('')).toBe('');
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAuthApi } from './authApi';

const authApi = createAuthApi('http://localhost:8000');

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('authApi', () => {
  it('envoie les identifiants à la route de connexion et lit les jetons du contrat backend', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 200,
          item: { access_token: 'access', refresh_token: 'refresh', token_type: 'bearer', expires_in: 900 },
          message: 'Requête traitée avec succès.',
          hasError: false,
        }),
        {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(authApi.login('aya@example.ci', 'password')).resolves.toEqual({
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresInSeconds: 900,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/auth\/login$/),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'aya@example.ci', password: 'password' }),
      })
    );
  });

  it('envoie le jeton Bearer à la route du profil', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ full_name: 'Aya', email: 'aya@example.ci' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(authApi.profile('access')).resolves.toMatchObject({ email: 'aya@example.ci' });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/users\/me$/),
      expect.objectContaining({
        headers: { Authorization: 'Bearer access' },
      })
    );
  });

  it('accepte le renouvellement enveloppé et conserve le refresh token si le backend ne le renouvelle pas', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 200,
          item: { access_token: 'new-access', expires_in: 900 },
          message: 'Requête traitée avec succès.',
          hasError: false,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(authApi.refresh('existing-refresh')).resolves.toEqual({
      accessToken: 'new-access',
      refreshToken: 'existing-refresh',
      expiresInSeconds: 900,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/auth\/refresh$/),
      expect.objectContaining({
        body: JSON.stringify({ refresh_token: 'existing-refresh' }),
      })
    );
  });

  it('conserve le message renvoyé par le backend lors d’une erreur', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'Authentification requise' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    await expect(authApi.profile('expired')).rejects.toMatchObject({
      message: 'Authentification requise',
      status: 401,
    });
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { saveAuthTokens } from './authSession';
import { createHttpApi } from './httpApi';

afterEach(() => {
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe('createHttpApi authentication', () => {
  it('renouvelle le jeton après un 401 puis rejoue la requête avec le nouveau Bearer', async () => {
    saveAuthTokens({ accessToken: 'expired-access', refreshToken: 'refresh' });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Token expired' }), { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ text: 'Réponse du backend' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    const refreshTokens = vi.fn().mockResolvedValue({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
      expiresInSeconds: 900,
    });
    vi.stubGlobal('fetch', fetchMock);
    const api = createHttpApi('https://gateway.example', refreshTokens);

    await expect(api.chat({ message: 'Bonjour', language: 'baoule' })).resolves.toMatchObject({
      text: 'Réponse du backend',
    });
    expect(refreshTokens).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get('Authorization')).toBe('Bearer expired-access');
    expect(new Headers(fetchMock.mock.calls[1]?.[1]?.headers).get('Authorization')).toBe('Bearer new-access');
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearAuthTokens,
  getAccessToken,
  getRefreshToken,
  isAccessTokenExpiringSoon,
  saveAuthTokens,
} from './authSession';

afterEach(() => {
  clearAuthTokens();
  vi.useRealTimers();
});

describe('authSession', () => {
  it('conserve les jetons de manière temporaire dans sessionStorage', () => {
    saveAuthTokens({ accessToken: 'access', refreshToken: 'refresh', expiresInSeconds: 900 });

    expect(getAccessToken()).toBe('access');
    expect(getRefreshToken()).toBe('refresh');
    expect(isAccessTokenExpiringSoon()).toBe(false);
  });

  it('indique qu’un access token arrive à expiration', () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);
    saveAuthTokens({ accessToken: 'access', refreshToken: 'refresh', expiresInSeconds: 10 });
    vi.setSystemTime(now + 9_000);

    expect(isAccessTokenExpiringSoon()).toBe(true);
  });

  it('efface les jetons et leur expiration', () => {
    saveAuthTokens({ accessToken: 'access', refreshToken: 'refresh', expiresInSeconds: 900 });
    clearAuthTokens();

    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(isAccessTokenExpiringSoon()).toBe(false);
  });
});

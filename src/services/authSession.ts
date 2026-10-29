export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds?: number;
}

const ACCESS_TOKEN_KEY = 'ivoirai.access_token';
const REFRESH_TOKEN_KEY = 'ivoirai.refresh_token';
const ACCESS_TOKEN_EXPIRY_KEY = 'ivoirai.access_token_expiry';
export const AUTH_SESSION_EXPIRED_EVENT = 'ivoirai:auth-session-expired';

export const getAccessToken = (): string | null => sessionStorage.getItem(ACCESS_TOKEN_KEY);

export const getRefreshToken = (): string | null => sessionStorage.getItem(REFRESH_TOKEN_KEY);

export const saveAuthTokens = ({ accessToken, refreshToken, expiresInSeconds }: AuthTokens): void => {
  try {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    if (typeof expiresInSeconds === 'number' && Number.isFinite(expiresInSeconds) && expiresInSeconds > 0) {
      sessionStorage.setItem(ACCESS_TOKEN_EXPIRY_KEY, String(Date.now() + expiresInSeconds * 1000));
    } else {
      sessionStorage.removeItem(ACCESS_TOKEN_EXPIRY_KEY);
    }
  } catch {
    clearAuthTokens();
    throw new Error('Le navigateur ne permet pas de conserver la session. Autorisez le stockage de session puis réessayez.');
  }
};

export const isAccessTokenExpiringSoon = (withinMs = 30_000): boolean => {
  const expiry = Number(sessionStorage.getItem(ACCESS_TOKEN_EXPIRY_KEY));
  return Number.isFinite(expiry) && expiry > 0 && expiry - Date.now() <= withinMs;
};

export const expireAuthSession = (): void => {
  clearAuthTokens();
  window.dispatchEvent(new Event(AUTH_SESSION_EXPIRED_EVENT));
};

export const clearAuthTokens = (): void => {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  sessionStorage.removeItem(ACCESS_TOKEN_EXPIRY_KEY);
};

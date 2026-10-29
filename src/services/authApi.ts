import { ApiError } from './apiError';
import {
  AuthTokens,
  expireAuthSession,
  isAccessTokenExpiringSoon,
  getRefreshToken,
  saveAuthTokens,
} from './authSession';

export interface RegisterRequest {
  full_name: string;
  email: string;
  phone_number: string;
  password: string;
}

export interface AuthUser {
  full_name?: string;
  email?: string;
  phone_number?: string;
}

const TIMEOUT_MS = 15_000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const readTokens = (value: unknown, fallbackRefreshToken?: string): AuthTokens => {
  const payload = isRecord(value) && isRecord(value.item) ? value.item : value;
  if (
    !isRecord(payload) ||
    typeof payload.access_token !== 'string' ||
    !payload.access_token
  ) {
    throw new ApiError('La réponse de connexion ne contient pas les jetons attendus.', null);
  }
  const refreshToken = typeof payload.refresh_token === 'string' ? payload.refresh_token : fallbackRefreshToken;
  if (!refreshToken) {
    throw new ApiError('La réponse de connexion ne contient pas les jetons attendus.', null);
  }
  return {
    accessToken: payload.access_token,
    refreshToken,
    expiresInSeconds:
      typeof payload.expires_in === 'number' && Number.isFinite(payload.expires_in)
        ? payload.expires_in
        : undefined,
  };
};

let refreshInFlight: Promise<AuthTokens> | null = null;

export const createAuthApi = (configuredBaseUrl?: string) => {
  const request = async <T>(path: string, init: RequestInit): Promise<T> => {
    if (!configuredBaseUrl) {
      throw new ApiError('Configurez VITE_API_URL pour utiliser l’authentification.', null);
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(`${configuredBaseUrl.replace(/\/$/, '')}${path}`, {
        ...init,
        signal: controller.signal,
      });
      const body: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          typeof body === 'object' && body !== null && 'message' in body && typeof body.message === 'string'
            ? body.message
            : `Erreur ${response.status} sur ${path}`;
        throw new ApiError(message, response.status);
      }
      if (isRecord(body) && body.hasError === true) {
        const status = typeof body.code === 'number' ? body.code : response.status;
        const message = typeof body.message === 'string' ? body.message : `Erreur ${status} sur ${path}`;
        throw new ApiError(message, status);
      }

      return body as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      const aborted = error instanceof DOMException && error.name === 'AbortError';
      throw new ApiError(
        aborted ? 'Le serveur met trop de temps à répondre.' : 'Impossible de joindre le serveur.',
        null
      );
    } finally {
      clearTimeout(timer);
    }
  };

  return {
    async register(data: RegisterRequest): Promise<void> {
      await request<unknown>('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    },

    async login(email: string, password: string): Promise<AuthTokens> {
      const response = await request<unknown>('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      return readTokens(response);
    },

    async refresh(refreshToken: string): Promise<AuthTokens> {
      const response = await request<unknown>('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      return readTokens(response, refreshToken);
    },

    async logout(accessToken: string): Promise<void> {
      await request<unknown>('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    },

    async profile(accessToken: string): Promise<AuthUser> {
      let response: unknown;
      let token = accessToken;
      if (isAccessTokenExpiringSoon() && getRefreshToken()) {
        token = (await refreshAuthSession()).accessToken;
      }
      try {
        response = await request<unknown>('/api/users/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401 || !getRefreshToken()) throw error;
        const tokens = await refreshAuthSession();
        response = await request<unknown>('/api/users/me', {
          headers: { Authorization: `Bearer ${tokens.accessToken}` },
        });
      }
      if (isRecord(response) && response.code === 401) {
        expireAuthSession();
        throw new ApiError(
          typeof response.message === 'string' ? response.message : 'Votre session a expiré.',
          401
        );
      }
      const user = isRecord(response) && isRecord(response.item) ? response.item : response;
      if (!isRecord(user)) {
        throw new ApiError('La réponse du profil utilisateur est invalide.', null);
      }
      return {
        full_name: typeof user.full_name === 'string' ? user.full_name : undefined,
        email: typeof user.email === 'string' ? user.email : undefined,
        phone_number: typeof user.phone_number === 'string' ? user.phone_number : undefined,
      };
    },
  };
};

export const authApi = createAuthApi(import.meta.env.VITE_API_URL?.trim());

export const refreshAuthSession = (): Promise<AuthTokens> => {
  if (refreshInFlight) return refreshInFlight;
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    expireAuthSession();
    return Promise.reject(new ApiError('Votre session a expiré. Veuillez vous reconnecter.', 401));
  }

  refreshInFlight = authApi
    .refresh(refreshToken)
    .then((tokens) => {
      saveAuthTokens(tokens);
      return tokens;
    })
    .catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 401) expireAuthSession();
      throw error;
    })
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
};

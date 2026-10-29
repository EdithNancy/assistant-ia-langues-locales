import { IvoirAIApi } from './types';
import {
  AuthTokens,
  expireAuthSession,
  getAccessToken,
  getRefreshToken,
  isAccessTokenExpiringSoon,
} from './authSession';
import { ApiError } from './apiError';
import { refreshAuthSession } from './authApi';

const TIMEOUT_MS = 15_000;

export { ApiError } from './apiError';

/** Implémentation réelle : appelle le backend FastAPI à `baseUrl`. */
export const createHttpApi = (
  baseUrl: string,
  refreshTokens: () => Promise<AuthTokens> = refreshAuthSession
): IvoirAIApi => {
  const request = async (path: string, init: RequestInit): Promise<Response> => {
    const performRequest = async (token: string | null): Promise<Response> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const headers = new Headers(init.headers);
      if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
      try {
        return await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
          ...init,
          headers,
          signal: controller.signal,
        });
      } catch (error) {
        const aborted = error instanceof DOMException && error.name === 'AbortError';
        throw new ApiError(
          aborted ? 'Le serveur met trop de temps à répondre.' : 'Impossible de joindre le serveur.',
          null
        );
      } finally {
        clearTimeout(timer);
      }
    };

    let token = getAccessToken();
    if (token && getRefreshToken() && isAccessTokenExpiringSoon()) {
      token = (await refreshTokens()).accessToken;
    }
    let response = await performRequest(token);
    if (response.status === 401 && getAccessToken() && getRefreshToken()) {
      const tokens = await refreshTokens();
      response = await performRequest(tokens.accessToken);
      if (response.status === 401) expireAuthSession();
    } else if (response.status === 401 && getAccessToken()) {
      expireAuthSession();
    }
    if (!response.ok) throw new ApiError(`Erreur ${response.status} sur ${path}`, response.status);
    return response;
  };

  const postJson = async <T>(path: string, body: unknown): Promise<T> => {
    const response = await request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return (await response.json()) as T;
  };

  return {
    async transcribe(audio, hint) {
      const form = new FormData();
      form.append('audio', audio, 'enregistrement.webm');
      if (hint) form.append('language', hint);
      const response = await request('/transcribe', { method: 'POST', body: form });
      return response.json();
    },

    translate: (body) => postJson('/translate', body),

    async synthesize(text, language) {
      const response = await request('/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language }),
      });
      return { audioUrl: URL.createObjectURL(await response.blob()) };
    },

    chat: (body) => postJson('/chat', body),

    detectLanguage: (text) => postJson('/detect-language', { text }),

    async sendFeedback(feedback) {
      await request('/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feedback),
      });
    },
  };
};

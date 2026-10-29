import { createHttpApi } from './httpApi';
import { mockApi } from './mockApi';
import { IvoirAIApi } from './types';

export * from './types';
export { ApiError } from './apiError';
export { authApi, refreshAuthSession } from './authApi';
export {
  AUTH_SESSION_EXPIRED_EVENT,
  clearAuthTokens,
  expireAuthSession,
  getAccessToken,
  getRefreshToken,
  isAccessTokenExpiringSoon,
  saveAuthTokens,
} from './authSession';

const apiUrl = import.meta.env.VITE_API_URL?.trim();
const useMockApi = import.meta.env.MODE === 'test' || !apiUrl;

/** `true` tant qu'aucune API n'est configurée : les réponses sont simulées. */
export const isMockApi = useMockApi;

/** Point d'entrée unique : les composants appellent `api.xxx`, jamais `fetch` directement. */
export const api: IvoirAIApi = useMockApi || !apiUrl ? mockApi : createHttpApi(apiUrl);

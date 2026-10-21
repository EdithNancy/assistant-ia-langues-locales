import { createHttpApi } from './httpApi';
import { mockApi } from './mockApi';
import { IvoirAIApi } from './types';

export * from './types';
export { ApiError } from './httpApi';

const apiUrl = import.meta.env.VITE_API_URL?.trim();

/** `true` tant qu'aucune API n'est configurée : les réponses sont simulées. */
export const isMockApi = !apiUrl;

/** Point d'entrée unique : les composants appellent `api.xxx`, jamais `fetch` directement. */
export const api: IvoirAIApi = apiUrl ? createHttpApi(apiUrl) : mockApi;

import { IvoirAIApi } from './types';

const TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Implémentation réelle : appelle le backend FastAPI à `baseUrl`. */
export const createHttpApi = (baseUrl: string): IvoirAIApi => {
  const request = async (path: string, init: RequestInit): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
        ...init,
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new ApiError(`Erreur ${response.status} sur ${path}`, response.status);
      }
      return response;
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

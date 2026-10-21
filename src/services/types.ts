import { ChatMessage, Language } from '../types';

/**
 * Contrat entre le front et l'API IvoirAI.
 * Les noms de routes et de champs sont à valider avec l'équipe backend (FastAPI).
 */

/** Langues de texte gérées : le français en plus des langues locales. */
export type TextLanguage = 'fr' | Language;

export interface TranscribeResult {
  text: string;
  language: TextLanguage;
}

export interface TranslateRequest {
  text: string;
  /** 'auto' : l'API détecte la langue source. */
  source: TextLanguage | 'auto';
  target: TextLanguage;
}

export interface TranslateResult {
  translation: string;
  phonetic: string;
  tone: string;
  tip: string;
  detectedSource: TextLanguage;
}

export interface SynthesizeResult {
  /** URL lisible par <audio>. `null` : pas de voix disponible, le front utilise la voix du navigateur. */
  audioUrl: string | null;
}

export interface ChatRequest {
  message: string;
  language: Language;
}

export type ChatReply = Pick<
  ChatMessage,
  'text' | 'phonetic' | 'translation' | 'tone' | 'linguisticBreakdown' | 'audioDuration'
>;

export interface DetectResult {
  language: TextLanguage;
  /** Entre 0 et 1. */
  confidence: number;
}

export interface FeedbackRequest {
  messageId: string;
  rating: 'up' | 'down';
  comment?: string;
}

export interface IvoirAIApi {
  transcribe(audio: Blob, hint?: Language): Promise<TranscribeResult>;
  translate(request: TranslateRequest): Promise<TranslateResult>;
  synthesize(text: string, language: TextLanguage): Promise<SynthesizeResult>;
  chat(request: ChatRequest): Promise<ChatReply>;
  detectLanguage(text: string): Promise<DetectResult>;
  sendFeedback(feedback: FeedbackRequest): Promise<void>;
}

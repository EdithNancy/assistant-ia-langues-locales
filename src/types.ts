export type Language = 'baoule' | 'dioula' | 'bete';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  timestamp: string;
  text: string;
  language?: Language;
  /** Langue reconnue automatiquement dans le message de l'utilisateur. */
  detectedLanguage?: 'fr' | Language;
  audioDuration?: string;
  phonetic?: string;
  tone?: string;
  translation?: string;
  linguisticBreakdown?: {
    term: string;
    meaning: string;
  }[];
}

export interface VocabularyItem {
  id: string;
  word: string;
  language: Language;
  meaning: string;
  phonetic: string;
  category: string;
  example: string;
  exampleMeaning: string;
  tone: string;
  isFavorite: boolean;
}

export interface LearningModule {
  id: string;
  title: string;
  subtitle: string;
  lessonsCount: number;
  progress: number;
  category: string;
  tag?: string;
  imageUrl: string;
  lessons: {
    title: string;
    description: string;
    phrase: string;
    translation: string;
    phonetic: string;
  }[];
}

export interface QuizQuestion {
  id: string;
  proverb: string;
  language: string;
  phonetic: string;
  french: string;
  correctTone: 'Haut' | 'Bas' | 'Moyen';
  options: ('Haut' | 'Bas' | 'Moyen')[];
  explanation: string;
}

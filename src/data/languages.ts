import type { TextLanguage } from '../services/types';

/** Nom affiché de chaque langue. */
export const LANGUAGE_LABEL: Record<TextLanguage, string> = {
  fr: 'Français',
  baoule: 'Baoulé',
  dioula: 'Dioula',
  bete: 'Bété',
};

/** Icône Material Symbols par catégorie de vocabulaire (doit figurer dans icon_names de index.html). */
const CATEGORY_ICON: Record<string, string> = {
  Accueil: 'handshake',
  Culture: 'auto_stories',
  Famille: 'volunteer_activism',
  'Patrimoine Oral Akan': 'record_voice_over',
  Politesse: 'waving_hand',
  Pratique: 'lightbulb',
  Salutations: 'waving_hand',
  Social: 'chat_bubble',
  'Travail & Respect': 'work',
  'Vie quotidienne': 'home',
};

export const categoryIcon = (category: string): string => CATEGORY_ICON[category] ?? 'translate';

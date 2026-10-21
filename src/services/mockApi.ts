import { Language } from '../types';
import { ChatReply, FeedbackRequest, IvoirAIApi, TextLanguage } from './types';

/**
 * Implémentation simulée, utilisée tant que VITE_API_URL n'est pas renseignée.
 * Elle reproduit les réponses de démonstration qui étaient codées en dur dans les écrans.
 */

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

interface PhraseVariant {
  text: string;
  phonetic: string;
  tone: string;
  tip: string;
}

interface Phrase {
  keywords: string[];
  fr: string;
  baoule: PhraseVariant;
  dioula: PhraseVariant;
}

const PHRASES: Phrase[] = [
  {
    keywords: ['banane', 'combien', 'plantain', 'alokô', 'barana'],
    fr: 'Combien coûte le régime de bananes plantain ?',
    baoule: {
      text: 'Alokô kpɛkun nga ɔ to nzen ?',
      phonetic: '[Ah-loh-koh kpeh-koon ngah oh toh n-zen ?]',
      tone: 'Ton Moyen',
      tip: 'Pour le plantain mûr au marché baoulé, précisez « alokô » pour le plantain doux à frire.',
    },
    dioula: {
      text: 'Barana yiriwari nin bɛ sɔngɔ jolibɔ ?',
      phonetic: '[Bah-rah-nah yee-ree-wah-ree neen bɛh sɔn-gɔ joh-lee-bɔ]',
      tone: 'Ton Haut-Bas',
      tip: "Au marché d'Abidjan, dites simplement « Barana nin joli ? » pour un échange naturel et direct avec le commerçant.",
    },
  },
  {
    keywords: ['taxi', 'plateau', 'plató', 'wotoro', 'loto'],
    fr: 'Où puis-je trouver un bon taxi pour aller au Plateau ?',
    baoule: {
      text: 'N wun loto kpa kɔ Plató nuan nun ?',
      phonetic: '[N woon loh-toh kpah koh Plah-toh nwan noon]',
      tone: 'Ton Moyen-Haut',
      tip: 'En Baoulé, le voyage se bénit en souhaitant « Atin kpa » (bonne route).',
    },
    dioula: {
      text: 'N bɛ se ka wotoro sɔrɔ ka taa Plató yɔrɔ juman ?',
      phonetic: '[N beh seh kah woh-toh-roh soh-roh kah tah Plah-toh ?]',
      tone: 'Ton Montant',
      tip: 'À Abidjan, les wôro-wôro ou taxis compteurs ont des codes de négociation simples : donnez la destination et demandez « c’est combien ? »',
    },
  },
];

const FALLBACK_PHRASE: Phrase = {
  keywords: [],
  fr: 'Merci beaucoup, bienvenue à la maison !',
  baoule: {
    text: 'Mo kpa kpa ! Akwaba awlo nun.',
    phonetic: '[Moh kpah kpah ! Ah-kwah-bah ow-loh noon]',
    tone: 'Ton Haut',
    tip: 'Le mot « Akwaba » est le trésor d’accueil de toute la Côte d’Ivoire.',
  },
  dioula: {
    text: 'Aw ni ce kosɛbɛ, an bɛ kɔfɛ !',
    phonetic: '[Ow nee tché koh-seh-beh, an beh koh-feh]',
    tone: 'Ton Haut',
    tip: 'Une salutation chaleureuse ouvre toujours les meilleures opportunités en pays mandé.',
  },
};

const DIOULA_MARKERS = ['bɛ', ' ka ', 'ni ce', 'sɔgɔma', 'barana', 'wotoro', 'kosɛbɛ', 'jolibɔ'];
const BAOULE_MARKERS = ['akwaba', 'nzoué', 'kpa', 'alokô', 'awlo', "n'dri", 'n’dri', 'nun'];

const detect = (text: string): { language: TextLanguage; confidence: number } => {
  const lower = ` ${text.toLowerCase()} `;
  const dioula = DIOULA_MARKERS.filter((m) => lower.includes(m)).length;
  const baoule = BAOULE_MARKERS.filter((m) => lower.includes(m)).length;
  if (dioula === 0 && baoule === 0) return { language: 'fr', confidence: 0.8 };
  return dioula >= baoule
    ? { language: 'dioula', confidence: Math.min(0.95, 0.6 + dioula * 0.1) }
    : { language: 'baoule', confidence: Math.min(0.95, 0.6 + baoule * 0.1) };
};

const findPhrase = (text: string): Phrase => {
  const lower = text.toLowerCase();
  return PHRASES.find((p) => p.keywords.some((k) => lower.includes(k))) ?? FALLBACK_PHRASE;
};

const localVariant = (phrase: Phrase, language: TextLanguage): PhraseVariant =>
  language === 'dioula' ? phrase.dioula : phrase.baoule;

const chatReply = (message: string, language: Language): ChatReply => {
  const lower = message.toLowerCase();
  const dioula = language === 'dioula';

  if (lower.includes('bonjour') || lower.includes('salut')) {
    return dioula
      ? {
          text: '« An sɔgɔma ! I ka kɛnɛ wa ? »',
          phonetic: '[An Sɔ-gɔ-ma ! Ee kah keh-neh wah]',
          translation: 'Bonjour ! Te portes-tu bien ce matin ?',
          tone: 'Ton Moyen-Haut',
          linguisticBreakdown: [
            { term: 'An sɔgɔma', meaning: 'Bonjour / Bonne matinée' },
            { term: 'I ka kɛnɛ wa', meaning: 'Es-tu en bonne santé / Comment vas-tu ?' },
          ],
        }
      : {
          text: '« Akwaba ! Nzoué o ? »',
          phonetic: '[Ah-kwah-bah ! N-zoo-eh oh]',
          translation: 'Bienvenue ! Comment vas-tu ?',
          tone: 'Ton Moyen-Haut',
          linguisticBreakdown: [
            { term: 'Akwaba', meaning: 'Bienvenue / Salutation d’accueil' },
            { term: 'Nzoué o', meaning: 'Comment vas-tu ? (Lit. Comment est l’eau ?)' },
          ],
        };
  }

  if (lower.includes('merci')) {
    return dioula
      ? {
          text: '« I ni ce kosɛbɛ ! »',
          phonetic: '[Ee nee tché koh-seh-beh]',
          translation: 'Merci beaucoup de tout coeur !',
          tone: 'Ton Moyen-Haut',
          linguisticBreakdown: [
            { term: 'I ni ce', meaning: 'Merci' },
            { term: 'kosɛbɛ', meaning: 'Beaucoup / avec insistance' },
          ],
        }
      : {
          text: '« Mo n’dri kpa kpa ! »',
          phonetic: '[Moh n-dree kpah kpah]',
          translation: 'Grand merci chaleureux à toi !',
          tone: 'Ton Moyen-Haut',
          linguisticBreakdown: [
            { term: 'Mo n’dri', meaning: 'Merci beaucoup' },
            { term: 'kpa kpa', meaning: 'Vraiment / très bien' },
          ],
        };
  }

  if (lower.includes('prix') || lower.includes('marché') || lower.includes('combien')) {
    return dioula
      ? {
          text: '« Sɔngɔ jolibɔ ? Dɔ bɔ a la n ma. »',
          phonetic: '[Son-goh joh-lee-boh ? Doh boh ah lah n mah]',
          translation: 'Quel est le prix ? Diminue un peu pour moi.',
          tone: 'Ton Moyen-Haut',
          linguisticBreakdown: [
            { term: 'Sɔngɔ', meaning: 'Le prix / la valeur' },
            { term: 'Jolibɔ', meaning: 'Combien / quelle somme' },
            { term: 'Dɔ bɔ', meaning: 'Enlève un peu / rabais de courtoisie' },
          ],
        }
      : {
          text: '« N kplo kɛ n to bo afwé nun. »',
          phonetic: '[N-kplo keh n-toh boh ah-fweh noon]',
          translation: 'Je souhaite faire mes achats au marché.',
          tone: 'Ton Moyen-Haut',
          linguisticBreakdown: [
            { term: 'N to', meaning: 'Acheter' },
            { term: 'Bo afwé nun', meaning: 'Au marché' },
          ],
        };
  }

  return dioula
    ? {
        text: `« N b’a mɛn ! "${message}" bɛ fɔ ko : Aw bɛ kɛnɛ. »`,
        phonetic: '[N beh ah men ! Aw beh keh-neh]',
        translation: `Bien compris ! "${message}" trouve son écho dans la tradition d'Abidjan.`,
        tone: 'Ton Moyen-Haut',
        linguisticBreakdown: [
          { term: 'N b’a mɛn', meaning: 'Je comprends / j’entends bien' },
          { term: 'Bɛ fɔ ko', meaning: 'On l’exprime ainsi' },
        ],
      }
    : {
        text: `« N ti ndɛ nun kpa. "${message}" o ti ndɛ kpa. »`,
        phonetic: '[N tee n-deh noon kpah]',
        translation: `Je saisis parfaitement. "${message}" s'exprime avec respect chez les Baoulés.`,
        tone: 'Ton Moyen-Haut',
        linguisticBreakdown: [
          { term: 'N ti ndɛ nun', meaning: 'Je comprends la parole' },
          { term: 'Ndɛ kpa', meaning: 'Bonne parole / propos juste' },
        ],
      };
};

/** Retours enregistrés pendant la session, consultables dans la console de développement. */
export const mockFeedbackLog: FeedbackRequest[] = [];

export const mockApi: IvoirAIApi = {
  async transcribe(_audio, hint) {
    await delay(900);
    if (hint === 'dioula') return { text: 'I ni ce, n bɛ fɛ ka kalan kɛ', language: 'dioula' };
    if (hint === 'baoule') return { text: "Mo n'dri, n kplo kɛ n suan ndɛ", language: 'baoule' };
    return { text: 'Où puis-je trouver un bon taxi pour aller au Plateau ?', language: 'fr' };
  },

  async translate({ text, source, target }) {
    await delay(500);
    const detectedSource = source === 'auto' ? detect(text).language : source;
    const phrase = findPhrase(text);
    if (target === 'fr') {
      const variant = localVariant(phrase, detectedSource);
      return { translation: phrase.fr, phonetic: '', tone: variant.tone, tip: variant.tip, detectedSource };
    }
    const variant = localVariant(phrase, target);
    return {
      translation: variant.text,
      phonetic: variant.phonetic,
      tone: variant.tone,
      tip: variant.tip,
      detectedSource,
    };
  },

  async synthesize() {
    await delay(200);
    return { audioUrl: null };
  },

  async chat({ message, language }) {
    await delay(800);
    return { ...chatReply(message, language), audioDuration: '0:05' };
  },

  async detectLanguage(text) {
    await delay(150);
    return detect(text);
  },

  async sendFeedback(feedback) {
    await delay(200);
    mockFeedbackLog.push(feedback);
  },
};

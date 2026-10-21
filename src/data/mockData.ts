import { ChatMessage, LearningModule, QuizQuestion, VocabularyItem } from '../types';
import logo from '../assets/images/logo.svg';
import edithProfile from '../assets/images/profile.webp';
import ayaAvatar from '../assets/images/avatar.webp';
import baouleTextile from '../assets/images/textile.webp';
import marketStall from '../assets/images/marche.webp';
import elders from '../assets/images/notable.webp';
import family from '../assets/images/famille.webp';
import goldWeights from '../assets/images/cultures.webp';


export const BRAND_ASSETS = {
  logo,
  edithProfile,
  ayaAvatar,
  baouleTextile,
  marketStall,
  elders,
  family,
  goldWeights
} as const;

export const INITIAL_CHAT_MESSAGES: ChatMessage[] = [
  {
    id: 'msg-1',
    sender: 'ai',
    timestamp: '09:40',
    text: 'Akwaba ! Nzoué o ? (Comment vas-tu ?). Je suis Aya, ton assistante IA en langue Baoulé. Pose-moi une question en Baoulé ou en Français !',
    audioDuration: '0:06',
    language: 'baoule',
  },
  {
    id: 'msg-2',
    sender: 'user',
    timestamp: '09:42',
    text: "Mo n'dri ! N'klô kpa. Comment dit-on « Je voudrais acheter de l'attiéké frais au marché » ?",
    language: 'baoule',
  },
  {
    id: 'msg-3',
    sender: 'ai',
    timestamp: '09:42',
    text: '« N kplo kɛ n to attiéké kpa bo afwé nun. »',
    language: 'baoule',
    phonetic: '[N-kplo kɛ n-to a-tyé-ké]',
    tone: 'Ton Moyen-Haut',
    translation: "Je voudrais acheter de l'attiéké de bonne qualité au marché.",
    linguisticBreakdown: [
      { term: 'N kplo kɛ', meaning: 'Je veux / je voudrais (expression de politesse courtoise)' },
      { term: 'N to', meaning: "J'achète / acheter" },
      { term: 'Attiéké kpa', meaning: "Attiéké de qualité / frais (garba ou d'or)" },
      { term: 'Bo afwé nun', meaning: "Au marché / à l'étal" },
    ],
  },
];

export const VOCABULARY_LIST: VocabularyItem[] = [
  {
    id: 'v-1',
    word: "N'zue",
    language: 'baoule',
    meaning: "L'eau / Boisson vitale",
    phonetic: '[N-zoo-eh]',
    category: 'Vie quotidienne',
    example: "Man min n'zue kpa",
    exampleMeaning: "Donne-moi de la bonne eau",
    tone: 'Ton Haut',
    isFavorite: true,
  },
  {
    id: 'v-2',
    word: 'I ni ce',
    language: 'dioula',
    meaning: 'Merci / Salutation cordiale',
    phonetic: '[Ee nee tché]',
    category: 'Politesse',
    example: 'I ni ce kosɛbɛ',
    exampleMeaning: 'Merci beaucoup',
    tone: 'Ton Moyen',
    isFavorite: true,
  },
  {
    id: 'v-3',
    word: 'Aw ni baara',
    language: 'dioula',
    meaning: 'Bon travail / Bon courage à vous',
    phonetic: '[Ow nee bah-rah]',
    category: 'Travail & Respect',
    example: 'Aw ni baara, an bɛ kɔfɛ',
    exampleMeaning: 'Bon travail à vous, à plus tard',
    tone: 'Ton Haut',
    isFavorite: true,
  },
  {
    id: 'v-4',
    word: 'Akwaba',
    language: 'baoule',
    meaning: 'Bienvenue / Sois le bienvenu',
    phonetic: '[Ah-kwah-bah]',
    category: 'Accueil',
    example: 'Akwaba o awlo nun',
    exampleMeaning: 'Bienvenue dans notre maison',
    tone: 'Ton Haut',
    isFavorite: false,
  },
  {
    id: 'v-5',
    word: 'An sɔgɔma',
    language: 'dioula',
    meaning: 'Bonjour / Bonne matinée',
    phonetic: '[An Sɔ-gɔ-ma]',
    category: 'Salutations',
    example: 'An sɔgɔma, i ka kɛnɛ wa ?',
    exampleMeaning: 'Bonjour, te portes-tu bien ?',
    tone: 'Ton Moyen',
    isFavorite: true,
  },
  {
    id: 'v-6',
    word: 'Mo n’dri',
    language: 'baoule',
    meaning: 'Grand merci / Gratitude infinie',
    phonetic: '[Moh n-dree]',
    category: 'Politesse',
    example: "Mo n'dri kpa bé kwlaa",
    exampleMeaning: 'Un grand merci à vous tous',
    tone: 'Ton Haut',
    isFavorite: false,
  },
];

export const LEARNING_MODULES: LearningModule[] = [
  {
    id: 'mod-1',
    title: 'Marché & Négociations',
    subtitle: '8 leçons • Vocabulaire du troc',
    lessonsCount: 8,
    progress: 85,
    category: 'Pratique',
    tag: 'Populaire',
    imageUrl: BRAND_ASSETS.marketStall,
    lessons: [
      {
        title: 'Demander le prix du jour',
        description: 'Apprenez à demander le prix des condiments avec le bon ton.',
        phrase: 'Barana nin bɛ sɔngɔ jolibɔ ?',
        translation: 'Combien coûte ce régime de bananes ?',
        phonetic: '[Bah-rah-nah neen beh son-goh joh-lee-boh]',
      },
      {
        title: 'Négocier poliment',
        description: 'Proposer une réduction sans offenser la vendeuse.',
        phrase: 'Dɔ bɔ a la n ma',
        translation: 'Diminue un peu pour moi s’il te plaît',
        phonetic: '[Doh boh ah lah n mah]',
      },
      {
        title: 'Exprimer la satisfaction',
        description: 'Conclure la vente avec cordialité.',
        phrase: 'A ka nyi, n b’a ta',
        translation: "C'est bon, je le prends !",
        phonetic: '[Ah kah nyee, n beh ah tah]',
      },
    ],
  },
  {
    id: 'mod-2',
    title: 'Salutations & Respect',
    subtitle: "12 leçons • Rituels d'accueil",
    lessonsCount: 12,
    progress: 100,
    category: 'Social',
    tag: 'Acquis',
    imageUrl: BRAND_ASSETS.elders,
    lessons: [
      {
        title: "Saluer les aînés le matin",
        description: "Les formules d'humilité et de considération.",
        phrase: "N'anan mo, n kpa kpa o",
        translation: "Bonjour grand-mère, bon réveil !",
        phonetic: "[N-ah-nahn moh, n kpah kpah oh]",
      },
      {
        title: "Demander des nouvelles de la famille",
        description: "S'enquérir du foyer et des enfants.",
        phrase: "Awlo'n nunfuɛ mun be kɛnɛ ?",
        translation: "Comment se porte toute la maison ?",
        phonetic: "[Ow-loh-n noon-fweh moon beh keh-neh]",
      },
    ],
  },
  {
    id: 'mod-3',
    title: 'Famille & Parenté',
    subtitle: '6 leçons • Arbre généalogique',
    lessonsCount: 6,
    progress: 35,
    category: 'Famille',
    imageUrl: BRAND_ASSETS.family,
    lessons: [
      {
        title: 'Les liens matrilinéaires Akan',
        description: "L'oncle maternel, le pilier de la tradition.",
        phrase: 'Min wofa lo ba kpa',
        translation: "Mon oncle maternel est un homme bon",
        phonetic: '[Meen woh-fah loh bah kpah]',
      },
      {
        title: 'Nommer ses frères et soeurs',
        description: 'Les termes de sororité et fraternité.',
        phrase: 'Min nianman bian nin min nianman bla',
        translation: 'Mon frère et ma soeur',
        phonetic: '[Meen nyahn-mahn byahn neen meen nyahn-mahn blah]',
      },
    ],
  },
  {
    id: 'mod-4',
    title: 'Proverbes & Sagesses',
    subtitle: '10 leçons • Maximes & contes',
    lessonsCount: 10,
    progress: 20,
    category: 'Culture',
    tag: 'Culture',
    imageUrl: BRAND_ASSETS.goldWeights,
    lessons: [
      {
        title: "La patience de l'araignée Anansi",
        description: "Un proverbe métaphorique sur la persévérance.",
        phrase: "Gblin ndɛ kpɔkuɛ nin bo nun wunmiɛn",
        translation: "Le voyage le plus long commence par un pas paisible",
        phonetic: "[Gbleen n-deh k-poh-kweh neen boh noon woon-myen]",
      },
    ],
  },
];

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 'q-1',
    proverb: 'An sɔgɔma !',
    language: 'Dioula',
    phonetic: '[An Sɔ-gɔ-ma]',
    french: 'Bonjour / Salutation matinale',
    correctTone: 'Moyen',
    options: ['Haut', 'Moyen', 'Bas'],
    explanation: 'En Dioula, « sɔgɔma » se prononce avec un ton neutre moyen régulier, signalant une salutation cordiale et posée.',
  },
  {
    id: 'q-2',
    proverb: 'Mo kpa kpa !',
    language: 'Baoulé',
    phonetic: '[Moh kpah kpah]',
    french: 'Merci beaucoup !',
    correctTone: 'Haut',
    options: ['Haut', 'Moyen', 'Bas'],
    explanation: 'Le redoublement « kpa kpa » en Baoulé monte en tonalité haute pour marquer l’insistance et la vive reconnaissance.',
  },
  {
    id: 'q-3',
    proverb: 'I ka kɛnɛ wa ?',
    language: 'Dioula',
    phonetic: '[Ee kah keh-neh wah]',
    french: 'Te portes-tu bien ?',
    correctTone: 'Haut',
    options: ['Haut', 'Moyen', 'Bas'],
    explanation: 'La particule finale « wa » porte un ton interrogatif montant vers l’aigu caractéristique du parler ivoirien.',
  },
];

export const CULTURAL_STORIES = [
  {
    id: 'story-1',
    title: 'La sagesse du pagne Baoulé',
    category: 'Patrimoine Oral Akan',
    readTime: '3 min',
    image: BRAND_ASSETS.baouleTextile,
    summary: 'Découvrez les proverbes ancestraux tissés dans les motifs traditionnels avec l’écoute guidée.',
    content: `Chez le peuple Baoulé, chaque motif géométrique tissé sur le métier traditionnel en bois n’est pas qu’une œuvre d’art décorative : c’est un alphabet philosophique silencieux.

Quand un sage ou une reine mère porte le pagne "Agnéman" ou "Kôlôkôlô", chaque losange indigo rappelle que « La patience émousse même la pointe de la flèche ». Les fils dorés et ocre soulignent la lumière du jour et la prospérité partagée au sein de la communauté.

Écoutez la voix du maître tisserand de Bomizambo raconter la genèse des proverbes qui accompagnent chaque trame.`,
    audioPhrase: "Baoulé pnin mun be se kɛ : wunmiɛn nun suɛn yɛ ɔ maan klo kpa.",
    audioTranslation: "Les anciens Baoulés disent : c’est dans la concorde partagée que le village s’épanouit.",
  },
];

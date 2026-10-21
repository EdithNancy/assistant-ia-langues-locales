/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL de l'API IvoirAI. Vide : le front utilise les réponses simulées. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

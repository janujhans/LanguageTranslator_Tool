
export enum TranslationMode {
  TEXT = 'TEXT',
  LIVE = 'LIVE',
  VISION = 'VISION'
}

export interface Language {
  code: string;
  name: string;
  flag: string;
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  sourceText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
}

export interface TranslationState {
  sourceText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  isTranslating: boolean;
  error: string | null;
}

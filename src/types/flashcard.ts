import type { Note, NoteType, Card, CardTemplate, CardSrs, CardState } from './models';
export type { Note, NoteType, Card, CardTemplate, CardSrs, CardState };

export interface Flashcard {
  id: string;
  noteId?: string;           
  templateIdx?: number;      
  front: string;             
  back: string;              
  meaning: string;           
  example_jp: string;        
  example_hiragana: string;  
  example_id: string;        
  hint?: string;             
  extra?: string;            
  tags?: string[];           
  createdAt: number;
  deckId: string;
  srs?: CardSrs;             
  suspended?: boolean;       
  buriedUntil?: string;      
  flag?: number;             
  marked?: boolean;
}

export interface Deck {
  id: string;
  name: string;
  description: string;
  parentId?: string;         
  presetId?: string;         
  createdAt: number;
}

export type ReviewRating = 1 | 2 | 3 | 4; 

export interface ReviewLog {
  id?: number;
  cardId: string;
  deckId: string;
  ts: number;              
  studyDay: string;        
  rating: ReviewRating;    
  scheduledDays?: number;  
  stateBefore?: CardState; 
  durationMs: number;      
  isFirstReview: boolean;  
}


export interface StudySettings {
  newPerDay: number;
  reviewsPerDay: number;
  desiredRetention: number;     
  learningSteps: string[];      
  relearningSteps: string[];    
  maximumInterval: number;      
  dayStartHour: number;         
  leechThreshold: number;       
  autoSpeak: boolean;           
  soundEnabled: boolean;        
  soundVolume: number;          
}

export const DEFAULT_SETTINGS: StudySettings = {
  newPerDay: 20,
  reviewsPerDay: 200,
  desiredRetention: 0.9,
  learningSteps: ['1m', '10m'],
  relearningSteps: ['10m'],
  maximumInterval: 36500,
  dayStartHour: 3,
  leechThreshold: 8,
  autoSpeak: false,
  soundEnabled: true,
  soundVolume: 0.5,
};

export interface DeckPreset {
  id: string;
  name: string;
  newPerDay: number;
  reviewsPerDay: number;
  desiredRetention: number;
  learningSteps: string[];
  relearningSteps: string[];
  maximumInterval: number;
  leechThreshold: number;
  newCardOrder?: 'order' | 'random';
}

export const DEFAULT_DECK_PRESET: DeckPreset = {
  id: 'preset-default',
  name: 'Default Preset',
  newPerDay: 20,
  reviewsPerDay: 200,
  desiredRetention: 0.9,
  learningSteps: ['1m', '10m'],
  relearningSteps: ['10m'],
  maximumInterval: 36500,
  leechThreshold: 8,
  newCardOrder: 'order',
};


export interface RecallioBundleCard {
  id?: string;               
  front: string;
  back: string;
  meaning: string;
  example_jp: string;
  example_hiragana: string;
  example_id: string;
  hint?: string;
  extra?: string;
  tags?: string[];
}

export interface RecallioBundleDeck {
  id?: string;
  name: string;
  description: string;
  cards: RecallioBundleCard[];
}

export interface RecallioBundle {
  schema: 'recallio.deck-bundle';
  version: number;
  decks: RecallioBundleDeck[];
}


export interface InkaBackup {
  schema: 'inka.backup';
  version: 1;
  exportedAt: number;
  decks: Deck[];
  cards: Flashcard[];
  revlog: ReviewLog[];
  settings: StudySettings;
}

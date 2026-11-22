export interface CardTemplate {
  name: string;
  qfmt: string; 
  afmt: string; 
}

export interface NoteTypeField {
  name: string;
}

export interface NoteType {
  id: string;
  name: string;
  isCloze?: boolean;
  fields: NoteTypeField[];
  templates: CardTemplate[];
  css?: string;
}

export interface Note {
  id: string;
  noteTypeId: string;
  deckId: string;
  fields: Record<string, string>;
  tags: string[];
  createdAt: number;
}


export type CardState = 0 | 1 | 2 | 3;

export interface CardSrs {
  due: number; 
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  state: CardState;
  lastReview?: number;
}

export interface Card {
  id: string;
  noteId: string;
  deckId: string;
  templateIdx: number;
  srs?: CardSrs;
  suspended?: boolean;
  buriedUntil?: string; 
  flag?: number;        
  marked?: boolean;
  createdAt: number;
}

export interface CardTemplate {
  name: string;
  qfmt: string; // Question format, e.g. "{{Front}}" or "{{FrontSide}}\n\n<hr id=answer>\n\n{{Back}}"
  afmt: string; // Answer format
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

/** 0 = Baru, 1 = Belajar, 2 = Review, 3 = Ulang (relearning). */
export type CardState = 0 | 1 | 2 | 3;

export interface CardSrs {
  due: number; // epoch ms
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
  buriedUntil?: string; // studyDay 'YYYY-MM-DD'
  flag?: number;        // 0-7
  marked?: boolean;
  createdAt: number;
}

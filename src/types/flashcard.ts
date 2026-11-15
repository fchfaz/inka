export interface Flashcard {
  id: string;
  front: string;             // Kanji / vocabulary di depan
  back: string;              // Hiragana / furigana
  meaning: string;           // Arti bahasa Indonesia
  example_jp: string;        // Contoh kalimat Jepang
  example_hiragana: string;  // Cara baca kalimat
  example_id: string;        // Terjemahan kalimat
  hint?: string;             // Petunjuk tambahan (opsional)
  tags?: string[];           // Kategori kosakata (opsional)
  createdAt: number;
  deckId: string;
}

export interface Deck {
  id: string;
  name: string;
  description: string;
  createdAt: number;
}

export interface ScheduledInterval {
  cardId: string;
  targetQueueIndex: number; // Will trigger when session card counter reaches this value
  intervalCards: number;    // 3, 5, 30, or 50
  scheduledAt: number;
}

export type ReviewRating = 1 | 2 | 3 | 4; // 1: Again, 2: Hard, 3: Good, 4: Easy
export type ReviewInterval = 3 | 5 | 30 | 50;

export interface ReviewLog {
  id?: number;
  cardId: string;
  deckId: string;
  ts: number;              // Date.now() saat menjawab
  studyDay: string;        // 'YYYY-MM-DD' dengan batas ganti hari 03:00
  rating: ReviewRating;    // Again | Hard | Good | Easy
  interval: ReviewInterval;
  durationMs: number;      // waktu dari kartu tampil sampai jawaban, dibatasi maks 60000
  isFirstReview: boolean;  // true bila ini review pertama kartu tsb (dasar statistik "kartu baru")
}

// JSON bundle exchange format
export interface RecallioBundleCard {
  front: string;
  back: string;
  meaning: string;
  example_jp: string;
  example_hiragana: string;
  example_id: string;
  hint?: string;
  tags?: string[];
}

export interface RecallioBundleDeck {
  name: string;
  description: string;
  cards: RecallioBundleCard[];
}

export interface RecallioBundle {
  schema: 'recallio.deck-bundle';
  version: number;
  decks: RecallioBundleDeck[];
}


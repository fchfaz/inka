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


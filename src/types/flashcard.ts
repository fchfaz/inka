import type { Note, NoteType, Card, CardTemplate, CardSrs, CardState } from './models';
export type { Note, NoteType, Card, CardTemplate, CardSrs, CardState };

export interface Flashcard {
  id: string;
  noteId?: string;           // reference to Note if migrated or created in v4
  templateIdx?: number;      // index in NoteType templates
  front: string;             // Kanji / vocabulary di depan
  back: string;              // Hiragana / furigana
  meaning: string;           // Arti bahasa Indonesia
  example_jp: string;        // Contoh kalimat Jepang
  example_hiragana: string;  // Cara baca kalimat
  example_id: string;        // Terjemahan kalimat
  hint?: string;             // Petunjuk tambahan (opsional)
  extra?: string;            // Catatan / media tambahan, tampil di sisi belakang (opsional)
  tags?: string[];           // Kategori kosakata (opsional)
  createdAt: number;
  deckId: string;
  srs?: CardSrs;             // tidak ada = kartu baru
  suspended?: boolean;       // ditangguhkan (tidak muncul di antrean)
  buriedUntil?: string;      // studyDay 'YYYY-MM-DD' sampai kartu disembunyikan
  flag?: number;             // 0-7
  marked?: boolean;
}

export interface Deck {
  id: string;
  name: string;
  description: string;
  parentId?: string;         // ID deck induk (untuk hierarki A::B)
  presetId?: string;         // ID preset opsi belajar (StudySettings)
  createdAt: number;
}

export type ReviewRating = 1 | 2 | 3 | 4; // 1: Again, 2: Hard, 3: Good, 4: Easy

export interface ReviewLog {
  id?: number;
  cardId: string;
  deckId: string;
  ts: number;              // Date.now() saat menjawab
  studyDay: string;        // 'YYYY-MM-DD' dengan batas ganti hari sesuai pengaturan
  rating: ReviewRating;    // Again | Hard | Good | Easy
  scheduledDays?: number;  // interval (hari) hasil penjadwalan, 0 = di bawah sehari
  stateBefore?: CardState; // status kartu sebelum dijawab
  durationMs: number;      // waktu dari kartu tampil sampai jawaban, dibatasi maks 60000
  isFirstReview: boolean;  // true bila ini review pertama kartu tsb (dasar statistik "kartu baru")
}

/** Pengaturan belajar (berlaku untuk semua deck). */
export interface StudySettings {
  newPerDay: number;
  reviewsPerDay: number;
  desiredRetention: number;     // 0.7 - 0.99
  learningSteps: string[];      // contoh ['1m', '10m']
  relearningSteps: string[];    // contoh ['10m']
  maximumInterval: number;      // hari
  dayStartHour: number;         // jam pergantian hari 0-23
  leechThreshold: number;       // jumlah lapse sebelum kartu disuspend (0 = nonaktif)
  autoSpeak: boolean;           // bacakan kartu otomatis (TTS)
  soundEnabled: boolean;        // efek suara tombol
  soundVolume: number;          // 0 - 1
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

// JSON bundle exchange format (berbagi isi kartu, tanpa progres)
export interface RecallioBundleCard {
  id?: string;               // bila ada dan cocok dengan kartu di database, kartu diperbarui
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

/** Backup penuh: kartu + progres + riwayat review + pengaturan. */
export interface InkaBackup {
  schema: 'inka.backup';
  version: 1;
  exportedAt: number;
  decks: Deck[];
  cards: Flashcard[];
  revlog: ReviewLog[];
  settings: StudySettings;
}

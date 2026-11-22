import { openDB, type IDBPDatabase } from 'idb';
import type { Deck, Flashcard, ReviewLog, StudySettings } from '../types/flashcard';
import type { Note, NoteType } from '../types/models';
import { BUILTIN_NOTE_TYPES } from './template';
import { DEFAULT_SETTINGS } from '../types/flashcard';
import { answerCard } from './srs';
import { configureSfx } from './sfx';

// Nama database tetap 'recallio_db' agar data pengguna lama tidak hilang.
const DB_NAME = 'recallio_db';
const DB_VERSION = 4;

let dbPromise: Promise<IDBPDatabase> | null = null;

/** Koneksi dibuka sekali lalu dipakai ulang. */
export function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDbInternal().catch((err) => {
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

/** Hanya untuk pengujian: tutup dan lupakan koneksi. */
export async function resetDBConnection(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
    dbPromise = null;
  }
}

function openDbInternal(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, _newVersion, transaction) {
      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains('decks')) {
          const deckStore = db.createObjectStore('decks', { keyPath: 'id' });
          deckStore.createIndex('by-name', 'name');
        }

        if (!db.objectStoreNames.contains('cards')) {
          const cardStore = db.createObjectStore('cards', { keyPath: 'id' });
          cardStore.createIndex('by-deck', 'deckId');
        }

        if (!db.objectStoreNames.contains('schedules')) {
          // key is cardId (one active interval schedule per card)
          db.createObjectStore('schedules', { keyPath: 'cardId' });
        }

        if (!db.objectStoreNames.contains('session_state')) {
          db.createObjectStore('session_state');
        }
      }

      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains('revlog')) {
          const revStore = db.createObjectStore('revlog', { keyPath: 'id', autoIncrement: true });
          revStore.createIndex('by-ts', 'ts');
          revStore.createIndex('by-deck', 'deckId');
          revStore.createIndex('by-card', 'cardId');
          revStore.createIndex('by-studyDay', 'studyDay');
        }
      }

      if (oldVersion < 3) {
        // Berkas media kartu (gambar/audio/video), kunci = hash isi + ekstensi
        if (!db.objectStoreNames.contains('media')) {
          db.createObjectStore('media', { keyPath: 'key' });
        }
      }

      if (oldVersion < 4) {
        // v4: Store notes dan noteTypes
        if (!db.objectStoreNames.contains('noteTypes')) {
          db.createObjectStore('noteTypes', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('notes')) {
          const noteStore = db.createObjectStore('notes', { keyPath: 'id' });
          noteStore.createIndex('by-deck', 'deckId');
          noteStore.createIndex('by-notetype', 'noteTypeId');
        }

        // Tambah index pada cards untuk performa (state dan due)
        const cardStore = db.objectStoreNames.contains('cards')
          ? transaction.objectStore('cards')
          : db.createObjectStore('cards', { keyPath: 'id' });

        if (!cardStore.indexNames.contains('by-deck')) {
          cardStore.createIndex('by-deck', 'deckId');
        }
        if (!cardStore.indexNames.contains('by-note')) {
          cardStore.createIndex('by-note', 'noteId');
        }
        if (!cardStore.indexNames.contains('by-due')) {
          cardStore.createIndex('by-due', 'srs.due');
        }
        if (!cardStore.indexNames.contains('by-state')) {
          cardStore.createIndex('by-state', 'srs.state');
        }
      }
    },
  });
}

// Initial Sample Deck Loader
export async function initializeDefaultDeck(): Promise<void> {
  const db = await getDB();
  const deckCount = await db.count('decks');

  if (deckCount === 0) {
    const defaultDeckId = 'deck-n4-default';
    const defaultDeck: Deck = {
      id: defaultDeckId,
      name: 'Japanese N4 Vocabulary',
      description: 'Kosakata bahasa Jepang JLPT N4',
      createdAt: Date.now(),
    };
    await db.put('decks', defaultDeck);

    const initialCards: Flashcard[] = [
      {
        id: 'card-1',
        deckId: defaultDeckId,
        front: '水',
        back: 'みず',
        meaning: 'Air',
        example_jp: '水を飲みます。',
        example_hiragana: 'みずを のみます。',
        example_id: 'Saya minum air.',
        hint: '',
        tags: ['n4', 'noun'],
        createdAt: Date.now(),
      },
      {
        id: 'card-2',
        deckId: defaultDeckId,
        front: '食べる',
        back: 'たべる',
        meaning: 'Makan',
        example_jp: '毎日ご飯を食べます。',
        example_hiragana: 'まいにち ごはんを たべます。',
        example_id: 'Saya makan nasi setiap hari.',
        hint: '',
        tags: ['n4', 'verb'],
        createdAt: Date.now() + 1,
      },
      {
        id: 'card-3',
        deckId: defaultDeckId,
        front: '旅行',
        back: 'りょこう',
        meaning: 'Perjalanan / Wisata',
        example_jp: '日本へ旅行したいです。',
        example_hiragana: 'にほんへ りょこうしたいです。',
        example_id: 'Saya ingin berwisata ke Jepang.',
        hint: '',
        tags: ['n4', 'noun'],
        createdAt: Date.now() + 2,
      },
      {
        id: 'card-4',
        deckId: defaultDeckId,
        front: '車',
        back: 'くるま',
        meaning: 'Mobil / Kendaraan',
        example_jp: '新しい車を買いました。',
        example_hiragana: 'あたらしい くるまを かいました。',
        example_id: 'Saya membeli mobil baru.',
        hint: '',
        tags: ['n4', 'noun'],
        createdAt: Date.now() + 3,
      },
      {
        id: 'card-5',
        deckId: defaultDeckId,
        front: '本',
        back: 'ほん',
        meaning: 'Buku',
        example_jp: '図書館で本を借ります。',
        example_hiragana: 'としょかんで ほんを かります。',
        example_id: 'Saya meminjam buku di perpustakaan.',
        hint: '',
        tags: ['n4', 'noun'],
        createdAt: Date.now() + 4,
      },
      {
        id: 'card-6',
        deckId: defaultDeckId,
        front: '勉強する',
        back: 'べんきょうする',
        meaning: 'Belajar',
        example_jp: '毎晩日本語を勉強します。',
        example_hiragana: 'まいばん にほんごを べんきょうします。',
        example_id: 'Saya belajar bahasa Jepang setiap malam.',
        hint: '',
        tags: ['n4', 'verb'],
        createdAt: Date.now() + 5,
      }
    ];

    const tx = db.transaction('cards', 'readwrite');
    for (const card of initialCards) {
      await tx.store.put(card);
    }
    await tx.done;
  }
}

// Deck Operations
export async function getAllDecks(): Promise<Deck[]> {
  const db = await getDB();
  return db.getAll('decks');
}

export async function saveDeck(deck: Deck): Promise<void> {
  const db = await getDB();
  await db.put('decks', deck);
}

export async function deleteDeck(deckId: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['decks', 'cards', 'revlog'], 'readwrite');
  await tx.objectStore('decks').delete(deckId);

  const cardStore = tx.objectStore('cards');
  const cards = await cardStore.index('by-deck').getAll(deckId);
  for (const card of cards) {
    await cardStore.delete(card.id);
  }

  // Hapus riwayat review deck ini agar statistik tidak memuat data yatim.
  let cursor = await tx.objectStore('revlog').index('by-deck').openCursor(deckId);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }

  await tx.done;
}

// Flashcard Operations
export async function getCardsByDeck(deckId: string): Promise<Flashcard[]> {
  const db = await getDB();
  return db.getAllFromIndex('cards', 'by-deck', deckId);
}

export async function getAllCards(): Promise<Flashcard[]> {
  const db = await getDB();
  return db.getAll('cards');
}

export async function saveCard(card: Flashcard): Promise<void> {
  const db = await getDB();
  await db.put('cards', card);
}

export async function deleteCard(cardId: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['cards', 'notes'], 'readwrite');
  const cardStore = tx.objectStore('cards');
  const card: Flashcard | undefined = await cardStore.get(cardId);
  await cardStore.delete(cardId);

  // Jika kartu memiliki noteId dan tidak ada kartu lain untuk note tsb, hapus note
  if (card?.noteId) {
    const siblingCards = await cardStore.index('by-note').getAll(card.noteId);
    if (siblingCards.length === 0) {
      await tx.objectStore('notes').delete(card.noteId);
    }
  }
  await tx.done;
}

// ---------------------------------------------------------------------------
// Note & NoteType Operations (v4)
// ---------------------------------------------------------------------------
export async function getAllNoteTypes(): Promise<NoteType[]> {
  const db = await getDB();
  const noteTypes: NoteType[] = await db.getAll('noteTypes');
  if (noteTypes.length === 0) {
    // Inisialisasi default jika kosong
    const tx = db.transaction('noteTypes', 'readwrite');
    for (const nt of BUILTIN_NOTE_TYPES) {
      await tx.store.put(nt);
    }
    await tx.done;
    return BUILTIN_NOTE_TYPES;
  }
  return noteTypes;
}

export async function getNoteType(id: string): Promise<NoteType | undefined> {
  const db = await getDB();
  const nt = await db.get('noteTypes', id);
  if (!nt) {
    return BUILTIN_NOTE_TYPES.find((b) => b.id === id);
  }
  return nt;
}

export async function saveNoteType(noteType: NoteType): Promise<void> {
  const db = await getDB();
  await db.put('noteTypes', noteType);
}

export async function getNote(id: string): Promise<Note | undefined> {
  const db = await getDB();
  return db.get('notes', id);
}

export async function saveNote(note: Note): Promise<void> {
  const db = await getDB();
  await db.put('notes', note);
}

export async function deleteNote(noteId: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['notes', 'cards'], 'readwrite');
  await tx.objectStore('notes').delete(noteId);
  const cardStore = tx.objectStore('cards');
  const cards: Flashcard[] = await cardStore.index('by-note').getAll(noteId);
  for (const c of cards) {
    await cardStore.delete(c.id);
  }
  await tx.done;
}

// ---------------------------------------------------------------------------
// Hari belajar (batas pergantian hari bisa diatur, default 03:00)
// ---------------------------------------------------------------------------
let dayStartHour = DEFAULT_SETTINGS.dayStartHour;

export function setDayStartHour(hour: number): void {
  dayStartHour = Math.min(Math.max(Math.floor(hour), 0), 23);
}

export function getDayStartHour(): number {
  return dayStartHour;
}

/** Format 'YYYY-MM-DD' dengan batas pergantian hari sesuai pengaturan. */
export function getStudyDayString(date = new Date()): string {
  const adjusted = new Date(date.getTime() - dayStartHour * 60 * 60 * 1000);
  const y = adjusted.getFullYear();
  const m = String(adjusted.getMonth() + 1).padStart(2, '0');
  const d = String(adjusted.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ---------------------------------------------------------------------------
// Pengaturan
// ---------------------------------------------------------------------------
export async function getSettings(): Promise<StudySettings> {
  const db = await getDB();
  const stored = (await db.get('session_state', 'settings')) as Partial<StudySettings> | undefined;
  const settings: StudySettings = { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
  setDayStartHour(settings.dayStartHour);
  configureSfx({ enabled: settings.soundEnabled, volume: settings.soundVolume });
  return settings;
}

export async function saveSettings(settings: StudySettings): Promise<void> {
  const db = await getDB();
  await db.put('session_state', settings, 'settings');
  setDayStartHour(settings.dayStartHour);
  configureSfx({ enabled: settings.soundEnabled, volume: settings.soundVolume });
}

// ---------------------------------------------------------------------------
// Review log
// ---------------------------------------------------------------------------
export async function getDailyStudiedCount(): Promise<number> {
  const db = await getDB();
  return db.countFromIndex('revlog', 'by-studyDay', getStudyDayString());
}

export async function getReviewLogsForDay(studyDay: string, deckId?: string): Promise<ReviewLog[]> {
  const db = await getDB();
  const logs: ReviewLog[] = await db.getAllFromIndex('revlog', 'by-studyDay', studyDay);
  return deckId ? logs.filter((l) => l.deckId === deckId) : logs;
}

export type NewReviewLog = Omit<ReviewLog, 'id' | 'studyDay' | 'isFirstReview'>;

/**
 * Simpan kartu yang sudah dijadwalkan ulang beserta log-nya dalam satu transaksi,
 * sehingga keduanya selalu konsisten walau aplikasi tertutup di tengah jalan.
 */
export async function saveCardWithLog(card: Flashcard, log: NewReviewLog): Promise<ReviewLog> {
  const db = await getDB();
  const tx = db.transaction(['cards', 'revlog'], 'readwrite');
  const revStore = tx.objectStore('revlog');
  const existingCount = await revStore.index('by-card').count(log.cardId);

  const fullLog: ReviewLog = {
    ...log,
    studyDay: getStudyDayString(new Date(log.ts)),
    isFirstReview: existingCount === 0,
    durationMs: Math.min(Math.max(log.durationMs, 0), 60000),
  };
  await tx.objectStore('cards').put(card);
  const id = await revStore.add(fullLog);
  await tx.done;
  fullLog.id = Number(id);
  return fullLog;
}

/** Batalkan satu jawaban: kembalikan kartu ke keadaan sebelumnya dan hapus log-nya. */
export async function undoReview(previousCard: Flashcard, logId: number | undefined): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['cards', 'revlog'], 'readwrite');
  await tx.objectStore('cards').put(previousCard);
  if (logId !== undefined) await tx.objectStore('revlog').delete(logId);
  await tx.done;
}

/** Tambah log lepas (dipakai seed data dan pengujian). */
export async function addReviewLog(log: NewReviewLog): Promise<ReviewLog> {
  const db = await getDB();
  const studyDay = getStudyDayString(new Date(log.ts));
  const existingCount = await db.countFromIndex('revlog', 'by-card', log.cardId);
  const fullLog: ReviewLog = {
    ...log,
    studyDay,
    isFirstReview: existingCount === 0,
    durationMs: Math.min(Math.max(log.durationMs, 0), 60000),
  };
  const id = await db.add('revlog', fullLog);
  fullLog.id = Number(id);
  return fullLog;
}

export async function getAllReviewLogs(deckId?: string, minTs?: number): Promise<ReviewLog[]> {
  const db = await getDB();
  if (minTs !== undefined) {
    const range = IDBKeyRange.lowerBound(minTs);
    const logs: ReviewLog[] = await db.getAllFromIndex('revlog', 'by-ts', range);
    if (deckId) {
      return logs.filter(l => l.deckId === deckId);
    }
    return logs;
  }

  if (deckId) {
    return db.getAllFromIndex('revlog', 'by-deck', deckId);
  }

  return db.getAll('revlog');
}

export async function clearAllReviewLogs(): Promise<void> {
  const db = await getDB();
  await db.clear('revlog');
}

/**
 * Seed dummy review logs for development and visual testing of Statistics dashboard
 */
export async function seedDummyReviewLogs(targetDeckId: string, cards: Flashcard[]): Promise<number> {
  const db = await getDB();
  if (cards.length === 0) return 0;

  const tx = db.transaction('revlog', 'readwrite');
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  let seeded = 0;

  // Generate reviews across the past 90 days with realistic distribution
  for (let d = 90; d >= 0; d--) {
    // Some days skipped (85% active days)
    if (Math.random() < 0.15 && d > 2) continue;

    const reviewsToday = Math.floor(10 + Math.random() * 45); // 10 - 55 reviews
    const baseDayTime = now - d * dayMs;

    for (let i = 0; i < reviewsToday; i++) {
      // Pick random hour: peaks in morning 8-10 and evening 19-23
      let hour = 20;
      const r = Math.random();
      if (r < 0.25) hour = 8 + Math.floor(Math.random() * 3);
      else if (r < 0.4) hour = 12 + Math.floor(Math.random() * 3);
      else hour = 18 + Math.floor(Math.random() * 5);

      const reviewTs = baseDayTime + hour * 3600000 + Math.floor(Math.random() * 3600000);
      const randomCard = cards[Math.floor(Math.random() * cards.length)];

      // Rating distribution: Again 15%, Hard 20%, Good 45%, Easy 20%
      let rating: 1 | 2 | 3 | 4 = 3;
      const rateRoll = Math.random();
      if (rateRoll < 0.15) rating = 1;
      else if (rateRoll < 0.35) rating = 2;
      else if (rateRoll < 0.8) rating = 3;
      else rating = 4;

      const days: Record<number, number> = { 1: 0, 2: 1, 3: 4, 4: 10 };
      const durationMs = Math.floor(2000 + Math.random() * 7000); // 2 - 9 seconds

      const logItem: ReviewLog = {
        cardId: randomCard.id,
        deckId: targetDeckId,
        ts: reviewTs,
        studyDay: getStudyDayString(new Date(reviewTs)),
        rating,
        scheduledDays: days[rating],
        durationMs,
        isFirstReview: d > 60 && Math.random() < 0.4,
      };

      await tx.store.add(logItem);
      seeded++;
    }
  }

  await tx.done;
  return seeded;
}

// ---------------------------------------------------------------------------
// Migrasi ke v4 (Note, NoteType, Card)
// ---------------------------------------------------------------------------
const MIGRATION_V4_FLAG = 'migrated_notes_v4';

export async function migrateV4Notes(): Promise<number> {
  const db = await getDB();
  if (await db.get('session_state', MIGRATION_V4_FLAG)) return 0;

  // Pastikan noteTypes standar ada
  const ntTx = db.transaction('noteTypes', 'readwrite');
  for (const nt of BUILTIN_NOTE_TYPES) {
    await ntTx.store.put(nt);
  }
  await ntTx.done;

  const cards: Flashcard[] = await db.getAll('cards');
  const tx = db.transaction(['cards', 'notes', 'session_state'], 'readwrite');
  const cardStore = tx.objectStore('cards');
  const noteStore = tx.objectStore('notes');
  let migrated = 0;

  for (const c of cards) {
    if (c.noteId) continue;
    const noteId = `note-${c.id}`;
    const note: Note = {
      id: noteId,
      noteTypeId: 'builtin-japanese-vocab',
      deckId: c.deckId,
      fields: {
        Front: c.front || '',
        Back: c.back || '',
        Meaning: c.meaning || '',
        Example_JP: c.example_jp || '',
        Example_Hiragana: c.example_hiragana || '',
        Example_ID: c.example_id || '',
        Hint: c.hint || '',
        Extra: c.extra || '',
      },
      tags: c.tags || [],
      createdAt: c.createdAt || Date.now(),
    };
    await noteStore.put(note);

    const updatedCard: Flashcard = {
      ...c,
      noteId,
      templateIdx: 0,
    };
    await cardStore.put(updatedCard);
    migrated++;
  }

  await tx.objectStore('session_state').put(true, MIGRATION_V4_FLAG);
  await tx.done;
  return migrated;
}

// ---------------------------------------------------------------------------
// Migrasi dari penjadwal "interval kartu" lama ke FSRS
// ---------------------------------------------------------------------------
const MIGRATION_FLAG = 'migrated_fsrs_v1';

/**
 * Hitung ulang status FSRS tiap kartu dengan memutar ulang riwayat review lamanya,
 * lalu buang data jadwal berbasis hitungan kartu. Hanya berjalan sekali.
 */
export async function migrateLegacyProgress(settings: StudySettings = DEFAULT_SETTINGS): Promise<number> {
  const db = await getDB();
  if (await db.get('session_state', MIGRATION_FLAG)) return 0;

  const logs: ReviewLog[] = await db.getAll('revlog');
  const byCard = new Map<string, ReviewLog[]>();
  for (const l of logs) {
    const list = byCard.get(l.cardId);
    if (list) list.push(l);
    else byCard.set(l.cardId, [l]);
  }

  const noLeech: StudySettings = { ...settings, leechThreshold: 0 };
  const tx = db.transaction(['cards', 'schedules', 'session_state'], 'readwrite');
  const cardStore = tx.objectStore('cards');
  let migrated = 0;

  for (const [cardId, list] of byCard) {
    const card: Flashcard | undefined = await cardStore.get(cardId);
    if (!card || card.srs) continue;
    list.sort((a, b) => a.ts - b.ts);
    let replayed: Flashcard = card;
    for (const l of list) {
      replayed = answerCard(replayed, l.rating, noLeech, new Date(l.ts)).card;
    }
    await cardStore.put(replayed);
    migrated++;
  }

  await tx.objectStore('schedules').clear();
  const keys = await tx.objectStore('session_state').getAllKeys();
  for (const k of keys) {
    if (typeof k === 'string' && (k.startsWith('counter_') || k.startsWith('daily_studied_'))) {
      await tx.objectStore('session_state').delete(k);
    }
  }
  await tx.objectStore('session_state').put(true, MIGRATION_FLAG);
  await tx.done;
  return migrated;
}

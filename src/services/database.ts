import { openDB, type IDBPDatabase } from 'idb';
import type { Deck, Flashcard, ScheduledInterval, ReviewLog } from '../types/flashcard';

const DB_NAME = 'recallio_db';
const DB_VERSION = 2;

export async function getDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
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
  const tx = db.transaction(['decks', 'cards', 'schedules'], 'readwrite');
  await tx.objectStore('decks').delete(deckId);

  // Delete all cards in deck
  const cards = await tx.objectStore('cards').index('by-deck').getAll(deckId);
  for (const card of cards) {
    await tx.objectStore('cards').delete(card.id);
    await tx.objectStore('schedules').delete(card.id);
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
  const tx = db.transaction(['cards', 'schedules'], 'readwrite');
  await tx.objectStore('cards').delete(cardId);
  await tx.objectStore('schedules').delete(cardId);
  await tx.done;
}

// Schedule Operations (3, 5, 30, 50 card interval scheduler)
export async function getSchedules(): Promise<Record<string, ScheduledInterval>> {
  const db = await getDB();
  const list: ScheduledInterval[] = await db.getAll('schedules');
  const map: Record<string, ScheduledInterval> = {};
  for (const item of list) {
    map[item.cardId] = item;
  }
  return map;
}

export async function saveSchedule(schedule: ScheduledInterval): Promise<void> {
  const db = await getDB();
  await db.put('schedules', schedule);
}

export async function removeSchedule(cardId: string): Promise<void> {
  const db = await getDB();
  await db.delete('schedules', cardId);
}

export async function getSessionCounter(deckId: string): Promise<number> {
  const db = await getDB();
  const count = await db.get('session_state', `counter_${deckId}`);
  return count ? Number(count) : 0;
}

export async function saveSessionCounter(deckId: string, counter: number): Promise<void> {
  const db = await getDB();
  await db.put('session_state', counter, `counter_${deckId}`);
}

/**
 * Formats a timestamp/date into 'YYYY-MM-DD' with 03:00 AM day boundary cutoff.
 */
export function getStudyDayString(date = new Date()): string {
  const adjusted = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  const y = adjusted.getFullYear();
  const m = String(adjusted.getMonth() + 1).padStart(2, '0');
  const d = String(adjusted.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Calculates current "study day key" that resets at 03:00 AM every day.
 * Example: If now is Nov 8 at 02:30 AM -> belongs to Nov 7 study day.
 * If now is Nov 8 at 03:00 AM or 10:00 PM -> belongs to Nov 8 study day.
 */
export function getDailyStudyKey(date = new Date()): string {
  return `daily_studied_${getStudyDayString(date)}`;
}

export async function getDailyStudiedCount(): Promise<number> {
  const db = await getDB();
  const key = getDailyStudyKey();
  const count = await db.get('session_state', key);
  return count ? Number(count) : 0;
}

export async function incrementDailyStudiedCount(): Promise<number> {
  const db = await getDB();
  const key = getDailyStudyKey();
  const current = (await db.get('session_state', key)) || 0;
  const next = Number(current) + 1;
  await db.put('session_state', next, key);
  return next;
}

// Review Log Operations
export async function addReviewLog(log: Omit<ReviewLog, 'id' | 'studyDay' | 'isFirstReview'>): Promise<ReviewLog> {
  const db = await getDB();
  const studyDay = getStudyDayString(new Date(log.ts));

  // Determine if this is the first review for this card
  const existingCount = await db.countFromIndex('revlog', 'by-card', log.cardId);
  const isFirstReview = existingCount === 0;

  const fullLog: ReviewLog = {
    ...log,
    studyDay,
    isFirstReview,
    durationMs: Math.min(Math.max(log.durationMs, 0), 60000), // Bound 0 - 60s
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

      const intervals: Record<number, 3 | 5 | 30 | 50> = { 1: 3, 2: 5, 3: 30, 4: 50 };
      const durationMs = Math.floor(2000 + Math.random() * 7000); // 2 - 9 seconds

      const logItem: ReviewLog = {
        cardId: randomCard.id,
        deckId: targetDeckId,
        ts: reviewTs,
        studyDay: getStudyDayString(new Date(reviewTs)),
        rating,
        interval: intervals[rating],
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

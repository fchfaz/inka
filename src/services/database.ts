import { openDB, type IDBPDatabase } from 'idb';
import type { Deck, Flashcard, ScheduledInterval } from '../types/flashcard';

const DB_NAME = 'recallio_db';
const DB_VERSION = 1;

export async function getDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
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
 * Calculates current "study day key" that resets at 03:00 AM every day.
 * Example: If now is Nov 8 at 02:30 AM -> belongs to Nov 7 study day.
 * If now is Nov 8 at 03:00 AM or 10:00 PM -> belongs to Nov 8 study day.
 */
export function getDailyStudyKey(date = new Date()): string {
  const adjusted = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  const y = adjusted.getFullYear();
  const m = String(adjusted.getMonth() + 1).padStart(2, '0');
  const d = String(adjusted.getDate()).padStart(2, '0');
  return `daily_studied_${y}-${m}-${d}`;
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

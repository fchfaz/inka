import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import {
  getDB,
  resetDBConnection,
  saveDeck,
  saveCard,
  getAllDecks,
  getAllCards,
  getCardsByDeck,
  deleteDeck,
  saveCardWithLog,
  undoReview,
  addReviewLog,
  getAllReviewLogs,
  getReviewLogsForDay,
  getStudyDayString,
  setDayStartHour,
  getSettings,
  saveSettings,
  migrateLegacyProgress,
  migrateV4Notes,
  getAllNoteTypes,
  getNote,
} from './database';
import {
  importRecallioBundle,
  validateRecallioBundle,
  exportRecallioBundle,
  parseDelimited,
  parseCardsFromText,
  importCardsFromText,
  exportFullBackup,
  restoreFullBackup,
  validateFullBackup,
} from './importExport';
import { answerCard } from './srs';
import { DEFAULT_SETTINGS, type Flashcard, type RecallioBundle } from '../types/flashcard';

function card(id: string, deckId = 'd1', extra: Partial<Flashcard> = {}): Flashcard {
  return {
    id, deckId, front: `front-${id}`, back: `back-${id}`, meaning: `mean-${id}`,
    example_jp: '', example_hiragana: '', example_id: '', createdAt: 1, ...extra,
  };
}

beforeEach(async () => {
  await resetDBConnection();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).indexedDB = new IDBFactory();
  setDayStartHour(3);
});

describe('deleteDeck', () => {
  it('menghapus kartu, riwayat review, dan state deck itu saja', async () => {
    await saveDeck({ id: 'd1', name: 'A', description: '', createdAt: 1 });
    await saveDeck({ id: 'd2', name: 'B', description: '', createdAt: 1 });
    await saveCard(card('c1', 'd1'));
    await saveCard(card('c2', 'd2'));
    await addReviewLog({ cardId: 'c1', deckId: 'd1', ts: Date.now(), rating: 3, durationMs: 1000 });
    await addReviewLog({ cardId: 'c2', deckId: 'd2', ts: Date.now(), rating: 3, durationMs: 1000 });

    await deleteDeck('d1');

    expect((await getAllDecks()).map((d) => d.id)).toEqual(['d2']);
    expect((await getAllCards()).map((c) => c.id)).toEqual(['c2']);
    const logs = await getAllReviewLogs();
    expect(logs.map((l) => l.cardId)).toEqual(['c2']);
  });
});

describe('saveCardWithLog + undoReview', () => {
  it('menyimpan kartu dan log bersamaan, dan undo mengembalikan keduanya', async () => {
    await saveDeck({ id: 'd1', name: 'A', description: '', createdAt: 1 });
    const original = card('c1');
    await saveCard(original);
    const res = answerCard(original, 3, DEFAULT_SETTINGS, new Date());
    const log = await saveCardWithLog(res.card, {
      cardId: 'c1', deckId: 'd1', ts: Date.now(), rating: 3, scheduledDays: 0, stateBefore: 0, durationMs: 2500,
    });
    expect(log.id).toBeDefined();
    expect(log.isFirstReview).toBe(true);
    expect((await getCardsByDeck('d1'))[0].srs?.state).toBe(1);
    expect(await getAllReviewLogs()).toHaveLength(1);

    await undoReview(original, log.id);
    expect((await getCardsByDeck('d1'))[0].srs).toBeUndefined();
    expect(await getAllReviewLogs()).toHaveLength(0);
  });

  it('log kedua untuk kartu yang sama bukan review pertama', async () => {
    await saveCard(card('c1'));
    const a = await saveCardWithLog(card('c1'), { cardId: 'c1', deckId: 'd1', ts: Date.now(), rating: 3, durationMs: 1 });
    const b = await saveCardWithLog(card('c1'), { cardId: 'c1', deckId: 'd1', ts: Date.now(), rating: 3, durationMs: 1 });
    expect(a.isFirstReview).toBe(true);
    expect(b.isFirstReview).toBe(false);
  });

  it('durasi dibatasi 60 detik dan log muncul di hari belajar yang benar', async () => {
    await saveCard(card('c1'));
    const log = await saveCardWithLog(card('c1'), { cardId: 'c1', deckId: 'd1', ts: Date.now(), rating: 2, durationMs: 999999 });
    expect(log.durationMs).toBe(60000);
    expect(await getReviewLogsForDay(getStudyDayString(), 'd1')).toHaveLength(1);
  });
});

describe('hari belajar & pengaturan', () => {
  it('jam pergantian hari mempengaruhi studyDay', () => {
    const t = new Date(2026, 2, 10, 2, 30); 
    setDayStartHour(3);
    expect(getStudyDayString(t)).toBe('2026-03-09');
    setDayStartHour(0);
    expect(getStudyDayString(t)).toBe('2026-03-10');
  });

  it('pengaturan tersimpan dan diterapkan ke jam pergantian hari', async () => {
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
    await saveSettings({ ...DEFAULT_SETTINGS, newPerDay: 7, dayStartHour: 5 });
    setDayStartHour(3);
    const s = await getSettings();
    expect(s.newPerDay).toBe(7);
    expect(getStudyDayString(new Date(2026, 2, 10, 4, 0))).toBe('2026-03-09');
  });
});

describe('migrateLegacyProgress', () => {
  it('memutar ulang riwayat lama menjadi status FSRS, sekali saja', async () => {
    await saveDeck({ id: 'd1', name: 'A', description: '', createdAt: 1 });
    await saveCard(card('old'));
    await saveCard(card('never'));
    const base = Date.now() - 5 * 86400_000;
    await addReviewLog({ cardId: 'old', deckId: 'd1', ts: base, rating: 4, durationMs: 1 });
    await addReviewLog({ cardId: 'old', deckId: 'd1', ts: base + 3 * 86400_000, rating: 3, durationMs: 1 });
    const db = await getDB();
    await db.put('schedules', { cardId: 'old', targetQueueIndex: 5, intervalCards: 3, scheduledAt: 1 });
    await db.put('session_state', 12, 'counter_d1');

    expect(await migrateLegacyProgress()).toBe(1);

    const cards = await getAllCards();
    const old = cards.find((c) => c.id === 'old')!;
    const never = cards.find((c) => c.id === 'never')!;
    expect(old.srs?.state).toBe(2);
    expect(old.srs?.reps).toBe(2);
    expect(never.srs).toBeUndefined();
    expect(await db.count('schedules')).toBe(0);
    expect(await db.get('session_state', 'counter_d1')).toBeUndefined();

    expect(await migrateLegacyProgress()).toBe(0);
  });
});

describe('importRecallioBundle', () => {
  const bundle = (): RecallioBundle => ({
    schema: 'recallio.deck-bundle',
    version: 1,
    decks: [
      {
        name: 'N5',
        description: 'x',
        cards: [
          { front: '水', back: 'みず', meaning: 'Air', example_jp: '', example_hiragana: '', example_id: '' },
          { front: '火', back: 'ひ', meaning: 'Api', example_jp: '', example_hiragana: '', example_id: '' },
        ],
      },
    ],
  });

  it('impor ulang file yang sama tidak menggandakan deck maupun kartu', async () => {
    const r1 = await importRecallioBundle(bundle());
    expect(r1).toMatchObject({ decksCreated: 1, cardsAdded: 2, cardsSkipped: 0 });
    const r2 = await importRecallioBundle(bundle());
    expect(r2).toMatchObject({ decksCreated: 0, cardsAdded: 0, cardsSkipped: 2 });
    expect(await getAllDecks()).toHaveLength(1);
    expect(await getAllCards()).toHaveLength(2);
  });

  it('mengedit hasil ekspor memperbarui kartu di tempat dan mempertahankan progres', async () => {
    await importRecallioBundle(bundle());
    const [first] = await getAllCards();
    const progressed = answerCard(first, 4, DEFAULT_SETTINGS, new Date()).card;
    await saveCard(progressed);

    const exported = await exportRecallioBundle();
    const target = exported.decks[0].cards.find((c) => c.id === first.id)!;
    target.meaning = 'Air putih';
    const r = await importRecallioBundle(exported);
    expect(r.cardsUpdated).toBe(1);
    expect(r.cardsAdded).toBe(0);

    const after = (await getAllCards()).find((c) => c.id === first.id)!;
    expect(after.meaning).toBe('Air putih');
    expect(after.srs?.state).toBe(2);
    expect(await getAllCards()).toHaveLength(2);
  });

  it('atomik: bundle dengan data yang membuat transaksi gagal tidak meninggalkan setengah data', async () => {
    const bad = bundle();
    // @ts-expect-error sengaja merusak agar put() melempar saat serialisasi
    bad.decks[0].cards[1].tags = { toJSON() { throw new Error('boom'); }, bad: () => 1 };
    await expect(importRecallioBundle(bad)).rejects.toBeDefined();
    expect(await getAllCards()).toHaveLength(0);
    expect(await getAllDecks()).toHaveLength(0);
  });

  it('validateRecallioBundle menolak tags bukan array', () => {
    const b = bundle();
    // @ts-expect-error uji input salah
    b.decks[0].cards[0].tags = 'n5';
    expect(validateRecallioBundle(b).valid).toBe(false);
  });
});

describe('CSV/TSV', () => {
  it('parseDelimited menangani kutip, koma, dan newline dalam sel', () => {
    const rows = parseDelimited('a,"b,1","c ""q"""\n"x\ny",2,3\n', ',');
    expect(rows).toEqual([['a', 'b,1', 'c "q"'], ['x\ny', '2', '3']]);
  });

  it('parseCardsFromText melewati header # Anki dan membersihkan HTML', () => {
    const text = '#separator:tab\n#html:true\n水\tみず\t<b>Air</b>\t水を飲む\tみずをのむ\tMinum air\t\tn5 noun\n';
    const cards = parseCardsFromText(text);
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ front: '水', back: 'みず', meaning: 'Air', tags: ['n5', 'noun'] });
  });

  it('importCardsFromText memasukkan ke deck tujuan dan melewati duplikat', async () => {
    await saveDeck({ id: 'd1', name: 'A', description: '', createdAt: 1 });
    const text = '水,みず,Air\n火,ひ,Api\n';
    const r1 = await importCardsFromText(text, 'd1');
    expect(r1.cardsAdded).toBe(2);
    const r2 = await importCardsFromText(text, 'd1');
    expect(r2.cardsAdded).toBe(0);
    expect(r2.cardsSkipped).toBe(2);
    expect(await getCardsByDeck('d1')).toHaveLength(2);
    await expect(importCardsFromText('', 'd1')).rejects.toThrow();
    await expect(importCardsFromText(text, 'nope')).rejects.toThrow();
  });
});

describe('backup penuh', () => {
  it('ekspor lalu pulihkan mengembalikan kartu, progres, riwayat, dan pengaturan', async () => {
    await saveDeck({ id: 'd1', name: 'A', description: '', createdAt: 1 });
    const c = card('c1');
    await saveCard(c);
    const res = answerCard(c, 4, DEFAULT_SETTINGS, new Date());
    await saveCardWithLog(res.card, { cardId: 'c1', deckId: 'd1', ts: Date.now(), rating: 4, stateBefore: 0, durationMs: 100 });
    await saveSettings({ ...DEFAULT_SETTINGS, newPerDay: 9 });

    const backup = JSON.parse(JSON.stringify(await exportFullBackup()));
    expect(validateFullBackup(backup).valid).toBe(true);

    
    await deleteDeck('d1');
    await saveDeck({ id: 'zzz', name: 'Z', description: '', createdAt: 1 });
    await restoreFullBackup(backup);

    expect((await getAllDecks()).map((d) => d.id)).toEqual(['d1']);
    expect((await getAllCards())[0].srs?.state).toBe(2);
    expect(await getAllReviewLogs()).toHaveLength(1);
    expect((await getSettings()).newPerDay).toBe(9);
    
    expect(await migrateLegacyProgress()).toBe(0);
  });

  it('validateFullBackup menolak file yang salah', () => {
    expect(validateFullBackup({ schema: 'recallio.deck-bundle' }).valid).toBe(false);
    expect(validateFullBackup(null).valid).toBe(false);
    expect(validateFullBackup({ schema: 'inka.backup', version: 1, decks: [] }).valid).toBe(false);
  });
});

describe('migrasi v4: Note, NoteType, Card', () => {
  it('berhasil memigrasi kartu lama ke Note (Japanese Vocab) dan mengisi noteTypes bawaan', async () => {
    await saveDeck({ id: 'd1', name: 'Deck 1', description: '', createdAt: 1 });
    const c1 = card('card-old-1', 'd1', {
      front: '本',
      back: 'ほん',
      meaning: 'Buku',
      example_jp: '本を読みます。',
      tags: ['n5'],
    });
    await saveCard(c1);

    const migratedCount = await migrateV4Notes();
    expect(migratedCount).toBe(1);

    const allCards = await getAllCards();
    expect(allCards[0].noteId).toBe('note-card-old-1');
    expect(allCards[0].templateIdx).toBe(0);

    const note = await getNote('note-card-old-1');
    expect(note).toBeDefined();
    expect(note?.noteTypeId).toBe('builtin-japanese-vocab');
    expect(note?.fields['Front']).toBe('本');
    expect(note?.fields['Meaning']).toBe('Buku');
    expect(note?.tags).toEqual(['n5']);

    const noteTypes = await getAllNoteTypes();
    expect(noteTypes.length).toBeGreaterThanOrEqual(5);

    
    expect(await migrateV4Notes()).toBe(0);
  });
});

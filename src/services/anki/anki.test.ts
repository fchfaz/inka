import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { readFileSync } from 'node:fs';
import { zipSync, strToU8 } from 'fflate';
import { resolve } from 'node:path';
import { readAnkiPackage, AnkiImportError, type AnkiCard } from './apkg';
import { convertPackage, convertScheduling, guessMapping, renderCloze, type ConvertOptions, type NotetypeMapping } from './convert';
import { importAnkiPackage } from './importer';
import { getAllCards, getAllDecks, getAllReviewLogs, getStudyDayString, resetDBConnection } from '../database';
import { getMediaStats, pruneUnusedMedia } from '../media';
import { DEFAULT_SETTINGS } from '../../types/flashcard';

const fx = (n: string) => new Uint8Array(readFileSync(resolve(__dirname, '__fixtures__', n)));

async function optionsFor(bytes: Uint8Array, over: Partial<ConvertOptions> = {}) {
  const pkg = await readAnkiPackage(bytes);
  const mappings: Record<string, NotetypeMapping> = {};
  for (const nt of pkg.notetypes.values()) mappings[nt.id] = guessMapping(nt);
  const opts: ConvertOptions = {
    mappings, includeProgress: true, includeMedia: true, deckMode: 'keep',
    settings: DEFAULT_SETTINGS, studyDayOf: (ts) => getStudyDayString(new Date(ts)), ...over,
  };
  return { pkg, opts };
}

beforeEach(async () => {
  await resetDBConnection();
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

describe('pembaca paket', () => {
  it.each(['plain-latest.apkg', 'fsrs-latest.apkg', 'fsrs-latest.colpkg', 'plain-legacy.apkg', 'fsrs-legacy.apkg', 'fsrs-nosched.apkg'])(
    'membaca %s', async (f) => {
      const pkg = await readAnkiPackage(fx(f));
      expect(pkg.notes).toHaveLength(8);
      expect(pkg.cards).toHaveLength(10);
      expect(pkg.decks.size).toBeGreaterThan(1);
    });

  it('format terdeteksi benar', async () => {
    expect((await readAnkiPackage(fx('fsrs-latest.apkg'))).format).toBe('latest');
    expect((await readAnkiPackage(fx('fsrs-legacy.apkg'))).format).toBe('legacy2');
  });

  it('media terbaca dan dekompresi benar (latest & legacy)', async () => {
    for (const f of ['fsrs-latest.apkg', 'fsrs-legacy.apkg']) {
      const pkg = await readAnkiPackage(fx(f));
      expect(pkg.mediaEntries.length).toBe(5);
      const m = pkg.loadMedia(pkg.mediaEntries.map((e) => e.name));
      expect(m.size).toBe(5);
      for (const [name, bytes] of m) {
        expect(bytes.length, name).toBeGreaterThan(0);
        if (name.endsWith('.png')) expect([...bytes.slice(1, 4)]).toEqual([0x50, 0x4e, 0x47]);
      }
    }
  });

  it('galat dengan pesan ramah: bukan zip, zip kosong, zip rusak, db rusak', async () => {
    await expect(readAnkiPackage(strToU8('halo'))).rejects.toMatchObject({ code: 'not-zip' });
    await expect(readAnkiPackage(zipSync({ 'foo.txt': strToU8('x') }))).rejects.toMatchObject({ code: 'no-collection' });
    await expect(readAnkiPackage(zipSync({ 'collection.anki2': strToU8('bukan sqlite') }))).rejects.toMatchObject({ code: 'corrupt' });
    const trunc = fx('plain-latest.apkg').slice(0, 5000);
    await expect(readAnkiPackage(trunc)).rejects.toBeInstanceOf(AnkiImportError);
  });
});

describe('konversi', () => {
  it('cloze dirender per nomor', () => {
    const r = renderCloze('{{c1::猫::neko}} dan {{c2::犬}}', 1);
    expect(r.question).toBe('<b>[neko]</b> dan 犬');
    expect(r.answer).toBe('<b>猫</b> dan 犬');
  });

  it('tebakan pemetaan field kosakata Jepang', async () => {
    const pkg = await readAnkiPackage(fx('fsrs-latest.apkg'));
    const nt = [...pkg.notetypes.values()].find((n) => n.name === 'Japanese Vocab')!;
    const g = guessMapping(nt).mapping;
    expect(g.front).toEqual(['Expression']);
    expect(g.back).toEqual(['Reading']);
    expect(g.meaning).toEqual(['Meaning']);
    expect(g.example_jp).toEqual(['Sentence']);
    expect(g.example_hiragana).toEqual(['SentenceReading']);
    expect(g.example_id).toEqual(['SentenceMeaning']);
    expect(g.hint).toEqual(['Hint']);
    expect(g.extra).toEqual(expect.arrayContaining(['Audio', 'Clip']));
  });

  it('tidak ada token media yatim dan HTML berbahaya hilang', async () => {
    const { pkg, opts } = await optionsFor(fx('fsrs-latest.apkg'));
    const keys = new Map<string, string>();
    const res = convertPackage(pkg, opts, (n) => (/\.(png|jpe?g)$/i.test(n) ? { kind: 'img', key: 'k-' + n } : /\.(mp3|ogg|wav)$/i.test(n) ? { kind: 'sound', key: 'k-' + n } : /\.(mp4|webm)$/i.test(n) ? { kind: 'video', key: 'k-' + n } : null));
    expect(keys.size).toBe(0);
    for (const c of res.cards) {
      const all = Object.values(c.card).join('\n');
      expect(all).not.toMatch(/<script|<img|onerror|<iframe/i);
    }
    expect(res.cards.length).toBeGreaterThan(0);
  });
});

describe('impor ke database', () => {
  it('impor penuh: deck berhirarki, kartu, progres FSRS, riwayat, media', async () => {
    const { pkg, opts } = await optionsFor(fx('fsrs-latest.apkg'));
    const s = await importAnkiPackage(pkg, opts);
    const cards = await getAllCards();
    const decks = await getAllDecks();
    expect(s.cardsAdded).toBe(cards.length);
    expect(cards.length + s.emptyCards + s.skippedNotetypes.reduce((a, b) => a + b.cards, 0)).toBe(10);
    expect(decks.map((d) => d.name)).toEqual(expect.arrayContaining(['Japanese::N5::Vocab', 'Japanese::Anime']));
    expect(cards.some((c) => c.srs && c.srs.state === 1)).toBe(true);
    expect(cards.every((c) => !c.srs || (c.srs.stability > 0 && c.srs.difficulty >= 1 && c.srs.difficulty <= 10))).toBe(true);
    expect(s.logsAdded).toBeGreaterThan(0);
    expect((await getAllReviewLogs()).length).toBe(s.logsAdded);
    expect(s.mediaStored).toBeGreaterThan(0);
    expect((await getMediaStats()).count).toBe(s.mediaStored);
    expect(s.mediaMissing).toContain('hilang.png'); // sengaja dirujuk fixture tapi tidak ada di paket
    expect(s.mediaSkipped).toEqual([]);
  });

  it('idempoten: impor ulang tidak menggandakan kartu, deck, riwayat, media', async () => {
    const { pkg, opts } = await optionsFor(fx('fsrs-latest.apkg'));
    const a = await importAnkiPackage(pkg, opts);
    const b = await importAnkiPackage(pkg, opts);
    expect(b.cardsAdded).toBe(0);
    expect(b.cardsSkipped).toBe(a.cardsAdded);
    expect(b.decksCreated).toBe(0);
    expect(b.logsAdded).toBe(0);
    expect(b.mediaStored).toBe(0);
    expect((await getAllCards()).length).toBe(a.cardsAdded);
  });

  it('format lain menghasilkan kartu yang sama (latest vs legacy)', async () => {
    const one = await optionsFor(fx('fsrs-latest.apkg'));
    const two = await optionsFor(fx('fsrs-legacy.apkg'));
    const ra = convertPackage(one.pkg, one.opts, () => null);
    const rb = convertPackage(two.pkg, two.opts, () => null);
    const sig = (r: typeof ra) => r.cards.map((c) => [c.card.id, c.card.front, c.card.meaning, c.deckName].join('|')).sort();
    expect(sig(rb)).toEqual(sig(ra));
  });

  it('tanpa progres / tanpa media / satu deck', async () => {
    const { pkg, opts } = await optionsFor(fx('fsrs-latest.apkg'), { includeProgress: false, includeMedia: false, deckMode: 'single', singleDeckName: 'Gabungan' });
    const s = await importAnkiPackage(pkg, opts);
    const cards = await getAllCards();
    expect(cards.every((c) => !c.srs)).toBe(true);
    expect(s.logsAdded).toBe(0);
    expect(s.mediaStored).toBe(0);
    expect((await getAllDecks()).filter((d) => d.name === 'Gabungan')).toHaveLength(1);
    expect(cards.every((c) => !/\[(img|sound|video):/.test(Object.values(c).join('\n')))).toBe(true);
  });

  it('paket tanpa data jadwal tetap bisa diimpor', async () => {
    const { pkg, opts } = await optionsFor(fx('fsrs-nosched.apkg'));
    const s = await importAnkiPackage(pkg, opts);
    expect(s.cardsAdded).toBeGreaterThan(0);
    expect(s.logsAdded).toBe(0);
  });

  it('atomik: gagal di tengah transaksi tidak menyisakan deck/kartu', async () => {
    const { pkg, opts } = await optionsFor(fx('fsrs-latest.apkg'));
    const ctrl = new AbortController();
    const prog: string[] = [];
    await expect(
      importAnkiPackage(pkg, { ...opts, studyDayOf: () => { throw new Error('boom'); } }, (p) => prog.push(p.phase), ctrl.signal)
    ).rejects.toThrow();
    expect((await getAllCards()).length).toBe(0);
    expect((await getAllDecks()).filter((d) => d.name.startsWith('Japanese')).length).toBe(0);
    expect((await getMediaStats()).count).toBe(0); // media yatim dibersihkan
  });

  it('dibatalkan sebelum menulis kartu', async () => {
    const { pkg, opts } = await optionsFor(fx('fsrs-latest.apkg'));
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(importAnkiPackage(pkg, opts, undefined, ctrl.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect((await getAllCards()).length).toBe(0);
  });

  it('prune media menghapus yang tak dirujuk', async () => {
    const { pkg, opts } = await optionsFor(fx('fsrs-latest.apkg'));
    await importAnkiPackage(pkg, opts);
    const before = (await getMediaStats()).count;
    expect((await pruneUnusedMedia()).removed).toBe(0);
    const db = await (await import('../database')).getDB();
    await db.put('media', { key: 'yatim.png', mime: 'image/png', size: 3, data: new ArrayBuffer(3), addedAt: 0 });
    expect((await pruneUnusedMedia()).removed).toBe(1);
    expect((await getMediaStats()).count).toBe(before);
  });
});

describe('penjadwalan Anki -> FSRS', () => {
  const crt = 1_700_000_000; // detik
  const base: AnkiCard = {
    id: '1', nid: '1', did: '1', odid: '0', ord: 0, type: 2, queue: 2, due: 10, ivl: 30, factor: 2500,
    reps: 5, lapses: 1, left: 0, odue: 0, data: '', };

  it('kartu baru tanpa srs; suspend tetap terbawa', () => {
    expect(convertScheduling({ ...base, type: 0, queue: 0 }, crt, DEFAULT_SETTINGS).srs).toBeUndefined();
    expect(convertScheduling({ ...base, type: 0, queue: -1 }, crt, DEFAULT_SETTINGS).suspended).toBe(true);
  });

  it('review: due = crt + hari, stabilitas dari interval, difficulty wajar', () => {
    const { srs } = convertScheduling(base, crt, DEFAULT_SETTINGS);
    expect(srs!.state).toBe(2);
    expect(srs!.due).toBe((crt + 10 * 86400) * 1000);
    expect(srs!.stability).toBe(30);
    expect(srs!.difficulty).toBeCloseTo(5, 5);
    expect(srs!.reps).toBe(5);
    expect(srs!.lapses).toBe(1);
  });

  it('ease rendah -> lebih sulit; ease tinggi -> lebih mudah; selalu dalam 1..10', () => {
    const lo = convertScheduling({ ...base, factor: 1300 }, crt, DEFAULT_SETTINGS).srs!.difficulty;
    const hi = convertScheduling({ ...base, factor: 3000 }, crt, DEFAULT_SETTINGS).srs!.difficulty;
    expect(lo).toBeGreaterThan(hi);
    for (const f of [0, 1, 130, 99999]) {
      const d = convertScheduling({ ...base, factor: f }, crt, DEFAULT_SETTINGS).srs!.difficulty;
      expect(d).toBeGreaterThanOrEqual(1);
      expect(d).toBeLessThanOrEqual(10);
    }
  });

  it('memakai memori FSRS asli Anki (s, d, lrt) bila ada', () => {
    const { srs } = convertScheduling({ ...base, data: '{"s":42.5,"d":6.1,"lrt":1700000500}' }, crt, DEFAULT_SETTINGS);
    expect(srs!.stability).toBe(42.5);
    expect(srs!.difficulty).toBe(6.1);
    expect(srs!.lastReview).toBe(1700000500 * 1000);
  });

  it('data rusak tidak membuat gagal', () => {
    expect(() => convertScheduling({ ...base, data: '{rusak' }, crt, DEFAULT_SETTINGS)).not.toThrow();
  });

  it('learning: due = detik epoch; relearning = state 3', () => {
    const l = convertScheduling({ ...base, type: 1, queue: 1, due: 1_700_100_000, ivl: 0, left: 1002 }, crt, DEFAULT_SETTINGS).srs!;
    expect(l.state).toBe(1);
    expect(l.due).toBe(1_700_100_000 * 1000);
    expect(l.learningSteps).toBeGreaterThanOrEqual(0);
    expect(l.learningSteps).toBeLessThan(DEFAULT_SETTINGS.learningSteps.length);
    expect(convertScheduling({ ...base, type: 3, queue: 1, due: 1_700_100_000 }, crt, DEFAULT_SETTINGS).srs!.state).toBe(3);
  });

  it('kartu di deck filter memakai odue sebagai tanggal jatuh tempo asli', () => {
    const { srs } = convertScheduling({ ...base, odid: '99', due: 123456789, odue: 20 }, crt, DEFAULT_SETTINGS);
    expect(srs!.due).toBe((crt + 20 * 86400) * 1000);
  });

  it('nilai ngawur tidak menghasilkan tanggal tidak valid', () => {
    const { srs } = convertScheduling({ ...base, due: 9e15 }, crt, DEFAULT_SETTINGS);
    expect(Number.isFinite(srs!.due)).toBe(true);
    expect(new Date(srs!.due).getTime()).not.toBeNaN();
  });
});

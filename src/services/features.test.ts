import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { messageKeys, messageDicts, msgIn, format } from './messages';
import { backupReminder, ensureFirstSeen, markBackupDone, snoozeBackupReminder, REMIND_AFTER_DAYS } from './backupReminder';
import { hasJapanese, speakableText } from './tts';
import { getDB, resetDBConnection, saveCard, saveDeck, deleteCard } from './database';
import { makeMediaKey, putMediaBatch, pruneUnusedMedia, withMediaWrite, getMediaStats } from './media';

describe('katalog pesan', () => {
  it('ID dan EN punya kunci yang sama dan tidak ada yang kosong', () => {
    for (const k of messageKeys) {
      expect(messageDicts.id[k], k).toBeTruthy();
      expect(messageDicts.en[k], k).toBeTruthy();
    }
    expect(Object.keys(messageDicts.en).sort()).toEqual([...messageKeys].sort());
  });

  it('placeholder ID dan EN identik per kunci (tidak ada parameter yang hilang)', () => {
    const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const k of messageKeys) expect(ph(messageDicts.en[k]), k).toEqual(ph(messageDicts.id[k]));
  });

  it('EN benar-benar bahasa Inggris untuk pesan utama (bukan salinan ID)', () => {
    const same = messageKeys.filter((k) => messageDicts.en[k] === messageDicts.id[k]);
    // yang sama boleh hanya yang netral (mis. ' · cloze')
    expect(same.sort()).toEqual(['dlg.cloze', 'set.pwaTitle', 'set.volume']);
  });

  it('format mengisi parameter dan membiarkan yang tak dikenal', () => {
    expect(format('a {x} b {y}', { x: 1 })).toBe('a 1 b {y}');
    expect(msgIn('en', 'set.saved')).toBe('Settings saved.');
    expect(msgIn('id', 'set.saved')).toBe('Pengaturan disimpan.');
  });
});

describe('pengingat backup', () => {
  const DAY = 86_400_000;
  const mem = () => {
    const d = new Map<string, string>();
    return { getItem: (k: string) => d.get(k) ?? null, setItem: (k: string, v: string) => void d.set(k, v) };
  };

  it('tidak mengingatkan bila belum ada data atau masih baru', () => {
    const s = mem();
    ensureFirstSeen(0, s);
    expect(backupReminder(false, 100 * DAY, s).remind).toBe(false);
    expect(backupReminder(true, (REMIND_AFTER_DAYS - 1) * DAY, s).remind).toBe(false);
  });

  it('mengingatkan setelah batas hari; "belum pernah" dibedakan', () => {
    const s = mem();
    ensureFirstSeen(0, s);
    const r = backupReminder(true, REMIND_AFTER_DAYS * DAY, s);
    expect(r).toMatchObject({ remind: true, never: true, days: REMIND_AFTER_DAYS });
  });

  it('backup mereset hitungan; snooze menunda', () => {
    const s = mem();
    ensureFirstSeen(0, s);
    const t = 30 * DAY;
    expect(backupReminder(true, t, s).remind).toBe(true);
    snoozeBackupReminder(t, s);
    expect(backupReminder(true, t + DAY, s).remind).toBe(false);
    expect(backupReminder(true, t + 4 * DAY, s).remind).toBe(true);
    markBackupDone(t + 4 * DAY, s);
    const r = backupReminder(true, t + 5 * DAY, s);
    expect(r.remind).toBe(false);
    expect(r.never).toBe(false);
  });

  it('aman tanpa localStorage / saat penyimpanan melempar error', () => {
    expect(() => backupReminder(true, 1, null)).not.toThrow();
    const boom = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); } };
    expect(() => { ensureFirstSeen(1, boom); markBackupDone(1, boom); snoozeBackupReminder(1, boom); }).not.toThrow();
    expect(backupReminder(true, 1, boom).remind).toBe(false);
  });
});

describe('TTS cerdas', () => {
  it('hanya membacakan teks berhuruf Jepang', () => {
    expect(hasJapanese('みず')).toBe(true);
    expect(hasJapanese('water')).toBe(false);
    expect(speakableText({ front: 'kucing', back: '' })).toBe('');
    expect(speakableText({ front: '猫', back: '' })).toBe('猫');
    expect(speakableText({ front: 'kucing', back: 'ねこ' })).toBe('ねこ');
    expect(speakableText({ front: '猫', back: 'cat' })).toBe('猫'); // bacaan non-Jepang dilewati
    expect(speakableText({ front: '<ruby>水<rt>みず</rt></ruby>', back: '' })).toBe('水');
    expect(speakableText({ front: 'kucing', back: '', meaning: '猫' })).toBe('猫'); // kartu kebalikan
    expect(speakableText({ front: 'kucing', back: '', meaning: 'cat' })).toBe('');
  });
});

describe('prune media otomatis', () => {
  beforeEach(async () => {
    await resetDBConnection();
    (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  });

  async function cardWithMedia(id: string, bytes: number[]) {
    const data = new Uint8Array(bytes);
    const key = await makeMediaKey(data, 'a.png');
    await putMediaBatch([{ key, mime: 'image/png', data: data.buffer.slice(0) as ArrayBuffer }]);
    await saveCard({ id, deckId: 'd', front: `x [img:${key}]`, back: '', meaning: '', example_jp: '', example_hiragana: '', example_id: '', createdAt: 1 });
    return key;
  }

  it('menghapus media setelah kartu terakhir yang memakainya dihapus; media bersama dipertahankan', async () => {
    await saveDeck({ id: 'd', name: 'D', description: '', createdAt: 1 });
    const k1 = await cardWithMedia('c1', [1, 2, 3]);
    await cardWithMedia('c2', [1, 2, 3]); // media sama (hash sama)
    await cardWithMedia('c3', [9, 9]);
    expect((await getMediaStats()).count).toBe(2);
    await deleteCard('c1');
    expect((await pruneUnusedMedia()).removed).toBe(0); // k1 masih dipakai c2
    await deleteCard('c2');
    expect((await pruneUnusedMedia()).removed).toBe(1);
    const db = await getDB();
    expect(await db.get('media', k1)).toBeUndefined();
    expect((await getMediaStats()).count).toBe(1);
  });

  it('tidak menghapus apa pun selama impor/pemulihan berlangsung (kecuali force)', async () => {
    const data = new Uint8Array([7, 7, 7]);
    const key = await makeMediaKey(data, 'b.png');
    await putMediaBatch([{ key, mime: 'image/png', data: data.buffer.slice(0) as ArrayBuffer }]);
    await withMediaWrite(async () => {
      expect((await pruneUnusedMedia()).removed).toBe(0);
      expect((await getMediaStats()).count).toBe(1);
      expect((await pruneUnusedMedia({ force: true })).removed).toBe(1);
    });
  });
});

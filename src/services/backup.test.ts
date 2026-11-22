import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { zipSync, strToU8 } from 'fflate';
import { getDB, resetDBConnection, saveDeck, saveCard, getAllCards } from './database';
import { createBackupFile, parseBackupBytes, restoreFullBackup } from './importExport';
import { putMediaBatch, getMediaStats, makeMediaKey, hashBytes, addMediaFile, MediaStorageError, kindFromName } from './media';

async function seed() {
  await saveDeck({ id: 'd1', name: 'Tes', description: '', createdAt: 1 });
  const bytes = new Uint8Array([1, 2, 3, 4, 5]);
  const key = await makeMediaKey(bytes, 'gambar.png');
  await putMediaBatch([{ key, mime: 'image/png', data: bytes.buffer.slice(0) as ArrayBuffer }]);
  await saveCard({ id: 'c1', deckId: 'd1', front: `水 [img:${key}]`, back: 'みず', meaning: 'air', example_jp: '', example_hiragana: '', example_id: '', createdAt: 1 });
  return key;
}

beforeEach(async () => {
  await resetDBConnection();
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

describe('backup dengan media', () => {
  it('tanpa media -> JSON; dengan media -> ZIP; restore mengembalikan media', async () => {
    await saveDeck({ id: 'd0', name: 'Kosong', description: '', createdAt: 1 });
    expect((await createBackupFile()).filename).toMatch(/\.json$/);

    const key = await seed();
    const f = await createBackupFile();
    expect(f.filename).toMatch(/\.zip$/);
    expect(f.mediaCount).toBe(1);
    const bytes = new Uint8Array(await f.blob.arrayBuffer());

    
    await resetDBConnection();
    (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
    const { backup, media } = parseBackupBytes(bytes);
    expect(media.map((m) => m.key)).toEqual([key]);
    const r = await restoreFullBackup(backup, media);
    expect(r.media).toBe(1);
    expect((await getAllCards())[0].front).toContain(key);
    expect((await getMediaStats()).count).toBe(1);
    const db = await getDB();
    expect(new Uint8Array((await db.get('media', key)).data)).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
  });

  it('backup JSON lama tetap bisa dipulihkan', async () => {
    await seed();
    const f = await createBackupFile();
    const json = strToU8(JSON.stringify(f.backup));
    const { backup, media } = parseBackupBytes(json);
    expect(media).toEqual([]);
    expect(backup.cards).toHaveLength(1);
  });

  it('berkas rusak memberi pesan ramah', () => {
    expect(() => parseBackupBytes(strToU8('bukan json'))).toThrow(/bukan JSON/i);
    expect(() => parseBackupBytes(zipSync({ 'x.txt': strToU8('x') }))).toThrow(/backup\.json/);
    expect(() => parseBackupBytes(new Uint8Array([0x50, 0x4b, 1, 2, 3, 4]))).toThrow(/rusak/i);
    expect(() => parseBackupBytes(strToU8('{"schema":"lain"}'))).toThrow(/Bukan file backup/);
  });

  it('entri zip dengan path berbahaya diabaikan', () => {
    const backup = { schema: 'inka.backup', version: 1, exportedAt: 1, decks: [], cards: [], revlog: [], settings: {} };
    const z = zipSync({ 'backup.json': strToU8(JSON.stringify(backup)), 'media/../../evil.png': new Uint8Array([1]), 'media/ok.png': new Uint8Array([2]) });
    expect(parseBackupBytes(z).media.map((m) => m.key)).toEqual(['ok.png']);
  });
});

describe('penyimpanan media', () => {
  it('kuota penuh -> MediaStorageError berpesan ramah dan tidak ada yang tersimpan', async () => {
    const db = await getDB();
    const spy = vi.spyOn(Object.getPrototypeOf(db.transaction('media', 'readonly').objectStore('media')), 'put').mockRejectedValue(
      Object.assign(new Error('quota'), { name: 'QuotaExceededError' })
    );
    await expect(putMediaBatch([{ key: 'a.png', mime: 'image/png', data: new ArrayBuffer(2) }])).rejects.toMatchObject({ code: 'quota' });
    spy.mockRestore();
    expect((await getMediaStats()).count).toBe(0);
  });

  it('hash stabil, beda isi -> beda kunci, ekstensi dipertahankan', async () => {
    const a = new Uint8Array([1, 2, 3]);
    expect(await hashBytes(a)).toBe(await hashBytes(new Uint8Array([1, 2, 3])));
    expect(await hashBytes(a)).not.toBe(await hashBytes(new Uint8Array([1, 2, 4])));
    expect(await makeMediaKey(a, 'Foto.JPG')).toMatch(/\.jpg$/);
  });

  it('hash cadangan jalan tanpa crypto.subtle (http non-HTTPS)', async () => {
    vi.stubGlobal('crypto', {});
    const h = await hashBytes(new Uint8Array([9, 9, 9]));
    expect(h).toMatch(/^[0-9a-f]{24}$/);
    vi.unstubAllGlobals();
  });

  it('jenis dan ukuran berkas divalidasi', async () => {
    expect(kindFromName('x.MP3')).toBe('sound');
    expect(kindFromName('x.exe')).toBeNull();
    await expect(addMediaFile(new File([new Uint8Array(4)], 'virus.exe'))).rejects.toBeInstanceOf(MediaStorageError);
    const token = await addMediaFile(new File([new Uint8Array([1, 2])], 'a.png', { type: 'image/png' }));
    expect(token).toMatch(/^\[img:[0-9a-f]{24}\.png\]$/);
  });
});

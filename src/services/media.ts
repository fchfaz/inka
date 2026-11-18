import { getDB } from './database';
import type { Flashcard } from '../types/flashcard';
import type { MediaKind } from './richText';
import { extractMediaRefs } from './richText';

export interface MediaRecord {
  key: string;         // '<hash>.<ext>'
  mime: string;
  size: number;
  data: ArrayBuffer;   // ArrayBuffer (bukan Blob) agar aman di semua browser/IndexedDB
  addedAt: number;
}

const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif', 'bmp', 'ico']);
const AUDIO_EXT = new Set(['mp3', 'ogg', 'oga', 'wav', 'm4a', 'flac', 'opus', 'aac', 'weba']);
const VIDEO_EXT = new Set(['mp4', 'webm', 'm4v', 'mov', 'ogv']);

const MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
  svg: 'image/svg+xml', avif: 'image/avif', bmp: 'image/bmp', ico: 'image/x-icon',
  mp3: 'audio/mpeg', ogg: 'audio/ogg', oga: 'audio/ogg', wav: 'audio/wav', m4a: 'audio/mp4',
  flac: 'audio/flac', opus: 'audio/ogg', aac: 'audio/aac', weba: 'audio/webm',
  mp4: 'video/mp4', webm: 'video/webm', m4v: 'video/mp4', mov: 'video/quicktime', ogv: 'video/ogg',
};

export const MAX_MEDIA_BYTES = 150 * 1024 * 1024; // batas satu berkas

export class MediaStorageError extends Error {
  readonly code: 'quota' | 'too-large' | 'unsupported' | 'unknown';
  constructor(message: string, code: 'quota' | 'too-large' | 'unsupported' | 'unknown') {
    super(message);
    this.name = 'MediaStorageError';
    this.code = code;
  }
}

export function extOf(name: string): string {
  const m = /\.([a-zA-Z0-9]{1,5})$/.exec(name.trim());
  return m ? m[1].toLowerCase() : '';
}

export function kindFromName(name: string): MediaKind | null {
  const ext = extOf(name);
  if (IMAGE_EXT.has(ext)) return 'img';
  if (AUDIO_EXT.has(ext)) return 'sound';
  if (VIDEO_EXT.has(ext)) return 'video';
  return null;
}

export function mimeFromName(name: string): string {
  return MIME[extOf(name)] ?? 'application/octet-stream';
}

/** SHA-256 (dipotong 24 hex) bila crypto.subtle tersedia, selain itu FNV-1a ganda. */
export async function hashBytes(bytes: Uint8Array): Promise<string> {
  const subtle = typeof crypto !== 'undefined' ? crypto.subtle : undefined;
  if (subtle) {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const digest = await subtle.digest('SHA-256', copy.buffer);
    return Array.from(new Uint8Array(digest).slice(0, 12), (b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Konteks tidak aman (http non-localhost): crypto.subtle tidak ada.
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193 ^ bytes.length;
  for (let i = 0; i < bytes.length; i++) {
    h1 = Math.imul(h1 ^ bytes[i], 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ bytes[(i * 7) % bytes.length], 0x85ebca6b) >>> 0;
  }
  return (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0') + bytes.length.toString(16).padStart(8, '0')).slice(0, 24);
}

export async function makeMediaKey(bytes: Uint8Array, filename: string): Promise<string> {
  const ext = extOf(filename) || 'bin';
  return `${await hashBytes(bytes)}.${ext}`;
}

function isQuotaError(err: unknown): boolean {
  const e = err as { name?: string; message?: string } | null;
  return !!e && (e.name === 'QuotaExceededError' || /quota/i.test(e.message ?? ''));
}

const QUOTA_MESSAGE =
  'Penyimpanan browser penuh. Hapus media yang tidak terpakai di Pengaturan, bebaskan ruang di perangkat, atau impor tanpa media.';

/** Minta browser agar tidak menghapus data situs ini saat ruang menipis (best-effort). */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* tidak didukung */
  }
  return false;
}

export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
      const e = await navigator.storage.estimate();
      return { usage: e.usage ?? 0, quota: e.quota ?? 0 };
    }
  } catch {
    /* tidak didukung */
  }
  return null;
}

/** Simpan sekelompok media dalam satu transaksi; yang sudah ada dilewati. Mengembalikan jumlah baru. */
export async function putMediaBatch(records: Array<{ key: string; mime: string; data: ArrayBuffer }>): Promise<number> {
  if (records.length === 0) return 0;
  const db = await getDB();
  const tx = db.transaction('media', 'readwrite');
  const store = tx.objectStore('media');
  let added = 0;
  try {
    for (const r of records) {
      if (await store.getKey(r.key)) continue;
      const rec: MediaRecord = { key: r.key, mime: r.mime, size: r.data.byteLength, data: r.data, addedAt: Date.now() };
      await store.put(rec);
      added++;
    }
    await tx.done;
  } catch (err) {
    try {
      tx.abort();
    } catch {
      /* sudah selesai */
    }
    await tx.done.catch(() => undefined);
    if (isQuotaError(err)) throw new MediaStorageError(QUOTA_MESSAGE, 'quota');
    throw new MediaStorageError(`Gagal menyimpan media: ${(err as Error)?.message ?? err}`, 'unknown');
  }
  return added;
}

export async function getMediaRecord(key: string): Promise<MediaRecord | undefined> {
  const db = await getDB();
  return db.get('media', key);
}

const urlCache = new Map<string, Promise<string | null>>();

/** URL objek untuk <img>/<audio>/<video>. Di-cache; null bila media tidak ada. */
export function getMediaUrl(key: string): Promise<string | null> {
  let p = urlCache.get(key);
  if (!p) {
    p = (async () => {
      const rec = await getMediaRecord(key);
      if (!rec) return null;
      return URL.createObjectURL(new Blob([rec.data], { type: rec.mime }));
    })().catch(() => null);
    urlCache.set(key, p);
    // Jangan menyimpan hasil null: media bisa saja ditambahkan kemudian.
    p.then((v) => {
      if (v === null) urlCache.delete(key);
    });
  }
  return p;
}

export function clearMediaUrlCache(): void {
  for (const p of urlCache.values()) p.then((u) => u && URL.revokeObjectURL(u));
  urlCache.clear();
}

/** Lampirkan berkas buatan pengguna ke kartu. Mengembalikan token untuk disisipkan ke teks. */
export async function addMediaFile(file: File): Promise<string> {
  const kind = kindFromName(file.name);
  if (!kind) {
    throw new MediaStorageError('Jenis berkas tidak didukung. Gunakan gambar, audio (mp3, ogg, wav, m4a), atau video (mp4, webm).', 'unsupported');
  }
  if (file.size > MAX_MEDIA_BYTES) {
    throw new MediaStorageError(`Berkas terlalu besar (maks ${Math.round(MAX_MEDIA_BYTES / 1048576)} MB).`, 'too-large');
  }
  const data = await file.arrayBuffer();
  const key = await makeMediaKey(new Uint8Array(data), file.name);
  await putMediaBatch([{ key, mime: mimeFromName(file.name), data }]);
  void requestPersistentStorage();
  return `[${kind}:${key}]`;
}

export interface MediaStats {
  count: number;
  bytes: number;
}

export async function getMediaStats(): Promise<MediaStats> {
  const db = await getDB();
  const tx = db.transaction('media', 'readonly');
  let count = 0;
  let bytes = 0;
  let cursor = await tx.store.openCursor();
  while (cursor) {
    count++;
    bytes += cursor.value.size ?? 0;
    cursor = await cursor.continue();
  }
  return { count, bytes };
}

export function cardMediaText(c: Flashcard): string {
  return [c.front, c.back, c.meaning, c.example_jp, c.example_hiragana, c.example_id, c.hint, c.extra].join('\n');
}

/** Hapus media yang tidak dirujuk kartu mana pun. */
export async function pruneUnusedMedia(): Promise<{ removed: number; freedBytes: number }> {
  const db = await getDB();
  const used = new Set<string>();
  let cursor = await db.transaction('cards', 'readonly').store.openCursor();
  while (cursor) {
    for (const ref of extractMediaRefs(cardMediaText(cursor.value as Flashcard))) used.add(ref.key);
    cursor = await cursor.continue();
  }
  const tx = db.transaction('media', 'readwrite');
  let removed = 0;
  let freedBytes = 0;
  let mc = await tx.store.openCursor();
  while (mc) {
    if (!used.has(mc.key as string)) {
      removed++;
      freedBytes += mc.value.size ?? 0;
      await mc.delete();
    }
    mc = await mc.continue();
  }
  await tx.done;
  if (removed) clearMediaUrlCache();
  return { removed, freedBytes };
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1073741824) return `${(n / 1048576).toFixed(1)} MB`;
  return `${(n / 1073741824).toFixed(2)} GB`;
}

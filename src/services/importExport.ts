import type {
  Deck,
  Flashcard,
  InkaBackup,
  RecallioBundle,
  RecallioBundleCard,
  StudySettings,
} from '../types/flashcard';
import { DEFAULT_SETTINGS } from '../types/flashcard';
import { getDB, getAllDecks, getCardsByDeck } from './database';
import { convertAnkiNoteToRecallioCard } from './ankiImport';
import { Zip, ZipDeflate, ZipPassThrough, strToU8, strFromU8, unzipSync } from 'fflate';
import { stripMediaTokens } from './richText';
import { mimeFromName, putMediaBatch, type MediaRecord } from './media';

const REQUIRED_CARD_FIELDS: (keyof RecallioBundleCard)[] = [
  'front',
  'back',
  'meaning',
  'example_jp',
  'example_hiragana',
  'example_id',
];

export function validateRecallioBundle(data: unknown): { valid: boolean; error?: string; data?: RecallioBundle } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'JSON harus berupa object valid.' };
  }

  const bundle = data as Partial<RecallioBundle>;

  if (bundle.schema !== 'recallio.deck-bundle') {
    return { valid: false, error: 'Schema tidak valid. Harus "recallio.deck-bundle".' };
  }

  if (typeof bundle.version !== 'number') {
    return { valid: false, error: 'Field "version" harus berupa angka.' };
  }

  if (!Array.isArray(bundle.decks) || bundle.decks.length === 0) {
    return { valid: false, error: 'Field "decks" harus berupa array dan minimal memiliki 1 deck.' };
  }

  for (let i = 0; i < bundle.decks.length; i++) {
    const deck = bundle.decks[i];
    if (!deck || !deck.name || typeof deck.name !== 'string') {
      return { valid: false, error: `Deck index ${i} harus memiliki "name" bertipe string.` };
    }

    if (!Array.isArray(deck.cards)) {
      return { valid: false, error: `Deck "${deck.name}" harus memiliki array "cards".` };
    }

    for (let j = 0; j < deck.cards.length; j++) {
      const card = deck.cards[j];
      for (const field of REQUIRED_CARD_FIELDS) {
        if (!card || typeof card[field] !== 'string') {
          return {
            valid: false,
            error: `Deck "${deck.name}", kartu #${j + 1}: Field "${field}" wajib ada dan bertipe string.`,
          };
        }
      }
      if (card.tags !== undefined && !Array.isArray(card.tags)) {
        return { valid: false, error: `Deck "${deck.name}", kartu #${j + 1}: "tags" harus berupa array.` };
      }
    }
  }

  return { valid: true, data: bundle as RecallioBundle };
}

export async function exportRecallioBundle(): Promise<RecallioBundle> {
  const decks = await getAllDecks();
  const bundleDecks = [];

  for (const deck of decks) {
    const cards = await getCardsByDeck(deck.id);
    bundleDecks.push({
      id: deck.id,
      name: deck.name,
      description: deck.description || '',
      cards: cards.map((c) => ({
        id: c.id,
        front: stripMediaTokens(c.front),
        back: stripMediaTokens(c.back),
        meaning: stripMediaTokens(c.meaning),
        example_jp: stripMediaTokens(c.example_jp),
        example_hiragana: stripMediaTokens(c.example_hiragana),
        example_id: stripMediaTokens(c.example_id),
        hint: stripMediaTokens(c.hint || ''),
        ...(stripMediaTokens(c.extra || '') ? { extra: stripMediaTokens(c.extra || '') } : {}),
        tags: c.tags || [],
      })),
    });
  }

  return {
    schema: 'recallio.deck-bundle',
    version: 1,
    decks: bundleDecks,
  };
}

export interface ImportResult {
  decksCreated: number;
  cardsAdded: number;
  cardsUpdated: number;
  cardsSkipped: number;
}

/**
 * Jalankan isi transaksi; bila ada kesalahan di tengah jalan, batalkan seluruh transaksi.
 * (IndexedDB tidak otomatis membatalkan transaksi ketika kode kita melempar error.)
 */
export async function runAtomic<T>(tx: { abort(): void; done: Promise<void> }, body: () => Promise<T>): Promise<T> {
  try {
    const result = await body();
    await tx.done;
    return result;
  } catch (err) {
    try {
      tx.abort();
    } catch {
      /* transaksi sudah selesai atau dibatalkan */
    }
    await tx.done.catch(() => undefined);
    throw err;
  }
}

function cardKey(c: { front: string; back: string; meaning: string }): string {
  return [c.front, c.back, c.meaning].map((s) => s.trim().toLowerCase()).join('\u0000');
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Impor bundle ke database dalam satu transaksi (semua berhasil atau tidak sama sekali).
 * - Deck dicocokkan lewat id, lalu lewat nama; bila tidak ada, dibuat baru.
 * - Kartu dengan id yang sudah ada diperbarui di tempat (progres belajar tetap).
 * - Kartu yang isinya sama dengan kartu lain di deck itu dilewati, jadi impor ulang tidak menggandakan.
 */
export async function importRecallioBundle(bundle: RecallioBundle): Promise<ImportResult> {
  const db = await getDB();
  const tx = db.transaction(['decks', 'cards'], 'readwrite');
  return runAtomic(tx, async () => {
  const deckStore = tx.objectStore('decks');
  const cardStore = tx.objectStore('cards');

  const existingDecks: Deck[] = await deckStore.getAll();
  const result: ImportResult = { decksCreated: 0, cardsAdded: 0, cardsUpdated: 0, cardsSkipped: 0 };

  for (const deckData of bundle.decks) {
    let deck =
      (deckData.id ? existingDecks.find((d) => d.id === deckData.id) : undefined) ??
      existingDecks.find((d) => d.name.trim().toLowerCase() === deckData.name.trim().toLowerCase());

    if (!deck) {
      deck = {
        id: newId('deck'),
        name: deckData.name,
        description: deckData.description || '',
        createdAt: Date.now(),
      };
      await deckStore.put(deck);
      existingDecks.push(deck);
      result.decksCreated++;
    }

    const deckCards: Flashcard[] = await cardStore.index('by-deck').getAll(deck.id);
    const byId = new Map(deckCards.map((c) => [c.id, c]));
    const keys = new Set(deckCards.map(cardKey));

    for (const cd of deckData.cards) {
      const current = cd.id ? byId.get(cd.id) : undefined;
      if (current) {
        const updated: Flashcard = {
          ...current,
          front: cd.front,
          back: cd.back,
          meaning: cd.meaning,
          example_jp: cd.example_jp,
          example_hiragana: cd.example_hiragana,
          example_id: cd.example_id,
          hint: cd.hint || '',
          ...(cd.extra ? { extra: cd.extra } : {}),
          tags: cd.tags || [],
        };
        const changed = JSON.stringify(updated) !== JSON.stringify(current);
        if (changed) {
          await cardStore.put(updated);
          keys.add(cardKey(updated));
          result.cardsUpdated++;
        } else {
          result.cardsSkipped++;
        }
        continue;
      }

      if (keys.has(cardKey(cd))) {
        result.cardsSkipped++;
        continue;
      }

      const created: Flashcard = {
        id: newId('card'),
        deckId: deck.id,
        front: cd.front,
        back: cd.back,
        meaning: cd.meaning,
        example_jp: cd.example_jp,
        example_hiragana: cd.example_hiragana,
        example_id: cd.example_id,
        hint: cd.hint || '',
        ...(cd.extra ? { extra: cd.extra } : {}),
        tags: cd.tags || [],
        createdAt: Date.now(),
      };
      await cardStore.put(created);
      keys.add(cardKey(created));
      result.cardsAdded++;
    }
  }

  return result;
  });
}

// ---------------------------------------------------------------------------
// CSV / TSV (termasuk "Notes in Plain Text" dari Anki)
// ---------------------------------------------------------------------------

/** Parser CSV/TSV kecil: mendukung tanda kutip ganda, kutip ter-escape (""), dan newline di dalam sel. */
export function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"' && cell === '') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      rows.push(row);
      row = [];
    } else {
      cell += ch;
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

export function detectDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).filter((l) => l && !l.startsWith('#')).slice(0, 5).join('\n');
  const counts: Array<[string, number]> = ['\t', ';', ','].map((d) => [d, sample.split(d).length - 1]);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : '\t';
}

/**
 * Urutan kolom: depan, belakang, arti, contoh JP, contoh hiragana, contoh terjemahan, hint, tag.
 * Baris yang diawali '#' (header Anki) dilewati.
 */
export function parseCardsFromText(text: string): RecallioBundleCard[] {
  const clean = text.replace(/^﻿/, '');
  const delimiter = detectDelimiter(clean);
  const body = clean
    .split(/\r?\n/)
    .filter((l) => !l.startsWith('#'))
    .join('\n');
  const rows = parseDelimited(body, delimiter);
  return rows
    .map((fields) => {
      const tagsCol = fields[7] ?? '';
      const card = convertAnkiNoteToRecallioCard({
        fields: fields.slice(0, 7),
        tags: tagsCol.split(/[\s,]+/).map((t) => t.trim().toLowerCase()).filter(Boolean),
      });
      return card;
    })
    .filter((c) => c.front !== 'N/A');
}

export async function importCardsFromText(text: string, deckId: string): Promise<ImportResult> {
  const db = await getDB();
  const deck: Deck | undefined = await db.get('decks', deckId);
  if (!deck) throw new Error('Deck tujuan tidak ditemukan.');
  const cards = parseCardsFromText(text);
  if (cards.length === 0) throw new Error('Tidak ada baris kartu yang terbaca dari file.');
  return importRecallioBundle({
    schema: 'recallio.deck-bundle',
    version: 1,
    decks: [{ id: deck.id, name: deck.name, description: deck.description, cards }],
  });
}

// ---------------------------------------------------------------------------
// Backup penuh (kartu + progres + riwayat + pengaturan)
// ---------------------------------------------------------------------------

export async function exportFullBackup(): Promise<InkaBackup> {
  const db = await getDB();
  const [decks, cards, revlog, stored] = await Promise.all([
    db.getAll('decks'),
    db.getAll('cards'),
    db.getAll('revlog'),
    db.get('session_state', 'settings'),
  ]);
  return {
    schema: 'inka.backup',
    version: 1,
    exportedAt: Date.now(),
    decks,
    cards,
    revlog,
    settings: { ...DEFAULT_SETTINGS, ...((stored as Partial<StudySettings> | undefined) ?? {}) },
  };
}

export function validateFullBackup(data: unknown): { valid: boolean; error?: string; data?: InkaBackup } {
  if (!data || typeof data !== 'object') return { valid: false, error: 'File bukan JSON object.' };
  const b = data as Partial<InkaBackup>;
  if (b.schema !== 'inka.backup') return { valid: false, error: 'Bukan file backup Inka (schema "inka.backup").' };
  if (b.version !== 1) return { valid: false, error: 'Versi backup tidak didukung.' };
  if (!Array.isArray(b.decks) || !Array.isArray(b.cards) || !Array.isArray(b.revlog)) {
    return { valid: false, error: 'Backup rusak: decks, cards, atau revlog tidak ada.' };
  }
  return { valid: true, data: b as InkaBackup };
}

/** Ganti seluruh isi database dengan backup. Berjalan dalam satu transaksi. */
export async function restoreFullBackup(
  backup: InkaBackup,
  media: Array<{ key: string; mime: string; data: ArrayBuffer }> = []
): Promise<{ decks: number; cards: number; logs: number; media: number }> {
  // Media lebih dulu (idempoten, kunci = hash isi). Bila nanti gagal, yang tersisa hanya media yatim yang bisa dibersihkan.
  for (let i = 0; i < media.length; i += 25) await putMediaBatch(media.slice(i, i + 25));
  const db = await getDB();
  const tx = db.transaction(['decks', 'cards', 'schedules', 'revlog', 'session_state'], 'readwrite');
  return runAtomic(tx, async () => {
  await Promise.all([
    tx.objectStore('decks').clear(),
    tx.objectStore('cards').clear(),
    tx.objectStore('schedules').clear(),
    tx.objectStore('revlog').clear(),
    tx.objectStore('session_state').clear(),
  ]);
  for (const d of backup.decks) await tx.objectStore('decks').put(d);
  for (const c of backup.cards) await tx.objectStore('cards').put(c);
  for (const l of backup.revlog) await tx.objectStore('revlog').put(l);
  await tx.objectStore('session_state').put({ ...DEFAULT_SETTINGS, ...backup.settings }, 'settings');
  // Backup sudah berformat FSRS, tidak perlu migrasi lagi.
  await tx.objectStore('session_state').put(true, 'migrated_fsrs_v1');
  return { decks: backup.decks.length, cards: backup.cards.length, logs: backup.revlog.length, media: media.length };
  });
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------------------------------------------------------------------------
// Backup berkas: JSON bila tanpa media, ZIP (backup.json + media/) bila ada media
// ---------------------------------------------------------------------------

export interface BackupFile {
  blob: Blob;
  filename: string;
  backup: InkaBackup;
  mediaCount: number;
}

export async function createBackupFile(): Promise<BackupFile> {
  const backup = await exportFullBackup();
  const day = new Date().toISOString().slice(0, 10);
  const db = await getDB();
  const mediaCount = await db.count('media');
  if (mediaCount === 0) {
    return {
      blob: new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }),
      filename: `inka-backup-${day}.json`,
      backup,
      mediaCount: 0,
    };
  }

  const parts: BlobPart[] = [];
  let zipError: Error | null = null;
  const zip = new Zip((err, chunk) => {
    if (err) zipError = err;
    else parts.push(chunk as unknown as BlobPart);
  });
  const json = new ZipDeflate('backup.json', { level: 6 });
  zip.add(json);
  json.push(strToU8(JSON.stringify(backup)), true);

  // Media sudah terkompresi (jpg/mp3/mp4), jadi disimpan apa adanya, satu per satu agar memori tidak berlipat.
  let cursor = await db.transaction('media', 'readonly').store.openCursor();
  while (cursor) {
    const rec = cursor.value as MediaRecord;
    const f = new ZipPassThrough(`media/${rec.key}`);
    zip.add(f);
    f.push(new Uint8Array(rec.data), true);
    cursor = await cursor.continue();
  }
  zip.end();
  if (zipError) throw new Error(`Gagal membuat berkas backup: ${(zipError as Error).message}`);
  return { blob: new Blob(parts, { type: 'application/zip' }), filename: `inka-backup-${day}.zip`, backup, mediaCount };
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Baca berkas backup .json atau .zip. Melempar Error berpesan ramah bila tidak valid. */
export function parseBackupBytes(bytes: Uint8Array): {
  backup: InkaBackup;
  media: Array<{ key: string; mime: string; data: ArrayBuffer }>;
} {
  let jsonText: string;
  const media: Array<{ key: string; mime: string; data: ArrayBuffer }> = [];
  if (bytes.length > 3 && bytes[0] === 0x50 && bytes[1] === 0x4b) {
    let files: Record<string, Uint8Array>;
    try {
      files = unzipSync(bytes);
    } catch {
      throw new Error('Arsip backup rusak atau tidak lengkap.');
    }
    if (!files['backup.json']) throw new Error('Arsip ini bukan backup Inka (backup.json tidak ada).');
    jsonText = strFromU8(files['backup.json']);
    for (const [name, data] of Object.entries(files)) {
      if (!name.startsWith('media/') || name.length <= 6) continue;
      const key = name.slice(6);
      if (key.includes('/') || key.includes('..')) continue; // kunci aneh: abaikan
      media.push({ key, mime: mimeFromName(key), data: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer });
    }
  } else {
    jsonText = strFromU8(bytes);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error('Berkas bukan JSON/ZIP backup yang valid.');
  }
  const v = validateFullBackup(parsed);
  if (!v.valid || !v.data) throw new Error(v.error ?? 'Backup tidak valid.');
  return { backup: v.data, media };
}

import { msg } from '../messages';
import type { Deck, Flashcard, ReviewLog } from '../../types/flashcard';
import { getDB, getStudyDayString } from '../database';
import { runAtomic } from '../importExport';
import {
  MAX_MEDIA_BYTES, MediaStorageError, kindFromName, makeMediaKey, mimeFromName, putMediaBatch,
  pruneUnusedMedia, requestPersistentStorage, withMediaWrite,
} from '../media';
import type { MediaResolution } from '../richText';
import type { AnkiPackage } from './apkg';
import { convertPackage, type ConvertOptions } from './convert';

export interface AnkiImportProgress {
  phase: 'media' | 'cards';
  done: number;
  total: number;
}

export interface AnkiImportSummary {
  decksCreated: number;
  cardsAdded: number;
  cardsSkipped: number;      // sudah ada (impor ulang) -> dibiarkan, progres Anda aman
  emptyCards: number;        // kartu tanpa isi depan, dilewati
  logsAdded: number;
  mediaStored: number;       // berkas media baru yang disimpan
  mediaMissing: string[];    // dirujuk kartu tetapi tidak ada di paket
  mediaSkipped: string[];    // jenis tidak didukung / terlalu besar / rusak
  skippedNotetypes: Array<{ name: string; cards: number; reason: string }>;
}

const MEDIA_CHUNK = 25;

function newDeckId(): string {
  return `deck-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function abortIf(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException(msg('import.cancelled'), 'AbortError');
}

export function importAnkiPackage(
  pkg: AnkiPackage,
  opts: ConvertOptions,
  onProgress?: (p: AnkiImportProgress) => void,
  signal?: AbortSignal
): Promise<AnkiImportSummary> {
  return withMediaWrite(() => runImport(pkg, opts, onProgress, signal));
}

async function runImport(
  pkg: AnkiPackage,
  opts: ConvertOptions,
  onProgress?: (p: AnkiImportProgress) => void,
  signal?: AbortSignal
): Promise<AnkiImportSummary> {
  // 1) Kumpulkan nama media yang benar-benar dirujuk kartu yang akan diimpor.
  const scan = convertPackage(pkg, opts, (name) => {
    const kind = kindFromName(name);
    return kind ? { kind, key: 'scan' } : null;
  });

  // 2) Simpan media bertahap (idempoten: kunci = hash isi).
  const resolved = new Map<string, MediaResolution>();
  const mediaSkipped: string[] = [];
  let mediaStored = 0;
  if (opts.includeMedia && scan.mediaNames.size) {
    const names = [...scan.mediaNames];
    const inPackage = new Set(pkg.mediaEntries.map((m) => m.name));
    let done = 0;
    onProgress?.({ phase: 'media', done, total: names.length });
    for (let i = 0; i < names.length; i += MEDIA_CHUNK) {
      abortIf(signal);
      const chunk = names.slice(i, i + MEDIA_CHUNK);
      const loaded = pkg.loadMedia(chunk.filter((n) => inPackage.has(n)));
      const batch: Array<{ key: string; mime: string; data: ArrayBuffer }> = [];
      for (const name of chunk) {
        const bytes = loaded.get(name);
        if (!bytes) {
          if (inPackage.has(name)) mediaSkipped.push(name); // ada di daftar tetapi gagal dibaca
          continue;
        }
        const kind = kindFromName(name);
        if (!kind || bytes.byteLength > MAX_MEDIA_BYTES || bytes.byteLength === 0) {
          mediaSkipped.push(name);
          continue;
        }
        const key = await makeMediaKey(bytes, name);
        const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
        batch.push({ key, mime: mimeFromName(name), data });
        resolved.set(name, { kind, key });
      }
      mediaStored += await putMediaBatch(batch); // MediaStorageError('quota') naik ke pemanggil
      done += chunk.length;
      onProgress?.({ phase: 'media', done, total: names.length });
    }
    void requestPersistentStorage();
  }

  // 3) Konversi final dengan kunci media yang sebenarnya.
  abortIf(signal);
  const conv = convertPackage(pkg, opts, (name) => resolved.get(name) ?? null);
  const mediaMissing = [...conv.mediaMissing].filter((n) => !mediaSkipped.includes(n));

  // 4) Tulis deck + kartu + riwayat dalam SATU transaksi (semua atau tidak sama sekali).
  const db = await getDB();
  const summary: AnkiImportSummary = {
    decksCreated: 0, cardsAdded: 0, cardsSkipped: 0, emptyCards: conv.emptyCards, logsAdded: 0,
    mediaStored, mediaMissing, mediaSkipped, skippedNotetypes: conv.skippedNotetypes,
  };
  const total = conv.cards.length;
  onProgress?.({ phase: 'cards', done: 0, total });

  try {
    const tx = db.transaction(['decks', 'cards', 'revlog', 'notes', 'noteTypes'], 'readwrite');
    await runAtomic(tx, async () => {
      const deckStore = tx.objectStore('decks');
      const cardStore = tx.objectStore('cards');
      const revStore = tx.objectStore('revlog');
      const noteStore = tx.objectStore('notes');
      const ntStore = tx.objectStore('noteTypes');

      // Simpan notetype Anki
      if (conv.notetypes) {
        for (const nt of conv.notetypes) {
          const existing = await ntStore.get(nt.id);
          if (!existing) {
            await ntStore.put(nt);
          }
        }
      }

      const decks: Deck[] = await deckStore.getAll();
      const deckByName = new Map(decks.map((d) => [d.name.trim().toLowerCase(), d]));
      const ensureDeck = async (fullName: string): Promise<Deck> => {
        const parts = fullName.split('::').map((p) => p.trim()).filter(Boolean);
        let parentId: string | undefined = undefined;
        let runningPath = '';
        let lastDeck: Deck | null = null;

        for (const part of parts) {
          runningPath = runningPath ? `${runningPath}::${part}` : part;
          const k = runningPath.toLowerCase();
          let d = deckByName.get(k);
          if (!d) {
            d = {
              id: newDeckId(),
              name: runningPath,
              description: 'Diimpor dari Anki',
              parentId,
              createdAt: Date.now(),
            };
            await deckStore.put(d);
            deckByName.set(k, d);
            summary.decksCreated++;
          }
          parentId = d.id;
          lastDeck = d;
        }

        return lastDeck ?? { id: newDeckId(), name: fullName.trim(), description: 'Diimpor dari Anki', createdAt: Date.now() };
      };

      const added = new Set<string>();
      const deckIdOfCard = new Map<string, string>();
      let n = 0;
      for (const item of conv.cards) {
        const deck = await ensureDeck(item.deckName);
        const existing = (await cardStore.get(item.card.id)) as Flashcard | undefined;
        deckIdOfCard.set(item.card.id, existing?.deckId ?? deck.id);
        if (existing) {
          summary.cardsSkipped++;
        } else {
          // Simpan Note jika ada
          if (item.note) {
            const existingNote = await noteStore.get(item.note.id);
            if (!existingNote) {
              await noteStore.put({ ...item.note, deckId: deck.id });
            }
          }
          await cardStore.put({ ...item.card, deckId: deck.id } as Flashcard);
          added.add(item.card.id);
          summary.cardsAdded++;
        }
        if (++n % 200 === 0) {
          onProgress?.({ phase: 'cards', done: n, total });
          abortIf(signal);
        }
      }

      // Riwayat: kartu baru -> semua; kartu lama -> hanya yang belum ada (cardId + ts).
      const existingTs = new Map<string, Set<number>>();
      for (const id of new Set(conv.logs.map((l) => l.inkaCardId))) {
        if (added.has(id)) continue;
        const rows: ReviewLog[] = await revStore.index('by-card').getAll(id);
        existingTs.set(id, new Set(rows.map((r) => r.ts)));
      }
      for (const l of conv.logs) {
        if (existingTs.get(l.inkaCardId)?.has(l.ts)) continue;
        const { inkaCardId, deckName: _deckName, ...rest } = l;
        void _deckName;
        await revStore.add({ ...rest, cardId: inkaCardId, deckId: deckIdOfCard.get(inkaCardId)! });
        summary.logsAdded++;
      }
    });
  } catch (err) {
    if (mediaStored > 0) await pruneUnusedMedia({ force: true }).catch(() => undefined);
    throw err;
  }
  onProgress?.({ phase: 'cards', done: total, total });
  return summary;
}

export { MediaStorageError, getStudyDayString };

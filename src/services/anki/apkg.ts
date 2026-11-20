/**
 * Pembaca paket Anki (.apkg / .colpkg) — tanpa efek samping, tidak menyentuh IndexedDB.
 * Mendukung tiga generasi format: legacy1 (collection.anki2), legacy2 (collection.anki21)
 * dan terbaru (collection.anki21b, zstd + media protobuf).
 */
import { msg } from '../messages';
import { unzipSync } from 'fflate';
import { decompress as zstdDecompress } from 'fzstd';
import type { Database, SqlJsStatic } from 'sql.js';

export type AnkiErrorCode =
  | 'not-zip' | 'no-collection' | 'stub-only' | 'corrupt' | 'too-large' | 'empty' | 'encrypted' | 'sql-init';

export class AnkiImportError extends Error {
  readonly code: AnkiErrorCode;
  constructor(code: AnkiErrorCode, message: string) {
    super(message);
    this.name = 'AnkiImportError';
    this.code = code;
  }
}

export interface AnkiTemplate { name: string; qfmt: string; afmt: string }
export interface AnkiNotetype {
  id: string;
  name: string;
  isCloze: boolean;
  fields: string[];
  templates: AnkiTemplate[];
}
export interface AnkiNote { id: string; guid: string; mid: string; tags: string[]; fields: string[] }
export interface AnkiCard {
  id: string; nid: string; did: string; odid: string; ord: number;
  type: number; queue: number; due: number; ivl: number; factor: number;
  reps: number; lapses: number; left: number; odue: number; data: string;
}
export interface AnkiRevlog { id: number; cid: string; ease: number; ivl: number; lastIvl: number; time: number; type: number }

export interface AnkiMediaEntry { name: string; zipName: string }

export interface AnkiPackage {
  format: 'legacy1' | 'legacy2' | 'latest';
  crt: number;                         // detik epoch, dasar hari jatuh tempo review
  notetypes: Map<string, AnkiNotetype>;
  decks: Map<string, string>;          // id -> nama berhirarki ("A::B")
  notes: AnkiNote[];
  cards: AnkiCard[];
  revlog: AnkiRevlog[];
  mediaEntries: AnkiMediaEntry[];
  /** Ambil isi berkas media (dekompresi sesuai format). Hasil per nama; yang tidak ada dilewati. */
  loadMedia(names: string[]): Map<string, Uint8Array>;
}

export const MAX_PACKAGE_BYTES = 1024 * 1024 * 1024; // 1 GB

const ZSTD_MAGIC = [0x28, 0xb5, 0x2f, 0xfd];
const isZstd = (b: Uint8Array) => b.length > 4 && ZSTD_MAGIC.every((v, i) => b[i] === v);
const maybeZstd = (b: Uint8Array) => (isZstd(b) ? zstdDecompress(b) : b);

// ---------------------------------------------------------------------------
// Protobuf kecil (hanya yang dibutuhkan untuk daftar media)
// ---------------------------------------------------------------------------
function readVarint(b: Uint8Array, pos: number): [number, number] {
  let result = 0;
  let shift = 0;
  for (;;) {
    if (pos >= b.length) throw new Error('varint terpotong');
    const byte = b[pos++];
    result += (byte & 0x7f) * 2 ** shift;
    if (!(byte & 0x80)) return [result, pos];
    shift += 7;
    if (shift > 63) throw new Error('varint terlalu panjang');
  }
}

/** Urai pesan: kembalikan [fieldNo, wireType, nilai (angka | Uint8Array)] */
function* protoFields(b: Uint8Array): Generator<[number, number, number | Uint8Array]> {
  let pos = 0;
  while (pos < b.length) {
    let tag: number;
    [tag, pos] = readVarint(b, pos);
    const field = Math.floor(tag / 8);
    const wire = tag & 7;
    if (wire === 0) {
      let v: number;
      [v, pos] = readVarint(b, pos);
      yield [field, wire, v];
    } else if (wire === 2) {
      let len: number;
      [len, pos] = readVarint(b, pos);
      if (pos + len > b.length) throw new Error('bidang terpotong');
      yield [field, wire, b.subarray(pos, pos + len)];
      pos += len;
    } else if (wire === 1) {
      pos += 8;
    } else if (wire === 5) {
      pos += 4;
    } else {
      throw new Error(`wire type tidak didukung: ${wire}`);
    }
  }
}

export function parseMediaProtobuf(b: Uint8Array): string[] {
  const names: string[] = [];
  const dec = new TextDecoder();
  for (const [field, wire, val] of protoFields(b)) {
    if (field !== 1 || wire !== 2) continue;
    let name = '';
    for (const [f2, w2, v2] of protoFields(val as Uint8Array)) {
      if (f2 === 1 && w2 === 2) name = dec.decode(v2 as Uint8Array);
    }
    names.push(name);
  }
  return names;
}

// ---------------------------------------------------------------------------
// SQLite
// ---------------------------------------------------------------------------
export type SqlFactory = () => Promise<SqlJsStatic>;

let defaultFactory: SqlFactory | null = null;
export function setSqlFactory(f: SqlFactory): void {
  defaultFactory = f;
}

async function getSql(factory?: SqlFactory): Promise<SqlJsStatic> {
  const f = factory ?? defaultFactory;
  try {
    if (f) return await f();
    const mod = await import('sql.js');
    const init = (mod as unknown as { default: (cfg?: object) => Promise<SqlJsStatic> }).default;
    return await init();
  } catch (e) {
    throw new AnkiImportError('sql-init', msg('anki.sqlInit', { err: (e as Error).message }));
  }
}

type Row = Record<string, unknown>;
function rows(db: Database, sql: string): Row[] {
  const res = db.exec(sql);
  if (!res.length) return [];
  const { columns, values } = res[0];
  return values.map((v) => {
    const o: Row = {};
    columns.forEach((c, i) => (o[c] = v[i]));
    return o;
  });
}
const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v ?? 0) || 0);
const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

/** Anki baru memakai kolasi `unicase` buatan sendiri yang tidak dikenal sql.js: buang dari skema. */
async function openCollection(SQL: SqlJsStatic, bytes: Uint8Array): Promise<Database> {
  let db: Database;
  try {
    db = new SQL.Database(bytes);
    db.exec('select count(*) from sqlite_master');
  } catch {
    throw new AnkiImportError('corrupt', msg('anki.badDb'));
  }
  const has = db.exec("select count(*) from sqlite_master where sql like '%unicase%'")[0]?.values[0][0];
  if (num(has) > 0) {
    db.exec('PRAGMA writable_schema=ON');
    db.exec("UPDATE sqlite_master SET sql=replace(sql,'COLLATE unicase','') WHERE sql LIKE '%COLLATE unicase%'");
    const patched = db.export();
    db.close();
    db = new SQL.Database(patched);
  }
  return db;
}

function tableExists(db: Database, name: string): boolean {
  return num(db.exec(`select count(*) from sqlite_master where type='table' and name='${name}'`)[0]?.values[0][0]) > 0;
}

const normDeck = (n: string) => n.split('\x1f').join('::');

// ---------------------------------------------------------------------------
// Utama
// ---------------------------------------------------------------------------
export async function readAnkiPackage(input: Uint8Array, factory?: SqlFactory): Promise<AnkiPackage> {
  if (input.byteLength > MAX_PACKAGE_BYTES) {
    throw new AnkiImportError('too-large', msg('anki.tooLarge'));
  }
  if (input.byteLength < 4 || input[0] !== 0x50 || input[1] !== 0x4b) {
    throw new AnkiImportError('not-zip', msg('anki.notZip'));
  }

  let core: Record<string, Uint8Array>;
  try {
    core = unzipSync(input, { filter: (f) => !/^\d+$/.test(f.name) });
  } catch (e) {
    throw new AnkiImportError('corrupt', msg('anki.badZip', { err: (e as Error).message }));
  }

  let colName: string | null = null;
  let format: AnkiPackage['format'] = 'legacy1';
  if (core['collection.anki21b']) { colName = 'collection.anki21b'; format = 'latest'; }
  else if (core['collection.anki21']) { colName = 'collection.anki21'; format = 'legacy2'; }
  else if (core['collection.anki2']) { colName = 'collection.anki2'; format = 'legacy1'; }
  if (!colName) {
    throw new AnkiImportError('no-collection', msg('anki.noCollection'));
  }

  let colBytes = core[colName];
  try {
    if (isZstd(colBytes)) colBytes = zstdDecompress(colBytes);
  } catch (e) {
    throw new AnkiImportError('corrupt', msg('anki.badCompressed', { err: (e as Error).message }));
  }

  const SQL = await getSql(factory);
  const db = await openCollection(SQL, colBytes);
  try {
    if (!tableExists(db, 'notes') || !tableExists(db, 'cards') || !tableExists(db, 'col')) {
      throw new AnkiImportError('corrupt', msg('anki.badStructure'));
    }
    const noteCount = num(db.exec('select count(*) from notes')[0]?.values[0][0]);
    if (noteCount === 0) {
      // Paket "stub" buatan Anki baru: hanya collection.anki2 kosong dengan kartu peringatan.
      const looksStub = format === 'legacy1' && !!core['meta'];
      throw new AnkiImportError(
        looksStub ? 'stub-only' : 'empty',
        looksStub
          ? msg('anki.stub')
          : msg('anki.empty')
      );
    }

    const colRow = rows(db, 'select * from col limit 1')[0] ?? {};
    const crt = num(colRow.crt);

    const notetypes = new Map<string, AnkiNotetype>();
    const decks = new Map<string, string>();

    if (tableExists(db, 'notetypes') && tableExists(db, 'fields')) {
      const flds = rows(db, 'select ntid, ord, name from fields order by ntid, ord');
      const tmpls = rows(db, 'select ntid, ord, name, config from templates order by ntid, ord');
      for (const nt of rows(db, 'select id, name from notetypes')) {
        const id = str(nt.id);
        const templates: AnkiTemplate[] = tmpls.filter((t) => str(t.ntid) === id).map((t) => {
          let qfmt = '';
          let afmt = '';
          const cfg = t.config;
          if (cfg instanceof Uint8Array) {
            try {
              const dec = new TextDecoder();
              for (const [f, w, v] of protoFields(cfg)) {
                if (w !== 2) continue;
                if (f === 1) qfmt = dec.decode(v as Uint8Array);
                else if (f === 2) afmt = dec.decode(v as Uint8Array);
              }
            } catch { /* template tidak terbaca: abaikan, tidak kritis */ }
          }
          return { name: str(t.name), qfmt, afmt };
        });
        notetypes.set(id, {
          id,
          name: str(nt.name),
          isCloze: templates.some((t) => /\{\{cloze:/i.test(t.qfmt)) || (templates.length === 1 && !templates[0].qfmt && /cloze/i.test(str(nt.name))),
          fields: flds.filter((f) => str(f.ntid) === id).map((f) => str(f.name)),
          templates,
        });
      }
      for (const d of rows(db, 'select id, name from decks')) decks.set(str(d.id), normDeck(str(d.name)));
    } else {
      try {
        const models = JSON.parse(str(colRow.models) || '{}') as Record<string, {
          id?: number | string; name?: string; type?: number;
          flds?: Array<{ name: string; ord: number }>;
          tmpls?: Array<{ name: string; qfmt: string; afmt: string; ord: number }>;
        }>;
        for (const [id, m] of Object.entries(models)) {
          notetypes.set(id, {
            id,
            name: m.name ?? id,
            isCloze: m.type === 1,
            fields: [...(m.flds ?? [])].sort((a, b) => a.ord - b.ord).map((f) => f.name),
            templates: [...(m.tmpls ?? [])].sort((a, b) => a.ord - b.ord).map((t) => ({ name: t.name, qfmt: t.qfmt ?? '', afmt: t.afmt ?? '' })),
          });
        }
        const ds = JSON.parse(str(colRow.decks) || '{}') as Record<string, { name?: string }>;
        for (const [id, d] of Object.entries(ds)) decks.set(id, normDeck(d.name ?? id));
      } catch {
        throw new AnkiImportError('corrupt', msg('anki.badModels'));
      }
    }

    const notes: AnkiNote[] = rows(db, 'select id, guid, mid, tags, flds from notes').map((r) => ({
      id: str(r.id),
      guid: str(r.guid),
      mid: str(r.mid),
      tags: str(r.tags).split(/\s+/).filter(Boolean),
      fields: str(r.flds).split('\x1f'),
    }));
    const cards: AnkiCard[] = rows(db, 'select id, nid, did, ord, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, data from cards').map((r) => ({
      id: str(r.id), nid: str(r.nid), did: str(r.did), odid: str(r.odid), ord: num(r.ord),
      type: num(r.type), queue: num(r.queue), due: num(r.due), ivl: num(r.ivl), factor: num(r.factor),
      reps: num(r.reps), lapses: num(r.lapses), left: num(r.left), odue: num(r.odue), data: str(r.data),
    }));
    const revlog: AnkiRevlog[] = tableExists(db, 'revlog')
      ? rows(db, 'select id, cid, ease, ivl, lastIvl, time, type from revlog').map((r) => ({
          id: num(r.id), cid: str(r.cid), ease: num(r.ease), ivl: num(r.ivl), lastIvl: num(r.lastIvl), time: num(r.time), type: num(r.type),
        }))
      : [];

    // Peta media
    const mediaEntries: AnkiMediaEntry[] = [];
    const mediaRaw = core['media'];
    if (mediaRaw && mediaRaw.length) {
      try {
        const bytes = maybeZstd(mediaRaw);
        if (bytes[0] === 0x7b) {
          const map = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, string>;
          for (const [zipName, name] of Object.entries(map)) mediaEntries.push({ name, zipName });
        } else {
          parseMediaProtobuf(bytes).forEach((name, i) => name && mediaEntries.push({ name, zipName: String(i) }));
        }
      } catch {
        // Daftar media rusak: kartu tetap diimpor tanpa media, pemanggil melaporkan lewat 'missing'.
      }
    }

    const zipNameByName = new Map(mediaEntries.map((m) => [m.name, m.zipName]));
    const loadMedia = (names: string[]): Map<string, Uint8Array> => {
      const wanted = new Map<string, string>();
      for (const n of names) {
        const z = zipNameByName.get(n);
        if (z !== undefined) wanted.set(z, n);
      }
      const out = new Map<string, Uint8Array>();
      if (!wanted.size) return out;
      let files: Record<string, Uint8Array> = {};
      try {
        files = unzipSync(input, { filter: (f) => wanted.has(f.name) });
      } catch {
        return out;
      }
      for (const [zipName, data] of Object.entries(files)) {
        try {
          out.set(wanted.get(zipName)!, format === 'latest' ? maybeZstd(data) : data);
        } catch { /* berkas media rusak: dilewati */ }
      }
      return out;
    };

    return { format, crt, notetypes, decks, notes, cards, revlog, mediaEntries, loadMedia };
  } finally {
    db.close();
  }
}

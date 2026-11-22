/**
 * Konversi isi paket Anki -> kartu, deck, dan riwayat review Inka. Murni (tanpa IndexedDB).
 */
import type { CardSrs, CardState, Flashcard, ReviewLog, ReviewRating, StudySettings } from '../../types/flashcard';
import { convertAnkiFieldHtml, type MediaResolution } from '../richText';
import { parseSteps } from '../srs';
import type { AnkiCard, AnkiNote, AnkiNotetype, AnkiPackage } from './apkg';

export type InkaField = 'front' | 'back' | 'meaning' | 'example_jp' | 'example_hiragana' | 'example_id' | 'hint' | 'extra';
export const INKA_FIELDS: Array<{ key: InkaField; label: string }> = [
  { key: 'front', label: 'Depan (kanji / kosakata)' },
  { key: 'back', label: 'Bacaan (hiragana)' },
  { key: 'meaning', label: 'Arti' },
  { key: 'example_jp', label: 'Contoh kalimat' },
  { key: 'example_hiragana', label: 'Bacaan kalimat' },
  { key: 'example_id', label: 'Arti kalimat' },
  { key: 'hint', label: 'Petunjuk' },
  { key: 'extra', label: 'Catatan / media tambahan' },
];

/** Nama field Anki per bidang Inka (boleh lebih dari satu; digabung dengan baris baru). */
export type FieldMapping = Partial<Record<InkaField, string[]>>;

export interface NotetypeMapping {
  enabled: boolean;
  mapping: FieldMapping;
}

export interface ConvertOptions {
  mappings: Record<string, NotetypeMapping>;
  includeProgress: boolean;
  includeMedia: boolean;
  deckMode: 'keep' | 'single';
  singleDeckName?: string;
  settings: StudySettings;
  studyDayOf: (ts: number) => string;
}

// ---------------------------------------------------------------------------
// Tebakan pemetaan
// ---------------------------------------------------------------------------
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9぀-ヿ一-鿿]/g, '');

const GUESS: Array<[InkaField, string[]]> = [
  ['example_hiragana', ['sentencereading', 'examplereading', 'sentencekana', 'sentencefurigana', 'examplekana', '例文読み']],
  ['example_id', ['sentencemeaning', 'sentencetranslation', 'exampletranslation', 'sentenceenglish', 'exampleenglish', 'sentenceen', 'sentenceid']],
  ['example_jp', ['sentence', 'example', 'examplesentence', 'sentencejp', 'sentencejapanese', 'japanesesentence', '例文']],
  ['back', ['reading', 'kana', 'furigana', 'hiragana', 'pronunciation', 'yomi', 'expressionreading', '読み']],
  ['hint', ['hint', 'clue']],
  ['meaning', ['meaning', 'meanings', 'definition', 'definitions', 'translation', 'english', 'gloss', 'answer', 'back', 'artinya', 'arti']],
  ['front', ['expression', 'kanji', 'word', 'vocab', 'vocabulary', 'front', 'question', 'japanese', 'term', 'text', '単語', '漢字']],
];

export function isImageOcclusion(nt: AnkiNotetype): boolean {
  return nt.fields.some((f) => /occlusion/i.test(f)) && nt.fields.some((f) => /^image$/i.test(f));
}

export function guessMapping(nt: AnkiNotetype): NotetypeMapping {
  const mapping: FieldMapping = {};
  const used = new Set<string>();
  const assign = (key: InkaField, field: string) => {
    (mapping[key] ??= []).push(field);
    used.add(field);
  };

  if (isImageOcclusion(nt)) {
    const header = nt.fields.find((f) => /^header$/i.test(f));
    if (header) assign('front', header);
    for (const f of nt.fields) if (!used.has(f) && !/occlusion/i.test(f)) assign('extra', f);
    return { enabled: false, mapping };
  }

  // Satu field Anki dipetakan paling banyak sekali; urutan GUESS menentukan prioritas.
  for (const [key, names] of GUESS) {
    for (const f of nt.fields) {
      if (used.has(f)) continue;
      if (!mapping[key] && names.includes(norm(f))) {
        assign(key, f);
        break;
      }
    }
  }
  // Cadangan posisi
  if (!mapping.front && nt.fields.length) {
    const first = nt.fields.find((f) => !used.has(f));
    if (first) assign('front', first);
  }
  if (!mapping.meaning && !mapping.back) {
    const second = nt.fields.find((f) => !used.has(f));
    if (second) assign('meaning', second);
  }
  // Apa pun yang tersisa (audio, gambar, klip, catatan) masuk ke "extra" supaya tidak ada data yang hilang.
  for (const f of nt.fields) if (!used.has(f)) assign('extra', f);
  return { enabled: true, mapping };
}

// ---------------------------------------------------------------------------
// Cloze
// ---------------------------------------------------------------------------
const CLOZE_RE = /\{\{c(\d+)::([\s\S]*?)(?:::([\s\S]*?))?\}\}/g;

export function renderCloze(html: string, active: number): { question: string; answer: string } {
  const question = html.replace(CLOZE_RE, (_m, n: string, text: string, hint?: string) =>
    Number(n) === active ? `<b>[${hint ? hint : '…'}]</b>` : text
  );
  const answer = html.replace(CLOZE_RE, (_m, n: string, text: string) => (Number(n) === active ? `<b>${text}</b>` : text));
  return { question, answer };
}

// ---------------------------------------------------------------------------
// Penjadwalan Anki -> CardSrs
// ---------------------------------------------------------------------------
const DAY_MS = 86400000;

interface FsrsData { s?: number; d?: number; lrt?: number }
function parseData(data: string): FsrsData {
  if (!data || data[0] !== '{') return {};
  try {
    const o = JSON.parse(data) as FsrsData;
    return typeof o === 'object' && o ? o : {};
  } catch {
    return {};
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

export function convertScheduling(
  c: AnkiCard,
  crtSec: number,
  settings: StudySettings,
  lastRevTs?: number
): { srs?: CardSrs; suspended?: boolean } {
  const suspended = c.queue === -1 ? true : undefined;
  if (c.type === 0) return { suspended };

  const fd = parseData(c.data);
  const due0 = c.odid !== '0' && c.odid !== '' && c.odue ? c.odue : c.due;
  const isLearning = c.type === 1 || c.type === 3;

  // review (type 2) dan learning antar-hari (queue 3): due = nomor hari sejak crt.
  // learning/relearning biasa (queue 1): due = detik epoch.
  const dayBased = c.type === 2 || c.queue === 3 || c.queue === 2;
  let dueMs = dayBased ? (crtSec + due0 * 86400) * 1000 : due0 * 1000;
  if (!Number.isFinite(dueMs) || dueMs < 0 || dueMs > 8.64e15) dueMs = Date.now();

  const ease = c.factor > 0 ? c.factor / 1000 : 2.5;
  const ivl = c.ivl > 0 ? c.ivl : 0;
  const stability = fd.s && fd.s > 0 ? fd.s : Math.max(ivl, isLearning ? 0.5 : 1);
  const difficulty = clamp(fd.d && fd.d > 0 ? fd.d : 5 + (2.5 - ease) * 3, 1, 10);

  const lastReview = fd.lrt && fd.lrt > 0 ? fd.lrt * 1000 : lastRevTs ?? (c.type === 2 ? dueMs - ivl * DAY_MS : undefined);

  const steps = parseSteps(settings.learningSteps.join(' ')) ?? [];
  const total = Math.max(steps.length, 1);
  const remaining = c.left % 1000;
  const stepIdx = isLearning ? clamp(total - remaining, 0, total - 1) : 0;

  const state: CardState = c.type === 2 ? 2 : c.type === 3 ? 3 : 1;
  return {
    suspended,
    srs: {
      due: dueMs,
      stability,
      difficulty,
      elapsedDays: lastReview ? Math.max(0, Math.round((Date.now() - lastReview) / DAY_MS)) : 0,
      scheduledDays: ivl,
      learningSteps: stepIdx,
      reps: Math.max(c.reps, 0),
      lapses: Math.max(c.lapses, 0),
      state,
      lastReview,
    },
  };
}

// ---------------------------------------------------------------------------
// Konversi paket
// ---------------------------------------------------------------------------
export interface ConvertedCard {
  card: Omit<Flashcard, 'deckId'>;
  deckName: string;
  ankiCardId: string;
  note?: {
    id: string;
    noteTypeId: string;
    fields: Record<string, string>;
    tags: string[];
    createdAt: number;
  };
}
export interface ConvertedLog extends Omit<ReviewLog, 'id' | 'cardId' | 'deckId'> {
  inkaCardId: string;
  deckName: string;
}
export interface ConvertResult {
  cards: ConvertedCard[];
  logs: ConvertedLog[];
  skippedNotetypes: Array<{ name: string; cards: number; reason: string }>;
  emptyCards: number;
  mediaNames: Set<string>;     // semua nama media yang dirujuk kartu yang diimpor
  mediaMissing: Set<string>;   // dirujuk tetapi tidak ada di paket / tidak didukung
  mediaUsed: Set<string>;      // kunci media yang benar-benar dipakai
  notetypes?: Array<{
    id: string;
    name: string;
    isCloze?: boolean;
    fields: Array<{ name: string }>;
    templates: Array<{ name: string; qfmt: string; afmt: string }>;
  }>;
}

/** Fields yang dirujuk template pertanyaan: {{Field}}, {{type:Field}}, {{furigana:Field}} ... */
function questionFields(qfmt: string): Set<string> {
  const out = new Set<string>();
  const re = /\{\{([^{}]+?)\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(qfmt)) !== null) {
    const name = m[1].split(':').pop()!.trim();
    if (name && !/^[#^/]/.test(name)) out.add(name);
  }
  return out;
}

export function deckNameFor(pkg: AnkiPackage, c: AnkiCard, opts: ConvertOptions): string {
  if (opts.deckMode === 'single') return (opts.singleDeckName ?? '').trim() || 'Impor Anki';
  const id = c.odid !== '0' && c.odid !== '' ? c.odid : c.did;
  return pkg.decks.get(id)?.trim() || 'Impor Anki';
}

export function convertPackage(
  pkg: AnkiPackage,
  opts: ConvertOptions,
  resolveMedia: (name: string) => MediaResolution | null
): ConvertResult {
  const res: ConvertResult = {
    cards: [], logs: [], skippedNotetypes: [], emptyCards: 0,
    mediaNames: new Set(), mediaMissing: new Set(), mediaUsed: new Set(),
  };
  const notes = new Map<string, AnkiNote>(pkg.notes.map((n) => [n.id, n]));
  const lastRevTs = new Map<string, number>();
  for (const r of pkg.revlog) {
    if (r.ease > 0 && r.type !== 4) lastRevTs.set(r.cid, Math.max(lastRevTs.get(r.cid) ?? 0, r.id));
  }

  const resolver = (name: string): MediaResolution | null => {
    res.mediaNames.add(name);
    if (!opts.includeMedia) return null;
    return resolveMedia(name);
  };
  const conv = (html: string): string => {
    const out = convertAnkiFieldHtml(html, resolver);
    for (const m of out.missing) if (opts.includeMedia) res.mediaMissing.add(m);
    for (const u of out.used) res.mediaUsed.add(u);
    return out.text;
  };

  const skippedCount = new Map<string, { name: string; cards: number; reason: string }>();
  const idMap = new Map<string, string>(); // ankiCardId -> inka id
  const deckOfCard = new Map<string, string>();

  for (const c of pkg.cards) {
    const note = notes.get(c.nid);
    if (!note) continue;
    const nt = pkg.notetypes.get(note.mid);
    const cfg = opts.mappings[note.mid];
    if (!nt || !cfg || !cfg.enabled) {
      const key = note.mid;
      const e = skippedCount.get(key) ?? { name: nt?.name ?? 'Tidak dikenal', cards: 0, reason: nt ? 'dinonaktifkan' : 'tipe catatan tidak ada' };
      e.cards++;
      skippedCount.set(key, e);
      continue;
    }

    const fieldValue = (names: string[] | undefined): string => {
      if (!names?.length) return '';
      return names
        .map((n) => {
          const i = nt.fields.indexOf(n);
          return i >= 0 ? note.fields[i] ?? '' : '';
        })
        .filter((v) => v.trim() !== '')
        .join('<br>');
    };

    const vals: Record<InkaField, string> = {
      front: fieldValue(cfg.mapping.front), back: fieldValue(cfg.mapping.back), meaning: fieldValue(cfg.mapping.meaning),
      example_jp: fieldValue(cfg.mapping.example_jp), example_hiragana: fieldValue(cfg.mapping.example_hiragana),
      example_id: fieldValue(cfg.mapping.example_id), hint: fieldValue(cfg.mapping.hint), extra: fieldValue(cfg.mapping.extra),
    };

    if (nt.isCloze) {
      const { question, answer } = renderCloze(vals.front, c.ord + 1);
      vals.front = question;
      // jawaban penuh ditaruh di "arti" bila kosong; bila sudah ada isi, di bagian atas "extra"
      vals.meaning = vals.meaning ? `${answer}<br>${vals.meaning}` : answer;
    } else {
      const tmpl = nt.templates[c.ord] ?? nt.templates[0];
      if (tmpl?.qfmt && c.ord > 0) {
        const q = questionFields(tmpl.qfmt);
        const frontIn = (cfg.mapping.front ?? []).some((f) => q.has(f));
        const meaningIn = (cfg.mapping.meaning ?? []).some((f) => q.has(f));
        if (!frontIn && meaningIn) {
          // kartu kebalikan: pertanyaan = arti, jawaban = kata
          [vals.front, vals.meaning] = [vals.meaning, vals.front];
        }
      }
    }

    const noteId = `note-anki-${note.guid || note.id}`;
    const card: Omit<Flashcard, 'deckId'> = {
      id: `anki-${note.guid || note.id}-${c.ord}`,
      noteId,
      templateIdx: c.ord,
      front: conv(vals.front),
      back: conv(vals.back),
      meaning: conv(vals.meaning),
      example_jp: conv(vals.example_jp),
      example_hiragana: conv(vals.example_hiragana),
      example_id: conv(vals.example_id),
      createdAt: Number(c.id) || Date.now(),
    };
    const hint = conv(vals.hint);
    const extra = conv(vals.extra);
    if (hint) card.hint = hint;
    if (extra) card.extra = extra;
    if (note.tags.length) card.tags = note.tags;

    if (!card.front.trim()) {
      res.emptyCards++;
      continue;
    }

    if (opts.includeProgress) {
      const sch = convertScheduling(c, pkg.crt, opts.settings, lastRevTs.get(c.id));
      if (sch.srs) card.srs = sch.srs;
      if (sch.suspended) card.suspended = true;
    } else if (c.queue === -1) {
      card.suspended = true;
    }

    // Bangun raw fields untuk note asli
    const rawNoteFields: Record<string, string> = {};
    nt.fields.forEach((fName, idx) => {
      rawNoteFields[fName] = conv(note.fields[idx] || '');
    });

    const deckName = deckNameFor(pkg, c, opts);
    res.cards.push({
      card,
      deckName,
      ankiCardId: c.id,
      note: {
        id: noteId,
        noteTypeId: `anki-nt-${nt.id}`,
        fields: rawNoteFields,
        tags: note.tags || [],
        createdAt: Number(note.id) || Date.now(),
      },
    });
    idMap.set(c.id, card.id);
    deckOfCard.set(c.id, deckName);
  }

  // Simpan definisi notetype Anki asli agar tersimpan di Inka
  res.notetypes = Array.from(pkg.notetypes.values()).map((nt) => ({
    id: `anki-nt-${nt.id}`,
    name: nt.name,
    isCloze: nt.isCloze,
    fields: nt.fields.map((f) => ({ name: f })),
    templates: nt.templates.map((t) => ({ name: t.name, qfmt: t.qfmt, afmt: t.afmt })),
  }));

  for (const v of skippedCount.values()) res.skippedNotetypes.push(v);

  if (opts.includeProgress) {
    const revs = pkg.revlog
      .filter((r) => idMap.has(r.cid) && r.ease >= 1 && r.ease <= 4 && r.type !== 4 && r.id > 0)
      .sort((a, b) => a.id - b.id);
    const seen = new Set<string>();
    for (const r of revs) {
      const first = !seen.has(r.cid);
      seen.add(r.cid);
      const stateBefore: CardState = r.type === 1 ? 2 : r.type === 2 ? 3 : r.type === 3 ? 2 : first ? 0 : 1;
      res.logs.push({
        inkaCardId: idMap.get(r.cid)!,
        deckName: deckOfCard.get(r.cid)!,
        ts: r.id,
        studyDay: opts.studyDayOf(r.id),
        rating: r.ease as ReviewRating,
        scheduledDays: r.ivl > 0 ? r.ivl : 0,
        stateBefore,
        durationMs: clamp(r.time, 0, 60000),
        isFirstReview: first,
      });
    }
  }
  return res;
}

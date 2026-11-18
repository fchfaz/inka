/**
 * Efek suara tombol, disintesis langsung dengan Web Audio API (tanpa file audio).
 *
 * Tema: lonceng kaca lembut. Semua nada diambil dari tangga nada pentatonik
 * C-D-E-G-A, sehingga suara apa pun yang berbunyi bersamaan tetap harmonis.
 * Tiap jenis tombol punya "motif" sendiri (arah nada, jumlah nada, warna suara).
 */

export type SfxName =
  | 'tap' | 'nav' | 'flip' | 'again' | 'hard' | 'good' | 'easy'
  | 'undo' | 'suspend' | 'bury' | 'speak' | 'add' | 'success'
  | 'danger' | 'file' | 'close' | 'toggle' | 'error';

export interface SfxNote {
  n: string;               // nama nada pentatonik, mis. 'C5'
  at: number;              // detik sejak suara dimulai
  dur: number;             // durasi (detik)
  type?: OscillatorType;   // default 'sine'
  gain?: number;           // 0..1, default 0.6
  glideTo?: string;        // nada tujuan (glissando)
  lp?: number;             // low-pass Hz, untuk suara lebih "tumpul"
}

const PENTATONIC: Record<string, number> = { C: 0, D: 2, E: 4, G: 7, A: 9 };

/** Frekuensi dari nama nada ('C5' = 523,25 Hz). Hanya C, D, E, G, A yang valid. */
export function noteFreq(name: string): number {
  const m = /^([CDEGA])(\d)$/.exec(name);
  if (!m) throw new Error(`Nada di luar tangga nada pentatonik: ${name}`);
  const midi = 12 * (Number(m[2]) + 1) + PENTATONIC[m[1]];
  return 440 * 2 ** ((midi - 69) / 12);
}

export const SOUNDS: Record<SfxName, SfxNote[]> = {
  // Umum
  tap:     [{ n: 'A5', at: 0, dur: 0.07, gain: 0.45 }],
  nav:     [{ n: 'E5', at: 0, dur: 0.12, type: 'triangle', lp: 2400, gain: 0.55 }],
  toggle:  [{ n: 'E5', at: 0, dur: 0.05, type: 'square', gain: 0.18, lp: 2000 }, { n: 'A5', at: 0.04, dur: 0.07, gain: 0.45 }],
  close:   [{ n: 'G5', at: 0, dur: 0.12, glideTo: 'D5', gain: 0.45 }],
  add:     [{ n: 'G4', at: 0, dur: 0.1, type: 'triangle' }, { n: 'C5', at: 0.06, dur: 0.18, type: 'triangle' }],
  success: [{ n: 'G5', at: 0, dur: 0.12 }, { n: 'C6', at: 0.07, dur: 0.38 }, { n: 'E6', at: 0.07, dur: 0.3, gain: 0.22 }],
  file:    [{ n: 'D5', at: 0, dur: 0.06, gain: 0.5 }, { n: 'D5', at: 0.08, dur: 0.07, gain: 0.5 }],
  danger:  [{ n: 'A3', at: 0, dur: 0.1, type: 'square', gain: 0.22, lp: 700 }, { n: 'E3', at: 0.08, dur: 0.22, type: 'square', gain: 0.22, lp: 600 }],
  error:   [{ n: 'D4', at: 0, dur: 0.1, type: 'triangle', lp: 800 }, { n: 'D4', at: 0.13, dur: 0.16, type: 'triangle', lp: 800 }],

  // Belajar
  flip:    [{ n: 'C5', at: 0, dur: 0.1, glideTo: 'G5', type: 'triangle', gain: 0.5 }],
  again:   [{ n: 'G4', at: 0, dur: 0.14 }, { n: 'D4', at: 0.09, dur: 0.26 }],
  hard:    [{ n: 'E4', at: 0, dur: 0.22, type: 'triangle', lp: 900 }],
  good:    [{ n: 'C5', at: 0, dur: 0.14 }, { n: 'E5', at: 0.08, dur: 0.26 }],
  easy:    [{ n: 'C5', at: 0, dur: 0.12 }, { n: 'E5', at: 0.06, dur: 0.12 }, { n: 'G5', at: 0.12, dur: 0.14 }, { n: 'C6', at: 0.18, dur: 0.36 }],
  undo:    [{ n: 'A4', at: 0, dur: 0.14, glideTo: 'E4', type: 'triangle' }, { n: 'E4', at: 0.1, dur: 0.14, glideTo: 'A4', type: 'triangle', gain: 0.45 }],
  suspend: [{ n: 'E4', at: 0, dur: 0.12, type: 'triangle', lp: 700 }, { n: 'E4', at: 0.1, dur: 0.18, type: 'triangle', lp: 500, gain: 0.4 }],
  bury:    [{ n: 'A4', at: 0, dur: 0.32, glideTo: 'D4', lp: 700, gain: 0.4 }],
  speak:   [{ n: 'D5', at: 0, dur: 0.13, glideTo: 'A5', gain: 0.4 }],
};

export const SFX_NAMES = Object.keys(SOUNDS) as SfxName[];

// ---------------------------------------------------------------------------
// Pemutar
// ---------------------------------------------------------------------------
let enabled = true;
let volume = 0.5;
let ctx: AudioContext | null = null;
let master: GainNode | null = null;

export function configureSfx(opts: { enabled?: boolean; volume?: number }): void {
  if (opts.enabled !== undefined) enabled = opts.enabled;
  if (opts.volume !== undefined) {
    volume = Math.min(Math.max(opts.volume, 0), 1);
    if (master && ctx) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.01);
  }
}

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (ctx) return ctx;
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
    master = null;
  }
  return ctx;
}

export function playSfx(name: SfxName): void {
  if (!enabled) return;
  const c = getContext();
  if (!c || !master) return;
  if (c.state === 'suspended') void c.resume();

  const t0 = c.currentTime + 0.005;
  for (const note of SOUNDS[name]) {
    const start = t0 + note.at;
    const end = start + note.dur;
    const osc = c.createOscillator();
    const amp = c.createGain();
    osc.type = note.type ?? 'sine';
    osc.frequency.setValueAtTime(noteFreq(note.n), start);
    if (note.glideTo) osc.frequency.exponentialRampToValueAtTime(noteFreq(note.glideTo), end);

    const peak = note.gain ?? 0.6;
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(peak, start + 0.006);
    amp.gain.exponentialRampToValueAtTime(0.0001, end);

    let tail: AudioNode = osc;
    if (note.lp) {
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = note.lp;
      osc.connect(lp);
      tail = lp;
    }
    tail.connect(amp);
    amp.connect(master);
    osc.start(start);
    osc.stop(end + 0.02);
  }
}

// ---------------------------------------------------------------------------
// Pemetaan otomatis untuk semua tombol
// ---------------------------------------------------------------------------

/** Tebak suara dari teks/aria-label/title tombol. Atribut data-sfx selalu menang. */
export function inferSfx(label: string): SfxName {
  const t = label.toLowerCase();
  if (/hapus|delete|reset/.test(t)) return 'danger';
  if (/undo|batalkan/.test(t)) return 'undo';
  if (/tangguh|suspend/.test(t)) return 'suspend';
  if (/batal|tutup|cancel|close/.test(t)) return 'close';
  if (/simpan|terapkan|save|pulihkan/.test(t)) return 'success';
  if (/export|import|unduh|backup|impor|ekspor/.test(t)) return 'file';
  if (/tambah|buat|baru|^\s*\+/.test(t)) return 'add';
  return 'tap';
}

const CLICKABLE = 'button, [role="button"], [role="switch"], input[type="checkbox"], label[data-sfx], a[data-sfx]';

function isSfxName(v: string): v is SfxName {
  return (SFX_NAMES as string[]).includes(v);
}

/**
 * Pasang satu listener klik global. Elemen dengan data-sfx="none" dilewati
 * (dipakai tombol yang membunyikan suaranya sendiri, mis. tombol jawaban).
 */
export function installSfxListener(root: Document = document): () => void {
  const onClick = (e: Event) => {
    const target = e.target as Element | null;
    const el = target?.closest(CLICKABLE) as HTMLElement | null;
    if (!el) return;
    if ((el as HTMLButtonElement).disabled) return;

    const attr = el.closest('[data-sfx]')?.getAttribute('data-sfx') ?? null;
    if (attr === 'none') return;
    if (attr && isSfxName(attr)) {
      playSfx(attr);
      return;
    }
    if (el.getAttribute('role') === 'switch' || (el instanceof HTMLInputElement && el.type === 'checkbox')) {
      playSfx('toggle');
      return;
    }
    const label = el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '';
    playSfx(inferSfx(label));
  };
  root.addEventListener('click', onClick, true);
  return () => root.removeEventListener('click', onClick, true);
}

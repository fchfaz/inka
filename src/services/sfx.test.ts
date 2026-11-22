import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SOUNDS, SFX_NAMES, noteFreq, inferSfx, playSfx, configureSfx } from './sfx';

describe('definisi suara', () => {
  it('semua nama punya minimal satu nada', () => {
    expect(SFX_NAMES.length).toBeGreaterThanOrEqual(18);
    for (const name of SFX_NAMES) expect(SOUNDS[name].length).toBeGreaterThan(0);
  });

  it('tiap suara unik (tidak ada dua suara dengan definisi sama)', () => {
    const seen = new Map<string, string>();
    for (const name of SFX_NAMES) {
      const sig = JSON.stringify(SOUNDS[name]);
      expect(seen.get(sig), `${name} sama dengan ${seen.get(sig)}`).toBeUndefined();
      seen.set(sig, name);
    }
  });

  it('tema sama: semua nada (termasuk tujuan glissando) pentatonik C-D-E-G-A', () => {
    for (const name of SFX_NAMES) {
      for (const note of SOUNDS[name]) {
        expect(() => noteFreq(note.n), `${name}: ${note.n}`).not.toThrow();
        if (note.glideTo) expect(() => noteFreq(note.glideTo!), `${name}: ${note.glideTo}`).not.toThrow();
      }
    }
  });

  it('noteFreq akurat dan menolak nada non-pentatonik', () => {
    expect(noteFreq('A4')).toBeCloseTo(440, 5);
    expect(noteFreq('C5')).toBeCloseTo(523.2511, 3);
    expect(() => noteFreq('F4')).toThrow();
    expect(() => noteFreq('H4')).toThrow();
  });

  it('durasi dan gain masuk akal (suara pendek, tidak mengejutkan)', () => {
    for (const name of SFX_NAMES) {
      const end = Math.max(...SOUNDS[name].map((n) => n.at + n.dur));
      expect(end, name).toBeLessThanOrEqual(0.7);
      for (const n of SOUNDS[name]) expect(n.gain ?? 0.6).toBeLessThanOrEqual(0.6);
    }
  });

  it('arah nada tombol jawaban: gagal turun, berhasil naik', () => {
    const f = (name: keyof typeof SOUNDS) => SOUNDS[name].map((n) => noteFreq(n.n));
    const again = f('again');
    expect(again[1]).toBeLessThan(again[0]);
    const good = f('good');
    expect(good[1]).toBeGreaterThan(good[0]);
    const easy = f('easy');
    expect(easy).toEqual([...easy].sort((a, b) => a - b));
    expect(easy.length).toBeGreaterThan(good.length);
  });
});

describe('inferSfx', () => {
  it.each([
    ['Hapus Deck', 'danger'],
    ['Hapus Kartu', 'danger'],
    ['Simpan Kartu', 'success'],
    ['Terapkan Perubahan', 'success'],
    ['Batal', 'close'],
    ['Tutup', 'close'],
    ['Tambah Kartu', 'add'],
    ['Deck Baru', 'add'],
    ['Export JSON', 'file'],
    ['Unduh Backup', 'file'],
    ['Tangguhkan', 'suspend'],
    ['Undo', 'undo'],
    ['Edit Kartu', 'tap'],
    ['Statistik', 'tap'],
  ])('%s -> %s', (label, expected) => {
    expect(inferSfx(label)).toBe(expected);
  });
});

describe('playSfx', () => {
  const created: Array<{ freqs: number[] }> = [];

  beforeEach(() => {
    created.length = 0;
    class FakeParam {
      setValueAtTime = vi.fn();
      exponentialRampToValueAtTime = vi.fn();
      setTargetAtTime = vi.fn();
      value = 0;
    }
    class FakeNode {
      connect = vi.fn();
    }
    class FakeAudioContext {
      currentTime = 0;
      state = 'running';
      destination = new FakeNode();
      resume = vi.fn();
      createGain() {
        return Object.assign(new FakeNode(), { gain: new FakeParam() });
      }
      createBiquadFilter() {
        return Object.assign(new FakeNode(), { type: '', frequency: new FakeParam() });
      }
      createOscillator() {
        const rec = { freqs: [] as number[] };
        created.push(rec);
        const frequency = new FakeParam();
        frequency.setValueAtTime = vi.fn((v: number) => rec.freqs.push(v));
        return Object.assign(new FakeNode(), { type: 'sine', frequency, start: vi.fn(), stop: vi.fn() });
      }
    }
    vi.stubGlobal('window', { AudioContext: FakeAudioContext });
    configureSfx({ enabled: true, volume: 0.5 });
  });

  it('membuat satu osilator per nada', () => {
    playSfx('easy');
    expect(created).toHaveLength(SOUNDS.easy.length);
    expect(created[0].freqs[0]).toBeCloseTo(noteFreq('C5'), 3);
  });

  it('suara yang berbeda menghasilkan urutan frekuensi yang berbeda', () => {
    const sig = (name: keyof typeof SOUNDS) => {
      created.length = 0;
      playSfx(name);
      return JSON.stringify(created.map((c) => c.freqs[0]));
    };
    const sigs = new Set(SFX_NAMES.map((n) => sig(n)));
    
    
    expect(sigs.size).toBeGreaterThanOrEqual(SFX_NAMES.length - 3);
  });

  it('tidak berbunyi saat dimatikan', () => {
    configureSfx({ enabled: false });
    playSfx('good');
    expect(created).toHaveLength(0);
  });

  it('aman dipanggil tanpa Web Audio (browser lama / SSR)', async () => {
    vi.resetModules();
    vi.stubGlobal('window', {}); 
    const fresh = await import('./sfx');
    expect(() => fresh.playSfx('tap')).not.toThrow();
    vi.unstubAllGlobals();
    expect(() => fresh.playSfx('good')).not.toThrow(); 
  });
});

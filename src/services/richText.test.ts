import { describe, it, expect } from 'vitest';
import { sanitizeRich, toPlainText, parseRich, convertAnkiFieldHtml, extractMediaRefs, stripMediaTokens, decodeEntities } from './richText';

describe('sanitizeRich (whitelist)', () => {
  it('membuang script, event handler, iframe, style, link berbahaya', () => {
    const evil = [
      '<script>alert(1)</script>halo',
      '<img src=x onerror="alert(1)">teks',
      '<a href="javascript:alert(1)">klik</a>',
      '<iframe src="//evil"></iframe>ok',
      '<style>body{display:none}</style>ok',
      '<svg onload=alert(1)><circle/></svg>ok',
      '<b onclick="x()">tebal</b>',
      '<!-- <script>x</script> -->aman',
    ];
    for (const e of evil) {
      const out = sanitizeRich(e);
      expect(out, e).not.toMatch(/script|onerror|onclick|onload|javascript|iframe|<style|<svg|<a\b|<img/i);
    }
    expect(sanitizeRich('<b onclick="x()">tebal</b>')).toBe('<b>tebal</b>');
    expect(sanitizeRich('<script>alert(1)</script>halo')).toBe('halo');
  });

  it('mempertahankan ruby/format dan menutup tag yang tidak seimbang', () => {
    expect(sanitizeRich('<ruby>水<rt>みず</rt></ruby>')).toBe('<ruby>水<rt>みず</rt></ruby>');
    expect(sanitizeRich('<b>a<i>b')).toBe('<b>a<i>b</i></b>');
    expect(sanitizeRich('x</b>y')).toBe('xy');
  });

  it('div/p menjadi baris baru, tanpa baris kosong berlebih', () => {
    expect(sanitizeRich('<div>a</div><div>b</div>')).toBe('a<br>b');
    expect(sanitizeRich('<br><br>a')).toContain('a');
  });

  it('teks < dan & tidak menjadi markup', () => {
    expect(sanitizeRich('a &lt;b&gt; &amp; c')).toBe('a &lt;b> &amp; c');
    const nodes = parseRich('1 < 2 & 3');
    expect(toPlainText('1 < 2 & 3')).toBe('1 < 2 & 3');
    expect(nodes.length).toBeGreaterThan(0);
  });

  it('input tidak lazim tidak pernah melempar error', () => {
    const weird = ['<', '<<<>>>', '<b', '</', '[img:', '[img:]', '<script', '<scr<script>ipt>', '&#xFFFFFFFF;', '&#0;', '\u0000', 'x'.repeat(100000)];
    for (const w of weird) expect(() => sanitizeRich(w)).not.toThrow();
    expect(sanitizeRich(undefined as unknown as string)).toBe('');
  });

  it('entitas', () => {
    expect(decodeEntities('&amp;&#65;&#x42;&nbsp;&bogus;')).toBe('&AB\u00a0&bogus;');
    expect(toPlainText('a&nbsp;b')).toBe('a b');
  });
});

describe('token media', () => {
  it('token tulisan sendiri di sumber Anki tidak bisa menyuntik media', () => {
    const r = convertAnkiFieldHtml('[img:evil.png] [video:x.mp4] teks', () => ({ kind: 'img', key: 'REAL.png' }));
    expect(extractMediaRefs(r.text)).toEqual([]);
    expect(toPlainText(r.text)).toContain('[img:evil.png]');
  });

  it('<img>, [sound:] dan <audio><source> diubah; tidak diproses ganda', () => {
    const map: Record<string, { kind: 'img' | 'sound' | 'video'; key: string }> = {
      'a b.png': { kind: 'img', key: 'H1.png' },
      'c.mp3': { kind: 'sound', key: 'H2.mp3' },
      'd.mp4': { kind: 'video', key: 'H3.mp4' },
    };
    const r = convertAnkiFieldHtml(
      '<img src="a%20b.png"> [sound:c.mp3] <video><source src=\'d.mp4\'></video> <img src="gone.png">',
      (n) => map[n] ?? null
    );
    expect(extractMediaRefs(r.text).map((m) => m.key)).toEqual(['H1.png', 'H2.mp3', 'H3.mp4']);
    expect(r.missing).toEqual(['gone.png']);
    expect(r.used).toEqual(['H1.png', 'H2.mp3', 'H3.mp4']);
  });

  it('stripMediaTokens & toPlainText mengabaikan media dan anotasi ruby', () => {
    expect(stripMediaTokens('halo [img:a.png] dunia')).toBe('halo dunia');
    expect(toPlainText('<ruby>水<rt>みず</rt></ruby> [sound:x.mp3] air')).toBe('水 air');
  });
});

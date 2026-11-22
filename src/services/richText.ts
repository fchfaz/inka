

export type MediaKind = 'img' | 'sound' | 'video';

export type InlineTag = 'b' | 'i' | 'u' | 'sub' | 'sup' | 'ruby' | 'rt' | 'rp';

export type RichNode =
  | { t: 'text'; v: string }
  | { t: 'br'; soft?: boolean }
  | { t: 'el'; tag: InlineTag; c: RichNode[] }
  | { t: 'media'; kind: MediaKind; key: string };

const INLINE_ALIAS: Record<string, InlineTag> = {
  b: 'b', strong: 'b', i: 'i', em: 'i', u: 'u', sub: 'sub', sup: 'sup', ruby: 'ruby', rt: 'rt', rp: 'rp',
};
const BLOCK_TAGS = new Set(['div', 'p', 'li', 'ul', 'ol', 'tr', 'table', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'hr']);

const DROP_CONTENT = new Set(['script', 'style', 'title', 'head', 'noscript', 'template', 'iframe', 'object', 'embed', 'textarea', 'select', 'svg', 'math']);

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ensp: ' ', emsp: ' ',
  hellip: '…', mdash: '—', ndash: '–', laquo: '«', raquo: '»', copy: '©', middot: '·',
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (m, g: string) => {
    if (g[0] === '#') {
      const code = g[1] === 'x' || g[1] === 'X' ? parseInt(g.slice(2), 16) : parseInt(g.slice(1), 10);
      if (!Number.isFinite(code) || code < 1 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return m;
      return String.fromCodePoint(code);
    }
    return NAMED_ENTITIES[g.toLowerCase()] ?? m;
  });
}

function escapeText(s: string): string {
  
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\[(?=(?:sound|img|video):)/gi, '&#91;');
}

const TOKEN_RE =
  /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?(\/?)>|\[(sound|img|video):([^\]\n]{1,300})\]/g;


export function parseRich(input: string): RichNode[] {
  const root: RichNode[] = [];
  const stack: Array<{ tag: InlineTag; c: RichNode[] }> = [];
  const cur = () => (stack.length ? stack[stack.length - 1].c : root);
  const pushText = (raw: string) => {
    if (!raw) return;
    const v = decodeEntities(raw);
    const list = cur();
    const last = list[list.length - 1];
    if (last && last.t === 'text') last.v += v;
    else list.push({ t: 'text', v });
  };

  const src = typeof input === 'string' ? input : '';
  TOKEN_RE.lastIndex = 0;
  let pos = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(src)) !== null) {
    pushText(src.slice(pos, m.index));
    pos = m.index + m[0].length;

    if (m[4]) {
      cur().push({ t: 'media', kind: m[4] as MediaKind, key: m[5].trim() });
      continue;
    }
    const tagName = m[2]?.toLowerCase();
    if (!tagName) continue; 
    const closing = m[1] === '/';

    if (!closing && DROP_CONTENT.has(tagName)) {
      const closeRe = new RegExp(`</${tagName}\\s*>`, 'i');
      const rest = src.slice(pos);
      const cm = closeRe.exec(rest);
      pos += cm ? cm.index + cm[0].length : rest.length;
      TOKEN_RE.lastIndex = pos;
      continue;
    }

    if (tagName === 'br') {
      if (!closing) cur().push({ t: 'br' });
    } else if (BLOCK_TAGS.has(tagName)) {
      cur().push({ t: 'br', soft: true });
    } else if (INLINE_ALIAS[tagName]) {
      const tag = INLINE_ALIAS[tagName];
      if (!closing) {
        const el = { tag, c: [] as RichNode[] };
        cur().push({ t: 'el', tag, c: el.c });
        stack.push(el);
      } else {
        for (let i = stack.length - 1; i >= 0; i--) {
          if (stack[i].tag === tag) {
            stack.length = i;
            break;
          }
        }
      }
    }
    
  }
  pushText(src.slice(pos));
  return normalizeBreaks(root);
}


function normalizeBreaks(nodes: RichNode[]): RichNode[] {
  const out: RichNode[] = [];
  for (const n of nodes) {
    if (n.t === 'el') n.c = normalizeBreaks(n.c);
    if (n.t === 'br' && n.soft) {
      const prev = out[out.length - 1];
      if (!prev || prev.t === 'br') continue;
    }
    out.push(n);
  }
  while (out.length && out[out.length - 1].t === 'br' && (out[out.length - 1] as { soft?: boolean }).soft) out.pop();
  return out;
}

function serializeNodes(nodes: RichNode[]): string {
  let s = '';
  for (const n of nodes) {
    if (n.t === 'text') s += escapeText(n.v);
    else if (n.t === 'br') s += '<br>';
    else if (n.t === 'media') s += `[${n.kind}:${n.key}]`;
    else s += `<${n.tag}>${serializeNodes(n.c)}</${n.tag}>`;
  }
  return s;
}


export function sanitizeRich(input: string): string {
  return serializeNodes(parseRich(input));
}

function plain(nodes: RichNode[], parts: string[]): void {
  for (const n of nodes) {
    if (n.t === 'text') parts.push(n.v);
    else if (n.t === 'br') parts.push(' ');
    else if (n.t === 'el' && n.tag !== 'rt' && n.tag !== 'rp') plain(n.c, parts);
  }
}


export function toPlainText(input: string): string {
  if (!input) return '';
  
  if (!/[<&[]/.test(input)) return input;
  const parts: string[] = [];
  plain(parseRich(input), parts);
  return parts.join('').replace(/\s+/g, ' ').trim();
}


export function toSpeechText(input: string): string {
  return toPlainText(input).replace(/ /g, ' ');
}


export function stripMediaTokens(input: string): string {
  return (input ?? '').replace(/\s*\[(sound|img|video):[^\]\n]{1,300}\]\s*/g, ' ').trim();
}

export function extractMediaRefs(input: string): Array<{ kind: MediaKind; key: string }> {
  const out: Array<{ kind: MediaKind; key: string }> = [];
  const re = /\[(sound|img|video):([^\]\n]{1,300})\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input ?? '')) !== null) out.push({ kind: m[1] as MediaKind, key: m[2].trim() });
  return out;
}





export interface MediaResolution {
  kind: MediaKind;
  key: string;
}

export interface ConvertedField {
  text: string;
  missing: string[];   
  used: string[];      
}

const MEDIA_REF_RE = /<(?:img|audio|video|source)\b[^>]*>|\[sound:([^\]\n]+)\]/gi;
const SRC_ATTR_RE = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i;

function lookupName(name: string, resolve: (n: string) => MediaResolution | null): MediaResolution | null {
  const decoded = decodeEntities(name).trim();
  const tries = [decoded];
  try {
    tries.push(decodeURIComponent(decoded));
  } catch {
    /* %-escape rusak, abaikan */
  }
  tries.push(decoded.replace(/^\.?\//, ''));
  for (const t of tries) {
    const hit = resolve(t);
    if (hit) return hit;
  }
  return null;
}

/**
 * Ubah HTML satu field Anki menjadi string simpan Inka:
 * <img src="x.png"> dan [sound:x.mp3] menjadi token media, HTML lain disaring lewat whitelist.
 */
export function convertAnkiFieldHtml(
  html: string,
  resolve: (filename: string) => MediaResolution | null
): ConvertedField {
  const missing: string[] = [];
  const used: string[] = [];
  const asToken = (name: string): string => {
    const hit = lookupName(name, resolve);
    if (!hit) {
      missing.push(decodeEntities(name).trim());
      return '';
    }
    used.push(hit.key);
    return `[${hit.kind}:${hit.key}]`;
  };

  // Token [img:] / [video:] tulisan sendiri di sumber tidak dipercaya: jadikan teks biasa.
  const source = (html ?? '').replace(/\[(img|video):/gi, '&#91;$1:');
  // Satu kali lewat untuk <img>/<audio>/<video>/<source> dan [sound:...], agar token hasil
  // konversi tidak diproses ulang.
  const s = source.replace(MEDIA_REF_RE, (m: string, soundName?: string) => {
    if (soundName !== undefined) return asToken(soundName);
    const am = SRC_ATTR_RE.exec(m);
    return am ? ' ' + asToken(am[1] ?? am[2] ?? am[3] ?? '') + ' ' : '';
  });
  return { text: sanitizeRich(s).trim(), missing, used };
}

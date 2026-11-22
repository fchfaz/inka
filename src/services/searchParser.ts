import type { Flashcard } from '../types/flashcard';
import { toPlainText } from './richText';
import { cardState } from './srs';

/**
 * Filter kartu dengan parser query ala Anki:
 * - `deck:Nama`
 * - `tag:nama_tag`
 * - `is:due`, `is:new`, `is:suspended`, `is:learn`
 * - `flag:1` (1-7)
 * - `prop:ivl>30`
 * - Teks bebas biasa
 */
export function filterCardsByQuery(cards: Flashcard[], query: string): Flashcard[] {
  const q = query.trim();
  if (!q) return cards;

  // Pecah query berdasarkan spasi, tetap menghormati string berpetik jika ada
  const tokens = q.match(/(?:[^\s"]+|"[^"]*")+/g) || [];

  return cards.filter((card) => {
    return tokens.every((rawToken) => {
      const token = rawToken.replace(/^"(.*)"$/, '$1');

      // 1. tag:
      if (token.toLowerCase().startsWith('tag:')) {
        const val = token.substring(4).toLowerCase();
        return card.tags?.some((t) => t.toLowerCase().includes(val));
      }

      // 2. is:
      if (token.toLowerCase().startsWith('is:')) {
        const val = token.substring(3).toLowerCase();
        if (val === 'due') {
          return !card.suspended && card.srs && card.srs.state !== 0 && card.srs.due <= Date.now();
        }
        if (val === 'new') {
          return cardState(card) === 0;
        }
        if (val === 'suspended') {
          return !!card.suspended;
        }
        if (val === 'learn' || val === 'learning') {
          const s = cardState(card);
          return s === 1 || s === 3;
        }
        if (val === 'review') {
          return cardState(card) === 2;
        }
        if (val === 'marked') {
          return !!card.marked;
        }
      }

      // 3. flag:
      if (token.toLowerCase().startsWith('flag:')) {
        const val = parseInt(token.substring(5), 10);
        return card.flag === val;
      }

      // 4. prop:ivl>30, prop:ivl<10, etc.
      if (token.toLowerCase().startsWith('prop:ivl')) {
        const expr = token.substring(8);
        const ivl = card.srs?.scheduledDays ?? 0;
        if (expr.startsWith('>')) {
          const limit = parseFloat(expr.substring(1));
          return ivl > limit;
        }
        if (expr.startsWith('<')) {
          const limit = parseFloat(expr.substring(1));
          return ivl < limit;
        }
        if (expr.startsWith('=')) {
          const limit = parseFloat(expr.substring(1));
          return ivl === limit;
        }
      }

      // 5. Teks biasa di front, back, meaning, tags, atau contoh
      const lower = token.toLowerCase();
      const inFront = toPlainText(card.front).toLowerCase().includes(lower);
      const inBack = toPlainText(card.back).toLowerCase().includes(lower);
      const inMeaning = toPlainText(card.meaning).toLowerCase().includes(lower);
      const inExJp = toPlainText(card.example_jp).toLowerCase().includes(lower);
      const inExId = toPlainText(card.example_id).toLowerCase().includes(lower);
      const inTags = card.tags?.some((t) => t.toLowerCase().includes(lower));

      return inFront || inBack || inMeaning || inExJp || inExId || inTags;
    });
  });
}

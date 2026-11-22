import type { RecallioBundleCard } from '../types/flashcard';

export interface AnkiParsedNote {
  fields: string[];
  tags: string[];
}

const HTML_BREAK = /<br\s*\/?>/gi;
const HTML_TAG = /<[^>]*>/g;

function stripHtml(value: string): string {
  return value
    .replace(HTML_BREAK, ' ')
    .replace(HTML_TAG, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}


export function convertAnkiNoteToRecallioCard(note: AnkiParsedNote): RecallioBundleCard {
  const f = note.fields.map(stripHtml);

  return {
    front: f[0] || 'N/A',
    back: f[1] || '',
    meaning: f[2] || '',
    example_jp: f[3] || '',
    example_hiragana: f[4] || '',
    example_id: f[5] || '',
    hint: f[6] || '',
    tags: note.tags,
  };
}

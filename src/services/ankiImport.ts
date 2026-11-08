import type { RecallioBundleCard } from '../types/flashcard';

export interface AnkiParsedNote {
  fields: string[];
  tags: string[];
}

/**
 * Standardized parser interface for Anki .apkg files.
 * Maps field positions typical in Japanese decks (Expression, Reading, Meaning, Example sentences)
 * into Recallio format.
 */
export function convertAnkiNoteToRecallioCard(note: AnkiParsedNote): RecallioBundleCard {
  const f = note.fields.map(field => field.replace(/<[^>]*>?/gm, '').trim());

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


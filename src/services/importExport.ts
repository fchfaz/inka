import type { Deck, Flashcard, RecallioBundle, RecallioBundleCard } from '../types/flashcard';
import { saveDeck, saveCard, getAllDecks, getCardsByDeck } from './database';

export function validateRecallioBundle(data: unknown): { valid: boolean; error?: string; data?: RecallioBundle } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'JSON harus berupa object valid.' };
  }

  const bundle = data as Partial<RecallioBundle>;

  if (bundle.schema !== 'recallio.deck-bundle') {
    return { valid: false, error: 'Schema tidak valid. Harus "recallio.deck-bundle".' };
  }

  if (typeof bundle.version !== 'number') {
    return { valid: false, error: 'Field "version" harus berupa angka.' };
  }

  if (!Array.isArray(bundle.decks) || bundle.decks.length === 0) {
    return { valid: false, error: 'Field "decks" harus berupa array dan minimal memiliki 1 deck.' };
  }

  for (let i = 0; i < bundle.decks.length; i++) {
    const deck = bundle.decks[i];
    if (!deck.name || typeof deck.name !== 'string') {
      return { valid: false, error: `Deck index ${i} harus memiliki "name" bertipe string.` };
    }

    if (!Array.isArray(deck.cards)) {
      return { valid: false, error: `Deck "${deck.name}" harus memiliki array "cards".` };
    }

    for (let j = 0; j < deck.cards.length; j++) {
      const card = deck.cards[j];
      const requiredFields: (keyof RecallioBundleCard)[] = [
        'front',
        'back',
        'meaning',
        'example_jp',
        'example_hiragana',
        'example_id',
      ];

      for (const field of requiredFields) {
        if (typeof card[field] !== 'string') {
          return {
            valid: false,
            error: `Deck "${deck.name}", kartu #${j + 1}: Field "${field}" wajib ada dan bertipe string.`,
          };
        }
      }
    }
  }

  return { valid: true, data: bundle as RecallioBundle };
}

export async function exportRecallioBundle(): Promise<RecallioBundle> {
  const decks = await getAllDecks();
  const bundleDecks = [];

  for (const deck of decks) {
    const cards = await getCardsByDeck(deck.id);
    bundleDecks.push({
      name: deck.name,
      description: deck.description || '',
      cards: cards.map(c => ({
        front: c.front,
        back: c.back,
        meaning: c.meaning,
        example_jp: c.example_jp,
        example_hiragana: c.example_hiragana,
        example_id: c.example_id,
        hint: c.hint || '',
        tags: c.tags || [],
      })),
    });
  }

  return {
    schema: 'recallio.deck-bundle',
    version: 1,
    decks: bundleDecks,
  };
}

export async function importRecallioBundle(bundle: RecallioBundle): Promise<{ decksImported: number; cardsImported: number }> {
  let deckCount = 0;
  let cardCount = 0;

  for (const deckData of bundle.decks) {
    const deckId = 'deck-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
    const newDeck: Deck = {
      id: deckId,
      name: deckData.name,
      description: deckData.description || '',
      createdAt: Date.now(),
    };
    await saveDeck(newDeck);
    deckCount++;

    for (const cardData of deckData.cards) {
      const newCard: Flashcard = {
        id: 'card-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
        deckId,
        front: cardData.front,
        back: cardData.back,
        meaning: cardData.meaning,
        example_jp: cardData.example_jp,
        example_hiragana: cardData.example_hiragana,
        example_id: cardData.example_id,
        hint: cardData.hint || '',
        tags: cardData.tags || [],
        createdAt: Date.now(),
      };
      await saveCard(newCard);
      cardCount++;
    }
  }

  return { decksImported: deckCount, cardsImported: cardCount };
}


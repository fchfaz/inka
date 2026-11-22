import { describe, it, expect } from 'vitest';
import { filterCardsByQuery } from './searchParser';
import type { Flashcard } from '../types/flashcard';

describe('searchParser', () => {
  const cards: Flashcard[] = [
    {
      id: 'c1',
      deckId: 'd1',
      front: '本',
      back: 'ほん',
      meaning: 'Buku',
      example_jp: '本を読みます。',
      example_hiragana: '',
      example_id: 'Membaca buku',
      createdAt: 100,
      tags: ['n5', 'noun'],
      flag: 1,
    },
    {
      id: 'c2',
      deckId: 'd1',
      front: '食べる',
      back: 'たべる',
      meaning: 'Makan',
      example_jp: 'リンゴを食べる。',
      example_hiragana: '',
      example_id: 'Makan apel',
      createdAt: 200,
      tags: ['n5', 'verb'],
      suspended: true,
      marked: true,
    },
    {
      id: 'c3',
      deckId: 'd1',
      front: '走る',
      back: 'はしる',
      meaning: 'Berlari',
      example_jp: '',
      example_hiragana: '',
      example_id: '',
      createdAt: 300,
      tags: ['verb'],
      srs: {
        due: Date.now() - 1000,
        stability: 10,
        difficulty: 5,
        elapsedDays: 10,
        scheduledDays: 15,
        learningSteps: 0,
        reps: 3,
        lapses: 0,
        state: 2,
      },
    },
  ];

  it('filters by plain text', () => {
    const res = filterCardsByQuery(cards, 'buku');
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe('c1');
  });

  it('filters by tag: syntax', () => {
    const res = filterCardsByQuery(cards, 'tag:noun');
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe('c1');

    const resVerbs = filterCardsByQuery(cards, 'tag:verb');
    expect(resVerbs).toHaveLength(2);
  });

  it('filters by is: suspended, is:due, is:marked', () => {
    expect(filterCardsByQuery(cards, 'is:suspended')).toHaveLength(1);
    expect(filterCardsByQuery(cards, 'is:due')).toHaveLength(1);
    expect(filterCardsByQuery(cards, 'is:marked')).toHaveLength(1);
  });

  it('filters by flag: and prop:ivl', () => {
    expect(filterCardsByQuery(cards, 'flag:1')).toHaveLength(1);
    expect(filterCardsByQuery(cards, 'prop:ivl>10')).toHaveLength(1);
    expect(filterCardsByQuery(cards, 'prop:ivl<10')).toHaveLength(2);
  });
});

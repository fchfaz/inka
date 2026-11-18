import { describe, it, expect } from 'vitest';
import { answerCard, previewIntervals, formatInterval, parseSteps } from './srs';
import { buildQueue, getStudyDayEnd, countDone } from './queue';
import { DEFAULT_SETTINGS, type Flashcard } from '../types/flashcard';

const NOW = new Date('2026-03-10T10:00:00');

function makeCard(id: string, extra: Partial<Flashcard> = {}): Flashcard {
  return {
    id,
    deckId: 'd1',
    front: id,
    back: id,
    meaning: id,
    example_jp: '',
    example_hiragana: '',
    example_id: '',
    createdAt: 1,
    ...extra,
  };
}

describe('answerCard (FSRS)', () => {
  it('kartu baru yang dijawab Good masuk learning dan jatuh tempo dalam menit', () => {
    const r = answerCard(makeCard('a'), 3, DEFAULT_SETTINGS, NOW);
    expect(r.stateBefore).toBe(0);
    expect(r.card.srs?.state).toBe(1);
    const diffMin = (r.card.srs!.due - NOW.getTime()) / 60000;
    expect(diffMin).toBeGreaterThanOrEqual(1);
    expect(diffMin).toBeLessThanOrEqual(15);
  });

  it('Easy pada kartu baru langsung lulus ke review dengan interval hari', () => {
    const r = answerCard(makeCard('a'), 4, DEFAULT_SETTINGS, NOW);
    expect(r.card.srs?.state).toBe(2);
    expect(r.scheduledDays).toBeGreaterThanOrEqual(1);
  });

  it('interval review tumbuh bila terus dijawab Good', () => {
    let card = answerCard(makeCard('a'), 4, DEFAULT_SETTINGS, NOW).card;
    let t = new Date(card.srs!.due);
    const days: number[] = [];
    for (let i = 0; i < 4; i++) {
      const r = answerCard(card, 3, DEFAULT_SETTINGS, t);
      days.push(r.scheduledDays);
      card = r.card;
      t = new Date(card.srs!.due);
    }
    expect(days[3]).toBeGreaterThan(days[0]);
  });

  it('Again pada kartu review menambah lapse dan masuk relearning', () => {
    const reviewed = answerCard(makeCard('a'), 4, DEFAULT_SETTINGS, NOW).card;
    const later = new Date(reviewed.srs!.due);
    const r = answerCard(reviewed, 1, DEFAULT_SETTINGS, later);
    expect(r.card.srs?.state).toBe(3);
    expect(r.card.srs?.lapses).toBe(1);
  });

  it('kartu disuspend dan diberi tag leech saat lapse mencapai batas', () => {
    const settings = { ...DEFAULT_SETTINGS, leechThreshold: 2 };
    let card = answerCard(makeCard('a'), 4, settings, NOW).card;
    let t = new Date(card.srs!.due);
    let leeched = false;
    for (let i = 0; i < 2; i++) {
      // gagal, lalu lulus lagi lewat relearning
      let r = answerCard(card, 1, settings, t);
      leeched = r.becameLeech;
      card = r.card;
      if (leeched) break;
      t = new Date(card.srs!.due);
      r = answerCard(card, 4, settings, t);
      card = r.card;
      t = new Date(card.srs!.due);
    }
    expect(leeched).toBe(true);
    expect(card.suspended).toBe(true);
    expect(card.tags).toContain('leech');
  });

  it('leechThreshold 0 menonaktifkan leech', () => {
    const settings = { ...DEFAULT_SETTINGS, leechThreshold: 0 };
    let card = answerCard(makeCard('a'), 4, settings, NOW).card;
    for (let i = 0; i < 12; i++) {
      const r = answerCard(card, 1, settings, new Date(card.srs!.due));
      card = r.card;
      expect(r.becameLeech).toBe(false);
    }
    expect(card.suspended).toBeUndefined();
  });

  it('previewIntervals memberi 4 label dan Easy >= Good >= Hard', () => {
    const p = previewIntervals(makeCard('a'), DEFAULT_SETTINGS, NOW);
    expect(Object.keys(p)).toHaveLength(4);
    for (const v of Object.values(p)) expect(v).toMatch(/\d|</);
  });
});

describe('helper', () => {
  it('formatInterval', () => {
    expect(formatInterval(10_000)).toBe('<1m');
    expect(formatInterval(10 * 60_000)).toBe('10m');
    expect(formatInterval(3 * 3600_000)).toBe('3j');
    expect(formatInterval(4 * 86400_000)).toBe('4h');
  });

  it('parseSteps menolak format salah', () => {
    expect(parseSteps('1m 10m')).toEqual(['1m', '10m']);
    expect(parseSteps('1m, 1h')).toEqual(['1m', '1h']);
    expect(parseSteps('10 menit')).toBeNull();
    expect(parseSteps('')).toEqual([]);
  });
});

describe('buildQueue', () => {
  const dayEnd = getStudyDayEnd(NOW.getTime(), 3);
  const ctx = (over: Partial<Parameters<typeof buildQueue>[1]> = {}) => ({
    now: NOW.getTime(),
    studyDay: '2026-03-10',
    dayEnd,
    settings: DEFAULT_SETTINGS,
    done: { newDone: 0, reviewsDone: 0 },
    ...over,
  });
  const srs = (state: 0 | 1 | 2 | 3, due: number) => ({
    due, stability: 1, difficulty: 5, elapsedDays: 0, scheduledDays: 0, learningSteps: 0, reps: 1, lapses: 0, state,
  });

  it('getStudyDayEnd jatuh pada jam pergantian hari berikutnya', () => {
    const end = new Date(dayEnd);
    expect(end.getHours()).toBe(3);
    expect(dayEnd).toBeGreaterThan(NOW.getTime());
    expect(dayEnd - NOW.getTime()).toBeLessThanOrEqual(24 * 3600_000);
  });

  it('urutan: learning jatuh tempo, review, baru', () => {
    const cards = [
      makeCard('new1', { createdAt: 1 }),
      makeCard('rev1', { srs: srs(2, NOW.getTime() - 1000) }),
      makeCard('learn1', { srs: srs(1, NOW.getTime() - 1000) }),
    ];
    const snap = buildQueue(cards, ctx());
    expect(snap.next?.card.id).toBe('learn1');
    expect(snap.counts).toEqual({ newCount: 1, learningCount: 1, reviewCount: 1 });
    const noLearn = buildQueue(cards.slice(0, 2), ctx());
    expect(noLearn.next?.card.id).toBe('rev1');
  });

  it('batas kartu baru per hari ditegakkan, dan extraNew menambahnya', () => {
    const cards = Array.from({ length: 5 }, (_, i) => makeCard(`n${i}`, { createdAt: i }));
    const settings = { ...DEFAULT_SETTINGS, newPerDay: 2 };
    expect(buildQueue(cards, ctx({ settings })).counts.newCount).toBe(2);
    expect(buildQueue(cards, ctx({ settings, done: { newDone: 2, reviewsDone: 0 } })).next).toBeNull();
    expect(buildQueue(cards, ctx({ settings, done: { newDone: 2, reviewsDone: 0 }, extraNew: 3 })).counts.newCount).toBe(3);
  });

  it('batas review per hari ditegakkan', () => {
    const cards = Array.from({ length: 5 }, (_, i) => makeCard(`r${i}`, { srs: srs(2, NOW.getTime() - 1000 - i) }));
    const settings = { ...DEFAULT_SETTINGS, reviewsPerDay: 3 };
    expect(buildQueue(cards, ctx({ settings })).counts.reviewCount).toBe(3);
    expect(buildQueue(cards, ctx({ settings, done: { newDone: 0, reviewsDone: 3 } })).counts.reviewCount).toBe(0);
  });

  it('review yang jatuh tempo besok tidak muncul hari ini', () => {
    const cards = [makeCard('r', { srs: srs(2, dayEnd + 1000) })];
    expect(buildQueue(cards, ctx()).next).toBeNull();
  });

  it('kartu suspended dan buried dilewati', () => {
    const cards = [
      makeCard('s', { suspended: true }),
      makeCard('b', { buriedUntil: '2026-03-10' }),
      makeCard('ok', { createdAt: 5 }),
    ];
    const snap = buildQueue(cards, ctx());
    expect(snap.next?.card.id).toBe('ok');
    expect(snap.counts.newCount).toBe(1);
    // bury kedaluwarsa pada hari berikutnya
    expect(buildQueue([cards[1]], ctx({ studyDay: '2026-03-11' })).next?.card.id).toBe('b');
  });

  it('learning dalam learn-ahead ditampilkan hanya bila tidak ada kartu lain', () => {
    const ahead = makeCard('l', { srs: srs(1, NOW.getTime() + 5 * 60_000) });
    expect(buildQueue([ahead], ctx()).next?.card.id).toBe('l');
    const withNew = buildQueue([ahead, makeCard('n')], ctx());
    expect(withNew.next?.card.id).toBe('n');
    const far = makeCard('f', { srs: srs(1, NOW.getTime() + 3 * 3600_000) });
    const snap = buildQueue([far], ctx());
    expect(snap.next).toBeNull();
    expect(snap.nextLearningAt).toBe(far.srs!.due);
  });

  it('countDone memakai stateBefore, dengan fallback log lama', () => {
    expect(
      countDone([
        { stateBefore: 0, isFirstReview: true },
        { stateBefore: 2, isFirstReview: false },
        { stateBefore: 1, isFirstReview: false },
        { isFirstReview: true },
        { isFirstReview: false },
      ])
    ).toEqual({ newDone: 2, reviewsDone: 1 });
  });
});

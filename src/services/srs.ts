import {
  fsrs,
  createEmptyCard,
  generatorParameters,
  Rating,
  type Card as FsrsCard,
  type FSRS,
  type Grade,
  type StepUnit,
} from 'ts-fsrs';
import type { CardSrs, CardState, Flashcard, ReviewRating, StudySettings } from '../types/flashcard';

const STEP_RE = /^\d+[mhd]$/;


export function parseSteps(input: string): string[] | null {
  const parts = input.split(/[\s,]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (parts.some((p) => !STEP_RE.test(p))) return null;
  return parts;
}

const schedulerCache = new Map<string, FSRS>();

export function getScheduler(settings: StudySettings): FSRS {
  const key = JSON.stringify([
    settings.desiredRetention,
    settings.learningSteps,
    settings.relearningSteps,
    settings.maximumInterval,
  ]);
  let f = schedulerCache.get(key);
  if (!f) {
    f = fsrs(
      generatorParameters({
        request_retention: settings.desiredRetention,
        maximum_interval: settings.maximumInterval,
        learning_steps: settings.learningSteps as StepUnit[],
        relearning_steps: settings.relearningSteps as StepUnit[],
        enable_fuzz: true,
        enable_short_term: true,
      })
    );
    schedulerCache.set(key, f);
  }
  return f;
}

export function toFsrsCard(card: Flashcard, now: Date): FsrsCard {
  const s = card.srs;
  if (!s) return createEmptyCard(now);
  return {
    due: new Date(s.due),
    stability: s.stability,
    difficulty: s.difficulty,
    elapsed_days: s.elapsedDays,
    scheduled_days: s.scheduledDays,
    learning_steps: s.learningSteps,
    reps: s.reps,
    lapses: s.lapses,
    state: s.state,
    last_review: s.lastReview ? new Date(s.lastReview) : undefined,
  };
}

export function fromFsrsCard(c: FsrsCard): CardSrs {
  return {
    due: c.due.getTime(),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsedDays: c.elapsed_days,
    scheduledDays: c.scheduled_days,
    learningSteps: c.learning_steps,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state as CardState,
    lastReview: c.last_review ? c.last_review.getTime() : undefined,
  };
}

export function cardState(card: Flashcard): CardState {
  return card.srs?.state ?? 0;
}


export function formatInterval(ms: number): string {
  const min = ms / 60000;
  if (min < 1) return '<1m';
  if (min < 60) return `${Math.round(min)}m`;
  const hours = min / 60;
  if (hours < 24) return `${Math.round(hours)}j`;
  const days = hours / 24;
  if (days < 30) return `${Math.round(days)}h`;
  const months = days / 30;
  if (months < 12) return `${Math.round(months * 10) / 10}bln`.replace('.0', '');
  return `${Math.round((days / 365) * 10) / 10}th`.replace('.0', '');
}


export function previewIntervals(
  card: Flashcard,
  settings: StudySettings,
  now = new Date()
): Record<ReviewRating, string> {
  const rec = getScheduler(settings).repeat(toFsrsCard(card, now), now);
  const out = {} as Record<ReviewRating, string>;
  for (const r of [1, 2, 3, 4] as const) {
    out[r] = formatInterval(rec[r as Grade].card.due.getTime() - now.getTime());
  }
  return out;
}

export interface AnswerResult {
  card: Flashcard;
  scheduledDays: number;
  stateBefore: CardState;
  becameLeech: boolean;
}


export function answerCard(
  card: Flashcard,
  rating: ReviewRating,
  settings: StudySettings,
  now = new Date()
): AnswerResult {
  const stateBefore = cardState(card);
  const { card: next } = getScheduler(settings).next(toFsrsCard(card, now), now, rating as Grade);
  const srs = fromFsrsCard(next);
  const lapsed = srs.lapses > (card.srs?.lapses ?? 0);

  const updated: Flashcard = { ...card, srs };
  let becameLeech = false;
  if (lapsed && settings.leechThreshold > 0 && srs.lapses >= settings.leechThreshold) {
    updated.suspended = true;
    const tags = new Set(updated.tags ?? []);
    tags.add('leech');
    updated.tags = Array.from(tags);
    becameLeech = true;
  }
  return { card: updated, scheduledDays: srs.scheduledDays, stateBefore, becameLeech };
}

export { Rating };

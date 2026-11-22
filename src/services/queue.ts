import type { Flashcard, StudySettings } from '../types/flashcard';
import { cardState } from './srs';


export const LEARN_AHEAD_MS = 20 * 60 * 1000;

export interface DoneToday {
  newDone: number;
  reviewsDone: number;
}

export interface QueueCounts {
  newCount: number;
  learningCount: number;
  reviewCount: number;
}

export type QueueKind = 'learning' | 'review' | 'new';

export interface QueueContext {
  now: number;
  studyDay: string;      
  dayEnd: number;        
  settings: StudySettings;
  done: DoneToday;
  extraNew?: number;     
  autoBurySiblings?: boolean; 
  answeredNoteIdsToday?: Set<string>;
}

function isEligible(c: Flashcard, studyDay: string): boolean {
  if (c.suspended) return false;
  if (c.buriedUntil && c.buriedUntil >= studyDay) return false;
  return true;
}


export function getStudyDayEnd(now: number, dayStartHour: number): number {
  const d = new Date(now);
  const boundary = new Date(d.getFullYear(), d.getMonth(), d.getDate(), dayStartHour, 0, 0, 0);
  if (boundary.getTime() <= now) boundary.setDate(boundary.getDate() + 1);
  return boundary.getTime();
}

export interface QueueSnapshot {
  counts: QueueCounts;
  next: { card: Flashcard; kind: QueueKind } | null;
  
  nextLearningAt: number | null;
}


export function buildQueue(cards: Flashcard[], ctx: QueueContext): QueueSnapshot {
  const { now, studyDay, dayEnd, settings, done, autoBurySiblings, answeredNoteIdsToday } = ctx;
  const eligible = cards.filter((c) => {
    if (!isEligible(c, studyDay)) return false;
    if (autoBurySiblings && c.noteId && answeredNoteIdsToday?.has(c.noteId)) {
      return false;
    }
    return true;
  });

  const learningAll = eligible
    .filter((c) => {
      const s = cardState(c);
      return s === 1 || s === 3;
    })
    .sort((a, b) => (a.srs!.due - b.srs!.due));

  const learningDue = learningAll.filter((c) => c.srs!.due <= now);
  const learningAhead = learningAll.filter((c) => c.srs!.due > now && c.srs!.due <= now + LEARN_AHEAD_MS);

  const reviewLimit = Math.max(settings.reviewsPerDay - done.reviewsDone, 0);
  const reviewDue = eligible
    .filter((c) => cardState(c) === 2 && c.srs!.due < dayEnd)
    .sort((a, b) => a.srs!.due - b.srs!.due)
    .slice(0, reviewLimit);

  const newLimit = Math.max(settings.newPerDay + (ctx.extraNew ?? 0) - done.newDone, 0);
  const newCards = eligible
    .filter((c) => cardState(c) === 0)
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, newLimit);

  const counts: QueueCounts = {
    newCount: newCards.length,
    learningCount: learningDue.length + learningAhead.length,
    reviewCount: reviewDue.length,
  };

  let next: QueueSnapshot['next'] = null;
  if (learningDue.length) next = { card: learningDue[0], kind: 'learning' };
  else if (reviewDue.length) next = { card: reviewDue[0], kind: 'review' };
  else if (newCards.length) next = { card: newCards[0], kind: 'new' };
  else if (learningAhead.length) next = { card: learningAhead[0], kind: 'learning' };

  const futureLearning = learningAll.find((c) => c.srs!.due > now);
  return { counts, next, nextLearningAt: futureLearning ? futureLearning.srs!.due : null };
}


export function countDone(logs: Array<{ stateBefore?: number; isFirstReview: boolean }>): DoneToday {
  let newDone = 0;
  let reviewsDone = 0;
  for (const l of logs) {
    if (l.stateBefore === 0 || (l.stateBefore === undefined && l.isFirstReview)) newDone++;
    else if (l.stateBefore === 2) reviewsDone++;
  }
  return { newDone, reviewsDone };
}

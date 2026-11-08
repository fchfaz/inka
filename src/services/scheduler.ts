import type { Flashcard, ScheduledInterval } from '../types/flashcard';
import {
  getSchedules,
  saveSchedule,
  removeSchedule,
  getSessionCounter,
  saveSessionCounter
} from './database';

export interface SchedulerState {
  currentCard: Flashcard | null;
  scheduledDueCount: number;
  totalCards: number;
  sessionCardCount: number;
  activeSchedules: Record<string, ScheduledInterval>;
}

export class CardIntervalScheduler {
  private deckId: string;
  private cards: Flashcard[] = [];
  private currentCard: Flashcard | null = null;
  private sessionCounter: number = 0;
  private schedules: Record<string, ScheduledInterval> = {};
  private historyIds: string[] = [];

  constructor(deckId: string) {
    this.deckId = deckId;
  }

  async initialize(cards: Flashcard[]) {
    this.cards = [...cards];
    this.schedules = await getSchedules();
    this.sessionCounter = await getSessionCounter(this.deckId);
    await this.pickInitialCard();
  }

  /**
   * Selects initial card immediately when deck is loaded without incrementing session counter.
   * Checks for due scheduled card first, otherwise selects the first available card.
   */
  async pickInitialCard(): Promise<Flashcard | null> {
    if (this.cards.length === 0) {
      this.currentCard = null;
      return null;
    }

    // Check if there is an immediately due card
    const dueList = Object.values(this.schedules)
      .filter(s => s.targetQueueIndex <= this.sessionCounter)
      .sort((a, b) => a.targetQueueIndex - b.targetQueueIndex);

    if (dueList.length > 0) {
      for (const due of dueList) {
        const found = this.cards.find(c => c.id === due.cardId);
        if (found) {
          this.currentCard = found;
          delete this.schedules[due.cardId];
          await removeSchedule(due.cardId);
          return this.currentCard;
        }
      }
    }

    // Otherwise show the first card
    this.currentCard = this.cards[0];
    return this.currentCard;
  }

  setCards(cards: Flashcard[]) {
    this.cards = [...cards];
    if (this.currentCard && !this.cards.find(c => c.id === this.currentCard?.id)) {
      this.currentCard = null;
      this.nextCard();
    }
  }

  getCurrentCard(): Flashcard | null {
    return this.currentCard;
  }

  getSchedules(): Record<string, ScheduledInterval> {
    return { ...this.schedules };
  }

  getSessionCounter(): number {
    return this.sessionCounter;
  }

  getDueSchedulesCount(): number {
    return Object.values(this.schedules).filter(
      s => s.targetQueueIndex <= this.sessionCounter
    ).length;
  }

  /**
   * Schedules current card to repeat after `interval` cards (3, 5, 30, 50).
   * Ketentuan:
   * - Hitungan dimulai setelah kartu saat ini.
   * - Contoh interval 3: Jika di posisi N, target adalah N + 3 + 1 (melewati 3 kartu lain, kartu ke-4 muncul kembali).
   */
  async scheduleCurrentCard(interval: 3 | 5 | 30 | 50): Promise<Flashcard | null> {
    if (!this.currentCard) return null;

    const cardId = this.currentCard.id;
    // targetQueueIndex: after interval other cards are reviewed
    const targetQueueIndex = this.sessionCounter + interval + 1;

    const scheduleData: ScheduledInterval = {
      cardId,
      targetQueueIndex,
      intervalCards: interval,
      scheduledAt: Date.now(),
    };

    this.schedules[cardId] = scheduleData;
    await saveSchedule(scheduleData);

    return this.nextCard();
  }

  /**
   * Advances to next card:
   * 1. Priority 1: Any scheduled card that has reached targetQueueIndex <= sessionCounter.
   * 2. Priority 2: Next card from deck sequence, ensuring no immediate duplicate (unless only 1 card exists).
   */
  async nextCard(): Promise<Flashcard | null> {
    if (this.cards.length === 0) {
      this.currentCard = null;
      return null;
    }

    this.sessionCounter += 1;
    await saveSessionCounter(this.deckId, this.sessionCounter);

    // 1. Check for due scheduled cards
    const dueList = Object.values(this.schedules)
      .filter(s => s.targetQueueIndex <= this.sessionCounter)
      .sort((a, b) => a.targetQueueIndex - b.targetQueueIndex);

    let chosenCard: Flashcard | null = null;

    if (dueList.length > 0) {
      // Find the card in current deck cards
      for (const due of dueList) {
        const found = this.cards.find(c => c.id === due.cardId);
        if (found) {
          chosenCard = found;
          // Clear this schedule since it has matured
          delete this.schedules[due.cardId];
          await removeSchedule(due.cardId);
          break;
        } else {
          // If card no longer exists in this deck, clean up
          delete this.schedules[due.cardId];
          await removeSchedule(due.cardId);
        }
      }
    }

    // 2. If no scheduled card is due, pick from available cards avoiding the immediate same card if possible
    if (!chosenCard) {
      if (this.cards.length === 1) {
        chosenCard = this.cards[0];
      } else {
        const candidates = this.cards.filter(c => c.id !== this.currentCard?.id);
        const randIndex = Math.floor(Math.random() * candidates.length);
        chosenCard = candidates[randIndex] || this.cards[0];
      }
    }

    this.currentCard = chosenCard;
    if (chosenCard) {
      this.historyIds.push(chosenCard.id);
    }

    return this.currentCard;
  }

  /**
   * Shuffle deck order without erasing scheduled repeats.
   * Avoids immediately showing the exact same card if more than 1 card exists.
   */
  shuffleDeck(): Flashcard | null {
    if (this.cards.length <= 1) return this.currentCard;

    // Fisher-Yates shuffle
    const shuffled = [...this.cards];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    this.cards = shuffled;

    // Pick next card from shuffled list not identical to current
    const nextCandidates = this.cards.filter(c => c.id !== this.currentCard?.id);
    this.currentCard = nextCandidates.length > 0 ? nextCandidates[0] : this.cards[0];
    
    return this.currentCard;
  }
}


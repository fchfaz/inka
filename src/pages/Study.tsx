import React, { useState, useEffect, useRef } from 'react';
import { Flashcard } from '../components/Flashcard';
import { ShuffleButton } from '../components/ShuffleButton';
import { ReviewButtons } from '../components/ReviewButtons';
import { CardIntervalScheduler } from '../services/scheduler';
import {
  getCardsByDeck,
  getAllDecks,
  getDailyStudiedCount,
  incrementDailyStudiedCount,
} from '../services/database';
import type { Deck, Flashcard as FlashcardType } from '../types/flashcard';
import { AlertCircle, RefreshCw, ChevronDown, BookOpen } from 'lucide-react';

interface StudyProps {
  currentDeck: Deck | null;
  onSelectDeck: (deck: Deck) => void;
  onNavigateToDeckManager: () => void;
}

export const Study: React.FC<StudyProps> = ({
  currentDeck,
  onSelectDeck,
  onNavigateToDeckManager,
}) => {
  const [cards, setCards] = useState<FlashcardType[]>([]);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [currentCard, setCurrentCard] = useState<FlashcardType | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [disableAnimation, setDisableAnimation] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeckDropdownOpen, setIsDeckDropdownOpen] = useState(false);
  const [dailyStudiedCount, setDailyStudiedCount] = useState<number>(0);

  const schedulerRef = useRef<CardIntervalScheduler | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDeckDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load available decks list and daily count, plus periodic check for 03:00 AM reset
  useEffect(() => {
    async function refreshMeta() {
      const allDecks = await getAllDecks();
      setDecks(allDecks);
      const count = await getDailyStudiedCount();
      setDailyStudiedCount(count);
    }
    refreshMeta();

    // Check every minute or on window focus if 03:00 AM boundary has passed
    const interval = setInterval(async () => {
      const count = await getDailyStudiedCount();
      setDailyStudiedCount(count);
    }, 60000);

    const onFocus = async () => {
      const count = await getDailyStudiedCount();
      setDailyStudiedCount(count);
    };
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  // Initialize deck and scheduler
  useEffect(() => {
    let isMounted = true;

    async function loadDeckData() {
      if (!currentDeck) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      const deckCards = await getCardsByDeck(currentDeck.id);

      if (!isMounted) return;
      setCards(deckCards);

      const scheduler = new CardIntervalScheduler(currentDeck.id);
      await scheduler.initialize(deckCards);

      schedulerRef.current = scheduler;
      setCurrentCard(scheduler.getCurrentCard());
      setIsFlipped(false);
      setIsLoading(false);
    }

    loadDeckData();

    return () => {
      isMounted = false;
    };
  }, [currentDeck]);

  const handleFlip = () => {
    setDisableAnimation(false);
    setIsFlipped(!isFlipped);
  };

  const handleShuffle = () => {
    if (!schedulerRef.current || cards.length <= 1) return;
    setDisableAnimation(true);
    setIsFlipped(false);
    const next = schedulerRef.current.shuffleDeck();
    setCurrentCard(next);
  };

  const handleReviewSelection = async (interval: 3 | 5 | 30 | 50) => {
    if (!schedulerRef.current || !currentCard) return;

    // Instantly reset flip state without transition animation to avoid reverse spin
    setDisableAnimation(true);
    setIsFlipped(false);

    const next = await schedulerRef.current.scheduleCurrentCard(interval);
    setCurrentCard(next);

    // Increment daily studied count (resets at 03:00 AM)
    const newDaily = await incrementDailyStudiedCount();
    setDailyStudiedCount(newDaily);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500">
        <RefreshCw className="w-8 h-8 animate-spin mb-3 text-indigo-500" />
        <p className="text-sm">Memuat flashcard...</p>
      </div>
    );
  }

  if (!currentDeck || cards.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center py-12 px-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm mt-8">
        <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Deck Kosong</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Belum ada kartu di deck ini atau belum ada deck yang dipilih. Anda dapat menambahkan kartu atau mengimpor file JSON.
        </p>
        <button
          onClick={onNavigateToDeckManager}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium shadow-md transition-all duration-150"
        >
          Kelola Flashcard & Deck
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-2xl mx-auto px-4 py-2">
      {/* Top Deck Selector Dropdown */}
      <div className="w-full max-w-xl mx-auto mb-3 flex items-center justify-between relative" ref={dropdownRef}>
        <div className="relative inline-block text-left">
          <button
            type="button"
            onClick={() => setIsDeckDropdownOpen(!isDeckDropdownOpen)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs sm:text-sm font-semibold shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition"
          >
            <BookOpen className="w-4 h-4 text-indigo-500" />
            <span className="max-w-[200px] truncate">{currentDeck.name}</span>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isDeckDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {isDeckDropdownOpen && (
            <div className="absolute left-0 mt-1.5 w-64 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-50 py-1.5 max-h-60 overflow-y-auto">
              <div className="px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Pilih Deck
              </div>
              {decks.map((deck) => (
                <button
                  key={deck.id}
                  onClick={() => {
                    onSelectDeck(deck);
                    setIsDeckDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3.5 py-2 text-xs sm:text-sm flex items-center justify-between transition ${
                    deck.id === currentDeck.id
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="truncate">{deck.name}</span>
                  {deck.id === currentDeck.id && <span className="text-xs">✓</span>}
                </button>
              ))}
              <div className="border-t border-slate-100 dark:border-slate-800 mt-1 pt-1">
                <button
                  onClick={() => {
                    setIsDeckDropdownOpen(false);
                    onNavigateToDeckManager();
                  }}
                  className="w-full text-left px-3.5 py-2 text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  + Buat / Kelola Deck Lain
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="text-xs text-slate-400 dark:text-slate-500 font-medium">
          Total: {cards.length} kartu
        </div>
      </div>

      {/* Flashcard Component */}
      {currentCard && (
        <Flashcard
          key={currentCard.id}
          card={currentCard}
          isFlipped={isFlipped}
          onFlip={handleFlip}
          disableAnimation={disableAnimation}
        />
      )}

      {/* Circular Shuffle Button */}
      <ShuffleButton onShuffle={handleShuffle} disabled={cards.length <= 1} />

      {/* Review Interval Buttons (Again, Hard, Good, Easy) */}
      <ReviewButtons onSelectInterval={handleReviewSelection} disabled={!currentCard} />

      {/* Daily Studied Counter Text - Aligned across button width */}
      <div className="w-full max-w-xl mx-auto px-2 mt-4">
        <div className="w-full flex items-center justify-between text-xs sm:text-sm text-slate-600 dark:text-slate-400 border-t border-slate-200/80 dark:border-slate-800 pt-3">
          <span className="font-medium text-slate-500 dark:text-slate-400">
            Kartu dipelajari hari ini:
          </span>
          <span className="font-bold text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-lg">
            {dailyStudiedCount} kartu
          </span>
        </div>
      </div>
    </div>
  );
};

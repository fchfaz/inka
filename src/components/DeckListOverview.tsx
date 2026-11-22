import React from 'react';
import { BookOpen, ChevronRight, Sparkles } from 'lucide-react';
import type { Deck, Flashcard, StudySettings } from '../types/flashcard';
import { buildQueue, getStudyDayEnd } from '../services/queue';
import { getStudyDayString } from '../services/database';

export interface DeckStudyStats {
  deck: Deck;
  newCount: number;
  learningCount: number;
  reviewCount: number;
}

interface DeckListOverviewProps {
  decks: Deck[];
  allCards: Flashcard[];
  settings: StudySettings;
  onSelectDeck: (deck: Deck) => void;
  onNavigateToDeckManager: () => void;
}

export const DeckListOverview: React.FC<DeckListOverviewProps> = ({
  decks,
  allCards,
  settings,
  onSelectDeck,
  onNavigateToDeckManager,
}) => {
  const now = Date.now();
  const studyDay = getStudyDayString(new Date(now));
  const dayEnd = getStudyDayEnd(now, settings.dayStartHour);

  
  const deckStats: DeckStudyStats[] = decks.map((deck) => {
    
    const descendantIds = new Set<string>([deck.id]);
    let added = true;
    while (added) {
      added = false;
      for (const d of decks) {
        if (d.parentId && descendantIds.has(d.parentId) && !descendantIds.has(d.id)) {
          descendantIds.add(d.id);
          added = true;
        }
      }
    }

    const deckCards = allCards.filter((c) => descendantIds.has(c.deckId));
    const snap = buildQueue(deckCards, {
      now,
      studyDay,
      dayEnd,
      settings,
      done: { newDone: 0, reviewsDone: 0 },
    });

    return {
      deck,
      newCount: snap.counts.newCount,
      learningCount: snap.counts.learningCount,
      reviewCount: snap.counts.reviewCount,
    };
  });

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            Daftar Deck
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Pilih deck untuk mulai belajar atau mengulang kosakata
          </p>
        </div>
        <button
          onClick={onNavigateToDeckManager}
          className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          Kelola Deck
        </button>
      </div>

      <div className="space-y-2.5">
        {deckStats.map(({ deck, newCount, learningCount, reviewCount }) => {
          const isSubdeck = !!deck.parentId;
          const totalDue = newCount + learningCount + reviewCount;

          return (
            <div
              key={deck.id}
              onClick={() => onSelectDeck(deck)}
              className={`group flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 hover:shadow-md cursor-pointer transition ${
                isSubdeck ? 'ml-6 sm:ml-8 border-l-4 border-l-indigo-400 dark:border-l-indigo-600' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                  {deck.name.substring(0, 1).toUpperCase()}
                </div>
                <div>
                  <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                    {deck.name}
                  </h4>
                  {deck.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                      {deck.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 sm:gap-6">
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <span className="text-sky-600 dark:text-sky-400" title="Kartu Baru">
                    {newCount}
                  </span>
                  <span className="text-slate-300 dark:text-slate-700">·</span>
                  <span className="text-rose-600 dark:text-rose-400" title="Kartu Belajar">
                    {learningCount}
                  </span>
                  <span className="text-slate-300 dark:text-slate-700">·</span>
                  <span className="text-emerald-600 dark:text-emerald-400" title="Kartu Review">
                    {reviewCount}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  {totalDue === 0 ? (
                    <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                      Selesai
                    </span>
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition group-hover:translate-x-0.5" />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

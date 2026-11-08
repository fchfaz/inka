import React from 'react';
import { Layers, RotateCcw } from 'lucide-react';

interface ProgressBarProps {
  currentSessionCount: number;
  totalCards: number;
  scheduledDueCount: number;
  activeSchedulesCount: number;
  deckName: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  currentSessionCount,
  totalCards,
  scheduledDueCount,
  activeSchedulesCount,
  deckName,
}) => {
  return (
    <div className="w-full max-w-xl mx-auto px-4 py-3 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl mb-3 shadow-xs">
      <div className="flex items-center justify-between text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5">
        <div className="flex items-center gap-1.5 truncate">
          <Layers className="w-4 h-4 text-indigo-500 shrink-0" />
          <span className="truncate font-semibold text-slate-800 dark:text-slate-100">{deckName}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {activeSchedulesCount > 0 && (
            <span className="flex items-center gap-1 bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-md font-semibold border border-amber-200 dark:border-amber-900">
              <RotateCcw className="w-3 h-3" />
              {activeSchedulesCount} aktif
            </span>
          )}
          {scheduledDueCount > 0 && (
            <span className="bg-rose-500 text-white px-2 py-0.5 rounded-md font-semibold animate-pulse">
              {scheduledDueCount} giliran ulang!
            </span>
          )}
          <span className="text-slate-500 dark:text-slate-400">
            Ditinjau: <b className="text-slate-800 dark:text-slate-200">{currentSessionCount}</b> kartu (Total: {totalCards})
          </span>
        </div>
      </div>
    </div>
  );
};


import React from 'react';
import type { ReviewRating } from '../types/flashcard';
import { playSfx, type SfxName } from '../services/sfx';
import { useTranslation } from '../context/useTranslation';

const RATING_SFX: Record<ReviewRating, SfxName> = { 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' };

interface ReviewButtonsProps {
  onAnswer: (rating: ReviewRating) => void;
  intervals: Record<ReviewRating, string> | null;
  disabled?: boolean;
}

export const ReviewButtons: React.FC<ReviewButtonsProps> = ({ onAnswer, intervals, disabled }) => {
  const { t } = useTranslation();

  const buttons: Array<{ rating: ReviewRating; label: string; className: string }> = [
    { rating: 1, label: t.btnAgain, className: 'bg-[#ef4444] hover:bg-red-600 active:bg-red-700' },
    { rating: 2, label: t.btnHard, className: 'bg-[#6b7280] hover:bg-gray-600 active:bg-gray-700' },
    { rating: 3, label: t.btnGood, className: 'bg-[#10b981] hover:bg-emerald-600 active:bg-emerald-700' },
    { rating: 4, label: t.btnEasy, className: 'bg-[#2563eb] hover:bg-blue-600 active:bg-blue-700' },
  ];

  return (
    <div className="w-full max-w-xl mx-auto px-2">
      <div className="grid grid-cols-4 gap-2.5 sm:gap-4">
        {buttons.map((b) => (
          <button
            key={b.rating}
            data-sfx="none"
            onClick={() => {
              playSfx(RATING_SFX[b.rating]);
              onAnswer(b.rating);
            }}
            disabled={disabled}
            aria-label={`${b.label}${intervals ? `, ulang ${intervals[b.rating]}` : ''} (tombol ${b.rating})`}
            className={`flex flex-col items-center justify-center py-2.5 sm:py-3 px-2 rounded-xl text-white font-sans font-semibold tracking-wide transition-all duration-150 transform hover:-translate-y-0.5 active:translate-y-0 active:scale-98 shadow-md disabled:opacity-40 disabled:pointer-events-none ${b.className}`}
          >
            <span className="text-[11px] font-medium opacity-90 h-4">{intervals ? intervals[b.rating] : ''}</span>
            <span className="text-sm sm:text-base">{b.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

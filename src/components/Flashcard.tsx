import React from 'react';
import { motion } from 'framer-motion';
import type { Flashcard as FlashcardType } from '../types/flashcard';

interface FlashcardProps {
  card: FlashcardType;
  isFlipped: boolean;
  onFlip: () => void;
  disableAnimation?: boolean;
}

export const Flashcard: React.FC<FlashcardProps> = ({
  card,
  isFlipped,
  onFlip,
  disableAnimation = false,
}) => {
  return (
    <div
      onClick={onFlip}
      className="w-full max-w-xl aspect-[1.6/1] sm:h-[340px] cursor-pointer select-none perspective-1000 group my-2"
    >
      <motion.div
        className="w-full h-full relative transform-style-3d shadow-xl rounded-2xl"
        initial={false}
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={
          disableAnimation
            ? { duration: 0 }
            : { duration: 0.5, ease: [0.4, 0, 0.2, 1] }
        }
      >
        {/* FRONT SIDE */}
        <div className="absolute inset-0 w-full h-full backface-hidden rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between">
          <div className="flex items-center justify-end w-full">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300">
              Front
            </span>
          </div>

          <div className="flex flex-col items-center justify-center my-auto">
            <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-slate-900 dark:text-white font-japanese">
              {card.front}
            </h1>
          </div>

          {/* Empty spacer to keep Kanji perfectly centered */}
          <div className="h-4" />
        </div>

        {/* BACK SIDE */}
        <div className="absolute inset-0 w-full h-full backface-hidden rotate-y-180 rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between overflow-y-auto">
          <div className="flex items-center justify-end w-full pb-1">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-950/70 dark:text-sky-300">
              Back
            </span>
          </div>

          <div className="my-auto space-y-3.5">
            {/* Hiragana Main */}
            <div className="text-center pb-1">
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-800 dark:text-white tracking-wide font-japanese">
                {card.back}
              </h2>
            </div>

            <div className="w-full border-t border-slate-100 dark:border-slate-800/80" />

            {/* Arti */}
            <div>
              <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 tracking-wider uppercase mb-1">
                ARTI
              </p>
              <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                {card.meaning}
              </p>
            </div>

            <div className="w-full border-t border-slate-100 dark:border-slate-800/80" />

            {/* Contoh Penggunaan dalam Kalimat */}
            <div className="space-y-1">
              <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 tracking-wider uppercase">
                CONTOH PENGGUNAAN
              </p>
              <p className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100 font-japanese">
                {card.example_jp}
              </p>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-japanese">
                {card.example_hiragana}
              </p>
              <p className="text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200">
                {card.example_id}
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

import React from 'react';
import { motion } from 'framer-motion';
import { Volume2 } from 'lucide-react';
import type { Flashcard as FlashcardType } from '../types/flashcard';
import { isSpeechSupported } from '../services/tts';
import { toSpeechText } from '../services/richText';
import { RichText } from './RichText';

interface FlashcardProps {
  card: FlashcardType;
  isFlipped: boolean;
  onFlip: () => void;
  disableAnimation?: boolean;
  onSpeak?: (text: string) => void;
}

export const Flashcard: React.FC<FlashcardProps> = ({
  card,
  isFlipped,
  onFlip,
  disableAnimation = false,
  onSpeak,
}) => {
  const canSpeak = !!onSpeak && isSpeechSupported();
  const speakButton = (text: string, size = 'w-4 h-4') =>
    canSpeak && toSpeechText(text) ? (
      <button
        type="button"
        data-sfx="none"
        onClick={(e) => {
          e.stopPropagation();
          onSpeak!(toSpeechText(text));
        }}
        className="p-1.5 rounded-full text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        aria-label="Bacakan"
        title="Bacakan (R)"
      >
        <Volume2 className={size} />
      </button>
    ) : null;

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
          <div className="flex items-center justify-between w-full">
            <div>{speakButton(card.front)}</div>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300">
              Front
            </span>
          </div>

          <div className="flex flex-col items-center justify-center my-auto">
            <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-slate-900 dark:text-white font-japanese">
              <RichText text={card.front} />
            </h1>
          </div>

          {card.hint ? (
            <p className="text-center text-xs text-slate-400 dark:text-slate-500">💡 <RichText text={card.hint} /></p>
          ) : (
            <div className="h-4" />
          )}
        </div>

        {/* BACK SIDE */}
        <div className="absolute inset-0 w-full h-full backface-hidden rotate-y-180 rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between overflow-y-auto">
          <div className="flex items-center justify-between w-full pb-1">
            <div>{speakButton(card.example_jp || card.front)}</div>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-950/70 dark:text-sky-300">
              Back
            </span>
          </div>

          <div className="my-auto space-y-3.5">
            {/* Hiragana Main */}
            {card.back && (
              <div className="text-center pb-1">
                <h2 className="text-3xl sm:text-4xl font-bold text-slate-800 dark:text-white tracking-wide font-japanese">
                  <RichText text={card.back} />
                </h2>
              </div>
            )}

            {card.back && card.meaning && <div className="w-full border-t border-slate-100 dark:border-slate-800/80" />}

            {/* Arti */}
            {card.meaning && (
              <div>
                <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 tracking-wider uppercase mb-1">
                  ARTI
                </p>
                <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                  <RichText text={card.meaning} />
                </p>
              </div>
            )}

            {/* Contoh Penggunaan dalam Kalimat */}
            {(card.example_jp || card.example_hiragana || card.example_id) && (
              <>
                <div className="w-full border-t border-slate-100 dark:border-slate-800/80" />
                <div className="space-y-1">
                  <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 tracking-wider uppercase">
                    CONTOH PENGGUNAAN
                  </p>
                  <p className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100 font-japanese">
                    <RichText text={card.example_jp} />
                  </p>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-japanese">
                    <RichText text={card.example_hiragana} />
                  </p>
                  <p className="text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200">
                    <RichText text={card.example_id} />
                  </p>
                </div>
              </>
            )}

            {/* Catatan / media tambahan */}
            {card.extra && (
              <>
                <div className="w-full border-t border-slate-100 dark:border-slate-800/80" />
                <div className="text-sm text-slate-700 dark:text-slate-300 space-y-1">
                  <RichText text={card.extra} />
                </div>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

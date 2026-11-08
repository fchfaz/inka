import React from 'react';
import { Shuffle } from 'lucide-react';

interface ShuffleButtonProps {
  onShuffle: () => void;
  disabled?: boolean;
}

export const ShuffleButton: React.FC<ShuffleButtonProps> = ({ onShuffle, disabled }) => {
  return (
    <div className="flex items-center justify-center my-4">
      <button
        onClick={onShuffle}
        disabled={disabled}
        aria-label="Shuffle cards"
        title="Acak Kartu"
        className="group relative flex items-center justify-center w-13 h-13 rounded-full border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 shadow-sm hover:scale-105 hover:border-slate-400 dark:hover:border-slate-500 active:scale-95 transition-all duration-150 disabled:opacity-40 disabled:hover:scale-100"
      >
        <Shuffle className="w-5 h-5 transition-transform duration-300 group-hover:rotate-45" />
      </button>
    </div>
  );
};

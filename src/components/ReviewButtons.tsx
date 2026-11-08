import React from 'react';

interface ReviewButtonsProps {
  onSelectInterval: (interval: 3 | 5 | 30 | 50) => void;
  disabled?: boolean;
}

export const ReviewButtons: React.FC<ReviewButtonsProps> = ({ onSelectInterval, disabled }) => {
  const buttons: Array<{
    interval: 3 | 5 | 30 | 50;
    label: string;
    bgColor: string;
    hoverColor: string;
    activeColor: string;
  }> = [
    {
      interval: 3,
      label: 'Again',
      bgColor: 'bg-[#ef4444]', // Merah
      hoverColor: 'hover:bg-red-600',
      activeColor: 'active:bg-red-700',
    },
    {
      interval: 5,
      label: 'Hard',
      bgColor: 'bg-[#6b7280]', // Abu-abu
      hoverColor: 'hover:bg-gray-600',
      activeColor: 'active:bg-gray-700',
    },
    {
      interval: 30,
      label: 'Good',
      bgColor: 'bg-[#10b981]', // Hijau
      hoverColor: 'hover:bg-emerald-600',
      activeColor: 'active:bg-emerald-700',
    },
    {
      interval: 50,
      label: 'Easy',
      bgColor: 'bg-[#2563eb]', // Biru
      hoverColor: 'hover:bg-blue-600',
      activeColor: 'active:bg-blue-700',
    },
  ];

  return (
    <div className="w-full max-w-xl mx-auto px-2">
      <div className="grid grid-cols-4 gap-2.5 sm:gap-4">
        {buttons.map((b) => (
          <button
            key={b.interval}
            onClick={() => onSelectInterval(b.interval)}
            disabled={disabled}
            className={`flex items-center justify-center py-3.5 sm:py-4 px-2 rounded-xl text-white font-sans font-semibold text-sm sm:text-base tracking-wide transition-all duration-150 transform hover:-translate-y-0.5 active:translate-y-0 active:scale-98 shadow-md disabled:opacity-40 disabled:pointer-events-none ${b.bgColor} ${b.hoverColor} ${b.activeColor}`}
          >
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
};

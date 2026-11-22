import React from 'react';

interface HBarItem {
  label: string;
  count: number;
  color: string;
  percentage: number;
  subtext?: string;
}

interface HorizontalBarProps {
  items: HBarItem[];
  ariaLabel: string;
}

export const HorizontalBar: React.FC<HorizontalBarProps> = ({ items, ariaLabel }) => {
  return (
    <div className="space-y-3" role="img" aria-label={ariaLabel}>
      {items.map((item, idx) => (
        <div key={idx} className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {item.label} {item.subtext && <span className="text-[11px] text-slate-600 dark:text-slate-400">({item.subtext})</span>}
            </span>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-900 dark:text-white">
                {item.count}
              </span>
              <span className="text-[11px] text-slate-600 dark:text-slate-400 min-w-[32px] text-right">
                {item.percentage}%
              </span>
            </div>
          </div>
          
          <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.max(item.percentage, item.count > 0 ? 3 : 0)}%`,
                backgroundColor: item.color,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

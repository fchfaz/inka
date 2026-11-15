import React, { useState } from 'react';
import type { HourlyStats } from '../../services/stats';

interface HourlyChartProps {
  data: HourlyStats[];
  ariaLabel: string;
}

export const HourlyChart: React.FC<HourlyChartProps> = ({ data, ariaLabel }) => {
  const [hoveredHour, setHoveredHour] = useState<HourlyStats | null>(null);

  const maxReviews = Math.max(1, ...data.map(d => d.totalReviews));

  return (
    <div className="space-y-3" role="img" aria-label={ariaLabel}>
      {/* Tooltip display */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>Jam 00:00 - 23:00 (Waktu Lokal)</span>
        {hoveredHour ? (
          <span className="font-semibold text-slate-900 dark:text-white">
            Pukul {String(hoveredHour.hour).padStart(2, '0')}:00 – {hoveredHour.totalReviews} review (Pass {hoveredHour.passRate}%)
          </span>
        ) : (
          <span className="text-slate-400">Arahkan kursor ke bar untuk melihat rincian</span>
        )}
      </div>

      <div className="h-32 flex items-end gap-1 sm:gap-1.5 pt-4 pb-1">
        {data.map(item => {
          const heightPct = item.totalReviews > 0 ? Math.max((item.totalReviews / maxReviews) * 100, 6) : 0;
          return (
            <div
              key={item.hour}
              onMouseEnter={() => setHoveredHour(item)}
              onMouseLeave={() => setHoveredHour(null)}
              className="flex-1 h-full flex flex-col justify-end items-center group cursor-pointer"
            >
              <div
                className="w-full bg-indigo-500/80 group-hover:bg-indigo-600 dark:bg-indigo-600 dark:group-hover:bg-indigo-400 rounded-t-sm transition-all duration-150"
                style={{ height: `${heightPct}%` }}
              />
              <span className="text-[9px] text-slate-400 mt-1 truncate">
                {item.hour % 3 === 0 ? String(item.hour).padStart(2, '0') : ''}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

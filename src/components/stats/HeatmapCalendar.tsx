import React, { useState } from 'react';
import type { DayActivity } from '../../services/stats';

interface HeatmapCalendarProps {
  activityMap: Map<string, DayActivity>;
  referenceDate?: Date;
  ariaLabel: string;
}

export const HeatmapCalendar: React.FC<HeatmapCalendarProps> = ({
  activityMap,
  referenceDate,
  ariaLabel,
}) => {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  const refDate = referenceDate || new Date();
  const oneDayMs = 24 * 60 * 60 * 1000;
  const days: { dateStr: string; dayOfWeek: number; count: number }[] = [];

  // Align so that the last column ends with today
  const totalDays = 52 * 7;
  const startDateMs = refDate.getTime() - (totalDays - 1) * oneDayMs;

  for (let i = 0; i < totalDays; i++) {
    const curDate = new Date(startDateMs + i * oneDayMs);
    // Adjusted 3 AM day string
    const adjusted = new Date(curDate.getTime() - 3 * 60 * 60 * 1000);
    const y = adjusted.getFullYear();
    const m = String(adjusted.getMonth() + 1).padStart(2, '0');
    const d = String(adjusted.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    const act = activityMap.get(dateStr);
    days.push({
      dateStr,
      dayOfWeek: curDate.getDay(),
      count: act ? act.count : 0,
    });
  }

  // Determine intensity color based on review count
  const getColorClass = (count: number) => {
    if (count === 0) return 'bg-slate-100 dark:bg-slate-800/70 border border-slate-200/50 dark:border-slate-800';
    if (count <= 10) return 'bg-indigo-200 dark:bg-indigo-950 text-indigo-900 border border-indigo-300 dark:border-indigo-900';
    if (count <= 25) return 'bg-indigo-400 dark:bg-indigo-700 text-white';
    if (count <= 50) return 'bg-indigo-500 dark:bg-indigo-500 text-white';
    return 'bg-indigo-600 dark:bg-indigo-400 text-white font-bold';
  };

  // Group into columns of weeks (7 days each)
  const weeks: (typeof days)[] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  return (
    <div className="relative space-y-2" role="img" aria-label={ariaLabel}>
      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-slate-900 text-white dark:bg-slate-800 border border-slate-700 text-[11px] py-1 px-2.5 rounded-lg shadow-xl pointer-events-none transform -translate-x-1/2 -translate-y-full mb-2"
          style={{ left: tooltip.x, top: tooltip.y - 8 }}
        >
          {tooltip.text}
        </div>
      )}

      {/* Heatmap Grid (Scrollable on small mobile) */}
      <div className="overflow-x-auto pb-2 scrollbar-thin">
        <div className="flex gap-[3px] min-w-[620px] p-1">
          {weeks.map((week, wIdx) => (
            <div key={wIdx} className="flex flex-col gap-[3px]">
              {week.map((day, dIdx) => (
                <div
                  key={dIdx}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setTooltip({
                      x: rect.left + rect.width / 2,
                      y: rect.top,
                      text: `${day.dateStr}: ${day.count} review`,
                    });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                  className={`w-2.5 h-2.5 rounded-[2px] transition-transform duration-100 hover:scale-125 cursor-pointer ${getColorClass(
                    day.count
                  )}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Heatmap Legend */}
      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1">
        <span>365 Hari Terakhir (Reset 03:00)</span>
        <div className="flex items-center gap-1.5">
          <span>Sedikit</span>
          <span className="w-2.5 h-2.5 rounded-[2px] bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700" />
          <span className="w-2.5 h-2.5 rounded-[2px] bg-indigo-200 dark:bg-indigo-950" />
          <span className="w-2.5 h-2.5 rounded-[2px] bg-indigo-400 dark:bg-indigo-700" />
          <span className="w-2.5 h-2.5 rounded-[2px] bg-indigo-600 dark:bg-indigo-400" />
          <span>Banyak</span>
        </div>
      </div>
    </div>
  );
};

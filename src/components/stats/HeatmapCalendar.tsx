import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { DayActivity } from '../../services/stats';
import { getStudyDayString } from '../../services/database';
import { useTranslation } from '../../context/useTranslation';

interface HeatmapCalendarProps {
  activityMap: Map<string, DayActivity>;
  referenceDate?: Date;
  ariaLabel: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

export const HeatmapCalendar: React.FC<HeatmapCalendarProps> = ({
  activityMap,
  referenceDate,
  ariaLabel,
}) => {
  const { language } = useTranslation();
  const locale = language === 'id' ? 'id-ID' : 'en-US';

  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  const [now] = useState(() => new Date());
  const refDate = referenceDate ?? now;

  // Hari belajar "hari ini" (memperhitungkan reset pukul 03:00)
  const todayStr = getStudyDayString(refDate);
  const [todayY, todayM] = todayStr.split('-').map(Number);

  // Batas navigasi: bulan berjalan s/d bulan terawal pada rentang data (365 hari)
  const earliest = new Date(refDate.getTime() - 364 * 24 * 60 * 60 * 1000);
  const earliestStr = getStudyDayString(earliest);
  const [minY, minM] = earliestStr.split('-').map(Number);
  const maxIndex = todayY * 12 + (todayM - 1);
  const minIndex = minY * 12 + (minM - 1);

  // Bulan yang sedang ditampilkan, disimpan sebagai indeks (tahun * 12 + bulan)
  const [monthIndex, setMonthIndex] = useState(maxIndex);
  const year = Math.floor(monthIndex / 12);
  const month = monthIndex % 12; // 0-11

  const canPrev = monthIndex > minIndex;
  const canNext = monthIndex < maxIndex;

  const monthLabel = new Date(year, month, 1).toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
  });

  // Susun sel kalender (minggu dimulai Senin)
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = (new Date(year, month, 1).getDay() + 6) % 7;

  const cells: ({ dateStr: string; day: number; count: number; isFuture: boolean; isToday: boolean } | null)[] =
    Array.from({ length: leadingBlanks }, () => null);

  let monthTotal = 0;
  let activeDays = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${pad(month + 1)}-${pad(d)}`;
    const count = activityMap.get(dateStr)?.count ?? 0;
    monthTotal += count;
    if (count > 0) activeDays++;
    cells.push({
      dateStr,
      day: d,
      count,
      isFuture: dateStr > todayStr,
      isToday: dateStr === todayStr,
    });
  }

  const avgInMonth = activeDays > 0 ? Math.round(monthTotal / activeDays) : 0;

  // Nama hari (Senin..Minggu); 5 Jan 2026 adalah hari Senin
  const weekdayLabels = Array.from({ length: 7 }, (_, i) =>
    new Date(2026, 0, 5 + i).toLocaleDateString(locale, { weekday: 'short' })
  );

  const getColorClass = (count: number) => {
    if (count === 0)
      return 'bg-slate-100 dark:bg-slate-800/70 border border-slate-200/50 dark:border-slate-800 text-slate-500 dark:text-slate-400';
    if (count <= 10)
      return 'bg-indigo-200 dark:bg-indigo-950 text-indigo-900 dark:text-indigo-200 border border-indigo-300 dark:border-indigo-900';
    if (count <= 25) return 'bg-indigo-400 dark:bg-indigo-700 text-white';
    if (count <= 50) return 'bg-indigo-500 dark:bg-indigo-500 text-white';
    return 'bg-indigo-600 dark:bg-indigo-400 text-white font-bold';
  };

  const navBtn =
    'p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent';

  return (
    <div className="relative space-y-3" role="img" aria-label={ariaLabel}>
      {tooltip && (
        <div
          className="fixed z-50 bg-slate-900 text-white dark:bg-slate-800 border border-slate-700 text-[11px] py-1 px-2.5 rounded-lg shadow-xl pointer-events-none transform -translate-x-1/2 -translate-y-full mb-2"
          style={{ left: tooltip.x, top: tooltip.y - 8 }}
        >
          {tooltip.text}
        </div>
      )}

      {/* Navigasi bulan:  <  BULAN  > */}
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setMonthIndex((i) => i - 1)}
          disabled={!canPrev}
          aria-label={language === 'id' ? 'Bulan sebelumnya' : 'Previous month'}
          className={navBtn}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="min-w-[140px] text-center text-sm font-semibold capitalize text-slate-900 dark:text-white">
          {monthLabel}
        </span>
        <button
          type="button"
          onClick={() => setMonthIndex((i) => i + 1)}
          disabled={!canNext}
          aria-label={language === 'id' ? 'Bulan berikutnya' : 'Next month'}
          className={navBtn}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Kotak-kotak aktivitas satu bulan */}
      <div className="max-w-sm mx-auto">
        <div className="grid grid-cols-7 gap-1 mb-1">
          {weekdayLabels.map((w) => (
            <div key={w} className="text-center text-[10px] text-slate-500 dark:text-slate-400">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell, idx) =>
            cell === null ? (
              <div key={`blank-${idx}`} />
            ) : (
              <div
                key={cell.dateStr}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setTooltip({
                    x: rect.left + rect.width / 2,
                    y: rect.top,
                    text: `${cell.dateStr}: ${cell.count} review`,
                  });
                }}
                onMouseLeave={() => setTooltip(null)}
                className={`aspect-square flex items-center justify-center rounded-md text-[11px] transition-transform duration-100 hover:scale-105 cursor-pointer ${getColorClass(
                  cell.count
                )} ${cell.isFuture ? 'opacity-40' : ''} ${
                  cell.isToday ? 'ring-2 ring-offset-1 ring-indigo-500 dark:ring-offset-slate-900' : ''
                }`}
              >
                {cell.day}
              </div>
            )
          )}
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1">
        <span>
          {monthTotal} review · {activeDays} hari aktif{activeDays > 0 ? ` · rata-rata ${avgInMonth}/hari` : ''}
        </span>
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
import React, { useState } from 'react';

interface SegmentedBar {
  key: string;
  label: string;
  values: {
    color: string;
    value: number;
    name: string;
  }[];
  secondaryValue?: number; // e.g. minutes
}

interface StackedBarChartProps {
  data: SegmentedBar[];
  mode: 'cards' | 'time';
  onToggleMode: (mode: 'cards' | 'time') => void;
  ariaLabel: string;
}

export const StackedBarChart: React.FC<StackedBarChartProps> = ({
  data,
  mode,
  onToggleMode,
  ariaLabel,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="h-44 flex items-center justify-center text-xs text-slate-400">
        Tidak ada data review pada rentang ini.
      </div>
    );
  }

  // Calculate maximum total value for scale
  const maxVal = Math.max(
    1,
    ...data.map(d =>
      mode === 'cards'
        ? d.values.reduce((sum, v) => sum + v.value, 0)
        : d.secondaryValue || 0
    )
  );

  return (
    <div className="space-y-3" role="img" aria-label={ariaLabel}>
      {/* Mode Toggle Controls */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          Tampilan Metrik
        </span>
        <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => onToggleMode('cards')}
            className={`px-2.5 py-1 rounded-md font-medium transition ${
              mode === 'cards'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Jumlah Kartu
          </button>
          <button
            type="button"
            onClick={() => onToggleMode('time')}
            className={`px-2.5 py-1 rounded-md font-medium transition ${
              mode === 'time'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Waktu (Menit)
          </button>
        </div>
      </div>

      {/* SVG Chart Container */}
      <div className="relative pt-2">
        {/* Hover Tooltip Popup */}
        {hoveredIndex !== null && data[hoveredIndex] && (
          <div className="absolute top-0 right-0 z-10 bg-slate-900 text-white dark:bg-slate-800 border border-slate-700 text-[11px] py-1 px-2.5 rounded-lg shadow-lg pointer-events-none flex items-center gap-2">
            <span className="font-semibold">{data[hoveredIndex].label}</span>
            <span className="text-slate-300">
              {mode === 'cards'
                ? `${data[hoveredIndex].values.reduce((s, v) => s + v.value, 0)} kartu`
                : `${data[hoveredIndex].secondaryValue ?? 0} menit`}
            </span>
          </div>
        )}

        <div className="h-44 w-full flex items-end gap-1.5 sm:gap-2 px-1 pt-6 pb-2 overflow-x-auto scrollbar-thin">
          {data.map((bar, idx) => {
            const totalCards = bar.values.reduce((s, v) => s + v.value, 0);
            const totalVal = mode === 'cards' ? totalCards : bar.secondaryValue || 0;
            const barHeightPct = totalVal > 0 ? Math.max((totalVal / maxVal) * 100, 4) : 0;

            return (
              <div
                key={bar.key || idx}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                className="flex-1 min-w-[14px] max-w-[36px] h-full flex flex-col justify-end items-center group cursor-pointer"
              >
                {/* Bar Stack */}
                <div
                  className="w-full rounded-t-sm flex flex-col-reverse overflow-hidden transition-all duration-200 group-hover:opacity-90"
                  style={{ height: `${barHeightPct}%` }}
                >
                  {mode === 'cards' ? (
                    bar.values.map((v, vIdx) => {
                      if (v.value <= 0) return null;
                      const segmentPct = (v.value / totalCards) * 100;
                      return (
                        <div
                          key={vIdx}
                          style={{
                            height: `${segmentPct}%`,
                            backgroundColor: v.color,
                          }}
                          className="w-full"
                          title={`${v.name}: ${v.value}`}
                        />
                      );
                    })
                  ) : (
                    <div
                      className="w-full h-full bg-indigo-500 rounded-t-sm"
                      title={`${bar.secondaryValue} menit`}
                    />
                  )}
                </div>

                {/* X-axis Label */}
                <span className="text-[10px] text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 mt-1.5 truncate max-w-full text-center">
                  {bar.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      {mode === 'cards' && (
        <div className="flex items-center justify-center gap-3 text-[11px] text-slate-600 dark:text-slate-400 pt-1 flex-wrap">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
            <span>Again</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#6b7280]" />
            <span>Hard</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
            <span>Good</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2563eb]" />
            <span>Easy</span>
          </div>
        </div>
      )}
    </div>
  );
};

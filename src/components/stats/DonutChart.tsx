import React from 'react';

interface Segment {
  label: string;
  count: number;
  color: string;
  percentage: number;
}

interface DonutChartProps {
  segments: Segment[];
  centerLabel?: string;
  centerSublabel?: string;
  ariaLabel: string;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  segments,
  centerLabel,
  centerSublabel,
  ariaLabel,
}) => {
  const total = segments.reduce((sum, s) => sum + s.count, 0);
  const size = 160;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Offset kumulatif dihitung murni (tanpa reassign variabel) sebelum render
  const calculatedSegments = segments.map((seg, i) => {
    const fraction = total > 0 ? seg.count / total : 0;
    const before = segments.slice(0, i).reduce((sum, s) => sum + (total > 0 ? s.count / total : 0), 0);
    return {
      ...seg,
      dasharray: `${fraction * circumference} ${circumference}`,
      dashoffset: -before * circumference,
    };
  });

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6" role="img" aria-label={ariaLabel}>
      {/* SVG Ring */}
      <div className="relative w-40 h-40 shrink-0">
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-slate-100 dark:text-slate-800"
          />
          {total > 0 &&
            calculatedSegments.map((seg, idx) => {
              if (seg.count <= 0) return null;
              return (
                <circle
                  key={idx}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="transparent"
                  stroke={seg.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={seg.dasharray}
                  strokeDashoffset={seg.dashoffset}
                  className="transition-all duration-300"
                />
              );
            })}
        </svg>

        {/* Center Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
          <span className="text-xl font-bold text-slate-900 dark:text-white leading-tight">
            {centerLabel || total}
          </span>
          {centerSublabel && (
            <span className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">
              {centerSublabel}
            </span>
          )}
        </div>
      </div>

      {/* Legend & Details */}
      <div className="flex-1 w-full space-y-2">
        {segments.map((seg, idx) => (
          <div key={idx} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: seg.color }}
              />
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {seg.label}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-900 dark:text-white">
                {seg.count}
              </span>
              <span className="text-[11px] text-slate-600 dark:text-slate-400 min-w-[32px] text-right">
                {seg.percentage}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

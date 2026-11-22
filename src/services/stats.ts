import type { Flashcard, ReviewLog, ReviewRating } from '../types/flashcard';
import { getStudyDayString, getDayStartHour } from './database';
import { getStudyDayEnd } from './queue';

export type TimeRangeKey = '7d' | '1m' | '3m' | '1y' | 'all';

export interface StatsFilter {
  deckId?: string; 
  range: TimeRangeKey;
}

export interface DayActivity {
  date: string; 
  count: number;
  ratingCounts: Record<ReviewRating, number>;
  totalDurationMs: number;
}

export interface HourlyStats {
  hour: number; 
  totalReviews: number;
  passReviews: number; 
  passRate: number; 
}

export interface ProblemCardStat {
  card: Flashcard;
  againCount: number;
  totalReviews: number;
  passRate: number; 
  lastReviewedTs: number;
}

export interface StatsSummary {
  
  todayCardsStudied: number;
  todayDurationMs: number;
  todayPassRate: number; 
  todayAvgSecPerCard: number;
  currentStreakDays: number;
  longestStreakDays: number;
  totalDaysStudied: number;

  
  heatmapData: Map<string, DayActivity>;
  minDateStr: string;
  maxDateStr: string;
  avgDailyReviews: number;

  
  timelineBars: {
    label: string;
    date: string;
    again: number;
    hard: number;
    good: number;
    easy: number;
    total: number;
    durationMinutes: number;
  }[];

  
  buttonDistribution: {
    rating: ReviewRating;
    label: string;
    color: string;
    count: number;
    percentage: number;
  }[];
  overallPassRate: number; 
  firstReviewPassRate: number;
  repeatedReviewPassRate: number;

  
  cardCounts: {
    newCount: number;      
    weakCount: number;     
    goodCount: number;     
    strongCount: number;   
    totalDeckCards: number;
  };

  
  futureDue: {
    dueNow: number;       
    tomorrow: number;     
    in2to7: number;       
    in8to30: number;      
    beyond30: number;     
    totalScheduled: number;
  };

  
  hourly: HourlyStats[];

  
  problemCards: ProblemCardStat[];

  
  addedTimeline: {
    label: string;
    count: number;
  }[];

  
  timeStats: {
    overallAvgMs: number;
    overallMedianMs: number;
    avgByRatingMs: Record<ReviewRating, number>;
  };

  
  totalReviewsInRange: number;
}


export function filterLogsByRange(logs: ReviewLog[], range: TimeRangeKey, now = Date.now()): ReviewLog[] {
  if (range === 'all') return logs;

  const dayMs = 24 * 60 * 60 * 1000;
  let days = 7;
  if (range === '1m') days = 30;
  if (range === '3m') days = 90;
  if (range === '1y') days = 365;

  const minTs = now - days * dayMs;
  return logs.filter(l => l.ts >= minTs);
}


export function calculateStats(
  allLogs: ReviewLog[],
  cards: Flashcard[],
  filter: StatsFilter,
  referenceDate = new Date()
): StatsSummary {
  const filteredLogs = filterLogsByRange(allLogs, filter.range, referenceDate.getTime());
  const todayStudyDay = getStudyDayString(referenceDate);

  
  const allDaysActivity = new Map<string, DayActivity>();
  for (const log of allLogs) {
    const day = log.studyDay;
    let act = allDaysActivity.get(day);
    if (!act) {
      act = {
        date: day,
        count: 0,
        ratingCounts: { 1: 0, 2: 0, 3: 0, 4: 0 },
        totalDurationMs: 0,
      };
      allDaysActivity.set(day, act);
    }
    act.count++;
    act.ratingCounts[log.rating] = (act.ratingCounts[log.rating] || 0) + 1;
    act.totalDurationMs += log.durationMs;
  }

  
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  
  const oneDayMs = 24 * 60 * 60 * 1000;

  
  const todayAct = allDaysActivity.get(todayStudyDay);
  let streakAnchorDate = new Date(referenceDate);
  if (!todayAct || todayAct.count === 0) {
    
    streakAnchorDate = new Date(referenceDate.getTime() - oneDayMs);
  }

  let currCheck = new Date(streakAnchorDate);
  while (true) {
    const dayStr = getStudyDayString(currCheck);
    const act = allDaysActivity.get(dayStr);
    if (act && act.count > 0) {
      currentStreak++;
      currCheck = new Date(currCheck.getTime() - oneDayMs);
    } else {
      break;
    }
  }

  
  const sortedDays = Array.from(allDaysActivity.keys()).sort();
  for (let i = 0; i < sortedDays.length; i++) {
    if (i === 0) {
      tempStreak = 1;
    } else {
      const prev = new Date(sortedDays[i - 1] + 'T12:00:00Z').getTime();
      const curr = new Date(sortedDays[i] + 'T12:00:00Z').getTime();
      const diffDays = Math.round((curr - prev) / oneDayMs);
      if (diffDays === 1) {
        tempStreak++;
      } else {
        tempStreak = 1;
      }
    }
    if (tempStreak > longestStreak) {
      longestStreak = tempStreak;
    }
  }
  if (currentStreak > longestStreak) {
    longestStreak = currentStreak;
  }

  
  const todayLogs = allLogs.filter(l => l.studyDay === todayStudyDay);
  const todayCardsStudied = todayLogs.length;
  const todayDurationMs = todayLogs.reduce((acc, l) => acc + l.durationMs, 0);
  const todayPassCount = todayLogs.filter(l => l.rating >= 2).length;
  const todayPassRate = todayCardsStudied > 0 ? Math.round((todayPassCount / todayCardsStudied) * 100) : 0;
  const todayAvgSecPerCard = todayCardsStudied > 0 ? Math.round((todayDurationMs / todayCardsStudied) / 1000) : 0;
  const totalDaysStudied = allDaysActivity.size;

  
  const heatmapData = new Map<string, DayActivity>();
  
  const heatmapStart = new Date(referenceDate.getTime() - 364 * oneDayMs);
  const minDateStr = getStudyDayString(heatmapStart);
  const maxDateStr = todayStudyDay;

  for (const [day, act] of allDaysActivity.entries()) {
    if (day >= minDateStr && day <= maxDateStr) {
      heatmapData.set(day, act);
    }
  }

  const totalReviewsInHeatmap = Array.from(heatmapData.values()).reduce((sum, d) => sum + d.count, 0);
  const daysWithReviewsCount = Array.from(heatmapData.values()).filter(d => d.count > 0).length;
  const avgDailyReviews = daysWithReviewsCount > 0 ? Math.round(totalReviewsInHeatmap / daysWithReviewsCount) : 0;

  
  const timelineMap = new Map<string, { again: number; hard: number; good: number; easy: number; total: number; durationMs: number }>();
  
  
  const rangeDaysCount = filter.range === '7d' ? 7 : filter.range === '1m' ? 30 : filter.range === '3m' ? 90 : 365;

  
  if (filter.range === '7d' || filter.range === '1m') {
    for (let d = rangeDaysCount - 1; d >= 0; d--) {
      const dt = new Date(referenceDate.getTime() - d * oneDayMs);
      const dayKey = getStudyDayString(dt);
      timelineMap.set(dayKey, { again: 0, hard: 0, good: 0, easy: 0, total: 0, durationMs: 0 });
    }
  }

  for (const log of filteredLogs) {
    const key = log.studyDay;
    let entry = timelineMap.get(key);
    if (!entry) {
      entry = { again: 0, hard: 0, good: 0, easy: 0, total: 0, durationMs: 0 };
      timelineMap.set(key, entry);
    }
    if (log.rating === 1) entry.again++;
    else if (log.rating === 2) entry.hard++;
    else if (log.rating === 3) entry.good++;
    else if (log.rating === 4) entry.easy++;
    entry.total++;
    entry.durationMs += log.durationMs;
  }

  const sortedTimelineKeys = Array.from(timelineMap.keys()).sort();
  const timelineBars = sortedTimelineKeys.map(key => {
    const val = timelineMap.get(key)!;
    
    const parts = key.split('-');
    const label = `${parts[2]}/${parts[1]}`;
    return {
      label,
      date: key,
      again: val.again,
      hard: val.hard,
      good: val.good,
      easy: val.easy,
      total: val.total,
      durationMinutes: Math.round((val.durationMs / 60000) * 10) / 10,
    };
  });

  
  const ratingCounts: Record<ReviewRating, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  let firstPass = 0;
  let firstTotal = 0;
  let repeatPass = 0;
  let repeatTotal = 0;

  for (const log of filteredLogs) {
    ratingCounts[log.rating] = (ratingCounts[log.rating] || 0) + 1;
    const isPass = log.rating >= 2;
    if (log.isFirstReview) {
      firstTotal++;
      if (isPass) firstPass++;
    } else {
      repeatTotal++;
      if (isPass) repeatPass++;
    }
  }

  const totalReviewsInRange = filteredLogs.length;
  const buttonDistribution = [
    {
      rating: 1 as ReviewRating,
      label: 'Again',
      color: '#ef4444',
      count: ratingCounts[1],
      percentage: totalReviewsInRange > 0 ? Math.round((ratingCounts[1] / totalReviewsInRange) * 100) : 0,
    },
    {
      rating: 2 as ReviewRating,
      label: 'Hard',
      color: '#6b7280',
      count: ratingCounts[2],
      percentage: totalReviewsInRange > 0 ? Math.round((ratingCounts[2] / totalReviewsInRange) * 100) : 0,
    },
    {
      rating: 3 as ReviewRating,
      label: 'Good',
      color: '#10b981',
      count: ratingCounts[3],
      percentage: totalReviewsInRange > 0 ? Math.round((ratingCounts[3] / totalReviewsInRange) * 100) : 0,
    },
    {
      rating: 4 as ReviewRating,
      label: 'Easy',
      color: '#2563eb',
      count: ratingCounts[4],
      percentage: totalReviewsInRange > 0 ? Math.round((ratingCounts[4] / totalReviewsInRange) * 100) : 0,
    },
  ];

  const overallPassRate = totalReviewsInRange > 0
    ? Math.round(((ratingCounts[2] + ratingCounts[3] + ratingCounts[4]) / totalReviewsInRange) * 100)
    : 0;
  const firstReviewPassRate = firstTotal > 0 ? Math.round((firstPass / firstTotal) * 100) : 0;
  const repeatedReviewPassRate = repeatTotal > 0 ? Math.round((repeatPass / repeatTotal) * 100) : 0;

  
  const latestLogPerCard = new Map<string, ReviewLog>();
  for (const log of allLogs) {
    const existing = latestLogPerCard.get(log.cardId);
    if (!existing || log.ts > existing.ts) {
      latestLogPerCard.set(log.cardId, log);
    }
  }

  let newCount = 0;
  let weakCount = 0;
  let goodCount = 0;
  let strongCount = 0;

  for (const card of cards) {
    const lastRev = latestLogPerCard.get(card.id);
    if (!lastRev) {
      newCount++;
    } else if (lastRev.rating <= 2) {
      
      weakCount++;
    } else if (lastRev.rating === 3) {
      
      goodCount++;
    } else {
      
      strongCount++;
    }
  }

  
  let dueNow = 0;
  let tomorrow = 0;
  let in2to7 = 0;
  let in8to30 = 0;
  let beyond30 = 0;
  let totalScheduled = 0;
  const dayEnd = getStudyDayEnd(referenceDate.getTime(), getDayStartHour());
  const DAY_MS = 24 * 60 * 60 * 1000;

  for (const c of cards) {
    if (!c.srs || c.srs.state === 0 || c.suspended) continue;
    totalScheduled++;
    const due = c.srs.due;
    if (due < dayEnd) dueNow++;
    else if (due < dayEnd + DAY_MS) tomorrow++;
    else if (due < dayEnd + 7 * DAY_MS) in2to7++;
    else if (due < dayEnd + 30 * DAY_MS) in8to30++;
    else beyond30++;
  }

  
  const hourMap: Record<number, { total: number; pass: number }> = {};
  for (let h = 0; h < 24; h++) hourMap[h] = { total: 0, pass: 0 };

  for (const log of filteredLogs) {
    const localHour = new Date(log.ts).getHours();
    hourMap[localHour].total++;
    if (log.rating >= 2) hourMap[localHour].pass++;
  }

  const hourly: HourlyStats[] = [];
  for (let h = 0; h < 24; h++) {
    const tot = hourMap[h].total;
    const pass = hourMap[h].pass;
    hourly.push({
      hour: h,
      totalReviews: tot,
      passReviews: pass,
      passRate: tot > 0 ? Math.round((pass / tot) * 100) : 0,
    });
  }

  
  const cardLogStats = new Map<string, { again: number; total: number; pass: number; lastTs: number }>();
  for (const log of allLogs) {
    let stat = cardLogStats.get(log.cardId);
    if (!stat) {
      stat = { again: 0, total: 0, pass: 0, lastTs: 0 };
      cardLogStats.set(log.cardId, stat);
    }
    if (log.rating === 1) stat.again++;
    if (log.rating >= 2) stat.pass++;
    stat.total++;
    if (log.ts > stat.lastTs) stat.lastTs = log.ts;
  }

  const cardsMap = new Map<string, Flashcard>();
  for (const c of cards) cardsMap.set(c.id, c);

  const problemCards: ProblemCardStat[] = [];
  for (const [cardId, stat] of cardLogStats.entries()) {
    const card = cardsMap.get(cardId);
    if (card && stat.again > 0) {
      problemCards.push({
        card,
        againCount: stat.again,
        totalReviews: stat.total,
        passRate: Math.round((stat.pass / stat.total) * 100),
        lastReviewedTs: stat.lastTs,
      });
    }
  }
  
  problemCards.sort((a, b) => b.againCount - a.againCount || a.passRate - b.passRate);
  const top10ProblemCards = problemCards.slice(0, 10);

  
  const addedMap = new Map<string, number>();
  for (const card of cards) {
    const dayStr = getStudyDayString(new Date(card.createdAt));
    addedMap.set(dayStr, (addedMap.get(dayStr) || 0) + 1);
  }
  const sortedAddedDays = Array.from(addedMap.keys()).sort();
  const addedTimeline = sortedAddedDays.slice(-30).map(day => {
    const parts = day.split('-');
    return {
      label: `${parts[2]}/${parts[1]}`,
      count: addedMap.get(day)!,
    };
  });

  
  const durations = filteredLogs.map(l => l.durationMs).sort((a, b) => a - b);
  const totalDurationAll = durations.reduce((acc, d) => acc + d, 0);
  const overallAvgMs = durations.length > 0 ? Math.round(totalDurationAll / durations.length) : 0;
  
  let overallMedianMs = 0;
  if (durations.length > 0) {
    const mid = Math.floor(durations.length / 2);
    overallMedianMs = durations.length % 2 !== 0 ? durations[mid] : Math.round((durations[mid - 1] + durations[mid]) / 2);
  }

  const durationSumsByRating: Record<ReviewRating, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const durationCountsByRating: Record<ReviewRating, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const log of filteredLogs) {
    durationSumsByRating[log.rating] += log.durationMs;
    durationCountsByRating[log.rating]++;
  }

  const avgByRatingMs: Record<ReviewRating, number> = {
    1: durationCountsByRating[1] > 0 ? Math.round(durationSumsByRating[1] / durationCountsByRating[1]) : 0,
    2: durationCountsByRating[2] > 0 ? Math.round(durationSumsByRating[2] / durationCountsByRating[2]) : 0,
    3: durationCountsByRating[3] > 0 ? Math.round(durationSumsByRating[3] / durationCountsByRating[3]) : 0,
    4: durationCountsByRating[4] > 0 ? Math.round(durationSumsByRating[4] / durationCountsByRating[4]) : 0,
  };

  return {
    todayCardsStudied,
    todayDurationMs,
    todayPassRate,
    todayAvgSecPerCard,
    currentStreakDays: currentStreak,
    longestStreakDays: longestStreak,
    totalDaysStudied,
    heatmapData,
    minDateStr,
    maxDateStr,
    avgDailyReviews,
    timelineBars,
    buttonDistribution,
    overallPassRate,
    firstReviewPassRate,
    repeatedReviewPassRate,
    cardCounts: {
      newCount,
      weakCount,
      goodCount,
      strongCount,
      totalDeckCards: cards.length,
    },
    futureDue: {
      dueNow,
      tomorrow,
      in2to7,
      in8to30,
      beyond30,
      totalScheduled,
    },
    hourly,
    problemCards: top10ProblemCards,
    addedTimeline,
    timeStats: {
      overallAvgMs,
      overallMedianMs,
      avgByRatingMs,
    },
    totalReviewsInRange,
  };
}

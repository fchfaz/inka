import { toPlainText } from '../services/richText';
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useTranslation } from '../context/useTranslation';
import type { Deck, Flashcard, ReviewLog } from '../types/flashcard';
import {
  getAllDecks,
  getAllCards,
  getCardsByDeck,
  getAllReviewLogs,
  seedDummyReviewLogs,
  clearAllReviewLogs,
} from '../services/database';
import {
  calculateStats,
  type TimeRangeKey,
  type StatsFilter,
} from '../services/stats';
import { StackedBarChart } from '../components/stats/StackedBarChart';
import { HeatmapCalendar } from '../components/stats/HeatmapCalendar';
import { DonutChart } from '../components/stats/DonutChart';
import { HorizontalBar } from '../components/stats/HorizontalBar';
import { HourlyChart } from '../components/stats/HourlyChart';
import {
  BarChart3,
  CalendarDays,
  Clock,
  Layers,
  Flame,
  Target,
  AlertTriangle,
  ChevronDown,
  Sparkles,
  BookOpen,
  Info,
  CheckCircle2,
  ListOrdered,
  PlusCircle,
} from 'lucide-react';

interface StatisticsProps {
  currentDeck: Deck | null;
  onNavigateToStudy: () => void;
}

export const Statistics: React.FC<StatisticsProps> = ({
  currentDeck,
  onNavigateToStudy,
}) => {
  const { t } = useTranslation();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string>(() => {
    return currentDeck?.id || 'all';
  });
  const [timeRange, setTimeRange] = useState<TimeRangeKey>(() => {
    try {
      const saved = localStorage.getItem('inka_stats_range');
      if (saved && ['7d', '1m', '3m', '1y', 'all'].includes(saved)) {
        return saved as TimeRangeKey;
      }
    } catch {
      // ignore
    }
    return '1m';
  });

  const [metricMode, setMetricMode] = useState<'cards' | 'time'>('cards');
  const [logs, setLogs] = useState<ReviewLog[]>([]);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDeckDropdownOpen, setIsDeckDropdownOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDeckDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Save selected time range to localStorage
  const handleRangeChange = (r: TimeRangeKey) => {
    setTimeRange(r);
    try {
      localStorage.setItem('inka_stats_range', r);
    } catch {
      // ignore
    }
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Ambil semua data yang dibutuhkan dari IndexedDB (murni: tidak menyentuh state)
  const fetchStatsData = useCallback(async () => {
    const targetDeck = selectedDeckId === 'all' ? undefined : selectedDeckId;
    const [allDecks, fetchedLogs, fetchedCards] = await Promise.all([
      getAllDecks(),
      getAllReviewLogs(targetDeck),
      targetDeck ? getCardsByDeck(targetDeck) : getAllCards(),
    ]);
    return { allDecks, fetchedLogs, fetchedCards };
  }, [selectedDeckId]);

  const loadStatsData = useCallback(async () => {
    try {
      const data = await fetchStatsData();
      setDecks(data.allDecks);
      setLogs(data.fetchedLogs);
      setCards(data.fetchedCards);
    } catch (err) {
      console.error('Failed to load stats data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [fetchStatsData]);

  useEffect(() => {
    let cancelled = false;
    fetchStatsData()
      .then((data) => {
        if (cancelled) return;
        setDecks(data.allDecks);
        setLogs(data.fetchedLogs);
        setCards(data.fetchedCards);
      })
      .catch((err) => console.error('Failed to load stats data:', err))
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchStatsData]);

  // Pindah deck: tampilkan loading sampai data deck baru siap
  const changeDeck = (id: string) => {
    if (id === selectedDeckId) return;
    setIsLoading(true);
    setSelectedDeckId(id);
  };

  // Pure aggregation computed via useMemo
  const stats = useMemo(() => {
    const filter: StatsFilter = {
      deckId: selectedDeckId === 'all' ? undefined : selectedDeckId,
      range: timeRange,
    };
    return calculateStats(logs, cards, filter);
  }, [logs, cards, selectedDeckId, timeRange]);

  // Dev dummy data seeder
  const handleSeedData = async () => {
    if (cards.length === 0) {
      alert('Tidak ada kartu untuk di-seed review logs.');
      return;
    }
    const deckId = selectedDeckId === 'all' ? (decks[0]?.id || 'deck-default') : selectedDeckId;
    const count = await seedDummyReviewLogs(deckId, cards);
    await loadStatsData();
    showToast(`✓ Berhasil menambahkan ${count} riwayat review simulasi!`);
  };

  const handleClearLogs = async () => {
    if (confirm('Yakin ingin mengosongkan semua riwayat review?')) {
      await clearAllReviewLogs();
      await loadStatsData();
      showToast('Riwayat review telah dibersihkan.');
    }
  };

  const currentDeckName = useMemo(() => {
    if (selectedDeckId === 'all') return 'Semua Deck';
    return decks.find(d => d.id === selectedDeckId)?.name || 'Deck Ini';
  }, [selectedDeckId, decks]);

  if (isLoading) {
    return (
      <div className="w-full max-w-4xl mx-auto py-16 flex flex-col items-center justify-center text-slate-500">
        <Clock className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
        <span className="text-sm">Menghitung statistik pembelajaran...</span>
      </div>
    );
  }

  // Empty state check
  const hasEverReviewed = logs.length > 0;

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-4 space-y-6">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-2 bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-4 py-2.5 rounded-xl shadow-xl text-xs sm:text-sm font-semibold border border-slate-700">
          <CheckCircle2 size={16} className="text-emerald-500" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Top Header & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-indigo-500" />
            {t.statsTitle}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            {t.statsSubtitle}
          </p>
        </div>

        {/* Controls: Deck Selector Dropdown & Time Range Segmented */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Deck Selector Dropdown */}
          <div className="relative inline-block text-left" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsDeckDropdownOpen(!isDeckDropdownOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs sm:text-sm font-semibold shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition"
            >
              <BookOpen className="w-4 h-4 text-indigo-500" />
              <span className="max-w-[140px] truncate">{currentDeckName}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isDeckDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isDeckDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-56 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-50 py-1.5 max-h-60 overflow-y-auto">
                <button
                  onClick={() => {
                    changeDeck('all');
                    setIsDeckDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3.5 py-2 text-xs sm:text-sm flex items-center justify-between transition ${
                    selectedDeckId === 'all'
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>{t.allDecksOption}</span>
                  {selectedDeckId === 'all' && <span>✓</span>}
                </button>
                {decks.map(d => (
                  <button
                    key={d.id}
                    onClick={() => {
                      changeDeck(d.id);
                      setIsDeckDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2 text-xs sm:text-sm flex items-center justify-between transition ${
                      selectedDeckId === d.id
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="truncate">{d.name}</span>
                    {selectedDeckId === d.id && <span>✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Time Range Segmented Control */}
          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800/80 p-0.5 text-xs">
            {(['7d', '1m', '3m', '1y', 'all'] as TimeRangeKey[]).map(r => {
              const labels: Record<TimeRangeKey, string> = {
                '7d': t.range7d,
                '1m': t.range1m,
                '3m': t.range3m,
                '1y': t.range1y,
                all: t.rangeAll,
              };
              return (
                <button
                  key={r}
                  onClick={() => handleRangeChange(r)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition ${
                    timeRange === r
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {labels[r]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Empty State Banner if no review logs exist yet */}
      {!hasEverReviewed && (
        <div className="bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900 rounded-2xl p-6 text-center space-y-3">
          <Sparkles className="w-8 h-8 text-indigo-500 mx-auto" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Belum Ada Riwayat Belajar
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
            Mulai pelajari flashcard di layar Belajar untuk melihat data statistik, heatmap aktivitas, dan grafik penguasaan kartu secara riil.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={onNavigateToStudy}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition shadow-xs"
            >
              Mulai Belajar Sekarang
            </button>
            <button
              onClick={handleSeedData}
              className="px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs sm:text-sm font-medium hover:bg-slate-50 transition"
            >
              Isi Data Simulasi (Testing)
            </button>
          </div>
        </div>
      )}

      {/* 1. Ringkasan Atas (KPI 4 Ubin) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Hari Ini */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Hari Ini</span>
            <Target className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {stats.todayCardsStudied}
          </div>
          <span className="text-[11px] text-slate-400">kartu dipelajari</span>
        </div>

        {/* Waktu Belajar Hari Ini */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Waktu Hari Ini</span>
            <Clock className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {Math.round(stats.todayDurationMs / 60000)} <span className="text-sm font-normal">mnt</span>
          </div>
          <span className="text-[11px] text-slate-400">
            {stats.todayAvgSecPerCard > 0 ? `${stats.todayAvgSecPerCard} dtk/kartu` : '0 dtk/kartu'}
          </span>
        </div>

        {/* Tingkat Benar (Pass Rate) Hari Ini */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Pass Rate Hari Ini</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {stats.todayPassRate}%
          </div>
          <span className="text-[11px] text-slate-400">Hard, Good, Easy</span>
        </div>

        {/* Streak Berturut-turut */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Streak</span>
            <Flame className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {stats.currentStreakDays} <span className="text-sm font-normal">hari</span>
          </div>
          <span className="text-[11px] text-slate-400">Terpanjang: {stats.longestStreakDays} hari</span>
        </div>
      </div>

      {/* Kalimat Ringkas Hari Ini */}
      {stats.todayCardsStudied > 0 && (
        <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 bg-slate-100/80 dark:bg-slate-800/60 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span>
            Hari ini Anda telah mempelajari <b>{stats.todayCardsStudied} kartu</b> dalam <b>{Math.max(1, Math.round(stats.todayDurationMs / 60000))} menit</b> ({stats.todayAvgSecPerCard} detik/kartu).
          </span>
          <span className="text-[11px] text-slate-400 hidden sm:inline">Reset harian: 03:00 pagi</span>
        </div>
      )}

      {/* 2. Kalender Aktivitas (Heatmap 12 Bulan) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-indigo-500" />
              Kalender Aktivitas
            </h3>
            <p className="text-xs text-slate-500">
              Intensitas review harian dengan batas pergantian hari pukul 03:00 pagi.
            </p>
          </div>
          <div className="text-right text-xs">
            <span className="text-slate-400">Rata-rata: </span>
            <b className="text-slate-900 dark:text-white">{stats.avgDailyReviews} review/hari</b>
          </div>
        </div>

        <HeatmapCalendar
          activityMap={stats.heatmapData}
          ariaLabel="Heatmap aktivitas belajar 12 bulan terakhir"
        />
      </div>

      {/* 3. Jumlah Review (Stacked Bar Chart: Kartu vs Waktu) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3">
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-500" />
            Jumlah Review & Waktu Belajar
          </h3>
          <p className="text-xs text-slate-500">
            Volume kartu yang dijawab dan distribusi tombol review pada rentang waktu terpilih.
          </p>
        </div>

        <StackedBarChart
          data={stats.timelineBars.map(b => ({
            key: b.date,
            label: b.label,
            values: [
              { name: 'Again', value: b.again, color: '#ef4444' },
              { name: 'Hard', value: b.hard, color: '#6b7280' },
              { name: 'Good', value: b.good, color: '#10b981' },
              { name: 'Easy', value: b.easy, color: '#2563eb' },
            ],
            secondaryValue: b.durationMinutes,
          }))}
          mode={metricMode}
          onToggleMode={setMetricMode}
          ariaLabel="Grafik review bertumpuk per tanggal"
        />
      </div>

      {/* Grid 2 Kolom: 4. Tombol Jawaban & 5. Status Kartu */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 4. Tombol Jawaban (Answer Buttons Distribution & Pass Rate) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <Target className="w-4 h-4 text-emerald-500" />
                Distribusi Tombol Jawaban
              </h3>
              <p className="text-xs text-slate-500">
                Tingkat kelulusan (Pass Rate) = (Hard + Good + Easy) / Total.
              </p>
            </div>
            <div className="text-right">
              <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {stats.overallPassRate}%
              </span>
              <span className="text-[10px] block text-slate-400">Pass Rate</span>
            </div>
          </div>

          <HorizontalBar
            items={stats.buttonDistribution.map(b => ({
              label: b.label,
              count: b.count,
              color: b.color,
              percentage: b.percentage,
            }))}
            ariaLabel="Distribusi tombol jawaban"
          />

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <span className="text-slate-400 text-[11px] block">Kartu Pertama Kali</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                {stats.firstReviewPassRate}% lulus
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <span className="text-slate-400 text-[11px] block">Kartu Diulang</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                {stats.repeatedReviewPassRate}% lulus
              </span>
            </div>
          </div>
        </div>

        {/* 5. Jumlah Kartu (Status Penguasaan Donut Chart) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-500" />
                Status Penguasaan Kartu
              </h3>
              <p className="text-xs text-slate-500">
                Dihitung berdasarkan rating review terakhir tiap kartu.
              </p>
            </div>
            <span className="text-xs text-slate-400">
              Total {stats.cardCounts.totalDeckCards} kartu
            </span>
          </div>

          <DonutChart
            segments={[
              {
                label: 'Baru (Belum Direview)',
                count: stats.cardCounts.newCount,
                color: '#94a3b8',
                percentage: stats.cardCounts.totalDeckCards > 0 ? Math.round((stats.cardCounts.newCount / stats.cardCounts.totalDeckCards) * 100) : 0,
              },
              {
                label: 'Lemah (Again / Hard)',
                count: stats.cardCounts.weakCount,
                color: '#ef4444',
                percentage: stats.cardCounts.totalDeckCards > 0 ? Math.round((stats.cardCounts.weakCount / stats.cardCounts.totalDeckCards) * 100) : 0,
              },
              {
                label: 'Baik (Good)',
                count: stats.cardCounts.goodCount,
                color: '#10b981',
                percentage: stats.cardCounts.totalDeckCards > 0 ? Math.round((stats.cardCounts.goodCount / stats.cardCounts.totalDeckCards) * 100) : 0,
              },
              {
                label: 'Kuat (Easy)',
                count: stats.cardCounts.strongCount,
                color: '#2563eb',
                percentage: stats.cardCounts.totalDeckCards > 0 ? Math.round((stats.cardCounts.strongCount / stats.cardCounts.totalDeckCards) * 100) : 0,
              },
            ]}
            centerLabel={String(stats.cardCounts.totalDeckCards)}
            centerSublabel="Kartu"
            ariaLabel="Status penguasaan kartu"
          />

          <p className="text-[11px] text-slate-400 bg-slate-50 dark:bg-slate-800/40 p-2 rounded-lg leading-relaxed">
            <b>Definisi:</b> Baru = Belum pernah direview. Lemah = Terakhir dinilai Again/Hard. Baik = Terakhir Good. Kuat = Terakhir Easy.
          </p>
        </div>
      </div>

      {/* Grid 2 Kolom: 6. Antrean Mendatang & 7. Pola Jam Belajar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 6. Antrean Mendatang (Future Due Queue) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <ListOrdered className="w-4 h-4 text-violet-500" />
                Jadwal Review Mendatang
              </h3>
              <p className="text-xs text-slate-500">
                Kartu yang sudah dipelajari dikelompokkan menurut tanggal jatuh temponya (FSRS).
              </p>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300">
              {stats.futureDue.totalScheduled} terjadwal
            </span>
          </div>

          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs">
              <span className="font-medium text-rose-800 dark:text-rose-200">
                Jatuh tempo hari ini
              </span>
              <span className="font-bold text-rose-700 dark:text-rose-300 text-sm">
                {stats.futureDue.dueNow} kartu
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs">
              <span className="text-slate-700 dark:text-slate-300">Besok</span>
              <span className="font-semibold text-slate-900 dark:text-white">{stats.futureDue.tomorrow} kartu</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs">
              <span className="text-slate-700 dark:text-slate-300">2 – 7 hari lagi</span>
              <span className="font-semibold text-slate-900 dark:text-white">{stats.futureDue.in2to7} kartu</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs">
              <span className="text-slate-700 dark:text-slate-300">8 – 30 hari lagi</span>
              <span className="font-semibold text-slate-900 dark:text-white">{stats.futureDue.in8to30} kartu</span>
            </div>

            {stats.futureDue.beyond30 > 0 && (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs">
                <span className="text-slate-700 dark:text-slate-300">Lebih dari 30 hari</span>
                <span className="font-semibold text-slate-900 dark:text-white">{stats.futureDue.beyond30} kartu</span>
              </div>
            )}
          </div>
        </div>

        {/* 7. Pola Jam Belajar (Hourly Breakdown) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-500" />
              Pola Jam Belajar
            </h3>
            <p className="text-xs text-slate-500">
              Aktivitas belajar per jam sepanjang hari (waktu lokal perangkat).
            </p>
          </div>

          <HourlyChart data={stats.hourly} ariaLabel="Pola jam belajar 24 jam" />
        </div>
      </div>

      {/* Grid 2 Kolom: 8. Kartu Bermasalah (Leeches) & 9/10. Waktu & Kartu Ditambahkan */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 8. Kartu Bermasalah (Leeches / Sering Again) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              Kartu Paling Sering Diulang (Leeches)
            </h3>
            <p className="text-xs text-slate-500">
              Kosakata dengan jumlah tombol 'Again' terbanyak yang memerlukan latihan ekstra.
            </p>
          </div>

          {stats.problemCards.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              Belum ada kartu dengan catatan 'Again'. Luar biasa!
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-72 overflow-y-auto scrollbar-thin">
              {stats.problemCards.map((item, idx) => (
                <div key={item.card.id || idx} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-[11px] font-bold text-slate-400 w-4">{idx + 1}.</span>
                    <div className="truncate">
                      <span className="font-japanese text-sm font-bold text-slate-900 dark:text-white mr-2">
                        {toPlainText(item.card.front)}
                      </span>
                      <span className="text-slate-400 font-japanese text-[11px] mr-1.5">
                        ({toPlainText(item.card.back)})
                      </span>
                      <span className="text-slate-600 dark:text-slate-300 truncate">
                        {toPlainText(item.card.meaning)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-bold text-[11px]">
                      {item.againCount}x Again
                    </span>
                    <span className="text-slate-400 text-[11px]">
                      Pass {item.passRate}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 9 & 10. Waktu per Kartu & Kartu Ditambahkan */}
        <div className="space-y-4">
          {/* 10. Waktu per Kartu */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-sky-500" />
                Kecepatan Menjawab per Kartu
              </h3>
              <p className="text-xs text-slate-500">
                Rata-rata dan median waktu berpikir sebelum menekan tombol jawaban.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <span className="text-[11px] text-slate-400 block mb-0.5">Rata-rata Keseluruhan</span>
                <span className="text-lg font-bold text-slate-900 dark:text-white">
                  {(stats.timeStats.overallAvgMs / 1000).toFixed(1)} <span className="text-xs font-normal">detik</span>
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <span className="text-[11px] text-slate-400 block mb-0.5">Median Waktu</span>
                <span className="text-lg font-bold text-slate-900 dark:text-white">
                  {(stats.timeStats.overallMedianMs / 1000).toFixed(1)} <span className="text-xs font-normal">detik</span>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-1.5 pt-1 text-center text-[11px]">
              <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300">
                <span className="font-bold block">Again</span>
                <span>{(stats.timeStats.avgByRatingMs[1] / 1000).toFixed(1)}s</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                <span className="font-bold block">Hard</span>
                <span>{(stats.timeStats.avgByRatingMs[2] / 1000).toFixed(1)}s</span>
              </div>
              <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300">
                <span className="font-bold block">Good</span>
                <span>{(stats.timeStats.avgByRatingMs[3] / 1000).toFixed(1)}s</span>
              </div>
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300">
                <span className="font-bold block">Easy</span>
                <span>{(stats.timeStats.avgByRatingMs[4] / 1000).toFixed(1)}s</span>
              </div>
            </div>
          </div>

          {/* 9. Riwayat Kartu Ditambahkan */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                  <PlusCircle className="w-4 h-4 text-indigo-500" />
                  Penambahan Kosakata
                </h3>
                <p className="text-xs text-slate-500">
                  Total {cards.length} kartu terdaftar pada deck ini.
                </p>
              </div>
            </div>

            {stats.addedTimeline.length === 0 ? (
              <div className="text-xs text-slate-400 py-2">Belum ada riwayat tanggal pembuatan.</div>
            ) : (
              <div className="flex items-end gap-1 h-14 pt-2">
                {stats.addedTimeline.map((item, idx) => (
                  <div key={idx} className="flex-1 flex flex-col justify-end items-center group">
                    <div
                      className="w-full bg-indigo-300 dark:bg-indigo-700 group-hover:bg-indigo-500 rounded-t-xs"
                      style={{ height: `${Math.min(item.count * 12, 40)}px` }}
                      title={`${item.label}: +${item.count} kartu`}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer Info Box */}
      <div className="p-4 rounded-2xl bg-slate-100/60 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-500 space-y-1.5">
        <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
          <Info size={15} className="text-indigo-500" />
          <span>Catatan Penjadwalan Inka</span>
        </div>
        <p className="leading-relaxed">
          Inka memakai algoritma FSRS: tiap kartu punya tanggal jatuh tempo sendiri yang dihitung dari stability dan difficulty kartu itu. Jadwal mendatang di atas dibaca langsung dari tanggal tersebut. Statistik status kartu dan retensi makin akurat seiring bertambahnya riwayat belajar.
        </p>

        {/* Development test tools */}
        <div className="flex items-center gap-3 pt-2 text-[11px]">
          <button
            onClick={handleSeedData}
            className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
          >
            + Tambah Data Review Simulasi
          </button>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <button
            onClick={handleClearLogs}
            className="text-slate-400 hover:text-rose-500 hover:underline"
          >
            Bersihkan Riwayat Log
          </button>
        </div>
      </div>
    </div>
  );
};

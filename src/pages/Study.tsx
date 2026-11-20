import { toPlainText } from '../services/richText';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Flashcard } from '../components/Flashcard';
import { ReviewButtons } from '../components/ReviewButtons';
import { useTranslation } from '../context/useTranslation';
import {
  getCardsByDeck,
  getAllDecks,
  getDailyStudiedCount,
  getReviewLogsForDay,
  getSettings,
  getStudyDayString,
  saveCard,
  saveCardWithLog,
  undoReview,
} from '../services/database';
import { answerCard, previewIntervals } from '../services/srs';
import {
  buildQueue,
  countDone,
  getStudyDayEnd,
  LEARN_AHEAD_MS,
  type DoneToday,
  type QueueCounts,
  type QueueKind,
} from '../services/queue';
import { speak, speakableText, stopSpeaking } from '../services/tts';
import { playSfx } from '../services/sfx';
import { DEFAULT_SETTINGS } from '../types/flashcard';
import type { Deck, Flashcard as FlashcardType, ReviewRating, StudySettings } from '../types/flashcard';
import { AlertCircle, RefreshCw, ChevronDown, BookOpen, Undo2, Pause, EyeOff, PartyPopper } from 'lucide-react';

interface StudyProps {
  currentDeck: Deck | null;
  onSelectDeck: (deck: Deck) => void;
  onNavigateToDeckManager: () => void;
}

type UndoEntry =
  | { type: 'answer'; prev: FlashcardType; logId: number | undefined; stateBefore: number }
  | { type: 'edit'; prev: FlashcardType };

interface Current {
  card: FlashcardType;
  kind: QueueKind;
}

const EXTRA_NEW_STEP = 10;

function formatClock(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export const Study: React.FC<StudyProps> = ({ currentDeck, onSelectDeck, onNavigateToDeckManager }) => {
  const { t } = useTranslation();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [cardCount, setCardCount] = useState(0);
  const [settings, setSettings] = useState<StudySettings>(DEFAULT_SETTINGS);
  const [current, setCurrent] = useState<Current | null>(null);
  const [counts, setCounts] = useState<QueueCounts>({ newCount: 0, learningCount: 0, reviewCount: 0 });
  const [nextLearningAt, setNextLearningAt] = useState<number | null>(null);
  const [newRemaining, setNewRemaining] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [disableAnimation, setDisableAnimation] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeckDropdownOpen, setIsDeckDropdownOpen] = useState(false);
  const [dailyStudiedCount, setDailyStudiedCount] = useState<number>(0);
  const [undoDepth, setUndoDepth] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const cardsRef = useRef<FlashcardType[]>([]);
  const settingsRef = useRef<StudySettings>(DEFAULT_SETTINGS);
  const doneRef = useRef<DoneToday>({ newDone: 0, reviewsDone: 0 });
  const extraNewRef = useRef(0);
  const undoStackRef = useRef<UndoEntry[]>([]);
  const studyDayRef = useRef<string>(getStudyDayString());
  const busyRef = useRef(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const cardShownAtRef = useRef<number>(0);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3500);
  }, []);

  /** Hitung ulang antrean dari kartu di memori dan tampilkan kartu berikutnya. */
  const refreshQueue = useCallback(() => {
    const now = Date.now();
    const s = settingsRef.current;
    const snap = buildQueue(cardsRef.current, {
      now,
      studyDay: getStudyDayString(new Date(now)),
      dayEnd: getStudyDayEnd(now, s.dayStartHour),
      settings: s,
      done: doneRef.current,
      extraNew: extraNewRef.current,
    });
    setCounts(snap.counts);
    setCurrent(snap.next);
    setNextLearningAt(snap.nextLearningAt);
    setNewRemaining(
      cardsRef.current.filter((c) => !c.suspended && (c.srs?.state ?? 0) === 0).length - snap.counts.newCount
    );
    setDisableAnimation(true);
    setIsFlipped(false);
    cardShownAtRef.current = now;
  }, []);

  // Tutup dropdown saat klik di luar
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDeckDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    getAllDecks().then(setDecks);
  }, []);

  // Muat deck, pengaturan, dan progres hari ini
  useEffect(() => {
    let isMounted = true;

    async function load() {
      if (!currentDeck) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      const [deckCards, loadedSettings] = await Promise.all([getCardsByDeck(currentDeck.id), getSettings()]);
      const day = getStudyDayString();
      const [logsToday, daily] = await Promise.all([getReviewLogsForDay(day, currentDeck.id), getDailyStudiedCount()]);
      if (!isMounted) return;

      settingsRef.current = loadedSettings;
      setSettings(loadedSettings);
      cardsRef.current = deckCards;
      setCardCount(deckCards.length);
      doneRef.current = countDone(logsToday);
      extraNewRef.current = 0;
      undoStackRef.current = [];
      setUndoDepth(0);
      studyDayRef.current = day;
      setDailyStudiedCount(daily);
      refreshQueue();
      setIsLoading(false);
    }

    load();
    return () => {
      isMounted = false;
      stopSpeaking();
    };
  }, [currentDeck, refreshQueue]);

  // Saat antrean kosong tetapi ada kartu learning yang akan jatuh tempo, bangunkan antrean tepat waktu.
  useEffect(() => {
    if (current || nextLearningAt === null) return;
    const delay = Math.min(Math.max(nextLearningAt - LEARN_AHEAD_MS - Date.now(), 1000), 2 ** 31 - 1);
    const t = window.setTimeout(refreshQueue, delay);
    return () => window.clearTimeout(t);
  }, [current, nextLearningAt, refreshQueue]);

  // Saat jendela kembali aktif: tangani pergantian hari dan jatuh tempo baru
  useEffect(() => {
    const onFocus = async () => {
      if (!currentDeck) return;
      const day = getStudyDayString();
      if (day !== studyDayRef.current) {
        const logs = await getReviewLogsForDay(day, currentDeck.id);
        doneRef.current = countDone(logs);
        extraNewRef.current = 0;
        studyDayRef.current = day;
        setDailyStudiedCount(await getDailyStudiedCount());
        refreshQueue();
      } else if (!current) {
        refreshQueue();
      }
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [currentDeck, current, refreshQueue]);

  // Bacakan kata Jepang (bacaan hiragana, atau kata depan bila kosong) hanya saat kartu dibalik;
  // berhenti saat kembali ke depan / ganti kartu. Contoh kalimat dan arti tidak disuarakan.
  const currentId = current?.card.id;
  const spokenText = current ? speakableText(current.card) : '';
  useEffect(() => {
    if (!isFlipped) {
      stopSpeaking();
      return;
    }
    if (settings.autoSpeak) speak(spokenText, 'ja-JP');
  }, [currentId, spokenText, isFlipped, settings.autoSpeak]);

  const intervals = useMemo(
    () => (current && isFlipped ? previewIntervals(current.card, settings) : null),
    [current, isFlipped, settings]
  );

  const replaceCard = (updated: FlashcardType) => {
    cardsRef.current = cardsRef.current.map((c) => (c.id === updated.id ? updated : c));
  };

  const pushUndo = (entry: UndoEntry) => {
    undoStackRef.current.push(entry);
    if (undoStackRef.current.length > 50) undoStackRef.current.shift();
    setUndoDepth(undoStackRef.current.length);
  };

  const handleFlip = () => {
    playSfx('flip');
    setDisableAnimation(false);
    setIsFlipped((f) => !f);
  };

  const handleAnswer = async (rating: ReviewRating) => {
    if (!current || !currentDeck || busyRef.current) return;
    busyRef.current = true;
    try {
      const now = Date.now();
      const prev = current.card;
      const durationMs = Math.min(Math.max(now - cardShownAtRef.current, 0), 60000);
      const result = answerCard(prev, rating, settingsRef.current, new Date(now));

      const log = await saveCardWithLog(result.card, {
        cardId: prev.id,
        deckId: currentDeck.id,
        ts: now,
        rating,
        scheduledDays: result.scheduledDays,
        stateBefore: result.stateBefore,
        durationMs,
      });

      replaceCard(result.card);
      if (result.stateBefore === 0) doneRef.current.newDone++;
      else if (result.stateBefore === 2) doneRef.current.reviewsDone++;
      pushUndo({ type: 'answer', prev, logId: log.id, stateBefore: result.stateBefore });
      setDailyStudiedCount((n) => n + 1);
      if (result.becameLeech) {
        showToast(`Kartu "${toPlainText(prev.front)}" sering gagal, ditangguhkan dan diberi tag "leech".`);
      }
      refreshQueue();
    } catch (err) {
      console.error('Gagal menyimpan jawaban:', err);
      playSfx('error');
      showToast('Gagal menyimpan jawaban. Coba lagi.');
    } finally {
      busyRef.current = false;
    }
  };

  const handleUndo = async () => {
    const entry = undoStackRef.current.pop();
    setUndoDepth(undoStackRef.current.length);
    if (!entry || busyRef.current) return;
    playSfx('undo');
    busyRef.current = true;
    try {
      if (entry.type === 'answer') {
        await undoReview(entry.prev, entry.logId);
        if (entry.stateBefore === 0) doneRef.current.newDone = Math.max(doneRef.current.newDone - 1, 0);
        else if (entry.stateBefore === 2) doneRef.current.reviewsDone = Math.max(doneRef.current.reviewsDone - 1, 0);
        setDailyStudiedCount((n) => Math.max(n - 1, 0));
      } else {
        await saveCard(entry.prev);
      }
      replaceCard(entry.prev);
      refreshQueue();
      // Pastikan kartu yang dibatalkan yang tampil lagi
      const restored = cardsRef.current.find((c) => c.id === entry.prev.id);
      if (restored && !restored.suspended) {
        setCurrent({ card: restored, kind: (restored.srs?.state ?? 0) === 0 ? 'new' : (restored.srs?.state ?? 0) === 2 ? 'review' : 'learning' });
      }
    } finally {
      busyRef.current = false;
    }
  };

  const handleSuspend = async () => {
    if (!current || busyRef.current) return;
    playSfx('suspend');
    const prev = current.card;
    const updated = { ...prev, suspended: true };
    await saveCard(updated);
    replaceCard(updated);
    pushUndo({ type: 'edit', prev });
    showToast(`Kartu "${toPlainText(prev.front)}" ditangguhkan. Tekan Z untuk membatalkan.`);
    refreshQueue();
  };

  const handleBury = async () => {
    if (!current || busyRef.current) return;
    playSfx('bury');
    const prev = current.card;
    const updated = { ...prev, buriedUntil: getStudyDayString() };
    await saveCard(updated);
    replaceCard(updated);
    pushUndo({ type: 'edit', prev });
    showToast(`Kartu "${toPlainText(prev.front)}" disembunyikan sampai besok. Tekan Z untuk membatalkan.`);
    refreshQueue();
  };

  const handleSpeak = () => {
    if (!current || !isFlipped || !spokenText) return;
    playSfx('speak');
    speak(spokenText, 'ja-JP');
  };

  const handleStudyMore = () => {
    extraNewRef.current += EXTRA_NEW_STEP;
    refreshQueue();
  };

  // Shortcut keyboard. Handler selalu memakai closure terbaru lewat ref.
  const keyHandlerRef = useRef<(e: KeyboardEvent) => void>(() => {});
  const handleKey = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;
    if (e.altKey) return;
    const key = e.key.toLowerCase();

    if ((e.ctrlKey || e.metaKey) && key === 'z') {
      e.preventDefault();
      handleUndo();
      return;
    }
    if (e.ctrlKey || e.metaKey) return;
    if (!current) return;

    if (key === ' ' || key === 'enter') {
      e.preventDefault();
      if (!isFlipped) handleFlip();
      else {
        playSfx('good');
        handleAnswer(3);
      }
    } else if (['1', '2', '3', '4'].includes(key) && isFlipped) {
      e.preventDefault();
      const r = Number(key) as ReviewRating;
      playSfx((['again', 'hard', 'good', 'easy'] as const)[r - 1]);
      handleAnswer(r);
    } else if (key === 'z') {
      handleUndo();
    } else if (key === 's') {
      handleSuspend();
    } else if (key === 'b') {
      handleBury();
    } else if (key === 'r') {
      handleSpeak();
    }
  };
  useEffect(() => {
    keyHandlerRef.current = handleKey;
  });
  useEffect(() => {
    const listener = (e: KeyboardEvent) => keyHandlerRef.current(e);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500">
        <RefreshCw className="w-8 h-8 animate-spin mb-3 text-indigo-500" />
        <p className="text-sm">{t.loadingFlashcard}</p>
      </div>
    );
  }

  if (!currentDeck || cardCount === 0) {
    return (
      <div className="max-w-md mx-auto text-center py-12 px-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm mt-8">
        <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{t.emptyDeckTitle}</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          {t.emptyDeckDesc}
        </p>
        <button
          onClick={onNavigateToDeckManager}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium shadow-md transition-all duration-150"
        >
          {t.manageCardsAndDecks}
        </button>
      </div>
    );
  }

  const chip = (label: string, value: number, color: string, active: boolean) => (
    <span
      className={`flex items-center gap-1 text-xs font-semibold ${color} ${active ? 'underline underline-offset-4 decoration-2' : ''}`}
    >
      {label} <span className="tabular-nums">{value}</span>
    </span>
  );

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-2xl mx-auto px-4 py-2">
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium max-w-[90vw]">
          {toast}
        </div>
      )}

      {/* Pemilih deck */}
      <div className="w-full max-w-xl mx-auto mb-3 flex items-center justify-between relative" ref={dropdownRef}>
        <div className="relative inline-block text-left">
          <button
            type="button"
            onClick={() => setIsDeckDropdownOpen(!isDeckDropdownOpen)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs sm:text-sm font-semibold shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition"
          >
            <BookOpen className="w-4 h-4 text-indigo-500" />
            <span className="max-w-[200px] truncate">{currentDeck.name}</span>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isDeckDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {isDeckDropdownOpen && (
            <div className="absolute left-0 mt-1.5 w-64 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-50 py-1.5 max-h-60 overflow-y-auto">
              <div className="px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t.deckDropdownTitle}</div>
              {decks.map((deck) => (
                <button
                  key={deck.id}
                  onClick={() => {
                    onSelectDeck(deck);
                    setIsDeckDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3.5 py-2 text-xs sm:text-sm flex items-center justify-between transition ${
                    deck.id === currentDeck.id
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="truncate">{deck.name}</span>
                  {deck.id === currentDeck.id && <span className="text-xs">✓</span>}
                </button>
              ))}
              <div className="border-t border-slate-100 dark:border-slate-800 mt-1 pt-1">
                <button
                  onClick={() => {
                    setIsDeckDropdownOpen(false);
                    onNavigateToDeckManager();
                  }}
                  className="w-full text-left px-3.5 py-2 text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  {t.createManageOtherDecks}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3" aria-label={t.queueRemaining}>
          {chip(t.queueNew, counts.newCount, 'text-sky-600 dark:text-sky-400', current?.kind === 'new')}
          {chip(t.queueLearning, counts.learningCount, 'text-rose-600 dark:text-rose-400', current?.kind === 'learning')}
          {chip(t.queueReview, counts.reviewCount, 'text-emerald-600 dark:text-emerald-400', current?.kind === 'review')}
        </div>
      </div>

      {current ? (
        <>
          <Flashcard
            key={current.card.id}
            card={current.card}
            isFlipped={isFlipped}
            onFlip={handleFlip}
            disableAnimation={disableAnimation}
            onSpeak={handleSpeak}
          />

          {/* Aksi kartu */}
          <div className="w-full max-w-xl flex items-center justify-center gap-1 mb-3 text-slate-500">
            <button
              data-sfx="none"
              onClick={handleUndo}
              disabled={undoDepth === 0}
              title={`${t.actionUndo} (Z)`}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none"
            >
              <Undo2 className="w-4 h-4" /> {t.actionUndo}
            </button>
            <button
              data-sfx="none"
              onClick={handleSuspend}
              title={`${t.actionSuspend} (S)`}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Pause className="w-4 h-4" /> {t.actionSuspend}
            </button>
            <button
              data-sfx="none"
              onClick={handleBury}
              title={`${t.actionBury} (B)`}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <EyeOff className="w-4 h-4" /> {t.actionBury}
            </button>
          </div>

          {isFlipped ? (
            <ReviewButtons onAnswer={handleAnswer} intervals={intervals} />
          ) : (
            <div className="w-full max-w-xl mx-auto px-2">
              <button
                data-sfx="none"
              onClick={handleFlip}
                className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-md transition"
              >
                {t.showAnswer}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="w-full max-w-md mx-auto text-center py-10 px-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <PartyPopper className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">{t.sessionFinishedTitle}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            {nextLearningAt
              ? t.nextLearningClock(formatClock(nextLearningAt))
              : t.noDueCardsTomorrow}
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            {newRemaining > 0 && (
              <button
                onClick={handleStudyMore}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold"
              >
                {t.addNewCardsBtn(Math.min(EXTRA_NEW_STEP, newRemaining))}
              </button>
            )}
            {undoDepth > 0 && (
              <button
                data-sfx="none"
              onClick={handleUndo}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-300"
              >
                Undo
              </button>
            )}
          </div>
        </div>
      )}

      <div className="w-full max-w-xl mx-auto px-2 mt-4">
        <div className="w-full flex items-center justify-between text-xs sm:text-sm text-slate-600 dark:text-slate-400 border-t border-slate-200/80 dark:border-slate-800 pt-3">
          <span className="font-medium text-slate-500 dark:text-slate-400">{t.cardsStudiedToday}</span>
          <span className="font-bold text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-lg">
            {t.countCardsSuffix(dailyStudiedCount)}
          </span>
        </div>
      </div>
    </div>
  );
};

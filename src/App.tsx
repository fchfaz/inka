import { useState, useEffect, lazy, Suspense } from 'react';
import { Study } from './pages/Study';
import { initializeDefaultDeck, getAllDecks, getDB, getSettings, migrateLegacyProgress, migrateV4Notes } from './services/database';
import { installSfxListener } from './services/sfx';
import { backupReminder, ensureFirstSeen, snoozeBackupReminder } from './services/backupReminder';
import { isStoragePersistent, requestPersistentStorage } from './services/media';
import { useMsg } from './context/useMsg';
import { LanguageProvider } from './context/LanguageContext';
import { useTranslation } from './context/useTranslation';
import type { Deck } from './types/flashcard';
import { BookMarked, FolderKanban, BarChart3, Sliders, Clock, ShieldAlert } from 'lucide-react';

// Halaman selain Study dimuat on-demand agar bundle awal kecil
// (DeckManager membawa fflate/fzstd/importer Anki; Settings membawa backup).
const Statistics = lazy(() =>
  import('./pages/Statistics').then((module) => ({ default: module.Statistics }))
);
const DeckManager = lazy(() =>
  import('./pages/DeckManager').then((module) => ({ default: module.DeckManager }))
);
const Settings = lazy(() =>
  import('./pages/Settings').then((module) => ({ default: module.Settings }))
);

function PageFallback() {
  return (
    <div className="w-full max-w-4xl mx-auto py-16 flex flex-col items-center justify-center text-slate-600 dark:text-slate-400">
      <Clock className="w-8 h-8 animate-spin text-indigo-600 dark:text-indigo-400 mb-3" />
      <span className="text-sm">Memuat...</span>
    </div>
  );
}

function MainContent() {
  const { t } = useTranslation();
  const m = useMsg();
  const [reminder, setReminder] = useState<{ never: boolean; days: number } | null>(null);
  const [currentPage, setCurrentPage] = useState<'study' | 'decks' | 'stats' | 'settings'>('study');
  const [currentDeck, setCurrentDeck] = useState<Deck | null>(null);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('inka_theme') === 'dark';
  });

  // Efek suara untuk semua tombol (satu listener global)
  useEffect(() => installSfxListener(), []);

  // Apply dark mode class to root HTML
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('inka_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('inka_theme', 'light');
    }
  }, [isDarkMode]);

  // Init default deck on initial boot
  useEffect(() => {
    async function init() {
      try {
        const settings = await getSettings();
        await migrateLegacyProgress(settings);
        await migrateV4Notes();
      } catch (err) {
        console.error('Inisialisasi pengaturan/migrasi gagal:', err);
      }
      await initializeDefaultDeck();
      const decks = await getAllDecks();
      if (decks.length > 0) {
        setCurrentDeck(decks[0]);
      }

      // Data hanya ada di browser: minta penyimpanan permanen (diam-diam) dan ingatkan backup berkala.
      try {
        ensureFirstSeen();
        if (!(await isStoragePersistent())) void requestPersistentStorage();
        const db = await getDB();
        const hasData = (await db.count('cards')) > 0;
        const r = backupReminder(hasData);
        if (r.remind) setReminder({ never: r.never, days: r.days });
      } catch {
        /* pengingat bersifat opsional */
      }
    }
    init();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      {/* Top Header */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-white/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => setCurrentPage('study')}
          >
            <div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center font-bold text-sm">
              印
            </div>
            <span className="font-bold text-base tracking-tight text-slate-900 dark:text-white">
              Inka
            </span>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage('study')}
              aria-label={t.navStudy}
              data-sfx="nav"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition ${
                currentPage === 'study'
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <BookMarked size={15} />
              <span>{t.navStudy}</span>
            </button>

            <button
              onClick={() => setCurrentPage('decks')}
              aria-label={t.navDecks}
              data-sfx="nav"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition ${
                currentPage === 'decks'
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <FolderKanban size={15} />
              <span className="hidden sm:inline">{t.navDecks}</span>
            </button>

            <button
              onClick={() => setCurrentPage('stats')}
              aria-label={t.navStats}
              data-sfx="nav"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition ${
                currentPage === 'stats'
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <BarChart3 size={15} />
              <span className="hidden sm:inline">{t.navStats}</span>
            </button>

            <button
              onClick={() => setCurrentPage('settings')}
              aria-label={t.navSettings}
              data-sfx="nav"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition ${
                currentPage === 'settings'
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Sliders size={15} />
              <span className="hidden sm:inline">{t.navSettings}</span>
            </button>
          </nav>
        </div>
      </header>

      {reminder && (
        <div role="status" className="w-full bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200">
          <div className="max-w-6xl mx-auto px-4 py-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm">
            <ShieldAlert size={16} className="shrink-0" />
            <span className="flex-1 min-w-[12rem]">{reminder.never ? m('remind.never') : m('remind.text', { days: reminder.days })}</span>
            <button
              onClick={() => {
                setReminder(null);
                setCurrentPage('settings');
              }}
              className="font-semibold underline underline-offset-2"
            >
              {m('remind.go')}
            </button>
            <button
              onClick={() => {
                snoozeBackupReminder();
                setReminder(null);
              }}
              className="opacity-80 hover:opacity-100"
            >
              {m('remind.later')}
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col justify-center items-center py-6 px-2 sm:px-4">
        {currentPage === 'study' && (
          <Study
            currentDeck={currentDeck}
            onSelectDeck={(deck) => setCurrentDeck(deck)}
            onNavigateToDeckManager={() => setCurrentPage('decks')}
          />
        )}

        <Suspense fallback={<PageFallback />}>
          {currentPage === 'decks' && (
            <DeckManager
              currentDeck={currentDeck}
              onSelectDeck={(deck) => setCurrentDeck(deck)}
            />
          )}

          {currentPage === 'stats' && (
            <Statistics
              currentDeck={currentDeck}
              onNavigateToStudy={() => setCurrentPage('study')}
            />
          )}

          {currentPage === 'settings' && (
            <Settings
              isDarkMode={isDarkMode}
              onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
            />
          )}
        </Suspense>
      </main>
    </div>
  );
}

export function App() {
  return (
    <LanguageProvider>
      <MainContent />
    </LanguageProvider>
  );
}

export default App;

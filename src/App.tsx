import { useState, useEffect, lazy, Suspense } from 'react';
import { Study } from './pages/Study';
import { DeckManager } from './pages/DeckManager';
import { Settings } from './pages/Settings';
import { initializeDefaultDeck, getAllDecks, getSettings, migrateLegacyProgress } from './services/database';
import { installSfxListener } from './services/sfx';
import { LanguageProvider } from './context/LanguageContext';
import { useTranslation } from './context/languageContext';
import type { Deck } from './types/flashcard';
import { BookMarked, FolderKanban, BarChart3, Sliders, Clock } from 'lucide-react';

const Statistics = lazy(() =>
  import('./pages/Statistics').then((module) => ({ default: module.Statistics }))
);

function MainContent() {
  const { t } = useTranslation();
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
      } catch (err) {
        console.error('Inisialisasi pengaturan/migrasi gagal:', err);
      }
      await initializeDefaultDeck();
      const decks = await getAllDecks();
      if (decks.length > 0) {
        setCurrentDeck(decks[0]);
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

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col justify-center items-center py-6 px-2 sm:px-4">
        {currentPage === 'study' && (
          <Study
            currentDeck={currentDeck}
            onSelectDeck={(deck) => setCurrentDeck(deck)}
            onNavigateToDeckManager={() => setCurrentPage('decks')}
          />
        )}

        {currentPage === 'decks' && (
          <DeckManager
            currentDeck={currentDeck}
            onSelectDeck={(deck) => setCurrentDeck(deck)}
          />
        )}

        {currentPage === 'stats' && (
          <Suspense
            fallback={
              <div className="w-full max-w-4xl mx-auto py-16 flex flex-col items-center justify-center text-slate-500">
                <Clock className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
                <span className="text-sm">Memuat...</span>
              </div>
            }
          >
            <Statistics
              currentDeck={currentDeck}
              onNavigateToStudy={() => setCurrentPage('study')}
            />
          </Suspense>
        )}

        {currentPage === 'settings' && (
          <Settings
            isDarkMode={isDarkMode}
            onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
          />
        )}
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

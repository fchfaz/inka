import React from 'react';
import { Moon, Sun, Info, Smartphone, HardDriveDownload } from 'lucide-react';

interface SettingsProps {
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ isDarkMode, onToggleDarkMode }) => {
  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="pb-3 border-b border-slate-200 dark:border-slate-800">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Pengaturan</h2>
        <p className="text-sm text-slate-500">Konfigurasi tampilan dan status aplikasi.</p>
      </div>

      {/* Theme */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
            {isDarkMode ? <Moon size={22} /> : <Sun size={22} />}
          </div>
          <div>
            <h4 className="font-semibold text-slate-800 dark:text-white text-base">Mode Gelap (Dark Mode)</h4>
            <p className="text-xs text-slate-500">Ubah tema tampilan antara gelap dan terang</p>
          </div>
        </div>

        <button
          onClick={onToggleDarkMode}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
            isDarkMode ? 'bg-indigo-600' : 'bg-slate-300'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              isDarkMode ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Spaced repetition logic info */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3">
        <div className="flex items-center gap-2.5 text-slate-900 dark:text-white font-semibold">
          <Info size={20} className="text-indigo-500" />
          <h3>Sistem Pengulangan Interval Inka</h3>
        </div>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          Inka memisahkan sistem pengulangan manual interval kartu (3, 5, 30, 50 kartu berikutnya) dari penjadwalan jangka panjang FSRS.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
          <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl text-center">
            <span className="font-bold text-red-600 dark:text-red-400 block text-base mb-1">3</span>
            <span className="text-slate-600 dark:text-slate-400">Ulang setelah 3 kartu berikutnya</span>
          </div>
          <div className="p-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-center">
            <span className="font-bold text-slate-600 dark:text-slate-300 block text-base mb-1">5</span>
            <span className="text-slate-600 dark:text-slate-400">Ulang setelah 5 kartu berikutnya</span>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-xl text-center">
            <span className="font-bold text-emerald-600 dark:text-emerald-400 block text-base mb-1">30</span>
            <span className="text-slate-600 dark:text-slate-400">Ulang setelah 30 kartu berikutnya</span>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-xl text-center">
            <span className="font-bold text-blue-600 dark:text-blue-400 block text-base mb-1">50</span>
            <span className="text-slate-600 dark:text-slate-400">Ulang setelah 50 kartu berikutnya</span>
          </div>
        </div>
      </div>

      {/* PWA & Storage Status */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3">
        <div className="flex items-center gap-2.5 text-slate-900 dark:text-white font-semibold">
          <Smartphone size={20} className="text-emerald-500" />
          <h3>PWA & Offline Storage</h3>
        </div>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          Aplikasi ini beroperasi secara <b>offline-first</b> menggunakan browser IndexedDB. Semua kosakata, deck, dan antrean pengulangan tersimpan secara persisten di perangkat lokal pengguna tanpa memerlukan server eksternal.
        </p>
        <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
          <HardDriveDownload size={16} />
          <span>IndexedDB Status: Aktif & Terhubung</span>
        </div>
      </div>
    </div>
  );
};


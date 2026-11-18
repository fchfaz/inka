import React, { useEffect, useState } from 'react';
import { Moon, Sun, Info, Smartphone, HardDriveDownload, Save, Download, Upload, AlertTriangle, Volume2, Globe } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';
import { getSettings, saveSettings } from '../services/database';
import { parseSteps } from '../services/srs';
import { configureSfx, playSfx, SFX_NAMES, type SfxName } from '../services/sfx';
import { createBackupFile, downloadBlob, parseBackupBytes, restoreFullBackup } from '../services/importExport';
import { formatBytes, getMediaStats, pruneUnusedMedia, storageEstimate, type MediaStats } from '../services/media';
import { DEFAULT_SETTINGS, type StudySettings } from '../types/flashcard';

interface SettingsProps {
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

const SFX_LABEL: Record<SfxName, string> = {
  tap: 'Tombol umum', nav: 'Navigasi', toggle: 'Saklar', close: 'Tutup / Batal', add: 'Tambah',
  success: 'Simpan', file: 'Impor / Ekspor', danger: 'Hapus', error: 'Galat', flip: 'Balik kartu',
  again: 'Again', hard: 'Hard', good: 'Good', easy: 'Easy', undo: 'Undo', suspend: 'Suspend',
  bury: 'Bury', speak: 'Suara',
};

const card = 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs';
const input =
  'w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white';
const label = 'block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1';

export const Settings: React.FC<SettingsProps> = ({ isDarkMode, onToggleDarkMode }) => {
  const { language, setLanguage, t } = useTranslation();
  const [form, setForm] = useState<StudySettings>(DEFAULT_SETTINGS);
  const [learningText, setLearningText] = useState(DEFAULT_SETTINGS.learningSteps.join(' '));
  const [relearningText, setRelearningText] = useState(DEFAULT_SETTINGS.relearningSteps.join(' '));
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    getSettings().then((s) => {
      setForm(s);
      setLearningText(s.learningSteps.join(' '));
      setRelearningText(s.relearningSteps.join(' '));
    });
  }, []);

  const num = (v: string, min: number, max: number, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : fallback;
  };

  const handleSave = async () => {
    const learning = parseSteps(learningText);
    const relearning = parseSteps(relearningText);
    if (!learning || !relearning) {
      playSfx('error');
      setMessage({ kind: 'error', text: 'Langkah belajar harus berformat angka + m/h/d, mis. "1m 10m" atau "1h 1d".' });
      return;
    }
    await saveSettings({ ...form, learningSteps: learning, relearningSteps: relearning });
    setMessage({ kind: 'ok', text: 'Pengaturan disimpan.' });
  };

  const [mediaStats, setMediaStats] = useState<MediaStats | null>(null);
  const [quota, setQuota] = useState<{ usage: number; quota: number } | null>(null);
  const refreshMedia = async () => {
    try {
      setMediaStats(await getMediaStats());
      setQuota(await storageEstimate());
    } catch {
      /* IndexedDB tidak tersedia: panel disembunyikan */
    }
  };
  useEffect(() => {
    void refreshMedia();
  }, []);

  const handlePrune = async () => {
    try {
      const r = await pruneUnusedMedia();
      setMessage({ kind: 'ok', text: r.removed ? `${r.removed} media tak terpakai dihapus (${formatBytes(r.freedBytes)} dibebaskan).` : 'Tidak ada media yang tidak terpakai.' });
      await refreshMedia();
    } catch (err) {
      setMessage({ kind: 'error', text: `Gagal membersihkan media: ${(err as Error).message}` });
    }
  };

  const handleBackup = async () => {
    try {
      const f = await createBackupFile();
      downloadBlob(f.filename, f.blob);
      setMessage({
        kind: 'ok',
        text: `Backup berisi ${f.backup.decks.length} deck, ${f.backup.cards.length} kartu, ${f.backup.revlog.length} riwayat review${f.mediaCount ? `, ${f.mediaCount} berkas media (${formatBytes(f.blob.size)})` : ''}.`,
      });
    } catch (err) {
      setMessage({ kind: 'error', text: `Backup gagal: ${(err as Error).message}` });
    }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const { backup, media } = parseBackupBytes(new Uint8Array(await file.arrayBuffer()));
      const ok = confirm(
        `Pulihkan backup ini?\n${backup.decks.length} deck, ${backup.cards.length} kartu, ${backup.revlog.length} riwayat${media.length ? `, ${media.length} media` : ''}.\n\nSeluruh data saat ini akan DIGANTI.`
      );
      if (!ok) return;
      const res = await restoreFullBackup(backup, media);
      const s = await getSettings();
      setForm(s);
      setLearningText(s.learningSteps.join(' '));
      setRelearningText(s.relearningSteps.join(' '));
      setMessage({ kind: 'ok', text: `Dipulihkan: ${res.decks} deck, ${res.cards} kartu, ${res.logs} riwayat${res.media ? `, ${res.media} media` : ''}.` });
      await refreshMedia();
    } catch (err) {
      setMessage({ kind: 'error', text: `Gagal memulihkan backup: ${(err as Error).message}` });
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="pb-3 border-b border-slate-200 dark:border-slate-800">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t.settingsTitle}</h2>
        <p className="text-sm text-slate-500">{t.settingsSubtitle}</p>
      </div>

      {message && (
        <div
          role="status"
          className={`p-3 rounded-xl text-sm border ${
            message.kind === 'ok'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300'
              : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-700 dark:text-red-300'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Bahasa Aplikasi */}
      <div className={`${card} flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
            <Globe size={22} />
          </div>
          <div>
            <h4 className="font-semibold text-slate-800 dark:text-white text-base">{t.languageTitle}</h4>
            <p className="text-xs text-slate-500">{t.languageSubtitle}</p>
          </div>
        </div>

        <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
          <button
            type="button"
            onClick={() => setLanguage('id')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              language === 'id'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Bahasa Indonesia
          </button>
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              language === 'en'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            English
          </button>
        </div>
      </div>

      {/* Tema */}
      <div className={`${card} flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
            {isDarkMode ? <Moon size={22} /> : <Sun size={22} />}
          </div>
          <div>
            <h4 className="font-semibold text-slate-800 dark:text-white text-base">{t.themeTitle}</h4>
            <p className="text-xs text-slate-500">{t.themeSubtitle}</p>
          </div>
        </div>

        <button
          onClick={onToggleDarkMode}
          role="switch"
          aria-checked={isDarkMode}
          aria-label={t.themeTitle}
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

      {/* Penjadwalan */}
      <div className={`${card} space-y-4`}>
        <div className="flex items-center gap-2.5 text-slate-900 dark:text-white font-semibold">
          <Info size={20} className="text-indigo-500" />
          <h3>Penjadwalan Belajar (FSRS)</h3>
        </div>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          Tiap kartu punya tanggal jatuh tempo sendiri. Kartu yang kamu ingat muncul makin jarang, kartu yang sering lupa
          muncul lebih sering. Pengaturan ini berlaku untuk semua deck.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={label} htmlFor="newPerDay">Kartu baru per hari</label>
            <input id="newPerDay" type="number" min={0} max={9999} className={input} value={form.newPerDay}
              onChange={(e) => setForm({ ...form, newPerDay: num(e.target.value, 0, 9999, form.newPerDay) })} />
          </div>
          <div>
            <label className={label} htmlFor="reviewsPerDay">Maksimum review per hari</label>
            <input id="reviewsPerDay" type="number" min={0} max={99999} className={input} value={form.reviewsPerDay}
              onChange={(e) => setForm({ ...form, reviewsPerDay: num(e.target.value, 0, 99999, form.reviewsPerDay) })} />
          </div>
          <div>
            <label className={label} htmlFor="retention">Target retensi (0,70 – 0,99)</label>
            <input id="retention" type="number" step={0.01} min={0.7} max={0.99} className={input} value={form.desiredRetention}
              onChange={(e) => setForm({ ...form, desiredRetention: num(e.target.value, 0.7, 0.99, form.desiredRetention) })} />
          </div>
          <div>
            <label className={label} htmlFor="maxInterval">Interval maksimum (hari)</label>
            <input id="maxInterval" type="number" min={1} max={36500} className={input} value={form.maximumInterval}
              onChange={(e) => setForm({ ...form, maximumInterval: num(e.target.value, 1, 36500, form.maximumInterval) })} />
          </div>
          <div>
            <label className={label} htmlFor="learningSteps">Langkah belajar kartu baru</label>
            <input id="learningSteps" className={input} value={learningText} placeholder="1m 10m"
              onChange={(e) => setLearningText(e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="relearningSteps">Langkah ulang saat lupa</label>
            <input id="relearningSteps" className={input} value={relearningText} placeholder="10m"
              onChange={(e) => setRelearningText(e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="dayStart">Jam pergantian hari (0–23)</label>
            <input id="dayStart" type="number" min={0} max={23} className={input} value={form.dayStartHour}
              onChange={(e) => setForm({ ...form, dayStartHour: num(e.target.value, 0, 23, form.dayStartHour) })} />
          </div>
          <div>
            <label className={label} htmlFor="leech">Batas leech (0 = nonaktif)</label>
            <input id="leech" type="number" min={0} max={99} className={input} value={form.leechThreshold}
              onChange={(e) => setForm({ ...form, leechThreshold: num(e.target.value, 0, 99, form.leechThreshold) })} />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
          <input type="checkbox" checked={form.autoSpeak}
            onChange={(e) => setForm({ ...form, autoSpeak: e.target.checked })} />
          Bacakan kartu otomatis (suara bahasa Jepang dari browser)
        </label>

        <button
          onClick={handleSave}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold"
        >
          <Save size={16} /> Simpan Pengaturan
        </button>
      </div>

      {/* Efek suara */}
      <div className={`${card} space-y-4`}>
        <div className="flex items-center gap-2.5 text-slate-900 dark:text-white font-semibold">
          <Volume2 size={20} className="text-indigo-500" />
          <h3>Efek Suara Tombol</h3>
        </div>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          Tiap jenis tombol punya bunyi sendiri dengan tema lonceng kaca yang sama. Tombol jawaban Again, Hard, Good,
          dan Easy bernada berbeda, turun untuk gagal dan naik untuk berhasil.
        </p>
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={form.soundEnabled}
            onChange={(e) => {
              setForm({ ...form, soundEnabled: e.target.checked });
              configureSfx({ enabled: e.target.checked });
              if (e.target.checked) playSfx('toggle');
            }}
          />
          Aktifkan efek suara
        </label>
        <div>
          <label className={label} htmlFor="sfxVolume">
            Volume ({Math.round(form.soundVolume * 100)}%)
          </label>
          <input
            id="sfxVolume"
            type="range"
            min={0}
            max={1}
            step={0.05}
            disabled={!form.soundEnabled}
            value={form.soundVolume}
            onChange={(e) => {
              const v = Number(e.target.value);
              setForm({ ...form, soundVolume: v });
              configureSfx({ volume: v });
            }}
            onPointerUp={() => playSfx('tap')}
            className="w-full"
          />
        </div>
        <div>
          <p className={label}>Uji suara</p>
          <div className="flex flex-wrap gap-1.5">
            {SFX_NAMES.map((name: SfxName) => (
              <button
                key={name}
                type="button"
                data-sfx="none"
                disabled={!form.soundEnabled}
                onClick={() => playSfx(name)}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-100 dark:hover:bg-indigo-950 disabled:opacity-40"
              >
                {SFX_LABEL[name]}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-slate-500">Klik "Simpan Pengaturan" di atas agar pilihan suara tersimpan.</p>
      </div>

      {/* Backup */}
      <div className={`${card} space-y-3`}>
        <div className="flex items-center gap-2.5 text-slate-900 dark:text-white font-semibold">
          <HardDriveDownload size={20} className="text-emerald-500" />
          <h3>Backup & Pemulihan</h3>
        </div>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          Backup penuh menyimpan kartu, jadwal belajar, riwayat review, pengaturan, dan media (berupa file .zip bila ada media). Data hanya ada di browser ini,
          jadi unduh backup secara berkala, terutama sebelum membersihkan data browser.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleBackup}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 dark:bg-slate-700 text-white rounded-xl text-sm font-medium hover:bg-slate-700"
          >
            <Download size={16} /> Unduh Backup
          </button>
          <label className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-200 cursor-pointer">
            <Upload size={16} /> Pulihkan dari Backup
            <input type="file" accept=".json,.zip,application/json,application/zip" onChange={handleRestore} className="hidden" />
          </label>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle size={14} /> Memulihkan backup menggantikan seluruh data saat ini.
        </p>
      </div>

      {/* Media */}
      {mediaStats && (
        <div className={`${card} space-y-3`}>
          <div className="flex items-center gap-2.5 text-slate-900 dark:text-white font-semibold">
            <HardDriveDownload size={20} className="text-emerald-500" />
            <h3>Media kartu</h3>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            {mediaStats.count} berkas, {formatBytes(mediaStats.bytes)}
            {quota && quota.quota > 0 ? ` · browser memakai ${formatBytes(quota.usage)} dari ±${formatBytes(quota.quota)}` : ''}.
          </p>
          <button
            onClick={() => void handlePrune()}
            className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-200"
          >
            Bersihkan media tak terpakai
          </button>
        </div>
      )}

      {/* PWA */}
      <div className={`${card} space-y-3`}>
        <div className="flex items-center gap-2.5 text-slate-900 dark:text-white font-semibold">
          <Smartphone size={20} className="text-emerald-500" />
          <h3>PWA & Offline Storage</h3>
        </div>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          Aplikasi ini beroperasi secara <b>offline-first</b> menggunakan browser IndexedDB, tanpa server eksternal.
        </p>
      </div>
    </div>
  );
};

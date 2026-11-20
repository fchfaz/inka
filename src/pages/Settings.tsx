import React, { useEffect, useState } from 'react';
import { Moon, Sun, Info, Smartphone, HardDriveDownload, Save, Download, Upload, AlertTriangle, Volume2, Globe } from 'lucide-react';
import { useTranslation } from '../context/useTranslation';
import { useMsg } from '../context/useMsg';
import { markBackupDone } from '../services/backupReminder';
import { getSettings, saveSettings } from '../services/database';
import { parseSteps } from '../services/srs';
import { configureSfx, playSfx } from '../services/sfx';
import { createBackupFile, downloadBlob, parseBackupBytes, restoreFullBackup } from '../services/importExport';
import { formatBytes, getMediaStats, isStoragePersistent, pruneUnusedMedia, requestPersistentStorage, storageEstimate, type MediaStats } from '../services/media';
import { DEFAULT_SETTINGS, type StudySettings } from '../types/flashcard';

interface SettingsProps {
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

const card = 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs';
const input =
  'w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white';
const label = 'block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1';

export const Settings: React.FC<SettingsProps> = ({ isDarkMode, onToggleDarkMode }) => {
  const { language, setLanguage, t } = useTranslation();
  const m = useMsg();
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
      setMessage({ kind: 'error', text: m('set.stepsInvalid') });
      return;
    }
    await saveSettings({ ...form, learningSteps: learning, relearningSteps: relearning });
    setMessage({ kind: 'ok', text: m('set.saved') });
  };

  const [mediaStats, setMediaStats] = useState<MediaStats | null>(null);
  const [quota, setQuota] = useState<{ usage: number; quota: number } | null>(null);
  const [persistent, setPersistent] = useState<boolean | null>(null);
  const refreshMedia = async () => {
    try {
      setMediaStats(await getMediaStats());
      setQuota(await storageEstimate());
      setPersistent(await isStoragePersistent());
    } catch {
      /* IndexedDB tidak tersedia: panel disembunyikan */
    }
  };
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stats = await getMediaStats();
        const est = await storageEstimate();
        const persisted = await isStoragePersistent();
        if (!cancelled) {
          setMediaStats(stats);
          setQuota(est);
          setPersistent(persisted);
        }
      } catch {
        /* IndexedDB tidak tersedia: panel disembunyikan */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePrune = async () => {
    try {
      const r = await pruneUnusedMedia();
      setMessage({ kind: 'ok', text: r.removed ? m('set.pruned', { n: r.removed, size: formatBytes(r.freedBytes) }) : m('set.prunedNone') });
      await refreshMedia();
    } catch (err) {
      setMessage({ kind: 'error', text: m('set.pruneFail', { err: (err as Error).message }) });
    }
  };

  const handleBackup = async () => {
    try {
      const f = await createBackupFile();
      downloadBlob(f.filename, f.blob);
      markBackupDone();
      setMessage({
        kind: 'ok',
        text: m('set.backupDone', {
          decks: f.backup.decks.length,
          cards: f.backup.cards.length,
          logs: f.backup.revlog.length,
          media: f.mediaCount ? m('set.backupMedia', { n: f.mediaCount, size: formatBytes(f.blob.size) }) : '',
        }),
      });
    } catch (err) {
      setMessage({ kind: 'error', text: m('set.backupFail', { err: (err as Error).message }) });
    }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const { backup, media } = parseBackupBytes(new Uint8Array(await file.arrayBuffer()));
      const ok = confirm(
        m('set.restoreConfirm', { decks: backup.decks.length, cards: backup.cards.length, logs: backup.revlog.length, media: media.length ? m('set.restoreMedia', { n: media.length }) : '' })
      );
      if (!ok) return;
      const res = await restoreFullBackup(backup, media);
      const s = await getSettings();
      setForm(s);
      setLearningText(s.learningSteps.join(' '));
      setRelearningText(s.relearningSteps.join(' '));
      setMessage({ kind: 'ok', text: m('set.restoreDone', { decks: res.decks, cards: res.cards, logs: res.logs, media: res.media ? m('set.restoreMedia', { n: res.media }) : '' }) });
      await refreshMedia();
    } catch (err) {
      setMessage({ kind: 'error', text: m('set.restoreFail', { err: (err as Error).message }) });
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
          <h3>{m('set.fsrsTitle')}</h3>
        </div>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          {m('set.fsrsDesc')}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={label} htmlFor="newPerDay">{m('set.newPerDay')}</label>
            <input id="newPerDay" type="number" min={0} max={9999} className={input} value={form.newPerDay}
              onChange={(e) => setForm({ ...form, newPerDay: num(e.target.value, 0, 9999, form.newPerDay) })} />
          </div>
          <div>
            <label className={label} htmlFor="reviewsPerDay">{m('set.reviewsPerDay')}</label>
            <input id="reviewsPerDay" type="number" min={0} max={99999} className={input} value={form.reviewsPerDay}
              onChange={(e) => setForm({ ...form, reviewsPerDay: num(e.target.value, 0, 99999, form.reviewsPerDay) })} />
          </div>
          <div>
            <label className={label} htmlFor="retention">{m('set.retention')}</label>
            <input id="retention" type="number" step={0.01} min={0.7} max={0.99} className={input} value={form.desiredRetention}
              onChange={(e) => setForm({ ...form, desiredRetention: num(e.target.value, 0.7, 0.99, form.desiredRetention) })} />
          </div>
          <div>
            <label className={label} htmlFor="maxInterval">{m('set.maxInterval')}</label>
            <input id="maxInterval" type="number" min={1} max={36500} className={input} value={form.maximumInterval}
              onChange={(e) => setForm({ ...form, maximumInterval: num(e.target.value, 1, 36500, form.maximumInterval) })} />
          </div>
          <div>
            <label className={label} htmlFor="learningSteps">{m('set.learningSteps')}</label>
            <input id="learningSteps" className={input} value={learningText} placeholder="1m 10m"
              onChange={(e) => setLearningText(e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="relearningSteps">{m('set.relearningSteps')}</label>
            <input id="relearningSteps" className={input} value={relearningText} placeholder="10m"
              onChange={(e) => setRelearningText(e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="dayStart">{m('set.dayStart')}</label>
            <input id="dayStart" type="number" min={0} max={23} className={input} value={form.dayStartHour}
              onChange={(e) => setForm({ ...form, dayStartHour: num(e.target.value, 0, 23, form.dayStartHour) })} />
          </div>
          <div>
            <label className={label} htmlFor="leech">{m('set.leech')}</label>
            <input id="leech" type="number" min={0} max={99} className={input} value={form.leechThreshold}
              onChange={(e) => setForm({ ...form, leechThreshold: num(e.target.value, 0, 99, form.leechThreshold) })} />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
          <input type="checkbox" checked={form.autoSpeak}
            onChange={(e) => setForm({ ...form, autoSpeak: e.target.checked })} />
          {m('set.autoSpeak')}
        </label>

        <button
          onClick={handleSave}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold"
        >
          <Save size={16} /> {m('set.save')}
        </button>
      </div>

      {/* Efek suara */}
      <div className={`${card} space-y-4`}>
        <div className="flex items-center gap-2.5 text-slate-900 dark:text-white font-semibold">
          <Volume2 size={20} className="text-indigo-500" />
          <h3>{m('set.sfxTitle')}</h3>
        </div>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          {m('set.sfxDesc')}
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
          {m('set.sfxEnable')}
        </label>
        <div>
          <label className={label} htmlFor="sfxVolume">
            {m('set.volume', { pct: Math.round(form.soundVolume * 100) })}
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
        <p className="text-xs text-slate-500">{m('set.sfxSaveHint')}</p>
      </div>

      {/* Backup */}
      <div className={`${card} space-y-3`}>
        <div className="flex items-center gap-2.5 text-slate-900 dark:text-white font-semibold">
          <HardDriveDownload size={20} className="text-emerald-500" />
          <h3>{m('set.backupTitle')}</h3>
        </div>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          {m('set.backupDesc')}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleBackup}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 dark:bg-slate-700 text-white rounded-xl text-sm font-medium hover:bg-slate-700"
          >
            <Download size={16} /> {m('set.backupDownload')}
          </button>
          <label className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-200 cursor-pointer">
            <Upload size={16} /> {m('set.backupRestore')}
            <input type="file" accept=".json,.zip,application/json,application/zip" onChange={handleRestore} className="hidden" />
          </label>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle size={14} /> {m('set.backupWarn')}
        </p>
      </div>

      {/* Media */}
      {mediaStats && (
        <div className={`${card} space-y-3`}>
          <div className="flex items-center gap-2.5 text-slate-900 dark:text-white font-semibold">
            <HardDriveDownload size={20} className="text-emerald-500" />
            <h3>{m('set.mediaTitle')}</h3>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            {m('set.mediaStats', { n: mediaStats.count, size: formatBytes(mediaStats.bytes) })}
            {quota && quota.quota > 0 ? m('set.mediaQuota', { usage: formatBytes(quota.usage), quota: formatBytes(quota.quota) }) : ''}.
          </p>
          <button
            onClick={() => void handlePrune()}
            className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-200"
          >
            {m('set.mediaPrune')}
          </button>
        </div>
      )}

      {/* PWA */}
      <div className={`${card} space-y-3`}>
        <div className="flex items-center gap-2.5 text-slate-900 dark:text-white font-semibold">
          <Smartphone size={20} className="text-emerald-500" />
          <h3>{m('set.pwaTitle')}</h3>
        </div>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          {m('set.pwaDesc')}
        </p>
        {persistent !== null && (
          <div className="space-y-2">
            <p className={`text-xs ${persistent ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
              {persistent ? m('set.persistYes') : m('set.persistNo')}
            </p>
            {!persistent && (
              <button
                onClick={async () => {
                  const ok = await requestPersistentStorage();
                  setPersistent(await isStoragePersistent());
                  setMessage({ kind: ok ? 'ok' : 'error', text: ok ? m('set.persistGranted') : m('set.persistDenied') });
                }}
                className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-200"
              >
                {m('set.persistAsk')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

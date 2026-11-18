import React, { useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileArchive, Loader2, X } from 'lucide-react';
import type { AnkiPackage } from '../services/anki/apkg';
import { AnkiImportError, readAnkiPackage } from '../services/anki/apkg';
import {
  guessMapping, INKA_FIELDS, isImageOcclusion, type ConvertOptions, type InkaField, type NotetypeMapping,
} from '../services/anki/convert';
import { importAnkiPackage, type AnkiImportProgress, type AnkiImportSummary } from '../services/anki/importer';
import { getSettings, getStudyDayString } from '../services/database';
import { MediaStorageError } from '../services/media';
import { toPlainText } from '../services/richText';

type Targets = Record<string, Record<string, InkaField | ''>>; // ntId -> fieldName -> target
interface NtState { enabled: boolean; targets: Record<string, InkaField | ''> }

function invert(m: NotetypeMapping): Record<string, InkaField | ''> {
  const t: Record<string, InkaField | ''> = {};
  for (const [k, names] of Object.entries(m.mapping) as Array<[InkaField, string[]]>) for (const n of names) t[n] = k;
  return t;
}

function friendlyError(e: unknown): string {
  if (e instanceof AnkiImportError || e instanceof MediaStorageError) return e.message;
  if ((e as Error)?.name === 'AbortError') return 'Impor dibatalkan. Tidak ada perubahan yang disimpan.';
  const msg = (e as Error)?.message ?? String(e);
  if (/quota/i.test(msg)) return 'Penyimpanan browser penuh. Impor tanpa media atau bebaskan ruang, lalu coba lagi.';
  if (/memory|allocation|array buffer/i.test(msg)) return 'Memori browser tidak cukup untuk paket sebesar ini. Coba impor tanpa media atau pecah deck-nya.';
  return `Impor gagal: ${msg}. Tidak ada perubahan yang disimpan.`;
}

export const AnkiImportDialog: React.FC<{ onClose: () => void; onDone: () => void }> = ({ onClose, onDone }) => {
  const [stage, setStage] = useState<'pick' | 'reading' | 'preview' | 'importing' | 'done' | 'error'>('pick');
  const [fileName, setFileName] = useState('');
  const [pkg, setPkg] = useState<AnkiPackage | null>(null);
  const [nts, setNts] = useState<Record<string, NtState>>({});
  const [includeProgress, setIncludeProgress] = useState(true);
  const [includeMedia, setIncludeMedia] = useState(true);
  const [deckMode, setDeckMode] = useState<'keep' | 'single'>('keep');
  const [singleName, setSingleName] = useState('Impor Anki');
  const [progress, setProgress] = useState<AnkiImportProgress | null>(null);
  const [summary, setSummary] = useState<AnkiImportSummary | null>(null);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const cardsPerNt = useMemo(() => {
    const out = new Map<string, number>();
    if (!pkg) return out;
    const noteMid = new Map(pkg.notes.map((n) => [n.id, n.mid]));
    for (const c of pkg.cards) {
      const mid = noteMid.get(c.nid);
      if (mid) out.set(mid, (out.get(mid) ?? 0) + 1);
    }
    return out;
  }, [pkg]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setStage('reading');
    setError('');
    try {
      await import('../services/anki/sqlLoader');
      const bytes = new Uint8Array(await file.arrayBuffer());
      const p = await readAnkiPackage(bytes);
      const init: Record<string, NtState> = {};
      for (const nt of p.notetypes.values()) {
        const g = guessMapping(nt);
        init[nt.id] = { enabled: g.enabled, targets: invert(g) };
      }
      setPkg(p);
      setNts(init);
      setIncludeProgress(p.cards.some((c) => c.type !== 0) || p.revlog.length > 0);
      setIncludeMedia(p.mediaEntries.length > 0);
      setStage('preview');
    } catch (e) {
      setError(friendlyError(e));
      setStage('error');
    }
  };

  const toOptions = async (): Promise<ConvertOptions> => {
    const mappings: Record<string, NotetypeMapping> = {};
    for (const [id, st] of Object.entries(nts)) {
      const mapping: NotetypeMapping['mapping'] = {};
      for (const [field, target] of Object.entries(st.targets)) if (target) (mapping[target] ??= []).push(field);
      mappings[id] = { enabled: st.enabled, mapping };
    }
    return {
      mappings, includeProgress, includeMedia, deckMode, singleDeckName: singleName,
      settings: await getSettings(), studyDayOf: (ts) => getStudyDayString(new Date(ts)),
    };
  };

  const noFront = Object.entries(nts).filter(([, s]) => s.enabled && !Object.values(s.targets).includes('front'));
  const nothingEnabled = !Object.values(nts).some((s) => s.enabled && (s.targets && Object.keys(s.targets).length > 0));

  const startImport = async () => {
    if (!pkg) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStage('importing');
    setProgress(null);
    try {
      const s = await importAnkiPackage(pkg, await toOptions(), setProgress, ctrl.signal);
      setSummary(s);
      setStage('done');
      onDone();
    } catch (e) {
      setError(friendlyError(e));
      setStage('error');
    } finally {
      abortRef.current = null;
    }
  };

  const sample = (ntId: string, field: string): string => {
    if (!pkg) return '';
    const nt = pkg.notetypes.get(ntId);
    const idx = nt?.fields.indexOf(field) ?? -1;
    if (idx < 0) return '';
    const note = pkg.notes.find((n) => n.mid === ntId && (n.fields[idx] ?? '').trim());
    return note ? toPlainText(note.fields[idx]).slice(0, 40) : '';
  };

  const selectCls = 'px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/50" role="dialog" aria-modal="true" aria-label="Impor paket Anki">
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold flex items-center gap-2"><FileArchive className="w-5 h-5 text-indigo-500" /> Impor paket Anki</h2>
          {stage !== 'importing' && (
            <button type="button" onClick={onClose} aria-label="Tutup" className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-5 h-5" /></button>
          )}
        </div>

        {stage === 'pick' && (
          <label data-sfx="file" className="block border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-400">
            <p className="font-semibold">Pilih berkas .apkg atau .colpkg</p>
            <p className="text-xs text-slate-500 mt-1">Diekspor dari Anki lewat Berkas → Ekspor. Dibaca di perangkat ini; tidak ada yang diunggah.</p>
            <input type="file" accept=".apkg,.colpkg,application/zip" className="hidden" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
        )}

        {stage === 'reading' && (
          <p className="flex items-center gap-2 py-8 justify-center text-sm"><Loader2 className="w-5 h-5 animate-spin" /> Membaca {fileName}…</p>
        )}

        {stage === 'preview' && pkg && (
          <div className="space-y-4 text-sm">
            <p className="text-slate-600 dark:text-slate-300">
              <b>{fileName}</b>: {pkg.notes.length} catatan, {pkg.cards.length} kartu, {new Set(pkg.cards.map((c) => c.did)).size} deck, {pkg.mediaEntries.length} berkas media, {pkg.revlog.length} riwayat review.
            </p>

            {Object.entries(nts).filter(([id]) => cardsPerNt.get(id)).map(([id, st]) => {
              const nt = pkg.notetypes.get(id)!;
              return (
                <fieldset key={id} className="border border-slate-200 dark:border-slate-700 rounded-xl p-3">
                  <legend className="px-1 text-xs font-bold">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={st.enabled} onChange={(e) => setNts({ ...nts, [id]: { ...st, enabled: e.target.checked } })} />
                      {nt.name} · {cardsPerNt.get(id)} kartu{nt.isCloze ? ' · cloze' : ''}
                    </label>
                  </legend>
                  {isImageOcclusion(nt) && (
                    <p className="text-xs text-amber-600 flex gap-1 mb-2"><AlertTriangle className="w-4 h-4 shrink-0" /> Image Occlusion: topeng gambar tidak didukung, hanya gambar dan teksnya yang diimpor. Nonaktif secara bawaan.</p>
                  )}
                  {st.enabled && (
                    <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 items-center">
                      {nt.fields.map((f) => (
                        <React.Fragment key={f}>
                          <div className="min-w-0">
                            <span className="font-medium block">{f}</span>
                            <span className="block text-xs text-slate-400 truncate">{sample(id, f)}</span>
                          </div>
                          <select
                            className={selectCls}
                            aria-label={`Tujuan field ${f}`}
                            value={st.targets[f] ?? ''}
                            onChange={(e) => setNts({ ...nts, [id]: { ...st, targets: { ...st.targets, [f]: e.target.value as InkaField | '' } } })}
                          >
                            <option value="">(jangan impor)</option>
                            {INKA_FIELDS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                          </select>
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </fieldset>
              );
            })}

            {noFront.length > 0 && (
              <p className="text-xs text-red-600 flex gap-1"><AlertTriangle className="w-4 h-4 shrink-0" /> Tiap tipe catatan yang aktif perlu satu field untuk "Depan".</p>
            )}

            <div className="space-y-2">
              <label className="flex items-center gap-2"><input type="checkbox" checked={includeProgress} onChange={(e) => setIncludeProgress(e.target.checked)} /> Bawa progres belajar dan riwayat review (dijadwalkan ulang ke FSRS)</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={includeMedia} disabled={pkg.mediaEntries.length === 0} onChange={(e) => setIncludeMedia(e.target.checked)} /> Impor gambar, audio, dan video</label>
              <div className="flex items-center gap-3 flex-wrap">
                <label className="flex items-center gap-1"><input type="radio" name="deckmode" checked={deckMode === 'keep'} onChange={() => setDeckMode('keep')} /> Pertahankan struktur deck</label>
                <label className="flex items-center gap-1"><input type="radio" name="deckmode" checked={deckMode === 'single'} onChange={() => setDeckMode('single')} /> Satu deck:</label>
                <input disabled={deckMode !== 'single'} value={singleName} onChange={(e) => setSingleName(e.target.value)} aria-label="Nama deck tujuan" className={selectCls + ' w-40'} />
              </div>
              <p className="text-xs text-slate-500">Impor ulang paket yang sama aman: kartu yang sudah ada dilewati, progres Anda tidak ditimpa.</p>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm">Batal</button>
              <button type="button" disabled={noFront.length > 0 || nothingEnabled || (deckMode === 'single' && !singleName.trim())} onClick={() => void startImport()} data-sfx="success" className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold disabled:opacity-40">Impor sekarang</button>
            </div>
          </div>
        )}

        {stage === 'importing' && (
          <div className="py-6 space-y-3 text-sm">
            <p className="flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> {progress?.phase === 'media' ? 'Menyimpan media' : 'Menyimpan kartu'}… {progress ? `${progress.done}/${progress.total}` : ''}</p>
            <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div className="h-full bg-indigo-500 transition-all" style={{ width: `${progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 5}%` }} /></div>
            <button type="button" onClick={() => abortRef.current?.abort()} className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs">Batalkan</button>
          </div>
        )}

        {stage === 'done' && summary && (
          <div className="space-y-2 text-sm">
            <p className="flex items-center gap-2 font-semibold text-emerald-600"><CheckCircle2 className="w-5 h-5" /> Impor selesai</p>
            <ul className="list-disc pl-5 text-slate-700 dark:text-slate-300">
              <li>{summary.cardsAdded} kartu ditambah di {summary.decksCreated} deck baru</li>
              {summary.cardsSkipped > 0 && <li>{summary.cardsSkipped} kartu sudah ada, dilewati</li>}
              {summary.logsAdded > 0 && <li>{summary.logsAdded} riwayat review dibawa</li>}
              {summary.mediaStored > 0 && <li>{summary.mediaStored} berkas media disimpan</li>}
              {summary.emptyCards > 0 && <li>{summary.emptyCards} kartu kosong dilewati</li>}
              {summary.skippedNotetypes.map((s) => <li key={s.name}>{s.cards} kartu "{s.name}" tidak diimpor ({s.reason})</li>)}
            </ul>
            {(summary.mediaMissing.length > 0 || summary.mediaSkipped.length > 0) && (
              <p className="text-xs text-amber-600 flex gap-1"><AlertTriangle className="w-4 h-4 shrink-0" />
                {summary.mediaMissing.length > 0 && <>Media tidak ada di paket: {summary.mediaMissing.slice(0, 4).join(', ')}{summary.mediaMissing.length > 4 ? ` +${summary.mediaMissing.length - 4} lagi` : ''}. </>}
                {summary.mediaSkipped.length > 0 && <>Dilewati (tidak didukung/terlalu besar/rusak): {summary.mediaSkipped.slice(0, 4).join(', ')}{summary.mediaSkipped.length > 4 ? ` +${summary.mediaSkipped.length - 4} lagi` : ''}.</>}
              </p>
            )}
            <div className="flex justify-end pt-2"><button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold">Tutup</button></div>
          </div>
        )}

        {stage === 'error' && (
          <div className="space-y-3 text-sm">
            <p className="flex gap-2 text-red-600"><AlertTriangle className="w-5 h-5 shrink-0" /> {error}</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => { setStage('pick'); setPkg(null); }} className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm">Pilih berkas lain</button>
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm">Tutup</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export type { Targets };

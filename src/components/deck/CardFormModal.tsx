import React, { useRef } from 'react';
import { Paperclip } from 'lucide-react';
import type { Flashcard } from '../../types/flashcard';
import { useMsg } from '../../context/useMsg';

interface CardFormModalProps {
  isOpen: boolean;
  formData: Partial<Flashcard>;
  onChange: (data: Partial<Flashcard>) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onAttachMedia: (files: FileList | null) => void;
}

export const CardFormModal: React.FC<CardFormModalProps> = ({
  isOpen,
  formData,
  onChange,
  onClose,
  onSubmit,
  onAttachMedia,
}) => {
  const m = useMsg();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-xl shadow-2xl my-8">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
          {formData.id ? 'Edit Flashcard' : 'Tambah Flashcard Baru'}
        </h3>
        <form onSubmit={onSubmit} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Front / Kanji *
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: 水"
                value={formData.front || ''}
                onChange={(e) => onChange({ ...formData, front: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-japanese font-bold text-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Back / Hiragana
              </label>
              <input
                type="text"
                placeholder="Contoh: みず"
                value={formData.back || ''}
                onChange={(e) => onChange({ ...formData, back: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-japanese font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              Arti Bahasa Indonesia
            </label>
            <input
              type="text"
              placeholder="Contoh: Air"
              value={formData.meaning || ''}
              onChange={(e) => onChange({ ...formData, meaning: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              Contoh Kalimat Jepang (opsional)
            </label>
            <input
              type="text"
              placeholder="Contoh: 水を飲みます。"
              value={formData.example_jp || ''}
              onChange={(e) => onChange({ ...formData, example_jp: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-japanese"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Hiragana Contoh Kalimat
              </label>
              <input
                type="text"
                placeholder="Contoh: みずを のみます。"
                value={formData.example_hiragana || ''}
                onChange={(e) => onChange({ ...formData, example_hiragana: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-japanese"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Terjemahan Contoh Kalimat
              </label>
              <input
                type="text"
                placeholder="Contoh: Saya minum air."
                value={formData.example_id || ''}
                onChange={(e) => onChange({ ...formData, example_id: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              Hint (opsional, tampil di sisi depan)
            </label>
            <input
              type="text"
              placeholder="Contoh: kata benda, cairan"
              value={formData.hint || ''}
              onChange={(e) => onChange({ ...formData, hint: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              {m('card.extraLabel')}
            </label>
            <textarea
              rows={2}
              value={formData.extra || ''}
              onChange={(e) => onChange({ ...formData, extra: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
            />
            <label data-sfx="file" className="inline-flex items-center gap-1.5 mt-1 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs cursor-pointer hover:bg-slate-200">
              <Paperclip size={14} /> {m('card.attach')}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,audio/*,video/*"
                multiple
                className="hidden"
                onChange={(e) => onAttachMedia(e.target.files)}
              />
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              Tags (pisahkan dengan koma)
            </label>
            <input
              type="text"
              placeholder="Contoh: n4, kata_kerja, bab1"
              value={formData.tags ? formData.tags.join(', ') : ''}
              onChange={(e) =>
                onChange({
                  ...formData,
                  tags: e.target.value
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean),
                })
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700"
            >
              Simpan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

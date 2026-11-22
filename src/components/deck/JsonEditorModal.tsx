import React from 'react';
import { AlertTriangle, Code, CheckCircle2 } from 'lucide-react';

interface JsonEditorModalProps {
  isOpen: boolean;
  jsonText: string;
  jsonError: string | null;
  onTextChange: (val: string) => void;
  onClose: () => void;
  onApply: () => void;
}

export const JsonEditorModal: React.FC<JsonEditorModalProps> = ({
  isOpen,
  jsonText,
  jsonError,
  onTextChange,
  onClose,
  onApply,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Code className="text-indigo-600 dark:text-indigo-400" size={20} />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Direct JSON Editor</h3>
          </div>
          <span className="text-xs text-slate-500">recallio.deck-bundle schema</span>
        </div>

        <div className="py-2 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
          <AlertTriangle size={14} />
          <span>Format JSON akan diverifikasi ketat saat tombol Terapkan Perubahan ditekan.</span>
        </div>

        {jsonError && (
          <div className="mb-2 p-2.5 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-xs font-mono">
            {jsonError}
          </div>
        )}

        <div className="flex-1 my-2 min-h-[300px]">
          <textarea
            value={jsonText}
            onChange={(e) => onTextChange(e.target.value)}
            className="w-full h-full p-4 rounded-xl font-mono text-xs bg-slate-900 text-slate-100 dark:bg-slate-950 dark:text-slate-200 border border-slate-700 resize-none focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            spellCheck={false}
          />
        </div>

        <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-800">
          <span className="text-xs text-slate-600 dark:text-slate-400">
            Perubahan akan menggantikan/menambah kartu pada deck terkait.
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Batal
            </button>
            <button
              onClick={onApply}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700"
            >
              <CheckCircle2 size={16} />
              Terapkan Perubahan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

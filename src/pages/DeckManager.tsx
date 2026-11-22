import React, { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from 'react';
import { useTranslation } from '../context/useTranslation';
import { useMsg } from '../context/useMsg';
import type { Deck, Flashcard } from '../types/flashcard';
import {
  getAllDecks,
  saveDeck,
  deleteDeck,
  getCardsByDeck,
  saveCard,
  deleteCard,
} from '../services/database';
import {
  exportRecallioBundle,
  importRecallioBundle,
  importCardsFromText,
  validateRecallioBundle,
  downloadJson,
  type ImportResult,
} from '../services/importExport';
import { cardState } from '../services/srs';
import { toPlainText } from '../services/richText';
import { addMediaFile, MediaStorageError, pruneUnusedMedia } from '../services/media';
import { filterCardsByQuery } from '../services/searchParser';
import {
  Plus,
  Trash2,
  Edit2,
  Search,
  Download,
  Upload,
  Code,
  CheckCircle2,
  FolderPlus,
  BookOpen,
  Pause,
  Play,
  FileSpreadsheet,
  FileArchive,
} from 'lucide-react';


import { CreateDeckModal } from '../components/deck/CreateDeckModal';
import { CardFormModal } from '../components/deck/CardFormModal';
import { JsonEditorModal } from '../components/deck/JsonEditorModal';

const AnkiImportDialog = lazy(() =>
  import('../components/AnkiImportDialog').then((m) => ({ default: m.AnkiImportDialog }))
);

function summarizeImport(r: ImportResult): string {
  const parts = [`${r.cardsAdded} kartu ditambah`];
  if (r.cardsUpdated) parts.push(`${r.cardsUpdated} diperbarui`);
  if (r.cardsSkipped) parts.push(`${r.cardsSkipped} dilewati (sudah ada)`);
  if (r.decksCreated) parts.push(`${r.decksCreated} deck baru`);
  return parts.join(', ') + '.';
}

const STATE_LABEL = ['Baru', 'Belajar', 'Review', 'Ulang'];

function formatDue(due: number): string {
  const diff = due - Date.now();
  if (diff <= 0) return 'sekarang';
  const days = Math.round(diff / 86400000);
  if (days >= 1) return `${days} hari`;
  const hours = Math.round(diff / 3600000);
  return hours >= 1 ? `${hours} jam` : `${Math.max(Math.round(diff / 60000), 1)} mnt`;
}

interface DeckManagerProps {
  currentDeck: Deck | null;
  onSelectDeck: (deck: Deck) => void;
}

export const DeckManager: React.FC<DeckManagerProps> = ({ currentDeck, onSelectDeck }) => {
  const { t } = useTranslation();
  const m = useMsg();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(currentDeck);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<'due' | 'created' | 'front'>('created');
  const [sortAsc, setSortAsc] = useState(false);

  
  const [isEditingCard, setIsEditingCard] = useState<boolean>(false);
  const [cardFormData, setCardFormData] = useState<Partial<Flashcard>>({});
  const [isCreatingDeck, setIsCreatingDeck] = useState<boolean>(false);
  const [newDeckName, setNewDeckName] = useState('');
  const [newDeckDesc, setNewDeckDesc] = useState('');
  const [isJsonEditorOpen, setIsJsonEditorOpen] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const [showAnkiImport, setShowAnkiImport] = useState(false);

  
  const selectedDeckRef = useRef(selectedDeck);
  const onSelectDeckRef = useRef(onSelectDeck);
  useEffect(() => {
    selectedDeckRef.current = selectedDeck;
    onSelectDeckRef.current = onSelectDeck;
  });

  const applyDecks = useCallback((list: Deck[]) => {
    setDecks(list);
    const selected = selectedDeckRef.current;
    if (!selected && list.length > 0) {
      setSelectedDeck(list[0]);
      onSelectDeckRef.current(list[0]);
    } else if (selected) {
      const exists = list.find((d) => d.id === selected.id);
      if (exists) {
        setSelectedDeck(exists);
      } else if (list.length > 0) {
        setSelectedDeck(list[0]);
        onSelectDeckRef.current(list[0]);
      } else {
        setSelectedDeck(null);
      }
    }
  }, []);

  const refreshDecks = useCallback(async () => {
    applyDecks(await getAllDecks());
  }, [applyDecks]);

  const refreshCards = useCallback(async (deckId: string) => {
    setCards(await getCardsByDeck(deckId));
  }, []);

  
  useEffect(() => {
    let cancelled = false;
    getAllDecks().then((list) => {
      if (!cancelled) applyDecks(list);
    });
    return () => {
      cancelled = true;
    };
  }, [applyDecks]);

  
  const selectedDeckId = selectedDeck?.id;
  useEffect(() => {
    if (!selectedDeckId) return;
    let cancelled = false;
    getCardsByDeck(selectedDeckId).then((list) => {
      if (!cancelled) setCards(list);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedDeckId]);

  
  const visibleCards = useMemo(() => (selectedDeck ? cards : []), [selectedDeck, cards]);
  const availableTags = useMemo(() => {
    const tagsSet = new Set<string>();
    visibleCards.forEach((c) => c.tags?.forEach((t) => tagsSet.add(t)));
    return Array.from(tagsSet);
  }, [visibleCards]);

  const notify = (msg: string) => {
    setFeedbackMessage(msg);
    setTimeout(() => setFeedbackMessage(null), 3500);
  };

  
  const handleCreateDeck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeckName.trim()) return;

    const newDeck: Deck = {
      id: 'deck-' + Date.now(),
      name: newDeckName.trim(),
      description: newDeckDesc.trim(),
      createdAt: Date.now(),
    };
    await saveDeck(newDeck);
    setNewDeckName('');
    setNewDeckDesc('');
    setIsCreatingDeck(false);
    await refreshDecks();
    setSelectedDeck(newDeck);
    onSelectDeck(newDeck);
    notify(`Deck "${newDeck.name}" berhasil dibuat.`);
  };

  const handleDeleteDeck = async (deck: Deck) => {
    if (confirm(`Yakin ingin menghapus deck "${deck.name}" beserta semua kartunya?`)) {
      await deleteDeck(deck.id);
      void pruneUnusedMedia().catch(() => undefined); 
      await refreshDecks();
      notify(`Deck "${deck.name}" telah dihapus.`);
    }
  };

  
  const handleOpenAddCard = () => {
    setCardFormData({
      front: '',
      back: '',
      meaning: '',
      example_jp: '',
      example_hiragana: '',
      example_id: '',
      hint: '',
      tags: [],
    });
    setIsEditingCard(true);
  };

  const handleOpenEditCard = (card: Flashcard) => {
    setCardFormData({ ...card });
    setIsEditingCard(true);
  };

  const handleSaveCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeck) return;

    if (!cardFormData.front || !cardFormData.front.trim()) {
      alert(m('card.frontRequired'));
      return;
    }

    const cardToSave: Flashcard = {
      id: cardFormData.id || 'card-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      deckId: selectedDeck.id,
      front: cardFormData.front || '',
      back: cardFormData.back || '',
      meaning: cardFormData.meaning || '',
      example_jp: cardFormData.example_jp || '',
      example_hiragana: cardFormData.example_hiragana || '',
      example_id: cardFormData.example_id || '',
      hint: cardFormData.hint || '',
      ...(cardFormData.extra ? { extra: cardFormData.extra } : {}),
      tags: cardFormData.tags || [],
      createdAt: cardFormData.createdAt || Date.now(),
      
      srs: cardFormData.srs,
      suspended: cardFormData.suspended,
      buriedUntil: cardFormData.buriedUntil,
    };

    await saveCard(cardToSave);
    setIsEditingCard(false);
    await refreshCards(selectedDeck.id);
    notify(`Kartu "${toPlainText(cardToSave.front)}" disimpan.`);
  };

  const handleDeleteCard = async (card: Flashcard) => {
    if (confirm(`Hapus kartu "${toPlainText(card.front)}"?`)) {
      await deleteCard(card.id);
      void pruneUnusedMedia().catch(() => undefined);
      if (selectedDeck) {
        await refreshCards(selectedDeck.id);
      }
      notify(`Kartu "${toPlainText(card.front)}" dihapus.`);
    }
  };

  
  const handleExportJSON = async () => {
    const bundle = await exportRecallioBundle();
    downloadJson(`inka-decks-${new Date().toISOString().slice(0, 10)}.json`, bundle);
    notify('Daftar flashcard berhasil diekspor ke JSON.');
  };

  
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const fileReader = new FileReader();
    fileReader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        const validation = validateRecallioBundle(parsed);
        if (!validation.valid || !validation.data) {
          alert(`Format JSON tidak valid: ${validation.error}`);
          return;
        }
        const res = await importRecallioBundle(validation.data);
        await refreshDecks();
        if (selectedDeck) await refreshCards(selectedDeck.id);
        notify(`Impor selesai: ${summarizeImport(res)}`);
      } catch (err) {
        alert(`Gagal membaca file JSON: ${(err as Error).message}`);
      }
    };
    fileReader.readAsText(file, 'UTF-8');
  };

  
  const handleImportText = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !selectedDeck) return;
    const deckId = selectedDeck.id;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const res = await importCardsFromText(String(event.target?.result ?? ''), deckId);
        await refreshCards(deckId);
        notify(`Impor CSV: ${summarizeImport(res)}`);
      } catch (err) {
        alert(`Gagal mengimpor: ${(err as Error).message}`);
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleToggleSuspend = async (card: Flashcard) => {
    await saveCard({ ...card, suspended: !card.suspended });
    if (selectedDeck) await refreshCards(selectedDeck.id);
  };

  
  const handleOpenJsonEditor = async () => {
    const bundle = await exportRecallioBundle();
    setJsonText(JSON.stringify(bundle, null, 2));
    setJsonError(null);
    setIsJsonEditorOpen(true);
  };

  const handleSaveJsonEditor = async () => {
    try {
      const parsed = JSON.parse(jsonText);
      const validation = validateRecallioBundle(parsed);
      if (!validation.valid || !validation.data) {
        setJsonError(validation.error || 'Struktur JSON tidak valid.');
        return;
      }

      const res = await importRecallioBundle(validation.data);
      await refreshDecks();
      if (selectedDeck) await refreshCards(selectedDeck.id);
      setIsJsonEditorOpen(false);
      notify(`JSON diterapkan: ${summarizeImport(res)}`);
    } catch (err: any) {
      setJsonError(`Syntax Error: ${err.message}`);
    }
  };

  
  const filteredCards = useMemo(() => {
    let list = filterCardsByQuery(visibleCards, searchQuery);
    if (selectedTag !== 'all') {
      list = list.filter((c) => c.tags && c.tags.includes(selectedTag));
    }

    return list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'due') {
        const dueA = a.srs?.due ?? 0;
        const dueB = b.srs?.due ?? 0;
        cmp = dueA - dueB;
      } else if (sortField === 'front') {
        cmp = toPlainText(a.front).localeCompare(toPlainText(b.front));
      } else {
        cmp = (a.createdAt || 0) - (b.createdAt || 0);
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [visibleCards, searchQuery, selectedTag, sortField, sortAsc]);

  const handleBulkSuspend = async (suspend: boolean) => {
    if (!selectedDeck || selectedCardIds.size === 0) return;
    const targetCards = cards.filter((c) => selectedCardIds.has(c.id));
    for (const c of targetCards) {
      await saveCard({ ...c, suspended: suspend });
    }
    await refreshCards(selectedDeck.id);
    setSelectedCardIds(new Set());
    notify(`${targetCards.length} kartu ${suspend ? 'ditangguhkan' : 'diaktifkan kembali'}.`);
  };

  const handleBulkDelete = async () => {
    if (!selectedDeck || selectedCardIds.size === 0) return;
    if (confirm(`Yakin ingin menghapus ${selectedCardIds.size} kartu terpilih?`)) {
      for (const id of selectedCardIds) {
        await deleteCard(id);
      }
      void pruneUnusedMedia().catch(() => undefined);
      await refreshCards(selectedDeck.id);
      setSelectedCardIds(new Set());
      notify('Kartu terpilih telah dihapus.');
    }
  };

  const handleBulkReset = async () => {
    if (!selectedDeck || selectedCardIds.size === 0) return;
    if (confirm(`Kembalikan ${selectedCardIds.size} kartu menjadi baru (reset progres)?`)) {
      const targetCards = cards.filter((c) => selectedCardIds.has(c.id));
      for (const c of targetCards) {
        await saveCard({ ...c, srs: undefined });
      }
      await refreshCards(selectedDeck.id);
      setSelectedCardIds(new Set());
      notify(`${targetCards.length} kartu telah di-reset menjadi baru.`);
    }
  };

  const handleBulkFlag = async (flagNumber: number) => {
    if (!selectedDeck || selectedCardIds.size === 0) return;
    const targetCards = cards.filter((c) => selectedCardIds.has(c.id));
    for (const c of targetCards) {
      await saveCard({ ...c, flag: flagNumber === c.flag ? 0 : flagNumber });
    }
    await refreshCards(selectedDeck.id);
    setSelectedCardIds(new Set());
    notify(`Flag kartu terpilih diperbarui.`);
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-4 space-y-6">
      
      {feedbackMessage && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-lg animate-fade-in text-sm font-medium">
          <CheckCircle2 size={18} />
          {feedbackMessage}
        </div>
      )}

      
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t.deckManagerTitle}</h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            {t.deckManagerSubtitle}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsCreatingDeck(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-xl text-xs sm:text-sm font-medium transition"
          >
            <FolderPlus size={16} /> {t.newDeckBtn}
          </button>
          <button
            onClick={handleOpenJsonEditor}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs sm:text-sm font-medium hover:bg-indigo-100 transition"
          >
            <Code size={16} /> {t.jsonEditorBtn}
          </button>
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs sm:text-sm font-medium hover:bg-slate-200 transition"
          >
            <Download size={16} /> {t.exportJsonBtn}
          </button>
          <label
            data-sfx="file"
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs sm:text-sm font-medium hover:bg-slate-200 transition cursor-pointer"
          >
            <Upload size={16} /> {t.importJsonBtn}
            <input type="file" accept=".json" onChange={handleImportFile} className="hidden" />
          </label>
          <label
            data-sfx="file"
            className={`flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs sm:text-sm font-medium transition ${
              selectedDeck ? 'hover:bg-slate-200 cursor-pointer' : 'opacity-40 pointer-events-none'
            }`}
            title="Kolom: depan, belakang, arti, contoh JP, contoh hiragana, terjemahan, hint, tag"
          >
            <FileSpreadsheet size={16} /> Import CSV/TXT
            <input type="file" accept=".csv,.tsv,.txt,text/plain,text/csv" onChange={handleImportText} className="hidden" />
          </label>
          <button
            type="button"
            data-sfx="file"
            onClick={() => setShowAnkiImport(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs sm:text-sm font-medium hover:bg-indigo-100 transition"
          >
            <FileArchive size={16} /> {t.importAnkiBtn}
          </button>
        </div>
      </div>

      
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {decks.map((deck) => (
          <div
            key={deck.id}
            className={`group flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer transition border ${
              selectedDeck?.id === deck.id
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'
            }`}
            onClick={() => {
              setSelectedDeck(deck);
              onSelectDeck(deck);
            }}
          >
            <BookOpen size={16} />
            <span>{deck.name}</span>
            {decks.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteDeck(deck);
                }}
                className="opacity-0 group-hover:opacity-100 hover:text-red-300 transition-opacity ml-1"
                title="Hapus Deck"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      
      {selectedDeck && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 text-slate-600 dark:text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Cari kanji, hiragana, atau arti..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            
            {availableTags.length > 0 && (
              <select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-200 focus:outline-none"
              >
                <option value="all">Semua Tag ({visibleCards.length})</option>
                {availableTags.map((tag) => (
                  <option key={tag} value={tag}>
                    #{tag}
                  </option>
                ))}
              </select>
            )}

            
            {selectedCardIds.size > 0 && (
              <div className="flex items-center justify-between p-2.5 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl text-xs font-semibold text-indigo-900 dark:text-indigo-200">
                <span>{selectedCardIds.size} kartu terpilih</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => handleBulkSuspend(true)}
                    className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100"
                  >
                    Tangguhkan
                  </button>
                  <button
                    onClick={() => handleBulkSuspend(false)}
                    className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100"
                  >
                    Aktifkan
                  </button>
                  <button
                    onClick={handleBulkReset}
                    className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100"
                  >
                    Reset (Jadikan Baru)
                  </button>
                  <button
                    onClick={() => handleBulkFlag(1)}
                    className="px-2.5 py-1 bg-rose-50 text-rose-600 border border-rose-200 rounded-lg hover:bg-rose-100"
                  >
                    🚩 Merah
                  </button>
                  <button
                    onClick={() => handleBulkFlag(2)}
                    className="px-2.5 py-1 bg-amber-50 text-amber-600 border border-amber-200 rounded-lg hover:bg-amber-100"
                  >
                    🚩 Oranye
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    className="px-2.5 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={handleOpenAddCard}
              className="flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-xs transition"
            >
              <Plus size={16} /> Tambah Kartu
            </button>
          </div>

          
          <div className="overflow-x-auto">
            {filteredCards.length === 0 ? (
              <div className="py-8 text-center text-slate-600 dark:text-slate-400 text-sm">
                Tidak ada flashcard yang cocok dengan kriteria pencarian.
              </div>
            ) : (
              <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
                <thead className="text-xs uppercase bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-3 w-8">
                      <input
                        type="checkbox"
                        checked={selectedCardIds.size === filteredCards.length && filteredCards.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCardIds(new Set(filteredCards.map((c) => c.id)));
                          } else {
                            setSelectedCardIds(new Set());
                          }
                        }}
                      />
                    </th>
                    <th
                      className="py-3 px-4 cursor-pointer hover:text-indigo-600"
                      onClick={() => {
                        setSortField('front');
                        setSortAsc(!sortAsc);
                      }}
                    >
                      Depan (Kanji) {sortField === 'front' && (sortAsc ? '↑' : '↓')}
                    </th>
                    <th className="py-3 px-4">Belakang (Hiragana)</th>
                    <th className="py-3 px-4">Arti</th>
                    <th className="py-3 px-4">Contoh Kalimat</th>
                    <th
                      className="py-3 px-4 cursor-pointer hover:text-indigo-600"
                      onClick={() => {
                        setSortField('due');
                        setSortAsc(!sortAsc);
                      }}
                    >
                      Status / Due {sortField === 'due' && (sortAsc ? '↑' : '↓')}
                    </th>
                    <th className="py-3 px-4">Tags</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredCards.map((card) => {
                    const isSelected = selectedCardIds.has(card.id);
                    return (
                      <tr
                        key={card.id}
                        className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition ${
                          isSelected ? 'bg-indigo-50/50 dark:bg-indigo-950/30' : ''
                        }`}
                      >
                        <td className="py-3 px-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              const s = new Set(selectedCardIds);
                              if (e.target.checked) s.add(card.id);
                              else s.delete(card.id);
                              setSelectedCardIds(s);
                            }}
                          />
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white text-base">
                          <div className="flex items-center gap-1.5">
                            {card.flag && card.flag > 0 ? (
                              <span
                                className={`text-xs ${
                                  card.flag === 1
                                    ? 'text-red-500'
                                    : card.flag === 2
                                    ? 'text-orange-500'
                                    : 'text-blue-500'
                                }`}
                              >
                                🚩
                              </span>
                            ) : null}
                            <span>{toPlainText(card.front)}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-medium">{toPlainText(card.back)}</td>
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-200">
                          {toPlainText(card.meaning)}
                        </td>
                        <td className="py-3 px-4 text-xs max-w-xs truncate" title={toPlainText(card.example_jp)}>
                          <div className="font-japanese font-medium text-slate-800 dark:text-slate-200">{toPlainText(card.example_jp)}</div>
                          <div className="text-slate-600 dark:text-slate-400">{toPlainText(card.example_id)}</div>
                        </td>
                        <td className="py-3 px-4 text-xs whitespace-nowrap">
                          {card.suspended ? (
                            <span className="text-amber-700 dark:text-amber-400 font-semibold">Ditangguhkan</span>
                          ) : (
                            <>
                              <span className="font-semibold">{STATE_LABEL[cardState(card)]}</span>
                              {card.srs && card.srs.state !== 0 && (
                                <span className="text-slate-600 dark:text-slate-400"> · {formatDue(card.srs.due)}</span>
                              )}
                            </>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-1 flex-wrap">
                            {card.tags?.map((t) => (
                              <span key={t} className="text-[11px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                {t}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleToggleSuspend(card)}
                              className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-amber-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                              title={card.suspended ? 'Aktifkan kembali' : 'Tangguhkan'}
                              aria-label={card.suspended ? 'Aktifkan kembali kartu' : 'Tangguhkan kartu'}
                            >
                              {card.suspended ? <Play size={16} /> : <Pause size={16} />}
                            </button>
                            <button
                              onClick={() => handleOpenEditCard(card)}
                              className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="Edit Kartu"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteCard(card)}
                              className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="Hapus Kartu"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      
      <CreateDeckModal
        isOpen={isCreatingDeck}
        name={newDeckName}
        description={newDeckDesc}
        onNameChange={setNewDeckName}
        onDescChange={setNewDeckDesc}
        onClose={() => setIsCreatingDeck(false)}
        onSubmit={handleCreateDeck}
      />

      
      <CardFormModal
        isOpen={isEditingCard}
        formData={cardFormData}
        onChange={setCardFormData}
        onClose={() => setIsEditingCard(false)}
        onSubmit={handleSaveCard}
        onAttachMedia={async (files) => {
          const file = files?.[0];
          if (!file) return;
          try {
            const token = await addMediaFile(file);
            setCardFormData((d) => ({ ...d, extra: d.extra ? `${d.extra} ${token}` : token }));
          } catch (err) {
            alert(err instanceof MediaStorageError ? err.message : m('card.attachFail', { err: (err as Error).message }));
          }
        }}
      />

      
      <JsonEditorModal
        isOpen={isJsonEditorOpen}
        jsonText={jsonText}
        jsonError={jsonError}
        onTextChange={setJsonText}
        onClose={() => setIsJsonEditorOpen(false)}
        onApply={handleSaveJsonEditor}
      />
      {showAnkiImport && (
        <Suspense fallback={null}>
          <AnkiImportDialog
            onClose={() => setShowAnkiImport(false)}
            onDone={() => {
              void refreshDecks().then(() => selectedDeck && refreshCards(selectedDeck.id));
            }}
          />
        </Suspense>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
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
  validateRecallioBundle,
} from '../services/importExport';
import {
  Plus,
  Trash2,
  Edit2,
  Search,
  Download,
  Upload,
  Code,
  CheckCircle2,
  AlertTriangle,
  FolderPlus,
  BookOpen,
} from 'lucide-react';

interface DeckManagerProps {
  currentDeck: Deck | null;
  onSelectDeck: (deck: Deck) => void;
}

export const DeckManager: React.FC<DeckManagerProps> = ({ currentDeck, onSelectDeck }) => {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(currentDeck);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  // Modals & Panels
  const [isEditingCard, setIsEditingCard] = useState<boolean>(false);
  const [cardFormData, setCardFormData] = useState<Partial<Flashcard>>({});
  const [isCreatingDeck, setIsCreatingDeck] = useState<boolean>(false);
  const [newDeckName, setNewDeckName] = useState('');
  const [newDeckDesc, setNewDeckDesc] = useState('');
  const [isJsonEditorOpen, setIsJsonEditorOpen] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Load decks on mount
  useEffect(() => {
    refreshDecks();
  }, []);

  const refreshDecks = async () => {
    const list = await getAllDecks();
    setDecks(list);
    if (!selectedDeck && list.length > 0) {
      setSelectedDeck(list[0]);
      onSelectDeck(list[0]);
    } else if (selectedDeck) {
      const exists = list.find(d => d.id === selectedDeck.id);
      if (exists) {
        setSelectedDeck(exists);
      } else if (list.length > 0) {
        setSelectedDeck(list[0]);
        onSelectDeck(list[0]);
      } else {
        setSelectedDeck(null);
      }
    }
  };

  // Load cards when selected deck changes
  useEffect(() => {
    if (selectedDeck) {
      refreshCards(selectedDeck.id);
    } else {
      setCards([]);
      setAvailableTags([]);
    }
  }, [selectedDeck]);

  const refreshCards = async (deckId: string) => {
    const cardList = await getCardsByDeck(deckId);
    setCards(cardList);

    // Extract tags
    const tagsSet = new Set<string>();
    cardList.forEach(c => c.tags?.forEach(t => tagsSet.add(t)));
    setAvailableTags(Array.from(tagsSet));
  };

  const notify = (msg: string) => {
    setFeedbackMessage(msg);
    setTimeout(() => setFeedbackMessage(null), 3500);
  };

  // Deck CRUD
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
      await refreshDecks();
      notify(`Deck "${deck.name}" telah dihapus.`);
    }
  };

  // Card CRUD
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

    if (!cardFormData.front || !cardFormData.back || !cardFormData.meaning) {
      alert('Isi minimal kolom Depan (Kanji), Belakang (Hiragana), dan Arti.');
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
      tags: cardFormData.tags || [],
      createdAt: cardFormData.createdAt || Date.now(),
    };

    await saveCard(cardToSave);
    setIsEditingCard(false);
    await refreshCards(selectedDeck.id);
    notify(`Kartu "${cardToSave.front}" disimpan.`);
  };

  const handleDeleteCard = async (card: Flashcard) => {
    if (confirm(`Hapus kartu "${card.front}"?`)) {
      await deleteCard(card.id);
      if (selectedDeck) {
        await refreshCards(selectedDeck.id);
      }
      notify(`Kartu "${card.front}" dihapus.`);
    }
  };

  // Export JSON
  const handleExportJSON = async () => {
    const bundle = await exportRecallioBundle();
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(bundle, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `inka-decks-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    notify('Daftar flashcard berhasil diekspor ke JSON.');
  };

  // Import JSON File
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], 'UTF-8');
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
          notify(`Berhasil mengimpor ${res.decksImported} deck & ${res.cardsImported} kartu!`);
        } catch (err: any) {
          alert(`Gagal membaca file JSON: ${err.message}`);
        }
      };
    }
  };

  // Open JSON Direct Editor
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

      await importRecallioBundle(validation.data);
      await refreshDecks();
      setIsJsonEditorOpen(false);
      notify('JSON bundle berhasil disimpan dan diterapkan!');
    } catch (err: any) {
      setJsonError(`Syntax Error: ${err.message}`);
    }
  };

  // Filter cards
  const filteredCards = cards.filter((card) => {
    const matchesSearch =
      card.front.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.back.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.meaning.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.example_jp.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTag = selectedTag === 'all' || (card.tags && card.tags.includes(selectedTag));

    return matchesSearch && matchesTag;
  });

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-4 space-y-6">
      {/* Toast Notification */}
      {feedbackMessage && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-lg animate-fade-in text-sm font-medium">
          <CheckCircle2 size={18} />
          {feedbackMessage}
        </div>
      )}

      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Pengelolaan Flashcard</h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Kelola kumpulan deck, tambah/edit kosakata manual, atau edit langsung via JSON.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsCreatingDeck(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-xl text-xs sm:text-sm font-medium transition"
          >
            <FolderPlus size={16} /> Deck Baru
          </button>
          <button
            onClick={handleOpenJsonEditor}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs sm:text-sm font-medium hover:bg-indigo-100 transition"
          >
            <Code size={16} /> JSON Editor
          </button>
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs sm:text-sm font-medium hover:bg-slate-200 transition"
          >
            <Download size={16} /> Export
          </button>
          <label className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs sm:text-sm font-medium hover:bg-slate-200 transition cursor-pointer">
            <Upload size={16} /> Import JSON
            <input type="file" accept=".json" onChange={handleImportFile} className="hidden" />
          </label>
        </div>
      </div>

      {/* Deck Selector Tabs */}
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

      {/* Search & Tag Filter & Add Card */}
      {selectedDeck && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Cari kanji, hiragana, atau arti..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Tags filter */}
            {availableTags.length > 0 && (
              <select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-200 focus:outline-none"
              >
                <option value="all">Semua Tag ({cards.length})</option>
                {availableTags.map((tag) => (
                  <option key={tag} value={tag}>
                    #{tag}
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={handleOpenAddCard}
              className="flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-xs transition"
            >
              <Plus size={16} /> Tambah Kartu
            </button>
          </div>

          {/* Cards List Table/Grid */}
          <div className="overflow-x-auto">
            {filteredCards.length === 0 ? (
              <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-sm">
                Tidak ada flashcard yang cocok dengan kriteria pencarian.
              </div>
            ) : (
              <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
                <thead className="text-xs uppercase bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Depan (Kanji)</th>
                    <th className="py-3 px-4">Belakang (Hiragana)</th>
                    <th className="py-3 px-4">Arti</th>
                    <th className="py-3 px-4">Contoh Kalimat</th>
                    <th className="py-3 px-4">Tags</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredCards.map((card) => (
                    <tr key={card.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white text-base">
                        {card.front}
                      </td>
                      <td className="py-3 px-4 font-medium">{card.back}</td>
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-200">
                        {card.meaning}
                      </td>
                      <td className="py-3 px-4 text-xs max-w-xs truncate" title={card.example_jp}>
                        <div className="font-japanese font-medium text-slate-800 dark:text-slate-200">{card.example_jp}</div>
                        <div className="text-slate-400">{card.example_id}</div>
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
                            onClick={() => handleOpenEditCard(card)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Edit Kartu"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteCard(card)}
                            className="p-1.5 text-slate-500 hover:text-red-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Hapus Kartu"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Modal: Create Deck */}
      {isCreatingDeck && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Buat Deck Baru</h3>
            <form onSubmit={handleCreateDeck} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Nama Deck *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Kosakata N3 Bab 1"
                  value={newDeckName}
                  onChange={(e) => setNewDeckName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Deskripsi (opsional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Keterangan singkat materi deck ini..."
                  value={newDeckDesc}
                  onChange={(e) => setNewDeckDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingDeck(false)}
                  className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700"
                >
                  Simpan Deck
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add/Edit Card */}
      {isEditingCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-xl shadow-2xl my-8">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
              {cardFormData.id ? 'Edit Flashcard' : 'Tambah Flashcard Baru'}
            </h3>
            <form onSubmit={handleSaveCard} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Front / Kanji *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: 水"
                    value={cardFormData.front || ''}
                    onChange={(e) => setCardFormData({ ...cardFormData, front: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-japanese font-bold text-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Back / Hiragana *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: みず"
                    value={cardFormData.back || ''}
                    onChange={(e) => setCardFormData({ ...cardFormData, back: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-japanese font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Arti Bahasa Indonesia *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Air"
                  value={cardFormData.meaning || ''}
                  onChange={(e) => setCardFormData({ ...cardFormData, meaning: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Contoh Kalimat Jepang (example_jp) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: 水を飲みます。"
                  value={cardFormData.example_jp || ''}
                  onChange={(e) => setCardFormData({ ...cardFormData, example_jp: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-japanese"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Hiragana Contoh Kalimat *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: みずを のみます。"
                    value={cardFormData.example_hiragana || ''}
                    onChange={(e) =>
                      setCardFormData({ ...cardFormData, example_hiragana: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-japanese"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Terjemahan Contoh Kalimat *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Saya minum air."
                    value={cardFormData.example_id || ''}
                    onChange={(e) => setCardFormData({ ...cardFormData, example_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Tags (pisahkan dengan koma)
                </label>
                <input
                  type="text"
                  placeholder="n4, noun, travel"
                  value={cardFormData.tags ? cardFormData.tags.join(', ') : ''}
                  onChange={(e) =>
                    setCardFormData({
                      ...cardFormData,
                      tags: e.target.value
                        .split(',')
                        .map((t) => t.trim().toLowerCase())
                        .filter(Boolean),
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsEditingCard(false)}
                  className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 shadow-sm"
                >
                  Simpan Kartu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Full Direct JSON Editor */}
      {isJsonEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-3xl h-[85vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Direct JSON Editor</h3>
                <p className="text-xs text-slate-500">
                  Format: recallio.deck-bundle (v1). Edit seluruh daftar flashcard dan deck sekaligus.
                </p>
              </div>
              <button
                onClick={() => setIsJsonEditorOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-sm"
              >
                Tutup
              </button>
            </div>

            {jsonError && (
              <div className="mt-3 p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle size={16} />
                <span>{jsonError}</span>
              </div>
            )}

            <div className="flex-1 my-3 relative">
              <textarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                className="w-full h-full font-mono text-xs p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                spellCheck={false}
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-400">
                Data akan diverifikasi sebelum disimpan ke IndexedDB.
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsJsonEditorOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveJsonEditor}
                  className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 shadow-sm"
                >
                  Terapkan Perubahan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

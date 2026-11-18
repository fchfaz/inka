export type Language = 'id' | 'en';

export interface Translations {
  // Navigation
  navStudy: string;
  navDecks: string;
  navStats: string;
  navSettings: string;

  // Study View
  deckDropdownTitle: string;
  createManageOtherDecks: string;
  totalCardsCount: (count: number) => string;
  emptyDeckTitle: string;
  emptyDeckDesc: string;
  manageCardsAndDecks: string;
  loadingFlashcard: string;
  queueRemaining: string;
  queueNew: string;
  queueLearning: string;
  queueReview: string;
  showAnswer: string;
  cardsStudiedToday: string;
  countCardsSuffix: (count: number) => string;
  actionUndo: string;
  actionSuspend: string;
  actionBury: string;
  actionVoice: string;
  sessionFinishedTitle: string;
  nextLearningClock: (clock: string) => string;
  noDueCardsTomorrow: string;
  addNewCardsBtn: (count: number) => string;

  // Flashcard
  badgeFront: string;
  badgeBack: string;
  meaningLabel: string;
  exampleUsageLabel: string;

  // Deck Manager
  deckManagerTitle: string;
  deckManagerSubtitle: string;
  newDeckBtn: string;
  jsonEditorBtn: string;
  importAnkiBtn: string;
  exportJsonBtn: string;
  importJsonBtn: string;
  searchPlaceholder: string;
  allTagsOption: (count: number) => string;
  addCardBtn: string;
  noMatchingCards: string;
  thFront: string;
  thBack: string;
  thMeaning: string;
  thExamples: string;
  thTags: string;
  thActions: string;
  editCardTitle: string;
  addCardModalTitle: string;
  createDeckModalTitle: string;
  deckNameLabel: string;
  deckDescLabel: string;
  cancelBtn: string;
  saveDeckBtn: string;
  saveCardBtn: string;
  applyChangesBtn: string;
  directJsonEditorTitle: string;
  directJsonEditorDesc: string;
  jsonVerificationNotice: string;

  // Settings
  settingsTitle: string;
  settingsSubtitle: string;
  themeTitle: string;
  themeSubtitle: string;
  languageTitle: string;
  languageSubtitle: string;
  dailyTargetSectionTitle: string;
  dailyTargetSectionDesc: string;
  newCardsPerDayLabel: string;
  reviewsPerDayLabel: string;
  desiredRetentionLabel: string;
  dayStartHourLabel: string;
  dayStartHourHint: string;
  learningIntervalSectionTitle: string;
  learningIntervalSectionDesc: string;
  learningStepsLabel: string;
  relearningStepsLabel: string;
  maxIntervalLabel: string;
  leechThresholdLabel: string;
  leechThresholdHint: string;
  audioSfxSectionTitle: string;
  audioSfxSectionDesc: string;
  autoSpeakLabel: string;
  autoSpeakDesc: string;
  soundEffectsLabel: string;
  soundEffectsDesc: string;
  soundVolumeLabel: string;
  soundTestLabel: string;
  backupSectionTitle: string;
  backupSectionDesc: string;
  createBackupBtn: string;
  restoreBackupBtn: string;
  mediaStorageSectionTitle: string;
  mediaStorageSectionDesc: string;
  cleanUnusedMediaBtn: string;
  saveSettingsBtn: string;
  settingsSavedNotice: string;

  // Statistics
  statsTitle: string;
  statsSubtitle: string;
  allDecksOption: string;
  range7d: string;
  range1m: string;
  range3m: string;
  range1y: string;
  rangeAll: string;
  noStatsHistoryTitle: string;
  noStatsHistoryDesc: string;
  startStudyingNow: string;
  kpiToday: string;
  kpiStudiedTodayCards: string;
  kpiTodayTime: string;
  kpiPassRateToday: string;
  kpiStreak: string;
  kpiLongestStreak: (days: number) => string;
  kpiSummarySentence: (cards: number, mins: number, secs: number) => string;
  kpiDailyResetHint: string;
  calendarTitle: string;
  calendarSubtitle: string;
  calendarAvgPerDay: (avg: number) => string;
  reviewVolumeTitle: string;
  reviewVolumeSubtitle: string;
  metricCards: string;
  metricTime: string;
  answerButtonsTitle: string;
  answerButtonsSubtitle: string;
  cardMasteryTitle: string;
  cardMasterySubtitle: string;
  futureQueueTitle: string;
  futureQueueSubtitle: string;
  hourlyTitle: string;
  hourlySubtitle: string;
  leechesTitle: string;
  leechesSubtitle: string;
  answerSpeedTitle: string;
  answerSpeedSubtitle: string;
  cardAddedTitle: string;
  cardAddedSubtitle: string;
  notesArchitectureTitle: string;
  notesArchitectureContent: string;
}

export const translations: Record<Language, Translations> = {
  id: {
    navStudy: 'Belajar',
    navDecks: 'Kelola Deck',
    navStats: 'Statistik',
    navSettings: 'Pengaturan',

    deckDropdownTitle: 'Pilih Deck',
    createManageOtherDecks: '+ Buat / Kelola Deck Lain',
    totalCardsCount: (count) => `Total: ${count} kartu`,
    emptyDeckTitle: 'Deck Kosong',
    emptyDeckDesc: 'Belum ada kartu di deck ini atau belum ada deck yang dipilih. Anda dapat menambahkan kartu atau mengimpor file Anki/JSON.',
    manageCardsAndDecks: 'Kelola Flashcard & Deck',
    loadingFlashcard: 'Memuat flashcard...',
    queueRemaining: 'Sisa antrean',
    queueNew: 'Baru',
    queueLearning: 'Belajar',
    queueReview: 'Review',
    showAnswer: 'Tampilkan Jawaban',
    cardsStudiedToday: 'Kartu dipelajari hari ini:',
    countCardsSuffix: (count) => `${count} kartu`,
    actionUndo: 'Undo',
    actionSuspend: 'Suspend',
    actionBury: 'Bury',
    actionVoice: 'Suara',
    sessionFinishedTitle: 'Selesai untuk sekarang',
    nextLearningClock: (clock) => `Kartu berikutnya muncul sekitar pukul ${clock}.`,
    noDueCardsTomorrow: 'Tidak ada kartu yang jatuh tempo. Kembali lagi besok.',
    addNewCardsBtn: (count) => `Tambah ${count} kartu baru`,

    badgeFront: 'Front',
    badgeBack: 'Back',
    meaningLabel: 'ARTI',
    exampleUsageLabel: 'CONTOH PENGGUNAAN',

    deckManagerTitle: 'Pengelolaan Flashcard',
    deckManagerSubtitle: 'Kelola kumpulan deck, tambah/edit kosakata manual, impor Anki (.apkg), atau edit langsung via JSON.',
    newDeckBtn: 'Deck Baru',
    jsonEditorBtn: 'JSON Editor',
    importAnkiBtn: 'Impor Anki (.apkg)',
    exportJsonBtn: 'Export',
    importJsonBtn: 'Import JSON',
    searchPlaceholder: 'Cari kanji, hiragana, atau arti...',
    allTagsOption: (count) => `Semua Tag (${count})`,
    addCardBtn: 'Tambah Kartu',
    noMatchingCards: 'Tidak ada flashcard yang cocok dengan kriteria pencarian.',
    thFront: 'Depan (Kanji)',
    thBack: 'Belakang (Hiragana)',
    thMeaning: 'Arti',
    thExamples: 'Contoh Kalimat',
    thTags: 'Tags',
    thActions: 'Aksi',
    editCardTitle: 'Edit Flashcard',
    addCardModalTitle: 'Tambah Flashcard Baru',
    createDeckModalTitle: 'Buat Deck Baru',
    deckNameLabel: 'Nama Deck *',
    deckDescLabel: 'Deskripsi (opsional)',
    cancelBtn: 'Batal',
    saveDeckBtn: 'Simpan Deck',
    saveCardBtn: 'Simpan Kartu',
    applyChangesBtn: 'Terapkan Perubahan',
    directJsonEditorTitle: 'Direct JSON Editor',
    directJsonEditorDesc: 'Format: recallio.deck-bundle (v1). Edit seluruh daftar flashcard dan deck sekaligus.',
    jsonVerificationNotice: 'Data akan diverifikasi sebelum disimpan ke IndexedDB.',

    settingsTitle: 'Pengaturan',
    settingsSubtitle: 'Konfigurasi target harian, algoritma FSRS, audio, dan pencadangan data.',
    themeTitle: 'Mode Gelap (Dark Mode)',
    themeSubtitle: 'Ubah tema tampilan antara gelap dan terang',
    languageTitle: 'Bahasa Aplikasi (Language)',
    languageSubtitle: 'Pilih bahasa antarmuka aplikasi',
    dailyTargetSectionTitle: 'Target & Batas Harian',
    dailyTargetSectionDesc: 'Jumlah kartu baru dan review maksimum yang akan disajikan setiap hari.',
    newCardsPerDayLabel: 'Kartu baru per hari',
    reviewsPerDayLabel: 'Maksimum review per hari',
    desiredRetentionLabel: 'Target Retensi FSRS',
    dayStartHourLabel: 'Jam pergantian hari',
    dayStartHourHint: 'Kartu hari baru mulai dihitung sejak jam ini.',
    learningIntervalSectionTitle: 'Langkah & Batas Interval',
    learningIntervalSectionDesc: 'Langkah pembelajaran untuk kartu baru dan kartu yang terlupa.',
    learningStepsLabel: 'Langkah belajar (baru)',
    relearningStepsLabel: 'Langkah belajar ulang (lapse)',
    maxIntervalLabel: 'Interval maksimum (hari)',
    leechThresholdLabel: 'Batas Leech (gagal berturut-turut)',
    leechThresholdHint: '0 = nonaktif. Kartu otomatis disuspend saat mencapai batas ini.',
    audioSfxSectionTitle: 'Audio & Efek Suara',
    audioSfxSectionDesc: 'Pengucapan teks bahasa Jepang (TTS) dan efek audio UI.',
    autoSpeakLabel: 'Bacakan otomatis saat kartu dibalik',
    autoSpeakDesc: 'Gunakan Web Speech API untuk membacakan kosakata dan kalimat.',
    soundEffectsLabel: 'Aktifkan efek suara UI',
    soundEffectsDesc: 'Suara sintetis Web Audio saat menekan tombol.',
    soundVolumeLabel: 'Volume Suara',
    soundTestLabel: 'Uji Suara',
    backupSectionTitle: 'Cadangan & Pemulihan (Backup & Restore)',
    backupSectionDesc: 'Simpan seluruh koleksi deck, riwayat review, pengaturan, dan berkas media ke dalam satu berkas .inkabackup.',
    createBackupBtn: 'Unduh Cadangan Lengkap',
    restoreBackupBtn: 'Pulihkan dari Berkas Cadangan',
    mediaStorageSectionTitle: 'Penyimpanan Media Lokal',
    mediaStorageSectionDesc: 'Kelola media suara dan gambar yang disimpan di IndexedDB dari impor Anki.',
    cleanUnusedMediaBtn: 'Bersihkan Media Tak Terpakai',
    saveSettingsBtn: 'Simpan Pengaturan',
    settingsSavedNotice: 'Pengaturan disimpan.',

    statsTitle: 'Statistik Pembelajaran',
    statsSubtitle: 'Analisis kemajuan, kebiasaan belajar, dan penguasaan kartu secara mendalam.',
    allDecksOption: 'Semua Deck',
    range7d: '7 Hari',
    range1m: '1 Bulan',
    range3m: '3 Bulan',
    range1y: '1 Tahun',
    rangeAll: 'Semua',
    noStatsHistoryTitle: 'Belum Ada Riwayat Belajar',
    noStatsHistoryDesc: 'Mulai pelajari flashcard di layar Belajar untuk melihat data statistik, heatmap aktivitas, dan grafik penguasaan kartu secara riil.',
    startStudyingNow: 'Mulai Belajar Sekarang',
    kpiToday: 'Hari Ini',
    kpiStudiedTodayCards: 'kartu dipelajari',
    kpiTodayTime: 'Waktu Hari Ini',
    kpiPassRateToday: 'Pass Rate Hari Ini',
    kpiStreak: 'Streak',
    kpiLongestStreak: (days) => `Terpanjang: ${days} hari`,
    kpiSummarySentence: (cards, mins, secs) => `Hari ini Anda telah mempelajari ${cards} kartu dalam ${mins} menit (${secs} detik/kartu).`,
    kpiDailyResetHint: 'Reset harian: 03:00 pagi',
    calendarTitle: 'Kalender Aktivitas',
    calendarSubtitle: 'Intensitas review harian dengan batas pergantian hari pukul 03:00 pagi.',
    calendarAvgPerDay: (avg) => `Rata-rata: ${avg} review/hari`,
    reviewVolumeTitle: 'Jumlah Review & Waktu Belajar',
    reviewVolumeSubtitle: 'Volume kartu yang dijawab dan distribusi tombol review pada rentang waktu terpilih.',
    metricCards: 'Jumlah Kartu',
    metricTime: 'Waktu (Menit)',
    answerButtonsTitle: 'Distribusi Tombol Jawaban',
    answerButtonsSubtitle: 'Tingkat kelulusan (Pass Rate) = (Hard + Good + Easy) / Total.',
    cardMasteryTitle: 'Status Penguasaan Kartu',
    cardMasterySubtitle: 'Dihitung berdasarkan rating review terakhir tiap kartu.',
    futureQueueTitle: 'Antrean Interval Mendatang',
    futureQueueSubtitle: 'Kartu yang telah dijadwalkan akan muncul dalam N giliran kartu ke depan.',
    hourlyTitle: 'Pola Jam Belajar',
    hourlySubtitle: 'Aktivitas belajar per jam sepanjang hari (waktu lokal perangkat).',
    leechesTitle: 'Kartu Paling Sering Diulang (Leeches)',
    leechesSubtitle: "Kosakata dengan jumlah tombol 'Again' terbanyak yang memerlukan latihan ekstra.",
    answerSpeedTitle: 'Kecepatan Menjawab per Kartu',
    answerSpeedSubtitle: 'Rata-rata dan median waktu berpikir sebelum menekan tombol jawaban.',
    cardAddedTitle: 'Penambahan Kosakata',
    cardAddedSubtitle: 'Total kartu terdaftar pada koleksi ini.',
    notesArchitectureTitle: 'Catatan Penjadwalan Inka',
    notesArchitectureContent: 'Inka mendukung algoritma FSRS dan antrean review dinamis. Statistik akan semakin kaya dan akurat seiring rutinitas belajar Anda.',
  },

  en: {
    navStudy: 'Study',
    navDecks: 'Decks',
    navStats: 'Stats',
    navSettings: 'Settings',

    deckDropdownTitle: 'Select Deck',
    createManageOtherDecks: '+ Create / Manage Other Decks',
    totalCardsCount: (count) => `Total: ${count} cards`,
    emptyDeckTitle: 'Empty Deck',
    emptyDeckDesc: 'There are no cards in this deck or no deck is selected yet. You can add cards manually or import from Anki/JSON files.',
    manageCardsAndDecks: 'Manage Flashcards & Decks',
    loadingFlashcard: 'Loading flashcards...',
    queueRemaining: 'Remaining queue',
    queueNew: 'New',
    queueLearning: 'Learn',
    queueReview: 'Review',
    showAnswer: 'Show Answer',
    cardsStudiedToday: 'Cards studied today:',
    countCardsSuffix: (count) => `${count} cards`,
    actionUndo: 'Undo',
    actionSuspend: 'Suspend',
    actionBury: 'Bury',
    actionVoice: 'Audio',
    sessionFinishedTitle: 'All caught up for now',
    nextLearningClock: (clock) => `Next card due around ${clock}.`,
    noDueCardsTomorrow: 'No cards are due. Check back tomorrow!',
    addNewCardsBtn: (count) => `Add ${count} new cards`,

    badgeFront: 'Front',
    badgeBack: 'Back',
    meaningLabel: 'MEANING',
    exampleUsageLabel: 'EXAMPLE USAGE',

    deckManagerTitle: 'Flashcard Management',
    deckManagerSubtitle: 'Organize decks, create/edit cards manually, import Anki (.apkg), or edit directly via JSON.',
    newDeckBtn: 'New Deck',
    jsonEditorBtn: 'JSON Editor',
    importAnkiBtn: 'Import Anki (.apkg)',
    exportJsonBtn: 'Export',
    importJsonBtn: 'Import JSON',
    searchPlaceholder: 'Search kanji, hiragana, or meaning...',
    allTagsOption: (count) => `All Tags (${count})`,
    addCardBtn: 'Add Card',
    noMatchingCards: 'No flashcards matched your search criteria.',
    thFront: 'Front (Kanji)',
    thBack: 'Back (Hiragana)',
    thMeaning: 'Meaning',
    thExamples: 'Example Sentences',
    thTags: 'Tags',
    thActions: 'Actions',
    editCardTitle: 'Edit Flashcard',
    addCardModalTitle: 'Add New Flashcard',
    createDeckModalTitle: 'Create New Deck',
    deckNameLabel: 'Deck Name *',
    deckDescLabel: 'Description (optional)',
    cancelBtn: 'Cancel',
    saveDeckBtn: 'Save Deck',
    saveCardBtn: 'Save Card',
    applyChangesBtn: 'Apply Changes',
    directJsonEditorTitle: 'Direct JSON Editor',
    directJsonEditorDesc: 'Format: recallio.deck-bundle (v1). Edit all flashcards and decks simultaneously.',
    jsonVerificationNotice: 'Data will be verified before saving to IndexedDB.',

    settingsTitle: 'Settings',
    settingsSubtitle: 'Configure daily goals, FSRS algorithm, audio, and data backups.',
    themeTitle: 'Dark Mode',
    themeSubtitle: 'Toggle between dark and light appearance theme',
    languageTitle: 'App Language',
    languageSubtitle: 'Select user interface language',
    dailyTargetSectionTitle: 'Daily Goals & Limits',
    dailyTargetSectionDesc: 'Maximum number of new cards and reviews presented each day.',
    newCardsPerDayLabel: 'New cards per day',
    reviewsPerDayLabel: 'Maximum reviews per day',
    desiredRetentionLabel: 'Desired FSRS Retention',
    dayStartHourLabel: 'Day start hour cutoff',
    dayStartHourHint: 'New day cards counter resets at this hour.',
    learningIntervalSectionTitle: 'Steps & Interval Limits',
    learningIntervalSectionDesc: 'Learning steps for new cards and forgotten cards (lapses).',
    learningStepsLabel: 'Learning steps (new)',
    relearningStepsLabel: 'Relearning steps (lapse)',
    maxIntervalLabel: 'Maximum interval (days)',
    leechThresholdLabel: 'Leech Threshold (consecutive lapses)',
    leechThresholdHint: '0 = disabled. Cards are automatically suspended when reaching this threshold.',
    audioSfxSectionTitle: 'Audio & Sound Effects',
    audioSfxSectionDesc: 'Japanese text-to-speech (TTS) and UI audio feedback.',
    autoSpeakLabel: 'Automatically speak when card is flipped',
    autoSpeakDesc: 'Use Web Speech API to read vocabulary and sentences aloud.',
    soundEffectsLabel: 'Enable UI Sound Effects',
    soundEffectsDesc: 'Synthetic Web Audio feedback when clicking buttons.',
    soundVolumeLabel: 'Sound Volume',
    soundTestLabel: 'Test Sound',
    backupSectionTitle: 'Backup & Restore',
    backupSectionDesc: 'Export all decks, review logs, settings, and media assets into a single .inkabackup file.',
    createBackupBtn: 'Download Full Backup',
    restoreBackupBtn: 'Restore from Backup File',
    mediaStorageSectionTitle: 'Local Media Storage',
    mediaStorageSectionDesc: 'Manage audio and image files stored in IndexedDB from Anki imports.',
    cleanUnusedMediaBtn: 'Clean Unused Media',
    saveSettingsBtn: 'Save Settings',
    settingsSavedNotice: 'Settings saved successfully.',

    statsTitle: 'Learning Statistics',
    statsSubtitle: 'In-depth analysis of your study habits, progress, and card mastery.',
    allDecksOption: 'All Decks',
    range7d: '7 Days',
    range1m: '1 Month',
    range3m: '3 Months',
    range1y: '1 Year',
    rangeAll: 'All Time',
    noStatsHistoryTitle: 'No Study History Yet',
    noStatsHistoryDesc: 'Start reviewing flashcards in the Study view to view statistics, activity heatmaps, and retention charts.',
    startStudyingNow: 'Start Studying Now',
    kpiToday: 'Today',
    kpiStudiedTodayCards: 'cards studied',
    kpiTodayTime: 'Time Today',
    kpiPassRateToday: 'Pass Rate Today',
    kpiStreak: 'Streak',
    kpiLongestStreak: (days) => `Longest: ${days} days`,
    kpiSummarySentence: (cards, mins, secs) => `Today you studied ${cards} cards in ${mins} minutes (${secs} sec/card).`,
    kpiDailyResetHint: 'Daily reset: 03:00 AM',
    calendarTitle: 'Activity Calendar',
    calendarSubtitle: 'Daily review intensity with day cutoff at 03:00 AM.',
    calendarAvgPerDay: (avg) => `Average: ${avg} reviews/day`,
    reviewVolumeTitle: 'Review Volume & Study Time',
    reviewVolumeSubtitle: 'Answered cards count and review button breakdown across selected timeframe.',
    metricCards: 'Card Count',
    metricTime: 'Time (Minutes)',
    answerButtonsTitle: 'Answer Button Distribution',
    answerButtonsSubtitle: 'Pass Rate = (Hard + Good + Easy) / Total.',
    cardMasteryTitle: 'Card Mastery Status',
    cardMasterySubtitle: 'Determined by the latest review rating of each card.',
    futureQueueTitle: 'Upcoming Due Queue',
    futureQueueSubtitle: 'Scheduled cards that will reappear within N card turns.',
    hourlyTitle: 'Hourly Study Pattern',
    hourlySubtitle: 'Review activity by hour of the day (device local time).',
    leechesTitle: 'Most Lapsed Cards (Leeches)',
    leechesSubtitle: "Vocabulary cards with the highest 'Again' counts needing extra focus.",
    answerSpeedTitle: 'Answer Speed per Card',
    answerSpeedSubtitle: 'Average and median thinking time before choosing an answer.',
    cardAddedTitle: 'Added Vocabulary',
    cardAddedSubtitle: 'Total cards registered in this collection.',
    notesArchitectureTitle: 'Inka Scheduling Architecture',
    notesArchitectureContent: 'Inka supports FSRS and dynamic card interval queues. Stats will become richer as you continue your study routine.',
  },
};

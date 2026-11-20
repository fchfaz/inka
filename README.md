# Inka – Japanese Flashcards

PWA flashcard offline-first (React + Vite + IndexedDB) dengan penjadwalan spaced repetition **FSRS** (`ts-fsrs`).

## Menjalankan
```bash
npm install
npm run dev      # development
npm run build    # production (tsc + vite)
npm test         # unit test (vitest + fake-indexeddb)
```

## Fitur belajar
- Penjadwalan FSRS berbasis tanggal jatuh tempo, learning/relearning steps, target retensi
- Antrean: Baru / Belajar / Review dengan batas harian (kartu baru, review) dan jam pergantian hari
- Preview interval di tiap tombol jawaban, Undo (maks 50), Suspend, Bury, auto-suspend leech
- Shortcut: `Spasi` balik/Good, `1–4` jawab, `Z` undo, `S` suspend, `B` bury, `R` suara
- Suara bahasa Jepang lewat Web Speech API
- Efek suara tombol (Web Audio, tanpa file audio): 18 suara berbeda bertema lonceng kaca pentatonik; bisa dimatikan dan diatur volumenya di Pengaturan
- Statistik: heatmap, streak, distribusi tombol, jadwal review mendatang, jam belajar, leech, dsb.

## Data
- Database IndexedDB bernama `recallio_db` (nama lama dipertahankan agar data pengguna tidak hilang).
- Pengguna lama: riwayat review diputar ulang sekali menjadi status FSRS saat aplikasi pertama dibuka.
- **Pengaturan → Unduh Backup** menyimpan kartu + progres + riwayat + pengaturan. Bila ada media, backup berupa `.zip` (`backup.json` + `media/`); pemulihan menerima `.json` lama maupun `.zip`.
- Impor JSON (`recallio.deck-bundle`) bersifat idempoten: deck dicocokkan lewat id/nama, kartu ber-`id` diperbarui
  di tempat, duplikat dilewati. Impor CSV/TSV (termasuk ekspor teks Anki) ke deck terpilih;
  kolom: depan, belakang, arti, contoh JP, contoh hiragana, terjemahan, hint, tag.

## Impor Anki (.apkg / .colpkg)
**Kelola Deck → Import Anki (.apkg)**. Semua diproses di perangkat; tidak ada yang diunggah.
- Format: Anki terbaru (`collection.anki21b`, zstd), `anki21`, dan `anki2` lama. Paket "stub" tanpa isi ditolak dengan pesan jelas.
- Pemetaan field per tipe catatan (ditebak otomatis dari nama field, bisa diubah); field sisa masuk ke "Catatan / media tambahan" agar tidak ada data hilang.
- Cloze dirender per nomor (`{{c1::...}}`), kartu kebalikan ("Basic (and reversed)") ditukar sisi pertanyaannya.
- Struktur deck (`A::B`) dipertahankan sebagai nama deck, atau digabung ke satu deck.
- Progres: jadwal Anki diubah ke status FSRS (memakai memori FSRS asli Anki bila ada, selain itu diperkirakan dari interval dan ease), riwayat review ikut dibawa.
- Media (gambar, audio, video) disimpan di IndexedDB (store `media`, DB v3), dirender tanpa `innerHTML`; HTML dari paket disaring dengan whitelist.
- Aman diulang: id kartu deterministik dari GUID Anki; kartu yang sudah ada dilewati (progres Anda tidak ditimpa), riwayat dan media tidak digandakan. Kartu/deck/riwayat ditulis dalam satu transaksi atomik.
- Tidak didukung: topeng Image Occlusion (hanya gambarnya), template kartu kustom (tampilan memakai tata letak Inka), add-on, `type in the answer`.
- Bersihkan media yatim di **Pengaturan → Media kartu**. Bundle JSON hanya membawa teks (token media dibuang).

## Tes
`npm test` (unit + integrasi dengan paket Anki asli di `src/services/anki/__fixtures__`, dibuat oleh pustaka resmi Anki).

## Penyimpanan dan backup
- Aplikasi meminta **penyimpanan permanen** (`navigator.storage.persist`) saat dibuka; statusnya terlihat di Pengaturan, lengkap dengan tombol meminta ulang.
- **Pengingat backup**: banner muncul bila sudah 14 hari sejak backup terakhir (atau sejak pertama dipakai) dan ada kartu. "Ingatkan nanti" menunda 3 hari; mengunduh backup mereset hitungan.
- Media yang tak dirujuk kartu mana pun **dihapus otomatis** setelah menghapus kartu/deck dan setelah memulihkan backup. Selama impor atau pemulihan berlangsung, pembersihan ditunda agar media baru tidak ikut terhapus.

## Suara (TTS)
Tombol suara dan pembacaan otomatis hanya aktif bila teks mengandung huruf Jepang (bacaan, lalu sisi depan, lalu arti untuk kartu kebalikan). Kartu seperti "kucing → 猫" tidak lagi membacakan kata Indonesia dengan suara Jepang.

## Bahasa
Pesan fitur impor Anki, media, backup, pengingat, dan seluruh halaman Pengaturan tersedia dalam Indonesia dan English lewat `src/services/messages.ts` (komponen: `useMsg()`, service: `msg()`). Tes memastikan kunci dan placeholder kedua bahasa selalu sama. Teks lama di Kelola Deck dan Statistik masih memakai katalog `i18n.ts` yang sebagian kuncinya belum terhubung.

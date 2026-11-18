// Dimuat malas hanya saat pengguna mengimpor paket Anki (wasm ±650 KB).
import initSqlJs from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { setSqlFactory } from './apkg';

let pending: ReturnType<typeof initSqlJs> | null = null;
setSqlFactory(() => {
  // Bila gagal (mis. offline sebelum wasm ter-cache), izinkan percobaan ulang berikutnya.
  pending ??= initSqlJs({ locateFile: () => wasmUrl }).catch((e) => {
    pending = null;
    throw e;
  });
  return pending;
});


import initSqlJs from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { setSqlFactory } from './apkg';

let pending: ReturnType<typeof initSqlJs> | null = null;
setSqlFactory(() => {
  
  pending ??= initSqlJs({ locateFile: () => wasmUrl }).catch((e) => {
    pending = null;
    throw e;
  });
  return pending;
});

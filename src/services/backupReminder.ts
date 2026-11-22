

const LAST = 'inka_last_backup';
const FIRST = 'inka_first_seen';
const SNOOZE = 'inka_backup_snooze_until';

export const REMIND_AFTER_DAYS = 14;
export const SNOOZE_DAYS = 3;
const DAY = 86_400_000;

type Store = Pick<Storage, 'getItem' | 'setItem'>;

function store(): Store | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

function read(s: Store | null, key: string): number | null {
  try {
    const v = s?.getItem(key);
    const n = v ? Number(v) : NaN;
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function write(s: Store | null, key: string, value: number): void {
  try {
    s?.setItem(key, String(value));
  } catch {
    
  }
}


export function ensureFirstSeen(now = Date.now(), s: Store | null = store()): void {
  if (read(s, FIRST) === null) write(s, FIRST, now);
}

export function markBackupDone(now = Date.now(), s: Store | null = store()): void {
  write(s, LAST, now);
  write(s, SNOOZE, 0);
}

export function snoozeBackupReminder(now = Date.now(), s: Store | null = store()): void {
  write(s, SNOOZE, now + SNOOZE_DAYS * DAY);
}

export interface Reminder {
  remind: boolean;
  never: boolean; 
  days: number;   
}

export function backupReminder(hasData: boolean, now = Date.now(), s: Store | null = store()): Reminder {
  const last = read(s, LAST);
  const first = read(s, FIRST) ?? now;
  const days = Math.floor((now - (last ?? first)) / DAY);
  const snoozed = (read(s, SNOOZE) ?? 0) > now;
  return { remind: hasData && !snoozed && days >= REMIND_AFTER_DAYS, never: last === null, days: Math.max(days, 0) };
}

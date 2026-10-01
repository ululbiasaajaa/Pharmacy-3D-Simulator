import { SCHEMA_VERSION } from '@/domain/newGame';

type Raw = Record<string, unknown>;

/**
 * Migrasi skema simpanan. Setiap fungsi memindahkan data dari versi N ke N+1.
 * Tambahkan entri baru di sini saat struktur GameState berubah.
 */
const MIGRATIONS: Record<number, (s: Raw) => Raw> = {
  // Versi 0 (prarilis) → 1: memastikan field yang ditambahkan belakangan tersedia.
  0: (s) => ({
    ...s,
    pharmacy: { autoReorder: false, debtDays: 0, unlockedRooms: [], ...(s.pharmacy as Raw) },
    lessons: { activeLessonId: null, baseline: {}, completed: [], feedback: [], ...(s.lessons as Raw) },
    schemaVersion: 1,
  }),
};

export class MigrationError extends Error {}

export function migrate(raw: unknown): Raw {
  if (!raw || typeof raw !== 'object') throw new MigrationError('Data simpanan kosong atau bukan objek.');
  let s = raw as Raw;
  let v = typeof s.schemaVersion === 'number' ? s.schemaVersion : 0;
  if (v > SCHEMA_VERSION) throw new MigrationError(`Simpanan berasal dari versi game yang lebih baru (skema ${v}).`);
  while (v < SCHEMA_VERSION) {
    const fn = MIGRATIONS[v];
    if (!fn) throw new MigrationError(`Tidak ada migrasi dari skema ${v}.`);
    s = fn(s);
    v = s.schemaVersion as number;
  }
  return s;
}

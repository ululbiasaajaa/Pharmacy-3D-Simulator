import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { SCHEMA_VERSION } from '@/domain/newGame';
import type { GameState } from '@/domain/types';
import { migrate, MigrationError } from './migrations';
import { gameStateSchema, saveRecordSchema, type SaveRecord } from './saveSchema';

export const SLOTS = ['auto', 'slot-1', 'slot-2', 'slot-3'] as const;
export type SlotId = (typeof SLOTS)[number];
export const SLOT_LABELS: Record<SlotId, string> = { auto: 'Simpan Otomatis', 'slot-1': 'Slot 1', 'slot-2': 'Slot 2', 'slot-3': 'Slot 3' };

interface PharmacyDB extends DBSchema {
  saves: { key: string; value: SaveRecord };
}

let dbPromise: Promise<IDBPDatabase<PharmacyDB>> | null = null;

function db() {
  if (!dbPromise) {
    dbPromise = openDB<PharmacyDB>('pharmacy-3d-simulator', 1, {
      upgrade(database) {
        if (!database.objectStoreNames.contains('saves')) database.createObjectStore('saves', { keyPath: 'slot' });
      },
    });
  }
  return dbPromise;
}

/** Untuk pengujian: tutup koneksi agar database baru dapat dibuat. */
export async function resetDbConnection() {
  if (dbPromise) (await dbPromise).close();
  dbPromise = null;
}

export function toSaveRecord(slot: string, state: GameState): SaveRecord {
  const clean: GameState = { ...state, outbox: [] };
  return {
    slot,
    schemaVersion: SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    label: `${state.profile.pharmacyName} — Hari ${state.time.day}`,
    summary: {
      playerName: state.profile.name,
      pharmacyName: state.profile.pharmacyName,
      mode: state.mode,
      day: state.time.day,
      money: state.money,
      level: state.progression.level,
      reputation: Math.round(state.progression.reputation),
    },
    // Salinan JSON murni (menghindari objek beku/proxy dari immer).
    state: JSON.parse(JSON.stringify(clean)),
  };
}

export async function saveGame(slot: SlotId, state: GameState): Promise<SaveRecord> {
  const rec = toSaveRecord(slot, state);
  await (await db()).put('saves', rec);
  return rec;
}

export type LoadResult = { ok: true; state: GameState; record: SaveRecord } | { ok: false; error: string; corrupt: boolean };

/** Validasi + migrasi data simpanan mentah menjadi GameState. */
export function parseSave(raw: unknown): LoadResult {
  const rec = saveRecordSchema.safeParse(raw);
  if (!rec.success) return { ok: false, error: 'Format berkas simpanan tidak dikenali.', corrupt: true };
  try {
    const migrated = migrate(rec.data.state);
    const parsed = gameStateSchema.safeParse(migrated);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return { ok: false, error: `Data simpanan rusak (${first?.path.join('.') || 'root'}: ${first?.message}).`, corrupt: true };
    }
    const state = parsed.data as unknown as GameState;
    state.outbox = [];
    return { ok: true, state, record: rec.data };
  } catch (e) {
    if (e instanceof MigrationError) return { ok: false, error: e.message, corrupt: false };
    return { ok: false, error: 'Gagal membaca data simpanan.', corrupt: true };
  }
}

export async function loadGame(slot: string): Promise<LoadResult> {
  try {
    const raw = await (await db()).get('saves', slot);
    if (!raw) return { ok: false, error: 'Slot simpanan kosong.', corrupt: false };
    return parseSave(raw);
  } catch {
    return { ok: false, error: 'Penyimpanan lokal (IndexedDB) tidak dapat diakses di browser ini.', corrupt: false };
  }
}

export interface SlotInfo {
  slot: SlotId;
  record: SaveRecord | null;
  corrupt: boolean;
}

export async function listSaves(): Promise<SlotInfo[]> {
  try {
    const database = await db();
    return Promise.all(
      SLOTS.map(async (slot) => {
        const raw = await database.get('saves', slot);
        if (!raw) return { slot, record: null, corrupt: false };
        const rec = saveRecordSchema.safeParse(raw);
        return rec.success ? { slot, record: rec.data, corrupt: false } : { slot, record: null, corrupt: true };
      }),
    );
  } catch {
    return SLOTS.map((slot) => ({ slot, record: null, corrupt: false }));
  }
}

export async function deleteSave(slot: string) {
  await (await db()).delete('saves', slot);
}

export async function hasAnySave() {
  return (await listSaves()).some((x) => x.record);
}

/** Berkas cadangan (.json) yang dapat diunduh pemain. */
export function exportSaveBlob(state: GameState): Blob {
  return new Blob([JSON.stringify(toSaveRecord('export', state), null, 2)], { type: 'application/json' });
}

export async function importSaveFile(file: File): Promise<LoadResult> {
  try {
    const text = await file.text();
    return parseSave(JSON.parse(text));
  } catch {
    return { ok: false, error: 'Berkas bukan JSON yang valid.', corrupt: true };
  }
}

import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { deleteSave, listSaves, loadGame, parseSave, resetDbConnection, saveGame, toSaveRecord } from '@/services/persistence/saveService';
import { migrate, MigrationError } from '@/services/persistence/migrations';
import { loadSettings, persistSettings, DEFAULT_SETTINGS } from '@/services/persistence/settings';
import { SCHEMA_VERSION } from '@/domain/newGame';
import { advanceTime } from '@/domain/simulation';
import { newState } from '../helpers';

beforeEach(async () => {
  await resetDbConnection();
  globalThis.indexedDB = new IDBFactory();
});

describe('Simpan & muat', () => {
  it('menyimpan lalu memuat kembali state yang identik', async () => {
    const s = newState('career', { open: true, seed: 11 });
    advanceTime(s, 90);
    await saveGame('slot-1', s);
    const r = await loadGame('slot-1');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const expected = JSON.parse(JSON.stringify({ ...s, outbox: [] }));
    expect(r.state).toEqual(expected);
    expect(r.record.summary.day).toBe(1);
  });

  it('slot kosong dan penghapusan', async () => {
    expect((await loadGame('slot-2')).ok).toBe(false);
    await saveGame('slot-2', newState());
    expect((await listSaves()).find((x) => x.slot === 'slot-2')?.record).not.toBeNull();
    await deleteSave('slot-2');
    expect((await listSaves()).find((x) => x.slot === 'slot-2')?.record).toBeNull();
  });

  it('menolak data rusak dengan pesan yang jelas', () => {
    const rec = toSaveRecord('slot-1', newState());
    (rec.state as Record<string, unknown>).batches = [{ id: 'x', qty: -5 }];
    const r = parseSave(rec);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.corrupt).toBe(true);
      expect(r.error).toMatch(/rusak/);
    }
    expect(parseSave({ hello: 'world' }).ok).toBe(false);
    expect(parseSave(null).ok).toBe(false);
  });

  it('memigrasi simpanan skema lama (v0) ke versi terbaru', () => {
    const s = JSON.parse(JSON.stringify(newState())) as Record<string, unknown>;
    delete s.schemaVersion;
    delete (s.pharmacy as Record<string, unknown>).autoReorder;
    const migrated = migrate(s);
    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
    expect((migrated.pharmacy as Record<string, unknown>).autoReorder).toBe(false);
  });

  it('menolak simpanan dari versi game yang lebih baru', () => {
    const s = JSON.parse(JSON.stringify(newState())) as Record<string, unknown>;
    s.schemaVersion = SCHEMA_VERSION + 5;
    expect(() => migrate(s)).toThrow(MigrationError);
  });
});

describe('Pengaturan', () => {
  it('memvalidasi dan mengganti nilai rusak dengan bawaan', () => {
    localStorage.setItem('pharmacy3d.settings.v1', JSON.stringify({ musicVolume: 99 }));
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    persistSettings({ ...DEFAULT_SETTINGS, sfxVolume: 0.2, keys: { ...DEFAULT_SETTINGS.keys, interact: 'KeyF' } });
    const s = loadSettings();
    expect(s.sfxVolume).toBe(0.2);
    expect(s.keys.interact).toBe('KeyF');
  });
});

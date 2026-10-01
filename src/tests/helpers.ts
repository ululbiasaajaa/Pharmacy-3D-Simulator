import { createNewGame } from '@/domain/newGame';
import { openPharmacy } from '@/domain/simulation';
import { receiveBatch } from '@/domain/inventory';
import type { GameMode, GameState } from '@/domain/types';

export function newState(mode: GameMode = 'career', opts: { open?: boolean; challengeId?: string; seed?: number } = {}): GameState {
  const s = createNewGame({ mode, playerName: 'Tester', pharmacyName: 'Apotek Uji', seed: opts.seed ?? 42, challengeId: opts.challengeId, skipTutorial: true });
  if (opts.open) openPharmacy(s);
  return s;
}

/** Hapus seluruh stok obat tertentu agar skenario tes deterministik. */
export function clearStock(s: GameState, medicineId: string) {
  s.batches = s.batches.filter((b) => b.medicineId !== medicineId);
}

export function addBatch(s: GameState, medicineId: string, qty: number, expiryInDays: number, location: 'shelf' | 'warehouse' = 'shelf', batchNo?: string) {
  const med = s.medicines.find((m) => m.id === medicineId)!;
  const r = receiveBatch(s, { medicineId, qty, expiryDay: s.time.day + expiryInDays, unitCost: med.buyPrice, location, batchNo, skipCapacity: true });
  if (!r.ok) throw new Error(r.error);
  return r.value!;
}

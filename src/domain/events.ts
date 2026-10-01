import { ECONOMY } from './config';
import { addLedger, emit, notify, today } from './core';
import { nextId } from './ids';
import { expiredBatches } from './inventory';
import { addReputation, isFeatureUnlocked } from './progression';
import { chance, weightedPick } from './rng';
import { EVENTS } from '@/data/events';
import type { ActiveEvent, EventDef, GameState } from './types';

/** Narasi lokal (fallback bila AI tidak tersedia). Tidak memengaruhi dampak event. */
export function localNarrative(def: EventDef): string {
  switch (def.kind) {
    case 'patient-surge':
      return 'Kabar tentang musim flu menyebar. Warga sekitar berdatangan ke apotek.';
    case 'delivery-delay':
      return 'Hujan deras membuat jalan macet. Kurir pemasok mengabarkan keterlambatan.';
    case 'demand-boost':
      return 'Tren di media sosial membuat banyak orang mencari produk tertentu hari ini.';
    case 'inspection':
      return 'Petugas pemeriksa akan datang. Rapikan rak dan pastikan tidak ada produk kedaluwarsa.';
    case 'service-day':
      return 'Hari kesehatan lingkungan! Pelayanan yang baik akan lebih diingat pelanggan.';
    case 'price-increase':
      return 'Distributor mengumumkan penyesuaian harga sementara.';
  }
}

export function eventsEnabled(s: GameState) {
  if (s.mode === 'learning') return false;
  return isFeatureUnlocked(s, 'events');
}

/** Memulai event tertentu (dipakai oleh pemicu acak & tes). */
export function startEvent(s: GameState, def: EventDef, narrative?: string): ActiveEvent {
  const ev: ActiveEvent = {
    id: nextId(s, 'EV'),
    defId: def.id,
    kind: def.kind,
    name: def.name,
    description: def.description,
    narrative: narrative ?? localNarrative(def),
    startAt: s.time.now,
    endAt: s.time.now + def.durationMinutes,
    magnitude: def.magnitude,
    category: def.category,
  };
  s.activeEvents.push(ev);
  s.eventHistory.push({ defId: def.id, at: s.time.now });
  if (def.kind === 'delivery-delay') {
    for (const po of s.purchaseOrders) {
      if ((po.status === 'ordered' || po.status === 'processing' || po.status === 'shipping') && po.eta) {
        po.eta += def.magnitude;
        po.delayed = true;
      }
    }
  }
  notify(s, 'info', `Event: ${def.name} — ${def.description}`);
  emit(s, { type: 'event-started', refId: ev.id, message: def.name });
  return ev;
}

/** Peluang event baru setiap jam operasional (maks. satu event aktif). */
export function maybeTriggerEvent(s: GameState) {
  if (!eventsEnabled(s) || s.activeEvents.length > 0) return;
  if (!chance(s, 0.14)) return;
  const day = today(s);
  const pool = EVENTS.filter((e) => e.minDay <= day);
  const def = weightedPick(s, pool, (e) => e.weight);
  if (def) startEvent(s, def);
}

/** Mengakhiri event yang sudah lewat dan menerapkan dampak akhir (mis. pemeriksaan). */
export function updateEvents(s: GameState) {
  for (const ev of [...s.activeEvents]) {
    if (s.time.now < ev.endAt) continue;
    endEvent(s, ev);
  }
}

export function endEvent(s: GameState, ev: ActiveEvent) {
  if (ev.kind === 'inspection' && !ev.resolved) {
    const bad = expiredBatches(s, 'shelf').filter((b) => b.status === 'active');
    if (bad.length) {
      addLedger(s, 'fine', -ECONOMY.inspectionFinePerBatch * bad.length, `Denda pemeriksaan: ${bad.length} batch kedaluwarsa di rak`, ev.id);
      addReputation(s, -3 * bad.length);
      notify(s, 'error', `Pemeriksaan menemukan ${bad.length} batch kedaluwarsa di rak. Denda dikenakan.`);
    } else {
      addLedger(s, 'event-income', ECONOMY.inspectionReward, 'Apresiasi pemeriksaan: rak bebas produk kedaluwarsa', ev.id);
      addReputation(s, 3);
      notify(s, 'success', 'Pemeriksaan lulus! Rak bebas produk kedaluwarsa.');
    }
  }
  ev.resolved = true;
  s.activeEvents = s.activeEvents.filter((e) => e.id !== ev.id);
  emit(s, { type: 'event-ended', refId: ev.id, message: ev.name });
}

export function setEventNarrative(s: GameState, eventId: string, narrative: string) {
  const ev = s.activeEvents.find((e) => e.id === eventId);
  if (ev) ev.narrative = narrative.slice(0, 280);
}

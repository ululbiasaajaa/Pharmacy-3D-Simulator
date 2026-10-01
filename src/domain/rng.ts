import type { GameState } from './types';

/** Mulberry32: RNG deterministik agar simulasi dapat direproduksi dan diuji. */
export function mulberry32(state: number): { value: number; next: number } {
  let t = (state + 0x6d2b79f5) | 0;
  const next = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, next };
}

/** Ambil angka acak [0,1) dan majukan state RNG pada GameState. */
export function rand(s: GameState): number {
  const r = mulberry32(s.rngState);
  s.rngState = r.next;
  return r.value;
}

export function randInt(s: GameState, min: number, max: number): number {
  return Math.floor(rand(s) * (max - min + 1)) + min;
}

export function pick<T>(s: GameState, arr: readonly T[]): T {
  return arr[Math.floor(rand(s) * arr.length)];
}

export function chance(s: GameState, p: number): boolean {
  return rand(s) < p;
}

export function weightedPick<T>(s: GameState, items: readonly T[], weight: (t: T) => number): T | undefined {
  const total = items.reduce((a, t) => a + Math.max(0, weight(t)), 0);
  if (total <= 0) return undefined;
  let r = rand(s) * total;
  for (const t of items) {
    r -= Math.max(0, weight(t));
    if (r < 0) return t;
  }
  return items[items.length - 1];
}

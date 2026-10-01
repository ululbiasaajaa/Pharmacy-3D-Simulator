import type { GameState } from './types';

/** ID unik deterministik berbasis penghitung di GameState. */
export function nextId(s: GameState, prefix: string): string {
  s.idCounter += 1;
  return `${prefix}-${s.idCounter.toString(36).toUpperCase().padStart(4, '0')}`;
}

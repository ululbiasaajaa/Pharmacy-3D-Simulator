import { XP } from './config';
import { addLedger, emit, fail, notify, ok, type Result } from './core';
import { addXp, isFeatureUnlocked } from './progression';
import { UPGRADES } from '@/data/upgrades';
import type { GameState, UpgradeDef } from './types';

export function upgradeLevel(s: GameState, id: string) {
  return s.pharmacy.upgrades[id] ?? 0;
}

export type UpgradeAvailability = { canBuy: boolean; reason?: string; nextCost?: number };

export function upgradeAvailability(s: GameState, def: UpgradeDef): UpgradeAvailability {
  const level = upgradeLevel(s, def.id);
  if (level >= def.levels.length) return { canBuy: false, reason: 'Level maksimum' };
  const feature = def.kind === 'expansion' ? 'expansions' : 'upgrades';
  if (!isFeatureUnlocked(s, feature)) return { canBuy: false, reason: `Terbuka di level ${feature === 'expansions' ? 4 : 2}` };
  if (s.mode !== 'learning' && s.progression.level < def.requiredLevel) return { canBuy: false, reason: `Butuh level pemain ${def.requiredLevel}` };
  const cost = def.levels[level].cost;
  if (s.money < cost) return { canBuy: false, reason: 'Uang tidak cukup', nextCost: cost };
  return { canBuy: true, nextCost: cost };
}

export function buyUpgrade(s: GameState, id: string): Result<number> {
  const def = UPGRADES.find((u) => u.id === id);
  if (!def) return fail('Peningkatan tidak ditemukan.');
  const av = upgradeAvailability(s, def);
  if (!av.canBuy) return fail(av.reason ?? 'Tidak dapat dibeli.');
  const level = upgradeLevel(s, id);
  const cost = def.levels[level].cost;
  addLedger(s, def.kind === 'expansion' ? 'expansion' : 'upgrade', -cost, `${def.name} level ${level + 1}`, def.id);
  s.pharmacy.upgrades[id] = level + 1;
  if (def.unlocksRoom && !s.pharmacy.unlockedRooms.includes(def.unlocksRoom)) s.pharmacy.unlockedRooms.push(def.unlocksRoom);
  s.stats.upgradesBought += 1;
  addXp(s, XP.upgrade);
  notify(s, 'success', `${def.name} ditingkatkan ke level ${level + 1}: ${def.levels[level].description}.`);
  emit(s, { type: 'upgrade-bought', refId: def.id });
  return ok(level + 1);
}

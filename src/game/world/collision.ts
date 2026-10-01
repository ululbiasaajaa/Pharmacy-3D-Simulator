import type { RoomId } from '@/domain/types';
import {
  COUNTER2_BLOCK,
  EXPANSION_DOORS,
  EXPANSION_FURNITURE,
  FURNITURE,
  INTERIOR_DOORS,
  UPGRADE_FURNITURE,
  WALL_T,
  WALLS,
  WORLD_BOUNDS,
  type AABB,
} from './layout';

export interface ColliderContext {
  doorsOpen: Record<string, boolean>;
  unlockedRooms: RoomId[];
  upgrades: Record<string, number>;
}

function doorBox(x: number, z: number, width: number): AABB {
  return { minX: x - width / 2, maxX: x + width / 2, minZ: z - WALL_T / 2, maxZ: z + WALL_T / 2 };
}

/** Semua kotak tabrakan untuk kondisi dunia saat ini. */
export function buildColliders(ctx: ColliderContext): AABB[] {
  const list: AABB[] = [...WALLS, ...Object.values(FURNITURE)];
  for (const d of INTERIOR_DOORS) if (!ctx.doorsOpen[d.id]) list.push(doorBox(d.x, d.z, d.width));
  for (const d of EXPANSION_DOORS) {
    const unlocked = d.room && ctx.unlockedRooms.includes(d.room);
    if (!unlocked || !ctx.doorsOpen[d.id]) list.push(doorBox(d.x, d.z, d.width));
  }
  for (const [room, boxes] of Object.entries(EXPANSION_FURNITURE)) {
    if (ctx.unlockedRooms.includes(room as RoomId)) list.push(...boxes);
  }
  if ((ctx.upgrades.shelf ?? 0) >= 1) list.push(UPGRADE_FURNITURE.islandShelf);
  if ((ctx.upgrades['waiting-room'] ?? 0) >= 2) list.push(UPGRADE_FURNITURE.chairsB);
  if (!ctx.unlockedRooms.includes('counter-2')) list.push(COUNTER2_BLOCK);
  return list;
}

/**
 * Menggerakkan lingkaran (pemain) dengan resolusi tabrakan per sumbu terhadap AABB.
 * Mengembalikan posisi akhir yang tidak menembus dinding/perabot.
 */
export function moveWithCollision(x: number, z: number, dx: number, dz: number, r: number, boxes: AABB[]): [number, number] {
  let nx = x + dx;
  for (const b of boxes) {
    if (z + r > b.minZ && z - r < b.maxZ && nx + r > b.minX && nx - r < b.maxX) {
      nx = dx > 0 ? b.minX - r - 1e-4 : dx < 0 ? b.maxX + r + 1e-4 : nx;
    }
  }
  let nz = z + dz;
  for (const b of boxes) {
    if (nx + r > b.minX && nx - r < b.maxX && nz + r > b.minZ && nz - r < b.maxZ) {
      nz = dz > 0 ? b.minZ - r - 1e-4 : dz < 0 ? b.maxZ + r + 1e-4 : nz;
    }
  }
  nx = Math.max(WORLD_BOUNDS.minX + r, Math.min(WORLD_BOUNDS.maxX - r, nx));
  nz = Math.max(WORLD_BOUNDS.minZ + r, Math.min(WORLD_BOUNDS.maxZ - r, nz));
  return [nx, nz];
}

export function pointInBoxes(x: number, z: number, r: number, boxes: AABB[]) {
  return boxes.some((b) => x + r > b.minX && x - r < b.maxX && z + r > b.minZ && z - r < b.maxZ);
}

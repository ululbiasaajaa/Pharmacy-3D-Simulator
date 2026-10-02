import type { RoomId } from '@/domain/types';
import {
  COUNTER2_BLOCK,
  EXPANSION_DOORS,
  EXPANSION_FURNITURE,
  FURNITURE,
  INTERIOR_DOORS,
  SIDE_DOORS,
  UPGRADE_FURNITURE,
  WALL_T,
  WALLS,
  WORLD_BOUNDS,
  type AABB,
  type DoorDef,
} from './layout';
import { STAFF_PARKING, districtBlockers, districtColliders, scooterFootprintX, vanParkedFootprint } from './district';

export interface ColliderContext {
  doorsOpen: Record<string, boolean>;
  unlockedRooms: RoomId[];
  upgrades: Record<string, number>;
  /** Mobil boks PBF sedang parkir di area bongkar muat (ada kiriman tiba). */
  vanParked?: boolean;
  /** Jumlah motor karyawan di parkir gang kanan. */
  staffScooters?: number;
}

function doorBox(d: Pick<DoorDef, 'x' | 'z' | 'width' | 'axis'>): AABB {
  return d.axis === 'z'
    ? { minX: d.x - WALL_T / 2, maxX: d.x + WALL_T / 2, minZ: d.z - d.width / 2, maxZ: d.z + d.width / 2 }
    : { minX: d.x - d.width / 2, maxX: d.x + d.width / 2, minZ: d.z - WALL_T / 2, maxZ: d.z + WALL_T / 2 };
}

/** Collider luar statis dihitung sekali (bangunan kawasan, gerbang, properti jalan). */
const DISTRICT = districtColliders();
/** Bangunan & tembok luar yang juga menghalangi kamera orang ketiga. */
export const DISTRICT_BLOCKERS: AABB[] = districtBlockers();

/** Semua kotak tabrakan untuk kondisi dunia saat ini. */
export function buildColliders(ctx: ColliderContext): AABB[] {
  const list: AABB[] = [...WALLS, ...Object.values(FURNITURE), ...DISTRICT];
  for (const d of [...INTERIOR_DOORS, ...SIDE_DOORS]) if (!ctx.doorsOpen[d.id]) list.push(doorBox(d));
  for (const d of EXPANSION_DOORS) {
    const unlocked = d.room && ctx.unlockedRooms.includes(d.room);
    if (!unlocked || !ctx.doorsOpen[d.id]) list.push(doorBox(d));
  }
  for (const [room, boxes] of Object.entries(EXPANSION_FURNITURE)) {
    if (ctx.unlockedRooms.includes(room as RoomId)) list.push(...boxes);
  }
  if ((ctx.upgrades.shelf ?? 0) >= 1) list.push(UPGRADE_FURNITURE.islandShelf);
  if ((ctx.upgrades['waiting-room'] ?? 0) >= 2) list.push(UPGRADE_FURNITURE.chairsB);
  if (!ctx.unlockedRooms.includes('counter-2')) list.push(COUNTER2_BLOCK);
  if (ctx.vanParked) list.push(vanParkedFootprint());
  for (let i = 0; i < Math.min(ctx.staffScooters ?? 0, STAFF_PARKING.length); i++) list.push(scooterFootprintX(STAFF_PARKING[i]));
  return list;
}

/**
 * Penghalang kamera orang ketiga: dinding, pintu tertutup, bangunan & tembok kawasan, dan mobil boks yang parkir.
 * Perabot rendah & properti tipis (pipa, tiang) sengaja diabaikan agar kamera tidak tersentak.
 */
export function buildCameraBlockers(ctx: ColliderContext): AABB[] {
  const list: AABB[] = [...WALLS, ...DISTRICT_BLOCKERS];
  for (const d of [...INTERIOR_DOORS, ...SIDE_DOORS]) if (!ctx.doorsOpen[d.id]) list.push(doorBox(d));
  for (const d of EXPANSION_DOORS) {
    const unlocked = d.room && ctx.unlockedRooms.includes(d.room);
    if (!unlocked || !ctx.doorsOpen[d.id]) list.push(doorBox(d));
  }
  if (ctx.vanParked) list.push(vanParkedFootprint());
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

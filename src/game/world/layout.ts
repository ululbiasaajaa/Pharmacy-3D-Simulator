import type { RoomId } from '@/domain/types';

/**
 * Tata letak apotek (satuan meter, Y ke atas, pintu masuk di sisi +Z).
 * Satu sumber kebenaran untuk geometri, tabrakan, dan titik navigasi NPC.
 *
 *   z=+10  ─── dinding depan (pintu masuk otomatis di x=0)
 *          area pelanggan: antrean, kursi tunggu, rak obat bebas, papan misi
 *   z=+2   ─── meja pelayanan & kasir (celah staf di x 6..8)
 *          lorong staf, rak obat resep, lemari pendingin
 *   z=-2   ─── dinding dalam (pintu ke gudang, lab racik, administrasi)
 *          gudang (x<-4) | lab racik (-4..4) | administrasi & area pegawai (x>4)
 *   z=-10  ─── dinding belakang (pintu perluasan, terkunci sampai dibeli)
 *          gudang besar | ruang racik 2 | ruang administrasi+ | ruang istirahat
 *   z=-18
 */

export interface AABB {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export const WALL_H = 3.2;
export const WALL_T = 0.2;
export const PLAYER_RADIUS = 0.3;

export interface DoorDef {
  id: string;
  x: number;
  z: number;
  width: number;
  label: string;
  room?: RoomId;
}

export const INTERIOR_DOORS: DoorDef[] = [
  { id: 'door-storage', x: -8, z: -2, width: 1.4, label: 'Pintu Gudang' },
  { id: 'door-lab', x: 0, z: -2, width: 1.4, label: 'Pintu Lab Racik' },
  { id: 'door-admin', x: 8, z: -2, width: 1.4, label: 'Pintu Administrasi' },
];

export const EXPANSION_DOORS: DoorDef[] = [
  { id: 'door-big-warehouse', x: -9, z: -10, width: 1.4, label: 'Pintu Gudang Besar', room: 'big-warehouse' },
  { id: 'door-lab-2', x: -3, z: -10, width: 1.4, label: 'Pintu Ruang Racik 2', room: 'lab-2' },
  { id: 'door-admin-plus', x: 3, z: -10, width: 1.4, label: 'Pintu Ruang Administrasi+', room: 'admin-plus' },
  { id: 'door-staff-lounge', x: 9, z: -10, width: 1.4, label: 'Pintu Ruang Istirahat', room: 'staff-lounge' },
];

export const ROOM_LABELS: Record<RoomId, string> = {
  'big-warehouse': 'GUDANG BESAR',
  'lab-2': 'RUANG RACIK 2',
  'admin-plus': 'ADMINISTRASI+',
  'staff-lounge': 'RUANG ISTIRAHAT',
  'counter-2': 'LOKET 2',
};

/** Pusat ruang perluasan (untuk perabot & label). */
export const EXPANSION_ROOMS: Record<Exclude<RoomId, 'counter-2'>, { x: number; z: number }> = {
  'big-warehouse': { x: -9, z: -14 },
  'lab-2': { x: -3, z: -14 },
  'admin-plus': { x: 3, z: -14 },
  'staff-lounge': { x: 9, z: -14 },
};

type Gap = { at: number; width: number };

/** Dinding sejajar sumbu X pada z tetap, dengan celah pintu. */
export function hWall(z: number, x0: number, x1: number, gaps: Gap[] = []): AABB[] {
  const out: AABB[] = [];
  let start = x0;
  for (const g of [...gaps].sort((a, b) => a.at - b.at)) {
    const gs = g.at - g.width / 2;
    if (gs > start) out.push({ minX: start, maxX: gs, minZ: z - WALL_T / 2, maxZ: z + WALL_T / 2 });
    start = g.at + g.width / 2;
  }
  if (x1 > start) out.push({ minX: start, maxX: x1, minZ: z - WALL_T / 2, maxZ: z + WALL_T / 2 });
  return out;
}

/** Dinding sejajar sumbu Z pada x tetap. */
export function vWall(x: number, z0: number, z1: number, gaps: Gap[] = []): AABB[] {
  return hWall(0, z0, z1, gaps).map((a) => ({ minX: x - WALL_T / 2, maxX: x + WALL_T / 2, minZ: a.minX, maxZ: a.maxX }));
}

const doorGaps = (doors: DoorDef[]) => doors.map((d) => ({ at: d.x, width: d.width }));

export const WALLS: AABB[] = [
  ...hWall(10, -12, 12, [{ at: 0, width: 2.4 }]),
  ...vWall(-12, -18, 10),
  ...vWall(12, -18, 10),
  ...hWall(-2, -12, 12, doorGaps(INTERIOR_DOORS)),
  ...hWall(-10, -12, 12, doorGaps(EXPANSION_DOORS)),
  ...hWall(-18, -12, 12),
  ...vWall(-4, -10, -2),
  ...vWall(4, -10, -2),
  ...vWall(-6, -18, -10),
  ...vWall(0, -18, -10),
  ...vWall(6, -18, -10),
];

/** Perabot statis yang selalu ada. */
export const FURNITURE: Record<string, AABB> = {
  counter: { minX: -6.5, maxX: 6, minZ: 1.6, maxZ: 2.4 },
  displayCabinet: { minX: -12, maxX: -6.5, minZ: 1.7, maxZ: 2.3 },
  rxShelfLeft: { minX: -5, maxX: -1, minZ: -1.85, maxZ: -1.35 },
  rxShelfRight: { minX: 1, maxX: 5, minZ: -1.85, maxZ: -1.35 },
  fridge: { minX: 6.6, maxX: 7.6, minZ: -1.85, maxZ: -1.15 },
  otcShelfA: { minX: 11.2, maxX: 11.9, minZ: 3, maxZ: 6 },
  otcShelfB: { minX: 11.2, maxX: 11.9, minZ: 6.5, maxZ: 9.5 },
  chairsA: { minX: -10.6, maxX: -7.4, minZ: 5.4, maxZ: 6 },
  storageRack: { minX: -11.85, maxX: -11.2, minZ: -9.5, maxZ: -3 },
  storageCabinet: { minX: -9, maxX: -7, minZ: -9.85, maxZ: -9.15 },
  boxes: { minX: -6, maxX: -4.6, minZ: -9, maxZ: -7.2 },
  labTable: { minX: -1.5, maxX: 1.5, minZ: -6.5, maxZ: -5.5 },
  ingredientRack: { minX: -3.85, maxX: -3.3, minZ: -9, maxZ: -5 },
  adminDesk: { minX: 6.5, maxX: 9.5, minZ: -7.6, maxZ: -6.6 },
  filing: { minX: 11.2, maxX: 11.85, minZ: -9.2, maxZ: -8 },
  lockers: { minX: 11.3, maxX: 11.85, minZ: -5.2, maxZ: -2.8 },
};

/** Perabot yang muncul karena peningkatan. */
export const UPGRADE_FURNITURE = {
  islandShelf: { minX: 7.2, maxX: 8.2, minZ: 4.2, maxZ: 8 } as AABB,
  chairsB: { minX: -10.6, maxX: -7.4, minZ: 8, maxZ: 8.6 } as AABB,
};

export const EXPANSION_FURNITURE: Record<Exclude<RoomId, 'counter-2'>, AABB[]> = {
  'big-warehouse': [
    { minX: -11.85, maxX: -11.2, minZ: -17.5, maxZ: -11 },
    { minX: -10, maxX: -8, minZ: -17.85, maxZ: -17.15 },
  ],
  'lab-2': [{ minX: -4.3, maxX: -1.7, minZ: -15, maxZ: -14 }],
  'admin-plus': [{ minX: 1.8, maxX: 4.2, minZ: -15.5, maxZ: -14.5 }],
  'staff-lounge': [
    { minX: 7.5, maxX: 10.5, minZ: -17.6, maxZ: -16.6 },
    { minX: 11.2, maxX: 11.85, minZ: -13, maxZ: -12 },
  ],
};

export const COUNTER2_BLOCK: AABB = { minX: -5.8, maxX: -4.2, minZ: 2.4, maxZ: 3.0 };

/** Batas area pemain (termasuk trotoar di depan apotek). */
export const WORLD_BOUNDS: AABB = { minX: -16, maxX: 16, minZ: -17.8, maxZ: 16 };

// ------------------------------------------------------------------ Titik navigasi NPC

export type Vec2 = [number, number];

export const STREET_SPAWN: Vec2 = [-8, 14];
export const DOOR_OUTSIDE: Vec2 = [0, 11.5];
export const DOOR_INSIDE: Vec2 = [0, 9];
export const STREET_EXIT: Vec2 = [9, 14];
export const SERVICE_SPOT: Vec2 = [-2, 3.1];
export const PLAYER_SERVICE_SPOT: Vec2 = [-2, 1.0];
export const EMPLOYEE_SERVICE_SPOTS: Vec2[] = [
  [0.4, 3.1],
  [-5, 3.1],
];
export const CASHIER_SPOT: Vec2 = [3, 3.1];

export function queueSlot(i: number): Vec2 {
  const col = Math.floor(i / 5);
  const row = i % 5;
  const r = col % 2 === 0 ? row : 4 - row;
  return [-2 - col * 1.3, 4.3 + r * 1.0];
}

export function checkoutSlot(i: number): Vec2 {
  return [3 + (i >= 5 ? 1.2 : 0), 3.1 + (i % 5) * 0.9];
}

export function seatSlot(i: number): Vec2 {
  const seats: Vec2[] = [
    [-10.2, 6.3],
    [-9.4, 6.3],
    [-8.6, 6.3],
    [-7.8, 6.3],
    [-10.2, 8.9],
    [-9.4, 8.9],
    [-8.6, 8.9],
    [-7.8, 8.9],
  ];
  return seats[i % seats.length];
}

export const PLAYER_SPAWN = { x: 0, z: 0.4, yaw: 0 };

export function staffSpot(role: string, index: number, resting: boolean, loungeUnlocked: boolean): Vec2 {
  if (resting) return loungeUnlocked ? [8 + index * 0.9, -13] : [9.5 + index * 0.6, -4];
  const base: Record<string, Vec2> = {
    cashier: [3, 1.0],
    assistant: [0.4, 1.0],
    pharmacist: [-0.9, 1.0],
    warehouse: [-8, -6],
    manager: [8, -5.4],
  };
  const b = base[role] ?? [0, 0];
  return [b[0] + index * 0.9, b[1]];
}

import { describe, expect, it } from 'vitest';
import { buildColliders, type ColliderContext } from '@/game/world/collision';
import { EXPANSION_DOORS, INTERIOR_DOORS, PLAYER_RADIUS, PLAYER_SERVICE_SPOT, PLAYER_SPAWN, SIDE_DOORS, WALLS, WORLD_BOUNDS, type AABB, type Vec2 } from '@/game/world/layout';
import {
  CAFE_SET,
  GATES,
  HALTE,
  LOADING,
  PATIENT_ROUTES,
  POLE_Z,
  POWER_POLES,
  STREET,
  STREET_LAMPS,
  TREES,
  VAN_REVERSE_OUT,
  VAN_ROUTE_IN,
  VAN_ROUTE_OUT,
  VAN_SIZE,
  districtColliders,
  pedestrianGraph,
  shopBox,
  SHOPS,
} from '@/game/world/district';

/**
 * Uji world building (PROJECT_STATUS.md "World building"): keterjangkauan area utama, tidak ada
 * dinding tak terlihat di jalur utama, dan rute NPC/kendaraan tidak menembus collider.
 */
const STEP = 0.2;
const allDoorsOpen = Object.fromEntries([...INTERIOR_DOORS, ...SIDE_DOORS, ...EXPANSION_DOORS].map((d) => [d.id, true]));

function overlaps(x: number, z: number, r: number, b: AABB) {
  return x + r > b.minX && x - r < b.maxX && z + r > b.minZ && z - r < b.maxZ;
}

/** Flood fill grid dari titik awal: sel dapat dilalui bila lingkaran pemain tidak menyentuh collider & di dalam batas. */
function reachable(ctx: ColliderContext, from: Vec2) {
  const boxes = buildColliders(ctx);
  const nx = Math.floor((WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX) / STEP);
  const nz = Math.floor((WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ) / STEP);
  const free = (i: number, j: number) => {
    const x = WORLD_BOUNDS.minX + (i + 0.5) * STEP;
    const z = WORLD_BOUNDS.minZ + (j + 0.5) * STEP;
    if (x < WORLD_BOUNDS.minX + PLAYER_RADIUS || x > WORLD_BOUNDS.maxX - PLAYER_RADIUS || z < WORLD_BOUNDS.minZ + PLAYER_RADIUS || z > WORLD_BOUNDS.maxZ - PLAYER_RADIUS) return false;
    return !boxes.some((b) => overlaps(x, z, PLAYER_RADIUS, b));
  };
  const seen = new Uint8Array(nx * nz);
  const cell = ([x, z]: Vec2) => [Math.floor((x - WORLD_BOUNDS.minX) / STEP), Math.floor((z - WORLD_BOUNDS.minZ) / STEP)];
  const [si, sj] = cell(from);
  const stack = [[si, sj]];
  seen[sj * nx + si] = 1;
  while (stack.length) {
    const [i, j] = stack.pop()!;
    for (const [di, dj] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const a = i + di;
      const b = j + dj;
      if (a < 0 || b < 0 || a >= nx || b >= nz || seen[b * nx + a]) continue;
      if (!free(a, b)) continue;
      seen[b * nx + a] = 1;
      stack.push([a, b]);
    }
  }
  return (p: Vec2) => {
    const [i, j] = cell(p);
    return i >= 0 && j >= 0 && i < nx && j < nz && seen[j * nx + i] === 1;
  };
}

const spawn: Vec2 = [PLAYER_SPAWN.x, PLAYER_SPAWN.z];

describe('Navigasi kawasan', () => {
  const open = reachable({ doorsOpen: allDoorsOpen, unlockedRooms: [], upgrades: {} }, spawn);

  it('semua area utama dapat dijangkau dari posisi awal pemain', () => {
    const targets: [string, Vec2][] = [
      ['meja pelayanan (sisi staf)', PLAYER_SERVICE_SPOT],
      ['ruang pelanggan', [0, 6]],
      ['pintu luar apotek', [0, 11.5]],
      ['ujung barat halaman ruko', [-37.6, 12.6]],
      ['ujung timur halaman ruko', [37.6, 12.6]],
      ['tengah zebra cross', [2.7, 18.5]],
      ['ujung barat trotoar seberang', [-37.6, STREET.farWalkZ]],
      ['ujung timur trotoar seberang', [37.6, STREET.farWalkZ]],
      ['halte', [(HALTE.x0 + HALTE.x1) / 2, HALTE.z0 - 0.4]],
      ['meja kios konter pulsa (S4)', [20.25, STREET.frontZ + 0.5]],
      ['gang kiri', [-14.4, 4]],
      ['area bongkar muat', [-13.0, -3.2]],
      ['gudang lewat pintu bongkar muat', [-10.6, -3.2]],
      ['gang belakang', [0, -19.85]],
      ['gang kanan', [14.4, -10]],
      ['lab racik', [0, -4]],
      ['administrasi', [8, -4]],
    ];
    for (const [name, p] of targets) expect(open(p), name).toBe(true);
  });

  it('bagian dalam ruko latar, tembok belakang, & luar gerbang tidak dapat dijangkau', () => {
    const blocked: [string, Vec2][] = [
      ['dalam ruko S3', [-20, 0]],
      ['dalam ruko S4', [20, -5]],
      ['dalam ruko seberang F5', [4, 28]],
      ['di balik gerbang barat (jalan)', [-39.5, 18.5]],
      ['di balik gerbang timur (trotoar)', [39.5, 12.6]],
      ['di balik tembok belakang', [0, -22.5]],
    ];
    for (const [name, p] of blocked) expect(open(p), name).toBe(false);
  });

  it('pintu bongkar muat menghubungkan gang kiri dengan gudang', () => {
    // Semua pintu tertutup kecuali pintu bongkar muat → gudang tetap terjangkau dari jalan.
    const onlyLoading = reachable({ doorsOpen: { [LOADING.door.id]: true }, unlockedRooms: [], upgrades: {} }, [0, 11.5]);
    expect(onlyLoading([-10.6, -6])).toBe(true);
    const closed = reachable({ doorsOpen: {}, unlockedRooms: [], upgrades: {} }, [0, 11.5]);
    expect(closed([-10.6, -6])).toBe(false);
  });

  it('mobil boks yang parkir & motor karyawan tidak menutup jalur gang', () => {
    const busy = reachable({ doorsOpen: allDoorsOpen, unlockedRooms: [], upgrades: {}, vanParked: true, staffScooters: 5 }, spawn);
    expect(busy([-13.0, -3.2])).toBe(true);
    expect(busy([0, -19.85])).toBe(true);
    expect(busy([13.0, -5])).toBe(true);
  });
});

/** Jarak bebas minimum sepanjang segmen terhadap kumpulan collider. */
function clearance(a: Vec2, b: Vec2, r: number, boxes: AABB[]) {
  const n = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.1));
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const x = a[0] + (b[0] - a[0]) * t;
    const z = a[1] + (b[1] - a[1]) * t;
    const hit = boxes.find((bx) => overlaps(x, z, r, bx));
    if (hit) return { x, z, hit };
  }
  return null;
}

describe('Rute NPC & kendaraan bebas collider', () => {
  const statics = buildColliders({ doorsOpen: allDoorsOpen, unlockedRooms: [], upgrades: {}, vanParked: true, staffScooters: 5 });

  it('rute luar pasien tidak menembus properti, motor parkir, atau bangunan', () => {
    for (const route of PATIENT_ROUTES) {
      const pts: Vec2[] = [...route, [0, 11.5]];
      for (let i = 1; i < pts.length; i++) expect(clearance(pts[i - 1], pts[i], 0.25, statics), `${pts[i - 1]} → ${pts[i]}`).toBeNull();
    }
  });

  it('graf pejalan kaki terhubung dan tiap ruasnya bebas collider', () => {
    const { nodes, edges } = pedestrianGraph();
    const byId = new Map(nodes.map((n) => [n.id, n]));
    for (const [a, b] of edges) {
      expect(byId.has(a) && byId.has(b), `${a}-${b}`).toBe(true);
      expect(clearance(byId.get(a)!.p, byId.get(b)!.p, 0.22, statics), `${a} → ${b}`).toBeNull();
    }
    // Terhubung: BFS dari simpul pertama mencapai semua simpul.
    const adj = new Map<string, string[]>();
    for (const [a, b] of edges) {
      adj.set(a, [...(adj.get(a) ?? []), b]);
      adj.set(b, [...(adj.get(b) ?? []), a]);
    }
    const seen = new Set([nodes[0].id]);
    const queue = [nodes[0].id];
    while (queue.length) {
      for (const nb of adj.get(queue.shift()!) ?? []) {
        if (seen.has(nb)) continue;
        seen.add(nb);
        queue.push(nb);
      }
    }
    expect(seen.size).toBe(nodes.length);
  });

  it('rute mobil boks & lajur lalu lintas tidak menabrak bangunan atau properti', () => {
    const noVan = buildColliders({ doorsOpen: allDoorsOpen, unlockedRooms: [], upgrades: {}, staffScooters: 5 });
    const half = VAN_SIZE.w / 2;
    for (const route of [VAN_ROUTE_IN, VAN_REVERSE_OUT, VAN_ROUTE_OUT])
      for (let i = 1; i < route.length; i++) expect(clearance(route[i - 1], route[i], half, noVan), `${route[i - 1]} → ${route[i]}`).toBeNull();
    for (const z of [STREET.laneEast, STREET.laneWest]) expect(clearance([-64, z], [64, z], 1.0, noVan)).toBeNull();
  });
});

describe('Tata letak properti', () => {
  it('properti jalan tidak saling tumpang tindih & tidak masuk bangunan', () => {
    const props: [string, AABB][] = [
      ...STREET_LAMPS.map(([x, z]) => [`lampu ${x}`, { minX: x - 0.2, maxX: x + 0.2, minZ: z - 0.2, maxZ: z + 0.2 }] as [string, AABB]),
      ...TREES.map(([x, z]) => [`pohon ${x}`, { minX: x - 0.55, maxX: x + 0.55, minZ: z - 0.55, maxZ: z + 0.55 }] as [string, AABB]),
      ...POWER_POLES.map((x) => [`tiang ${x}`, { minX: x - 0.2, maxX: x + 0.2, minZ: POLE_Z - 0.2, maxZ: POLE_Z + 0.2 }] as [string, AABB]),
      ['halte', { minX: HALTE.x0, maxX: HALTE.x1, minZ: HALTE.z0, maxZ: HALTE.z1 }],
      ['kafe', { minX: CAFE_SET.x - 0.85, maxX: CAFE_SET.x + 0.85, minZ: CAFE_SET.z - 0.45, maxZ: CAFE_SET.z + 0.45 }],
      ...GATES.map((g, i) => [`pos satpam ${i}`, g.booth] as [string, AABB]),
    ];
    const strict = (a: AABB, b: AABB) => a.minX < b.maxX - 1e-6 && a.maxX > b.minX + 1e-6 && a.minZ < b.maxZ - 1e-6 && a.maxZ > b.minZ + 1e-6;
    for (let i = 0; i < props.length; i++) {
      for (let j = i + 1; j < props.length; j++) expect(strict(props[i][1], props[j][1]), `${props[i][0]} × ${props[j][0]}`).toBe(false);
      for (const s of SHOPS) expect(strict(props[i][1], shopBox(s)), `${props[i][0]} × ruko ${s.id}`).toBe(false);
      for (const w of WALLS) expect(strict(props[i][1], w), `${props[i][0]} × dinding`).toBe(false);
    }
  });

  it('batas dunia dikelilingi struktur yang terlihat (bukan dinding tak terlihat di area terbuka)', () => {
    // Tepi barat/timur hanya terbuka di gerbang (pagar + portal); tepi utara & selatan bertemu ruko/tembok.
    const colliders = districtColliders();
    const covered = (x: number, z: number) => colliders.some((b) => x >= b.minX - 0.35 && x <= b.maxX + 0.35 && z >= b.minZ - 0.35 && z <= b.maxZ + 0.35);
    for (let z = STREET.frontZ; z <= STREET.farFrontZ; z += 0.5) {
      const onRoad = z > STREET.curbNear && z < STREET.curbFar;
      for (const g of GATES) if (!onRoad) expect(covered(g.x, z), `gerbang x=${g.x} z=${z}`).toBe(true);
    }
    for (let x = -STREET.alleyOuter; x <= STREET.alleyOuter; x += 0.5) expect(covered(x, STREET.backLaneFar), `tembok belakang x=${x}`).toBe(true);
    expect(WORLD_BOUNDS.minX).toBeGreaterThan(-STREET.gateX);
    expect(WORLD_BOUNDS.maxX).toBeLessThan(STREET.gateX);
  });
});

import type { MatKey } from './materials';
import type { AABB, Vec2 } from './layout';

/**
 * Data kawasan di sekitar apotek (world building, PROJECT_STATUS.md "World building").
 * Satu sumber kebenaran untuk geometri luar, collider, batas dunia, rute pasien, lajur kendaraan,
 * dan graf pejalan kaki — murni data (tanpa React/Three) agar dapat diuji.
 *
 *   z=+34 ─ belakang deret ruko seberang
 *   z=+25,2 ─ muka ruko seberang · trotoar seberang (halte, kedai kopi)
 *   z=+22 ─ kanstin · jalan 2 lajur (lajur kiri: timur z 16,75, barat z 20,25) · zebra cross x 1,2–4,2
 *   z=+15 ─ kanstin · halaman/parkir deret ruko apotek
 *   z=+10,1 ─ muka ruko (apotek di x −12…12) · gang samping x ±12,2…16,6
 *   z=−18,1…−21,6 ─ gang belakang (menyambung kedua gang samping)
 *   x=±38,6 ─ gerbang kawasan (gapura + portal + pos satpam): batas yang terlihat
 */

export const STREET = {
  frontZ: 10.1,
  curbNear: 14.8,
  roadNear: 15.0,
  roadFar: 22.0,
  curbFar: 22.2,
  farFrontZ: 25.2,
  gateX: 38.6,
  /** Lajur kiri (lalu lintas Indonesia): arah timur (+x) di sisi apotek, arah barat (−x) di seberang. */
  laneEast: 16.75,
  laneWest: 20.25,
  centerLine: 18.5,
  alleyInner: 12.2,
  alleyOuter: 16.6,
  backLaneNear: -18.1,
  backLaneFar: -21.6,
  zebraX0: 1.2,
  zebraX1: 4.2,
  /** Garis jalan kaki di halaman depan apotek: di antara teras/papan kapur dan barisan motor parkir. */
  walkwayZ: 12.25,
  /** Koridor pejalan kaki di halaman ruko tetangga & di trotoar seberang. */
  nearWalkZ: 12.6,
  farWalkZ: 23.7,
  /** Jalur perabot (pohon, tiang, lampu) dekat kanstin. */
  nearFurnitureZ: 14.15,
  farFurnitureZ: 22.85,
} as const;

/** Batas dunia: tepinya selalu bertemu struktur yang terlihat (gerbang, bangunan, tembok belakang). */
export const DISTRICT_BOUNDS: AABB = { minX: -38.3, maxX: 38.3, minZ: STREET.backLaneFar, maxZ: STREET.farFrontZ };

// ------------------------------------------------------------------ Bangunan

export type ShopKind = 'closed' | 'kiosk' | 'warung' | 'bengkel' | 'cafe' | 'hardware';
/** Arketipe fasad (shopModels.ts): bentuk & bahan berbeda, bukan sekadar warna. */
export type ShopStyle = 'modern' | 'klasik' | 'bata' | 'warung' | 'bengkel' | 'bangunan';

export interface Shop {
  id: string;
  x0: number;
  x1: number;
  /** Muka bangunan (z) & arah hadap (+1 = menghadap +Z, deret apotek; −1 = deret seberang). */
  front: number;
  facing: 1 | -1;
  depth: number;
  floors: 2 | 3;
  roof: 'flat' | 'gable';
  name: string;
  sign: string;
  kind: ShopKind;
  facade: MatKey;
  balcony: boolean;
  awning: 'fabric' | 'metal';
  awningMat: MatKey;
  /** Teralis besi di jendela atas. */
  teralis: boolean;
  /** Toren air di atap. */
  tank: boolean;
  style: ShopStyle;
  /** Baris kedua papan nama (layanan/barang; generik, bukan merek). */
  tagline: string;
}

const near = (s: Omit<Shop, 'front' | 'facing'>): Shop => ({ ...s, front: STREET.frontZ, facing: 1 });
const far = (s: Omit<Shop, 'front' | 'facing' | 'depth'>): Shop => ({ ...s, front: STREET.farFrontZ, facing: -1, depth: 9 });

/**
 * Deret ruko. Ruko yang mengapit gang (S3, S4) memanjang sampai gang belakang sehingga gang samping &
 * gang belakang tertutup bangunan nyata, bukan dinding tak terlihat. Semua nama fiktif & generik.
 */
export const SHOPS: Shop[] = [
  near({ id: 'S1', x0: -38.6, x1: -31.2, depth: 18, floors: 2, roof: 'gable', name: 'TOKO KELONTONG', sign: '#1f5f99', kind: 'kiosk', facade: 'facadeA', balcony: false, awning: 'fabric', awningMat: 'awningRed', teralis: true, tank: true, style: 'klasik', tagline: 'SEMBAKO · GAS · AIR GALON' }),
  near({ id: 'S2', x0: -31.2, x1: -23.9, depth: 18, floors: 2, roof: 'flat', name: 'LAUNDRY KILOAN', sign: '#2e8bc0', kind: 'closed', facade: 'facadeB', balcony: true, awning: 'metal', awningMat: 'awningBlue', teralis: false, tank: false, style: 'modern', tagline: 'CUCI · SETRIKA · KILAT' }),
  near({ id: 'S3', x0: -23.9, x1: -16.6, depth: 31.7, floors: 3, roof: 'flat', name: 'FOTOKOPI & ATK', sign: '#c0392b', kind: 'kiosk', facade: 'facadeC', balcony: true, awning: 'fabric', awningMat: 'awningGreen', teralis: true, tank: true, style: 'modern', tagline: 'PRINT · JILID · LAMINASI' }),
  near({ id: 'S4', x0: 16.6, x1: 23.9, depth: 31.7, floors: 2, roof: 'gable', name: 'KONTER PULSA', sign: '#e67e22', kind: 'kiosk', facade: 'facadeD', balcony: false, awning: 'metal', awningMat: 'awningBlue', teralis: true, tank: false, style: 'modern', tagline: 'PULSA · KUOTA · AKSESORIS' }),
  near({ id: 'S5', x0: 23.9, x1: 31.2, depth: 18, floors: 3, roof: 'flat', name: 'TOKO BANGUNAN', sign: '#7f8c8d', kind: 'hardware', facade: 'facadeA', balcony: true, awning: 'metal', awningMat: 'awningRed', teralis: false, tank: true, style: 'bangunan', tagline: 'SEMEN · CAT · BESI · PIPA' }),
  near({ id: 'S6', x0: 31.2, x1: 38.6, depth: 18, floors: 2, roof: 'gable', name: 'RUMAH MAKAN PADANG', sign: '#b03a2e', kind: 'warung', facade: 'facadeB', balcony: false, awning: 'fabric', awningMat: 'awningRed', teralis: false, tank: true, style: 'warung', tagline: 'MASAKAN KHAS MINANG' }),
  far({ id: 'F0', x0: -38.6, x1: -30.88, floors: 2, roof: 'flat', name: 'BENGKEL MOTOR', sign: '#34495e', kind: 'bengkel', facade: 'facadeB', balcony: false, awning: 'metal', awningMat: 'awningBlue', teralis: true, tank: true, style: 'bengkel', tagline: 'SERVIS · GANTI OLI · TAMBAL BAN' }),
  far({ id: 'F1', x0: -30.88, x1: -23.16, floors: 3, roof: 'gable', name: 'TOKO ROTI', sign: '#d35400', kind: 'kiosk', facade: 'facadeC', balcony: true, awning: 'fabric', awningMat: 'awningRed', teralis: false, tank: false, style: 'bata', tagline: 'ROTI & KUE SEGAR SETIAP HARI' }),
  far({ id: 'F2', x0: -23.16, x1: -15.44, floors: 2, roof: 'flat', name: 'SALON', sign: '#8e44ad', kind: 'closed', facade: 'facadeD', balcony: false, awning: 'fabric', awningMat: 'awningGreen', teralis: true, tank: true, style: 'modern', tagline: 'POTONG · CREAMBATH · RIAS' }),
  far({ id: 'F3', x0: -15.44, x1: -7.72, floors: 3, roof: 'flat', name: 'TOKO EMAS', sign: '#b7950b', kind: 'closed', facade: 'facadeA', balcony: true, awning: 'metal', awningMat: 'awningRed', teralis: true, tank: false, style: 'modern', tagline: 'PERHIASAN EMAS & PERAK' }),
  far({ id: 'F4', x0: -7.72, x1: 0, floors: 2, roof: 'gable', name: 'TOKO SEPATU', sign: '#2c3e50', kind: 'closed', facade: 'facadeB', balcony: false, awning: 'metal', awningMat: 'awningBlue', teralis: false, tank: true, style: 'klasik', tagline: 'SEPATU · SANDAL · TAS' }),
  far({ id: 'F5', x0: 0, x1: 7.72, floors: 2, roof: 'flat', name: 'KEDAI KOPI', sign: '#6e2c00', kind: 'cafe', facade: 'facadeC', balcony: true, awning: 'fabric', awningMat: 'awningGreen', teralis: false, tank: true, style: 'bata', tagline: 'KOPI · TEH · ROTI BAKAR' }),
  far({ id: 'F6', x0: 7.72, x1: 15.44, floors: 3, roof: 'gable', name: 'PERCETAKAN', sign: '#16a085', kind: 'kiosk', facade: 'facadeD', balcony: false, awning: 'metal', awningMat: 'awningBlue', teralis: true, tank: true, style: 'modern', tagline: 'SPANDUK · STIKER · UNDANGAN' }),
  far({ id: 'F7', x0: 15.44, x1: 23.16, floors: 2, roof: 'gable', name: 'TOKO PAKAIAN', sign: '#a93226', kind: 'kiosk', facade: 'facadeA', balcony: true, awning: 'fabric', awningMat: 'awningRed', teralis: true, tank: false, style: 'klasik', tagline: 'BUSANA MUSLIM · KAOS · BATIK' }),
  far({ id: 'F8', x0: 23.16, x1: 30.88, floors: 2, roof: 'gable', name: 'WARUNG MAKAN', sign: '#27ae60', kind: 'warung', facade: 'facadeC', balcony: false, awning: 'fabric', awningMat: 'awningGreen', teralis: false, tank: true, style: 'warung', tagline: 'NASI · LAUK · ES TEH' }),
  far({ id: 'F9', x0: 30.88, x1: 38.6, floors: 3, roof: 'flat', name: 'TOKO MAINAN', sign: '#2e86c1', kind: 'closed', facade: 'facadeD', balcony: true, awning: 'metal', awningMat: 'awningBlue', teralis: false, tank: true, style: 'klasik', tagline: 'MAINAN ANAK · ALAT TULIS' }),
];

/**
 * Ruko latar di luar gerbang (tak terjangkau, tanpa collider): gaya fasad sama dengan kawasan agar jalan yang
 * berlanjut tidak tampak sebagai kotak polos. Semua tertutup (pintu harmonika / lipat kayu / rolling door).
 */
const BACKDROP_NAMES: [string, string][] = [
  ['TOKO LISTRIK', 'KABEL · LAMPU · STOP KONTAK'],
  ['AGEN GAS & AIR', 'ELPIJI · AIR GALON'],
  ['MEUBEL JATI', 'LEMARI · KURSI · MEJA'],
  ['TOKO KUE', 'KUE BASAH & KERING'],
  ['BENGKEL LAS', 'PAGAR · TERALIS · KANOPI'],
  ['WARUNG KOPI', 'KOPI · MIE · GORENGAN'],
  ['TOKO PLASTIK', 'EMBER · TOPLES · RAK'],
  ['JAHIT & PERMAK', 'JAHIT · PERMAK · BORDIR'],
  ['TOKO BESI', 'BESI · PAKU · KAWAT'],
  ['SEMBAKO MURAH', 'BERAS · MINYAK · GULA'],
  ['SERVIS HP', 'SERVIS · AKSESORIS'],
  ['TOKO KACAMATA', 'KACAMATA · LENSA'],
  ['PANGKAS RAMBUT', 'CUKUR · KERAMAS'],
  ['TOKO SEPEDA', 'SEPEDA · ONDERDIL'],
  ['KONVEKSI', 'KAOS · SERAGAM'],
  ['TOKO JAM', 'JAM · BATERAI · SERVIS'],
];
const BACKDROP_STYLES: ShopStyle[] = ['klasik', 'modern', 'bata', 'klasik', 'modern', 'klasik', 'bata', 'modern'];
const BACKDROP_COLORS = ['#1f5f99', '#b03a2e', '#16a085', '#8e44ad', '#d35400', '#2c3e50', '#b7950b', '#27ae60'];
const FACADES_BG: MatKey[] = ['facadeA', 'facadeB', 'facadeC', 'facadeD', 'houseWall'];

export const BACKDROP_SHOPS: Shop[] = [-1, 1].flatMap((side) =>
  [1, -1].flatMap((row) =>
    [0, 1, 2, 3].map((k) => {
      const n = (side > 0 ? 8 : 0) + (row > 0 ? 0 : 4) + k;
      const a = STREET.gateX + 0.2 + k * 8;
      const x0 = side > 0 ? a : -a - 7.6;
      const style = BACKDROP_STYLES[n % BACKDROP_STYLES.length];
      return {
        id: `BG${n}`,
        x0,
        x1: x0 + 7.6,
        front: row > 0 ? STREET.frontZ : STREET.farFrontZ,
        facing: row as 1 | -1,
        depth: 9,
        floors: (n % 3 === 1 ? 3 : 2) as 2 | 3,
        roof: (style === 'klasik' && n % 2 ? 'gable' : 'flat') as 'flat' | 'gable',
        name: BACKDROP_NAMES[n][0],
        tagline: BACKDROP_NAMES[n][1],
        sign: BACKDROP_COLORS[n % BACKDROP_COLORS.length],
        kind: 'closed' as const,
        style,
        facade: FACADES_BG[n % FACADES_BG.length],
        balcony: n % 2 === 0,
        awning: 'metal' as const,
        awningMat: (['awningRed', 'awningBlue', 'awningGreen'] as MatKey[])[n % 3],
        teralis: n % 3 === 0,
        tank: n % 2 === 1,
      };
    }),
  ),
);

export const isOpenShop = (s: Shop) => s.kind !== 'closed';

/** Titik berdiri pembeli di depan meja kios (pejalan kaki & graf rute). */
export function shopCounterSpot(s: Shop): Vec2 {
  return [(s.x0 + s.x1) / 2, s.front + s.facing * 0.75];
}

// ------------------------------------------------------------------ Gerbang kawasan

export interface Gate {
  x: number;
  /** Arah ke dalam kawasan (+1 di gerbang barat, −1 di gerbang timur). */
  inward: 1 | -1;
  /** Pos satpam di halaman depan, sisi dalam gerbang. */
  booth: AABB;
}

/** Tiang gapura (z) di kedua sisi jalan, tepat di trotoar. */
export const GATE_PILLAR_Z: number[] = [STREET.curbNear - 0.2, STREET.curbFar + 0.2];

export const GATES: Gate[] = [-1, 1].map((side) => {
  const x = side * STREET.gateX;
  const inward = (side === -1 ? 1 : -1) as 1 | -1;
  const bx0 = x + inward * 0.2;
  const bx1 = x + inward * 1.8;
  return { x, inward, booth: { minX: Math.min(bx0, bx1), maxX: Math.max(bx0, bx1), minZ: 10.35, maxZ: 11.95 } };
});

// ------------------------------------------------------------------ Properti jalan

/** Lampu jalan: [x, z, arah lengan (+1 menghadap +Z / −1 menghadap −Z)]. */
export const STREET_LAMPS: [number, number, 1 | -1][] = [
  [-34, 14.5, 1],
  [-20.2, 14.5, 1],
  [-11.2, 14.5, 1],
  [11.2, 14.5, 1],
  [20.2, 14.5, 1],
  [34, 14.5, 1],
  [-27, 22.55, -1],
  [-9, 22.55, -1],
  [9, 22.55, -1],
  [27, 22.55, -1],
];

/** Pohon ketapang: [x, z, seed, skala]. Tidak ada pohon di mulut gang (akses kendaraan). */
export const TREES: [number, number, number, number][] = [
  [-27.5, STREET.nearFurnitureZ, 3, 1],
  [27.5, STREET.nearFurnitureZ, 7, 1.05],
  [-31.5, STREET.farFurnitureZ, 11, 1.1],
  [-14.5, STREET.farFurnitureZ, 13, 1.05],
  [12.5, STREET.farFurnitureZ, 17, 1.15],
  [32.5, STREET.farFurnitureZ, 19, 1],
];

export const POWER_POLES: number[] = [-36, -18, 0, 18, 36];
export const POLE_Z = 22.55;

/** Halte angkot di trotoar seberang. */
export const HALTE = { x0: -6.6, x1: -1.6, z0: 24.3, z1: 25.15 };
/** Meja-kursi teras kedai kopi (F5). */
export const CAFE_SET = { x: 6.35, z: 24.65 };

/** Petak parkir motor di halaman depan apotek (sisi kiri & kanan pintu); tegak lurus muka ruko. */
export const PARKING_BAYS: Vec2[] = [
  ...[-10.2, -9.3, -8.4, -7.5, -6.6, -5.7, -4.8, -3.9].map((x) => [x, 13.7] as Vec2),
  ...[5.9, 6.8, 7.7, 8.6, 9.5, 10.4].map((x) => [x, 13.7] as Vec2),
];
/** Petak yang terisi motor parkir statis (indeks PARKING_BAYS) + warna. */
export const PARKED_SCOOTERS: [number, MatKey][] = [
  [0, 'bikeRed'],
  [1, 'bikeBlack'],
  [3, 'bikeWhite'],
  [6, 'bikeBlue'],
  [9, 'bikeBlack'],
  [10, 'bikeWhite'],
  [12, 'bikeRed'],
];

/** Area bongkar muat gudang di gang kiri; pintu gudang (berengsel) di dinding x = −12. */
export const LOADING = {
  door: { id: 'door-loading', x: -12, z: -3.2, width: 1.4 },
  zone: { minX: -16.4, maxX: -12.4, minZ: -7.4, maxZ: 0.2 } as AABB,
  /** Posisi parkir mobil boks (tengah). Masuk dari jalan menghadap −Z, keluar dengan mundur. */
  vanPark: { x: -14.6, z: -3.6 },
  /** Panel "Penerimaan Barang" di dinding samping pintu (titik interaksi). */
  panel: { x: -12.12, z: -1.75 },
};

/** Ukuran mobil boks (lebar × panjang, m) untuk collider saat parkir. */
/** Tapak mobil boks (bak ±0,95 m; panjang termasuk bemper = VEHICLES.van.length). */
export const VAN_SIZE = { w: 1.9, l: 5.2 };

/** Parkir motor karyawan di gang kanan, tegak lurus tembok ruko S4 (diisi sesuai pegawai yang bekerja). */
export const STAFF_PARKING: Vec2[] = [
  [15.6, -1.5],
  [15.6, -2.5],
  [15.6, -3.5],
  [15.6, -4.5],
  [15.6, -5.5],
];

/** Pintu rumah warga di tembok belakang gang belakang (titik muncul/hilang pejalan kaki). */
export const HOUSE_DOORS: number[] = [-9, 1.5, 9.5];

/** Jemuran warga (pusat x) di depan tembok belakang; tali sepanjang 3,2 m pada z CLOTHESLINE_Z. */
export const CLOTHESLINES: number[] = [-5, 5.5];
export const CLOTHESLINE_Z = STREET.backLaneFar + 0.5;
/** Pipa air hujan di punggung apotek. */
export const BACK_PIPES: number[] = [-11.6, -3.1, 3.1, 11.6];
/** Tong sampah di sudut gang belakang. */
export const BINS: Vec2[] = [
  [-15.9, -20.95],
  [15.9, -20.95],
];
/** Palet kosong di area bongkar muat (tapak). */
export const PALLET: AABB = { minX: -16.45, maxX: -15.65, minZ: -7.5, maxZ: -6.3 };

// ------------------------------------------------------------------ Collider

const box = (minX: number, maxX: number, minZ: number, maxZ: number): AABB => ({ minX, maxX, minZ, maxZ });

/** Tapak motor parkir yang menghadap −Z (tegak lurus muka ruko). */
/** Tapak motor parkir (sejajar sumbu Z): panjang ±0,95 m; lebar ±0,35 m mencakup ujung setang & spion. */
export function scooterFootprint([x, z]: Vec2): AABB {
  return box(x - 0.35, x + 0.35, z - 0.95, z + 0.95);
}

/** Tapak motor parkir yang tegak lurus tembok gang (sejajar sumbu X). */
export function scooterFootprintX([x, z]: Vec2): AABB {
  return box(x - 0.95, x + 0.95, z - 0.35, z + 0.35);
}

export function vanParkedFootprint(): AABB {
  const { x, z } = LOADING.vanPark;
  return box(x - VAN_SIZE.w / 2, x + VAN_SIZE.w / 2, z - VAN_SIZE.l / 2, z + VAN_SIZE.l / 2);
}

export function shopBox(s: Shop): AABB {
  return s.facing === 1 ? box(s.x0, s.x1, s.front - s.depth, s.front) : box(s.x0, s.x1, s.front, s.front + s.depth);
}

/** Bangunan & tembok di luar apotek — juga dipakai sebagai penghalang kamera orang ketiga. */
export function districtBlockers(): AABB[] {
  return [...SHOPS.map(shopBox), box(-STREET.alleyOuter, STREET.alleyOuter, STREET.backLaneFar - 0.3, STREET.backLaneFar), ...GATES.map((g) => g.booth)];
}

/** Semua collider statis di luar apotek. Meja kios berada tepat di garis muka bangunan. */
export function districtColliders(): AABB[] {
  const out: AABB[] = districtBlockers();
  for (const g of GATES) {
    // Pagar trotoar & tiang gapura (garis gerbang).
    out.push(box(g.x - 0.12, g.x + 0.12, STREET.frontZ, STREET.curbNear));
    out.push(box(g.x - 0.12, g.x + 0.12, STREET.curbFar, STREET.farFrontZ));
    for (const z of GATE_PILLAR_Z) out.push(box(g.x - 0.4, g.x + 0.4, z - 0.4, z + 0.4));
  }
  // Gang belakang: jemuran (tiang + tali; area di balik tali tertutup), pipa air hujan, tong sampah.
  for (const x of CLOTHESLINES) out.push(box(x - 1.65, x + 1.65, STREET.backLaneFar, CLOTHESLINE_Z + 0.06));
  for (const x of BACK_PIPES) out.push(box(x - 0.07, x + 0.07, STREET.backLaneNear - 0.14, STREET.backLaneNear));
  for (const [x, z] of BINS) out.push(box(x - 0.3, x + 0.3, z - 0.3, z + 0.3));
  out.push(PALLET);
  for (const [x, z] of STREET_LAMPS) out.push(box(x - 0.2, x + 0.2, z - 0.2, z + 0.2));
  for (const [x, z] of TREES) out.push(box(x - 0.55, x + 0.55, z - 0.55, z + 0.55));
  for (const x of POWER_POLES) out.push(box(x - 0.2, x + 0.2, POLE_Z - 0.2, POLE_Z + 0.2));
  out.push(box(HALTE.x0, HALTE.x1, HALTE.z0, HALTE.z1));
  out.push(box(CAFE_SET.x - 0.85, CAFE_SET.x + 0.85, CAFE_SET.z - 0.45, CAFE_SET.z + 0.45));
  for (const [i] of PARKED_SCOOTERS) out.push(scooterFootprint(PARKING_BAYS[i]));
  // Papan kapur di teras apotek & panel listrik di teras ruko S3.
  out.push(box(-3.7, -2.7, 11.0, 11.8));
  out.push(box(-17.75, -16.85, 10.1, 10.55));
  return out;
}

// ------------------------------------------------------------------ Rute pasien

/**
 * Rute pasien antara titik munculnya dan pintu luar apotek (DOOR_OUTSIDE di (0, 11,5)).
 * Pasien datang dari gang samping (permukiman di belakang) atau menyeberang dari halte di seberang jalan
 * lewat zebra cross, lalu berjalan di jalur pejalan kaki halaman depan (tidak menembus motor & papan kapur).
 * Titik muncul di dalam gang tersembunyi dari halaman depan dan jaraknya ±15 m dari pintu (lihat temuan A10).
 */
export const PATIENT_ROUTES: Vec2[][] = [
  [
    [-12.9, 6.4],
    [-12.9, STREET.walkwayZ],
    [-1.2, STREET.walkwayZ],
  ],
  [
    [12.9, 6.4],
    [12.9, STREET.walkwayZ],
    [1.4, STREET.walkwayZ],
  ],
  [
    [-4.1, 24.0],
    [2.7, STREET.farWalkZ],
    [2.7, STREET.curbFar + 0.1],
    [2.7, STREET.curbNear - 0.1],
    [1.4, STREET.walkwayZ],
  ],
];

/** Rute untuk pasien tertentu (deterministik dari id). */
export function patientRoute(id: string): Vec2[] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PATIENT_ROUTES[h % PATIENT_ROUTES.length];
}

// ------------------------------------------------------------------ Kendaraan

/** Lalu lintas: muncul & hilang jauh di balik gerbang (di luar area pemain). */
export const TRAFFIC = {
  spawnX: 64,
  /** Jarak aman di belakang kendaraan lain (m). */
  gap: 2.2,
  /** Garis henti sebelum zebra cross untuk tiap arah. */
  stopLineEast: STREET.zebraX0 - 1.6,
  stopLineWest: STREET.zebraX1 + 1.6,
  halteStopX: -4.1,
};

/**
 * Mobil boks PBF (DeliveryVan): datang di lajur timur lalu belok kiri MAJU masuk gang kiri (tanpa memotong lajur lawan)
 * sampai area bongkar muat; pintu bak belakang menghadap mulut gang, sisi kanan menghadap pintu gudang.
 * Pergi dengan MUNDUR keluar gang — menunggu lajur timur kosong sebelum buritan masuk jalan — lalu maju ke timur.
 * Lalu lintas hanya pernah antre di belakang van yang bergerak menjauh (tidak ada kebuntuan).
 * Pusat kendaraan mengikuti polyline ini (diuji bebas collider di world.test.ts).
 */
export const VAN_ROUTE_IN: Vec2[] = [
  [-TRAFFIC.spawnX, STREET.laneEast],
  [-19.5, STREET.laneEast],
  [-14.6, 12.4],
  [-14.6, LOADING.vanPark.z],
];
export const VAN_REVERSE_OUT: Vec2[] = [
  [-14.6, LOADING.vanPark.z],
  [-14.6, 12.4],
  [-16.0, 15.2],
  [-19.5, STREET.laneEast],
];
export const VAN_ROUTE_OUT: Vec2[] = [
  [-19.5, STREET.laneEast],
  [TRAFFIC.spawnX, STREET.laneEast],
];

// ------------------------------------------------------------------ Graf pejalan kaki

export interface PedNode {
  id: string;
  p: Vec2;
  /** Jenis simpul tujuan: tempat berhenti & aktivitas. */
  kind?: 'shop' | 'window' | 'cafe' | 'halte' | 'home';
  /** Arah hadap saat beraktivitas (radian; 0 = menghadap +Z). */
  face?: number;
}

/**
 * Graf jalur pejalan kaki: koridor halaman depan & trotoar seberang, zebra cross, gang samping, gang belakang,
 * dan pintu rumah warga. Simpul tujuan: meja kios, etalase toko tutup, halte, kursi kafe, rumah.
 * Pejalan kaki ambient tidak masuk apotek; mereka muncul/hilang di pintu rumah warga atau naik/turun angkot di halte.
 */
export function pedestrianGraph(): { nodes: PedNode[]; edges: [string, string][] } {
  const nodes: PedNode[] = [];
  const edges: [string, string][] = [];
  const add = (n: PedNode) => nodes.push(n);
  const link = (a: string, b: string) => edges.push([a, b]);
  // Koridor depan: z 12,6 di depan ruko tetangga, 12,25 di depan apotek (antara teras & parkir).
  const xs = [-37.2, -33, -29, -25, -21, -17.4, -12.9, -6, -1.2, 2.7, 6, 12.9, 17.4, 21, 25, 29, 33, 37.2];
  xs.forEach((x, i) => {
    const z = Math.abs(x) <= 12.9 ? STREET.walkwayZ : STREET.nearWalkZ;
    add({ id: `n${i}`, p: [x, x === 2.7 ? 13.6 : z] });
    if (i) link(`n${i - 1}`, `n${i}`);
  });
  const fxs = [-37.2, -33, -29, -25, -21, -17, -11, -4.1, 0.5, 2.7, 9, 13, 17, 21, 25, 29, 33, 37.2];
  fxs.forEach((x, i) => {
    add({ id: `f${i}`, p: [x, STREET.farWalkZ] });
    if (i) link(`f${i - 1}`, `f${i}`);
  });
  // Zebra cross.
  link(`n${xs.indexOf(2.7)}`, `f${fxs.indexOf(2.7)}`);
  // Gang samping (menyusuri dinding apotek, menghindari mobil boks & parkir karyawan) & gang belakang.
  for (const side of [-1, 1]) {
    const x = side * 12.9;
    const tag = side < 0 ? 'L' : 'R';
    add({ id: `a${tag}0`, p: [x, 4] });
    add({ id: `a${tag}1`, p: [x, -10] });
    add({ id: `a${tag}2`, p: [x, -19.85] });
    link(`n${xs.indexOf(x)}`, `a${tag}0`);
    link(`a${tag}0`, `a${tag}1`);
    link(`a${tag}1`, `a${tag}2`);
  }
  const backIds = ['aL2', ...HOUSE_DOORS.map((_, i) => `b${i}`), 'aR2'];
  HOUSE_DOORS.forEach((x, i) => add({ id: `b${i}`, p: [x, -19.85] }));
  for (let i = 1; i < backIds.length; i++) link(backIds[i - 1], backIds[i]);
  HOUSE_DOORS.forEach((x, i) => {
    add({ id: `home${i}`, p: [x, STREET.backLaneFar + 0.35], kind: 'home', face: Math.PI });
    link(`home${i}`, `b${i}`);
  });
  // Tujuan di depan toko (deret dekat di luar apotek & deret seberang).
  for (const s of SHOPS) {
    const [cx, cz] = shopCounterSpot(s);
    // Muka toko yang tertutup halte (F4) tidak menjadi tujuan; halte sendiri adalah simpul tujuan.
    if (cx > HALTE.x0 && cx < HALTE.x1 && cz > HALTE.z0 - 0.5) continue;
    const id = `shop-${s.id}`;
    add({ id, p: [cx, cz], kind: isOpenShop(s) ? 'shop' : 'window', face: s.facing === 1 ? Math.PI : 0 });
    const row = s.facing === 1 ? xs.map((x, i) => [x, `n${i}`] as const) : fxs.map((x, i) => [x, `f${i}`] as const);
    const nearest = row.reduce((a, b) => (Math.abs(b[0] - cx) < Math.abs(a[0] - cx) ? b : a));
    link(id, nearest[1]);
  }
  add({ id: 'halte', p: [(HALTE.x0 + HALTE.x1) / 2, HALTE.z0 - 0.35], kind: 'halte', face: Math.PI });
  link('halte', `f${fxs.indexOf(-4.1)}`);
  add({ id: 'cafe', p: [CAFE_SET.x - 1.15, CAFE_SET.z - 0.1], kind: 'cafe', face: Math.PI / 2 });
  link('cafe', `f${fxs.indexOf(2.7)}`);
  return { nodes, edges };
}

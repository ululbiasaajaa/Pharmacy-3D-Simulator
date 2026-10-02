import * as THREE from 'three';
import type { GeoBuilder } from '@/game/visual/geometry';
import type { MatKey } from './materials';
import { extrudeSide, smooth } from './streetModels';

/**
 * Model kendaraan buatan sendiri (tanpa aset eksternal): mobil boks distributor (PBF), mobil penumpang,
 * dan angkot. Koordinat lokal: panjang searah +Z (moncong di +Z), lebar searah X, tanah di y = 0.
 * Bodi dari profil samping yang diekstrusi (teknik yang sama dengan motor di streetModels.ts).
 */
type B = GeoBuilder<MatKey>;

/** Roda: ban (torus), pelek, dan tutup as. `x` = posisi tengah tapak roda. */
function wheel(b: B, x: number, z: number, r: number, w: number) {
  const tube = Math.min(w * 0.45, r * 0.32);
  b.add('tire', new THREE.TorusGeometry(r - tube, tube, 10, 22), x, r, z, { rotY: Math.PI / 2 });
  const out = Math.sign(x);
  b.cylinder('aluminum', r * 0.58, r * 0.58, w * 0.7, x + out * 0.004, r, z, { rotZ: Math.PI / 2, seg: 16 });
  b.cylinder('metalDark', r * 0.2, r * 0.2, w * 0.8, x + out * 0.01, r, z, { rotZ: Math.PI / 2, seg: 10 });
}

/** Kaca depan miring dari titik bawah (zb, yb) ke titik atas (zt, yt) pada profil samping. */
function windshield(b: B, width: number, zb: number, yb: number, zt: number, yt: number) {
  const len = Math.hypot(zt - zb, yt - yb);
  const lean = Math.atan2(zb - zt, yt - yb);
  const nz = Math.cos(lean) * 0.022;
  const ny = Math.sin(lean) * 0.022;
  b.box('glassDark', width, len - 0.08, 0.02, 0, (yb + yt) / 2 + ny, (zb + zt) / 2 + nz, { rotX: -lean, r: 0 });
}

/** Spion samping (lengan + kepala). */
function mirrors(b: B, halfW: number, y: number, z: number) {
  for (const s of [-1, 1]) {
    b.box('black', 0.12, 0.03, 0.03, s * (halfW + 0.05), y, z, { r: 0 });
    b.box('black', 0.05, 0.17, 0.12, s * (halfW + 0.12), y, z, { r: 0.015 });
  }
}

/** Pelat nomor (hitam = pribadi/niaga lama; kuning = angkutan umum). */
function plate(b: B, mat: MatKey, y: number, z: number, flip: 1 | -1) {
  b.box(mat, 0.42, 0.11, 0.012, 0, y, z, { r: 0.004 });
  b.box(mat === 'paintYellow' ? 'black' : 'white', 0.36, 0.015, 0.004, 0, y, z + flip * 0.008, { r: 0 });
}

// ------------------------------------------------------------------ Mobil boks PBF

export const VAN_DIM = { length: 5.0, width: 1.9, height: 2.58 };

const VAN_CAB: [number, number][] = [
  [0.9, 0.5],
  [2.42, 0.5],
  [2.52, 0.62],
  [2.52, 1.12],
  [2.32, 1.32],
  [1.98, 2.06],
  [1.82, 2.14],
  [0.9, 2.14],
];

/** Mobil boks distributor farmasi (±5 m): kabin + bak boks berpintu belakang. */
export function boxVanModel(b: B) {
  b.add('white', extrudeSide(VAN_CAB, 1.86, 0.06), 0, 0, 0);
  windshield(b, 1.6, 2.32, 1.32, 1.98, 2.06);
  for (const s of [-1, 1]) {
    b.box('glassDark', 0.02, 0.55, 0.82, s * 0.935, 1.7, 1.45, { r: 0 });
    // Garis pintu kabin.
    b.box('metalDark', 0.012, 1.4, 0.012, s * 0.935, 1.25, 0.98, { r: 0 });
  }
  // Bak boks + pita warna perusahaan (teks di label terpisah).
  b.box('white', 1.96, 1.84, 3.36, 0, 1.64, -0.82, { r: 0.04 });
  b.box('facadeAccent', 1.975, 0.16, 3.3, 0, 0.98, -0.82, { r: 0 });
  b.box('facadeAccent', 1.975, 0.07, 3.3, 0, 2.42, -0.82, { r: 0 });
  // Spakbor roda belakang & sasis.
  for (const s of [-1, 1]) b.box('black', 0.28, 0.05, 0.86, s * 0.82, 0.74, -1.55, { r: 0.01 });
  b.box('black', 1.3, 0.22, 4.7, 0, 0.44, 0, { r: 0.01 });
  // Pintu belakang: sambungan tengah, engsel, gagang.
  b.box('metalDark', 0.025, 1.76, 0.012, 0, 1.64, -2.506, { r: 0 });
  for (const y of [0.95, 1.65, 2.35]) for (const s of [-1, 1]) b.box('metalDark', 0.05, 0.12, 0.025, s * 0.93, y, -2.51, { r: 0.004 });
  for (const s of [-1, 1]) b.box('chrome', 0.03, 0.7, 0.03, s * 0.1, 1.55, -2.525, { r: 0.01 });
  // Lampu, bemper, gril, pelat.
  for (const s of [-1, 1]) {
    b.box('kioskLight', 0.3, 0.13, 0.03, s * 0.66, 0.95, 2.525, { r: 0.01 });
    b.box('paintYellow', 0.08, 0.1, 0.03, s * 0.88, 0.95, 2.5, { r: 0.008 });
    b.box('ledRed', 0.14, 0.26, 0.03, s * 0.84, 0.92, -2.52, { r: 0.008 });
  }
  b.box('black', 1.9, 0.2, 0.16, 0, 0.5, 2.55, { r: 0.03 });
  b.box('metalDark', 0.9, 0.22, 0.02, 0, 0.82, 2.53, { r: 0.006 });
  b.box('black', 1.9, 0.16, 0.14, 0, 0.5, -2.56, { r: 0.02 });
  plate(b, 'black', 0.5, 2.64, 1);
  plate(b, 'black', 0.5, -2.64, -1);
  mirrors(b, 0.93, 1.6, 2.0);
  for (const s of [-1, 1]) {
    wheel(b, s * 0.8, 1.62, 0.34, 0.21);
    wheel(b, s * 0.8, -1.55, 0.34, 0.21);
  }
}

// ------------------------------------------------------------------ Mobil penumpang

export const CAR_DIM = { length: 4.2, width: 1.72 };

const CAR_BODY = smooth(
  [
    [-2.08, 0.42],
    [-2.1, 0.88],
    [-1.75, 1.0],
    [1.25, 0.98],
    [2.02, 0.82],
    [2.1, 0.5],
    [1.8, 0.3],
    [-1.8, 0.3],
  ],
  48,
);
const CAR_CABIN = smooth(
  [
    [-1.86, 0.94],
    [-1.62, 1.47],
    [-1.2, 1.55],
    [0.35, 1.55],
    [1.24, 0.96],
  ],
  40,
);

/** Mobil penumpang (hatchback/MPV kecil generik). `body` biasanya 'carPaint' (warna lewat instanceColor). */
export function carModel(b: B, body: MatKey) {
  b.add(body, extrudeSide(CAR_BODY, 1.72, 0.08), 0, 0, 0);
  b.add('glassDark', extrudeSide(CAR_CABIN, 1.5, 0.06), 0, 0, 0);
  b.box(body, 1.36, 0.04, 1.62, 0, 1.56, -0.42, { r: 0.02 });
  for (const s of [-1, 1]) {
    b.box(body, 0.03, 0.5, 0.09, s * 0.745, 1.24, -0.32, { r: 0 });
    b.box('kioskLight', 0.34, 0.1, 0.05, s * 0.6, 0.78, 2.05, { r: 0.02, rotY: s * 0.12 });
    b.box('ledRed', 0.3, 0.1, 0.04, s * 0.64, 0.84, -2.08, { r: 0.015 });
  }
  b.box('black', 1.62, 0.14, 0.08, 0, 0.42, 2.1, { r: 0.03 });
  b.box('black', 1.62, 0.14, 0.08, 0, 0.44, -2.1, { r: 0.03 });
  b.box('metalDark', 0.7, 0.12, 0.02, 0, 0.64, 2.1, { r: 0.008 });
  plate(b, 'black', 0.5, 2.15, 1);
  plate(b, 'black', 0.62, -2.13, -1);
  mirrors(b, 0.78, 1.05, 1.15);
  for (const s of [-1, 1]) {
    wheel(b, s * 0.74, 1.3, 0.31, 0.2);
    wheel(b, s * 0.74, -1.3, 0.31, 0.2);
  }
}

// ------------------------------------------------------------------ Angkot

export const ANGKOT_DIM = { length: 3.95, width: 1.62 };

const ANGKOT_BODY: [number, number][] = [
  [-1.97, 0.36],
  [-1.97, 1.88],
  [-1.9, 1.94],
  [1.35, 1.94],
  [1.78, 1.22],
  [1.95, 1.08],
  [1.98, 0.42],
  [1.82, 0.3],
  [-1.82, 0.3],
];

/**
 * Angkot (minibus angkutan kota): jendela samping memanjang, pintu geser terbuka di sisi kiri (+X, sisi trotoar
 * untuk lalu lintas lajur kiri), pelat kuning angkutan umum. `body` biasanya 'carPaint'.
 */
export function angkotModel(b: B, body: MatKey) {
  b.add(body, extrudeSide(ANGKOT_BODY, 1.62, 0.05), 0, 0, 0);
  windshield(b, 1.42, 1.78, 1.22, 1.35, 1.94);
  for (const s of [-1, 1]) {
    b.box('glassDark', 0.02, 0.5, 2.95, s * 0.815, 1.6, -0.35, { r: 0 });
    for (const z of [-1.2, -0.4, 0.4]) b.box(body, 0.03, 0.52, 0.06, s * 0.822, 1.6, z, { r: 0 });
    // Pita putih di bawah jendela.
    b.box('white', 0.012, 0.08, 3.85, s * 0.812, 1.3, 0, { r: 0 });
    b.box('kioskLight', 0.24, 0.12, 0.04, s * 0.55, 0.85, 1.98, { r: 0.015 });
    b.box('ledRed', 0.12, 0.24, 0.04, s * 0.7, 0.9, -1.99, { r: 0.01 });
  }
  // Ambang pintu geser yang terbuka (sisi kiri).
  b.box('black', 0.02, 1.45, 0.72, 0.826, 1.12, 0.55, { r: 0 });
  // Papan trayek kecil di atas kaca depan.
  b.box('white', 0.62, 0.14, 0.04, 0, 2.02, 1.2, { r: 0.01 });
  b.box('black', 1.6, 0.14, 0.08, 0, 0.42, 2.0, { r: 0.03 });
  b.box('black', 1.6, 0.14, 0.08, 0, 0.42, -2.0, { r: 0.03 });
  plate(b, 'paintYellow', 0.55, 2.05, 1);
  plate(b, 'paintYellow', 0.55, -2.05, -1);
  mirrors(b, 0.81, 1.35, 1.55);
  for (const s of [-1, 1]) {
    wheel(b, s * 0.7, 1.2, 0.29, 0.18);
    wheel(b, s * 0.7, -1.3, 0.29, 0.18);
  }
}

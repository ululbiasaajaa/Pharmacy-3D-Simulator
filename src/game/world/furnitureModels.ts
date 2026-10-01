import * as THREE from 'three';
import { GeoBuilder } from '@/game/visual/geometry';
import type { MatKey } from './materials';
import type { ShelfLevel } from './ProductDisplay';

/**
 * Pustaka model perabot "stylized realistic" (ART_DIRECTION.md §4).
 * Setiap fungsi menambahkan bagian ke `GeoBuilder` dalam koordinat lokal model;
 * hasilnya digabung per material sehingga satu model hanya beberapa draw call.
 */
export type B = GeoBuilder<MatKey>;

export const newBuilder = () => new GeoBuilder<MatKey>();

// ------------------------------------------------------------------ Meja pelayanan & etalase

/** Meja pelayanan panjang (koordinat dunia): muka HPL kayu + pita teal, top solid surface, lis LED. */
export function counterModel(b: B) {
  const x0 = -6.5;
  const x1 = 6;
  const cx = (x0 + x1) / 2;
  const len = x1 - x0;
  b.box('white', len - 0.1, 0.9, 0.7, cx, 0.55, 1.98, { r: 0.01 });
  b.box('skirting', len - 0.1, 0.1, 0.66, cx, 0.05, 2.0, { r: 0.004 });
  b.box('ledStrip', len - 0.2, 0.012, 0.012, cx, 0.104, 2.37, { r: 0 });
  b.box('wood', len, 0.86, 0.04, cx, 0.54, 2.38, { r: 0.008 });
  b.box('counterBody', len + 0.004, 0.11, 0.046, cx, 0.86, 2.382, { r: 0.004 });
  b.box('counterTop', len + 0.2, 0.04, 0.92, cx, 1.02, 2.03, { r: 0.012 });
  for (let x = x0 + 0.36; x < x1 - 0.2; x += 0.62) {
    b.box('shelfWhite', 0.58, 0.72, 0.015, x, 0.5, 1.62, { r: 0.004 });
    b.box('aluminum', 0.12, 0.014, 0.02, x, 0.8, 1.605, { r: 0.004 });
  }
  // Sekat akrilik di loket pelayanan & kasir (celah bawah untuk serah-terima).
  for (const x of [-2, 3]) {
    b.box('glass', 1.1, 0.62, 0.008, x, 1.47, 2.3, { r: 0 });
    for (const s of [-1, 1]) b.box('aluminum', 0.03, 0.16, 0.14, x + s * 0.53, 1.12, 2.3, { r: 0.004 });
  }
}

/** Etalase kaca di kiri meja: dasar kayu, kaca berbingkai aluminium, rak kaca. */
export function displayCabinetModel(b: B): ShelfLevel[] {
  const cx = -9.25;
  const z = 2.0;
  const len = 5.4;
  b.box('wood', len, 0.36, 0.56, cx, 0.18, z, { r: 0.008 });
  b.box('shelfWhite', len - 0.02, 0.012, 0.54, cx, 0.366, z, { r: 0 });
  for (const x of [cx - len / 2 + 0.015, cx - len / 6, cx + len / 6, cx + len / 2 - 0.015]) {
    for (const s of [-1, 1]) b.box('aluminum', 0.025, 0.64, 0.025, x, 0.68, z + s * 0.27, { r: 0.004 });
  }
  for (const s of [-1, 1]) b.box('aluminum', len, 0.025, 0.025, cx, 0.995, z + s * 0.27, { r: 0.004 });
  b.box('glass', len, 0.008, 0.56, cx, 1.0, z, { r: 0 });
  b.box('glass', len, 0.62, 0.008, cx, 0.68, z + 0.275, { r: 0 });
  b.box('glass', len, 0.62, 0.008, cx, 0.68, z - 0.275, { r: 0 });
  b.box('glass', len - 0.06, 0.01, 0.5, cx, 0.665, z, { r: 0 });
  b.box('ledStrip', len - 0.12, 0.008, 0.016, cx, 0.988, z - 0.22, { r: 0 });
  return [
    { x0: cx - len / 2 + 0.08, x1: cx + len / 2 - 0.08, y: 0.372, zFront: z + 0.26, depth: 0.5, maxH: 0.27 },
    { x0: cx - len / 2 + 0.08, x1: cx + len / 2 - 0.08, y: 0.67, zFront: z + 0.26, depth: 0.48, maxH: 0.3 },
  ];
}

/** Perangkat meja pelayanan (lokal; staf di sisi -Z). */
export function serviceDeskModel(b: B) {
  // Monitor menghadap staf.
  b.cylinder('metalDark', 0.09, 0.1, 0.012, 0.35, 0.006, -0.18, { seg: 20 });
  b.box('metalDark', 0.04, 0.2, 0.025, 0.35, 0.11, -0.16, { r: 0.006 });
  b.box('black', 0.54, 0.33, 0.025, 0.35, 0.33, -0.15, { r: 0.008 });
  b.box('screenOn', 0.5, 0.29, 0.004, 0.35, 0.33, -0.164, { r: 0 });
  b.box('black', 0.44, 0.018, 0.14, 0.3, 0.009, -0.32, { r: 0.006 });
  b.box('black', 0.05, 0.02, 0.08, 0.6, 0.01, -0.33, { r: 0.012 });
  // Baki resep, printer etiket, cangkir pena.
  b.box('white', 0.34, 0.025, 0.26, -0.35, 0.013, 0.08, { r: 0.008 });
  b.box('paper', 0.21, 0.004, 0.29, -0.37, 0.03, 0.08, { rotY: 0.08, r: 0 });
  b.box('paper', 0.21, 0.004, 0.29, -0.33, 0.034, 0.07, { rotY: -0.05, r: 0 });
  b.box('white', 0.18, 0.13, 0.2, -0.32, 0.065, -0.25, { r: 0.02 });
  b.box('black', 0.12, 0.012, 0.03, -0.32, 0.12, -0.15, { r: 0 });
  b.cylinder('counterBody', 0.035, 0.032, 0.1, 0.0, 0.05, 0.02, { seg: 14 });
  b.cylinder('black', 0.004, 0.004, 0.15, -0.01, 0.12, 0.02, { seg: 6, rotZ: 0.15 });
  b.cylinder('counterBody', 0.004, 0.004, 0.15, 0.012, 0.12, 0.03, { seg: 6, rotZ: -0.1 });
}

/** Mesin kasir: terminal POS sentuh, layar pelanggan, printer struk, mesin EDC. */
export function registerModel(b: B) {
  b.box('black', 0.34, 0.06, 0.28, 0, 0.03, -0.1, { r: 0.012 });
  b.box('metalDark', 0.05, 0.18, 0.05, 0, 0.13, -0.12, { r: 0.008 });
  b.box('black', 0.4, 0.27, 0.03, 0, 0.3, -0.12, { rotX: -0.35, r: 0.01 });
  b.box('screenOn', 0.36, 0.23, 0.004, 0, 0.3, -0.14, { rotX: -0.35, r: 0 });
  // Layar pelanggan (menghadap +Z).
  b.box('black', 0.2, 0.13, 0.02, 0, 0.24, 0.0, { rotX: 0.2, r: 0.008 });
  b.box('screenOn', 0.17, 0.1, 0.004, 0, 0.24, 0.012, { rotX: 0.2, r: 0 });
  // Printer struk + kertas.
  b.box('white', 0.14, 0.12, 0.18, 0.3, 0.06, -0.12, { r: 0.02 });
  b.box('paper', 0.075, 0.004, 0.12, 0.3, 0.125, -0.05, { rotX: -0.3, r: 0 });
  // EDC (generik) di dudukan.
  b.box('black', 0.085, 0.03, 0.17, -0.3, 0.02, 0.1, { rotX: -0.15, r: 0.012 });
  b.box('screenOn', 0.06, 0.004, 0.05, -0.3, 0.038, 0.06, { rotX: -0.15, r: 0 });
  b.box('aluminum', 0.065, 0.004, 0.06, -0.3, 0.04, 0.13, { rotX: -0.15, r: 0 });
}

/** Meja loket 2 (perluasan). */
export function counter2Model(b: B) {
  b.box('black', 0.46, 0.3, 0.025, 0, 0.32, -0.14, { r: 0.008 });
  b.box('screenOn', 0.42, 0.26, 0.004, 0, 0.32, -0.154, { r: 0 });
  b.box('metalDark', 0.04, 0.17, 0.025, 0, 0.09, -0.15, { r: 0.006 });
  b.box('white', 0.3, 0.02, 0.22, -0.25, 0.01, 0.06, { r: 0.008 });
  b.box('paper', 0.2, 0.004, 0.28, -0.25, 0.024, 0.06, { r: 0 });
}

/** Tiang antre dengan sabuk (loket 2 belum dibuka). */
export function stanchionModel(b: B) {
  for (const x of [-0.75, 0.75]) {
    b.cylinder('chrome', 0.15, 0.17, 0.03, x, 0.015, 0, { seg: 20 });
    b.cylinder('chrome', 0.025, 0.025, 0.95, x, 0.49, 0, { seg: 12 });
    b.cylinder('chrome', 0.035, 0.035, 0.05, x, 0.97, 0, { seg: 12 });
  }
  b.box('barrier', 1.48, 0.05, 0.008, 0, 0.9, 0, { r: 0 });
}

/** Pintu ayun setengah (gerbang staf). */
export function staffGateModel(b: B) {
  b.cylinder('chrome', 0.025, 0.025, 1.0, 0, 0.5, 1.62, { seg: 12 });
  b.box('aluminum', 0.03, 0.9, 0.62, 0, 0.55, 2.0, { r: 0.006 });
  b.box('shelfWhite', 0.015, 0.7, 0.54, 0, 0.55, 2.0, { r: 0 });
}

// ------------------------------------------------------------------ Rak

export interface ShelfSpec {
  w: number;
  d: number;
  h: number;
  levels: number;
}

/** Gondola rak obat bebas (lokal; produk menghadap +Z). */
export function gondolaModel(b: B, s: ShelfSpec, doubleSided = false): ShelfLevel[] {
  const { w, d, h, levels } = s;
  const gap = (h - 0.2) / levels;
  const backZ = doubleSided ? 0 : -d / 2 + 0.02;
  b.box('skirting', w, 0.1, d - 0.02, 0, 0.05, 0, { r: 0.006 });
  b.box('pegboard', w - 0.04, h - 0.12, 0.02, 0, 0.1 + (h - 0.12) / 2, backZ, { r: 0 });
  for (const x of [-w / 2 + 0.02, w / 2 - 0.02]) b.box('metalDark', 0.04, h, d, x, h / 2, 0, { r: 0.006 });
  b.box('metalDark', w, 0.03, d, 0, h, 0, { r: 0.006 });
  const out: ShelfLevel[] = [];
  const sides = doubleSided ? [1, -1] : [1];
  for (const side of sides) {
    const zc = doubleSided ? side * (d / 4) : 0.01;
    const sd = doubleSided ? d / 2 - 0.03 : d - 0.06;
    for (let i = 0; i < levels; i++) {
      const y = 0.12 + i * gap;
      b.box('shelfWhite', w - 0.08, 0.025, sd, 0, y, zc, { r: 0.004 });
      const front = zc + (side * sd) / 2;
      b.box('paper', w - 0.08, 0.034, 0.006, 0, y - 0.004, front + side * 0.004, { r: 0 });
      b.box('counterBody', w - 0.08, 0.006, 0.007, 0, y - 0.018, front + side * 0.004, { r: 0 });
      if (side === 1) out.push({ x0: -w / 2 + 0.07, x1: w / 2 - 0.07, y: y + 0.0125, zFront: front - 0.01, depth: sd - 0.02, maxH: gap - 0.05 });
    }
  }
  return out;
}

/** Lemari obat resep: laci kecil di bawah, rak terbuka di atas (lokal; menghadap +Z). */
export function rxCabinetModel(b: B, w: number, d: number, h: number): ShelfLevel[] {
  const t = 0.025;
  for (const x of [-w / 2 + t / 2, w / 2 - t / 2]) b.box('wood', t, h, d, x, h / 2, 0, { r: 0.004 });
  b.box('wood', w, t, d, 0, h - t / 2, 0, { r: 0.004 });
  b.box('shelfWhite', w - 2 * t, h - 0.08, 0.012, 0, h / 2, -d / 2 + 0.01, { r: 0 });
  b.box('skirting', w - 2 * t, 0.08, d - 0.04, 0, 0.04, 0, { r: 0 });
  // Laci: 2 baris.
  const cols = Math.floor((w - 0.1) / 0.32);
  const dw = (w - 2 * t) / cols;
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < cols; c++) {
      const x = -w / 2 + t + dw * (c + 0.5);
      const y = 0.08 + 0.17 + r * 0.33;
      b.box('shelfWhite', dw - 0.012, 0.31, 0.02, x, y, d / 2 - 0.01, { r: 0.004 });
      b.box('aluminum', 0.07, 0.035, 0.006, x, y + 0.08, d / 2 + 0.002, { r: 0 });
      b.box('aluminum', 0.08, 0.014, 0.02, x, y - 0.04, d / 2 + 0.01, { r: 0.006 });
    }
  }
  b.box('wood', w - 2 * t, 0.03, d, 0, 0.78, 0, { r: 0.004 });
  const out: ShelfLevel[] = [{ x0: -w / 2 + 0.05, x1: w / 2 - 0.05, y: 0.795, zFront: d / 2 - 0.02, depth: d - 0.06, maxH: 0.3 }];
  for (const y of [1.12, 1.46, 1.8]) {
    b.box('shelfWhite', w - 2 * t, 0.022, d - 0.03, 0, y, 0.0, { r: 0.004 });
    b.box('paper', w - 2 * t, 0.03, 0.005, 0, y - 0.004, d / 2 - 0.012, { r: 0 });
    out.push({ x0: -w / 2 + 0.05, x1: w / 2 - 0.05, y: y + 0.011, zFront: d / 2 - 0.02, depth: d - 0.06, maxH: 0.3 });
  }
  return out;
}

/** Lemari pendingin farmasi (lokal; pintu kaca menghadap +Z). */
export function pharmaFridgeModel(b: B): ShelfLevel[] {
  const w = 0.95;
  const d = 0.65;
  const h = 1.9;
  const t = 0.05;
  for (const x of [-w / 2 + t / 2, w / 2 - t / 2]) b.box('white', t, h, d, x, h / 2, 0, { r: 0.01 });
  b.box('white', w, 0.22, d, 0, h - 0.11, 0, { r: 0.012 });
  b.box('white', w, 0.16, d, 0, 0.08, 0, { r: 0.01 });
  b.box('white', w - 2 * t, h - 0.38, 0.03, 0, h / 2, -d / 2 + 0.015, { r: 0 });
  // Ventilasi bawah.
  for (let i = 0; i < 4; i++) b.box('metalDark', w - 0.2, 0.012, 0.005, 0, 0.05 + i * 0.025, d / 2 + 0.002, { r: 0 });
  // Pintu: bingkai + gagang (kaca dirender oleh builder sebagai bagian transparan).
  b.box('aluminum', w - 0.02, 0.04, 0.04, 0, 0.18, d / 2, { r: 0.006 });
  b.box('aluminum', w - 0.02, 0.04, 0.04, 0, h - 0.24, d / 2, { r: 0.006 });
  for (const x of [-w / 2 + 0.03, w / 2 - 0.03]) b.box('aluminum', 0.04, h - 0.42, 0.04, x, h / 2 - 0.03, d / 2, { r: 0.006 });
  b.box('glass', w - 0.08, h - 0.46, 0.01, 0, h / 2 - 0.03, d / 2, { r: 0 });
  b.box('chrome', 0.025, 0.55, 0.03, w / 2 - 0.08, 1.05, d / 2 + 0.04, { r: 0.01 });
  // Panel kontrol + lampu dalam.
  b.box('black', 0.22, 0.07, 0.01, 0.2, h - 0.11, d / 2 + 0.002, { r: 0.004 });
  b.box('ledStrip', w - 0.14, 0.01, 0.02, 0, h - 0.25, d / 2 - 0.08, { r: 0 });
  const out: ShelfLevel[] = [];
  for (const y of [0.28, 0.66, 1.04, 1.42]) {
    for (let i = 0; i < 6; i++) b.box('chrome', 0.008, 0.008, d - 0.12, -w / 2 + 0.12 + i * ((w - 0.24) / 5), y, -0.02, { r: 0 });
    b.box('chrome', w - 0.12, 0.01, 0.01, 0, y, d / 2 - 0.09, { r: 0 });
    out.push({ x0: -w / 2 + 0.09, x1: w / 2 - 0.09, y: y + 0.006, zFront: d / 2 - 0.1, depth: d - 0.16, maxH: 0.3 });
  }
  return out;
}

/** Rak besi gudang (tiang biru, balok oranye, dek baja). */
export function steelRackModel(b: B, w: number, d: number, h: number, levels: number): ShelfLevel[] {
  const xs = [-w / 2 + 0.04, w / 2 - 0.04];
  if (w > 3) xs.push(0);
  for (const x of xs) for (const z of [-d / 2 + 0.04, d / 2 - 0.04]) b.box('rackBlue', 0.07, h, 0.06, x, h / 2, z, { r: 0.006 });
  const out: ShelfLevel[] = [];
  const gap = (h - 0.15) / levels;
  for (let i = 0; i < levels; i++) {
    const y = 0.12 + i * gap;
    for (const z of [-d / 2 + 0.04, d / 2 - 0.04]) b.box('rackOrange', w - 0.02, 0.08, 0.05, 0, y, z, { r: 0.006 });
    b.box('steel', w - 0.1, 0.012, d - 0.08, 0, y + 0.046, 0, { r: 0 });
    out.push({ x0: -w / 2 + 0.1, x1: w / 2 - 0.1, y: y + 0.052, zFront: d / 2 - 0.05, depth: d - 0.1, maxH: gap - 0.12 });
  }
  return out;
}

// ------------------------------------------------------------------ Area pelanggan

/** Kursi tunggu gandeng berangka krom (lokal; duduk menghadap +Z). */
export function gangChairModel(b: B, seats: number[]) {
  const xMin = seats[0] - 0.3;
  const xMax = seats[seats.length - 1] + 0.3;
  b.box('chrome', xMax - xMin, 0.05, 0.08, (xMin + xMax) / 2, 0.36, -0.05, { r: 0.02 });
  for (const lx of [xMin + 0.25, xMax - 0.25]) {
    b.box('chrome', 0.05, 0.36, 0.05, lx, 0.18, -0.05, { r: 0.012 });
    b.box('chrome', 0.06, 0.03, 0.56, lx, 0.015, -0.05, { r: 0.012 });
  }
  for (const x of seats) {
    b.box('seat', 0.5, 0.035, 0.46, x, 0.45, 0.02, { rotX: -0.06, r: 0.014 });
    b.box('seat', 0.5, 0.42, 0.03, x, 0.75, -0.22, { rotX: 0.2, r: 0.014 });
    b.box('chrome', 0.04, 0.1, 0.04, x, 0.41, -0.02, { r: 0.008 });
  }
  for (let i = 0; i <= seats.length; i++) {
    const ax = i === 0 ? seats[0] - 0.28 : i === seats.length ? seats[seats.length - 1] + 0.28 : (seats[i - 1] + seats[i]) / 2;
    b.box('chrome', 0.03, 0.2, 0.03, ax, 0.56, 0.0, { r: 0.008 });
    b.box('rubber', 0.055, 0.025, 0.3, ax, 0.67, 0.0, { r: 0.01 });
  }
}

/** Tanaman lidah mertua dalam pot keramik putih. */
export function plantModel(b: B, x: number, z: number, scale = 1, seed = 1) {
  b.lathe('porcelain', [[0, 0], [0.13 * scale, 0], [0.16 * scale, 0.04 * scale], [0.18 * scale, 0.4 * scale], [0.165 * scale, 0.41 * scale], [0, 0.41 * scale]], x, 0, z, { seg: 20 });
  b.cylinder('soil', 0.165 * scale, 0.165 * scale, 0.01, x, 0.39 * scale, z, { seg: 18 });
  let r = seed * 9301 + 49297;
  const rnd = () => {
    r = (r * 9301 + 49297) % 233280;
    return r / 233280;
  };
  for (let i = 0; i < 13; i++) {
    const a = (i / 13) * Math.PI * 2 + rnd() * 0.4;
    const rad = 0.03 + rnd() * 0.07;
    const hgt = (0.45 + rnd() * 0.45) * scale;
    const tilt = 0.08 + rnd() * 0.22;
    b.add(i % 3 === 0 ? 'plantLeafLight' : 'plantLeaf', leafGeometry(hgt), x + Math.cos(a) * rad * scale, 0.39 * scale, z + Math.sin(a) * rad * scale, { rotY: -a, rotZ: Math.cos(a) * tilt, rotX: Math.sin(a) * tilt });
  }
}

const leafCache = new Map<number, THREE.BufferGeometry>();
function leafGeometry(h: number) {
  const key = Math.round(h * 100);
  let g = leafCache.get(key);
  if (!g) {
    g = new THREE.CylinderGeometry(0.0, 0.032, h, 4, 1);
    g.scale(1, 1, 0.22);
    g.translate(0, h / 2, 0);
    leafCache.set(key, g);
  }
  return g;
}

/** AC split dinding (lokal; menghadap +Z). */
export function acUnitModel(b: B) {
  b.box('white', 1.05, 0.3, 0.24, 0, 0, 0, { r: 0.05 });
  b.box('metalDark', 0.95, 0.025, 0.02, 0, -0.1, 0.115, { r: 0.006 });
  b.box('screenOn', 0.06, 0.02, 0.005, 0.38, 0.06, 0.122, { r: 0 });
}

/** Papan gabus berbingkai dengan kertas & pin (lokal; menghadap +Z). */
export function corkBoardModel(b: B, w: number, h: number) {
  b.box('aluminum', w + 0.06, h + 0.06, 0.03, 0, 0, 0, { r: 0.008 });
  b.box('cork', w, h, 0.012, 0, 0, 0.016, { r: 0 });
  const papers: [number, number, number, number, number][] = [
    [-0.6, 0.12, 0.42, 0.55, 0.05],
    [0.0, 0.05, 0.42, 0.55, -0.04],
    [0.6, 0.1, 0.42, 0.55, 0.03],
    [-0.3, -0.38, 0.32, 0.22, -0.06],
    [0.42, -0.36, 0.3, 0.2, 0.08],
  ];
  for (const [x, y, pw, ph, rot] of papers) {
    b.box('paper', pw, ph, 0.003, x, y, 0.024, { rotZ: rot, r: 0 });
    b.sphere(['barrier', 'counterBody', 'rackBlue'][Math.abs(Math.round(x * 10)) % 3] as MatKey, 0.012, x, y + ph / 2 - 0.03, 0.03, { seg: 8 });
  }
}

/** Banner roll-up berdiri (lokal; menghadap +Z, alas di y = 0). */
export function rollUpBannerModel(b: B) {
  b.box('aluminum', 0.85, 0.05, 0.22, 0, 0.025, 0, { r: 0.02 });
  b.cylinder('aluminum', 0.008, 0.008, 2.0, 0, 1.03, -0.05, { seg: 8 });
  b.box('aluminum', 0.82, 0.02, 0.02, 0, 2.02, 0.0, { r: 0.006 });
}

// ------------------------------------------------------------------ Gudang, lab, kantor

/** Lemari besi dua pintu (lokal; menghadap +Z). */
export function steelCabinetModel(b: B, w = 2, h = 2, d = 0.65) {
  b.box('cabinet', w, h - 0.05, d, 0, (h + 0.05) / 2, 0, { r: 0.01 });
  b.box('skirting', w - 0.04, 0.05, d - 0.04, 0, 0.025, 0, { r: 0 });
  for (const s of [-1, 1]) {
    const x = (s * w) / 4;
    b.box('cabinet', w / 2 - 0.02, h - 0.12, 0.012, x, h / 2 + 0.02, d / 2 + 0.006, { r: 0.004 });
    for (let i = 0; i < 4; i++) b.box('metalDark', w / 2 - 0.3, 0.008, 0.004, x, h - 0.25 - i * 0.03, d / 2 + 0.013, { r: 0 });
    b.box('chrome', 0.02, 0.22, 0.03, -s * 0.06, 1.05, d / 2 + 0.025, { r: 0.008 });
  }
}

/** Meja racik stainless dengan kabinet bawah (lokal). */
export function labTableModel(b: B, w: number, d: number) {
  b.box('steel', w, 0.04, d, 0, 0.9, 0, { r: 0.012 });
  b.box('shelfWhite', w - 0.1, 0.78, d - 0.1, 0, 0.47, 0, { r: 0.008 });
  b.box('skirting', w - 0.14, 0.08, d - 0.14, 0, 0.04, 0, { r: 0 });
  const n = Math.max(2, Math.round(w / 0.6));
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + 0.05 + ((w - 0.1) / n) * (i + 0.5);
    for (const s of [-1, 1]) b.box('aluminum', 0.14, 0.014, 0.018, x, 0.78, s * (d / 2 - 0.04), { r: 0.006 });
  }
}

/** Timbangan analitik (lokal di atas meja). */
export function balanceModel(b: B, shield: boolean) {
  b.box('white', 0.24, 0.07, 0.32, 0, 0.035, 0, { r: 0.015 });
  b.box('screenOn', 0.12, 0.035, 0.004, 0, 0.04, 0.162, { r: 0 });
  b.cylinder('steel', 0.065, 0.065, 0.006, 0, 0.075, -0.02, { seg: 24 });
  if (shield) {
    b.box('white', 0.24, 0.03, 0.28, 0, 0.3, -0.02, { r: 0.008 });
    for (const x of [-0.115, 0.115]) b.box('glass', 0.006, 0.22, 0.26, x, 0.18, -0.02, { r: 0 });
    b.box('glass', 0.22, 0.22, 0.006, 0, 0.18, 0.11, { r: 0 });
    b.box('glass', 0.22, 0.22, 0.006, 0, 0.18, -0.15, { r: 0 });
  }
}

/** Mortir & stamper porselen + sudip (lokal). */
export function mortarModel(b: B) {
  b.lathe('porcelain', [[0, 0], [0.055, 0], [0.06, 0.01], [0.075, 0.03], [0.095, 0.08], [0.1, 0.09], [0.085, 0.09], [0.07, 0.05], [0.03, 0.03], [0, 0.03]], 0, 0, 0, { seg: 24 });
  b.lathe('porcelain', [[0, 0], [0.022, 0.005], [0.026, 0.03], [0.015, 0.08], [0.017, 0.18], [0.012, 0.2], [0, 0.205]], 0.04, 0.06, 0, { seg: 12, rotZ: -0.55 });
  b.box('steel', 0.18, 0.003, 0.022, 0.3, 0.003, 0.1, { rotY: 0.3, r: 0 });
  b.box('paper', 0.1, 0.002, 0.1, 0.2, 0.002, -0.08, { rotY: 0.6, r: 0 });
  b.box('paper', 0.1, 0.002, 0.1, 0.24, 0.004, -0.06, { rotY: 0.3, r: 0 });
}

/** Rak dinding toples bahan racik (lokal; menghadap +Z). */
export function ingredientShelfModel(b: B, w: number, levels: number[]): ShelfLevel[] {
  const d = 0.36;
  for (const x of [-w / 2 + 0.015, w / 2 - 0.015]) b.box('wood', 0.03, levels[levels.length - 1] + 0.35, d, x, (levels[levels.length - 1] + 0.35) / 2, 0, { r: 0.004 });
  b.box('shelfWhite', w - 0.03, levels[levels.length - 1] + 0.3, 0.012, 0, (levels[levels.length - 1] + 0.3) / 2, -d / 2 + 0.008, { r: 0 });
  return levels.map((y) => {
    b.box('wood', w - 0.03, 0.025, d, 0, y, 0, { r: 0.004 });
    b.box('paper', w - 0.03, 0.03, 0.005, 0, y - 0.004, d / 2 + 0.003, { r: 0 });
    return { x0: -w / 2 + 0.06, x1: w / 2 - 0.06, y: y + 0.0125, zFront: d / 2 - 0.02, depth: d - 0.04, maxH: 0.3 };
  });
}

/** Gelas ukur & beker hias (lokal). */
export function glasswareModel(b: B, x: number, y: number, z: number) {
  b.lathe('glass', [[0, 0], [0.04, 0], [0.042, 0.11], [0.046, 0.12]], x, y, z, { seg: 16 });
  b.lathe('glass', [[0, 0], [0.018, 0], [0.018, 0.22], [0.022, 0.23]], x + 0.12, y, z, { seg: 12 });
  b.cylinder('glass', 0.035, 0.035, 0.006, x + 0.12, y + 0.003, z, { seg: 14 });
}

/** Meja kerja kayu berkaki besi (lokal). */
export function deskModel(b: B, w: number, d: number, h = 0.75) {
  b.box('wood', w, 0.035, d, 0, h - 0.0175, 0, { r: 0.006 });
  for (const s of [-1, 1]) {
    b.box('metalDark', 0.05, h - 0.035, 0.05, s * (w / 2 - 0.06), (h - 0.035) / 2, d / 2 - 0.08, { r: 0.008 });
    b.box('metalDark', 0.05, h - 0.035, 0.05, s * (w / 2 - 0.06), (h - 0.035) / 2, -d / 2 + 0.08, { r: 0.008 });
    b.box('metalDark', 0.05, 0.04, d - 0.12, s * (w / 2 - 0.06), 0.05, 0, { r: 0.008 });
  }
  b.box('wood', w - 0.2, 0.4, 0.02, 0, h - 0.3, -d / 2 + 0.1, { r: 0.004 });
}

/** Monitor + keyboard + mouse (lokal di atas meja; layar menghadap +Z). */
export function workstationModel(b: B, x = 0, z = 0, rotY = 0) {
  b.group(x, 0, z, rotY, () => {
    b.box('metalDark', 0.2, 0.012, 0.16, 0, 0.006, -0.05, { r: 0.008 });
    b.box('metalDark', 0.04, 0.2, 0.025, 0, 0.11, -0.07, { r: 0.006 });
    b.box('black', 0.62, 0.38, 0.025, 0, 0.33, -0.05, { r: 0.008 });
    b.box('screenOn', 0.58, 0.34, 0.004, 0, 0.33, -0.036, { r: 0 });
    b.box('black', 0.44, 0.018, 0.14, 0, 0.009, 0.22, { r: 0.006 });
    b.box('black', 0.05, 0.02, 0.08, 0.32, 0.01, 0.22, { r: 0.012 });
  });
}

/** Kursi kantor beroda lima (lokal; duduk menghadap +Z). */
export function officeChairModel(b: B) {
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    b.box('black', 0.3, 0.03, 0.04, Math.cos(a) * 0.15, 0.06, Math.sin(a) * 0.15, { rotY: -a, r: 0.01 });
    b.sphere('rubber', 0.03, Math.cos(a) * 0.3, 0.03, Math.sin(a) * 0.3, { seg: 8 });
  }
  b.cylinder('chrome', 0.025, 0.025, 0.36, 0, 0.25, 0, { seg: 12 });
  b.box('black', 0.5, 0.07, 0.48, 0, 0.47, 0, { r: 0.03 });
  b.box('black', 0.46, 0.5, 0.05, 0, 0.8, -0.24, { rotX: 0.12, r: 0.03 });
  b.box('metalDark', 0.04, 0.3, 0.04, 0, 0.6, -0.24, { r: 0.01 });
}

/** Lemari arsip 4 laci (lokal; menghadap +Z). */
export function filingCabinetModel(b: B, w: number, h: number, d: number) {
  b.box('cabinet', w, h, d, 0, h / 2, 0, { r: 0.01 });
  const n = 4;
  for (let i = 0; i < n; i++) {
    const y = 0.06 + (h - 0.08) * ((i + 0.5) / n);
    b.box('cabinet', w - 0.04, (h - 0.1) / n - 0.02, 0.012, 0, y, d / 2 + 0.006, { r: 0.004 });
    b.box('chrome', 0.18, 0.02, 0.025, 0, y + 0.06, d / 2 + 0.02, { r: 0.008 });
    b.box('paper', 0.09, 0.04, 0.003, 0, y + 0.12, d / 2 + 0.014, { r: 0 });
  }
}

/** Loker pegawai berpintu teal (lokal; menghadap +Z). */
export function lockerModel(b: B, cols: number, w: number, h: number, d: number) {
  const cw = w / cols;
  for (let c = 0; c < cols; c++) {
    const x = -w / 2 + cw * (c + 0.5);
    b.box('cabinet', cw - 0.01, h, d, x, h / 2, 0, { r: 0.008 });
    b.box('seat', cw - 0.05, h - 0.12, 0.012, x, h / 2, d / 2 + 0.006, { r: 0.004 });
    for (let i = 0; i < 4; i++) b.box('metalDark', cw - 0.2, 0.008, 0.004, x, h - 0.2 - i * 0.03, d / 2 + 0.013, { r: 0 });
    b.box('chrome', 0.02, 0.12, 0.03, x + cw / 2 - 0.08, h / 2, d / 2 + 0.02, { r: 0.008 });
    b.box('paper', 0.07, 0.04, 0.003, x, h - 0.32, d / 2 + 0.014, { r: 0 });
  }
}

/** Sofa ruang istirahat (lokal; duduk menghadap +Z). */
export function sofaModel(b: B, w: number) {
  b.box('seat', w, 0.42, 0.85, 0, 0.21, 0, { r: 0.06 });
  b.box('seat', w, 0.55, 0.22, 0, 0.6, -0.32, { r: 0.08 });
  for (const s of [-1, 1]) b.box('seat', 0.2, 0.62, 0.85, s * (w / 2 - 0.1), 0.31, 0, { r: 0.06 });
  for (let i = 0; i < 3; i++) b.box('fabric', w / 3 - 0.12, 0.12, 0.6, -w / 3 + (w / 3) * i, 0.47, 0.08, { r: 0.05 });
}

/** Mesin kopi di atas kabinet (lokal; menghadap +Z). */
export function coffeeStationModel(b: B) {
  b.box('woodDark', 1.0, 0.9, 0.6, 0, 0.45, 0, { r: 0.01 });
  b.box('counterTop', 1.04, 0.03, 0.64, 0, 0.915, 0, { r: 0.008 });
  b.box('black', 0.32, 0.42, 0.34, 0, 1.14, -0.05, { r: 0.03 });
  b.box('chrome', 0.18, 0.04, 0.12, 0, 1.08, 0.13, { r: 0.01 });
  b.lathe('porcelain', [[0, 0], [0.035, 0], [0.04, 0.08], [0.037, 0.085]], 0.3, 0.93, 0.05, { seg: 14 });
}

/** Meja teh kecil dengan dua cangkir (lokal). */
export function teaTableModel(b: B) {
  b.box('wood', 1.2, 0.04, 0.7, 0, 0.42, 0, { r: 0.01 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box('metalDark', 0.04, 0.4, 0.04, sx * 0.54, 0.2, sz * 0.29, { r: 0.008 });
  for (const x of [-0.25, 0.2]) b.lathe('porcelain', [[0, 0], [0.035, 0], [0.04, 0.08], [0.037, 0.085]], x, 0.44, 0.05, { seg: 14 });
}

/** Palet kayu (lokal). */
export function palletModel(b: B, w: number, d: number) {
  for (const z of [-d / 2 + 0.05, 0, d / 2 - 0.05]) b.box('wood', w, 0.06, 0.09, 0, 0.03, z, { r: 0.004 });
  for (let i = 0; i < 6; i++) b.box('wood', w / 6 - 0.03, 0.02, d, -w / 2 + (w / 6) * (i + 0.5), 0.07, 0, { r: 0.002 });
}


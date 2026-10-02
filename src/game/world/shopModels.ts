import * as THREE from 'three';
import { floorQuad, type GeoBuilder } from '@/game/visual/geometry';
import type { MatKey } from './materials';
import { SHOPS, STREET, isOpenShop, type Shop } from './district';
import { scooterModel } from './streetModels';
import { wheelGeometries, type WheelGeometries } from './wheelModels';

/**
 * Ruko kawasan (fase konsistensi visual): tiap ruko dibangun dari ARKETIPE fasad yang berbeda bentuk, bukan satu
 * model berganti warna —
 * - modern: kanopi beton berpapan nama, alur plester, jendela pita berbingkai aluminium, sirip peneduh, etalase kaca
 *   tertutup pintu harmonika;
 * - klasik (ruko 80–90-an): pintu lipat kayu, roster, jendela nako berbingkai lis, balkon besi, keramik pilar, atap
 *   pelana berlisplang;
 * - bata: bata ekspos lantai atas, pilar batu alam, kanopi kain bergaris;
 * - warung/rumah makan: terpal bertulisan, etalase lauk bertingkat;
 * - bengkel & toko bangunan: kanopi seng gelombang bertopang, barang khas.
 * Isi kios memakai atlas kemasan/kain/poster/lauk FIKTIF (material `goodsAtlas`), bukan balok warna polos.
 * Semua statis → digabung per material ke mesh kawasan (Exterior.tsx).
 */
type B = GeoBuilder<MatKey>;

export const KIOSK_DEPTH = 2.6;
/** Tinggi bangunan dari jumlah lantai (lantai dasar 3,6 m, lantai atas 3,2 m). */
export const shopHeight = (s: Shop) => 3.6 + (s.floors - 1) * 3.2;

// ------------------------------------------------------------------ Atlas barang (kanvas)

const CELLS = 8;
/** Baris atlas: 0–2 kemasan, 3 renteng sachet, 4 kain, 5 poster, 6 lauk, 7 lain-lain. */
export const ATLAS = { pack: 0, sachet: 24, fabric: 32, poster: 40, food: 48, misc: 56 };

const PACK_WORDS = ['MIE GORENG', 'KOPI SUSU', 'BISKUIT', 'SABUN', 'DETERJEN', 'TEH', 'KECAP', 'SUSU', 'MINYAK', 'GULA', 'SNACK', 'SIRUP', 'SAMPO', 'TISU', 'AIR', 'SARDEN', 'KERUPUK', 'MENTEGA', 'GARAM', 'ROTI', 'SELAI', 'WAFER', 'COKELAT', 'SEREAL'];
const POSTERS: [string, string, string][] = [
  ['PULSA', '#d62828', '#ffffff'],
  ['KUOTA', '#f4a100', '#1f2937'],
  ['PROMO', '#1d4ed8', '#ffffff'],
  ['PRINT', '#0f766e', '#ffffff'],
  ['DISKON', '#be123c', '#fde047'],
  ['BARU!', '#16a34a', '#ffffff'],
  ['SPANDUK', '#7c3aed', '#ffffff'],
  ['STIKER', '#ea580c', '#ffffff'],
];
const FOODS: [string, string][] = [
  ['#5a2e1a', '#3b1d10'],
  ['#e0a43a', '#c2781f'],
  ['#4f7f2a', '#2f5a18'],
  ['#c98b4e', '#a06a35'],
  ['#d2b48c', '#8f6b45'],
  ['#c0281f', '#8e140f'],
  ['#f3e7c9', '#e2b13c'],
  ['#b5793e', '#7e4f22'],
];

/** Atlas 1024² digambar sekali: kemasan generik (kata kategori, bukan merek), renteng, kain/batik, poster, lauk. */
export function goodsAtlasTexture(): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const S = 1024;
  const C = S / CELLS;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const hues = ['#d62828', '#f4a100', '#1d4ed8', '#16a34a', '#7c3aed', '#ea580c', '#0e7490', '#be185d', '#f5f5f4', '#facc15', '#0f172a', '#65a30d'];
  const cell = (n: number) => [(n % CELLS) * C, Math.floor(n / CELLS) * C] as const;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Kemasan.
  for (let n = 0; n < 24; n++) {
    const [x, y] = cell(n);
    const bg = hues[n % hues.length];
    const band = hues[(n * 5 + 3) % hues.length];
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, C, C);
    ctx.fillStyle = band;
    ctx.fillRect(x, y + C * (0.55 + rnd() * 0.1), C, C * 0.22);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(x + C * 0.5, y + C * 0.3, C * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = bg === '#f5f5f4' || bg === '#facc15' ? '#111827' : '#ffffff';
    ctx.font = `800 ${Math.round(C * 0.13)}px "Segoe UI", system-ui, sans-serif`;
    ctx.fillText(PACK_WORDS[n], x + C / 2, y + C * 0.66, C * 0.92);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x, y + C - 6, C, 6);
  }
  // Renteng sachet: deretan kemasan kecil vertikal.
  for (let n = 0; n < 8; n++) {
    const [x, y] = cell(ATLAS.sachet + n);
    for (let k = 0; k < 4; k++) {
      ctx.fillStyle = hues[(n * 3 + k) % hues.length];
      ctx.fillRect(x + 6, y + k * (C / 4) + 2, C - 12, C / 4 - 4);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillRect(x + C * 0.25, y + k * (C / 4) + C / 12, C * 0.5, C / 14);
    }
  }
  // Kain: batik parang/kawung sederhana, garis, polos.
  for (let n = 0; n < 8; n++) {
    const [x, y] = cell(ATLAS.fabric + n);
    const base = ['#7c2d12', '#1e3a8a', '#065f46', '#f5f5f4', '#be185d', '#78350f', '#334155', '#ca8a04'][n];
    ctx.fillStyle = base;
    ctx.fillRect(x, y, C, C);
    ctx.strokeStyle = n % 2 ? 'rgba(255,240,200,0.7)' : 'rgba(250,204,21,0.75)';
    ctx.lineWidth = 3;
    if (n < 3) {
      for (let k = -C; k < C * 2; k += 18) {
        ctx.beginPath();
        ctx.moveTo(x + k, y);
        ctx.lineTo(x + k + C, y + C);
        ctx.stroke();
      }
      for (let a = 0; a < 4; a++)
        for (let bb = 0; bb < 4; bb++) {
          ctx.beginPath();
          ctx.arc(x + 16 + a * 32, y + 16 + bb * 32, 7, 0, Math.PI * 2);
          ctx.stroke();
        }
    } else if (n < 6) {
      for (let k = 0; k < C; k += 16) {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(x, y + k, C, 6);
      }
    }
  }
  // Poster promo generik.
  for (let n = 0; n < 8; n++) {
    const [x, y] = cell(ATLAS.poster + n);
    const [word, bg, fg] = POSTERS[n];
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, C, C);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.arc(x + C * 0.8, y + C * 0.2, C * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.font = `900 ${Math.round(C * 0.22)}px "Segoe UI", system-ui, sans-serif`;
    ctx.fillText(word, x + C / 2, y + C * 0.45, C * 0.9);
    ctx.font = `600 ${Math.round(C * 0.09)}px "Segoe UI", system-ui, sans-serif`;
    ctx.fillText('MURAH · CEPAT', x + C / 2, y + C * 0.72, C * 0.9);
  }
  // Lauk (tekstur kasar dua warna).
  for (let n = 0; n < 8; n++) {
    const [x, y] = cell(ATLAS.food + n);
    const [a, b2] = FOODS[n];
    ctx.fillStyle = a;
    ctx.fillRect(x, y, C, C);
    for (let k = 0; k < 140; k++) {
      ctx.fillStyle = rnd() < 0.5 ? b2 : 'rgba(255,255,255,0.12)';
      ctx.beginPath();
      ctx.arc(x + rnd() * C, y + rnd() * C, 2 + rnd() * 7, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Lain-lain: karung semen, karung beras, rim kertas, label galon, papan alat (pegboard), kardus.
  const misc: [string, string, string][] = [
    ['SEMEN 40 KG', '#9ca3af', '#1f2937'],
    ['BERAS 5 KG', '#f5f5f4', '#166534'],
    ['HVS A4', '#f8fafc', '#1d4ed8'],
    ['AIR MINERAL', '#bfdbfe', '#1e3a8a'],
    ['CAT TEMBOK', '#fef3c7', '#b45309'],
    ['OLI MESIN', '#facc15', '#111827'],
    ['KARDUS', '#c69c6d', '#5b3b1a'],
    ['KUE KERING', '#fde68a', '#9a3412'],
  ];
  misc.forEach(([word, bg, fg], n) => {
    const [x, y] = cell(ATLAS.misc + n);
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, C, C);
    ctx.fillStyle = fg;
    ctx.fillRect(x, y + C * 0.18, C, C * 0.08);
    ctx.font = `800 ${Math.round(C * 0.13)}px "Segoe UI", system-ui, sans-serif`;
    ctx.fillText(word, x + C / 2, y + C * 0.52, C * 0.92);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Peta UV kotak (tiap muka 0..1) ke sel atlas `n` dengan sedikit margin. */
function atlasUV(g: THREE.BufferGeometry, n: number) {
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  const u0 = (n % CELLS) / CELLS;
  const v0 = 1 - (Math.floor(n / CELLS) + 1) / CELLS;
  const m = 0.04 / CELLS;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + m + uv.getX(i) * (1 / CELLS - 2 * m), v0 + m + uv.getY(i) * (1 / CELLS - 2 * m));
  return g;
}

function goodsBox(b: B, n: number, w: number, h: number, d: number, x: number, y: number, z: number, rotY = 0) {
  b.add('goodsAtlas', atlasUV(new THREE.BoxGeometry(w, h, d), n), x, y, z, { rotY });
}

/** Kemeja/blus tergantung menghadap jalan: badan + dua lengan miring (motif dari atlas kain) + gantungan. */
function shirt(b: B, n: number, x: number, railY: number, z: number, f: 1 | -1, tilt: number) {
  const rotY = f > 0 ? 0 : Math.PI;
  b.add('goodsAtlas', atlasUV(new THREE.BoxGeometry(0.4, 0.62, 0.05), n), x, railY - 0.42, z, { rotY, rotZ: tilt });
  for (const s of [-1, 1]) b.add('goodsAtlas', atlasUV(new THREE.BoxGeometry(0.13, 0.3, 0.045), n), x + s * 0.23, railY - 0.27, z, { rotY, rotZ: s * 0.55 + tilt });
  b.box('chrome', 0.3, 0.012, 0.012, x, railY - 0.1, z, { r: 0, rotZ: tilt });
  b.box('chrome', 0.012, 0.09, 0.012, x, railY - 0.05, z, { r: 0 });
}

let stackTireGeo: WheelGeometries | null = null;
function stackTire() {
  if (!stackTireGeo) stackTireGeo = wheelGeometries(0.29, 0.2, 0.62, 5, 0.35);
  return stackTireGeo;
}

function goodsCyl(b: B, n: number, r: number, h: number, x: number, y: number, z: number) {
  b.add('goodsAtlas', atlasUV(new THREE.CylinderGeometry(r, r, h, 14), n), x, y, z);
}

// ------------------------------------------------------------------ Konteks ruko

interface Ctx {
  b: B;
  s: Shop;
  i: number;
  /** 1 = ruko latar (jauh, di luar gerbang): detail kecil (kisi, roster berlubang, bilah nako, jeruji) disederhanakan. */
  lod: 0 | 1;
  w: number;
  cx: number;
  f: 1 | -1;
  zF: number;
  H: number;
  open: boolean;
  openW: number;
}

/** z di depan (d > 0) / di dalam (d < 0) muka ruko. */
const out = (c: Ctx, d: number) => c.zF + c.f * d;

// ------------------------------------------------------------------ Lantai dasar

/** Interior ceruk kios: lantai keramik, dinding, plafon berlampu. */
function kioskShell(c: Ctx) {
  const { b, cx, openW } = c;
  const zBack = out(c, -KIOSK_DEPTH);
  const zMid = out(c, -KIOSK_DEPTH / 2);
  b.add('terrace', floorQuad(cx - openW / 2, cx + openW / 2, Math.min(c.zF, zBack), Math.max(c.zF, zBack), 0.012));
  b.box('kioskWall', openW, 3.4, 0.1, cx, 1.7, zBack + c.f * 0.05, { r: 0 });
  for (const sx of [-1, 1]) b.box('kioskWall', 0.1, 3.4, KIOSK_DEPTH, cx + sx * (openW / 2 - 0.05), 1.7, zMid, { r: 0 });
  b.box('kioskWall', openW, 0.08, KIOSK_DEPTH, cx, 3.42, zMid, { r: 0 });
  for (const sx of [-0.25, 0.25]) b.box('kioskLight', 1.1, 0.03, 0.22, cx + sx * openW, 3.37, zMid, { r: 0 });
}

/** Rak dinding belakang berisi kemasan dari atlas (`cells` = rentang sel yang dipakai). */
function packShelves(c: Ctx, cells: [number, number], levels = 4, x0?: number, x1?: number) {
  const { b, cx, openW, f } = c;
  const a = x0 ?? cx - openW / 2 + 0.25;
  const z = out(c, -KIOSK_DEPTH + 0.3);
  const width = (x1 ?? cx + openW / 2 - 0.25) - a;
  let k = 0;
  for (let lv = 0; lv < levels; lv++) {
    const y = 0.5 + lv * 0.6;
    b.box('woodDark', width, 0.03, 0.42, a + width / 2, y, z, { r: 0 });
    for (const sx of [0.02, width - 0.02]) b.box('metalDark', 0.025, 0.12, 0.38, a + sx, y - 0.06, z, { r: 0 });
    for (let x = a + 0.12; x < a + width - 0.12; ) {
      const bw = 0.16 + ((k * 7) % 4) * 0.03;
      const bh = 0.2 + ((k * 3 + lv) % 5) * 0.04;
      goodsBox(b, cells[0] + (k % (cells[1] - cells[0])), bw, bh, 0.2, x + bw / 2, y + 0.015 + bh / 2, z + f * 0.06);
      x += bw + 0.02;
      k++;
    }
  }
}

/** Meja kios di garis muka: badan kayu, top, stiker promo di panel depan. */
function counter(c: Ctx, poster = -1, top: MatKey = 'counterTop') {
  const { b, cx, openW } = c;
  const z = out(c, -0.3);
  b.box('woodDark', openW - 0.2, 1.0, 0.55, cx, 0.5, z, { r: 0.01 });
  b.box(top, openW - 0.1, 0.04, 0.62, cx, 1.02, z, { r: 0.008 });
  if (poster >= 0) goodsBox(b, poster, 0.55, 0.42, 0.01, cx - openW / 4, 0.55, out(c, -0.02), c.f > 0 ? 0 : Math.PI);
}

/** Isi kios menurut toko (dibaca dari luar dan tetap dilayani dari depan meja). */
function kioskContents(c: Ctx) {
  const { b, s, cx, openW, f } = c;
  const zMid = out(c, -1.35);
  const zBack = out(c, -KIOSK_DEPTH);
  const left = cx - openW / 2;
  const right = cx + openW / 2;
  const topY = 1.04;
  switch (s.id) {
    case 'S1': {
      // Kelontong: rak sembako, renteng sachet, galon air, tabung gas 3 kg, etalase kecil.
      packShelves(c, [0, 24]);
      counter(c, ATLAS.poster + 4);
      for (let k = 0; k < 8; k++) goodsBox(b, ATLAS.sachet + (k % 8), 0.12, 0.85, 0.01, left + 0.6 + k * ((openW - 1.2) / 7), 2.45, out(c, -0.7));
      b.box('metalDark', openW - 1.0, 0.02, 0.02, cx, 2.88, out(c, -0.7), { r: 0 });
      for (let k = 0; k < 3; k++) {
        const x = right - 0.35 - (k % 2) * 0.34;
        const z = zMid - f * (k === 2 ? 0.34 : 0);
        b.cylinder('awningGreen', 0.15, 0.15, 0.34, x, 0.2, z, { seg: 14 });
        b.cylinder('metalDark', 0.05, 0.05, 0.08, x, 0.41, z, { seg: 8 });
      }
      for (let k = 0; k < 3; k++) {
        goodsCyl(b, ATLAS.misc + 3, 0.14, 0.38, left + 0.35 + k * 0.32, 0.19, zMid);
        b.cylinder('awningBlue', 0.05, 0.05, 0.06, left + 0.35 + k * 0.32, 0.41, zMid, { seg: 8 });
      }
      b.box('glass', 0.9, 0.32, 0.45, cx + 0.6, topY + 0.16, out(c, -0.3), { r: 0 });
      for (let k = 0; k < 6; k++) goodsBox(b, k * 3, 0.12, 0.16, 0.08, cx + 0.25 + k * 0.14, topY + 0.09, out(c, -0.3));
      break;
    }
    case 'S3': {
      // Fotokopi & ATK: mesin fotokopi berbaki kertas, rak ATK & rim kertas, poster layanan.
      packShelves(c, [ATLAS.misc + 2, ATLAS.misc + 3], 3, left + 0.25, cx + 0.3);
      counter(c, ATLAS.poster + 3);
      const x = right - 0.75;
      b.box('plasticWhite', 0.92, 0.95, 0.66, x, 0.475, zMid, { r: 0.02 });
      b.box('metalDark', 0.88, 0.06, 0.6, x, 0.98, zMid, { r: 0.01 });
      b.box('carGlass', 0.6, 0.012, 0.4, x, 0.955, zMid, { r: 0 });
      b.box('black', 0.3, 0.05, 0.14, x + 0.24, 1.02, zMid + f * 0.22, { r: 0, rotX: -f * 0.3 });
      b.box('screenOn', 0.12, 0.08, 0.01, x + 0.24, 1.05, zMid + f * 0.29, { r: 0, rotX: -f * 0.3 });
      for (const y of [0.25, 0.45]) b.box('plasticWhite', 0.5, 0.05, 0.36, x - 0.62, y, zMid, { r: 0.01 });
      for (let k = 0; k < 4; k++) goodsBox(b, ATLAS.misc + 2, 0.3, 0.06, 0.21, left + 0.6 + (k % 2) * 0.34, topY + 0.03 + Math.floor(k / 2) * 0.06, out(c, -0.3));
      goodsBox(b, ATLAS.poster + 3, 0.9, 0.9, 0.01, x, 2.6, zBack + f * 0.06, f > 0 ? 0 : Math.PI);
      break;
    }
    case 'S4': {
      // Konter pulsa: etalase kaca berisi ponsel, dinding aksesori & poster pulsa/kuota.
      counter(c, ATLAS.poster);
      b.box('glass', 1.5, 0.34, 0.44, cx - 0.8, topY + 0.17, out(c, -0.3), { r: 0 });
      for (let k = 0; k < 8; k++) b.box('black', 0.07, 0.14, 0.012, cx - 1.42 + k * 0.17, topY + 0.11, out(c, -0.3), { r: 0, rotX: -f * 0.35 });
      for (let k = 0; k < 8; k++) b.box('screenOn', 0.055, 0.1, 0.004, cx - 1.42 + k * 0.17, topY + 0.115, out(c, -0.3 + 0.008), { r: 0, rotX: -f * 0.35 });
      b.box('pegboard', openW - 0.5, 1.3, 0.04, cx, 1.95, zBack + f * 0.08, { r: 0 });
      for (let k = 0; k < 14; k++) goodsBox(b, (k * 5) % 24, 0.14, 0.2, 0.03, left + 0.5 + (k % 7) * ((openW - 1) / 6), 1.7 + Math.floor(k / 7) * 0.42, zBack + f * 0.12);
      for (const [k, x] of [-1.05, 0, 1.05].entries()) goodsBox(b, ATLAS.poster + [0, 1, 5][k], 0.9, 0.6, 0.01, cx + x, 3.0, zBack + f * 0.11, f > 0 ? 0 : Math.PI);
      break;
    }
    case 'S5': {
      // Toko bangunan: karung semen bertumpuk, kaleng cat, pipa PVC, papan alat, kardus.
      counter(c, ATLAS.misc + 4);
      for (let k = 0; k < 6; k++) goodsBox(b, ATLAS.misc, 0.62, 0.16, 0.42, left + 0.55, 0.08 + k * 0.16, zMid + f * 0.15, k % 2 ? 0.08 : -0.05);
      for (let k = 0; k < 8; k++) goodsCyl(b, ATLAS.misc + 4, 0.11, 0.2, left + 1.25 + (k % 4) * 0.25, 0.1 + Math.floor(k / 4) * 0.21, zMid + f * 0.1);
      for (let k = 0; k < 6; k++) b.cylinder('plasticWhite', 0.04, 0.04, 2.6, right - 0.2 - k * 0.09, 1.3, zMid - f * 0.2, { rotZ: 0.12, seg: 8 });
      b.box('pegboard', openW - 1.4, 1.2, 0.04, cx - 0.3, 2.1, zBack + f * 0.08, { r: 0 });
      for (let k = 0; k < 10; k++) b.box(k % 2 ? 'metalDark' : 'awningRed', 0.05, 0.28, 0.03, cx - 1.6 + k * 0.36, 2.1 + ((k * 3) % 3) * 0.1, zBack + f * 0.13, { r: 0.01 });
      break;
    }
    case 'F1': {
      // Toko roti: roti di rak kayu, etalase kaca roti & kue kering di meja.
      for (let lv = 0; lv < 3; lv++) {
        b.box('wood', openW - 0.5, 0.03, 0.42, cx, 0.6 + lv * 0.62, zBack + f * 0.3, { r: 0 });
        for (let k = 0; k < 12; k++) b.sphere('cardboard', 0.09, left + 0.5 + k * ((openW - 1.0) / 11), 0.68 + lv * 0.62, zBack + f * 0.3, { sx: 1.4, sy: 0.75, sz: 1, seg: 8 });
      }
      counter(c, ATLAS.poster + 5, 'wood');
      b.box('glass', openW - 1.2, 0.4, 0.45, cx, topY + 0.2, out(c, -0.3), { r: 0 });
      for (let k = 0; k < 10; k++) b.sphere('cardboard', 0.07, cx - (openW - 1.6) / 2 + k * ((openW - 1.6) / 9), topY + 0.07, out(c, -0.3), { sx: 1.5, sy: 0.8, seg: 8 });
      for (let k = 0; k < 5; k++) goodsBox(b, ATLAS.misc + 7, 0.16, 0.1, 0.16, cx - 0.5 + k * 0.25, topY + 0.25, out(c, -0.3));
      break;
    }
    case 'F6': {
      // Percetakan: printer format besar, gulungan bahan, contoh spanduk & stiker di dinding.
      counter(c, ATLAS.poster + 6);
      b.box('plasticWhite', 1.9, 0.5, 0.62, cx - 0.4, 0.95, zMid, { r: 0.02 });
      for (const sx of [-0.8, 0.8]) b.box('metalDark', 0.06, 0.7, 0.5, cx - 0.4 + sx, 0.35, zMid, { r: 0 });
      b.box('black', 1.7, 0.06, 0.1, cx - 0.4, 1.0, zMid + f * 0.32, { r: 0 });
      for (let k = 0; k < 4; k++) b.cylinder('white', 0.08, 0.08, 1.1, right - 0.3, 0.55 + k * 0.17, zMid - f * 0.25, { rotZ: Math.PI / 2 - 0.2, seg: 10 });
      for (const [k, x] of [-1.3, 0, 1.3].entries()) goodsBox(b, ATLAS.poster + [6, 7, 2][k], 1.1, 0.75, 0.01, cx + x, 2.55, zBack + f * 0.11, f > 0 ? 0 : Math.PI);
      break;
    }
    case 'F7': {
      // Toko pakaian: rel gantungan berisi baju (motif batik/garis/polos), tumpukan kain terlipat, cermin.
      counter(c, ATLAS.poster + 4);
      for (const [r, z] of [zMid + f * 0.35, zBack + f * 0.45].entries()) {
        b.cylinder('chrome', 0.015, 0.015, openW - 0.8, cx, 2.05, z, { rotZ: Math.PI / 2, seg: 8 });
        for (let k = 0; k < 9; k++) shirt(b, ATLAS.fabric + ((k * 3 + r) % 8), left + 0.65 + k * ((openW - 1.3) / 8), 2.05, z + f * (k % 2) * 0.06, f, ((k * 37) % 7) * 0.03 - 0.09);
      }
      for (let k = 0; k < 4; k++) for (let t = 0; t < 4; t++) goodsBox(b, ATLAS.fabric + ((k + t) % 8), 0.38, 0.05, 0.3, left + 0.45 + k * 0.42, topY + 0.03 + t * 0.05, out(c, -0.3));
      b.box('carGlass', 0.6, 1.5, 0.02, right - 0.5, 1.3, zBack + f * 0.07, { r: 0 });
      break;
    }
    default:
      packShelves(c, [0, 24]);
      counter(c);
  }
}

/** Etalase lauk bertingkat (rumah makan Padang / warung makan) di garis muka. */
function foodDisplay(c: Ctx, padang: boolean) {
  const { b, cx, openW, f } = c;
  const z = out(c, -0.4);
  b.box('white', openW - 0.2, 0.75, 0.7, cx, 0.375, z, { r: 0.01 });
  b.box('aluminum', openW - 0.18, 0.03, 0.72, cx, 0.77, z, { r: 0 });
  b.box('glass', openW - 0.2, 0.7, 0.66, cx, 1.12, z, { r: 0 });
  b.box('aluminum', openW - 0.18, 0.03, 0.68, cx, 1.47, z, { r: 0 });
  const n = Math.floor((openW - 0.5) / 0.3);
  // Piring bertumpuk (Padang: tersusun bertingkat di kaca depan).
  for (let k = 0; k < n; k++) {
    const x = cx - ((n - 1) * 0.3) / 2 + k * 0.3;
    // Padang: piring disusun bertingkat seperti piramida di balik kaca (tingkat atas lebih ke belakang).
    const center = Math.abs(k - (n - 1) / 2) / ((n - 1) / 2 || 1);
    const tiers = padang ? 1 + Math.round((1 - center) * 3) : 1;
    for (let t = 0; t < tiers; t++) {
      const y = 0.81 + t * 0.085;
      const pz = z + f * (0.14 - t * 0.09);
      b.cylinder('white', 0.12, 0.1, 0.025, x, y, pz, { seg: 10 });
      b.add('goodsAtlas', atlasUV(new THREE.SphereGeometry(0.09, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.45, 1), ATLAS.food + ((k + t * 3) % 8)), x, y + 0.012, pz);
    }
  }
  // Wadah nasi & termos, piring makan di belakang.
  const back = out(c, -KIOSK_DEPTH + 0.35);
  b.box('woodDark', openW - 0.6, 0.85, 0.5, cx, 0.425, back, { r: 0.01 });
  b.cylinder('steel', 0.2, 0.2, 0.3, cx - openW / 4, 1.0, back, { seg: 16 });
  b.cylinder('awningRed', 0.12, 0.12, 0.32, cx + openW / 4, 1.01, back, { seg: 12 });
  for (let k = 0; k < 6; k++) b.cylinder('white', 0.11, 0.1, 0.02, cx - 0.3 + (k % 3) * 0.24, 0.87 + Math.floor(k / 3) * 0.022, back, { seg: 14 });
  // Toples kerupuk di meja.
  for (let k = 0; k < 3; k++) b.cylinder('glass', 0.11, 0.11, 0.3, cx + openW / 2 - 0.4 - k * 0.26, 1.64, z, { seg: 12 });
}

/** Bengkel: tumpukan ban pembatas, motor diservis, lemari alat, drum oli, kompresor. */
function workshop(c: Ctx) {
  const { b, cx, openW, f } = c;
  const zMid = out(c, -1.35);
  const zBack = out(c, -KIOSK_DEPTH);
  const n = Math.floor((openW - 0.4) / 0.62);
  const tire = stackTire();
  for (let k = 0; k < n; k++) for (let t = 0; t < 3; t++) b.add('tireRubber', tire.tire, cx - openW / 2 + 0.5 + k * 0.62, 0.1 + t * 0.2, out(c, -0.3), { rotZ: Math.PI / 2, rotY: k * 0.7 });
  scooterModel(b, cx - 0.4, zMid - f * 0.15, Math.PI / 2, 'bikeBlue');
  b.box('awningRed', 1.0, 1.4, 0.5, cx + openW / 2 - 0.75, 0.7, zBack + f * 0.32, { r: 0.02 });
  for (let k = 0; k < 4; k++) b.box('metalDark', 0.96, 0.012, 0.46, cx + openW / 2 - 0.75, 0.3 + k * 0.32, zBack + f * 0.56, { r: 0 });
  b.box('metalDark', 2.2, 0.85, 0.55, cx - openW / 2 + 1.4, 0.43, zBack + f * 0.35, { r: 0.01 });
  for (let k = 0; k < 2; k++) goodsCyl(b, ATLAS.misc + 5, 0.28, 0.85, cx - openW / 2 + 0.4, 0.425, zMid + f * (k * 0.6 - 0.3));
  b.cylinder('awningRed', 0.22, 0.22, 0.7, cx + 0.9, 0.42, zMid, { rotZ: Math.PI / 2, seg: 14 });
  b.box('pegboard', openW - 1.2, 1.1, 0.04, cx - 0.2, 2.0, zBack + f * 0.08, { r: 0 });
}

/** Lantai dasar ruko tertutup menurut gaya: etalase kaca + pintu harmonika, pintu lipat kayu, atau rolling door. */
function closedFront(c: Ctx) {
  const { b, s, cx, openW, f } = c;
  if (s.style === 'modern') {
    // Etalase kaca berbingkai aluminium di belakang pintu harmonika (lipat) yang tertutup.
    const z = out(c, -0.24);
    b.box('shopDark', openW, 2.8, 0.05, cx, 1.4, z - f * 0.04, { r: 0 });
    b.box('shopDark', openW, 0.5, 0.3, cx, 3.05, out(c, -0.15), { r: 0 });
    b.box('carGlass', openW, 2.8, 0.02, cx, 1.4, z, { r: 0 });
    for (let k = 0; k <= 4; k++) b.box('aluminum', 0.06, 2.8, 0.06, cx - openW / 2 + (k * openW) / 4, 1.4, z + f * 0.02, { r: 0 });
    b.box('aluminum', openW, 0.06, 0.06, cx, 2.3, z + f * 0.02, { r: 0 });
    const gz = out(c, 0.05);
    const bars = Math.round(openW / (c.lod ? 0.3 : 0.12));
    for (let k = 0; k <= bars; k++) b.box('metalDark', 0.025, 2.75, 0.02, cx - openW / 2 + (k * openW) / bars, 1.42, gz, { r: 0 });
    // Kisi silang khas pintu harmonika.
    const lattice = c.lod ? 0 : Math.round(openW / 0.24);
    for (let k = 0; k < lattice; k++) {
      const x = cx - openW / 2 + 0.12 + k * 0.24;
      for (const y of [0.9, 1.9]) for (const sgn of [-1, 1]) b.box('metalDark', 0.018, 0.34, 0.012, x, y, gz + f * 0.01, { rotZ: sgn * 0.6, r: 0 });
    }
    for (const y of [0.06, 2.8]) b.box('metalDark', openW + 0.1, 0.06, 0.08, cx, y, gz, { r: 0 });
  } else if (s.style === 'klasik') {
    // Pintu lipat kayu (papan berpanel) + engsel; roster di atasnya (lihat transom).
    const z = out(c, 0.02);
    const leaves = Math.max(6, Math.round(openW / 0.55));
    for (let k = 0; k < leaves; k++) {
      const lw = openW / leaves;
      const x = cx - openW / 2 + lw * (k + 0.5);
      b.box('woodPlank', lw - 0.012, 2.6, 0.05, x, 1.32, z + f * (k % 2 ? 0.01 : 0), { r: 0.004 });
      for (const y of [0.75, 1.9]) b.box('woodDark', lw - 0.16, 0.7, 0.012, x, y, z + f * 0.03, { r: 0.004 });
    }
    b.box('metalDark', 0.06, 0.16, 0.04, cx, 1.2, z + f * 0.05, { r: 0.008 });
  } else {
    b.box('shutter', openW, 2.9, 0.06, cx, 1.45, out(c, 0.03), { r: 0 });
  }
}

// ------------------------------------------------------------------ Lantai atas & atap

function windowFrame(c: Ctx, x: number, y: number, ww: number, wh: number, kind: 'pita' | 'nako' | 'putih') {
  const { b, s, f, zF } = c;
  const lit = (Math.round(x * 3) + c.i) % 4 === 0;
  if (kind === 'nako') {
    // Jendela nako: bingkai kayu + bilah kaca horizontal + lis atas/bawah bertopang.
    b.box('woodDark', ww + 0.12, wh + 0.12, 0.08, x, y, zF + f * 0.01, { r: 0.006 });
    b.box(lit ? 'windowLit' : 'glassDark', ww, wh, 0.02, x, y, zF + f * 0.035, { r: 0 });
    if (!c.lod) for (let k = 0; k < Math.round(wh / 0.11); k++) b.box('glass', ww - 0.06, 0.09, 0.012, x, y - wh / 2 + 0.06 + k * 0.11, zF + f * 0.05, { rotX: f * 0.35, r: 0 });
    b.box('woodDark', 0.04, wh, 0.04, x, y, zF + f * 0.06, { r: 0 });
    b.box(s.facade, ww + 0.34, 0.1, 0.2, x, y + wh / 2 + 0.12, zF + f * 0.08, { r: 0.008 });
    b.box(s.facade, ww + 0.26, 0.07, 0.18, x, y - wh / 2 - 0.1, zF + f * 0.08, { r: 0.008 });
    for (const sx of [-1, 1]) b.box(s.facade, 0.08, 0.1, 0.14, x + sx * (ww / 2 + 0.06), y - wh / 2 - 0.17, zF + f * 0.07, { r: 0.006 });
  } else {
    const frame: MatKey = kind === 'putih' ? 'white' : 'metalDark';
    b.box(frame, ww + 0.08, wh + 0.08, 0.06, x, y, zF + f * 0.01, { r: 0.004 });
    b.box(lit ? 'windowLit' : 'glassDark', ww, wh, 0.02, x, y, zF + f * 0.048, { r: 0 });
    const panes = Math.max(2, Math.round(ww / 0.75));
    for (let k = 1; k < panes; k++) b.box(frame, 0.04, wh, 0.04, x - ww / 2 + (k * ww) / panes, y, zF + f * 0.05, { r: 0 });
    b.box(frame, ww, 0.04, 0.04, x, y + wh * 0.22, zF + f * 0.05, { r: 0 });
    b.box(kind === 'putih' ? 'stoneClad' : s.facade, ww + 0.2, 0.06, 0.16, x, y - wh / 2 - 0.07, zF + f * 0.07, { r: 0.006 });
  }
  if (s.teralis && kind !== 'pita') for (let t = -2; t <= 2; t++) b.box('metalDark', 0.018, wh, 0.018, x + t * (ww / 5), y, zF + f * 0.1, { r: 0 });
}

/** Pita roster (bata ventilasi berlubang) — ciri ruko/rumah lama Indonesia. */
function rosterBand(c: Ctx, y: number, width: number, h = 0.36) {
  const { b, cx, f, zF } = c;
  b.box('shopDark', width, h, 0.04, cx, y, zF + f * 0.01, { r: 0 });
  if (c.lod) {
    for (let r = 0; r <= 2; r++) b.box('white', width, 0.05, 0.05, cx, y - h / 2 + (r * h) / 2, zF + f * 0.03, { r: 0 });
    return;
  }
  const n = Math.round(width / 0.2);
  for (let k = 0; k <= n; k++) b.box('white', 0.04, h, 0.05, cx - width / 2 + (k * width) / n, y, zF + f * 0.03, { r: 0 });
  for (let r = 0; r <= 2; r++) b.box('white', width, 0.04, 0.05, cx, y - h / 2 + (r * h) / 2, zF + f * 0.03, { r: 0 });
  for (let k = 0; k < n; k++) b.box('white', 0.03, h / 2 - 0.04, 0.02, cx - width / 2 + ((k + 0.5) * width) / n, y + (k % 2 ? h / 4 : -h / 4), zF + f * 0.035, { rotZ: 0.78, r: 0 });
}

/** Balkon besi tempa: lantai beton + jeruji dengan pita hias belah ketupat. */
function balcony(c: Ctx, y: number) {
  const { b, s, cx, f, zF, w } = c;
  const bw = w - 1.0;
  b.box(s.facade, bw, 0.14, 0.95, cx, y, zF + f * 0.47, { r: 0.01 });
  b.box('stone', bw + 0.04, 0.05, 0.98, cx, y - 0.09, zF + f * 0.47, { r: 0 });
  if (c.lod) {
    b.box('metalDark', bw, 0.9, 0.03, cx, y + 0.53, zF + f * 0.92, { r: 0 });
    return;
  }
  const posts = Math.round(bw / 0.12);
  for (let k = 0; k <= posts; k++) b.box('metalDark', 0.018, 0.92, 0.018, cx - bw / 2 + (k * bw) / posts, y + 0.53, zF + f * 0.92, { r: 0 });
  for (const yy of [0.12, 0.98]) b.box('metalDark', bw, 0.04, 0.05, cx, y + yy, zF + f * 0.92, { r: 0 });
  b.box('metalDark', bw, 0.025, 0.03, cx, y + 0.55, zF + f * 0.92, { r: 0 });
  for (let k = 0; k < Math.round(bw / 0.3); k++) b.box('metalDark', 0.13, 0.13, 0.015, cx - bw / 2 + 0.15 + k * 0.3, y + 0.55, zF + f * 0.93, { rotZ: Math.PI / 4, r: 0 });
}

function upperFacade(c: Ctx) {
  const { b, s, cx, f, zF, w, H } = c;
  for (let fl = 1; fl < s.floors; fl++) {
    const y0 = 3.6 + (fl - 1) * 3.2;
    const y = y0 + 1.75 + (fl === 1 ? 0.35 : 0);
    if (s.style === 'modern') {
      // Alur plester horizontal + jendela pita lebar + sirip aluminium peneduh di salah satu sisi.
      for (let g = y0 + 0.3; g < y0 + 3.15; g += 0.6) b.box('shopDark', w - 0.6, 0.02, 0.012, cx, g, zF + f * 0.006, { r: 0 });
      const ww = w * 0.64;
      windowFrame(c, cx - w * 0.1, y, ww, 1.35, 'pita');
      if ((c.i + fl) % 2 === 0) for (let k = 0; k < 7; k++) b.box('aluminum', 0.05, 1.7, 0.24, cx + w * 0.3 + (k - 3) * 0.13, y, zF + f * 0.14, { r: 0 });
      else b.box('facadeAccent', 0.9, 1.6, 0.06, cx + w * 0.34, y, zF + f * 0.03, { r: 0.01 });
    } else if (s.style === 'klasik') {
      if (fl === 1 && s.balcony) balcony(c, y0 + 1.05);
      const n = w > 7.5 ? 3 : 2;
      for (let k = 0; k < n; k++) windowFrame(c, s.x0 + (w / n) * (k + 0.5), y + 0.1, 1.05, 1.5, 'nako');
      rosterBand(c, y0 + 3.0, w - 1.0, 0.3);
    } else if (s.style === 'bata') {
      // Bata ekspos menutupi lantai atas; jendela berbingkai putih; ambang batu alam.
      b.box('brickWall', w - 0.5, 3.0, 0.03, cx, y0 + 1.6, zF + f * 0.005, { r: 0 });
      for (let k = 0; k < 2; k++) windowFrame(c, s.x0 + (w / 2) * (k + 0.5), y, 1.5, 1.4, 'putih');
      if (fl === 1 && s.balcony) balcony(c, y0 + 1.05);
    } else {
      const n = Math.max(2, Math.round(w / 2.4));
      for (let k = 0; k < n; k++) windowFrame(c, s.x0 + (w / n) * (k + 0.5), y, 1.3, 1.35, 'pita');
      if (fl === 1 && s.balcony) balcony(c, y0 + 1.05);
    }
  }
  // Atap.
  if (s.roof === 'flat') {
    if (s.style === 'modern') {
      b.box(s.facade, w + 0.04, 0.7, 0.2, cx, H + 0.35, zF + f * 0.04, { r: 0.006 });
      b.box('aluminum', w + 0.08, 0.06, 0.26, cx, H + 0.72, zF + f * 0.04, { r: 0 });
    } else {
      b.box(s.facade, w + 0.06, 0.9, 0.24, cx, H + 0.45, zF + f * 0.05, { r: 0.01 });
      b.box(s.facade, w + 0.16, 0.1, 0.36, cx, H + 0.94, zF + f * 0.06, { r: 0.006 });
      b.box(s.facade, w + 0.1, 0.08, 0.3, cx, H - 0.05, zF + f * 0.08, { r: 0.006 });
    }
  } else {
    const rise = 2.2;
    const shape = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, rise)]);
    const gable = new THREE.ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: false });
    b.add(s.facade, gable, cx, H, f > 0 ? zF - 0.2 : zF);
    b.add(s.facade, gable, cx, H, f > 0 ? zF - s.depth : zF + s.depth - 0.2);
    const slope = Math.atan2(rise, w / 2);
    const len = Math.hypot(w / 2, rise) + 0.3;
    for (const sx of [-1, 1]) {
      b.box('roofTile', len, 0.08, s.depth + 0.5, cx + (sx * w) / 4, H + rise / 2 + 0.05, zF - (f * s.depth) / 2 + f * 0.25, { rotZ: -sx * slope, r: 0 });
      // Lisplang (papan tepi atap) mengikuti kemiringan di muka.
      b.box('woodDark', len, 0.2, 0.05, cx + (sx * w) / 4, H + rise / 2 - 0.02, zF + f * 0.5, { rotZ: -sx * slope, r: 0 });
    }
    // Roster di bidang pelana (ventilasi loteng).
    const g = { ...c, zF: zF + f * 0.005 };
    rosterBand(g, H + 0.75, 1.2, 0.3);
  }
  if (s.tank) {
    const tx = s.x1 - 1.4;
    const tz = zF - f * 3.2;
    const ty = s.roof === 'flat' ? H : H + 0.4;
    for (const [dx, dz] of [
      [-0.45, -0.45],
      [0.45, -0.45],
      [-0.45, 0.45],
      [0.45, 0.45],
    ])
      b.box('metalDark', 0.05, 1.2, 0.05, tx + dx, ty + 0.6, tz + dz, { r: 0 });
    b.box('metalDark', 1.05, 0.06, 1.05, tx, ty + 1.2, tz, { r: 0 });
    b.cylinder(c.i % 2 ? 'tankOrange' : 'tankBlue', 0.5, 0.52, 1.3, tx, ty + 1.88, tz, { seg: 20 });
  }
}

/** Unit AC luar sederhana (latar) di antara jendela lantai 2. */
function shopAcUnit(c: Ctx) {
  const { b, s, f } = c;
  const cx = s.x0 + (s.x1 - s.x0) * (s.style === 'modern' ? 0.84 : 0.5);
  const y = 3.6 + 0.62;
  const z = s.front;
  b.box('plasticWhite', 0.8, 0.58, 0.28, cx, y, z + f * 0.15, { r: 0 });
  b.cylinder('metalDark', 0.2, 0.2, 0.012, cx - 0.1, y, z + f * 0.295, { rotX: Math.PI / 2, seg: 16 });
  b.cylinder('plasticWhite', 0.05, 0.05, 0.016, cx - 0.1, y, z + f * 0.3, { rotX: Math.PI / 2, seg: 8 });
  for (let k = -2; k <= 2; k++) b.box('metalDark', 0.012, 0.42, 0.008, cx + 0.22 + k * 0.03, y, z + f * 0.292, { r: 0 });
  for (const sx of [-1, 1]) b.box('metalDark', 0.04, 0.04, 0.34, cx + sx * 0.3, y - 0.31, z + f * 0.17, { r: 0 });
}

// ------------------------------------------------------------------ Kanopi & papan nama

/** Posisi papan nama per gaya (dipakai SignAtlas di Exterior). */
export function shopSign(s: Shop): { y: number; z: number; width: number; height: number } {
  const w = s.x1 - s.x0;
  if (s.style === 'modern') return { y: 3.42, z: s.front + s.facing * 1.29, width: w * 0.86, height: 0.36 };
  if (s.style === 'warung') return { y: 4.2, z: s.front + s.facing * 0.1, width: w * 0.84, height: 0.74 };
  return { y: 4.15, z: s.front + s.facing * 0.1, width: w * 0.78, height: 0.72 };
}

function canopy(c: Ctx) {
  const { b, s, cx, f, zF, w } = c;
  if (s.style === 'modern') {
    // Kanopi beton tipis + fasia papan nama + lampu sorot di bawahnya.
    b.box(s.facade, w - 0.1, 0.14, 1.25, cx, 3.27, zF + f * 0.62, { r: 0.01 });
    b.box('metalDark', w * 0.88, 0.44, 0.06, cx, 3.42, zF + f * 1.25, { r: 0.01 });
    for (let k = 0; k < 3; k++) b.cylinder('emissiveWarm', 0.06, 0.06, 0.01, cx - w * 0.3 + k * w * 0.3, 3.195, zF + f * 0.65, { seg: 14 });
    return;
  }
  if (s.style === 'warung') {
    // Terpal miring lebar menaungi teras; lis tepi berwarna.
    b.box(s.awningMat, w - 0.2, 0.03, 1.7, cx, 3.25, zF + f * 0.82, { rotX: f * 0.26, r: 0 });
    b.box(s.awningMat, w - 0.2, 0.32, 0.02, cx, 2.95, zF + f * 1.64, { r: 0 });
    for (const sx of [-1, 1]) b.box('metalDark', 0.04, 0.04, 1.6, cx + sx * (w / 2 - 0.3), 3.05, zF + f * 0.8, { rotX: f * -0.3, r: 0 });
  } else if (s.style === 'bata') {
    // Kanopi kain bergaris dua warna.
    const stripes = Math.round((w - 0.4) / 0.4);
    for (let k = 0; k < stripes; k++) b.box(k % 2 ? 'white' : s.awningMat, (w - 0.4) / stripes, 0.04, 1.3, s.x0 + 0.2 + ((k + 0.5) * (w - 0.4)) / stripes, 3.35, zF + f * 0.62, { rotX: f * 0.32, r: 0 });
    for (let k = 0; k < stripes; k++) b.box(k % 2 ? 'white' : s.awningMat, (w - 0.4) / stripes, 0.22, 0.02, s.x0 + 0.2 + ((k + 0.5) * (w - 0.4)) / stripes, 3.06, zF + f * 1.24, { r: 0 });
  } else {
    // Seng gelombang bertopang (klasik, bengkel, toko bangunan).
    const deep = s.style === 'klasik' ? 1.15 : 1.5;
    b.box('zincSheet', w - 0.3, 0.05, deep, cx, 3.32, zF + f * (deep / 2), { rotX: f * 0.1, r: 0 });
    for (const sx of [-1, 1]) b.box('metalDark', 0.05, 0.05, deep, cx + sx * (w / 2 - 0.5), 3.06, zF + f * (deep / 2), { rotX: f * -0.45, r: 0 });
    b.box('metalDark', w - 0.3, 0.06, 0.06, cx, 3.25, zF + f * (deep - 0.02), { r: 0 });
  }
  // Rangka papan nama (teks di SignAtlas) + lampu sorot papan.
  b.box('metalDark', w * 0.82, 0.86, 0.08, cx, 4.15, zF + f * 0.05, { r: 0.02 });
  for (const sx of [-0.3, 0.3]) {
    b.box('metalDark', 0.03, 0.03, 0.45, cx + sx * w, 4.68, zF + f * 0.28, { r: 0 });
    b.box('lampGlow', 0.14, 0.05, 0.08, cx + sx * w, 4.66, zF + f * 0.5, { r: 0.01 });
  }
}

// ------------------------------------------------------------------ Ruko lengkap

export function shopModel(b: B, s: Shop, i: number, lod: 0 | 1 = 0) {
  const w = s.x1 - s.x0;
  const c: Ctx = { b, s, i, lod, w, cx: (s.x0 + s.x1) / 2, f: s.facing, zF: s.front, H: shopHeight(s), open: isOpenShop(s), openW: w - 1.0 };
  const { cx, f, zF, H, open, openW } = c;
  // Ceruk lantai dasar: kios 2,6 m; etalase ruko modern tertutup 0,3 m (kaca terlihat di balik pintu harmonika).
  // Collider tetap kotak penuh sampai garis muka — ceruk tidak bisa dimasuki.
  const recess = open ? KIOSK_DEPTH : s.style === 'modern' ? 0.3 : 0;
  // Massa: lantai atas penuh; lantai dasar di belakang ceruk.
  b.box(s.facade, w, H - 3.6, s.depth, cx, 3.6 + (H - 3.6) / 2, zF - (f * s.depth) / 2, { r: 0 });
  b.box(s.facade, w, 3.6, s.depth - recess, cx, 1.8, zF - f * (recess + (s.depth - recess) / 2), { r: 0 });
  // Pilar/pilaster ujung lantai dasar menurut gaya: keramik (klasik), batu alam (bata), plester halus (lainnya).
  const pier: MatKey = s.style === 'klasik' ? 'ceramicWall' : s.style === 'bata' ? 'stoneClad' : s.facade;
  for (const sx of [-1, 1]) {
    const px = cx + sx * (w / 2 - 0.25);
    if (recess > 0) b.box(s.facade, 0.5, 3.6, recess, px, 1.8, zF - (f * recess) / 2, { r: 0 });
    b.box(pier, 0.5, 3.3, 0.06, px, 1.65, zF + f * 0.03, { r: 0 });
    b.box('stone', 0.54, 0.16, 0.1, px, 0.08, zF + f * 0.05, { r: 0.006 });
  }
  // Pilaster dinding bersama setinggi bangunan + lis lantai.
  for (const px of [s.x0 + 0.12, s.x1 - 0.12]) b.box(s.facade, 0.24, H, 0.18, px, H / 2, zF + f * 0.09, { r: 0.008 });
  b.box(s.facade, w, 0.2, 0.28, cx, 3.6, zF + f * 0.11, { r: 0.008 });
  // Pipa air hujan di dinding bersama kanan.
  if (!c.lod) b.cylinder('plasticWhite', 0.045, 0.045, H, s.x1 - 0.3, H / 2, zF + f * 0.22, { seg: 10 });
  // Ambang atas bukaan + roster (klasik) atau kotak rolling door.
  if (s.style === 'klasik') rosterBand(c, 3.12, openW, 0.32);
  else b.box('metalDark', openW + 0.2, 0.3, 0.28, cx, 3.06, zF + f * 0.14, { r: 0.01 });
  if (open) {
    kioskShell(c);
    if (s.kind === 'warung') foodDisplay(c, s.id === 'S6');
    else if (s.kind === 'bengkel') workshop(c);
    else if (s.kind === 'cafe') {
      counter(c, ATLAS.poster + 5, 'wood');
      b.box('steel', 0.45, 0.45, 0.4, cx - 0.8, 1.27, out(c, -0.3), { r: 0.03 });
      b.box('black', 0.3, 0.12, 0.25, cx + 0.6, 1.1, out(c, -0.3), { r: 0.02 });
      b.box('black', 1.6, 0.9, 0.03, cx, 2.6, out(c, -KIOSK_DEPTH + 0.07), { r: 0 });
      for (let k = 0; k < 5; k++) b.box('white', 0.9 - (k % 2) * 0.25, 0.035, 0.005, cx - 0.2, 2.92 - k * 0.14, out(c, -KIOSK_DEPTH + 0.09), { r: 0 });
      for (let k = 0; k < 5; k++) b.box('paintYellow', 0.18, 0.035, 0.005, cx + 0.55, 2.92 - k * 0.14, out(c, -KIOSK_DEPTH + 0.09), { r: 0 });
      packShelves(c, [ATLAS.misc + 7, ATLAS.misc + 8], 2, cx + 0.9, cx + openW / 2 - 0.25);
    } else kioskContents(c);
  } else closedFront(c);
  canopy(c);
  upperFacade(c);
  if (i % 3 === 0 && !c.lod) shopAcUnit(c);
  // Teras keramik di depan ruko.
  b.add('terrace', floorQuad(s.x0, s.x1, f > 0 ? zF : zF - 1.0, f > 0 ? zF + 1.0 : zF, 0.016));
}

/** Dinding samping ruko pengapit gang (S3/S4): jendela lantai atas agar gang tidak berupa tembok polos. */
export function alleyWalls(b: B) {
  for (const s of SHOPS) {
    if (s.facing !== 1 || s.depth < 30) continue;
    const side = Math.abs(s.x1 + STREET.alleyOuter) < 0.01 ? 1 : -1;
    const x = side > 0 ? s.x1 : s.x0;
    for (let fl = 1; fl < s.floors; fl++) {
      const y = 3.6 + (fl - 1) * 3.2 + 1.75 + (fl === 1 ? 0.4 : 0);
      for (let z = 6; z > s.front - s.depth + 2; z -= 4.5) {
        b.box('aluminum', 0.06, 1.45, 1.4, x + side * 0.01, y, z, { r: 0.004 });
        b.box((Math.round(z) + fl) % 3 === 0 ? 'windowLit' : 'glassDark', 0.02, 1.35, 1.3, x + side * 0.04, y, z, { r: 0 });
        b.box(s.facade, 0.16, 0.08, 1.55, x + side * 0.06, y - 0.78, z, { r: 0.006 });
      }
    }
  }
}

import * as THREE from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { GeoBuilder } from '@/game/visual/geometry';
import type { MatKey } from './materials';

/**
 * Model kendaraan buatan sendiri (fase kualitas kendaraan): MPV & hatchback (mobil pribadi paling umum di
 * Indonesia), angkot (minibus angkutan kota), dan mobil boks distributor. Tanpa aset eksternal.
 *
 * Teknik: bodi = ekstrusi profil samping dengan **lengkung roda sungguhan**, lalu denahnya dibentuk ulang
 * (sudut moncong/buritan membulat) dan kabin kaca menyempit ke atas (tumblehome); normal dihaluskan dengan
 * sudut lipat. Pilar, atap, lampu, gril, bemper, spion, gagang pintu, pelat dipasang di atasnya.
 * Roda TIDAK termasuk di sini (wheelModels.ts) agar bisa berputar lewat instancing.
 *
 * Koordinat lokal: panjang searah +Z (moncong di +Z), lebar searah X (+X = sisi kiri kendaraan), tanah y = 0.
 */
type B = GeoBuilder<MatKey>;
type P = [number, number];

export type VehicleKind = 'mpv' | 'hatch' | 'angkot' | 'van';

export interface VehicleSpec {
  /** Panjang keseluruhan termasuk bemper & pelat (= 2 × setengah panjang di traffic.ts). */
  length: number;
  width: number;
  height: number;
  wheelR: number;
  /** Posisi pusat roda [x, z] (x > 0 = sisi kiri). */
  wheels: P[];
  /** Roda depan dapat berbelok (indeks pada `wheels`). */
  steer: number[];
}

const wheelsAt = (track: number, zf: number, zr: number): P[] => [
  [track, zf],
  [-track, zf],
  [track, zr],
  [-track, zr],
];

export const VEHICLES: Record<VehicleKind, VehicleSpec> = {
  mpv: { length: 4.5, width: 1.74, height: 1.74, wheelR: 0.315, wheels: wheelsAt(0.755, 1.37, -1.29), steer: [0, 1] },
  hatch: { length: 3.81, width: 1.66, height: 1.53, wheelR: 0.3, wheels: wheelsAt(0.72, 1.2, -1.24), steer: [0, 1] },
  angkot: { length: 4.18, width: 1.66, height: 2.06, wheelR: 0.29, wheels: wheelsAt(0.7, 1.25, -1.15), steer: [0, 1] },
  van: { length: 5.18, width: 1.84, height: 2.42, wheelR: 0.33, wheels: wheelsAt(0.78, 1.72, -1.5), steer: [0, 1] },
};

// ------------------------------------------------------------------ Alat bentuk

/** Bentuk sisi: garis atas dari buritan-bawah lewat atap ke moncong-bawah; dasar dari depan ke belakang dengan lengkung roda. */
/** Jalur garis/spline: titik dengan indeks dalam `smooth` [i0, i1] disambung kurva Catmull-Rom (kap, atap). */
function trace(s: THREE.Shape, pts: P[], smooth?: [number, number]) {
  for (let i = 1; i < pts.length; i++) {
    if (smooth && i > smooth[0] && i <= smooth[1]) {
      if (i === smooth[0] + 1) s.splineThru(pts.slice(i, smooth[1] + 1).map(([z, y]) => new THREE.Vector2(z, y)));
      continue;
    }
    s.lineTo(pts[i][0], pts[i][1]);
  }
}

function sideShape(top: P[], bottomY: number, arches: { z: number; r: number; cy: number }[], smooth?: [number, number]) {
  const s = new THREE.Shape();
  s.moveTo(top[0][0], top[0][1]);
  trace(s, top, smooth);
  for (const a of [...arches].sort((p, q) => q.z - p.z)) {
    s.lineTo(a.z + a.r, bottomY);
    s.lineTo(a.z + a.r, a.cy);
    s.absarc(a.z, a.cy, a.r, 0, Math.PI, false);
    s.lineTo(a.z - a.r, bottomY);
  }
  s.closePath();
  return s;
}

function polyShape(pts: P[], smooth?: [number, number]) {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  trace(s, pts, smooth);
  s.closePath();
  return s;
}

/** Ekstrusi bentuk sisi selebar `width` (sumbu X), tepi membulat. */
function extrude(shape: THREE.Shape, width: number, bevel: number, curveSegments = 14, bevelSegments = 3) {
  const depth = Math.max(0.002, width - bevel * 2);
  // bevelOffset = −bevel: tepi membulat ke DALAM sehingga siluet tetap sama dengan profil (lampu/gril tidak terbenam).
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelOffset: -bevel, bevelSegments, curveSegments });
  g.translate(0, 0, -depth / 2);
  g.rotateY(-Math.PI / 2);
  return g;
}

interface Sculpt {
  zFront: number;
  zRear: number;
  /** Penyempitan sudut moncong/buritan pada denah (fraksi lebar) & panjang zona transisinya. */
  nose: number;
  noseLen: number;
  tail: number;
  tailLen: number;
  /** Tumblehome: lebar berkurang `tumble` per meter di atas `beltY`. */
  beltY?: number;
  tumble?: number;
}

/** Membentuk ulang denah ekstrusi (sudut membulat, tumblehome) lalu menghaluskan normal dengan sudut lipat. */
function sculpt(g: THREE.BufferGeometry, o: Sculpt, crease = Math.PI / 5) {
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const tf = THREE.MathUtils.smoothstep(z, o.zFront - o.noseLen, o.zFront);
    const tr = THREE.MathUtils.smoothstep(-z, -(o.zRear + o.tailLen), -o.zRear);
    let k = 1 - o.nose * tf * tf - o.tail * tr * tr;
    if (o.tumble && o.beltY !== undefined && y > o.beltY) k -= o.tumble * (y - o.beltY);
    pos.setX(i, pos.getX(i) * k);
  }
  pos.needsUpdate = true;
  const out = toCreasedNormals(g, crease);
  g.dispose();
  return out;
}

/** Setengah silinder (atas) sebagai lapisan dalam lengkung roda, dilihat dari luar (permukaan cekung). */
function archLiner(r: number, width: number) {
  const g = new THREE.CylinderGeometry(r, r, width, 18, 1, true, 0, Math.PI);
  g.rotateZ(Math.PI / 2);
  // Balik arah muka: permukaan dalam (cekung) yang terlihat dari luar lengkung.
  const idx = g.getIndex()!;
  for (let i = 0; i < idx.count; i += 3) {
    const a = idx.getX(i + 1);
    idx.setX(i + 1, idx.getX(i + 2));
    idx.setX(i + 2, a);
  }
  const n = g.getAttribute('normal') as THREE.BufferAttribute;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  return g;
}

/** Panel tipis berbentuk poligon (z, y) di sisi kendaraan, dimiringkan mengikuti tumblehome. */
function sidePanel(b: B, mat: MatKey, pts: P[], side: 1 | -1, xAt: (y: number) => number, tilt: number, thick = 0.012) {
  const shape = polyShape(pts);
  const g = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false });
  g.translate(0, 0, -thick / 2);
  g.rotateY(-Math.PI / 2);
  const yc = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  // Miring di sekitar garis y = yc, lalu geser ke permukaan sisi.
  g.translate(0, -yc, 0);
  g.rotateZ(side * tilt);
  g.translate(side * xAt(yc), yc, 0);
  b.add(mat, g, 0, 0, 0);
}

/**
 * Lis tipis lurus di permukaan sisi dari titik (z0, y0) ke (z1, y1). Bila `inside` diberikan (titik di dalam bidang
 * sisi), lis digeser setengah lebarnya ke arah titik itu agar tidak menggantung di luar tepi kabin.
 */
function sideStrip(b: B, mat: MatKey, a: P, c: P, width: number, side: 1 | -1, xAt: (y: number) => number, tilt: number, thick = 0.014, inside?: P) {
  const dz = c[0] - a[0];
  const dy = c[1] - a[1];
  const len = Math.hypot(dz, dy);
  let zc = (a[0] + c[0]) / 2;
  let yc = (a[1] + c[1]) / 2;
  if (inside) {
    let nz = -dy / len;
    let ny = dz / len;
    if ((inside[0] - zc) * nz + (inside[1] - yc) * ny < 0) {
      nz = -nz;
      ny = -ny;
    }
    zc += nz * width * 0.5;
    yc += ny * width * 0.5;
  }
  b.box(mat, thick, len, width, side * xAt(yc), yc, zc, { rotX: Math.atan2(dz, dy), rotZ: side * tilt, r: 0 });
}

/** z permukaan depan (atau belakang bila `rear`) profil `pts` pada ketinggian y, serta kemiringan mukanya. */
function faceAt(pts: P[], y: number, rear = false): { z: number; tilt: number } {
  const side = pts.filter(([z]) => (rear ? z < 0 : z > 0));
  for (let i = 1; i < side.length; i++) {
    const [z0, y0] = side[i - 1];
    const [z1, y1] = side[i];
    if ((y - y0) * (y - y1) <= 0 && y0 !== y1) {
      const t = (y - y0) / (y1 - y0);
      const zTop = y1 > y0 ? z1 : z0;
      const zBot = y1 > y0 ? z0 : z1;
      return { z: z0 + (z1 - z0) * t, tilt: Math.atan2(zTop - zBot, Math.abs(y1 - y0)) };
    }
  }
  return { z: rear ? side[0][0] : side[side.length - 1][0], tilt: 0 };
}

/** Panel kaca miring (kaca depan/belakang) di antara dua titik profil, selebar `width`. */
function slopedGlass(b: B, mat: MatKey, bottom: P, top: P, width: number, outward: number) {
  const dz = top[0] - bottom[0];
  const dy = top[1] - bottom[1];
  const len = Math.hypot(dz, dy);
  // Normal profil (menjauhi bodi): putar arah (dz, dy) 90°, tanda mengikuti `outward` (+1 = ke +Z).
  const nz = (dy / len) * outward;
  const ny = (-dz / len) * outward;
  const off = 0.012;
  b.box(mat, width, len, 0.012, 0, (bottom[1] + top[1]) / 2 + ny * off, (bottom[0] + top[0]) / 2 + nz * off, { rotX: Math.atan2(dz, dy), r: 0 });
}

/** Pelat nomor (peta kanvas di material `carPlate`/`plateYellow`). */
function plate(b: B, mat: MatKey, y: number, z: number, flip: 1 | -1) {
  b.box('carTrim', 0.46, 0.14, 0.02, 0, y, z, { r: 0.01 });
  // UV 0..1 per muka (bukan UV meter) agar tekstur kanvas pelat tampil utuh.
  b.add(mat, new THREE.BoxGeometry(0.42, 0.11, 0.012), 0, y, z + flip * 0.012, { rotY: flip > 0 ? 0 : Math.PI });
}

/** Spion: tangkai + rumah spion (warna `housing`) + kaca. */
function mirror(b: B, housing: MatKey, side: 1 | -1, x: number, y: number, z: number, big = false) {
  const s = big ? 1.4 : 1;
  b.box('carTrim', 0.09 * s, 0.03, 0.05, x + side * 0.045 * s, y - 0.02, z, { r: 0.008 });
  b.box(housing, 0.1 * s, 0.12 * s, 0.17 * s, x + side * 0.12 * s, y + 0.02, z - 0.01, { r: 0.03 });
  b.box('carGlass', 0.012, 0.09 * s, 0.13 * s, x + side * 0.12 * s, y + 0.02, z - 0.1 * s, { r: 0, rotY: Math.PI / 2 });
}

// ------------------------------------------------------------------ Mobil pribadi (MPV & hatchback)

interface CarDesign {
  lower: P[];
  bottomY: number;
  archR: number;
  axleF: number;
  axleR: number;
  wheelR: number;
  halfW: number;
  sculpt: Sculpt;
  cabin: P[];
  cabinHalfW: number;
  beltY: number;
  tumble: number;
  roof: [number, number, number];
  aPillar: [P, P];
  dPillar: [P, P];
  bPillarZ: number;
  cPillarZ?: number;
  doorLines: number[];
  head: { y: number; z: number; x: number };
  tail: { y0: number; y1: number; z: number; x: number };
  plateY: [number, number];
  noseZ: number;
  tailZ: number;
  rails: boolean;
}

const MPV_DESIGN: CarDesign = {
  lower: [
    [-2.17, 0.3],
    [-2.21, 0.5],
    [-2.21, 1.0],
    [-2.15, 1.05],
    [0.8, 1.05],
    [1.6, 1.0],
    [1.98, 0.94],
    [2.14, 0.89],
    [2.2, 0.8],
    [2.22, 0.66],
    [2.22, 0.42],
    [2.15, 0.28],
  ],
  // Ambang bawah ±0,25 m (jarak bebas MPV ±0,2 m) — di bawah as roda, bodi tidak tampak "berkaki".
  bottomY: 0.25,
  archR: 0.385,
  axleF: 1.37,
  axleR: -1.29,
  wheelR: 0.315,
  halfW: 0.87,
  sculpt: { zFront: 2.22, zRear: -2.21, nose: 0.09, noseLen: 0.85, tail: 0.05, tailLen: 0.45 },
  cabin: [
    [0.88, 0.99],
    [0.74, 1.07],
    [-0.12, 1.66],
    [-0.4, 1.71],
    [-1.8, 1.72],
    [-2.03, 1.66],
    [-2.15, 1.08],
    [-2.12, 0.99],
  ],
  cabinHalfW: 0.8,
  beltY: 1.05,
  tumble: 0.13,
  roof: [-0.3, -1.95, 1.715],
  aPillar: [
    [0.72, 1.08],
    [-0.1, 1.65],
  ],
  dPillar: [
    [-2.02, 1.65],
    [-2.13, 1.09],
  ],
  bPillarZ: -0.46,
  cPillarZ: -1.45,
  doorLines: [0.66, -0.47, -1.47],
  head: { y: 0.85, z: 0, x: 0.58 },
  tail: { y0: 0.72, y1: 1.2, z: -2.21, x: 0.71 },
  plateY: [0.46, 0.6],
  noseZ: 2.22,
  tailZ: -2.21,
  rails: true,
};

const HATCH_DESIGN: CarDesign = {
  lower: [
    [-1.82, 0.3],
    [-1.86, 0.52],
    [-1.86, 0.95],
    [-1.8, 1.0],
    [0.5, 1.0],
    [1.3, 0.94],
    [1.66, 0.87],
    [1.8, 0.82],
    [1.85, 0.74],
    [1.86, 0.6],
    [1.86, 0.4],
    [1.79, 0.27],
  ],
  // Hatchback lebih rendah (jarak bebas ±0,17 m).
  bottomY: 0.22,
  archR: 0.37,
  axleF: 1.2,
  axleR: -1.24,
  wheelR: 0.3,
  halfW: 0.83,
  sculpt: { zFront: 1.86, zRear: -1.86, nose: 0.1, noseLen: 0.75, tail: 0.06, tailLen: 0.4 },
  cabin: [
    [0.6, 0.95],
    [0.46, 1.02],
    [-0.28, 1.5],
    [-0.55, 1.53],
    [-1.45, 1.52],
    [-1.68, 1.45],
    [-1.83, 1.03],
    [-1.8, 0.95],
  ],
  cabinHalfW: 0.76,
  beltY: 1.0,
  tumble: 0.16,
  roof: [-0.45, -1.6, 1.525],
  aPillar: [
    [0.44, 1.03],
    [-0.26, 1.49],
  ],
  dPillar: [
    [-1.66, 1.45],
    [-1.81, 1.04],
  ],
  bPillarZ: -0.6,
  doorLines: [0.42, -0.62, -1.42],
  head: { y: 0.79, z: 0, x: 0.55 },
  tail: { y0: 0.75, y1: 1.1, z: -1.86, x: 0.67 },
  plateY: [0.45, 0.62],
  noseZ: 1.86,
  tailZ: -1.86,
  rails: false,
};

function carBody(b: B, d: CarDesign, paint: MatKey) {
  const cy = Math.max(d.wheelR, d.bottomY);
  // Kap & moncong = kurva halus (bukan bidang-bidang patah) dari titik garis pinggang ke bemper.
  const lower = extrude(sideShape(d.lower, d.bottomY, [{ z: d.axleF, r: d.archR, cy }, { z: d.axleR, r: d.archR, cy }], [4, d.lower.length - 3]), d.halfW * 2, 0.07, 24);
  b.add(paint, sculpt(lower, d.sculpt), 0, 0, 0);
  // Kabin kaca (seluruhnya kaca gelap); pilar & atap berwarna bodi dipasang di atasnya.
  const cab = extrude(polyShape(d.cabin, [2, 5]), d.cabinHalfW * 2, 0.045, 16, 3);
  b.add('carGlass', sculpt(cab, { ...d.sculpt, nose: 0, beltY: d.beltY, tumble: d.tumble }), 0, 0, 0);
  const xAt = (y: number) => d.cabinHalfW * (1 - d.tumble * Math.max(0, y - d.beltY)) + 0.004;
  const tilt = Math.atan(d.cabinHalfW * d.tumble);
  const [rz0, rz1, ry] = d.roof;
  // Atap berwarna bodi (menutup kaca di bagian atas) + list atap.
  const roofHalf = xAt(ry) - 0.004;
  b.box(paint, roofHalf * 2 + 0.01, 0.045, rz0 - rz1, 0, ry - 0.005, (rz0 + rz1) / 2, { r: 0.02 });
  const mid: P = [(rz0 + rz1) / 2, (d.beltY + ry) / 2];
  const head = faceAt(d.lower, d.head.y);
  for (const side of [1, -1] as const) {
    // Pilar A, B (hitam), C (opsional), D — digeser ke dalam bidang sisi kabin.
    sideStrip(b, paint, d.aPillar[0], d.aPillar[1], 0.08, side, xAt, tilt, 0.014, mid);
    sideStrip(b, 'carTrim', [d.bPillarZ, d.beltY + 0.02], [d.bPillarZ, ry - 0.05], 0.1, side, xAt, tilt);
    if (d.cPillarZ !== undefined) sideStrip(b, paint, [d.cPillarZ, d.beltY + 0.02], [d.cPillarZ, ry - 0.05], 0.11, side, xAt, tilt);
    sideStrip(b, paint, d.dPillar[0], d.dPillar[1], 0.12, side, xAt, tilt, 0.014, mid);
    // Lis krom di bawah kaca.
    sideStrip(b, 'chrome', [d.aPillar[0][0] - 0.06, d.beltY + 0.012], [d.dPillar[1][0] + 0.08, d.beltY + 0.012], 0.022, side, xAt, tilt, 0.01);
    // Garis pintu (mengitari lengkung roda) & gagang di dekat tepi belakang tiap pintu.
    const bx = side * (d.halfW + 0.002);
    for (const z of d.doorLines) {
      let y0 = d.bottomY + 0.06;
      for (const axle of [d.axleF, d.axleR]) if (Math.abs(z - axle) < d.archR) y0 = Math.max(y0, cy + Math.sqrt(d.archR ** 2 - (z - axle) ** 2) + 0.03);
      const y1 = d.beltY - 0.06;
      b.box('carTrim', 0.008, y1 - y0, 0.008, bx, (y0 + y1) / 2, z, { r: 0 });
    }
    for (let i = 1; i < d.doorLines.length; i++) b.box('carTrim', 0.02, 0.028, 0.12, bx, d.beltY - 0.1, d.doorLines[i] + 0.16, { r: 0.008 });
    // Garis karakter (lipatan bodi) di samping: memantulkan cahaya, memecah bidang datar.
    b.box(paint, 0.012, 0.022, d.noseZ - d.tailZ - 0.9, side * (d.halfW + 0.002), d.beltY - 0.2, (d.noseZ + d.tailZ) / 2 - 0.1, { r: 0.005 });
    // Lis samping bawah (sill) hitam di antara lengkung roda.
    b.box('carTrim', 0.03, 0.07, d.axleF - d.axleR - d.archR * 2 - 0.06, side * (d.halfW - 0.005), d.bottomY + 0.07, (d.axleF + d.axleR) / 2, { r: 0.01 });
    // Lampu depan di muka moncong (mengikuti kemiringan muka), menyapu ke sudut; sein; lampu belakang vertikal.
    // Rumah lampu gelap + dua proyektor krom + garis DRL (terbaca jelas juga pada mobil putih).
    const lampRot = { rotX: -head.tilt, rotY: side * 0.28 };
    b.box('carTrim', 0.46, 0.16, 0.07, side * d.head.x, d.head.y, head.z - 0.03, { r: 0.03, ...lampRot });
    b.box('carLamp', 0.42, 0.028, 0.03, side * d.head.x, d.head.y + 0.055, head.z + 0.006, { r: 0.012, ...lampRot });
    for (const k of [-1, 1]) {
      const lx = side * (d.head.x + k * 0.1);
      const lz = head.z + 0.004 - side * k * 0.1 * Math.sin(0.28) * side;
      b.cylinder('chrome', 0.045, 0.05, 0.03, lx, d.head.y - 0.012, lz, { rotX: Math.PI / 2 - head.tilt, seg: 16 });
      b.cylinder('carLamp', 0.03, 0.03, 0.02, lx, d.head.y - 0.012, lz + 0.012, { rotX: Math.PI / 2 - head.tilt, seg: 14 });
    }
    b.box('amberLens', 0.08, 0.045, 0.03, side * (d.head.x + 0.16), d.head.y - 0.01, head.z - 0.06, { r: 0.01, rotY: side * 0.5 });
    b.box('ledRed', 0.15, d.tail.y1 - d.tail.y0, 0.05, side * d.tail.x, (d.tail.y0 + d.tail.y1) / 2, d.tail.z + 0.015, { r: 0.02, rotY: -side * 0.3 });
    b.box('carLamp', 0.06, 0.07, 0.02, side * (d.tail.x - 0.02), d.tail.y0 + 0.06, d.tail.z - 0.012, { r: 0.008, rotY: -side * 0.3 });
    mirror(b, paint, side, side * (d.halfW - 0.02), d.beltY + 0.06, d.aPillar[0][0] - 0.12);
    // Lampu kabut di bemper.
    b.cylinder('carLamp', 0.04, 0.04, 0.02, side * (d.head.x + 0.02), d.plateY[0] + 0.02, d.noseZ - 0.02, { rotX: Math.PI / 2, seg: 14 });
    if (d.rails) {
      b.box('aluminum', 0.035, 0.035, rz0 - rz1 - 0.2, side * (roofHalf - 0.1), ry + 0.06, (rz0 + rz1) / 2, { r: 0.012 });
      for (const z of [rz0 - 0.15, rz1 + 0.15]) b.box('carTrim', 0.045, 0.07, 0.07, side * (roofHalf - 0.1), ry + 0.035, z, { r: 0.015 });
    }
  }
  // Gril & lubang udara bemper (hitam), garis krom gril, emblem generik.
  b.box('carTrim', 0.8, 0.12, 0.05, 0, d.head.y - 0.01, head.z - 0.02, { r: 0.03, rotX: -head.tilt });
  b.box('chrome', 0.76, 0.018, 0.02, 0, d.head.y + 0.03, head.z + 0.002, { r: 0, rotX: -head.tilt });
  b.cylinder('chrome', 0.045, 0.045, 0.02, 0, d.head.y - 0.005, head.z + 0.01, { rotX: Math.PI / 2 - head.tilt, seg: 16 });
  b.box('carTrim', 1.12, 0.1, 0.05, 0, d.plateY[0] - 0.02, d.noseZ - 0.03, { r: 0.03 });
  b.box('carTrim', 1.3, 0.09, 0.06, 0, d.bottomY + 0.05, d.tailZ + 0.02, { r: 0.03 });
  // Lapisan dalam lengkung roda.
  for (const z of [d.axleF, d.axleR]) b.add('carTrim', archLiner(d.archR - 0.012, d.halfW * 2 - 0.16), 0, cy, z);
  // Pelat (putih, standar terbaru) depan & belakang; knalpot; antena sirip hiu; spoiler atap kecil.
  plate(b, 'carPlate', d.plateY[0], d.noseZ + 0.005, 1);
  plate(b, 'carPlate', d.plateY[1], d.tailZ - 0.005, -1);
  b.cylinder('chrome', 0.03, 0.03, 0.12, -0.45, d.bottomY + 0.04, d.tailZ + 0.03, { rotX: Math.PI / 2, seg: 12 });
  b.box('carTrim', 0.05, 0.05, 0.16, 0, ry + 0.04, rz1 + 0.18, { r: 0.02 });
  b.box(paint, roofHalf * 1.7, 0.03, 0.14, 0, ry + 0.005, rz1 - 0.04, { r: 0.012, rotX: -0.15 });
}

// ------------------------------------------------------------------ Angkot

/**
 * Angkot (minibus kabin di atas roda depan, gaya mobil angkutan kota Indonesia): kaca depan besar, jendela
 * penumpang berbingkai, pintu geser penumpang di sisi kiri (sisi trotoar) yang terbuka dengan anak tangga,
 * papan trayek di atap, rak atap, lis putih, bemper krom, pelat kuning angkutan umum, pelindung lumpur.
 */
function angkotBody(b: B, paint: MatKey) {
  const halfW = 0.83;
  const arches = [
    { z: 1.25, r: 0.36, cy: 0.33 },
    { z: -1.15, r: 0.36, cy: 0.33 },
  ];
  const top: P[] = [
    [-1.97, 0.4],
    [-2.01, 0.52],
    [-2.01, 1.86],
    [-1.94, 1.95],
    [1.5, 1.95],
    [1.64, 1.9],
    [1.93, 1.13],
    [2.0, 1.04],
    [2.02, 0.52],
    [1.97, 0.4],
  ];
  const body = extrude(sideShape(top, 0.33, arches), halfW * 2, 0.06);
  b.add(paint, sculpt(body, { zFront: 2.02, zRear: -2.01, nose: 0.05, noseLen: 0.5, tail: 0.03, tailLen: 0.3 }), 0, 0, 0);
  const xAt = () => halfW + 0.004;
  slopedGlass(b, 'carGlass', [1.92, 1.16], [1.65, 1.88], halfW * 2 - 0.16, 1);
  for (const side of [1, -1] as const) {
    // Kaca pintu depan (tepi depan miring mengikuti kaca depan) & jendela penumpang berbingkai.
    sidePanel(b, 'carGlass', [[1.84, 1.2], [1.6, 1.82], [1.0, 1.82], [1.0, 1.2]], side, xAt, 0);
    const panes: [number, number][] = side > 0 ? [[-0.12, -0.92], [-1.0, -1.85]] : [[0.88, 0.02], [-0.06, -0.92], [-1.0, -1.85]];
    for (const [z0, z1] of panes) sidePanel(b, 'carGlass', [[z0, 1.22], [z0, 1.8], [z1, 1.8], [z1, 1.22]], side, xAt, 0);
    // Lis putih ganda di bawah jendela & di bawah bodi.
    b.box('white', 0.012, 0.06, 3.86, side * (halfW + 0.006), 1.12, 0, { r: 0 });
    b.box('white', 0.012, 0.03, 3.86, side * (halfW + 0.006), 1.02, 0, { r: 0 });
    // Lampu depan persegi, sein, lampu belakang vertikal.
    b.box('carTrim', 0.36, 0.2, 0.05, side * 0.56, 0.82, 2.0, { r: 0.02 });
    b.box('carLamp', 0.32, 0.16, 0.03, side * 0.56, 0.82, 2.025, { r: 0.015 });
    b.box('amberLens', 0.1, 0.07, 0.03, side * 0.77, 0.66, 2.0, { r: 0.01 });
    b.box('ledRed', 0.12, 0.3, 0.04, side * 0.72, 0.85, -2.02, { r: 0.012 });
    b.box('amberLens', 0.12, 0.08, 0.04, side * 0.72, 0.63, -2.02, { r: 0.01 });
    mirror(b, 'carTrim', side, side * (halfW - 0.02), 1.42, 1.68, true);
    // Pelindung lumpur di belakang roda.
    for (const a of arches) b.box('carTrim', 0.2, 0.22, 0.012, side * (halfW - 0.12), 0.2, a.z - a.r - 0.04, { r: 0 });
    // Rak atap.
    b.box('aluminum', 0.03, 0.03, 2.9, side * 0.62, 2.08, -0.45, { r: 0.008 });
    for (const z of [0.95, -0.45, -1.85]) b.box('aluminum', 0.03, 0.12, 0.03, side * 0.62, 2.0, z, { r: 0 });
  }
  // Pintu geser penumpang terbuka (sisi kiri = +X): bukaan gelap, interior & bangku, anak tangga, pegangan.
  const dz0 = 0.04;
  const dz1 = 0.9;
  b.box('carInterior', 0.012, 1.35, dz1 - dz0, halfW + 0.008, 1.1, (dz0 + dz1) / 2, { r: 0 });
  b.box('carTrim', 0.02, 1.4, 0.03, halfW + 0.012, 1.12, dz0, { r: 0 });
  b.box('carTrim', 0.02, 1.4, 0.03, halfW + 0.012, 1.12, dz1, { r: 0 });
  b.box('carInterior', 0.5, 0.42, 0.65, halfW - 0.3, 0.75, (dz0 + dz1) / 2 - 0.1, { r: 0.03 });
  b.box('aluminum', 0.3, 0.04, dz1 - dz0, halfW + 0.12, 0.32, (dz0 + dz1) / 2, { r: 0.01 });
  b.cylinder('chrome', 0.014, 0.014, 0.9, halfW + 0.03, 1.25, dz1 - 0.06, { seg: 8 });
  // Pintu geser (terbuka) bertumpuk di luar sisi belakangnya.
  sidePanel(b, paint, [[dz1 + 0.02, 0.42], [dz1 + 0.02, 1.8], [dz1 + 0.84, 1.8], [dz1 + 0.84, 0.42]].map(([z, y]) => [z - 1.75, y] as P), 1, () => halfW + 0.04, 0, 0.03);
  sidePanel(b, 'carGlass', [[-0.83, 1.24], [-0.83, 1.76], [-0.13, 1.76], [-0.13, 1.24]], 1, () => halfW + 0.058, 0);
  // Kaca belakang, bemper krom depan, bemper belakang, gril, pelat kuning.
  b.box('carGlass', halfW * 2 - 0.3, 0.55, 0.012, 0, 1.5, -2.015, { r: 0 });
  b.box('chrome', halfW * 2 + 0.04, 0.12, 0.1, 0, 0.46, 2.04, { r: 0.03 });
  b.box('carTrim', halfW * 2 + 0.02, 0.12, 0.1, 0, 0.46, -2.04, { r: 0.03 });
  b.box('carTrim', 0.7, 0.16, 0.03, 0, 0.82, 2.025, { r: 0.01 });
  for (let k = 0; k < 4; k++) b.box('chrome', 0.66, 0.012, 0.01, 0, 0.77 + k * 0.035, 2.042, { r: 0 });
  plate(b, 'plateYellow', 0.6, 2.04, 1);
  plate(b, 'plateYellow', 0.62, -2.03, -1);
  // Papan trayek di atap depan (peta kanvas: material `angkotSign`).
  b.box('carTrim', 0.98, 0.24, 0.07, 0, 2.08, 1.36, { r: 0.015 });
  b.add('angkotSign', new THREE.BoxGeometry(0.92, 0.18, 0.012), 0, 2.08, 1.4);
  for (const a of arches) b.add('carTrim', archLiner(a.r - 0.012, halfW * 2 - 0.16), 0, a.cy, a.z);
}

// ------------------------------------------------------------------ Mobil boks distributor

/**
 * Mobil boks (kabin di atas roda depan + bak aluminium berusuk): kaca depan besar yang benar-benar terlihat,
 * lampu depan & gril, bemper, spion berlengan, kaca pintu; bak dengan rangka sudut, panel seng gelombang
 * aluminium, pintu belakang dua daun dengan palang pengunci, lampu belakang di bemper; sasis & tangki.
 */
function vanBody(b: B, paint: MatKey) {
  const halfW = 0.86;
  const top: P[] = [
    [0.66, 0.42],
    [0.66, 1.96],
    [0.78, 2.04],
    [1.96, 2.04],
    [2.1, 1.97],
    [2.36, 1.16],
    [2.44, 1.04],
    [2.46, 0.56],
    [2.4, 0.42],
  ];
  const cab = extrude(sideShape(top, 0.36, [{ z: 1.72, r: 0.4, cy: 0.36 }]), halfW * 2, 0.07);
  b.add(paint, sculpt(cab, { zFront: 2.46, zRear: 0.66, nose: 0.06, noseLen: 0.5, tail: 0, tailLen: 0.1 }), 0, 0, 0);
  b.add('carTrim', archLiner(0.388, halfW * 2 - 0.16), 0, 0.36, 1.72);
  const xAt = () => halfW + 0.004;
  slopedGlass(b, 'carGlass', [2.35, 1.2], [2.11, 1.93], halfW * 2 - 0.18, 1);
  for (const side of [1, -1] as const) {
    sidePanel(b, 'carGlass', [[2.24, 1.24], [2.05, 1.88], [1.32, 1.88], [1.32, 1.24]], side, xAt, 0);
    b.box('carTrim', 0.008, 1.45, 0.008, side * (halfW + 0.002), 1.2, 1.22, { r: 0 });
    b.box('carTrim', 0.02, 0.03, 0.13, side * (halfW + 0.002), 1.15, 1.32, { r: 0.008 });
    b.box('carTrim', 0.42, 0.24, 0.08, side * 0.6, 0.86, 2.43, { r: 0.03 });
    b.box('carLamp', 0.38, 0.19, 0.03, side * 0.6, 0.86, 2.47, { r: 0.02 });
    b.box('amberLens', 0.1, 0.06, 0.03, side * 0.81, 0.86, 2.42, { r: 0.01, rotY: side * 0.6 });
    mirror(b, 'carTrim', side, side * (halfW - 0.02), 1.5, 2.12, true);
    b.box('carTrim', 0.32, 0.025, 0.025, side * (halfW + 0.12), 1.42, 2.16, { r: 0 });
  }
  b.box('carTrim', 1.0, 0.24, 0.04, 0, 1.03, 2.44, { r: 0.02 });
  b.cylinder('chrome', 0.06, 0.06, 0.02, 0, 1.03, 2.465, { rotX: Math.PI / 2, seg: 16 });
  b.box('carTrim', halfW * 2 + 0.06, 0.2, 0.16, 0, 0.5, 2.47, { r: 0.04 });
  plate(b, 'carPlate', 0.5, 2.56, 1);
  // Sasis, tangki, roda belakang (lengkung = spakbor), bak boks.
  b.box('carTrim', 0.16, 0.14, 3.2, 0.42, 0.62, -0.95, { r: 0.01 });
  b.box('carTrim', 0.16, 0.14, 3.2, -0.42, 0.62, -0.95, { r: 0.01 });
  b.box('carTrim', 0.5, 0.3, 0.5, -0.6, 0.55, -0.1, { r: 0.03 });
  const bz0 = -2.42;
  const bz1 = 0.58;
  const by0 = 0.72;
  const by1 = 2.4;
  const bw = 1.84;
  b.box('zincSheet', bw, by1 - by0, bz1 - bz0, 0, (by0 + by1) / 2, (bz0 + bz1) / 2, { r: 0.015 });
  // Rangka sudut, lis atas & bawah bak.
  for (const sx of [-1, 1])
    for (const z of [bz0, bz1]) b.box('aluminum', 0.06, by1 - by0 + 0.02, 0.06, sx * (bw / 2), (by0 + by1) / 2, z, { r: 0.01 });
  for (const y of [by0, by1]) for (const sx of [-1, 1]) b.box('aluminum', 0.05, 0.06, bz1 - bz0, sx * (bw / 2), y, (bz0 + bz1) / 2, { r: 0.01 });
  b.box('aluminum', bw, 0.05, 0.05, 0, by1, bz1, { r: 0.01 });
  // Spakbor & pelindung lumpur roda belakang.
  for (const sx of [-1, 1]) {
    b.box('carTrim', 0.3, 0.05, 0.86, sx * 0.79, 0.74, -1.5, { r: 0.015 });
    b.box('carTrim', 0.26, 0.24, 0.012, sx * 0.79, 0.3, -2.0, { r: 0 });
  }
  // Pintu belakang dua daun: sambungan, engsel, palang pengunci + gagang.
  const rz = bz0 - 0.008;
  b.box('aluminum', 0.03, by1 - by0 - 0.06, 0.012, 0, (by0 + by1) / 2, rz, { r: 0 });
  for (const sx of [-1, 1]) {
    for (const y of [by0 + 0.25, (by0 + by1) / 2, by1 - 0.25]) b.box('metalDark', 0.06, 0.1, 0.03, sx * (bw / 2 - 0.05), y, rz - 0.01, { r: 0.006 });
    for (const x of [sx * 0.42, sx * 0.14]) {
      b.cylinder('chrome', 0.014, 0.014, by1 - by0 - 0.1, x, (by0 + by1) / 2, rz - 0.03, { seg: 8 });
      b.box('chrome', 0.05, 0.16, 0.03, x + sx * 0.03, by0 + 0.62, rz - 0.04, { r: 0.008 });
    }
  }
  // Bemper belakang berlampu.
  b.box('carTrim', bw, 0.12, 0.12, 0, 0.5, bz0 - 0.08, { r: 0.02 });
  for (const sx of [-1, 1]) {
    b.box('ledRed', 0.22, 0.09, 0.04, sx * 0.7, 0.5, bz0 - 0.15, { r: 0.012 });
    b.box('amberLens', 0.09, 0.09, 0.04, sx * 0.52, 0.5, bz0 - 0.15, { r: 0.012 });
  }
  plate(b, 'carPlate', 0.66, bz0 - 0.03, -1);
}

/** Bodi kendaraan (tanpa roda). `paint` = material cat (instanceColor untuk lalu lintas). */
export function vehicleBody(b: B, kind: VehicleKind, paint: MatKey) {
  if (kind === 'mpv') carBody(b, MPV_DESIGN, paint);
  else if (kind === 'hatch') carBody(b, HATCH_DESIGN, paint);
  else if (kind === 'angkot') angkotBody(b, paint);
  else vanBody(b, paint);
}

// ------------------------------------------------------------------ Tekstur pelat & papan trayek

const PLATE_TEXT = ['B 1729 KRN', 'D 4410 SA', 'B 2381 TQW', 'F 1964 GH', 'B 6052 UV'];

/** Atlas pelat nomor fiktif (latar putih standar baru / kuning angkutan umum, huruf hitam, tepi timbul). */
export function plateTexture(kind: 'white' | 'yellow'): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = kind === 'white' ? '#f4f4f0' : '#f1c40f';
  ctx.fillRect(0, 0, 256, 64);
  ctx.strokeStyle = '#1b1b1b';
  ctx.lineWidth = 5;
  ctx.strokeRect(4, 4, 248, 56);
  ctx.fillStyle = '#141414';
  ctx.font = '700 36px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(kind === 'white' ? PLATE_TEXT[0] : 'D 7105 AT', 128, 30);
  ctx.font = '600 10px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('09 . 30', 128, 54);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Papan trayek angkot (fiktif). */
export function angkotSignTexture(): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 100;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#fbfaf4';
  ctx.fillRect(0, 0, 512, 100);
  ctx.fillStyle = '#b91c1c';
  ctx.fillRect(0, 0, 110, 100);
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 64px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('05', 55, 52);
  ctx.fillStyle = '#1f2937';
  ctx.font = '700 34px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('MELATI – TERMINAL', 311, 52);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

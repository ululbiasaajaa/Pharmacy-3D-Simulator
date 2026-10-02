import * as THREE from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { wheelGeometries, type WheelGeometries } from './wheelModels';
import type { GeoBuilder } from '@/game/visual/geometry';
import type { MatKey } from './materials';

/**
 * Model jalan "aset buatan sendiri" (ART_DIRECTION.md §9) untuk objek khas Indonesia yang tidak
 * tersedia sebagai aset CC0: pohon ketapang kencana (tajuk bertingkat dari kartu daun) dan motor matik.
 */
type B = GeoBuilder<MatKey>;

function rng(seed: number) {
  let r = seed * 9301 + 49297;
  return () => {
    r = (r * 9301 + 49297) % 233280;
    return r / 233280;
  };
}

// ------------------------------------------------------------------ Tekstur kartu daun

/** Atlas kartu daun (rumpun daun ketapang) digambar di kanvas — transparan di luar daun. */
export function drawLeafAtlas(size = 512): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  const rnd = rng(7);
  const leaf = (x: number, y: number, ang: number, len: number, wid: number, hue: number, light: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    const g = ctx.createLinearGradient(0, 0, len, 0);
    g.addColorStop(0, `hsl(${hue}, 48%, ${light - 8}%)`);
    g.addColorStop(1, `hsl(${hue + 6}, 52%, ${light + 6}%)`);
    ctx.fillStyle = g;
    // Daun bulat telur sungsang (obovate): sempit di pangkal, lebar di ujung.
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(len * 0.35, -wid * 0.35, len * 0.8, -wid * 0.75, len, 0);
    ctx.bezierCurveTo(len * 0.8, wid * 0.75, len * 0.35, wid * 0.35, 0, 0);
    ctx.fill();
    ctx.strokeStyle = `hsla(${hue + 10}, 40%, ${light + 18}%, 0.55)`;
    ctx.lineWidth = Math.max(1, wid * 0.06);
    ctx.beginPath();
    ctx.moveTo(len * 0.05, 0);
    ctx.lineTo(len * 0.92, 0);
    ctx.stroke();
    ctx.restore();
  };
  // Rumpun (whorl) daun di ujung ranting, beberapa rumpun per kartu.
  const clusters = 24;
  for (let k = 0; k < clusters; k++) {
    const a0 = rnd() * Math.PI * 2;
    const r0 = Math.sqrt(rnd()) * size * 0.33;
    const cx = size / 2 + Math.cos(a0) * r0;
    const cy = size / 2 + Math.sin(a0) * r0;
    const n = 6 + Math.floor(rnd() * 4);
    const len = size * (0.1 + rnd() * 0.045);
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + rnd() * 0.5;
      const hue = 86 + rnd() * 26;
      const light = 26 + rnd() * 16 + (rnd() < 0.08 ? 18 : 0);
      leaf(cx, cy, ang, len * (0.8 + rnd() * 0.4), len * 0.5, hue, light);
    }
  }
  return c;
}

// ------------------------------------------------------------------ Pohon ketapang kencana

const UP = new THREE.Vector3(0, 1, 0);

/**
 * Pohon ketapang kencana: batang lurus, cabang mendatar dalam beberapa tingkat (tajuk pagoda).
 * Daun = kartu bertekstur dengan normal dimiringkan ke luar tajuk agar shading lembut seperti rimbun.
 */
export function ketapangTree(b: B, x: number, z: number, seed: number, scale = 1) {
  const rnd = rng(seed);
  const H = (5.6 + rnd() * 1.2) * scale;
  b.cylinder('concrete', 0.55, 0.6, 0.4, x, 0.2, z, { seg: 18 });
  b.cylinder('soil', 0.5, 0.5, 0.02, x, 0.39, z, { seg: 18 });
  b.cylinder('trunk', 0.08 * scale, 0.15 * scale, H, x, H / 2, z, { seg: 10 });
  const tiers = 5;
  const cards: THREE.BufferGeometry[] = [];
  for (let t = 0; t < tiers; t++) {
    const k = t / (tiers - 1);
    const y = H * (0.42 + k * 0.52);
    const R = (2.4 - k * 1.7) * scale * (0.9 + rnd() * 0.2);
    const branches = 5 + Math.floor(rnd() * 2);
    const rot = rnd() * Math.PI * 2;
    for (let i = 0; i < branches; i++) {
      const a = rot + (i / branches) * Math.PI * 2 + (rnd() - 0.5) * 0.4;
      const len = R * (0.75 + rnd() * 0.25);
      const dir = new THREE.Vector3(Math.cos(a), 0.06, Math.sin(a));
      // Cabang mendatar sedikit naik.
      b.cylinder('trunk', 0.018 * scale, 0.04 * scale, len, x + (dir.x * len) / 2, y + 0.03 * len, z + (dir.z * len) / 2, { rotY: -a, rotZ: -Math.PI / 2 + 0.06, seg: 5 });
      // Kartu daun di sepanjang & ujung cabang.
      const n = 6 + Math.floor(rnd() * 3);
      for (let j = 0; j < n; j++) {
        const d = len * (0.2 + (j / n) * 0.9);
        const cx = x + Math.cos(a) * d + (rnd() - 0.5) * 0.3;
        const cz = z + Math.sin(a) * d + (rnd() - 0.5) * 0.3;
        const cy = y + 0.05 * d + (rnd() - 0.5) * 0.18;
        const s = (1.25 + rnd() * 0.7) * scale * (1 - k * 0.3);
        cards.push(leafCard(new THREE.Vector3(cx, cy, cz), s, rnd() * Math.PI, (rnd() - 0.5) * 0.9, new THREE.Vector3(x, cy - 0.6, z)));
      }
    }
    // Kartu bagian dalam tajuk agar tingkat tidak tampak berlubang.
    for (let i = 0; i < 4; i++) {
      const a = rnd() * Math.PI * 2;
      const d = R * (0.15 + rnd() * 0.35);
      cards.push(leafCard(new THREE.Vector3(x + Math.cos(a) * d, y + (rnd() - 0.5) * 0.25, z + Math.sin(a) * d), (1.3 + rnd() * 0.5) * scale * (1 - k * 0.3), rnd() * Math.PI, (rnd() - 0.5) * 0.6, new THREE.Vector3(x, y - 0.6, z)));
    }
  }
  // Pucuk.
  cards.push(leafCard(new THREE.Vector3(x, H + 0.1, z), 0.9 * scale, rnd() * Math.PI, 0.2, new THREE.Vector3(x, H - 0.5, z)));
  for (const g of cards) b.add('leafCard', g);
}

/** Satu kartu daun hampir mendatar; normal verteks diarahkan menjauh dari pusat tajuk. */
function leafCard(center: THREE.Vector3, size: number, yaw: number, tilt: number, crownCenter: THREE.Vector3) {
  const g = new THREE.PlaneGeometry(size, size);
  g.rotateX(-Math.PI / 2 + tilt);
  g.rotateY(yaw);
  g.translate(center.x, center.y, center.z);
  const pos = g.getAttribute('position');
  const nrm = g.getAttribute('normal');
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).sub(crownCenter).normalize().lerp(UP, 0.45).normalize();
    nrm.setXYZ(i, v.x, v.y, v.z);
  }
  return g;
}

// ------------------------------------------------------------------ Motor matik

/** Profil halus: titik kontrol dibulatkan dengan kurva Catmull-Rom tertutup (tanpa titik penutup ganda). */
export function smooth(points: [number, number][], samples = 32): [number, number][] {
  const curve = new THREE.CatmullRomCurve3(
    points.map(([a, c]) => new THREE.Vector3(a, c, 0)),
    true,
    'centripetal',
  );
  return curve
    .getPoints(samples)
    .slice(0, -1)
    .map((p) => [p.x, p.y]);
}

/**
 * Panel bodi: profil samping (panjang z, tinggi y) diekstrusi selebar `width` (sumbu X) dengan tepi membulat
 * ke DALAM (siluet = profil). `k(y, z)` membentuk denah (meruncing ke moncong/buritan, menyempit ke bawah),
 * lalu normal dihaluskan dengan sudut lipat. Panjang searah +Z lokal.
 */
function shell(points: [number, number][], width: number, bevel: number, k?: (y: number, z: number) => number, bevelSegments = 2) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
  shape.closePath();
  const depth = Math.max(0.002, width - bevel * 2);
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelOffset: -bevel, bevelSegments, curveSegments: 4 });
  g.translate(0, 0, -depth / 2);
  // Profil digambar di bidang (panjang, tinggi) → putar agar panjang searah +Z lokal.
  g.rotateY(-Math.PI / 2);
  if (k) {
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setX(i, pos.getX(i) * k(pos.getY(i), pos.getZ(i)));
  }
  const out = toCreasedNormals(g, Math.PI / 4);
  g.dispose();
  return out;
}

/** Spakbor: busur cincin di sekeliling as roda (sudut dari +Z ke atas), diekstrusi selebar `width`. */
function fenderArc(r0: number, r1: number, a0: number, a1: number, width: number, seg = 8) {
  const pts: [number, number][] = [];
  for (let i = 0; i <= seg; i++) pts.push([Math.cos(a0 + ((a1 - a0) * i) / seg) * r1, Math.sin(a0 + ((a1 - a0) * i) / seg) * r1]);
  for (let i = seg; i >= 0; i--) pts.push([Math.cos(a0 + ((a1 - a0) * i) / seg) * r0, Math.sin(a0 + ((a1 - a0) * i) / seg) * r0]);
  return shell(pts, width, Math.min(0.008, (r1 - r0) / 3), undefined, 1);
}

/**
 * Panel tipis yang menempel pada sebagian tepi profil (titik terdekat `from` → `to`, searah urutan profil):
 * permukaan luar terangkat `lift` dari tepi, tebal `t` ke dalam (mis. pelindung kaki dalam yang hitam).
 */
function skin(profile: [number, number][], from: [number, number], to: [number, number], lift: number, t: number): [number, number][] {
  const near = (q: [number, number]) => profile.reduce((best, p, i) => (Math.hypot(p[0] - q[0], p[1] - q[1]) < Math.hypot(profile[best][0] - q[0], profile[best][1] - q[1]) ? i : best), 0);
  const n = profile.length;
  const i0 = near(from);
  const i1 = near(to);
  const idx: number[] = [];
  for (let i = i0; ; i = (i + 1) % n) {
    idx.push(i);
    if (i === i1) break;
  }
  // Orientasi profil (rumus tali sepatu) menentukan arah normal keluar.
  let area = 0;
  for (let i = 0; i < n; i++) area += profile[i][0] * profile[(i + 1) % n][1] - profile[(i + 1) % n][0] * profile[i][1];
  const sgn = area > 0 ? 1 : -1;
  const outer: [number, number][] = [];
  const inner: [number, number][] = [];
  for (const i of idx) {
    const a = profile[(i - 1 + n) % n];
    const c = profile[(i + 1) % n];
    const tz = c[0] - a[0];
    const ty = c[1] - a[1];
    const len = Math.hypot(tz, ty) || 1;
    const nz = (sgn * ty) / len;
    const ny = (-sgn * tz) / len;
    outer.push([profile[i][0] + nz * lift, profile[i][1] + ny * lift]);
    inner.push([profile[i][0] - nz * t, profile[i][1] - ny * t]);
  }
  return [...outer, ...inner.reverse()];
}

function tube(points: [number, number, number][], r: number, seg = 14, radial = 6) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z))), seg, r, radial, false);
}

const ss = THREE.MathUtils.smoothstep;
/** Denah panel depan: moncong menyempit (V), menyempit ke dek kaki & ke batok setang. */
const kFront = (y: number, z: number) => (1 - 0.6 * ss(z, 0.42, 0.8)) * (1 - 0.25 * (1 - ss(y, 0.33, 0.5))) * (1 - 0.15 * ss(y, 0.9, 1.0));
/** Denah bodi belakang: meruncing ke buritan, menyempit ke depan (dek) & ke bawah. */
const kRear = (y: number, z: number) => (1 - 0.55 * ss(-z, 0.6, 0.97) - 0.2 * (1 - ss(-z, 0.08, 0.3))) * (1 - 0.25 * (1 - ss(y, 0.35, 0.55)));

// Proporsi motor matik 110–125 cc (kelas skuter terlaris di Indonesia): panjang ±1,87 m, jarak sumbu roda
// ±1,25 m, tinggi jok ±0,75 m, ban 14 inci (diameter luar ±0,52 m), lebar setang ±0,68 m.
// Sumbu lokal: moncong di +Z, +X = sisi kiri pengendara (bak CVT & sokbreker), −X = sisi kanan (knalpot).
const WHEEL_R = 0.26;
const FRONT_Z = 0.63;
const REAR_Z = -0.62;

// Cover depan + pelindung kaki (satu panel): moncong ramping berbentuk V, lampu di muka depan.
const FRONT_BODY = smooth([
  [0.33, 0.33],
  [0.39, 0.41],
  [0.45, 0.535],
  [0.57, 0.6],
  [0.7, 0.6],
  [0.775, 0.635],
  [0.765, 0.73],
  [0.69, 0.86],
  [0.6, 0.955],
  [0.52, 0.985],
  [0.455, 0.955],
  [0.42, 0.84],
  [0.385, 0.66],
  [0.355, 0.49],
]);
// Batok setang dengan panel spidometer menghadap pengendara.
const BAR_COVER = smooth(
  [
    [0.37, 0.985],
    [0.41, 1.045],
    [0.5, 1.075],
    [0.62, 1.06],
    [0.69, 1.01],
    [0.64, 0.965],
    [0.5, 0.95],
  ],
  20,
);
// Bodi belakang: naik dari dek kaki ke bawah jok, meruncing ke buritan (lampu belakang di ujung).
const REAR_BODY = smooth(
  [
    [-0.1, 0.49],
    [-0.085, 0.58],
    [-0.15, 0.665],
    [-0.4, 0.705],
    [-0.7, 0.72],
    [-0.9, 0.745],
    [-0.965, 0.7],
    [-0.945, 0.63],
    [-0.82, 0.585],
    [-0.6, 0.565],
    [-0.4, 0.53],
    [-0.22, 0.49],
  ],
  32,
);
// Cover bawah (hitam) antara dek kaki dan bodi belakang, di atas mesin.
const REAR_LOWER = smooth(
  [
    [-0.12, 0.33],
    [-0.06, 0.42],
    [-0.075, 0.53],
    [-0.2, 0.535],
    [-0.4, 0.545],
    [-0.5, 0.52],
    [-0.42, 0.47],
    [-0.3, 0.39],
    [-0.22, 0.34],
  ],
  20,
);
// Garis dekorasi (stiker) menyapu sepanjang sisi bodi belakang.
const STRIPE: [number, number][] = [
  [-0.17, 0.605],
  [-0.5, 0.64],
  [-0.84, 0.685],
  [-0.9, 0.672],
  [-0.5, 0.618],
  [-0.19, 0.588],
];
// Jok panjang: cekungan pengendara, bagian boncengan sedikit lebih tinggi.
const SEAT = smooth(
  [
    [-0.13, 0.69],
    [-0.14, 0.745],
    [-0.22, 0.778],
    [-0.46, 0.766],
    [-0.66, 0.795],
    [-0.84, 0.81],
    [-0.9, 0.787],
    [-0.885, 0.735],
    [-0.6, 0.712],
    [-0.3, 0.692],
  ],
  28,
);
// Bak CVT (sisi kiri) dari mesin sampai as roda belakang.
const CVT = smooth(
  [
    [-0.1, 0.22],
    [-0.09, 0.35],
    [-0.2, 0.43],
    [-0.45, 0.405],
    [-0.62, 0.36],
    [-0.71, 0.3],
    [-0.69, 0.2],
    [-0.6, 0.165],
    [-0.4, 0.175],
    [-0.2, 0.155],
  ],
  22,
);
// Spakbor belakang + dudukan pelat di bawah buritan.
const TAIL_GUARD = smooth(
  [
    [-0.8, 0.585],
    [-0.94, 0.6],
    [-1.0, 0.5],
    [-0.995, 0.41],
    [-0.965, 0.405],
    [-0.955, 0.5],
    [-0.88, 0.555],
  ],
  14,
);

interface ScooterParts {
  wheel: WheelGeometries;
  front: THREE.BufferGeometry;
  legInner: THREE.BufferGeometry;
  mask: THREE.BufferGeometry;
  rearLower: THREE.BufferGeometry;
  stripe: THREE.BufferGeometry;
  bar: THREE.BufferGeometry;
  rear: THREE.BufferGeometry;
  seat: THREE.BufferGeometry;
  cvt: THREE.BufferGeometry;
  guard: THREE.BufferGeometry;
  frontFender: THREE.BufferGeometry;
  hugger: THREE.BufferGeometry;
  grab: THREE.BufferGeometry;
  header: THREE.BufferGeometry;
  mirror: THREE.BufferGeometry;
  mirrorGlass: THREE.BufferGeometry;
}

let scooterGeo: ScooterParts | null = null;
/** Geometri motor dibuat sekali (dipakai semua motor parkir & motor karyawan). */
function scooterParts(): ScooterParts {
  if (scooterGeo) return scooterGeo;
  scooterGeo = {
    // Motor parkir banyak & statis (digabung ke mesh kawasan) → roda detail rendah.
    wheel: wheelGeometries(WHEEL_R, 0.095, 0.66, 5, 0.3),
    front: shell(FRONT_BODY, 0.4, 0.03, kFront),
    // Pelindung kaki bagian dalam (hitam) & topeng depan gelap tempat lampu, menempel pada panel depan.
    legInner: shell(skin(FRONT_BODY, [0.455, 0.95], [0.335, 0.35], 0.006, 0.02), 0.4, 0.006, (y, z) => 0.8 * kFront(y, z), 1),
    mask: shell(skin(FRONT_BODY, [0.775, 0.64], [0.6, 0.952], 0.006, 0.02), 0.4, 0.006, (y, z) => 0.62 * kFront(y, z), 1),
    bar: shell(BAR_COVER, 0.4, 0.025, (_, z) => 1 - 0.5 * ss(z, 0.48, 0.69)),
    rear: shell(REAR_BODY, 0.34, 0.03, kRear),
    rearLower: shell(REAR_LOWER, 0.34, 0.03, (y, z) => 0.96 * kRear(y, z)),
    stripe: shell(STRIPE, 0.34, 0.003, (y, z) => 1.012 * kRear(y, z), 1),
    seat: shell(SEAT, 0.29, 0.035, (_, z) => 1 - 0.32 * (1 - ss(-z, 0.12, 0.36)) - 0.22 * ss(-z, 0.7, 0.92)),
    cvt: shell(CVT, 0.075, 0.02, undefined, 1),
    guard: shell(TAIL_GUARD, 0.15, 0.012, undefined, 1),
    frontFender: fenderArc(0.285, 0.31, 0.6, 2.2, 0.12),
    hugger: fenderArc(0.285, 0.3, 0.6, 1.9, 0.11, 6),
    // Begel (pegangan boncengan) melingkari buritan di belakang jok.
    grab: tube(
      [
        [0.135, 0.735, -0.7],
        [0.14, 0.765, -0.86],
        [0.09, 0.78, -0.955],
        [0, 0.785, -0.975],
        [-0.09, 0.78, -0.955],
        [-0.14, 0.765, -0.86],
        [-0.135, 0.735, -0.7],
      ],
      0.014,
      18,
    ),
    // Leher knalpot dari bawah mesin ke peredam di sisi kanan.
    header: tube(
      [
        [-0.03, 0.16, -0.06],
        [-0.09, 0.14, -0.2],
        [-0.15, 0.22, -0.34],
        [-0.165, 0.29, -0.4],
      ],
      0.018,
      10,
    ),
    // Kepala spion oval (sumbu tebal searah Z) & kacanya.
    mirror: new THREE.CylinderGeometry(0.04, 0.04, 0.02, 12).scale(1.5, 1, 1).rotateX(Math.PI / 2),
    mirrorGlass: new THREE.CylinderGeometry(0.033, 0.033, 0.004, 12).scale(1.5, 1, 1).rotateX(Math.PI / 2),
  };
  return scooterGeo;
}

/**
 * Motor matik (skuter) khas Indonesia, buatan sendiri: bodi panel meruncing (cover depan V, pelindung kaki,
 * bodi belakang, batok setang), jok, roda 14 inci berprofil dengan velg palang lima & cakram depan,
 * garpu teleskopik, spakbor, bak CVT + sokbreker (kiri), knalpot berpelindung panas (kanan), standar tengah,
 * begel, spion oval, lampu & sein (lensa tidak menyala — motor parkir), pelat hitam.
 * Panjang searah +Z lokal, roda depan di +Z; tapak ±0,35 × ±0,95 m (setang) di dalam collider `scooterFootprint`.
 */
export function scooterModel(b: B, x: number, z: number, rotY: number, body: MatKey) {
  b.group(x, 0, z, rotY, () => b.group(0, 0, SCOOTER_SHIFT, 0, () => scooterBody(b, body)));
}

/** Profil digambar dengan ujung spakbor belakang di z −1,0 & ban depan di +0,89 → digeser agar tapak simetris. */
const SCOOTER_SHIFT = 0.06;

function scooterBody(b: B, body: MatKey) {
  const P = scooterParts();
  // Roda: velg tampak di kedua sisi roda depan; sisi kiri roda belakang tertutup bak CVT.
  for (const wz of [FRONT_Z, REAR_Z]) {
    b.add('tireRubber', P.wheel.tire, 0, WHEEL_R, wz);
    b.add('metalDark', P.wheel.dark, 0, WHEEL_R, wz);
    b.add('rimAlloy', P.wheel.rim, 0, WHEEL_R, wz, { rotY: Math.PI });
  }
  b.add('rimAlloy', P.wheel.rim, 0, WHEEL_R, FRONT_Z);
  // Garpu teleskopik (kaki garpu + pipa bawah) dari as roda masuk ke cover depan; spakbor depan di antaranya.
  const rake = 0.28;
  for (const s of [-1, 1]) {
    b.cylinder('rimAlloy', 0.021, 0.021, 0.42, s * 0.072, WHEEL_R + 0.21 * Math.cos(rake), FRONT_Z - 0.21 * Math.sin(rake), { rotX: -rake, seg: 8 });
    b.cylinder('metalDark', 0.027, 0.027, 0.16, s * 0.072, WHEEL_R + 0.08 * Math.cos(rake), FRONT_Z - 0.08 * Math.sin(rake), { rotX: -rake, seg: 8 });
  }
  b.add(body, P.frontFender, 0, WHEEL_R, FRONT_Z);
  b.add('bikeBlack', P.hugger, 0, WHEEL_R, REAR_Z);
  // Panel bodi & jok.
  b.add(body, P.front, 0, 0, 0);
  b.add('bikeBlack', P.legInner, 0, 0, 0);
  b.add('bikeBlack', P.mask, 0, 0, 0);
  b.add(body, P.bar, 0, 0, 0);
  b.add(body, P.rear, 0, 0, 0);
  b.add('bikeBlack', P.rearLower, 0, 0, 0);
  b.add(body === 'bikeWhite' ? 'bikeRed' : 'white', P.stripe, 0, 0, 0);
  b.add('black', P.seat, 0, 0, 0);
  b.add('bikeBlack', P.guard, 0, 0, 0);
  b.add('metalDark', P.grab, 0, 0, 0);
  // Dek kaki: karet pijakan di atas rangka bawah; blok mesin di bawah bodi belakang.
  b.box('rubber', 0.28, 0.03, 0.46, 0, 0.345, 0.08, { r: 0.01 });
  b.box('bikeBlack', 0.31, 0.15, 0.52, 0, 0.265, 0.07, { r: 0.05 });
  b.box('metalDark', 0.2, 0.18, 0.26, 0, 0.25, -0.17, { r: 0.04 });
  // Bak CVT (kiri) + tutup puli & as; sokbreker belakang masuk ke bawah bodi.
  b.add('metalDark', P.cvt, 0.115, 0, 0);
  b.cylinder('rimAlloy', 0.07, 0.07, 0.012, 0.157, 0.29, -0.19, { rotZ: Math.PI / 2, seg: 14 });
  b.cylinder('rimAlloy', 0.04, 0.04, 0.012, 0.157, WHEEL_R, REAR_Z, { rotZ: Math.PI / 2, seg: 10 });
  b.cylinder('chrome', 0.011, 0.011, 0.28, 0.12, 0.47, -0.71, { rotX: -0.23, seg: 6 });
  b.cylinder('metalDark', 0.024, 0.024, 0.13, 0.12, 0.535, -0.725, { rotX: -0.23, seg: 8 });
  // Knalpot (kanan): leher, peredam miring naik ke belakang, pelindung panas, ujung krom.
  b.add('metalDark', P.header, 0, 0, 0);
  b.cylinder('metalDark', 0.055, 0.05, 0.38, -0.165, 0.33, -0.58, { rotX: Math.PI / 2 + 0.15, seg: 10 });
  b.box('bikeBlack', 0.02, 0.085, 0.3, -0.222, 0.335, -0.57, { r: 0, rotX: 0.15 });
  b.cylinder('chrome', 0.034, 0.034, 0.03, -0.165, 0.36, -0.775, { rotX: Math.PI / 2 + 0.15, seg: 10 });
  // Standar tengah (terpasang: motor parkir tegak) & pijakan boncengan terlipat.
  for (const s of [-1, 1]) {
    b.cylinder('metalDark', 0.012, 0.012, 0.2, s * 0.1, 0.094, -0.27, { rotX: 0.53, seg: 6 });
    b.box('black', 0.03, 0.045, 0.11, s * 0.175, 0.42, -0.4, { r: 0 });
  }
  b.cylinder('metalDark', 0.012, 0.012, 0.24, 0, 0.012, -0.32, { rotZ: Math.PI / 2, seg: 6 });
  // Setang: pipa, grip karet, tuas rem, saklar; spion bertangkai miring keluar + kepala oval.
  b.cylinder('metalDark', 0.012, 0.012, 0.6, 0, 1.02, 0.47, { rotZ: Math.PI / 2, seg: 6 });
  for (const s of [-1, 1]) {
    b.cylinder('rubber', 0.018, 0.018, 0.11, s * 0.29, 1.02, 0.47, { rotZ: Math.PI / 2, seg: 8 });
    b.box('metalDark', 0.12, 0.012, 0.018, s * 0.26, 1.03, 0.52, { r: 0, rotY: -s * 0.18 });
    b.box('black', 0.05, 0.04, 0.05, s * 0.205, 1.035, 0.48, { r: 0 });
    b.cylinder('metalDark', 0.007, 0.007, 0.17, s * 0.222, 1.115, 0.455, { rotZ: -s * 0.39, seg: 5 });
    b.add('bikeBlack', P.mirror, s * 0.256, 1.21, 0.447);
    b.add('rimAlloy', P.mirrorGlass, s * 0.256, 1.21, 0.436);
  }
  // Panel spidometer di batok, menghadap pengendara.
  b.box('black', 0.15, 0.075, 0.01, 0, 1.035, 0.395, { r: 0, rotX: 0.67 });
  // Lampu depan (reflektor alloy di balik kaca, tidak menyala; pantulan ikut redup saat malam) + sein; lampu belakang & sein di ujung buritan.
  b.box('rimAlloy', 0.11, 0.065, 0.02, 0, 0.8, 0.738, { r: 0, rotX: -0.55 });
  for (const s of [-1, 1]) b.box('tankOrange', 0.035, 0.03, 0.02, s * 0.083, 0.86, 0.7, { r: 0, rotX: -0.6, rotY: s * 0.45 });
  b.box('bikeRed', 0.1, 0.045, 0.02, 0, 0.665, -0.952, { r: 0, rotX: -0.25 });
  for (const s of [-1, 1]) b.box('tankOrange', 0.028, 0.04, 0.02, s * 0.062, 0.66, -0.945, { r: 0, rotY: s * 0.5 });
  // Pelat nomor belakang (hitam, khas Indonesia) pada spakbor belakang.
  b.box('black', 0.22, 0.08, 0.008, 0, 0.455, -1.003, { r: 0, rotX: 0.06 });
  b.box('white', 0.18, 0.012, 0.003, 0, 0.462, -1.008, { r: 0, rotX: 0.06 });
  b.box('white', 0.12, 0.008, 0.003, 0, 0.437, -1.007, { r: 0, rotX: 0.06 });
}

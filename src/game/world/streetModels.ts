import * as THREE from 'three';
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

/** Profil samping (panjang z, tinggi y) diekstrusi selebar `width` dengan tepi membulat; panjang searah +Z lokal. */
export function extrudeSide(points: [number, number][], width: number, bevel: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: width - bevel * 2, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 6 });
  g.translate(0, 0, -(width - bevel * 2) / 2);
  // Profil digambar di bidang (panjang, tinggi) → putar agar panjang searah +Z lokal.
  g.rotateY(-Math.PI / 2);
  return g;
}

/** Profil halus: titik kontrol dibulatkan dengan kurva Catmull-Rom tertutup. */
export function smooth(points: [number, number][], samples = 40): [number, number][] {
  const curve = new THREE.CatmullRomCurve3(
    points.map(([a, c]) => new THREE.Vector3(a, c, 0)),
    true,
    'centripetal',
  );
  return curve.getPoints(samples).map((p) => [p.x, p.y]);
}

// Profil samping (panjang z, tinggi y) dirujuk dari proporsi motor matik 110–125 cc:
// jarak sumbu roda ±1,25 m, tinggi jok ±0,76 m, panjang ±1,85 m.
const REAR_BODY = smooth([
  [-0.95, 0.6],
  [-0.9, 0.68],
  [-0.5, 0.7],
  [-0.16, 0.64],
  [-0.09, 0.5],
  [-0.22, 0.38],
  [-0.62, 0.38],
  [-0.9, 0.5],
]);
const LEG_SHIELD = smooth([
  [0.27, 0.34],
  [0.38, 0.34],
  [0.48, 0.58],
  [0.53, 0.86],
  [0.47, 0.95],
  [0.41, 0.9],
  [0.34, 0.66],
  [0.29, 0.48],
]);
const FRONT_APRON = smooth([
  [0.47, 0.58],
  [0.6, 0.64],
  [0.65, 0.86],
  [0.58, 0.98],
  [0.5, 0.94],
]);
const SEAT = smooth([
  [-0.88, 0.69],
  [-0.64, 0.79],
  [-0.22, 0.78],
  [-0.1, 0.7],
  [-0.42, 0.68],
]);

/** Motor matik (skuter) khas Indonesia; panjang searah +Z lokal, roda depan di +Z. */
export function scooterModel(b: B, x: number, z: number, rotY: number, body: MatKey) {
  b.group(x, 0, z, rotY, () => {
    // Roda: ban (torus) + pelek palang lima + tromol.
    for (const wz of [-0.64, 0.66]) {
      b.add('tire', new THREE.TorusGeometry(0.205, 0.068, 10, 24), 0, 0.272, wz, { rotY: Math.PI / 2 });
      b.cylinder('metalDark', 0.15, 0.15, 0.07, 0, 0.272, wz, { rotZ: Math.PI / 2, seg: 18 });
      b.cylinder('chrome', 0.06, 0.06, 0.1, 0, 0.272, wz, { rotZ: Math.PI / 2, seg: 12 });
    }
    // Bodi belakang, pelindung kaki, apron depan, dan jok.
    b.add(body, extrudeSide(REAR_BODY, 0.27, 0.045), 0, 0, 0);
    b.add(body, extrudeSide(LEG_SHIELD, 0.3, 0.035), 0, 0, 0);
    b.add(body, extrudeSide(FRONT_APRON, 0.2, 0.04), 0, 0, 0);
    b.add('bikeBlack', extrudeSide(SEAT, 0.25, 0.035), 0, 0, 0);
    // Dek kaki & rangka bawah.
    b.box('bikeBlack', 0.3, 0.05, 0.56, 0, 0.32, 0.08, { r: 0.02 });
    b.box('bikeBlack', 0.2, 0.18, 0.5, 0, 0.42, -0.42, { r: 0.04 });
    // Spakbor depan di atas roda.
    b.add(body, new THREE.TorusGeometry(0.29, 0.05, 6, 16, Math.PI * 0.85), 0, 0.27, 0.66, { rotY: Math.PI / 2, rotZ: Math.PI * 0.05 });
    // Garpu depan (dua batang miring) & kepala setang.
    for (const s of [-1, 1]) b.cylinder('chrome', 0.02, 0.02, 0.56, s * 0.08, 0.55, 0.6, { rotX: -0.3, seg: 8 });
    b.box(body, 0.34, 0.1, 0.17, 0, 1.0, 0.5, { r: 0.045, rotX: -0.2 });
    b.cylinder('metalDark', 0.014, 0.014, 0.6, 0, 1.03, 0.46, { rotZ: Math.PI / 2, seg: 8 });
    for (const s of [-1, 1]) {
      b.cylinder('rubber', 0.019, 0.019, 0.1, s * 0.26, 1.03, 0.46, { rotZ: Math.PI / 2, seg: 8 });
      // Spion: tangkai pendek + kaca kecil.
      b.cylinder('metalDark', 0.006, 0.006, 0.17, s * 0.17, 1.12, 0.45, { rotZ: -s * 0.3, seg: 5 });
      b.box('bikeBlack', 0.085, 0.05, 0.014, s * 0.2, 1.2, 0.45, { r: 0.012 });
    }
    // Lampu depan, lampu belakang, knalpot, pegangan belakang.
    b.box('lampGlow', 0.13, 0.06, 0.03, 0, 0.94, 0.6, { r: 0.02, rotX: -0.3 });
    b.box('ledRed', 0.18, 0.05, 0.03, 0, 0.66, -0.93, { r: 0.015 });
    b.cylinder('chrome', 0.045, 0.05, 0.42, -0.17, 0.32, -0.55, { rotX: Math.PI / 2 - 0.12, seg: 12 });
    b.box('bikeBlack', 0.05, 0.1, 0.3, -0.21, 0.36, -0.55, { r: 0.02 });
    b.box('metalDark', 0.28, 0.025, 0.04, 0, 0.8, -0.86, { r: 0.01 });
    // Pelat nomor belakang (hitam, khas Indonesia) & standar samping.
    b.box('black', 0.26, 0.09, 0.01, 0, 0.5, -0.97, { r: 0.004, rotX: 0.15 });
    b.box('white', 0.22, 0.012, 0.003, 0, 0.505, -0.975, { r: 0, rotX: 0.15 });
    b.cylinder('metalDark', 0.012, 0.012, 0.32, -0.17, 0.15, -0.05, { rotZ: 0.55, seg: 5 });
  });
}

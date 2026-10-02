import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Geometri roda kendaraan buatan sendiri (dipakai mobil, angkot, mobil boks, motor):
 * - ban: profil lathe dengan dinding samping cembung, bahu membulat, dan tiga alur tapak;
 * - velg: muka alloy berpalang (lubang sungguhan di antara palang, sehingga cakram rem terlihat), tutup tengah;
 * - bagian gelap: tong velg, cakram rem, kaliper.
 * Sumbu putar = X, sisi luar menghadap +X, pusat di titik asal. Dibuat sekali lalu dipakai bersama (instancing).
 */
export interface WheelGeometries {
  tire: THREE.BufferGeometry;
  rim: THREE.BufferGeometry;
  dark: THREE.BufferGeometry;
}

/** Jari-jari & lebar ban dasar (mobil penumpang 185/65 R15); varian lain diskalakan. */
export const WHEEL_BASE_R = 0.315;
export const WHEEL_BASE_W = 0.195;

function keepPNU(g: THREE.BufferGeometry) {
  for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
  return g.index ? g.toNonIndexed() : g;
}

function merge(list: THREE.BufferGeometry[]) {
  const g = mergeGeometries(list.map(keepPNU), false)!;
  list.forEach((x) => x.dispose());
  g.computeBoundingSphere();
  return g;
}

/** Muka velg berpalang: lingkaran dengan `spokes` lubang berbentuk sektor cincin di antara palang. */
function rimFace(rr: number, spokes: number, depth: number, spokeGap = 0.21, curveSegments = 28, bevel = true) {
  const face = new THREE.Shape();
  face.absarc(0, 0, rr, 0, Math.PI * 2, false);
  // Busur lubang ditulis sebagai titik eksplisit dengan kerapatan sudut yang sama dengan lingkar luar
  // (absarc selalu memakai 2 × curveSegments titik per busur berapa pun panjangnya → segitiga terbuang).
  const perRad = (curveSegments * 2) / (Math.PI * 2);
  for (let k = 0; k < spokes; k++) {
    const a0 = (k / spokes) * Math.PI * 2 + spokeGap;
    const a1 = ((k + 1) / spokes) * Math.PI * 2 - spokeGap;
    const nOut = Math.max(2, Math.round((a1 - a0) * perRad));
    const nIn = Math.max(1, Math.round(nOut / 2));
    const hole = new THREE.Path();
    for (let i = 0; i <= nOut; i++) {
      const a = a0 + ((a1 - a0) * i) / nOut;
      if (i) hole.lineTo(Math.cos(a) * rr * 0.82, Math.sin(a) * rr * 0.82);
      else hole.moveTo(Math.cos(a) * rr * 0.82, Math.sin(a) * rr * 0.82);
    }
    for (let i = 0; i <= nIn; i++) {
      const a = a1 + ((a0 - a1) * i) / nIn;
      hole.lineTo(Math.cos(a) * rr * 0.38, Math.sin(a) * rr * 0.38);
    }
    hole.closePath();
    face.holes.push(hole);
  }
  const g = new THREE.ExtrudeGeometry(face, { depth, bevelEnabled: bevel, bevelSize: depth * 0.25, bevelThickness: depth * 0.3, bevelSegments: 1, curveSegments });
  // Muka ekstrusi menghadap +Z → putar agar menghadap +X.
  g.rotateY(Math.PI / 2);
  return g;
}

/**
 * Roda lengkap. `r` jari-jari luar ban, `w` lebar tapak, `rimRatio` = jari-jari velg / jari-jari ban,
 * `spokes` jumlah palang velg (motor: 5 palang tipis), `detail` 0..1 = tingkat detail (LOD): segmen putar,
 * alur tapak, & bevel velg dikurangi untuk roda kecil/latar (motor parkir, tumpukan ban).
 */
export function wheelGeometries(r = WHEEL_BASE_R, w = WHEEL_BASE_W, rimRatio = 0.66, spokes = 5, detail = 1): WheelGeometries {
  const hw = w / 2;
  const rr = r * rimRatio;
  const radial = Math.max(12, Math.round(40 * detail));
  const curves = Math.max(6, Math.round(28 * detail));
  const simple = detail < 0.6;
  // Profil ban (radius, posisi aksial), dari bibir velg sisi dalam → tapak → bibir velg sisi luar.
  const prof: [number, number][] = [
    [rr - 0.004, -hw * 0.8],
    [rr + 0.012, -hw * 0.97],
    [rr + (r - rr) * 0.55, -hw * 1.03],
    [r - (r - rr) * 0.12, -hw * 0.97],
    [r, -hw * 0.8],
    [r, -hw * 0.32],
    [r - 0.005, -hw * 0.27],
    [r - 0.005, -hw * 0.19],
    [r, -hw * 0.14],
    [r, hw * 0.14],
    [r - 0.005, hw * 0.19],
    [r - 0.005, hw * 0.27],
    [r, hw * 0.32],
    [r, hw * 0.8],
    [r - (r - rr) * 0.12, hw * 0.97],
    [rr + (r - rr) * 0.55, hw * 1.03],
    [rr + 0.012, hw * 0.97],
    [rr - 0.004, hw * 0.8],
  ];
  // Detail rendah: tanpa alur tapak (titik 5–12 profil).
  const used = simple ? prof.filter((_, i) => i < 5 || i > 12) : prof;
  const tire = new THREE.LatheGeometry(
    used.map(([a, b]) => new THREE.Vector2(a, b)),
    radial,
  );
  // Sumbu lathe Y → X.
  tire.rotateZ(-Math.PI / 2);

  const face = rimFace(rr * 0.97, spokes, Math.max(0.012, w * 0.11), spokes > 5 ? 0.14 : 0.21, curves, !simple);
  face.translate(hw * 0.42, 0, 0);
  const cap = new THREE.CylinderGeometry(rr * 0.2, rr * 0.22, 0.03, Math.max(8, Math.round(20 * detail)));
  cap.rotateZ(-Math.PI / 2);
  cap.translate(hw * 0.42 + w * 0.12, 0, 0);
  const rim = merge([face, cap]);

  const barrel = new THREE.CylinderGeometry(rr * 0.99, rr * 0.99, w * 0.78, curves, 1, true);
  barrel.rotateZ(-Math.PI / 2);
  const disc = new THREE.CylinderGeometry(rr * 0.74, rr * 0.74, 0.022, curves);
  disc.rotateZ(-Math.PI / 2);
  disc.translate(-hw * 0.05, 0, 0);
  const hub = new THREE.CylinderGeometry(rr * 0.3, rr * 0.3, w * 0.5, Math.max(8, Math.round(16 * detail)));
  hub.rotateZ(-Math.PI / 2);
  // Kaliper rem di belakang atas cakram (tetap menempel saat roda berputar — cukup dari jarak pandang jalan).
  const caliper = new THREE.BoxGeometry(0.05, rr * 0.34, rr * 0.42);
  caliper.translate(hw * 0.18, rr * 0.48, -rr * 0.28);
  const dark = merge([barrel, disc, hub, caliper]);
  return { tire: keepPNU(tire), rim, dark };
}

/** Tekstur bayangan kontak (persegi panjang membulat & lembut) untuk bidang di bawah kendaraan. */
export function contactShadowTexture(size = 128): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  // alphaMap membaca kanal hijau: latar hitam (transparan), bentuk putih (gelap penuh) yang dikaburkan.
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, size, size);
  const pad = size * 0.18;
  ctx.filter = `blur(${Math.round(size * 0.08)}px)`;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') ctx.roundRect(pad, pad, size - pad * 2, size - pad * 2, size * 0.12);
  else ctx.rect(pad, pad, size - pad * 2, size - pad * 2);
  ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

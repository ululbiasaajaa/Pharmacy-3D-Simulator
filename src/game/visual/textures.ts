import * as THREE from 'three';

/**
 * Tekstur PBR prosedural (dibuat dari kode, tanpa unduhan aset).
 * Setiap tekstur mewakili ukuran fisik tetap (`meters`) dan dipetakan ke UV berskala meter,
 * sehingga satu tekstur dapat dipakai bersama oleh banyak objek tanpa salinan.
 *
 * Kanal: `map` (sRGB), `roughnessMap` (G = kekasaran), `normalMap` (ruang tangen, konvensi OpenGL).
 * Tekstur "netral" berwarna terang agar dapat diwarnai lewat `material.color`.
 */

export interface TextureSet {
  map: THREE.Texture;
  roughnessMap?: THREE.Texture;
  normalMap?: THREE.Texture;
  /** Ukuran fisik satu ulangan tekstur (meter). */
  meters: number;
}

interface Px {
  r: number;
  g: number;
  b: number;
  rough: number;
  h: number;
}

type Painter = (u: number, v: number, out: Px) => void;

// ------------------------------------------------------------------ Noise (dapat diulang/tileable)

function hash2(ix: number, iy: number, seed: number): number {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

function noise(x: number, y: number, period: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const x0 = ((xi % period) + period) % period;
  const y0 = ((yi % period) + period) % period;
  const x1 = (x0 + 1) % period;
  const y1 = (y0 + 1) % period;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(x0, y0, seed);
  const b = hash2(x1, y0, seed);
  const c = hash2(x0, y1, seed);
  const d = hash2(x1, y1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** fBm tileable pada domain [0,1)²; `period` = jumlah sel kisi pada oktaf pertama. */
function fbm(u: number, v: number, period: number, octaves: number, seed: number, periodY = period): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let px = period;
  let py = periodY;
  for (let o = 0; o < octaves; o++) {
    // Periode X dan Y dapat berbeda untuk pola memanjang (serat kayu, logam sikat).
    sum += amp * noiseXY(u * px, v * py, px, py, seed + o * 31);
    norm += amp;
    amp *= 0.5;
    px *= 2;
    py *= 2;
  }
  return sum / norm;
}

function noiseXY(x: number, y: number, periodX: number, periodY: number, seed: number): number {
  if (periodX === periodY) return noise(x, y, periodX, seed);
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const x0 = ((xi % periodX) + periodX) % periodX;
  const y0 = ((yi % periodY) + periodY) % periodY;
  const x1 = (x0 + 1) % periodX;
  const y1 = (y0 + 1) % periodY;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(x0, y0, seed);
  const b = hash2(x1, y0, seed);
  const c = hash2(x0, y1, seed);
  const d = hash2(x1, y1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

function hex(c: string): [number, number, number] {
  const col = new THREE.Color(c);
  // THREE.Color menyimpan nilai linear; kembalikan ke sRGB untuk ditulis ke kanvas.
  col.convertLinearToSRGB();
  return [col.r, col.g, col.b];
}

// ------------------------------------------------------------------ Bake

function dataTexture(data: Uint8Array, size: number, srgb: boolean): THREE.DataTexture {
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

function bake(size: number, meters: number, detail: boolean, normalStrength: number, painter: Painter): TextureSet {
  const n = size * size;
  const albedo = new Uint8Array(n * 4);
  const rough = detail ? new Uint8Array(n * 4) : null;
  const height = detail ? new Float32Array(n) : null;
  const px: Px = { r: 1, g: 1, b: 1, rough: 0.5, h: 0 };
  for (let y = 0; y < size; y++) {
    const v = (y + 0.5) / size;
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size;
      px.rough = 0.5;
      px.h = 0;
      painter(u, v, px);
      const i = y * size + x;
      albedo[i * 4] = px.r * 255;
      albedo[i * 4 + 1] = px.g * 255;
      albedo[i * 4 + 2] = px.b * 255;
      albedo[i * 4 + 3] = 255;
      if (rough && height) {
        rough[i * 4] = 255;
        rough[i * 4 + 1] = clamp01(px.rough) * 255;
        rough[i * 4 + 2] = 0;
        rough[i * 4 + 3] = 255;
        height[i] = px.h;
      }
    }
  }
  const set: TextureSet = { map: dataTexture(albedo, size, true), meters };
  if (rough && height) {
    set.roughnessMap = dataTexture(rough, size, false);
    const normal = new Uint8Array(n * 4);
    // Kekuatan dinormalisasi terhadap resolusi agar tampilan sama di semua kualitas.
    const k = normalStrength * (size / 512);
    for (let y = 0; y < size; y++) {
      const ym = ((y - 1 + size) % size) * size;
      const yp = ((y + 1) % size) * size;
      for (let x = 0; x < size; x++) {
        const xm = (x - 1 + size) % size;
        const xp = (x + 1) % size;
        const dx = (height[y * size + xp] - height[y * size + xm]) * k;
        const dy = (height[yp + x] - height[ym + x]) * k;
        const len = Math.hypot(dx, dy, 1);
        const i = (y * size + x) * 4;
        normal[i] = (-dx / len) * 127.5 + 127.5;
        normal[i + 1] = (-dy / len) * 127.5 + 127.5;
        normal[i + 2] = (1 / len) * 127.5 + 127.5;
        normal[i + 3] = 255;
      }
    }
    set.normalMap = dataTexture(normal, size, false);
  }
  return set;
}

// ------------------------------------------------------------------ Pelukis (painter)

/** Keramik/granit 60×60 krem dengan nat 4 mm (2×2 ubin per ulangan). */
function tilePainter(baseHex: string, seed: number): Painter {
  const [br, bg, bb] = hex(baseHex);
  const tile = 0.6;
  return (u, v, o) => {
    const gx = u * 2;
    const gy = v * 2;
    const ix = Math.floor(gx);
    const iy = Math.floor(gy);
    const fx = gx - ix;
    const fy = gy - iy;
    const edge = Math.min(fx, 1 - fx, fy, 1 - fy) * tile; // meter ke tepi ubin
    const inTile = smooth(0.0018, 0.0034, edge);
    const tv = (hash2(ix, iy, seed) - 0.5) * 0.06;
    const mottle = (fbm(u, v, 6, 3, seed + 3) - 0.5) * 0.08;
    const fleck = fbm(u, v, 96, 2, seed + 7);
    const dark = fleck > 0.68 ? (fleck - 0.68) * 1.6 : 0;
    const light = fleck < 0.3 ? (0.3 - fleck) * 0.5 : 0;
    const k = 1 + tv + mottle - dark + light;
    const grout = 0.72;
    o.r = (br * k) * inTile + br * grout * (1 - inTile);
    o.g = (bg * k) * inTile + bg * grout * (1 - inTile);
    o.b = (bb * k) * inTile + bb * grout * 0.97 * (1 - inTile);
    o.rough = inTile * (0.2 + mottle * 0.6 + dark * 0.3) + (1 - inTile) * 0.85;
    o.h = inTile;
  };
}

/** Cat dinding/plafon polos dengan tekstur rol halus (netral; diwarnai lewat material). */
function paintPainter(seed: number, rough = 0.86): Painter {
  return (u, v, o) => {
    const big = (fbm(u, v, 4, 3, seed) - 0.5) * 0.035;
    const stipple = fbm(u, v, 128, 2, seed + 5);
    const k = 0.97 + big + (stipple - 0.5) * 0.025;
    o.r = o.g = o.b = k;
    o.rough = rough + (stipple - 0.5) * 0.08;
    o.h = stipple * 0.6;
  };
}

/** Vinyl lembaran (area staf & gudang): bintik halus + belang lebar. */
function vinylPainter(seed: number): Painter {
  return (u, v, o) => {
    const mottle = (fbm(u, v, 5, 3, seed) - 0.5) * 0.05;
    const speck = fbm(u, v, 96, 2, seed + 9);
    const s = speck > 0.74 ? -(speck - 0.74) * 0.35 : speck < 0.24 ? (0.24 - speck) * 0.15 : 0;
    const k = 0.95 + mottle + s;
    o.r = o.g = o.b = k;
    o.rough = 0.55 + mottle;
    o.h = speck * 0.15;
  };
}

/** Lantai epoksi lab: mulus dengan belang sangat lembut. */
function epoxyPainter(seed: number): Painter {
  return (u, v, o) => {
    const m = (fbm(u, v, 3, 4, seed) - 0.5) * 0.05;
    o.r = o.g = o.b = 0.96 + m;
    o.rough = 0.28 + m * 2;
    o.h = m;
  };
}

/** Plafon grid 60×60: panel akustik bertekstur + rangka T-bar. */
function ceilingPainter(seed: number): Painter {
  return (u, v, o) => {
    const gx = u * 2;
    const gy = v * 2;
    const fx = gx - Math.floor(gx);
    const fy = gy - Math.floor(gy);
    const edge = Math.min(fx, 1 - fx, fy, 1 - fy) * 0.6;
    const bar = 1 - smooth(0.009, 0.013, edge);
    // Garis bayangan tipis di tepi panel (panel sedikit lebih rendah dari rangka).
    const lip = smooth(0.013, 0.02, edge) * (1 - smooth(0.02, 0.03, edge));
    const fiss = fbm(u, v, 48, 2, seed);
    const pit = fiss > 0.7 ? (fiss - 0.7) * 0.25 : 0;
    const tileK = 0.95 - pit - lip * 0.05 + (fbm(u, v, 4, 2, seed + 2) - 0.5) * 0.015;
    const k = tileK * (1 - bar) + 0.86 * bar;
    o.r = o.g = o.b = k;
    o.rough = 0.92 * (1 - bar) + 0.45 * bar;
    o.h = (1 - bar) * (0.35 - pit) + bar;
  };
}

/** Serat kayu HPL memanjang searah U (netral hangat; diwarnai lewat material). */
function woodPainter(seed: number): Painter {
  return (u, v, o) => {
    const warp = fbm(u, v, 2, 3, seed) * 3;
    const rings = 0.5 + 0.5 * Math.sin((v * 38 + warp) * Math.PI);
    const streak = fbm(u, v, 3, 4, seed + 4, 96);
    const k = 0.86 + rings * 0.07 + (streak - 0.5) * 0.16;
    o.r = k;
    o.g = k * 0.97;
    o.b = k * 0.93;
    o.rough = 0.48 + (streak - 0.5) * 0.12;
    o.h = rings * 0.4 + streak * 0.6;
  };
}

/** Logam sikat: goresan halus searah U. */
function brushedPainter(seed: number): Painter {
  return (u, v, o) => {
    const s = fbm(u, v, 2, 4, seed, 256);
    const k = 0.9 + (s - 0.5) * 0.12;
    o.r = o.g = o.b = k;
    o.rough = 0.34 + (s - 0.5) * 0.18;
    o.h = s;
  };
}

/** Paving block persegi panjang 20×10 cm pola susun bata. */
function pavingPainter(seed: number): Painter {
  return (u, v, o) => {
    const rows = 10; // 1 m / 0,1 m
    const cols = 5; // 1 m / 0,2 m
    const ry = v * rows;
    const iy = Math.floor(ry);
    const fy = ry - iy;
    const rx = u * cols + (iy % 2) * 0.5;
    const ix = Math.floor(rx);
    const fx = rx - ix;
    const edge = Math.min(fx * 0.2, (1 - fx) * 0.2, fy * 0.1, (1 - fy) * 0.1);
    const inside = smooth(0.002, 0.006, edge);
    const pv = (hash2(((ix % cols) + cols) % cols, iy, seed) - 0.5) * 0.12;
    const grain = (fbm(u, v, 64, 2, seed + 3) - 0.5) * 0.12;
    const k = (0.9 + pv + grain) * inside + 0.55 * (1 - inside);
    o.r = o.g = o.b = k;
    o.rough = 0.88;
    o.h = inside * 0.8 + grain;
  };
}

/** Aspal: dasar gelap dengan agregat terang/gelap. */
function asphaltPainter(seed: number): Painter {
  return (u, v, o) => {
    const agg = fbm(u, v, 220, 1, seed);
    const m = (fbm(u, v, 6, 3, seed + 2) - 0.5) * 0.06;
    const a = agg > 0.7 ? 0.12 : agg < 0.25 ? -0.05 : 0;
    const k = 0.3 + m + a;
    o.r = o.g = o.b = k;
    o.rough = 0.92;
    o.h = agg;
  };
}

/** Beton/plester luar: belang besar + noda aliran air vertikal. */
function plasterPainter(seed: number): Painter {
  return (u, v, o) => {
    const mott = (fbm(u, v, 4, 4, seed) - 0.5) * 0.08;
    const streak = fbm(u, v, 12, 3, seed + 6, 2);
    const stain = streak > 0.62 ? (streak - 0.62) * 0.35 : 0;
    const pores = fbm(u, v, 128, 1, seed + 1);
    const k = 0.95 + mott - stain - (pores > 0.75 ? 0.05 : 0);
    o.r = o.g = o.b = k;
    o.rough = 0.9;
    o.h = pores * 0.5 + mott;
  };
}

/** Rolling door: rusuk horizontal tiap 8 cm + kotoran halus. */
function shutterPainter(seed: number): Painter {
  return (u, v, o) => {
    const f = (v * 12.5) % 1;
    const ridge = Math.sin(f * Math.PI * 2) * 0.5 + 0.5;
    const dirt = (fbm(u, v, 4, 3, seed) - 0.5) * 0.1;
    const streak = (fbm(u, v, 24, 2, seed + 3, 2) - 0.5) * 0.06;
    const k = 0.74 + ridge * 0.14 + dirt + streak;
    o.r = o.g = o.b = k;
    o.rough = 0.5 + dirt;
    o.h = ridge;
  };
}

/** Papan berlubang (pegboard) putih: lubang tiap 25 mm. */
function pegboardPainter(): Painter {
  return (u, v, o) => {
    const n = 20; // 0,5 m / 25 mm
    const fx = u * n - Math.floor(u * n) - 0.5;
    const fy = v * n - Math.floor(v * n) - 0.5;
    const hole = 1 - smooth(0.13, 0.17, Math.hypot(fx, fy));
    const k = 0.94 * (1 - hole) + 0.25 * hole;
    o.r = o.g = o.b = k;
    o.rough = 0.6;
    o.h = 1 - hole;
  };
}

// ------------------------------------------------------------------ Registri

export type TextureName = 'tile' | 'paint' | 'vinyl' | 'epoxy' | 'ceiling' | 'wood' | 'brushed' | 'paving' | 'asphalt' | 'plaster' | 'pegboard' | 'shutter';

const RECIPES: Record<TextureName, { meters: number; normal: number; painter: () => Painter; maxSize?: number }> = {
  tile: { meters: 1.2, normal: 3, painter: () => tilePainter('#dcd5c9', 11) },
  paint: { meters: 2, normal: 0.6, painter: () => paintPainter(21), maxSize: 512 },
  vinyl: { meters: 2, normal: 0.6, painter: () => vinylPainter(31), maxSize: 512 },
  epoxy: { meters: 3, normal: 0.4, painter: () => epoxyPainter(41), maxSize: 256 },
  ceiling: { meters: 1.2, normal: 2, painter: () => ceilingPainter(51) },
  wood: { meters: 1.2, normal: 1, painter: () => woodPainter(61) },
  brushed: { meters: 0.6, normal: 0.5, painter: () => brushedPainter(71), maxSize: 512 },
  paving: { meters: 1, normal: 2.5, painter: () => pavingPainter(81) },
  asphalt: { meters: 3, normal: 1, painter: () => asphaltPainter(91), maxSize: 512 },
  plaster: { meters: 3, normal: 1, painter: () => plasterPainter(101), maxSize: 512 },
  pegboard: { meters: 0.5, normal: 2, painter: () => pegboardPainter(), maxSize: 512 },
  shutter: { meters: 1, normal: 2, painter: () => shutterPainter(111), maxSize: 256 },
};

const cache = new Map<string, TextureSet>();

/** Mengambil (atau membuat sekali) set tekstur untuk resolusi & tingkat detail tertentu. */
export function getTextureSet(name: TextureName, size: number, detail: boolean, anisotropy = 4): TextureSet {
  const r = RECIPES[name];
  const s = Math.min(size, r.maxSize ?? size);
  const key = `${name}:${s}:${detail ? 1 : 0}:${anisotropy}`;
  let set = cache.get(key);
  if (!set) {
    set = bake(s, r.meters, detail, r.normal, r.painter());
    // UV berskala meter → ulangan = 1 / ukuran fisik.
    for (const t of [set.map, set.roughnessMap, set.normalMap]) {
      t?.repeat.set(1 / r.meters, 1 / r.meters);
      if (t) t.anisotropy = anisotropy;
    }
    cache.set(key, set);
  }
  return set;
}

/** Membebaskan tekstur yang tidak lagi dipakai (mis. setelah ganti kualitas). */
export function disposeTexturesExcept(keep: Set<THREE.Texture>) {
  for (const [key, set] of cache) {
    const textures = [set.map, set.roughnessMap, set.normalMap].filter(Boolean) as THREE.Texture[];
    if (textures.some((t) => keep.has(t))) continue;
    textures.forEach((t) => t.dispose());
    cache.delete(key);
  }
}

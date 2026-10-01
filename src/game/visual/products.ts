import * as THREE from 'three';
import type { Medicine, MedicineCategory } from '@/domain/types';

/**
 * Kemasan produk prosedural dari katalog obat (ART_DIRECTION.md §4).
 * - Satu atlas tekstur berisi desain kemasan tiap obat (nama, kekuatan, pita warna kategori).
 * - Bentuk mengikuti sediaan: kotak (tablet/kapsul/kaplet/serbuk/salep/alat), botol (sirup/cairan/suspensi).
 * - Dirender dengan InstancedMesh; atribut `uvRect` per instance memilih sel atlas.
 */

export const CATEGORY_COLORS: Record<MedicineCategory, string> = {
  analgesik: '#d9573b',
  antipiretik: '#e07a2f',
  antasida: '#2f9e6a',
  vitamin: '#e9a21b',
  'batuk-pilek': '#2f78c4',
  topikal: '#8a5bb0',
  'kesehatan-umum': '#16958c',
  resep: '#3d5a80',
  'bahan-racik': '#8d6a43',
};

export type ProductShape = 'box' | 'bottle' | 'jar';

export interface ProductDims {
  shape: ProductShape;
  /** Lebar (x), tinggi (y), kedalaman (z) dalam meter. Untuk botol: w = d = diameter. */
  w: number;
  h: number;
  d: number;
  /** Warna tutup (botol/toples). */
  cap?: string;
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

/** Bentuk & ukuran kemasan dari sediaan (dengan variasi kecil yang deterministik per produk). */
export function productDims(m: Medicine): ProductDims {
  const r = hashStr(m.id);
  const v = (a: number, b: number) => a + (b - a) * r;
  if (m.category === 'bahan-racik') return { shape: 'jar', w: 0.1, h: 0.11, d: 0.1, cap: m.form === 'salep' ? '#f2f2ee' : '#2b2f33' };
  switch (m.form) {
    case 'sirup':
    case 'suspensi':
      return { shape: 'bottle', w: v(0.052, 0.06), h: v(0.12, 0.14), d: v(0.052, 0.06), cap: r > 0.5 ? '#c0392b' : '#f4f4f0' };
    case 'cairan':
      return m.id === 'ins-pen'
        ? { shape: 'box', w: 0.16, h: 0.04, d: 0.03 }
        : { shape: 'bottle', w: v(0.04, 0.052), h: v(0.1, 0.13), d: v(0.04, 0.052), cap: r > 0.5 ? '#1f2937' : '#e5e7eb' };
    case 'salep':
      return { shape: 'box', w: 0.13, h: 0.035, d: 0.032 };
    case 'serbuk':
      return { shape: 'box', w: 0.1, h: 0.08, d: 0.06 };
    case 'alat':
      return m.id === 'masker' ? { shape: 'box', w: 0.19, h: 0.1, d: 0.09 } : { shape: 'box', w: v(0.1, 0.14), h: v(0.07, 0.1), d: 0.05 };
    default:
      return { shape: 'box', w: v(0.095, 0.115), h: v(0.055, 0.07), d: v(0.025, 0.032) };
  }
}

// ------------------------------------------------------------------ Atlas

export const ATLAS_COLS = 8;
export const ATLAS_ROWS = 8;

export interface ProductAtlas {
  texture: THREE.CanvasTexture;
  /** uvRect (offset u, offset v, skala u, skala v) per id obat. */
  rects: Map<string, [number, number, number, number]>;
}

function shortName(m: Medicine) {
  return m.genericName.length <= 16 ? m.genericName : m.name.replace(/\s*\(.*\)\s*/, '').split(' ').slice(0, 2).join(' ');
}

function drawCell(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, m: Medicine) {
  const color = CATEGORY_COLORS[m.category] ?? '#64748b';
  const r = hashStr(m.id + 'x');
  // Latar kemasan: putih hangat atau berwarna penuh (sebagian produk) agar rak tidak seragam.
  const fullColor = r > 0.62 && m.category !== 'resep';
  ctx.fillStyle = fullColor ? color : '#f7f5f0';
  ctx.fillRect(x, y, w, h);
  // Pita kategori di tepi kiri (juga tampak di sisi kotak) + garis bawah.
  ctx.fillStyle = fullColor ? 'rgba(255,255,255,0.9)' : color;
  ctx.fillRect(x, y, w * 0.1, h);
  ctx.fillRect(x, y + h * 0.86, w, h * 0.06);
  // Lengkung dekoratif.
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = fullColor ? '#ffffff' : color;
  ctx.beginPath();
  ctx.arc(x + w * 0.92, y + h * 0.15, h * 0.75, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Teks: nama & kekuatan.
  const ink = fullColor ? '#ffffff' : '#1f2933';
  const name = shortName(m).toUpperCase();
  let size = Math.round(h * 0.24);
  ctx.font = `800 ${size}px "Segoe UI", system-ui, sans-serif`;
  while (ctx.measureText(name).width > w * 0.62 && size > 6) {
    size -= 1;
    ctx.font = `800 ${size}px "Segoe UI", system-ui, sans-serif`;
  }
  ctx.fillStyle = ink;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(name, x + w * 0.15, y + h * 0.32);
  const strength = m.strength && m.strength !== '-' ? m.strength : m.unit;
  ctx.font = `600 ${Math.round(h * 0.17)}px "Segoe UI", system-ui, sans-serif`;
  ctx.fillStyle = fullColor ? 'rgba(255,255,255,0.9)' : color;
  ctx.fillText(strength, x + w * 0.15, y + h * 0.58);
  ctx.font = `500 ${Math.round(h * 0.11)}px "Segoe UI", system-ui, sans-serif`;
  ctx.fillStyle = fullColor ? 'rgba(255,255,255,0.75)' : '#6b7280';
  ctx.fillText(m.form, x + w * 0.15, y + h * 0.76);
  // Emblem bulat kanan.
  const cx = x + w * 0.84;
  const cy = y + h * 0.5;
  const rad = h * 0.2;
  ctx.fillStyle = fullColor ? '#ffffff' : color;
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = fullColor ? color : '#ffffff';
  const t = rad * 0.32;
  ctx.fillRect(cx - t / 2, cy - rad * 0.6, t, rad * 1.2);
  ctx.fillRect(cx - rad * 0.6, cy - t / 2, rad * 1.2, t);
}

let atlasCache: { key: string; atlas: ProductAtlas } | null = null;

/** Atlas kemasan untuk seluruh katalog (dibuat ulang hanya bila katalog/resolusi berubah). */
export function getProductAtlas(medicines: Medicine[], cellWidth: number): ProductAtlas {
  const key = `${cellWidth}:${medicines.map((m) => m.id).join(',')}`;
  if (atlasCache?.key === key) return atlasCache.atlas;
  atlasCache?.atlas.texture.dispose();
  const cw = cellWidth;
  const ch = cellWidth / 2;
  const canvas = document.createElement('canvas');
  canvas.width = cw * ATLAS_COLS;
  canvas.height = ch * ATLAS_ROWS;
  const ctx = canvas.getContext('2d');
  const rects = new Map<string, [number, number, number, number]>();
  const pad = Math.max(2, Math.round(cw / 64));
  medicines.slice(0, ATLAS_COLS * ATLAS_ROWS).forEach((m, i) => {
    const col = i % ATLAS_COLS;
    const row = Math.floor(i / ATLAS_COLS);
    const x = col * cw;
    const y = row * ch;
    if (ctx) {
      // Isi gutter dengan warna kategori agar tidak ada garis putih saat mipmap.
      ctx.fillStyle = CATEGORY_COLORS[m.category] ?? '#64748b';
      ctx.fillRect(x, y, cw, ch);
      drawCell(ctx, x + pad, y + pad, cw - pad * 2, ch - pad * 2, m);
    }
    // CanvasTexture: flipY → baris kanvas atas = v tinggi.
    rects.set(m.id, [(x + pad) / canvas.width, 1 - (y + ch - pad) / canvas.height, (cw - pad * 2) / canvas.width, (ch - pad * 2) / canvas.height]);
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  const atlas = { texture, rects };
  atlasCache = { key, atlas };
  return atlas;
}

// ------------------------------------------------------------------ Geometri & material

/** Kotak satuan: muka depan/belakang memakai sel penuh, sisi lain memakai pita kategori. */
export function productBoxGeometry(): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(1, 1, 1);
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  for (let face = 0; face < 6; face++) {
    if (face === 4 || face === 5) continue; // +Z, -Z
    for (let k = 0; k < 4; k++) {
      const i = face * 4 + k;
      uv.setX(i, uv.getX(i) * 0.08);
    }
  }
  uv.needsUpdate = true;
  g.translate(0, 0.5, 0); // alas di y = 0
  return g;
}

/** Badan botol satuan (diameter 1, tinggi 1); label melingkar dengan bagian tengah sel di depan (+Z). */
export function productBottleGeometry(): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(0.5, 0.5, 1, 14, 1);
  g.rotateY(Math.PI);
  g.translate(0, 0.5, 0);
  return g;
}

export function productCapGeometry(): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(0.5, 0.5, 1, 12, 1);
  g.translate(0, 0.5, 0);
  return g;
}

/** Material kemasan: MeshStandard + atlas, dengan UV per instance (`uvRect`). */
export function productMaterial(atlas: THREE.Texture): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ map: atlas, roughness: 0.5, metalness: 0 });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 uvRect;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\n  vMapUv = uvRect.xy + vMapUv * uvRect.zw;\n#endif');
  };
  m.customProgramCacheKey = () => 'product-atlas-v1';
  return m;
}

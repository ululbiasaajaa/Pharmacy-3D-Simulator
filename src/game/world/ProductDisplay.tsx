import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useGame } from '@/stores/gameStore';
import { useVisualProfile } from '@/game/visual/quality';
import { getProductAtlas, productBottleGeometry, productBoxGeometry, productCapGeometry, productDims, productMaterial, type ProductDims } from '@/game/visual/products';
import type { GameState, Medicine, MedicineCategory, StockLocation } from '@/domain/types';

/** Satu tingkat rak dalam koordinat lokal rak (produk menghadap +Z). */
export interface ShelfLevel {
  x0: number;
  x1: number;
  /** Permukaan atas papan rak. */
  y: number;
  /** Tepi depan papan rak. */
  zFront: number;
  depth: number;
  maxH: number;
}

export type StockFilter = (m: Medicine) => boolean;

const CATEGORY_ORDER: MedicineCategory[] = ['analgesik', 'antipiretik', 'batuk-pilek', 'antasida', 'vitamin', 'topikal', 'kesehatan-umum', 'resep', 'bahan-racik'];

/**
 * Kunci stok stabil (string) untuk lokasi tertentu: render ulang hanya bila jumlah berubah.
 * Jumlah dibulatkan ke kelipatan 2 agar transaksi kecil tidak selalu menyusun ulang rak.
 */
function stockKey(s: GameState, location: StockLocation, filter: StockFilter): string {
  const qty = new Map<string, number>();
  for (const b of s.batches) {
    if (b.location !== location || b.status !== 'active' || b.qty <= 0) continue;
    qty.set(b.medicineId, (qty.get(b.medicineId) ?? 0) + b.qty);
  }
  const meds = s.medicines.filter((m) => qty.has(m.id) && filter(m));
  return meds.map((m) => `${m.id}:${Math.ceil((qty.get(m.id) ?? 0) / 2) * 2}`).join(',');
}

interface Placement {
  m: Medicine;
  dims: ProductDims;
  x: number;
  y: number;
  z: number;
}

const GAP = 0.012;

/**
 * Menyusun produk ke tingkat rak (murni, dapat diuji):
 * - kepadatan rak = stok terhadap "rak penuh" (3× stok minimum) → rak tampak kosong saat stok menipis;
 * - jumlah kolom tiap produk sebanding stoknya (minimal satu bila stok > 0);
 * - produk dibagi merata ke semua tingkat dengan urutan kategori tetap; sisa ruang menjadi jarak.
 */
export function layoutProducts(levels: ShelfLevel[], entries: { m: Medicine; qty: number }[], opts: { maxColumns?: number; deep?: boolean } = {}): Placement[] {
  if (!levels.length || !entries.length) return [];
  const maxColumns = opts.maxColumns ?? 6;
  const deep = opts.deep ?? true;
  const items = [...entries]
    .filter((e) => e.qty > 0)
    .sort((a, b) => CATEGORY_ORDER.indexOf(a.m.category) - CATEGORY_ORDER.indexOf(b.m.category) || a.m.name.localeCompare(b.m.name))
    .map((e) => ({ ...e, dims: productDims(e.m) }));
  if (!items.length) return [];
  const sumQty = items.reduce((a, it) => a + it.qty, 0);
  // Rak tampak penuh pada stok normal (±2× stok minimum); stok menipis tetap terlihat lebih kosong.
  const fullQty = items.reduce((a, it) => a + Math.max(1, it.m.minStock) * 2, 0);
  const fill = Math.min(1, sumQty / fullQty);
  const totalWidth = levels.reduce((a, l) => a + (l.x1 - l.x0), 0);
  const avgW = items.reduce((a, it) => a + it.dims.w + GAP, 0) / items.length;
  const targetCols = Math.max(items.length, Math.round((totalWidth / avgW) * fill * 0.92));
  const cols = items.map((it) => Math.max(1, Math.min(maxColumns, Math.round((targetCols * it.qty) / sumQty))));
  // Jangan melebihi lebar rak.
  let widths = items.map((it, i) => cols[i] * (it.dims.w + GAP));
  let total = widths.reduce((a, w) => a + w, 0);
  while (total > totalWidth * 0.96) {
    const i = cols.indexOf(Math.max(...cols));
    if (cols[i] <= 1) break;
    cols[i]--;
    widths = items.map((it, k) => cols[k] * (it.dims.w + GAP));
    total = widths.reduce((a, w) => a + w, 0);
  }
  // Bagi rata ke tingkat (berurutan) dengan anggaran lebar per tingkat.
  const groups: number[][] = levels.map(() => []);
  const used = levels.map(() => 0);
  const budget = total / levels.length;
  let li = 0;
  items.forEach((it, i) => {
    const cumBefore = used.slice(0, li + 1).reduce((a, u) => a + u, 0);
    if (li < levels.length - 1 && used[li] > 0 && cumBefore + widths[i] / 2 > budget * (li + 1)) li++;
    let lv = li;
    while (lv < levels.length && (it.dims.h > levels[lv].maxH || used[lv] + widths[i] > levels[lv].x1 - levels[lv].x0)) lv++;
    if (lv >= levels.length) return;
    li = lv;
    groups[lv].push(i);
    used[lv] += widths[i];
  });
  const out: Placement[] = [];
  groups.forEach((g, l) => {
    if (!g.length) return;
    const lv = levels[l];
    const free = lv.x1 - lv.x0 - used[l];
    const spacing = Math.min(0.18, free / (g.length + 1));
    let x = lv.x0 + spacing + Math.max(0, free - spacing * (g.length + 1)) / 2;
    for (const i of g) {
      const it = items[i];
      const per = deep ? depthCount(it.dims, lv.depth) : 1;
      for (let c = 0; c < cols[i]; c++) {
        for (let k = 0; k < per; k++) {
          out.push({ m: it.m, dims: it.dims, x: x + it.dims.w / 2, y: lv.y, z: lv.zFront - 0.01 - it.dims.d / 2 - k * (it.dims.d + 0.006) });
        }
        x += it.dims.w + GAP;
      }
      x += spacing;
    }
  });
  return out;
}

function depthCount(d: ProductDims, depth: number) {
  return Math.max(1, Math.min(3, Math.floor((depth - 0.02) / (d.d + 0.006))));
}

const boxGeo = productBoxGeometry();
const bottleGeo = productBottleGeometry();
const capGeo = productCapGeometry();

/**
 * Produk di satu rak, diambil dari stok sebenarnya pada lokasi tertentu.
 * Satu InstancedMesh per bentuk (kotak, botol, tutup) → ±3 draw call per rak.
 */
export function ShelfProducts({ levels, location = 'shelf', filter, maxColumns, deep }: { levels: ShelfLevel[]; location?: StockLocation; filter: StockFilter; maxColumns?: number; deep?: boolean }) {
  const profile = useVisualProfile();
  const medicines = useGame((s) => s.game?.medicines);
  const key = useGame((s) => (s.game ? stockKey(s.game, location, filter) : ''));
  const atlas = useMemo(() => (medicines ? getProductAtlas(medicines, profile.quality === 'low' ? 128 : 256) : null), [medicines, profile.quality]);
  const material = useMemo(() => (atlas ? productMaterial(atlas.texture) : null), [atlas]);
  useEffect(() => () => material?.dispose(), [material]);

  const placements = useMemo(() => {
    if (!medicines || !key) return [];
    const byId = new Map(medicines.map((m) => [m.id, m]));
    const entries = key.split(',').map((e) => {
      const [id, q] = e.split(':');
      return { m: byId.get(id)!, qty: Number(q) };
    });
    return layoutProducts(levels, entries.filter((e) => e.m), { maxColumns, deep });
  }, [key, medicines, levels, maxColumns, deep]);

  const boxes = useMemo(() => placements.filter((p) => p.dims.shape === 'box'), [placements]);
  const bottles = useMemo(() => placements.filter((p) => p.dims.shape !== 'box'), [placements]);

  if (!material || !atlas) return null;
  return (
    <group>
      <ProductInstances geometry={boxGeo} material={material} items={boxes} rects={atlas.rects} />
      <ProductInstances geometry={bottleGeo} material={material} items={bottles} rects={atlas.rects} bodyOnly />
      <CapInstances items={bottles} />
    </group>
  );
}

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpS = new THREE.Vector3();
const tmpP = new THREE.Vector3();

function ProductInstances({ geometry, material, items, rects, bodyOnly }: { geometry: THREE.BufferGeometry; material: THREE.Material; items: Placement[]; rects: Map<string, [number, number, number, number]>; bodyOnly?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const capacity = Math.max(1, items.length);
  // Geometri per mesh (atribut uvRect berbeda per rak).
  const geo = useMemo(() => {
    const g = geometry.clone();
    g.setAttribute('uvRect', new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4));
    return g;
  }, [geometry, capacity]);
  useEffect(() => () => geo.dispose(), [geo]);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const attr = geo.getAttribute('uvRect') as THREE.InstancedBufferAttribute;
    items.forEach((p, i) => {
      const h = bodyOnly ? p.dims.h * 0.82 : p.dims.h;
      tmpP.set(p.x, p.y, p.z);
      tmpS.set(p.dims.w, h, p.dims.d);
      tmpM.compose(tmpP, tmpQ.identity(), tmpS);
      mesh.setMatrixAt(i, tmpM);
      const r = rects.get(p.m.id) ?? [0, 0, 0.01, 0.01];
      attr.setXYZW(i, r[0], r[1], r[2], r[3]);
    });
    mesh.count = items.length;
    mesh.instanceMatrix.needsUpdate = true;
    attr.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items, rects, geo, bodyOnly]);
  return <instancedMesh ref={ref} args={[geo, material, capacity]} raycast={() => null} frustumCulled />;
}

const capMaterial = new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0 });
const tmpC = new THREE.Color();

function CapInstances({ items }: { items: Placement[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const capacity = Math.max(1, items.length);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    items.forEach((p, i) => {
      const bodyH = p.dims.h * 0.82;
      const capD = p.dims.shape === 'jar' ? p.dims.w * 1.04 : p.dims.w * 0.55;
      tmpP.set(p.x, p.y + bodyH, p.z);
      tmpS.set(capD, p.dims.h - bodyH, capD);
      tmpM.compose(tmpP, tmpQ.identity(), tmpS);
      mesh.setMatrixAt(i, tmpM);
      mesh.setColorAt(i, tmpC.set(p.dims.cap ?? '#eeeeee'));
    });
    mesh.count = items.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);
  return <instancedMesh key={capacity} ref={ref} args={[capGeo, capMaterial, capacity]} raycast={() => null} />;
}

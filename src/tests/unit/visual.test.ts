import { describe, expect, it } from 'vitest';
import { daylightAt, sunDirectionAt } from '@/game/visual/daylight';
import { layoutProducts, type ShelfLevel } from '@/game/world/ProductDisplay';
import { productDims } from '@/game/visual/products';
import { getTextureSet } from '@/game/visual/textures';
import { GeoBuilder, boxProjectUV, floorQuad } from '@/game/visual/geometry';
import { BONE_DEFS, buildCharacterGeometry, patientStyle, staffStyle } from '@/game/npc/characterModel';
import { MEDICINES } from '@/data/medicines';
import * as THREE from 'three';

const med = (id: string) => MEDICINES.find((m) => m.id === id)!;
const luminance = (c: THREE.Color) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

describe('Siklus siang–malam', () => {
  it('matahari terbit di timur, tertinggi siang, terbenam di barat, condong ke etalase', () => {
    const morning = sunDirectionAt(8 * 60);
    const noon = sunDirectionAt(12 * 60);
    const afternoon = sunDirectionAt(16 * 60);
    expect(morning.x).toBeLessThan(0);
    expect(afternoon.x).toBeGreaterThan(0);
    expect(noon.y).toBeGreaterThan(morning.y);
    expect(noon.z).toBeGreaterThan(0);
  });

  it('intensitas & suasana mengikuti jam permainan', () => {
    const noon = daylightAt(12 * 60);
    const morning = daylightAt(8 * 60);
    const night = daylightAt(20 * 60);
    expect(noon.sunIntensity).toBeGreaterThan(morning.sunIntensity);
    expect(night.sunIntensity).toBe(0);
    expect(noon.night).toBe(0);
    expect(night.night).toBe(1);
    expect(luminance(night.skyTop)).toBeLessThan(luminance(noon.skyTop));
  });
});

describe('Tata letak produk di rak', () => {
  const levels: ShelfLevel[] = [0.1, 0.55, 1.0].map((y) => ({ x0: -1.4, x1: 1.4, y, zFront: 0.27, depth: 0.5, maxH: 0.4 }));
  const otc = ['pct-500', 'ibu-200', 'ant-tab', 'vitc-500', 'gg-100', 'ctm-4', 'obh-syr'].map(med);

  it('tanpa stok → rak kosong', () => {
    expect(layoutProducts(levels, [])).toEqual([]);
    expect(layoutProducts(levels, otc.map((m) => ({ m, qty: 0 })))).toEqual([]);
  });

  it('produk berada dalam batas tingkat rak dan tidak saling tumpang tindih', () => {
    const out = layoutProducts(levels, otc.map((m) => ({ m, qty: m.minStock * 2 })));
    expect(out.length).toBeGreaterThan(0);
    for (const p of out) {
      const lv = levels.find((l) => l.y === p.y)!;
      expect(lv).toBeDefined();
      expect(p.x - p.dims.w / 2).toBeGreaterThanOrEqual(lv.x0 - 1e-6);
      expect(p.x + p.dims.w / 2).toBeLessThanOrEqual(lv.x1 + 1e-6);
    }
    // Baris depan setiap tingkat: tidak ada dua kemasan yang bertumpuk.
    for (const lv of levels) {
      const front = out.filter((p) => p.y === lv.y && Math.abs(p.z - (lv.zFront - 0.01 - p.dims.d / 2)) < 1e-6).sort((a, b) => a.x - b.x);
      for (let i = 1; i < front.length; i++) expect(front[i].x - front[i - 1].x).toBeGreaterThanOrEqual((front[i].dims.w + front[i - 1].dims.w) / 2 - 1e-6);
    }
    // Disebar ke lebih dari satu tingkat.
    expect(new Set(out.map((p) => p.y)).size).toBeGreaterThan(1);
  });

  it('jumlah tampilan mengikuti stok (rak tampak lebih kosong saat stok menipis)', () => {
    const low = layoutProducts(levels, otc.map((m) => ({ m, qty: Math.max(1, Math.round(m.minStock * 0.5)) })));
    const high = layoutProducts(levels, otc.map((m) => ({ m, qty: m.minStock * 3 })));
    expect(high.length).toBeGreaterThan(low.length);
  });

  it('bentuk kemasan mengikuti sediaan', () => {
    expect(productDims(med('pct-500')).shape).toBe('box');
    expect(productDims(med('obh-syr')).shape).toBe('bottle');
    expect(productDims(med('zno')).shape).toBe('jar');
  });
});

describe('Tekstur prosedural', () => {
  it('di-cache per resolusi dan berskala meter', () => {
    const a = getTextureSet('tile', 64, true);
    const b = getTextureSet('tile', 64, true);
    expect(a).toBe(b);
    expect(a.normalMap).toBeDefined();
    expect(a.map.repeat.x).toBeCloseTo(1 / a.meters);
    const flat = getTextureSet('tile', 64, false);
    expect(flat.normalMap).toBeUndefined();
  });
});

describe('Builder geometri', () => {
  it('menggabungkan bagian per material dan memberi UV lantai = (x, -z)', () => {
    const b = new GeoBuilder<'a' | 'b'>();
    b.box('a', 1, 1, 1, 0, 0.5, 0);
    b.box('a', 1, 1, 1, 2, 0.5, 0);
    b.box('b', 0.5, 0.5, 0.5, 0, 2, 0);
    const parts = b.build();
    expect(parts.map((p) => p.mat).sort()).toEqual(['a', 'b']);
    const q = boxProjectUV(floorQuad(1, 2, 3, 4));
    const uv = q.getAttribute('uv');
    expect(uv.getX(0)).toBeCloseTo(1);
    expect(uv.getY(0)).toBeCloseTo(-3);
  });
});

describe('Karakter prosedural', () => {
  it('gaya pasien deterministik dari data domain', () => {
    const p = { id: 'PS-7', gender: 'P' as const, age: 66, appearance: 3 };
    expect(patientStyle(p).key).toBe(patientStyle(p).key);
    expect(patientStyle(p).elderly).toBe(true);
    expect(staffStyle({ id: 'EM-1', name: 'Siti Rahma', role: 'pharmacist', appearance: 2 }).top).toBe('coat');
  });

  it('geometri ber-skinning valid: indeks tulang sah & bobot berjumlah 1', () => {
    for (const id of ['PS-1', 'PS-2', 'PS-3', 'PS-4']) {
      for (const gender of ['L', 'P'] as const) {
        const g = buildCharacterGeometry(patientStyle({ id, gender, age: 40, appearance: 1 }));
        const si = g.getAttribute('skinIndex');
        const sw = g.getAttribute('skinWeight');
        expect(g.getAttribute('color')).toBeDefined();
        for (let i = 0; i < si.count; i += 7) {
          let sum = 0;
          for (let k = 0; k < 4; k++) {
            expect(si.getComponent(i, k)).toBeLessThan(BONE_DEFS.length);
            sum += sw.getComponent(i, k);
          }
          expect(sum).toBeCloseTo(1, 5);
        }
        g.dispose();
      }
    }
  });
});

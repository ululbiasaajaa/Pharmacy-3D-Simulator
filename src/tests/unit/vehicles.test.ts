import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GeoBuilder } from '@/game/visual/geometry';
import type { MatKey } from '@/game/world/materials';
import { VEHICLES, vehicleBody, type VehicleKind } from '@/game/world/vehicleModels';
import { WHEEL_BASE_R, WHEEL_BASE_W, wheelGeometries } from '@/game/world/wheelModels';
import { scooterModel } from '@/game/world/streetModels';
import { shopModel } from '@/game/world/shopModels';
import { BACKDROP_SHOPS, SHOPS, STREET, VAN_SIZE, scooterFootprint, type ShopStyle } from '@/game/world/district';
import { TRAFFIC_HALF, VAN_HALF, VanSim } from '@/game/world/traffic';

type Parts = { mat: MatKey; geometry: THREE.BufferGeometry }[];

function build(fn: (b: GeoBuilder<MatKey>) => void): Parts {
  const b = new GeoBuilder<MatKey>();
  fn(b);
  return b.build();
}

function bounds(parts: Parts, only?: (m: MatKey) => boolean) {
  const box = new THREE.Box3();
  for (const p of parts) {
    if (only && !only(p.mat)) continue;
    p.geometry.computeBoundingBox();
    box.union(p.geometry.boundingBox!);
  }
  return box;
}

const tris = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.getAttribute('position').count) / 3;
const finite = (parts: Parts) => parts.every((p) => Array.from(p.geometry.getAttribute('position').array).every(Number.isFinite));
const KINDS = Object.keys(VEHICLES) as VehicleKind[];

describe('Kendaraan buatan sendiri', () => {
  it('ukuran keseluruhan sesuai spesifikasi; setengah panjang lalu lintas & collider van sama dengan model', () => {
    for (const kind of KINDS) {
      const spec = VEHICLES[kind];
      const parts = build((b) => vehicleBody(b, kind, 'carPaint'));
      expect(finite(parts)).toBe(true);
      const box = bounds(parts);
      // Panjang termasuk bemper & pelat; lebar boleh lebih besar karena spion; tinggi termasuk rak atap/papan trayek.
      expect(box.max.z).toBeLessThanOrEqual(spec.length / 2 + 0.01);
      expect(-box.min.z).toBeLessThanOrEqual(spec.length / 2 + 0.01);
      expect(box.max.z - box.min.z).toBeGreaterThan(spec.length - 0.05);
      expect(box.max.x - box.min.x).toBeGreaterThan(spec.width - 0.05);
      expect(box.max.x - box.min.x).toBeLessThan(spec.width + 0.55);
      expect(box.max.y).toBeGreaterThan(spec.height - 0.05);
      expect(box.max.y).toBeLessThan(spec.height + 0.16);
    }
    expect(TRAFFIC_HALF.car).toBeCloseTo(VEHICLES.mpv.length / 2, 2);
    expect(TRAFFIC_HALF.hatch).toBeCloseTo(VEHICLES.hatch.length / 2, 2);
    expect(TRAFFIC_HALF.angkot).toBeCloseTo(VEHICLES.angkot.length / 2, 2);
    expect(VAN_HALF).toBeGreaterThanOrEqual(VEHICLES.van.length / 2);
    expect(VAN_SIZE.l).toBeGreaterThanOrEqual(VEHICLES.van.length);
  });

  it('roda menapak jalan, bodi tidak menyentuh tanah, & tidak ada bagian bodi di dalam ban (tanpa clipping)', () => {
    for (const kind of KINDS) {
      const spec = VEHICLES[kind];
      const parts = build((b) => vehicleBody(b, kind, 'carPaint'));
      // Roda dipasang di y = wheelR dengan skala wheelR / WHEEL_BASE_R → dasar ban tepat di y = 0.
      const s = spec.wheelR / WHEEL_BASE_R;
      const tire = wheelGeometries().tire;
      tire.computeBoundingBox();
      expect(spec.wheelR - tire.boundingBox!.max.y * s).toBeCloseTo(0, 3);
      // Bodi tidak tenggelam / menyeret jalan; mobil penumpang tidak "berkaki" (ambang di bawah as roda).
      const box = bounds(parts);
      expect(box.min.y).toBeGreaterThan(0.05);
      if (kind === 'mpv' || kind === 'hatch') expect(box.min.y).toBeLessThan(spec.wheelR);
      const hw = (WHEEL_BASE_W / 2) * s;
      const v = new THREE.Vector3();
      let inside = 0;
      for (const p of parts) {
        const pos = p.geometry.getAttribute('position');
        for (let i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i);
          for (const [wx, wz] of spec.wheels) if (Math.abs(v.x - wx) < hw * 0.9 && Math.hypot(v.z - wz, v.y - spec.wheelR) < spec.wheelR - 0.02) inside++;
        }
      }
      expect(inside).toBe(0);
      // Roda berada di dalam panjang bodi.
      for (const [, wz] of spec.wheels) expect(Math.abs(wz) + spec.wheelR).toBeLessThan(spec.length / 2);
    }
  });

  it('velg hemat segitiga (busur lubang palang mengikuti kerapatan lingkar luar)', () => {
    expect(tris(wheelGeometries(undefined, undefined, 0.66, 5, 0.7).rim)).toBeLessThan(1000);
    expect(tris(wheelGeometries(0.26, 0.095, 0.66, 5, 0.3).rim)).toBeLessThan(300);
  });
});

describe('Motor matik', () => {
  it('menapak tanah, seluruhnya di dalam collider parkir, proporsi skuter 110–125 cc', () => {
    const parts = build((b) => scooterModel(b, 0, 0, 0, 'bikeRed'));
    expect(finite(parts)).toBe(true);
    const box = bounds(parts);
    expect(box.min.y).toBeGreaterThan(-0.003);
    expect(bounds(parts, (m) => m === 'tireRubber').min.y).toBeLessThan(0.003);
    const fp = scooterFootprint([0, 0]);
    expect(box.min.x).toBeGreaterThanOrEqual(fp.minX);
    expect(box.max.x).toBeLessThanOrEqual(fp.maxX);
    expect(box.min.z).toBeGreaterThanOrEqual(fp.minZ);
    expect(box.max.z).toBeLessThanOrEqual(fp.maxZ);
    // Panjang ±1,9 m, lebar setang ±0,7 m, puncak spion ±1,2 m, jok ±0,8 m.
    expect(box.max.z - box.min.z).toBeGreaterThan(1.8);
    expect(box.max.x - box.min.x).toBeGreaterThan(0.6);
    expect(box.max.y).toBeGreaterThan(1.1);
    expect(box.max.y).toBeLessThan(1.3);
    expect(bounds(parts, (m) => m === 'black').max.y).toBeLessThan(1.1);
  });

  it('roda tidak menembus bodi, dek, atau spakbor', () => {
    const parts = build((b) => scooterModel(b, 0, 0, 0, 'bikeBlue'));
    const tireBox = bounds(parts, (m) => m === 'tireRubber');
    const r = (tireBox.max.y - tireBox.min.y) / 2;
    const centers = [tireBox.max.z - r, tireBox.min.z + r];
    const v = new THREE.Vector3();
    let inside = 0;
    for (const p of parts) {
      if (p.mat !== 'bikeBlue' && p.mat !== 'bikeBlack' && p.mat !== 'black' && p.mat !== 'rubber') continue;
      const pos = p.geometry.getAttribute('position');
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        for (const cz of centers) if (Math.abs(v.x) < 0.04 && Math.hypot(v.z - cz, v.y - r) < r - 0.01) inside++;
      }
    }
    expect(inside).toBe(0);
  });
});

describe('Ruko kawasan', () => {
  const ALL = [...SHOPS, ...BACKDROP_SHOPS];
  // Geometri 32 ruko dibangun sekali lalu dipakai bersama oleh tes di bawah (membangun ulang = lambat).
  let built: Parts[] | null = null;
  const shopParts = () => (built ??= ALL.map((s, i) => build((b) => shopModel(b, s, i, s.id.startsWith('BG') ? 1 : 0))));

  it('tiap gaya fasad punya ciri bentuk/bahan sendiri (bukan model sama berganti warna)', () => {
    const sets = shopParts().map((parts) => new Set(parts.map((p) => p.mat)));
    const mats = (i: number) => sets[i];
    const has: Record<ShopStyle, MatKey> = { modern: 'emissiveWarm', klasik: 'ceramicWall', bata: 'brickWall', warung: 'goodsAtlas', bengkel: 'tireRubber', bangunan: 'pegboard' };
    ALL.forEach((s, i) => expect(mats(i).has(has[s.style])).toBe(true));
    // Ciri gaya lain tidak muncul di gaya yang salah.
    ALL.forEach((s, i) => {
      if (s.style !== 'bata') expect(mats(i).has('brickWall')).toBe(false);
      if (s.style !== 'klasik') expect(mats(i).has('ceramicWall')).toBe(false);
    });
    // Kawasan memakai semua gaya & beragam kombinasi gaya × jenis usaha (kios, warung, bengkel, kafe, tertutup, ...).
    expect(new Set(SHOPS.map((s) => s.style)).size).toBe(6);
    expect(new Set(SHOPS.map((s) => `${s.style}/${s.kind}`)).size).toBeGreaterThanOrEqual(8);
  });

  it('nama toko unik dengan baris layanan; ruko latar di luar gerbang & tidak saling tumpang tindih', () => {
    expect(new Set(ALL.map((s) => s.name)).size).toBe(ALL.length);
    for (const s of ALL) expect(s.tagline.length).toBeGreaterThan(3);
    for (const s of BACKDROP_SHOPS) expect(Math.min(Math.abs(s.x0), Math.abs(s.x1))).toBeGreaterThanOrEqual(STREET.gateX);
    for (const a of ALL)
      for (const b of ALL) {
        if (a === b || a.front !== b.front) continue;
        expect(a.x1 <= b.x0 + 1e-6 || b.x1 <= a.x0 + 1e-6).toBe(true);
      }
  });

  it('geometri ruko di dalam kavling, tidak di bawah tanah, & tidak masuk badan jalan', () => {
    const parts = shopParts();
    ALL.forEach((s, i) => {
      const box = bounds(parts[i]);
      expect(box.min.y).toBeGreaterThan(-0.01);
      // Toleransi 0,2 m: lis/pilaster & kanopi boleh menjorok sedikit ke kavling tetangga (dinding bersama).
      expect(box.min.x).toBeGreaterThan(s.x0 - 0.2);
      expect(box.max.x).toBeLessThan(s.x1 + 0.2);
      if (s.facing === 1) expect(box.max.z).toBeLessThan(STREET.curbNear);
      else expect(box.min.z).toBeGreaterThan(STREET.curbFar);
    });
  });
});

describe('Animasi mobil boks', () => {
  it('roda berputar sesuai jarak tempuh (maju/mundur) & roda depan berbelok di tikungan', () => {
    const van = new VanSim();
    const DT = 1 / 30;
    let forward = 0;
    let reverse = 0;
    let maxSteer = 0;
    let prev = van.odometer;
    for (let t = 0; t < 160; t += DT) {
      van.step(DT, t < 60, [], []);
      const d = van.odometer - prev;
      prev = van.odometer;
      if (van.isReversing) reverse += d;
      else forward += d;
      maxSteer = Math.max(maxSteer, Math.abs(van.steer));
      expect(Math.abs(van.steer)).toBeLessThanOrEqual(0.6 + 1e-9);
    }
    expect(van.visible).toBe(false);
    expect(forward).toBeGreaterThan(10);
    expect(reverse).toBeLessThan(-3);
    expect(maxSteer).toBeGreaterThan(0.15);
  });
});

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Helper geometri untuk gaya "stylized realistic":
 * - UV berskala meter (tekstur prosedural konsisten di semua objek),
 * - tepi membulat (bevel) agar menangkap highlight,
 * - penggabungan statis per material agar detail bertambah tanpa menambah draw call.
 */

/** Proyeksi kotak: UV dari posisi (meter) mengikuti sumbu normal dominan. */
export function boxProjectUV(geo: THREE.BufferGeometry, offset: THREE.Vector3 = new THREE.Vector3()): THREE.BufferGeometry {
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const nor = geo.getAttribute('normal') as THREE.BufferAttribute;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + offset.x;
    const y = pos.getY(i) + offset.y;
    const z = pos.getZ(i) + offset.z;
    const ax = Math.abs(nor.getX(i));
    const ay = Math.abs(nor.getY(i));
    const az = Math.abs(nor.getZ(i));
    if (ay >= ax && ay >= az) {
      uv[i * 2] = x;
      uv[i * 2 + 1] = -z;
    } else if (ax >= az) {
      uv[i * 2] = nor.getX(i) > 0 ? -z : z;
      uv[i * 2 + 1] = y;
    } else {
      uv[i * 2] = nor.getZ(i) > 0 ? x : -x;
      uv[i * 2 + 1] = y;
    }
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

/** Kotak dengan UV berskala meter (sudut tajam; untuk dinding & bidang besar). */
export function meterBox(w: number, h: number, d: number): THREE.BufferGeometry {
  return boxProjectUV(new THREE.BoxGeometry(w, h, d));
}

/**
 * Kotak bertepi bulat dengan UV berskala meter. Detail otomatis menyesuaikan ukuran:
 * bagian tipis (< 2,5 cm) memakai kotak biasa (12 segitiga), bagian kecil 1 segmen lengkung
 * (108 segitiga), bagian besar 2 segmen (300 segitiga) — lengkung kecil tidak terlihat.
 */
export function roundedBox(w: number, h: number, d: number, r = 0.012, segments?: number): THREE.BufferGeometry {
  const minDim = Math.min(w, h, d);
  const radius = Math.min(r, minDim / 2 - 1e-4);
  if (radius <= 0.002 || minDim < 0.025) return meterBox(w, h, d);
  const seg = segments ?? (Math.max(w, h, d) > 0.8 ? 2 : 1);
  return boxProjectUV(new RoundedBoxGeometry(w, h, d, seg, radius));
}

/** Bidang horizontal di koordinat dunia (UV = x, -z) — lantai/plafon/tanah. */
export function floorQuad(x0: number, x1: number, z0: number, z1: number, y = 0, facingDown = false): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const ny = facingDown ? -1 : 1;
  const p = [x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1];
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, ny, 0, 0, ny, 0, 0, ny, 0, 0, ny, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([x0, -z0, x1, -z0, x1, -z1, x0, -z1], 2));
  g.setIndex(facingDown ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]);
  return g;
}

// ------------------------------------------------------------------ Builder

export interface PartOptions {
  /** Rotasi (radian) mengelilingi sumbu Y/X/Z. */
  rotY?: number;
  rotX?: number;
  rotZ?: number;
  /** Proyeksikan ulang UV dalam ruang builder (tekstur menyambung antarbagian). */
  worldUV?: boolean;
}

/**
 * Mengumpulkan banyak bagian statis lalu menggabungkannya menjadi satu geometri per material.
 * Kunci material bebas (string) — dipetakan ke material nyata saat render.
 */
export class GeoBuilder<K extends string = string> {
  private parts = new Map<K, THREE.BufferGeometry[]>();
  private stack: THREE.Matrix4[] = [new THREE.Matrix4()];
  private tmp = new THREE.Matrix4();
  private euler = new THREE.Euler();
  private quat = new THREE.Quaternion();

  /** Menjalankan `fn` dalam transformasi lokal (posisi + rotasi Y). */
  group(x: number, y: number, z: number, rotY: number, fn: () => void) {
    const m = new THREE.Matrix4().makeRotationY(rotY).setPosition(x, y, z);
    this.stack.push(this.current().clone().multiply(m));
    fn();
    this.stack.pop();
  }

  private current() {
    return this.stack[this.stack.length - 1];
  }

  /** Menambahkan geometri (akan di-clone & ditransformasi) pada posisi lokal. */
  add(mat: K, geo: THREE.BufferGeometry, x = 0, y = 0, z = 0, o: PartOptions = {}) {
    const g = geo.clone();
    this.euler.set(o.rotX ?? 0, o.rotY ?? 0, o.rotZ ?? 0, 'YXZ');
    this.quat.setFromEuler(this.euler);
    this.tmp.compose(new THREE.Vector3(x, y, z), this.quat, new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(this.current().clone().multiply(this.tmp));
    if (o.worldUV) boxProjectUV(g);
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
    if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2));
    const list = this.parts.get(mat) ?? [];
    list.push(g.index ? g : indexed(g));
    this.parts.set(mat, list);
    return this;
  }

  box(mat: K, w: number, h: number, d: number, x: number, y: number, z: number, o: PartOptions & { r?: number } = {}) {
    const geo = o.r === 0 ? meterBox(w, h, d) : roundedBox(w, h, d, o.r ?? 0.01);
    return this.add(mat, geo, x, y, z, { worldUV: true, ...o });
  }

  cylinder(mat: K, rTop: number, rBottom: number, h: number, x: number, y: number, z: number, o: PartOptions & { seg?: number } = {}) {
    return this.add(mat, new THREE.CylinderGeometry(rTop, rBottom, h, o.seg ?? 16), x, y, z, o);
  }

  /** Benda putar dari profil [radius, tinggi] (mortir, pot, gelas). */
  lathe(mat: K, profile: [number, number][], x: number, y: number, z: number, o: PartOptions & { seg?: number } = {}) {
    const g = new THREE.LatheGeometry(
      profile.map(([r, h]) => new THREE.Vector2(r, h)),
      o.seg ?? 18,
    );
    return this.add(mat, g, x, y, z, o);
  }

  sphere(mat: K, r: number, x: number, y: number, z: number, o: PartOptions & { seg?: number; sx?: number; sy?: number; sz?: number } = {}) {
    const seg = o.seg ?? 12;
    const g = new THREE.SphereGeometry(r, seg, Math.max(6, Math.round(seg * 0.6)));
    if (o.sx || o.sy || o.sz) g.scale(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1);
    return this.add(mat, g, x, y, z, o);
  }

  /** Hasil akhir: satu geometri gabungan per kunci material. */
  build(): { mat: K; geometry: THREE.BufferGeometry }[] {
    const out: { mat: K; geometry: THREE.BufferGeometry }[] = [];
    for (const [mat, list] of this.parts) {
      const merged = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      if (merged) {
        merged.computeBoundingSphere();
        out.push({ mat, geometry: merged });
      }
    }
    this.parts.clear();
    return out;
  }
}

function indexed(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const count = g.getAttribute('position').count;
  const idx = new Array(count);
  for (let i = 0; i < count; i++) idx[i] = i;
  g.setIndex(idx);
  return g;
}

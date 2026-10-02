import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

/** Satu papan nama statis (gaya sama dengan CanvasLabel berlatar). */
export interface SignDef {
  text: string;
  /** Ukuran papan (m). */
  width: number;
  height: number;
  background: string;
  color?: string;
  /** Ukuran huruf maksimum relatif tinggi papan (0..1); diperkecil otomatis bila teks terlalu lebar. */
  fontScale?: number;
  position: [number, number, number];
  /** Rotasi Y (radian); 0 = menghadap +Z. */
  rotationY?: number;
}

/** Resolusi atlas (piksel per meter) & lebar kanvas. */
const PX = 160;
const ATLAS_W = 2048;
const PAD = 8;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

function drawSign(ctx: CanvasRenderingContext2D, x: number, y: number, W: number, H: number, s: SignDef) {
  ctx.save();
  ctx.translate(x, y);
  const r = Math.min(H * 0.16, 18);
  ctx.beginPath();
  roundRect(ctx, 1, 1, W - 2, H - 2, r);
  ctx.fillStyle = s.background;
  ctx.fill();
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(255,255,255,0.10)');
  g.addColorStop(0.5, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.10)');
  ctx.fillStyle = g;
  ctx.fill();
  const lw = Math.max(2, H * 0.025);
  ctx.lineWidth = lw;
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.beginPath();
  roundRect(ctx, lw, lw, W - lw * 2, H - lw * 2, Math.max(1, r - lw));
  ctx.stroke();
  let size = Math.round(H * (s.fontScale ?? 0.56));
  const font = (px: number) => `700 ${px}px "Segoe UI", system-ui, sans-serif`;
  ctx.font = font(size);
  while (ctx.measureText(s.text).width > W * 0.88 && size > 10) {
    size -= 2;
    ctx.font = font(size);
  }
  ctx.fillStyle = s.color ?? '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = size * 0.08;
  ctx.shadowOffsetY = size * 0.03;
  ctx.fillText(s.text, W / 2, H / 2 + size * 0.04);
  ctx.restore();
}

/**
 * Banyak papan nama statis dalam SATU mesh & satu tekstur atlas (1 draw call), menggantikan
 * puluhan CanvasLabel terpisah di kawasan. `signs` harus stabil (konstanta modul atau di-memo).
 */
export function SignAtlas({ signs }: { signs: SignDef[] }) {
  const { geometry, material } = useMemo(() => {
    // Pengepakan baris (shelf packing): papan tertinggi lebih dulu.
    const sizes = signs.map((s) => ({ w: Math.min(ATLAS_W - PAD * 2, Math.round(s.width * PX)), h: Math.round(s.height * PX) }));
    const order = sizes.map((_, i) => i).sort((a, b) => sizes[b].h - sizes[a].h);
    const rects: { x: number; y: number; w: number; h: number }[] = [];
    let x = PAD;
    let y = PAD;
    let rowH = 0;
    for (const i of order) {
      const { w, h } = sizes[i];
      if (x + w + PAD > ATLAS_W) {
        x = PAD;
        y += rowH + PAD;
        rowH = 0;
      }
      rects[i] = { x, y, w, h };
      x += w + PAD;
      rowH = Math.max(rowH, h);
    }
    const atlasH = y + rowH + PAD;
    const canvas = document.createElement('canvas');
    canvas.width = ATLAS_W;
    canvas.height = atlasH;
    const ctx = canvas.getContext('2d');
    if (ctx) signs.forEach((s, i) => drawSign(ctx, rects[i].x, rects[i].y, rects[i].w, rects[i].h, s));
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;

    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const v = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const one = new THREE.Vector3(1, 1, 1);
    signs.forEach((s, i) => {
      const r = rects[i];
      q.setFromAxisAngle(up, s.rotationY ?? 0);
      m.compose(new THREE.Vector3(...s.position), q, one);
      const hw = s.width / 2;
      const hh = s.height / 2;
      // CanvasTexture flipY: baris atas kanvas = v 1.
      const u0 = r.x / ATLAS_W;
      const u1 = (r.x + r.w) / ATLAS_W;
      const v0 = 1 - (r.y + r.h) / atlasH;
      const v1 = 1 - r.y / atlasH;
      const corners: [number, number, number, number][] = [
        [-hw, -hh, u0, v0],
        [hw, -hh, u1, v0],
        [hw, hh, u1, v1],
        [-hw, hh, u0, v1],
      ];
      const base = pos.length / 3;
      for (const [cx, cy, cu, cv] of corners) {
        v.set(cx, cy, 0).applyMatrix4(m);
        pos.push(v.x, v.y, v.z);
        uv.push(cu, cv);
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeBoundingSphere();
    // Sudut papan membulat → alphaTest (tanpa pengurutan transparan); tidak terpengaruh cahaya (seperti CanvasLabel).
    const mat = new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, toneMapped: false });
    return { geometry: geo, material: mat };
  }, [signs]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.map?.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  return <mesh geometry={geometry} material={material} raycast={() => null} />;
}

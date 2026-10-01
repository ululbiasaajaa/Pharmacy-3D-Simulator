import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { FURNITURE, WALLS } from './layout';

/** Bidang bertekstur kanvas (poster, denah) — digambar sekali, tanpa aset eksternal. */
export function CanvasPlane({
  draw,
  width,
  height,
  px = 320,
  position,
  rotation,
  emissive = false,
}: {
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  width: number;
  height: number;
  px?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  emissive?: boolean;
}) {
  const texture = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = Math.round(width * px);
    c.height = Math.round(height * px);
    const ctx = c.getContext('2d');
    if (ctx) draw(ctx, c.width, c.height);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [draw, width, height, px]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh position={position} rotation={rotation} raycast={() => null}>
      <planeGeometry args={[width, height]} />
      {emissive ? <meshBasicMaterial map={texture} toneMapped={false} /> : <meshStandardMaterial map={texture} roughness={0.7} />}
    </mesh>
  );
}

const font = (weight: number, size: number) => `${weight} ${size}px "Segoe UI", system-ui, sans-serif`;

/** Poster banner informasi kesehatan (fiktif & umum, bukan saran medis). */
export function drawHealthPoster(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#f7f5ef';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#0e655b';
  ctx.fillRect(0, 0, w, h * 0.17);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = font(800, w * 0.1);
  ctx.fillText('PAPAN', w / 2, h * 0.06);
  ctx.fillText('INFORMASI', w / 2, h * 0.115);
  ctx.fillStyle = '#0e655b';
  ctx.font = font(600, w * 0.055);
  ctx.fillText('Tips hidup sehat', w / 2, h * 0.21);
  const items: [string, string, string][] = [
    ['#2f78c4', 'Cuci tangan', 'pakai sabun'],
    ['#2f9e6a', 'Minum air', 'yang cukup'],
    ['#e9a21b', 'Tanya apoteker', 'soal obat'],
  ];
  items.forEach(([c, a, b2], i) => {
    const y = h * (0.3 + i * 0.19);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect?.(w * 0.07, y, w * 0.86, h * 0.16, w * 0.04);
    ctx.fill();
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(w * 0.22, y + h * 0.08, w * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(w * 0.21, y + h * 0.05, w * 0.02, h * 0.06);
    ctx.fillRect(w * 0.16, y + h * 0.075, w * 0.12, h * 0.01);
    ctx.fillStyle = '#1f2933';
    ctx.textAlign = 'left';
    ctx.font = font(700, w * 0.065);
    ctx.fillText(a, w * 0.36, y + h * 0.06);
    ctx.fillStyle = '#5b6770';
    ctx.font = font(500, w * 0.055);
    ctx.fillText(b2, w * 0.36, y + h * 0.105);
    ctx.textAlign = 'center';
  });
  ctx.fillStyle = '#93ead6';
  ctx.fillRect(0, h * 0.89, w, h * 0.11);
  ctx.fillStyle = '#0e655b';
  ctx.font = font(600, w * 0.05);
  ctx.fillText('Simulasi edukatif · bukan saran medis', w / 2, h * 0.945);
}

/** Denah apotek digambar dari data tata letak yang sama dengan dunia 3D. */
export function drawBlueprint(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#16456e';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += w / 24) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += h / 16) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  // Dunia: x -12..12, z -18..10 → kanvas (pad 6%).
  const pad = 0.06;
  const sx = (x: number) => (pad + ((x + 12) / 24) * (1 - 2 * pad)) * w;
  const sy = (z: number) => (pad + ((z + 18) / 28) * (1 - 2 * pad)) * h;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (const b of WALLS) ctx.fillRect(sx(b.minX), sy(b.minZ), Math.max(2, sx(b.maxX) - sx(b.minX)), Math.max(2, sy(b.maxZ) - sy(b.minZ)));
  ctx.strokeStyle = '#93ead6';
  ctx.lineWidth = 2;
  for (const b of Object.values(FURNITURE)) ctx.strokeRect(sx(b.minX), sy(b.minZ), sx(b.maxX) - sx(b.minX), sy(b.maxZ) - sy(b.minZ));
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = '#fbbf24';
  ctx.strokeRect(sx(-12), sy(-18), sx(12) - sx(-12), sy(-10) - sy(-18));
  ctx.setLineDash([]);
  ctx.fillStyle = '#fbbf24';
  ctx.font = font(700, h * 0.05);
  ctx.textAlign = 'center';
  ctx.fillText('AREA PERLUASAN', w / 2, sy(-14));
}

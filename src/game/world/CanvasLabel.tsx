import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { Billboard } from '@react-three/drei';

/** `roundRect` dengan cadangan persegi untuk browser lama. */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

/**
 * Label teks yang digambar ke CanvasTexture (tanpa mengunduh font eksternal).
 */
export function CanvasLabel({
  text,
  width = 2,
  height = 0.5,
  color = '#ffffff',
  background = '#0e655b',
  fontSize = 64,
  position,
  rotation,
  bold = true,
  billboard = false,
  doubleSided = false,
}: {
  text: string;
  width?: number;
  height?: number;
  color?: string;
  background?: string | null;
  fontSize?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  bold?: boolean;
  billboard?: boolean;
  /** Tampilkan teks tidak terbalik dari kedua sisi (mis. papan gantung). */
  doubleSided?: boolean;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    const pxPerUnit = 256;
    canvas.width = Math.max(64, Math.round(width * pxPerUnit));
    canvas.height = Math.max(32, Math.round(height * pxPerUnit));
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const W = canvas.width;
      const H = canvas.height;
      if (background) {
        // Papan bersudut bulat dengan highlight atas halus dan garis tepi tipis (gaya signage nyata).
        const r = Math.min(H * 0.16, 28);
        ctx.beginPath();
        roundRect(ctx, 1, 1, W - 2, H - 2, r);
        ctx.fillStyle = background;
        ctx.fill();
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, 'rgba(255,255,255,0.10)');
        g.addColorStop(0.5, 'rgba(255,255,255,0)');
        g.addColorStop(1, 'rgba(0,0,0,0.10)');
        ctx.fillStyle = g;
        ctx.fill();
        ctx.lineWidth = Math.max(2, H * 0.025);
        ctx.strokeStyle = 'rgba(255,255,255,0.22)';
        ctx.beginPath();
        roundRect(ctx, ctx.lineWidth, ctx.lineWidth, W - ctx.lineWidth * 2, H - ctx.lineWidth * 2, Math.max(1, r - ctx.lineWidth));
        ctx.stroke();
      }
      ctx.fillStyle = color;
      let size = fontSize;
      const font = (s: number) => `${bold ? '700' : '500'} ${s}px "Segoe UI", system-ui, sans-serif`;
      ctx.font = font(size);
      if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = bold ? `${Math.round(size * 0.04)}px` : '0px';
      while (ctx.measureText(text).width > W * 0.88 && size > 12) {
        size -= 2;
        ctx.font = font(size);
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (background) {
        ctx.shadowColor = 'rgba(0,0,0,0.25)';
        ctx.shadowBlur = size * 0.08;
        ctx.shadowOffsetY = size * 0.03;
      }
      ctx.fillText(text, W / 2, H / 2 + size * 0.04);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }, [text, width, height, color, background, fontSize, bold]);

  useEffect(() => () => texture.dispose(), [texture]);

  // Papan berlatar memakai alphaTest (sudut bulat) agar tidak perlu diurutkan sebagai objek transparan.
  const matProps = background ? { alphaTest: 0.5 } : { transparent: true };
  const mesh = (
    <mesh position={billboard ? undefined : position} rotation={billboard ? undefined : rotation}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} {...matProps} toneMapped={false} side={billboard ? THREE.DoubleSide : THREE.FrontSide} />
    </mesh>
  );
  if (doubleSided && !billboard) {
    return (
      <group position={position} rotation={rotation}>
        <mesh position={[0, 0, 0.002]}>
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial map={texture} {...matProps} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0, -0.002]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial map={texture} {...matProps} toneMapped={false} />
        </mesh>
      </group>
    );
  }
  if (!billboard) return mesh;
  return <Billboard position={position}>{mesh}</Billboard>;
}

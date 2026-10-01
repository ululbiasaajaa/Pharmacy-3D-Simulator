import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { Billboard } from '@react-three/drei';

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
      if (background) {
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.fillStyle = color;
      let size = fontSize;
      ctx.font = `${bold ? '700' : '500'} ${size}px system-ui, sans-serif`;
      while (ctx.measureText(text).width > canvas.width * 0.92 && size > 12) {
        size -= 2;
        ctx.font = `${bold ? '700' : '500'} ${size}px system-ui, sans-serif`;
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }, [text, width, height, color, background, fontSize, bold]);

  useEffect(() => () => texture.dispose(), [texture]);

  const mesh = (
    <mesh position={billboard ? undefined : position} rotation={billboard ? undefined : rotation}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} transparent={!background} toneMapped={false} side={billboard ? THREE.DoubleSide : THREE.FrontSide} />
    </mesh>
  );
  if (doubleSided && !billboard) {
    return (
      <group position={position} rotation={rotation}>
        <mesh position={[0, 0, 0.002]}>
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial map={texture} transparent={!background} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0, -0.002]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial map={texture} transparent={!background} toneMapped={false} />
        </mesh>
      </group>
    );
  }
  if (!billboard) return mesh;
  return <Billboard position={position}>{mesh}</Billboard>;
}

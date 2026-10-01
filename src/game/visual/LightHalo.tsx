import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { daylight } from './daylight';

/**
 * Halo cahaya palsu (bidang aditif bergradien) di sekitar sumber cahaya — memberi kesan "glow"
 * dan pantulan cahaya ke plafon tanpa post-processing.
 */
const materials = new Map<string, THREE.MeshBasicMaterial>();
const geometry = new THREE.PlaneGeometry(1, 1);

function haloMaterial(color: string) {
  let m = materials.get(color);
  if (m) return m;
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.5)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.22)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.06)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(c);
  m = new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });
  materials.set(color, m);
  return m;
}

export function LightHalo({
  position,
  size = 1.5,
  warm = false,
  color,
  facing = 'camera',
  nightOnly = false,
  intensity = 1,
}: {
  position: [number, number, number];
  size?: number;
  warm?: boolean;
  color?: string;
  facing?: 'camera' | 'down' | 'up' | 'forward';
  /** Hanya tampil saat gelap (lampu jalan, papan nama luar). */
  nightOnly?: boolean;
  intensity?: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const material = haloMaterial(color ?? (warm ? '#ffd9a0' : '#fff4e6'));
  useFrame(({ camera }) => {
    const m = ref.current;
    if (!m) return;
    if (facing === 'camera') m.quaternion.copy(camera.quaternion);
    if (nightOnly) {
      const s = THREE.MathUtils.smoothstep(daylight.current.night, 0.25, 0.75);
      m.visible = s > 0.02;
      m.scale.setScalar(size * (0.6 + 0.4 * s) * intensity);
    }
  });
  const rotation: [number, number, number] = facing === 'down' ? [Math.PI / 2, 0, 0] : facing === 'up' ? [-Math.PI / 2, 0, 0] : [0, 0, 0];
  return <mesh ref={ref} geometry={geometry} material={material} position={position} rotation={rotation} scale={size * intensity} renderOrder={4} raycast={() => null} />;
}

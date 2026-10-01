import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { interactableObjects } from '@/game/world/worldStore';
import { useUi } from '@/stores/uiStore';

const bracketMaterial = new THREE.MeshBasicMaterial({ color: '#5eead4', toneMapped: false });

/** Siku sudut (corner bracket) di 8 sudut kotak batas — satu geometri gabungan. */
function bracketGeometry(size: THREE.Vector3): THREE.BufferGeometry {
  const t = 0.012;
  const parts: THREE.BufferGeometry[] = [];
  const half = size.clone().multiplyScalar(0.5);
  for (const sx of [-1, 1])
    for (const sy of [-1, 1])
      for (const sz of [-1, 1]) {
        const lens = [Math.min(0.18, size.x * 0.3), Math.min(0.18, size.y * 0.3), Math.min(0.18, size.z * 0.3)];
        const corner = new THREE.Vector3(sx * half.x, sy * half.y, sz * half.z);
        const arms: [number, number, number, THREE.Vector3][] = [
          [lens[0], t, t, new THREE.Vector3(-sx * lens[0] * 0.5, 0, 0)],
          [t, lens[1], t, new THREE.Vector3(0, -sy * lens[1] * 0.5, 0)],
          [t, t, lens[2], new THREE.Vector3(0, 0, -sz * lens[2] * 0.5)],
        ];
        for (const [w, h, d, off] of arms) {
          const g = new THREE.BoxGeometry(Math.max(t, w), Math.max(t, h), Math.max(t, d));
          g.translate(corner.x + off.x, corner.y + off.y, corner.z + off.z);
          parts.push(g);
        }
      }
  const merged = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  return merged;
}

function Highlight({ size, center }: { size: THREE.Vector3; center: THREE.Vector3 }) {
  const ref = useRef<THREE.Mesh>(null);
  const geometry = useMemo(() => bracketGeometry(size.clone().addScalar(0.08)), [size]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 5) * 0.012);
  });
  return <mesh ref={ref} geometry={geometry} material={bracketMaterial} position={center} renderOrder={10} raycast={() => null} />;
}

/**
 * Pembungkus objek yang dapat diinteraksikan. Mendaftarkan objek ke registri raycast
 * dan menampilkan siku sorot saat pemain mengarahkan kamera ke objek.
 */
export function Interactable({ id, children, position, rotation }: { id: string; children: ReactNode; position?: [number, number, number]; rotation?: [number, number, number] }) {
  const ref = useRef<THREE.Group>(null);
  const focused = useUi((s) => s.focus?.id === id);
  const [box, setBox] = useState<{ size: THREE.Vector3; center: THREE.Vector3 } | null>(null);

  useEffect(() => {
    const g = ref.current;
    if (!g) return;
    g.userData.interactableId = id;
    interactableObjects.set(id, g);
    // Hitung kotak batas lokal sekali untuk sorotan.
    g.updateWorldMatrix(true, true);
    const b = new THREE.Box3().setFromObject(g);
    const inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
    b.applyMatrix4(inv);
    setBox({ size: b.getSize(new THREE.Vector3()), center: b.getCenter(new THREE.Vector3()) });
    return () => {
      interactableObjects.delete(id);
    };
  }, [id]);

  return (
    <group ref={ref} position={position} rotation={rotation}>
      {children}
      {focused && box && <Highlight size={box.size} center={box.center} />}
    </group>
  );
}

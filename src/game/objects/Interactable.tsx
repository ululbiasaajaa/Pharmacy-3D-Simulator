import { useEffect, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { interactableObjects } from '@/game/world/worldStore';
import { useUi } from '@/stores/uiStore';
import { MAT } from '@/game/world/materials';

/**
 * Pembungkus objek yang dapat diinteraksikan. Mendaftarkan objek ke registri raycast
 * dan menampilkan kotak sorot saat pemain mengarahkan kamera ke objek.
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
      {focused && box && (
        <mesh position={box.center} material={MAT.highlight} raycast={() => null}>
          <boxGeometry args={[box.size.x + 0.06, box.size.y + 0.06, box.size.z + 0.06]} />
        </mesh>
      )}
    </group>
  );
}

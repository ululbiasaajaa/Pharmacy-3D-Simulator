import { useEffect } from 'react';
import type * as THREE from 'three';
import { MAT, type MatKey } from '@/game/world/materials';

export type BuiltPart = { mat: MatKey; geometry: THREE.BufferGeometry };

/**
 * Merender hasil `GeoBuilder.build()` — satu mesh (= satu draw call) per material —
 * dan membebaskan geometri saat hasil berganti.
 */
export function BuiltMeshes({ parts, castShadow = false, receiveShadow = true }: { parts: BuiltPart[]; castShadow?: boolean; receiveShadow?: boolean }) {
  useEffect(() => () => parts.forEach((p) => p.geometry.dispose()), [parts]);
  return (
    <>
      {parts.map((p) => (
        <mesh key={p.mat} geometry={p.geometry} material={MAT[p.mat]} castShadow={castShadow} receiveShadow={receiveShadow} />
      ))}
    </>
  );
}

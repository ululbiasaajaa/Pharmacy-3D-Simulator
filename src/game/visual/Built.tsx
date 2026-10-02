import { useEffect } from 'react';
import type * as THREE from 'three';
import { MAT, type MatKey } from '@/game/world/materials';

export type BuiltPart = { mat: MatKey; geometry: THREE.BufferGeometry };

/**
 * Merender hasil `GeoBuilder.build()` — satu mesh (= satu draw call) per material —
 * dan membebaskan geometri saat hasil berganti. `renderOrder` per material (opsional) mengatur urutan gambar
 * objek opak: permukaan latar besar digambar terakhir agar fragmen di balik detail ditolak uji kedalaman.
 */
export function BuiltMeshes({
  parts,
  castShadow = false,
  receiveShadow = true,
  renderOrder,
}: {
  parts: BuiltPart[];
  castShadow?: boolean;
  receiveShadow?: boolean;
  renderOrder?: Partial<Record<MatKey, number>>;
}) {
  useEffect(() => () => parts.forEach((p) => p.geometry.dispose()), [parts]);
  return (
    <>
      {parts.map((p) => (
        <mesh key={p.mat} geometry={p.geometry} material={MAT[p.mat]} castShadow={castShadow} receiveShadow={receiveShadow} renderOrder={renderOrder?.[p.mat] ?? 0} />
      ))}
    </>
  );
}

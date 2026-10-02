import { useEffect, useMemo, useReducer } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import manifest from './generated/models.json';

/**
 * Model properti CC0 (Poly Haven) hasil `scripts/assets/models.mjs` (ART_DIRECTION.md §3–§4).
 * Dimuat malas dan di-cache; setiap pemakaian mengklon scene (geometri & material dibagi).
 * Properti hanya dekorasi — bila gagal dimuat, tidak ada yang ditampilkan dan gameplay tidak terpengaruh.
 */
export type ModelKey = keyof typeof manifest;

const BASE = import.meta.env.BASE_URL + 'assets/';
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

const cache = new Map<ModelKey, Promise<THREE.Group>>();
const ready = new Map<ModelKey, THREE.Group>();

export function loadModel(key: ModelKey): Promise<THREE.Group> {
  let p = cache.get(key);
  if (!p) {
    p = loader.loadAsync(BASE + manifest[key].file).then((g) => {
      g.scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      });
      ready.set(key, g.scene);
      return g.scene;
    });
    p.catch((e) => {
      console.warn(`Model ${key} gagal dimuat; dilewati.`, e);
      cache.delete(key);
    });
    cache.set(key, p);
  }
  return p;
}

/** Klon model yang siap dipakai (`null` selama memuat atau bila gagal). */
export function useModel(key: ModelKey): THREE.Group | null {
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    if (ready.has(key)) return;
    let alive = true;
    loadModel(key).then(
      () => alive && rerender(),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [key]);
  const template = ready.get(key);
  return useMemo(() => (template ? template.clone(true) : null), [template]);
}

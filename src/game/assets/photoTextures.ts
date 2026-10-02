import * as THREE from 'three';
import manifest from './generated/textures.json';

/**
 * Tekstur foto PBR (CC0, ambientCG) hasil `scripts/assets/textures.mjs` (ART_DIRECTION.md §6).
 * Dimuat secara progresif: material memakai tekstur prosedural dulu, lalu tekstur foto dipasang
 * begitu selesai diunduh. Bila gagal (offline, berkas hilang), tekstur prosedural tetap dipakai.
 */
export type PhotoTextureKey = keyof typeof manifest;

export interface PhotoTextureSet {
  map: THREE.Texture;
  normalMap?: THREE.Texture;
  /** R = AO, G = roughness, B = metalness. */
  ormMap?: THREE.Texture;
  meters: number;
}

export const PHOTO_TEXTURES = manifest as Record<PhotoTextureKey, { meters: number; sizes: number[]; id: string }>;

const BASE = `${import.meta.env.BASE_URL}assets/textures`;
const loader = new THREE.TextureLoader();
const cache = new Map<string, Promise<THREE.Texture>>();

function loadTexture(url: string, srgb: boolean, meters: number, anisotropy: number): Promise<THREE.Texture> {
  const key = `${url}|${anisotropy}`;
  let p = cache.get(key);
  if (!p) {
    p = loader.loadAsync(url).then((t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(1 / meters, 1 / meters);
      t.anisotropy = anisotropy;
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      return t;
    });
    // Kegagalan tidak di-cache: percobaan berikutnya (mis. ganti kualitas) dapat mengulang.
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}

const pickSize = (key: PhotoTextureKey, want: number) => {
  const sizes = PHOTO_TEXTURES[key].sizes;
  return sizes.reduce((best, s) => (Math.abs(s - want) < Math.abs(best - want) ? s : best), sizes[0]);
};

/**
 * Memuat satu set tekstur. `albedoSize`/`detailSize` dibulatkan ke ukuran yang tersedia;
 * `detailSize = 0` berarti tanpa normal & ORM (kualitas Rendah).
 */
export async function loadPhotoTextureSet(key: PhotoTextureKey, albedoSize: number, detailSize: number, anisotropy: number): Promise<PhotoTextureSet> {
  const { meters } = PHOTO_TEXTURES[key];
  const url = (size: number, kind: string) => `${BASE}/${key}/${pickSize(key, size)}-${kind}.webp`;
  const [map, normalMap, ormMap] = await Promise.all([
    loadTexture(url(albedoSize, 'albedo'), true, meters, anisotropy),
    detailSize ? loadTexture(url(detailSize, 'normal'), false, meters, anisotropy) : undefined,
    detailSize ? loadTexture(url(detailSize, 'orm'), false, meters, anisotropy) : undefined,
  ]);
  return { map, normalMap, ormMap, meters };
}

/** Membebaskan memori GPU tekstur foto yang tidak lagi dipakai (mis. setelah kualitas diturunkan). */
export async function disposePhotoTexturesExcept(keep: Set<THREE.Texture>) {
  for (const [key, p] of cache) {
    const t = await p.catch(() => null);
    if (t && !keep.has(t)) {
      t.dispose();
      cache.delete(key);
    }
  }
}

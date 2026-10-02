import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import manifest from '@/game/assets/generated/characters.json';

/**
 * Avatar Microsoft Rocketbox (MIT) hasil `scripts/assets/characters.mjs` (ART_DIRECTION.md §5).
 * Satu GLB per avatar + satu pustaka animasi per gender yang dipakai bersama (rangka `Bip01` sama).
 * Semua dimuat malas & di-cache; pemanggil menampilkan model prosedural selama memuat atau bila gagal.
 */
export type AvatarName = keyof typeof manifest.avatars;
export type AvatarState = 'walk' | 'idle' | 'wait' | 'angry' | 'talk' | 'talk2' | 'sit';
type Gender = 'f' | 'm';

interface AvatarMeta {
  file: string;
  gender: string;
  height: number;
  hip: number;
}
interface AnimMeta {
  file: string;
  hip: number;
  clips: Record<string, { duration: number; speed: number }>;
}

const AVATARS = manifest.avatars as Record<string, AvatarMeta>;
const ANIMS = manifest.anims as unknown as Record<Gender, AnimMeta>;

export function hasAvatar(name: string | undefined): name is AvatarName {
  return !!name && name in AVATARS;
}

export interface AvatarAsset {
  name: AvatarName;
  /** Templat — klon dengan `SkeletonUtils.clone` per karakter. */
  scene: THREE.Group;
  clips: Map<AvatarState, THREE.AnimationClip>;
  /** Kecepatan maju asli klip berjalan (m/s) untuk menyamakan langkah dengan gerak NPC. */
  walkSpeed: number;
  /** Tinggi asli avatar (m). */
  height: number;
  female: boolean;
}

const BASE = import.meta.env.BASE_URL + 'assets/';
let loader: GLTFLoader | null = null;
function gltfLoader() {
  if (!loader) {
    loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
  }
  return loader;
}

const animCache = new Map<Gender, Promise<{ clips: THREE.AnimationClip[]; hip: number }>>();
function loadAnims(gender: Gender) {
  let p = animCache.get(gender);
  if (!p) {
    const meta = ANIMS[gender];
    p = gltfLoader()
      .loadAsync(BASE + meta.file)
      .then((g: GLTF) => ({ clips: g.animations, hip: meta.hip }));
    p.catch(() => animCache.delete(gender));
    animCache.set(gender, p);
  }
  return p;
}

/**
 * Klip berbagi rotasi tulang; hanya posisi akar (`Bip01`) yang diskalakan dengan rasio tinggi
 * pinggul avatar ÷ rangka animasi agar kaki tetap menapak pada avatar yang lebih pendek/tinggi.
 */
function retarget(clip: THREE.AnimationClip, ratio: number): THREE.AnimationClip {
  const c = clip.clone();
  for (const t of c.tracks) {
    if (t.name === 'Bip01.position') {
      const v = t.values;
      for (let i = 0; i < v.length; i++) v[i] *= ratio;
    }
  }
  return c;
}

const avatarCache = new Map<AvatarName, Promise<AvatarAsset>>();
const ready = new Map<AvatarName, AvatarAsset>();

export function loadAvatar(name: AvatarName): Promise<AvatarAsset> {
  let p = avatarCache.get(name);
  if (!p) {
    const meta = AVATARS[name];
    const gender = (meta.gender === 'm' ? 'm' : 'f') as Gender;
    p = Promise.all([gltfLoader().loadAsync(BASE + meta.file), loadAnims(gender)]).then(([g, anims]) => {
      const scene = g.scene;
      scene.traverse((o) => {
        const mesh = o as THREE.SkinnedMesh;
        if (!mesh.isSkinnedMesh) return;
        // Rangka bergerak jauh dari pose ikat (duduk, melangkah): bola batas lebar agar tidak hilang saat culling.
        mesh.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 90, 0), 130);
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          const std = m as THREE.MeshStandardMaterial;
          if (std.alphaTest > 0) std.alphaToCoverage = true;
        }
      });
      const ratio = meta.hip / anims.hip;
      const clips = new Map<AvatarState, THREE.AnimationClip>();
      for (const clip of anims.clips) clips.set(clip.name as AvatarState, retarget(clip, ratio));
      const asset: AvatarAsset = { name, scene, clips, walkSpeed: ANIMS[gender].clips.walk?.speed || 1.3, height: meta.height, female: gender === 'f' };
      ready.set(name, asset);
      return asset;
    });
    p.catch((e) => {
      console.warn(`Avatar ${name} gagal dimuat; memakai karakter prosedural.`, e);
      avatarCache.delete(name);
    });
    avatarCache.set(name, p);
  }
  return p;
}

/** Aset yang sudah selesai dimuat (tanpa menunggu), untuk render pertama tanpa kedipan fallback. */
export function readyAvatar(name: AvatarName): AvatarAsset | undefined {
  return ready.get(name);
}

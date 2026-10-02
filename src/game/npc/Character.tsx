import { useEffect, useMemo, useReducer, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BlobShadow } from '@/game/visual/BlobShadow';
import { useSettings } from '@/stores/settingsStore';
import { BONE, BONE_DEFS, characterGeometry, characterMaterial, type CharacterStyle } from './characterModel';
import { hasAvatar, loadAvatar, readyAvatar, type AvatarAsset } from './avatars';
import { AvatarModel } from './AvatarCharacter';

export type CharacterMode = 'idle' | 'impatient' | 'talk' | 'sit' | 'work' | 'angry';

/** Status animasi yang diisi oleh komponen NPC/pemain setiap frame. */
export interface CharacterAnim {
  moving: boolean;
  phase: number;
  mode?: CharacterMode;
  /** Kecepatan berjalan (m/s) untuk menyesuaikan frekuensi langkah. */
  speed?: number;
}

interface Rig {
  mesh: THREE.SkinnedMesh;
  bones: THREE.Bone[];
  /** Status tatapan acak (menoleh sesekali). */
  look: { yaw: number; pitch: number; next: number };
}

function createRig(style: CharacterStyle): Rig {
  const bones = BONE_DEFS.map(() => new THREE.Bone());
  BONE_DEFS.forEach((d, i) => {
    const p = d.parent >= 0 ? BONE_DEFS[d.parent].pos : [0, 0, 0];
    bones[i].position.set(d.pos[0] - p[0], d.pos[1] - p[1], d.pos[2] - p[2]);
    if (d.parent >= 0) bones[d.parent].add(bones[i]);
  });
  const mesh = new THREE.SkinnedMesh(characterGeometry(style), characterMaterial);
  mesh.add(bones[0]);
  mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones));
  mesh.frustumCulled = true;
  return { mesh, bones, look: { yaw: 0, pitch: 0, next: 0 } };
}

const damp = THREE.MathUtils.damp;

/** Sudut target per tulang (radian) — diisi oleh pose, lalu diredam ke tulang. */
type Pose = { rx: number[]; ry: number[]; rz: number[]; rootY: number };

function blankPose(): Pose {
  return { rx: new Array(12).fill(0), ry: new Array(12).fill(0), rz: new Array(12).fill(0), rootY: BONE_DEFS[0].pos[1] };
}

function poseFor(rig: Rig, a: CharacterAnim, style: CharacterStyle, t: number, dt: number, seed: number): Pose {
  const P = blankPose();
  const { rx, ry, rz } = P;
  const B = BONE;
  const skirt = style.bottom === 'skirt';
  if (style.elderly) {
    rx[B.spine] = 0.14;
    rx[B.head] = -0.08;
  }
  // Lengan sedikit menjauh dari badan agar tidak menembus pinggul.
  rz[B.upperArmL] = 0.06;
  rz[B.upperArmR] = -0.06;
  rx[B.foreArmL] = rx[B.foreArmR] = -0.18;

  if (a.moving) {
    const angry = a.mode === 'angry';
    const freq = (style.elderly ? 3.3 : 4.2) * (angry ? 1.12 : 1);
    a.phase += dt * (a.speed ?? 1.5) * freq;
    const p = a.phase;
    const s = Math.sin(p);
    const c = Math.cos(p);
    const A = (skirt ? 0.3 : 0.46) * (style.elderly ? 0.75 : 1);
    rx[B.thighL] = -A * s;
    rx[B.thighR] = A * s;
    rx[B.shinL] = 0.85 * Math.max(0, c) * (A / 0.46);
    rx[B.shinR] = 0.85 * Math.max(0, -c) * (A / 0.46);
    const arm = (angry ? 0.55 : 0.42) * (A / 0.46);
    rx[B.upperArmL] = arm * s;
    rx[B.upperArmR] = -arm * s;
    rx[B.foreArmL] = -0.25 - Math.max(0, -s) * 0.25;
    rx[B.foreArmR] = -0.25 - Math.max(0, s) * 0.25;
    P.rootY += 0.012 - Math.abs(s) * 0.024;
    rz[B.root] = s * 0.035;
    ry[B.root] = s * 0.06;
    ry[B.chest] = -s * 0.1;
    ry[B.head] = s * 0.04;
    if (angry) rx[B.head] += 0.22;
    return P;
  }

  // Napas & pindah tumpuan (dasar semua pose diam).
  const breathe = Math.sin(t * 1.7 + seed) * 0.018;
  rx[B.chest] = -breathe;
  rz[B.root] = Math.sin(t * 0.45 + seed * 3) * 0.025;
  rz[B.spine] = -rz[B.root] * 0.6;
  // Menoleh sesekali.
  const look = rig.look;
  if (t > look.next) {
    look.yaw = (Math.sin(seed * 12.9 + t * 3.1) * 0.5) * (a.mode === 'talk' ? 0.3 : 1);
    look.pitch = Math.sin(seed * 7.3 + t) * 0.08;
    look.next = t + 2.5 + ((seed * 97 + t * 13) % 4);
  }
  ry[B.head] = look.yaw;
  rx[B.head] += look.pitch;

  switch (a.mode) {
    case 'sit': {
      P.rootY = 0.54;
      rx[B.thighL] = rx[B.thighR] = -1.48;
      rx[B.shinL] = rx[B.shinR] = 1.42;
      rz[B.thighL] = 0.05;
      rz[B.thighR] = -0.05;
      rx[B.spine] = -0.05;
      rx[B.upperArmL] = rx[B.upperArmR] = -0.32;
      rx[B.foreArmL] = rx[B.foreArmR] = -0.95;
      rz[B.root] = 0;
      break;
    }
    case 'impatient': {
      // Bersedekap + mengetuk kaki; sesekali melihat jam tangan.
      const watch = (t + seed * 5) % 7 < 1.6;
      if (watch) {
        rx[B.upperArmL] = -0.55;
        ry[B.upperArmL] = -1.0;
        rx[B.foreArmL] = -1.95;
        rx[B.head] = 0.38;
        ry[B.head] = 0.3;
      } else {
        // Lengan atas sedikit ke depan & dipelintir ke dalam → lengan bawah menyilang di depan perut.
        rx[B.upperArmL] = rx[B.upperArmR] = -0.32;
        ry[B.upperArmL] = -1.25;
        ry[B.upperArmR] = 1.25;
        rz[B.upperArmL] = 0.12;
        rz[B.upperArmR] = -0.12;
        rx[B.foreArmL] = -1.62;
        rx[B.foreArmR] = -1.72;
      }
      rx[B.thighR] = -0.06;
      rx[B.shinR] = 0.12 + Math.max(0, Math.sin(t * 9)) * 0.1;
      break;
    }
    case 'talk': {
      const g = Math.sin(t * 2.3 + seed);
      rx[B.upperArmR] = -0.28 - Math.max(0, g) * 0.2;
      rx[B.foreArmR] = -0.95 - g * 0.25;
      rz[B.upperArmR] = -0.12;
      rx[B.head] += Math.sin(t * 2.6 + seed) * 0.05;
      break;
    }
    case 'work': {
      const k = Math.sin(t * 7 + seed) * 0.05;
      rx[B.upperArmL] = rx[B.upperArmR] = -0.5;
      rx[B.foreArmL] = -0.85 + k;
      rx[B.foreArmR] = -0.85 - k;
      rx[B.head] += 0.16;
      break;
    }
    default:
      break;
  }
  return P;
}

function applyPose(rig: Rig, P: Pose, dt: number, snap: boolean) {
  const k = snap ? 1000 : 12;
  rig.bones.forEach((bone, i) => {
    bone.rotation.x = damp(bone.rotation.x, P.rx[i], k, dt);
    bone.rotation.y = damp(bone.rotation.y, P.ry[i], k, dt);
    bone.rotation.z = damp(bone.rotation.z, P.rz[i], k, dt);
  });
  const root = rig.bones[0];
  root.position.y = damp(root.position.y, P.rootY, snap ? 1000 : 10, dt);
}

function styleSeed(key: string) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 9973;
  return h / 9973;
}

/** Aset avatar yang sudah siap; memicu pemuatan bila belum. `undefined` selama memuat/gagal. */
function useAvatarAsset(name: string | undefined): AvatarAsset | undefined {
  const valid = hasAvatar(name) ? name : undefined;
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    if (!valid || readyAvatar(valid)) return;
    let alive = true;
    loadAvatar(valid).then(
      () => alive && rerender(),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [valid]);
  return valid ? readyAvatar(valid) : undefined;
}

/**
 * Karakter: avatar Rocketbox ber-motion capture bila tersedia (ART_DIRECTION.md §5), dengan model
 * prosedural sebagai fallback selama memuat atau bila aset gagal dimuat. `style` harus stabil.
 */
export function Character({ style, anim, castShadow = false }: { style: CharacterStyle; anim: MutableRefObject<CharacterAnim>; castShadow?: boolean }) {
  const asset = useAvatarAsset(style.avatar);
  if (asset) {
    // Avatar Rocketbox setinggi 1,72–1,87 m; diskalakan ke postur rata-rata Indonesia dengan variasi
    // dari gaya karakter (perempuan ±1,55–1,65 m, laki-laki ±1,64–1,76 m).
    const target = style.height * (asset.female ? 1.64 : 1.66);
    return (
      <group>
        <AvatarModel asset={asset} anim={anim} seed={styleSeed(style.key)} scale={target / asset.height} />
        <BlobShadow size={0.8} />
      </group>
    );
  }
  return <ProceduralCharacter style={style} anim={anim} castShadow={castShadow} />;
}

/**
 * Karakter skinned prosedural. Satu draw call per karakter; animasi dihitung di CPU (12 tulang).
 */
function ProceduralCharacter({ style, anim, castShadow = false }: { style: CharacterStyle; anim: MutableRefObject<CharacterAnim>; castShadow?: boolean }) {
  const rig = useMemo(() => createRig(style), [style]);
  useEffect(() => () => rig.mesh.skeleton.dispose(), [rig]);
  useEffect(() => {
    rig.mesh.castShadow = castShadow;
  }, [rig, castShadow]);
  const seed = useMemo(() => styleSeed(style.key), [style.key]);
  const reduceMotion = useSettings((s) => s.settings.reduceMotion);
  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const pose = poseFor(rig, anim.current, style, state.clock.elapsedTime, dt, seed);
    applyPose(rig, pose, dt, reduceMotion && !anim.current.moving);
  });
  return (
    <group scale={style.height}>
      <primitive object={rig.mesh} />
      <BlobShadow size={0.8} />
    </group>
  );
}

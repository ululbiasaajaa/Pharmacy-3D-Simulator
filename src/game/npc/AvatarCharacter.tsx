import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { AvatarAsset, AvatarState } from './avatars';
import type { CharacterAnim } from './Character';

/** Status gameplay → klip motion capture (ART_DIRECTION.md §5). */
export function avatarStateFor(a: CharacterAnim): AvatarState {
  if (a.moving) return 'walk';
  switch (a.mode) {
    case 'sit':
      return 'sit';
    case 'impatient':
      return 'wait';
    case 'talk':
      return 'talk';
    case 'work':
      return 'talk2';
    case 'angry':
      return 'angry';
    default:
      return 'idle';
  }
}

const FADE = 0.35;
const tmpPos = new THREE.Vector3();
const tmpDir = new THREE.Vector3();

/**
 * Avatar Rocketbox ber-rangka dengan `AnimationMixer`: klip berganti mengikuti status gameplay
 * dengan crossfade; langkah kaki disamakan dengan kecepatan gerak NPC.
 */
export function AvatarModel({ asset, anim, seed, scale = 1 }: { asset: AvatarAsset; anim: MutableRefObject<CharacterAnim>; seed: number; scale?: number }) {
  const model = useMemo(() => cloneSkinned(asset.scene) as THREE.Group, [asset]);
  const mixer = useMemo(() => new THREE.AnimationMixer(model), [model]);
  const actions = useMemo(() => {
    const m = new Map<AvatarState, THREE.AnimationAction>();
    for (const [k, clip] of asset.clips) m.set(k, mixer.clipAction(clip));
    return m;
  }, [asset, mixer]);
  const current = useRef<AvatarState | null>(null);

  // Mount (termasuk mount ulang StrictMode): paksa klip diputar ulang pada frame berikutnya.
  // Mixer tidak di-uncache — ia ikut dibuang bersama model saat komponen benar-benar dilepas.
  useEffect(() => {
    current.current = null;
    return () => {
      mixer.stopAllAction();
    };
  }, [mixer]);

  const pending = useRef(0);
  // `seed` berupa pecahan 0..1 → penghitung frame harus bilangan bulat (fase LOD berbeda per avatar).
  const frame = useRef(Math.floor(seed * 1000) % 6);
  useFrame(({ camera }, rawDt) => {
    // LOD animasi: avatar tersembunyi (mis. interior di-cull, pejalan kaki belum muncul) tidak diperbarui;
    // avatar jauh (> 18 m) atau di belakang kamera diperbarui tiap 3/6 frame dengan dt terakumulasi.
    let shown = true;
    for (let o: THREE.Object3D | null = model; o; o = o.parent) if (!o.visible) shown = false;
    if (!shown) return;
    pending.current = Math.min(pending.current + rawDt, 0.25);
    model.getWorldPosition(tmpPos);
    camera.getWorldDirection(tmpDir);
    tmpPos.sub(camera.position);
    const dist = tmpPos.length();
    const behind = tmpPos.dot(tmpDir) < -1.5;
    const every = behind ? 6 : dist > 18 ? 3 : 1;
    if (++frame.current % every !== 0) return;
    const dt = Math.min(pending.current, 0.25);
    pending.current = 0;
    const a = anim.current;
    const want = avatarStateFor(a);
    if (want !== current.current) {
      const next = actions.get(want) ?? actions.get('idle');
      if (next) {
        const first = current.current === null;
        for (const [k, act] of actions) if (k !== want && act.isRunning()) act.fadeOut(FADE);
        next.reset();
        // Klip diam yang panjang mulai dari titik berbeda per karakter agar tidak bergerak serempak.
        if (want !== 'walk') next.time = (seed * 997) % next.getClip().duration;
        next.setEffectiveWeight(1);
        if (!first) next.fadeIn(FADE);
        next.play();
      }
      current.current = want;
    }
    const walk = actions.get('walk');
    // Langkah avatar yang diperkecil juga lebih pendek → putar lebih cepat agar kaki tidak meluncur.
    const natural = asset.walkSpeed * scale;
    if (walk) walk.timeScale = THREE.MathUtils.clamp((a.speed ?? natural) / natural, 0.6, 4);
    mixer.update(dt);
  });

  return <primitive object={model} scale={scale} />;
}

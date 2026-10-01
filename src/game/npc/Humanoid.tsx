import { forwardRef, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const SKIN = ['#f1c9a5', '#d9a57b', '#b07a52', '#8d5a3b', '#e8b995', '#c68e63', '#a26b45', '#f3d2b3'];
const HAIR = ['#1f1a17', '#3b2a20', '#6b4a2f', '#111111', '#7a5c3e', '#2b2b2b', '#553b28', '#a08060'];
const SHIRT = ['#e76f51', '#457b9d', '#8ab17d', '#e9c46a', '#b5838d', '#6d597a', '#f4a261', '#2a9d8f'];

export interface HumanoidAnim {
  moving: boolean;
  phase: number;
  working?: boolean;
}

/** Karakter low-poly sederhana dengan animasi berjalan (dibuat dari primitif sendiri). */
export const Humanoid = forwardRef<THREE.Group, { appearance: number; shirt?: string; anim: MutableRefObject<HumanoidAnim>; coat?: boolean; hijab?: boolean }>(function Humanoid(
  { appearance, shirt, anim, coat, hijab },
  ref,
) {
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const mats = useMemo(
    () => ({
      skin: new THREE.MeshStandardMaterial({ color: SKIN[appearance % SKIN.length], roughness: 0.8 }),
      hair: new THREE.MeshStandardMaterial({ color: hijab ? SHIRT[(appearance + 3) % SHIRT.length] : HAIR[appearance % HAIR.length], roughness: 0.9 }),
      shirt: new THREE.MeshStandardMaterial({ color: shirt ?? SHIRT[appearance % SHIRT.length], roughness: 0.8 }),
      pants: new THREE.MeshStandardMaterial({ color: appearance % 2 ? '#2d3748' : '#4a5568', roughness: 0.9 }),
      coat: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 }),
    }),
    [appearance, shirt, hijab],
  );

  useFrame((_, dt) => {
    const a = anim.current;
    if (a.moving) a.phase += dt * 9;
    const swing = a.moving ? Math.sin(a.phase) * 0.6 : 0;
    if (legL.current) legL.current.rotation.x = THREE.MathUtils.damp(legL.current.rotation.x, swing, 12, dt);
    if (legR.current) legR.current.rotation.x = THREE.MathUtils.damp(legR.current.rotation.x, -swing, 12, dt);
    const armSwing = a.working ? Math.sin(performance.now() / 180) * 0.4 - 0.6 : -swing * 0.8;
    if (armL.current) armL.current.rotation.x = THREE.MathUtils.damp(armL.current.rotation.x, a.working ? -0.5 : -armSwing, 10, dt);
    if (armR.current) armR.current.rotation.x = THREE.MathUtils.damp(armR.current.rotation.x, armSwing, 10, dt);
    if (body.current) body.current.position.y = a.moving ? Math.abs(Math.sin(a.phase)) * 0.04 : 0;
  });

  return (
    <group ref={ref}>
      <group ref={body}>
        {[
          [legL, -0.1],
          [legR, 0.1],
        ].map(([r, x], i) => (
          <group key={i} ref={r as React.RefObject<THREE.Group>} position={[x as number, 0.82, 0]}>
            <mesh position={[0, -0.4, 0]} material={mats.pants} castShadow>
              <boxGeometry args={[0.14, 0.8, 0.16]} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 1.15, 0]} material={coat ? mats.coat : mats.shirt} castShadow>
          <boxGeometry args={[0.42, 0.62, 0.24]} />
        </mesh>
        {coat && (
          <mesh position={[0, 1.2, 0.125]} material={mats.shirt}>
            <boxGeometry args={[0.12, 0.35, 0.01]} />
          </mesh>
        )}
        {[
          [armL, -0.27],
          [armR, 0.27],
        ].map(([r, x], i) => (
          <group key={i} ref={r as React.RefObject<THREE.Group>} position={[x as number, 1.42, 0]}>
            <mesh position={[0, -0.28, 0]} material={coat ? mats.coat : mats.shirt} castShadow>
              <boxGeometry args={[0.11, 0.56, 0.13]} />
            </mesh>
            <mesh position={[0, -0.6, 0]} material={mats.skin}>
              <boxGeometry args={[0.09, 0.1, 0.1]} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 1.62, 0]} material={mats.skin} castShadow>
          <boxGeometry args={[0.28, 0.3, 0.26]} />
        </mesh>
        <mesh position={[0, hijab ? 1.66 : 1.8, hijab ? -0.01 : -0.02]} material={mats.hair}>
          <boxGeometry args={hijab ? [0.32, 0.4, 0.3] : [0.3, 0.08, 0.28]} />
        </mesh>
        {hijab && (
          <mesh position={[0, 1.6, 0.131]} material={mats.skin}>
            <boxGeometry args={[0.2, 0.2, 0.01]} />
          </mesh>
        )}
        {[-0.06, 0.06].map((x) => (
          <mesh key={x} position={[x, 1.65, 0.131]}>
            <boxGeometry args={[0.035, 0.035, 0.01]} />
            <meshBasicMaterial color="#1b1b1b" />
          </mesh>
        ))}
      </group>
    </group>
  );
});

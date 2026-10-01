import { memo, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import { useGame } from '@/stores/gameStore';
import { minuteOfDay } from '@/domain/time';
import { daylight, daylightAt } from './daylight';
import type { VisualProfile } from './quality';

/** Memperbarui `daylight.current` dari jam permainan (sekali per frame, sebelum komponen lain). */
export function DaylightDriver() {
  useFrame(() => {
    const g = useGame.getState().game;
    const m = g ? minuteOfDay(g.time.now) : 600;
    if (Math.abs(m - daylight.minute) < 0.2) return;
    daylight.minute = m;
    daylightAt(m, daylight.current);
  }, -2);
  return null;
}

const skyVertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const skyFragment = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uGround;
varying vec3 vDir;
void main() {
  float h = vDir.y;
  vec3 col = h > 0.0 ? mix(uHorizon, uTop, pow(clamp(h, 0.0, 1.0), 0.55)) : mix(uHorizon, uGround, clamp(-h * 5.0, 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

/** Kubah langit gradien yang mengikuti jam permainan; warna kabut disamakan dengan cakrawala. */
export function SkyDome() {
  const scene = useThree((s) => s.scene);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTop: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uGround: { value: new THREE.Color('#4a4a46') } },
        vertexShader: skyVertex,
        fragmentShader: skyFragment,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        toneMapped: false,
      }),
    [],
  );
  useFrame(() => {
    const d = daylight.current;
    material.uniforms.uTop.value.copy(d.skyTop);
    material.uniforms.uHorizon.value.copy(d.skyHorizon);
    if (scene.fog) (scene.fog as THREE.Fog).color.copy(d.skyHorizon);
  });
  return (
    <mesh material={material} renderOrder={-1} frustumCulled={false} raycast={() => null}>
      <sphereGeometry args={[95, 24, 12]} />
    </mesh>
  );
}

/**
 * Lampu interior dinamis (titik). Sengaja sedikit: biaya per piksel tumbuh linear terhadap jumlah lampu,
 * sedangkan cahaya dasar sudah datang dari IBL + genangan cahaya terpanggang di lantai.
 */
export const INTERIOR_LIGHTS: [number, number][] = [
  [-1.5, 5.5],
  [1, 0.4],
  [0, -6],
  [-8, -6],
];

/** Rig cahaya: hemisfer + matahari (mengikuti jam) + lampu interior sesuai kualitas. */
export function SceneLights({ profile }: { profile: VisualProfile }) {
  const sun = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const gl = useThree((s) => s.gl);
  const shadowClock = useRef({ minute: -1, last: 0 });
  useFrame((state) => {
    const d = daylight.current;
    if (profile.sunShadows) {
      // Semua penghasil bayangan matahari statis (karakter memakai bayangan blob): perbarui shadow map
      // hanya saat matahari bergerak atau sekali per detik (untuk pintu/perabot), bukan setiap frame.
      gl.shadowMap.autoUpdate = false;
      const sc = shadowClock.current;
      const now = state.clock.elapsedTime;
      if (Math.abs(daylight.minute - sc.minute) >= 1 || now - sc.last > 1) {
        sc.minute = daylight.minute;
        sc.last = now;
        gl.shadowMap.needsUpdate = true;
      }
    } else if (!gl.shadowMap.autoUpdate) {
      gl.shadowMap.autoUpdate = true;
    }
    if (sun.current) {
      sun.current.position.copy(d.sunDir).multiplyScalar(40);
      sun.current.color.copy(d.sunColor);
      sun.current.intensity = d.sunIntensity;
    }
    if (hemi.current) {
      hemi.current.color.copy(d.hemiSky);
      hemi.current.groundColor.copy(d.hemiGround);
      hemi.current.intensity = d.hemiIntensity;
    }
  });
  return (
    <>
      <hemisphereLight ref={hemi} />
      <directionalLight
        ref={sun}
        castShadow={profile.sunShadows}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-24}
        shadow-camera-right={24}
        shadow-camera-top={24}
        shadow-camera-bottom={-24}
        shadow-camera-near={1}
        shadow-camera-far={90}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-radius={3}
      />
      {INTERIOR_LIGHTS.slice(0, profile.interiorLights).map(([x, z]) => (
        <pointLight key={`${x},${z}`} position={[x, 2.45, z]} intensity={7} distance={11} decay={1.6} color="#fff6ec" />
      ))}
    </>
  );
}

/**
 * Cahaya lingkungan (IBL) yang dibuat di dalam scene dan dirender SEKALI:
 * panel plafon, cahaya etalase, dan pantulan lantai. Tanpa unduhan HDRI.
 */
export const SceneEnvironment = memo(function SceneEnvironment({ resolution }: { resolution: number }) {
  const panels: [number, number][] = [];
  for (const x of [-6, -2, 2, 6]) for (const z of [-5, 0, 5]) panels.push([x, z]);
  return (
    <Environment frames={1} resolution={resolution} environmentIntensity={0.85}>
      <color attach="background" args={['#c9c5bd']} />
      {panels.map(([x, z]) => (
        <Lightformer key={`${x},${z}`} form="rect" intensity={2.4} color="#fff8f0" position={[x, 3.2, z]} rotation-x={Math.PI / 2} scale={[1.4, 1.4, 1]} />
      ))}
      <Lightformer form="rect" intensity={1.6} color="#e9f2fb" position={[0, 1.4, 9]} rotation-y={Math.PI} scale={[22, 2.6, 1]} />
      <Lightformer form="rect" intensity={1.1} color="#ebe6dd" position={[0, -2.5, 0]} rotation-x={-Math.PI / 2} scale={[30, 30, 1]} />
      <Lightformer form="rect" intensity={0.35} color="#cfe3df" position={[-9, 1.5, 0]} rotation-y={Math.PI / 2} scale={[20, 3, 1]} />
    </Environment>
  );
});

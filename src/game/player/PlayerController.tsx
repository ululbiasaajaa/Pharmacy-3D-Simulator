import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGame, act } from '@/stores/gameStore';
import { useUi } from '@/stores/uiStore';
import { useSettings } from '@/stores/settingsStore';
import { useWorld, interactableObjects, occluderObjects } from '@/game/world/worldStore';
import { buildColliders, moveWithCollision, pointInBoxes } from '@/game/world/collision';
import { PLAYER_RADIUS, PLAYER_SPAWN, WALLS, type AABB } from '@/game/world/layout';
import { INTERACTABLES, interact } from '@/game/interactions/interactions';
import { tutorialAwaits, tutorialSignal } from '@/domain/guidance';
import { audio } from '@/services/audio/audioEngine';
import { Humanoid, type HumanoidAnim } from '@/game/npc/Humanoid';
import { flashMessage } from '@/components/hud/flash';

const EYE = 1.65;

/** Kontrol pemain orang pertama (default) atau orang ketiga (opsional). */
export function PlayerController() {
  const { camera, gl, scene } = useThree();
  const pos = useRef({ x: PLAYER_SPAWN.x, z: PLAYER_SPAWN.z });
  const yaw = useRef(Math.PI); // menghadap pintu masuk (+Z)
  const pitch = useRef(-0.05);
  const keys = useRef(new Set<string>());
  const bob = useRef(0);
  const stepAcc = useRef(0);
  const movedTotal = useRef(0);
  const lastFocusCheck = useRef(0);
  const lastWorldSync = useRef(0);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const avatarRef = useRef<THREE.Group>(null);
  const avatarAnim = useRef<HumanoidAnim>({ moving: false, phase: 0 });
  const cameraMode = useSettings((s) => s.settings.cameraMode);

  const doorsOpen = useWorld((s) => s.doorsOpen);
  const roomsKey = useGame((s) => (s.game?.pharmacy.unlockedRooms ?? []).join(','));
  const upgrades = useGame((s) => s.game?.pharmacy.upgrades);
  const colliders = useMemo(
    () =>
      buildColliders({
        doorsOpen,
        unlockedRooms: (roomsKey ? roomsKey.split(',') : []) as never,
        upgrades: upgrades ?? {},
      }),
    [doorsOpen, roomsKey, upgrades],
  );
  // Penghalang kamera orang ketiga: dinding & pintu tertutup (perabot rendah diabaikan).
  const cameraBlockers = useMemo<AABB[]>(() => colliders.filter((c) => WALLS.includes(c) || (c.maxZ - c.minZ <= 0.21 && c.maxX - c.minX <= 1.5)), [colliders]);

  useEffect(() => {
    camera.rotation.order = 'YXZ';
  }, [camera]);

  // Hook khusus mode pengembangan (tidak ada di build produksi) untuk tangkapan layar/uji visual.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as { __pharmacyDebug?: unknown };
    w.__pharmacyDebug = {
      teleport: (x: number, z: number, yawDeg: number, pitchDeg = 0) => {
        pos.current = { x, z };
        yaw.current = (yawDeg * Math.PI) / 180;
        pitch.current = (pitchDeg * Math.PI) / 180;
      },
      scene,
    };
    return () => {
      delete w.__pharmacyDebug;
    };
  }, [scene]);

  // ------------------------------------------------------------ Input
  useEffect(() => {
    const canvas = gl.domElement;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return;
      const s = useSettings.getState().settings;
      const ui = useUi.getState();
      if (e.code === s.keys.tablet) {
        e.preventDefault();
        if (ui.panel === 'tablet') ui.closePanel();
        else if (!ui.panel) ui.openPanel('tablet');
        return;
      }
      if (e.code === 'Escape') {
        if (ui.panel === 'pause') {
          ui.closePanel();
          ui.setPaused(false);
        } else if (ui.panel) ui.closePanel();
        else {
          ui.setPaused(true);
          ui.openPanel('pause');
        }
        return;
      }
      if (ui.panel) return;
      if (e.code === s.keys.interact) {
        const f = ui.focus;
        if (f) {
          const reason = interact(f.id);
          if (reason) flashMessage(reason);
        }
        return;
      }
      if (e.code === s.keys.camera) {
        useSettings.getState().update({ cameraMode: s.cameraMode === 'first' ? 'third' : 'first' });
        return;
      }
      keys.current.add(e.code);
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => keys.current.delete(e.code);
    const onBlur = () => keys.current.clear();
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;
      const s = useSettings.getState().settings;
      const k = 0.0022 * s.mouseSensitivity;
      yaw.current -= e.movementX * k;
      pitch.current -= e.movementY * k * (s.invertY ? -1 : 1);
      pitch.current = Math.max(-1.35, Math.min(1.35, pitch.current));
    };
    const onClick = () => {
      const ui = useUi.getState();
      audio.unlock();
      if (!ui.panel && !ui.paused && document.pointerLockElement !== canvas) {
        try {
          const r = canvas.requestPointerLock() as unknown as Promise<void> | undefined;
          if (r && typeof r.catch === 'function') r.catch(() => undefined);
        } catch {
          /* pointer lock tidak didukung — kontrol keyboard tetap bekerja */
        }
      }
    };
    const onLockChange = () => {
      const locked = document.pointerLockElement === canvas;
      const ui = useUi.getState();
      ui.setPointerLocked(locked);
      // Esc keluar dari pointer lock → buka menu jeda (kecuali karena panel dibuka).
      if (!locked && !ui.panel && !ui.paused) {
        ui.setPaused(true);
        ui.openPanel('pause');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    window.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('click', onClick);
    document.addEventListener('pointerlockchange', onLockChange);
    // Panel dibuka → lepaskan kursor agar UI dapat diklik.
    const unsub = useUi.subscribe((st, prev) => {
      if (st.panel && !prev.panel && document.pointerLockElement) {
        keys.current.clear();
        document.exitPointerLock();
      }
    });
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('click', onClick);
      document.removeEventListener('pointerlockchange', onLockChange);
      unsub();
      if (document.pointerLockElement === canvas) document.exitPointerLock();
    };
  }, [gl]);

  // ------------------------------------------------------------ Loop
  useFrame((_, rawDt) => {
    const dt = Math.min(0.12, rawDt);
    const s = useSettings.getState().settings;
    const ui = useUi.getState();
    const blocked = !!ui.panel || ui.paused;
    const k = keys.current;

    let fwd = 0;
    let strafe = 0;
    if (!blocked) {
      if (k.has(s.keys.forward) || k.has('ArrowUp')) fwd += 1;
      if (k.has(s.keys.back) || k.has('ArrowDown')) fwd -= 1;
      if (k.has(s.keys.right)) strafe += 1;
      if (k.has(s.keys.left)) strafe -= 1;
      if (k.has('ArrowLeft')) yaw.current += 1.9 * dt;
      if (k.has('ArrowRight')) yaw.current -= 1.9 * dt;
      if (k.has('PageUp')) pitch.current = Math.min(1.35, pitch.current + 1.2 * dt);
      if (k.has('PageDown')) pitch.current = Math.max(-1.35, pitch.current - 1.2 * dt);
    }
    const len = Math.hypot(fwd, strafe);
    let moving = false;
    if (len > 0) {
      const sprint = k.has(s.keys.sprint) ? 1.6 : 1;
      const speed = 3.2 * s.moveSpeed * sprint;
      const fx = -Math.sin(yaw.current);
      const fz = -Math.cos(yaw.current);
      const rx = Math.cos(yaw.current);
      const rz = -Math.sin(yaw.current);
      const dx = ((fx * fwd + rx * strafe) / len) * speed * dt;
      const dz = ((fz * fwd + rz * strafe) / len) * speed * dt;
      const [nx, nz] = moveWithCollision(pos.current.x, pos.current.z, dx, dz, PLAYER_RADIUS, colliders);
      const moved = Math.hypot(nx - pos.current.x, nz - pos.current.z);
      pos.current.x = nx;
      pos.current.z = nz;
      moving = moved > 0.0005;
      if (moving) {
        stepAcc.current += moved;
        movedTotal.current += moved;
        if (stepAcc.current > 0.75) {
          stepAcc.current = 0;
          audio.play('step');
        }
        // Sinyal dikirim saat langkah "Bergerak" aktif — termasuk bila pemain sudah berjalan sebelum langkah itu.
        if (movedTotal.current > 1) {
          const g = useGame.getState().game;
          if (g && tutorialAwaits(g, 'moved')) act((x) => tutorialSignal(x, 'moved'));
        }
      }
    }
    bob.current = moving && !s.reduceMotion ? bob.current + dt * 10 : 0;
    const bobY = moving && !s.reduceMotion ? Math.sin(bob.current) * 0.035 : 0;

    const third = s.cameraMode === 'third';
    const fx = -Math.sin(yaw.current);
    const fz = -Math.cos(yaw.current);
    if (third) {
      // Tarik kamera mendekat bila jalur kamera menembus dinding.
      let dist = 2.6;
      for (let d = 0.3; d <= 2.6; d += 0.1) {
        if (pointInBoxes(pos.current.x - fx * d, pos.current.z - fz * d, 0.2, cameraBlockers)) {
          dist = Math.max(0.25, d - 0.25);
          break;
        }
      }
      const target = new THREE.Vector3(pos.current.x, 1.5, pos.current.z);
      camera.position.set(pos.current.x - fx * dist, 2.3 - pitch.current * 1.2, pos.current.z - fz * dist);
      camera.lookAt(target.x + fx * 1.5, 1.4 + pitch.current * 1.5, target.z + fz * 1.5);
    } else {
      camera.position.set(pos.current.x, EYE + bobY, pos.current.z);
      camera.rotation.set(pitch.current, yaw.current, 0, 'YXZ');
    }
    if (avatarRef.current) {
      avatarRef.current.visible = third;
      avatarRef.current.position.set(pos.current.x, 0, pos.current.z);
      avatarRef.current.rotation.y = yaw.current + Math.PI;
      avatarAnim.current.moving = moving;
    }

    // Raycast untuk objek yang dituju (throttle ±10 Hz).
    const now = performance.now();
    if (now - lastFocusCheck.current > 90) {
      lastFocusCheck.current = now;
      let id: string | null = null;
      if (!blocked) {
        if (third) {
          const dir = new THREE.Vector3(fx * Math.cos(pitch.current), Math.sin(pitch.current), fz * Math.cos(pitch.current)).normalize();
          raycaster.set(new THREE.Vector3(pos.current.x, 1.5, pos.current.z), dir);
          raycaster.far = 3;
        } else {
          raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
          raycaster.far = 3;
        }
        const hits = raycaster.intersectObjects([...interactableObjects.values(), ...occluderObjects.values()], true);
        // Hanya hit terdekat yang dihitung: dinding menghalangi objek di baliknya.
        const first = hits.find((h) => h.object.visible);
        if (first) {
          let o: THREE.Object3D | null = first.object;
          while (o && !o.userData.interactableId) o = o.parent;
          if (o) id = o.userData.interactableId as string;
        }
      }
      const game = useGame.getState().game;
      const def = id ? INTERACTABLES.get(id) : undefined;
      if (def && game) {
        ui.setFocus({ id: def.id, label: def.label, action: def.action(game), disabledReason: def.blocked?.(game) ?? undefined });
      } else if (ui.focus) ui.setFocus(null);
    }
    if (now - lastWorldSync.current > 120) {
      lastWorldSync.current = now;
      useWorld.getState().setPlayer(pos.current.x, pos.current.z, yaw.current);
    }
  });

  return (
    <group ref={avatarRef} visible={cameraMode === 'third'}>
      <Humanoid appearance={2} shirt="#0e655b" coat anim={avatarAnim} />
    </group>
  );
}

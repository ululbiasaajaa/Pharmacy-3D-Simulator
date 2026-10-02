import { memo, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGame } from '@/stores/gameStore';
import { useUi } from '@/stores/uiStore';
import { Character, type CharacterAnim } from './Character';
import { patientStyle } from './characterModel';
import {
  CASHIER_SPOT,
  DOOR_INSIDE,
  DOOR_OUTSIDE,
  EMPLOYEE_SERVICE_SPOTS,
  SERVICE_SPOT,
  checkoutSlot,
  queueSlot,
  seatSlot,
  type Vec2,
} from '@/game/world/layout';
import { doorSensor } from './doorSensor';
import { crowd, vehicles } from './crowd';
import { crossingClear, entersRoad } from '@/game/world/traffic';
import { outsideVisible } from '@/game/visual/InteriorCull';
import { patientRoute } from '@/game/world/district';
import { audio } from '@/services/audio/audioEngine';
import type { Patient } from '@/domain/types';

interface Target {
  pos: Vec2;
  exiting: boolean;
  seated: boolean;
}

/** Menentukan posisi tujuan setiap pasien murni dari status domain. */
function computeTargets(patients: Patient[], queue: string[], employeeServing: Map<string, number>): Map<string, Target> {
  const out = new Map<string, Target>();
  let checkoutIdx = 0;
  let seatIdx = 0;
  for (const p of patients) {
    let pos: Vec2;
    let exiting = false;
    let seated = false;
    switch (p.status) {
      case 'entering':
      case 'waiting': {
        const i = queue.indexOf(p.id);
        pos = queueSlot(Math.max(0, i));
        break;
      }
      case 'serving': {
        const e = employeeServing.get(p.id);
        pos = e !== undefined ? EMPLOYEE_SERVICE_SPOTS[e % EMPLOYEE_SERVICE_SPOTS.length] : SERVICE_SPOT;
        break;
      }
      case 'checkout':
        pos = checkoutIdx === 0 ? CASHIER_SPOT : checkoutSlot(checkoutIdx);
        checkoutIdx++;
        break;
      case 'awaiting':
        pos = seatSlot(seatIdx++);
        seated = true;
        break;
      default:
        // Rute keluar mengikuti rute luar pasien (lihat useEffect di PatientNPC).
        pos = DOOR_OUTSIDE;
        exiting = true;
    }
    out.set(p.id, { pos, exiting, seated });
  }
  return out;
}

const PatientNPC = memo(function PatientNPC({ patient, target, speedMult }: { patient: Patient; target: Target; speedMult: number }) {
  const group = useRef<THREE.Group>(null);
  const anim = useRef<CharacterAnim>({ moving: false, phase: 0 });
  const { id, gender, age, appearance } = patient;
  const style = useMemo(() => patientStyle({ id, gender, age, appearance }), [id, gender, age, appearance]);
  const seatBlend = useRef(0);
  const bar = useRef<THREE.Mesh>(null);
  const path = useRef<Vec2[]>([]);
  // Rute luar pasien ini (dari gang atau dari halte lewat zebra cross) + pintu luar apotek.
  const outside = useMemo<Vec2[]>(() => [...patientRoute(id), DOOR_OUTSIDE], [id]);
  const initial = useMemo<Vec2>(() => {
    // Pasien baru muncul di ujung rutenya; pasien dari data muat langsung di posisi tujuan.
    return patient.status === 'entering' ? outside[0] : target.pos;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const pos = useRef<Vec2>([...initial]);
  const crowdKey = `patient-${id}`;
  useEffect(() => () => void crowd.delete(crowdKey), [crowdKey]);

  // Rute dihitung ulang hanya bila tujuan benar-benar berubah (bukan setiap tick state).
  const targetKey = `${target.pos[0]},${target.pos[1]},${target.exiting}`;
  useEffect(() => {
    const [x, z] = pos.current;
    const t = target.pos;
    const inside = z < 9.6 && Math.abs(x) < 12;
    // Indeks titik rute luar yang terdekat dengan posisi sekarang.
    let nearest = 0;
    outside.forEach((p, i) => {
      if (Math.hypot(p[0] - x, p[1] - z) < Math.hypot(outside[nearest][0] - x, outside[nearest][1] - z)) nearest = i;
    });
    if (target.exiting) {
      path.current = inside ? [DOOR_INSIDE, ...[...outside].reverse()] : outside.slice(0, nearest + 1).reverse();
    } else if (!inside) {
      path.current = [...outside.slice(nearest + 1), DOOR_INSIDE, t];
    } else {
      path.current = [t];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey]);

  useEffect(() => {
    if (patient.status === 'entering') audio.play('arrive');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ratio = patient.maxPatience ? patient.patience / patient.maxPatience : 1;
  const status = patient.status;

  useFrame(({ camera }, dt) => {
    const g = group.current;
    if (!g) return;
    const next = path.current[0];
    let moving = false;
    // Sebelum melangkah ke zebra cross: tunggu kendaraan yang masih melaju (kendaraan berhenti untuk penyeberang).
    const waitCross = !!next && entersRoad(pos.current, next) && !crossingClear([...vehicles.entries()].map(([id, v]) => ({ id, ...v })));
    if (next && !waitCross) {
      const dx = next[0] - pos.current[0];
      const dz = next[1] - pos.current[1];
      const dist = Math.hypot(dx, dz);
      // Di luar gedung pasien berjalan lebih sigap (rute luar lebih panjang daripada di dalam).
      const outdoors = pos.current[1] > 9.6 || Math.abs(pos.current[0]) > 12;
      const step = (outdoors ? 2.0 : 1.7) * speedMult * dt;
      if (dist <= step || dist < 0.02) {
        pos.current = [next[0], next[1]];
        path.current.shift();
      } else {
        pos.current = [pos.current[0] + (dx / dist) * step, pos.current[1] + (dz / dist) * step];
        moving = true;
        g.rotation.y = Math.atan2(dx, dz);
      }
    }
    if (!moving && !target.exiting) {
      // Menghadap meja pelayanan/kasir saat berdiri.
      const face = target.seated ? 0 : Math.PI;
      g.rotation.y = THREE.MathUtils.damp(g.rotation.y, face, 6, dt);
    }
    anim.current.moving = moving;
    anim.current.speed = 1.7 * speedMult;
    const seated = target.seated && !moving && path.current.length === 0;
    anim.current.mode = seated
      ? 'sit'
      : target.exiting
        ? status === 'left'
          ? 'angry'
          : 'idle'
        : status === 'serving'
          ? 'talk'
          : ratio < 0.35 && (status === 'waiting' || status === 'entering')
            ? 'impatient'
            : 'idle';
    // Saat duduk, pinggul berada di atas dudukan (titik tujuan = posisi kaki di depan kursi).
    seatBlend.current = THREE.MathUtils.damp(seatBlend.current, seated ? 1 : 0, 8, dt);
    g.position.set(pos.current[0], 0, pos.current[1] - 0.45 * seatBlend.current);
    // Pasien di gang tidak dirender saat kamera di dalam apotek (terhalang dinding).
    const present = !(target.exiting && path.current.length === 0);
    g.visible = present && outsideVisible(camera.position.x, camera.position.z, pos.current[0], pos.current[1]);
    if (Math.abs(pos.current[0]) < 2 && Math.abs(pos.current[1] - 10) < 2.5) doorSensor.lastNear = performance.now();
    // Daftarkan posisi saat di luar (zebra cross, jalan) agar kendaraan berhenti.
    if (present && (pos.current[1] > 10.1 || Math.abs(pos.current[0]) > 12)) crowd.set(crowdKey, { x: pos.current[0], z: pos.current[1] });
    else crowd.delete(crowdKey);
    if (bar.current) {
      bar.current.scale.x = Math.max(0.02, ratio);
      bar.current.position.x = -(1 - ratio) * 0.25;
    }
  });

  const barColor = ratio > 0.6 ? '#34d399' : ratio > 0.3 ? '#fbbf24' : '#f87171';
  const icon = patient.category === 'prescription' || patient.category === 'refill' ? '#60a5fa' : patient.category === 'compounding' ? '#c084fc' : patient.category === 'inquiry' || patient.category === 'info' ? '#fde68a' : '#94a3b8';
  return (
    <group ref={group} name={`patient-${patient.id}`}>
      <Character style={style} anim={anim} />
      {!target.exiting && (
        <BillboardBar>
          <mesh position={[0, 0, 0]}>
            <planeGeometry args={[0.54, 0.09]} />
            <meshBasicMaterial color="#111827" />
          </mesh>
          <mesh ref={bar} position={[0, 0, 0.001]}>
            <planeGeometry args={[0.5, 0.06]} />
            <meshBasicMaterial color={barColor} />
          </mesh>
          <mesh position={[0, 0.13, 0]}>
            <circleGeometry args={[0.06, 12]} />
            <meshBasicMaterial color={icon} />
          </mesh>
        </BillboardBar>
      )}
    </group>
  );
});

function BillboardBar({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ camera }) => {
    if (ref.current) ref.current.quaternion.copy(camera.quaternion);
  });
  return (
    <group ref={ref} position={[0, 2.02, 0]}>
      {children}
    </group>
  );
}

export function Patients() {
  const patients = useGame((s) => s.game?.patients);
  const queue = useGame((s) => s.game?.queue);
  const employees = useGame((s) => s.game?.employees);
  const speed = useUi((s) => s.speed);
  const targets = useMemo(() => {
    const serving = new Map<string, number>();
    let i = 0;
    for (const e of employees ?? []) if (e.task?.kind === 'serve' && e.task.targetId) serving.set(e.task.targetId, i++);
    return computeTargets(patients ?? [], queue ?? [], serving);
  }, [patients, queue, employees]);
  if (!patients) return null;
  const speedMult = Math.min(3, Math.max(1, speed * 0.75));
  return (
    <group name="patients">
      {patients.map((p) => {
        const t = targets.get(p.id)!;
        return <PatientNPC key={p.id} patient={p} target={t} speedMult={speedMult} />;
      })}
    </group>
  );
}

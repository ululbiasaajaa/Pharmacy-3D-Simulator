import { memo, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGame } from '@/stores/gameStore';
import { Character, type CharacterAnim } from './Character';
import { staffStyle } from './characterModel';
import { staffSpot, type Vec2 } from '@/game/world/layout';
import { CanvasLabel } from '@/game/world/CanvasLabel';
import { ROLE_INFO } from '@/domain/employees';
import type { Employee } from '@/domain/types';

const StaffNPC = memo(function StaffNPC({ e, spot, facing }: { e: Employee; spot: Vec2; facing: number }) {
  const g = useRef<THREE.Group>(null);
  const anim = useRef<CharacterAnim>({ moving: false, phase: 0 });
  const { id, name, role, appearance } = e;
  const style = useMemo(() => staffStyle({ id, name, role, appearance }), [id, name, role, appearance]);
  const pos = useRef<Vec2>([...spot]);
  useFrame((_, dt) => {
    if (!g.current) return;
    const dx = spot[0] - pos.current[0];
    const dz = spot[1] - pos.current[1];
    const d = Math.hypot(dx, dz);
    const step = 2 * dt;
    // Perpindahan antarruang: teleport bila jauh (pegawai tidak memakai pathfinding).
    if (d > 6) pos.current = [...spot];
    else if (d > step) {
      pos.current = [pos.current[0] + (dx / d) * step, pos.current[1] + (dz / d) * step];
      g.current.rotation.y = Math.atan2(dx, dz);
    } else {
      pos.current = [...spot];
      g.current.rotation.y = THREE.MathUtils.damp(g.current.rotation.y, facing, 6, dt);
    }
    anim.current.moving = d > step && d <= 6;
    anim.current.speed = 2;
    anim.current.mode = e.status === 'working' && !anim.current.moving ? 'work' : 'idle';
    g.current.position.set(pos.current[0], 0, pos.current[1]);
  });
  return (
    <group ref={g}>
      <Character style={style} anim={anim} />
      <CanvasLabel text={`${e.name.split(' ')[0]} · ${ROLE_INFO[e.role].label}${e.status === 'resting' ? ' (istirahat)' : ''}`} width={1.3} height={0.18} position={[0, 2.15, 0]} fontSize={44} background="#0b1215" billboard />
    </group>
  );
});

export function Employees() {
  const employees = useGame((s) => s.game?.employees);
  const lounge = useGame((s) => s.game?.pharmacy.unlockedRooms.includes('staff-lounge') ?? false);
  const counter2 = useGame((s) => s.game?.pharmacy.unlockedRooms.includes('counter-2') ?? false);
  if (!employees) return null;
  const counters = new Map<string, number>();
  let servingIdx = 0;
  return (
    <group>
      {employees
        .filter((e) => e.status !== 'off')
        .map((e) => {
          const idx = counters.get(e.role) ?? 0;
          counters.set(e.role, idx + 1);
          let spot = staffSpot(e.role, idx, e.status === 'resting', lounge);
          let facing = Math.PI * 0;
          if (e.task?.kind === 'serve') {
            // Berdiri di belakang loket yang sesuai dengan posisi pasien.
            spot = servingIdx === 1 && counter2 ? [-5, 1.0] : [0.4 + servingIdx * 0.9, 1.0];
            servingIdx++;
          }
          if (spot[1] > -2 && spot[1] < 2 && e.status !== 'resting') facing = 0;
          else facing = Math.PI;
          return <StaffNPC key={e.id} e={e} spot={spot} facing={facing} />;
        })}
    </group>
  );
}

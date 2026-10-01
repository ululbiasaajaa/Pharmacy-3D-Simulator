import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useGame } from '@/stores/gameStore';
import { Interactable } from '@/game/objects/Interactable';
import { BOX_COLORS, MAT } from './materials';
import { CanvasLabel } from './CanvasLabel';
import { capacityOf, usedVolume } from '@/domain/inventory';
import type { GameState } from '@/domain/types';

/** Rasio isi rak/gudang dari data stok sebenarnya (dibulatkan agar render stabil). */
function useFill(sel: (s: GameState) => number) {
  return useGame((st) => (st.game ? Math.round(Math.max(0, Math.min(1, sel(st.game))) * 20) / 20 : 0));
}

function shelfRatio(s: GameState, filter: (medId: string) => boolean, target: number) {
  const units = s.batches.filter((b) => b.location === 'shelf' && b.status === 'active' && b.qty > 0 && filter(b.medicineId)).reduce((a, b) => a + b.qty, 0);
  return units / target;
}

/** Kotak-kotak obat instanced; jumlah yang tampil = kapasitas slot × rasio isi. */
function StockBoxes({ width, depth, levels, levelHeight, baseY, fill, seed, boxSize = [0.16, 0.2, 0.12] }: { width: number; depth: number; levels: number; levelHeight: number; baseY: number; fill: number; seed: number; boxSize?: [number, number, number] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const perRow = Math.max(1, Math.floor(width / (boxSize[0] + 0.03)));
  const rows = Math.max(1, Math.floor(depth / (boxSize[2] + 0.04)));
  const slots = perRow * rows * levels;
  const visible = Math.round(slots * fill);
  const colors = useMemo(() => {
    const arr: THREE.Color[] = [];
    let r = seed * 9301 + 49297;
    for (let i = 0; i < slots; i++) {
      r = (r * 9301 + 49297) % 233280;
      arr.push(new THREE.Color(BOX_COLORS[Math.floor((r / 233280) * BOX_COLORS.length)]));
    }
    return arr;
  }, [slots, seed]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    let i = 0;
    // Isi dari rak bawah ke atas, depan ke belakang, agar penurunan stok terlihat jelas.
    for (let lv = 0; lv < levels && i < visible; lv++) {
      for (let rw = 0; rw < rows && i < visible; rw++) {
        for (let c = 0; c < perRow && i < visible; c++) {
          const x = -width / 2 + (c + 0.5) * (width / perRow);
          const z = depth / 2 - (rw + 0.5) * (depth / rows);
          m.makeTranslation(x, baseY + lv * levelHeight + boxSize[1] / 2, z);
          mesh.setMatrixAt(i, m);
          mesh.setColorAt(i, colors[i]);
          i++;
        }
      }
    }
    mesh.count = visible;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [visible, perRow, rows, levels, width, depth, levelHeight, baseY, colors, boxSize]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, slots]} castShadow>
      <boxGeometry args={boxSize} />
      <meshStandardMaterial roughness={0.6} />
    </instancedMesh>
  );
}

function ShelfFrame({ width, depth, height, levels }: { width: number; depth: number; height: number; levels: number }) {
  const gap = height / levels;
  return (
    <group>
      {[-width / 2, width / 2].map((x) => (
        <mesh key={x} position={[x, height / 2, 0]} material={MAT.metalDark} castShadow>
          <boxGeometry args={[0.05, height, depth]} />
        </mesh>
      ))}
      <mesh position={[0, height / 2, -depth / 2 + 0.01]} material={MAT.white}>
        <boxGeometry args={[width, height, 0.02]} />
      </mesh>
      {Array.from({ length: levels + 1 }, (_, i) => (
        <mesh key={i} position={[0, 0.08 + i * gap, 0]} material={MAT.white} receiveShadow>
          <boxGeometry args={[width, 0.03, depth]} />
        </mesh>
      ))}
    </group>
  );
}

function ShelfUnit({ width, depth = 0.6, height = 2, levels = 4, fill, seed }: { width: number; depth?: number; height?: number; levels?: number; fill: number; seed: number }) {
  return (
    <group>
      <ShelfFrame width={width} depth={depth} height={height} levels={levels} />
      <StockBoxes width={width - 0.1} depth={depth - 0.1} levels={levels} levelHeight={height / levels} baseY={0.1} fill={fill} seed={seed} />
    </group>
  );
}

function Chair({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.45, 0]} material={MAT.fabric} castShadow>
        <boxGeometry args={[0.55, 0.08, 0.5]} />
      </mesh>
      <mesh position={[0, 0.75, -0.23]} material={MAT.fabric} castShadow>
        <boxGeometry args={[0.55, 0.55, 0.06]} />
      </mesh>
      <mesh position={[0, 0.22, 0]} material={MAT.metalDark}>
        <boxGeometry args={[0.45, 0.44, 0.04]} />
      </mesh>
    </group>
  );
}

function Plant({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.25, 0]} material={MAT.pot} castShadow>
        <cylinderGeometry args={[0.22, 0.17, 0.5, 8]} />
      </mesh>
      <mesh position={[0, 0.85, 0]} material={MAT.plant} castShadow>
        <icosahedronGeometry args={[0.45, 0]} />
      </mesh>
    </group>
  );
}

function Counter({ counter2 }: { counter2: boolean }) {
  return (
    <group>
      {/* Badan meja: -6.5..6 */}
      <mesh position={[-0.25, 0.5, 2]} material={MAT.counterBody} castShadow receiveShadow>
        <boxGeometry args={[12.5, 1.0, 0.8]} />
      </mesh>
      <mesh position={[-0.25, 1.02, 2]} material={MAT.counterTop} receiveShadow>
        <boxGeometry args={[12.7, 0.05, 0.95]} />
      </mesh>
      {/* Etalase kiri */}
      <mesh position={[-9.25, 0.6, 2]} material={MAT.glass}>
        <boxGeometry args={[5.5, 1.2, 0.6]} />
      </mesh>
      <mesh position={[-9.25, 0.3, 2]} material={MAT.woodDark}>
        <boxGeometry args={[5.5, 0.6, 0.62]} />
      </mesh>
      <group position={[-9.25, 0, 2]}>
        <StockBoxes width={5.2} depth={0.4} levels={1} levelHeight={0.5} baseY={0.62} fill={0.8} seed={11} boxSize={[0.14, 0.14, 0.1]} />
      </group>

      {/* Meja pelayanan */}
      <Interactable id="service-desk" position={[-2, 1.05, 2]}>
        <mesh position={[0, 0.02, 0]} material={MAT.paper}>
          <boxGeometry args={[1.2, 0.02, 0.7]} />
        </mesh>
        <mesh position={[0.35, 0.2, -0.1]} material={MAT.black}>
          <boxGeometry args={[0.45, 0.3, 0.04]} />
        </mesh>
        <mesh position={[0.35, 0.2, -0.075]} material={MAT.screen}>
          <boxGeometry args={[0.41, 0.26, 0.01]} />
        </mesh>
        <mesh position={[-0.35, 0.05, 0.1]} material={MAT.wallAccent}>
          <cylinderGeometry args={[0.06, 0.06, 0.08, 12]} />
        </mesh>
      </Interactable>
      <CanvasLabel text="PELAYANAN & RESEP" doubleSided width={1.8} height={0.3} position={[-2, 2.6, 2.3]} fontSize={56} />

      {/* Mesin kasir */}
      <Interactable id="register" position={[3, 1.05, 2]}>
        <mesh position={[0, 0.12, 0]} material={MAT.black} castShadow>
          <boxGeometry args={[0.5, 0.22, 0.45]} />
        </mesh>
        <mesh position={[0, 0.36, -0.12]} rotation={[-0.3, 0, 0]} material={MAT.screen}>
          <boxGeometry args={[0.4, 0.25, 0.03]} />
        </mesh>
        <mesh position={[0, 0.03, 0.3]} material={MAT.metal}>
          <boxGeometry args={[0.45, 0.04, 0.2]} />
        </mesh>
      </Interactable>
      <CanvasLabel text="KASIR" doubleSided width={1.2} height={0.3} position={[3, 2.6, 2.3]} fontSize={60} />

      {/* Loket 2 (perluasan) */}
      {counter2 ? (
        <>
          <Interactable id="counter-2" position={[-5, 1.05, 2]}>
            <mesh position={[0, 0.02, 0]} material={MAT.paper}>
              <boxGeometry args={[1.0, 0.02, 0.6]} />
            </mesh>
            <mesh position={[0, 0.18, -0.12]} material={MAT.screen}>
              <boxGeometry args={[0.38, 0.24, 0.03]} />
            </mesh>
          </Interactable>
          <CanvasLabel text="LOKET 2" doubleSided width={1.2} height={0.3} position={[-5, 2.6, 2.3]} fontSize={60} />
        </>
      ) : (
        <group position={[-5, 0, 2.7]}>
          <mesh position={[0, 0.5, 0]} material={MAT.barrier}>
            <boxGeometry args={[1.6, 0.12, 0.08]} />
          </mesh>
          {[-0.75, 0.75].map((x) => (
            <mesh key={x} position={[x, 0.45, 0]} material={MAT.metalDark}>
              <boxGeometry args={[0.06, 0.9, 0.06]} />
            </mesh>
          ))}
          <CanvasLabel text="LOKET 2 · SEGERA" width={1.4} height={0.25} position={[0, 0.8, 0.05]} background="#b45309" fontSize={50} />
        </group>
      )}
      {/* Gerbang staf */}
      <mesh position={[7, 0.5, 2]} material={MAT.metal}>
        <boxGeometry args={[0.05, 1, 0.05]} />
      </mesh>
    </group>
  );
}

function FrontArea({ otcFill, islandShelf, extraChairs, decor, ac, queueDisplay }: { otcFill: number; islandShelf: boolean; extraChairs: number; decor: number; ac: boolean; queueDisplay: boolean }) {
  const queueLen = useGame((s) => s.game?.queue.length ?? 0);
  return (
    <group>
      <Interactable id="otc-shelf" position={[11.55, 0, 6.25]}>
        <group position={[0, 0, -1.75]} rotation={[0, -Math.PI / 2, 0]}>
          <ShelfUnit width={2.9} depth={0.6} fill={otcFill} seed={1} />
        </group>
        <group position={[0, 0, 1.75]} rotation={[0, -Math.PI / 2, 0]}>
          <ShelfUnit width={2.9} depth={0.6} fill={otcFill} seed={2} />
        </group>
      </Interactable>
      <CanvasLabel text="OBAT BEBAS" width={1.6} height={0.3} position={[11.85, 2.4, 6.25]} rotation={[0, -Math.PI / 2, 0]} fontSize={60} />
      {islandShelf && (
        <group position={[7.7, 0, 6.1]} rotation={[0, Math.PI / 2, 0]}>
          <ShelfUnit width={3.6} depth={0.9} height={1.4} levels={3} fill={otcFill} seed={3} />
        </group>
      )}

      <Interactable id="waiting-chairs" position={[-9, 0, 5.8]}>
        {[-1.2, -0.4, 0.4, 1.2].map((x) => (
          <Chair key={x} position={[x, 0, 0]} rotation={0} />
        ))}
        {extraChairs >= 2 &&
          [-1.2, -0.4, 0.4, 1.2].map((x) => <Chair key={`b${x}`} position={[x, 0, 2.5]} rotation={0} />)}
      </Interactable>
      {extraChairs >= 1 && <Plant position={[-11.3, 0, 8.8]} />}

      <Interactable id="mission-board" position={[-11.88, 1.6, 4]}>
        <mesh rotation={[0, Math.PI / 2, 0]} material={MAT.board}>
          <boxGeometry args={[2, 1.2, 0.05]} />
        </mesh>
        {[-0.6, 0, 0.6].map((z, i) => (
          <mesh key={z} position={[0.04, 0.1 - i * 0.12, z]} rotation={[0, Math.PI / 2, (i - 1) * 0.08]} material={MAT.paper}>
            <planeGeometry args={[0.45, 0.55]} />
          </mesh>
        ))}
      </Interactable>
      <CanvasLabel text="PAPAN MISI" width={1.6} height={0.28} position={[-11.85, 2.4, 4]} rotation={[0, Math.PI / 2, 0]} fontSize={60} />

      <Interactable id="info-board" position={[-4, 1.5, 9.85]}>
        <mesh rotation={[0, Math.PI, 0]} material={MAT.board}>
          <boxGeometry args={[1.6, 1, 0.05]} />
        </mesh>
        <mesh position={[0, 0, -0.03]} rotation={[0, Math.PI, 0]} material={MAT.paper}>
          <planeGeometry args={[1.4, 0.8]} />
        </mesh>
      </Interactable>
      <CanvasLabel text="PAPAN INFORMASI" width={1.6} height={0.26} position={[-4, 2.2, 9.84]} rotation={[0, Math.PI, 0]} fontSize={52} />

      <Interactable id="sign" position={[1.9, 1.4, 9.85]}>
        <mesh rotation={[0, Math.PI, 0]} material={MAT.wallAccent}>
          <boxGeometry args={[0.8, 0.5, 0.05]} />
        </mesh>
      </Interactable>
      <SignText />

      {decor >= 1 && (
        <>
          <Plant position={[-6.2, 0, 9.3]} />
          <Plant position={[10.6, 0, 9.4]} />
        </>
      )}
      {decor >= 2 && (
        <>
          <CanvasLabel text="Simpan obat sesuai petunjuk kemasan" width={2.4} height={0.5} position={[-11.88, 1.7, 7.6]} rotation={[0, Math.PI / 2, 0]} background="#1e3a8a" fontSize={44} bold={false} />
          <CanvasLabel text="Tanyakan informasi obat kepada petugas" width={2.4} height={0.5} position={[11.88, 1.9, 0.9]} rotation={[0, -Math.PI / 2, 0]} background="#1e3a8a" fontSize={44} bold={false} />
        </>
      )}
      {ac && (
        <mesh position={[-11.8, 2.7, 6.5]} material={MAT.white}>
          <boxGeometry args={[0.25, 0.3, 1.1]} />
        </mesh>
      )}
      {queueDisplay && <CanvasLabel text={`ANTREAN: ${queueLen}`} doubleSided width={1.2} height={0.4} position={[-2, 3.0, 2.3]} background="#111827" color="#5eead4" fontSize={70} />}
    </group>
  );
}

function SignText() {
  const phase = useGame((s) => s.game?.time.phase ?? 'preopen');
  const text = phase === 'open' ? 'BUKA' : 'TUTUP';
  return <CanvasLabel doubleSided text={text} width={0.7} height={0.4} position={[1.9, 1.4, 9.82]} rotation={[0, Math.PI, 0]} background={phase === 'open' ? '#15803d' : '#b91c1c'} fontSize={120} />;
}

function StaffArea({ rxFill }: { rxFill: number }) {
  return (
    <group>
      <Interactable id="rx-shelf" position={[0, 0, -1.6]}>
        <group position={[-3, 0, 0]}>
          <ShelfUnit width={3.9} depth={0.5} height={2.1} levels={5} fill={rxFill} seed={4} />
        </group>
        <group position={[3, 0, 0]}>
          <ShelfUnit width={3.9} depth={0.5} height={2.1} levels={5} fill={rxFill} seed={5} />
        </group>
      </Interactable>
      <CanvasLabel text="OBAT RESEP" width={1.6} height={0.28} position={[-3, 2.45, -1.33]} fontSize={60} />
      <Interactable id="fridge" position={[7.1, 0, -1.5]}>
        <mesh position={[0, 0.95, 0]} material={MAT.fridgeBody} castShadow>
          <boxGeometry args={[0.95, 1.9, 0.65]} />
        </mesh>
        <mesh position={[0, 1.1, 0.33]} material={MAT.glass}>
          <boxGeometry args={[0.8, 1.3, 0.02]} />
        </mesh>
        <mesh position={[0.35, 1.1, 0.35]} material={MAT.metal}>
          <boxGeometry args={[0.04, 0.5, 0.04]} />
        </mesh>
      </Interactable>
      <CanvasLabel text="2–8 °C" width={0.6} height={0.2} position={[7.1, 2.05, -1.15]} background="#1d4ed8" fontSize={60} />
    </group>
  );
}

function StorageRoom({ fill }: { fill: number }) {
  return (
    <group>
      <group position={[-11.5, 0, -6.25]} rotation={[0, Math.PI / 2, 0]}>
        <ShelfUnit width={6.4} depth={0.6} height={2.4} levels={4} fill={fill} seed={6} />
      </group>
      <Interactable id="storage-cabinet" position={[-8, 0, -9.5]}>
        <mesh position={[0, 1.0, 0]} material={MAT.metal} castShadow>
          <boxGeometry args={[2, 2, 0.65]} />
        </mesh>
        <mesh position={[-0.5, 1.0, 0.33]} material={MAT.metalDark}>
          <boxGeometry args={[0.95, 1.9, 0.02]} />
        </mesh>
        <mesh position={[0.5, 1.0, 0.33]} material={MAT.metalDark}>
          <boxGeometry args={[0.95, 1.9, 0.02]} />
        </mesh>
      </Interactable>
      <CanvasLabel text="LEMARI GUDANG" width={1.8} height={0.28} position={[-8, 2.3, -9.15]} fontSize={56} />
      <group position={[-5.3, 0, -8.1]}>
        {Array.from({ length: Math.max(1, Math.round(fill * 6)) }, (_, i) => (
          <mesh key={i} position={[(i % 2) * 0.62 - 0.3, 0.25 + Math.floor(i / 2) * 0.5, (i % 3) * 0.1 - 0.1]} material={MAT.cardboard} castShadow>
            <boxGeometry args={[0.6, 0.48, 0.6]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Lab({ equipment }: { equipment: number }) {
  return (
    <group>
      <Interactable id="lab-table" position={[0, 0, -6]}>
        <mesh position={[0, 0.9, 0]} material={MAT.white} castShadow receiveShadow>
          <boxGeometry args={[3, 0.06, 1]} />
        </mesh>
        <mesh position={[0, 0.45, 0]} material={MAT.metal}>
          <boxGeometry args={[2.9, 0.9, 0.9]} />
        </mesh>
      </Interactable>
      <Interactable id="scale" position={[-0.8, 0.93, -6]}>
        <mesh position={[0, 0.05, 0]} material={MAT.white}>
          <boxGeometry args={[0.35, 0.1, 0.3]} />
        </mesh>
        <mesh position={[0, 0.12, 0]} material={MAT.metal}>
          <cylinderGeometry args={[0.12, 0.12, 0.02, 20]} />
        </mesh>
        <mesh position={[0, 0.06, 0.155]} material={MAT.screen}>
          <boxGeometry args={[0.2, 0.06, 0.01]} />
        </mesh>
        {equipment >= 1 && (
          <group position={[0.45, 0, 0]}>
            <mesh position={[0, 0.15, 0]} material={MAT.glass}>
              <boxGeometry args={[0.3, 0.3, 0.3]} />
            </mesh>
            <mesh position={[0, 0.03, 0]} material={MAT.black}>
              <boxGeometry args={[0.32, 0.06, 0.32]} />
            </mesh>
          </group>
        )}
      </Interactable>
      <Interactable id="mortar" position={[0.6, 0.93, -6]}>
        <mesh position={[0, 0.08, 0]} material={MAT.white}>
          <cylinderGeometry args={[0.14, 0.09, 0.16, 16]} />
        </mesh>
        <mesh position={[0.05, 0.2, 0]} rotation={[0, 0, -0.5]} material={MAT.white}>
          <cylinderGeometry args={[0.025, 0.035, 0.28, 8]} />
        </mesh>
        <mesh position={[0.35, 0.02, 0.1]} material={MAT.metal}>
          <boxGeometry args={[0.2, 0.01, 0.03]} />
        </mesh>
      </Interactable>
      <Interactable id="ingredient-rack" position={[-3.55, 0, -7]}>
        <group rotation={[0, Math.PI / 2, 0]}>
          <ShelfFrame width={3.8} depth={0.5} height={1.9} levels={4} />
          {Array.from({ length: 12 }, (_, i) => (
            <mesh key={i} position={[-1.6 + (i % 6) * 0.62, 0.22 + Math.floor(i / 6) * 0.95, 0]} material={i % 2 ? MAT.white : MAT.glass}>
              <cylinderGeometry args={[0.1, 0.1, 0.25, 10]} />
            </mesh>
          ))}
        </group>
      </Interactable>
      <CanvasLabel text="LABORATORIUM RACIK" width={2} height={0.3} position={[0, 2.6, -9.88]} fontSize={56} />
    </group>
  );
}

function Admin({ computerLevel }: { computerLevel: number }) {
  return (
    <group>
      <mesh position={[8, 0.75, -7.1]} material={MAT.wood} castShadow receiveShadow>
        <boxGeometry args={[3, 0.06, 1]} />
      </mesh>
      {[-1.4, 1.4].map((x) => (
        <mesh key={x} position={[8 + x, 0.37, -7.1]} material={MAT.woodDark}>
          <boxGeometry args={[0.06, 0.74, 0.9]} />
        </mesh>
      ))}
      <Interactable id="computer" position={[8, 0.78, -7.3]}>
        <mesh position={[0, 0.3, 0]} material={MAT.black} castShadow>
          <boxGeometry args={[0.65, 0.42, 0.04]} />
        </mesh>
        <mesh position={[0, 0.3, 0.025]} material={MAT.screen}>
          <boxGeometry args={[0.6, 0.37, 0.01]} />
        </mesh>
        <mesh position={[0, 0.02, 0.35]} material={MAT.black}>
          <boxGeometry args={[0.5, 0.02, 0.18]} />
        </mesh>
        {computerLevel >= 1 && (
          <group position={[0.72, 0, 0.08]} rotation={[0, -0.3, 0]}>
            <mesh position={[0, 0.3, 0]} material={MAT.black}>
              <boxGeometry args={[0.6, 0.4, 0.04]} />
            </mesh>
            <mesh position={[0, 0.3, 0.025]} material={MAT.screen}>
              <boxGeometry args={[0.55, 0.35, 0.01]} />
            </mesh>
          </group>
        )}
      </Interactable>
      <Chair position={[8, 0, -6.2]} rotation={Math.PI} />
      <Interactable id="filing" position={[11.52, 0, -8.6]}>
        <mesh position={[0, 0.7, 0]} material={MAT.metalDark} castShadow>
          <boxGeometry args={[0.6, 1.4, 1.1]} />
        </mesh>
        {[0.35, 0.7, 1.05].map((y) => (
          <mesh key={y} position={[-0.31, y, 0]} material={MAT.metal}>
            <boxGeometry args={[0.02, 0.05, 0.3]} />
          </mesh>
        ))}
      </Interactable>
      <Interactable id="lockers" position={[11.57, 0, -4]}>
        {[-0.8, 0, 0.8].map((z) => (
          <mesh key={z} position={[0, 1, z]} material={MAT.fabric} castShadow>
            <boxGeometry args={[0.5, 2, 0.75]} />
          </mesh>
        ))}
      </Interactable>
      <CanvasLabel text="AREA PEGAWAI" width={1.6} height={0.28} position={[11.88, 2.4, -4]} rotation={[0, -Math.PI / 2, 0]} fontSize={56} />
      <Interactable id="blueprint" position={[6, 1.6, -9.88]}>
        <mesh material={MAT.paper}>
          <boxGeometry args={[1.6, 1.1, 0.03]} />
        </mesh>
        <mesh position={[0, 0, 0.02]} material={MAT.fabric}>
          <planeGeometry args={[1.4, 0.9]} />
        </mesh>
      </Interactable>
      <CanvasLabel text="DENAH PENGEMBANGAN" width={1.8} height={0.26} position={[6, 2.3, -9.87]} fontSize={52} />
      <mesh position={[9.5, 0.4, -3.2]} material={MAT.wood}>
        <boxGeometry args={[1.2, 0.05, 0.7]} />
      </mesh>
    </group>
  );
}

function Expansions({ rooms }: { rooms: string[] }) {
  return (
    <group>
      {rooms.includes('big-warehouse') && (
        <group>
          <group position={[-11.5, 0, -14.25]} rotation={[0, Math.PI / 2, 0]}>
            <ShelfUnit width={6.4} depth={0.6} height={2.6} levels={4} fill={0.6} seed={8} />
          </group>
          <Interactable id="bw-cabinet" position={[-9, 0, -17.5]}>
            <mesh position={[0, 1, 0]} material={MAT.metal}>
              <boxGeometry args={[2, 2, 0.65]} />
            </mesh>
          </Interactable>
        </group>
      )}
      {rooms.includes('lab-2') && (
        <Interactable id="lab2-table" position={[-3, 0, -14.5]}>
          <mesh position={[0, 0.9, 0]} material={MAT.white}>
            <boxGeometry args={[2.6, 0.06, 1]} />
          </mesh>
          <mesh position={[0, 0.45, 0]} material={MAT.metal}>
            <boxGeometry args={[2.5, 0.9, 0.9]} />
          </mesh>
        </Interactable>
      )}
      {rooms.includes('admin-plus') && (
        <Interactable id="admin2-computer" position={[3, 0, -15]}>
          <mesh position={[0, 0.75, 0]} material={MAT.wood}>
            <boxGeometry args={[2.4, 0.06, 1]} />
          </mesh>
          <mesh position={[0, 1.1, -0.2]} material={MAT.screen}>
            <boxGeometry args={[0.6, 0.38, 0.03]} />
          </mesh>
        </Interactable>
      )}
      {rooms.includes('staff-lounge') && (
        <group>
          <mesh position={[9, 0.4, -17.1]} material={MAT.fabric}>
            <boxGeometry args={[3, 0.8, 1]} />
          </mesh>
          <Interactable id="coffee" position={[11.52, 0, -12.5]}>
            <mesh position={[0, 0.5, 0]} material={MAT.woodDark}>
              <boxGeometry args={[0.6, 1, 1]} />
            </mesh>
            <mesh position={[0, 1.2, 0]} material={MAT.black}>
              <boxGeometry args={[0.4, 0.4, 0.35]} />
            </mesh>
          </Interactable>
        </group>
      )}
    </group>
  );
}

export function Furniture() {
  const up = useGame((s) => s.game?.pharmacy.upgrades) ?? {};
  const roomsKey = useGame((s) => (s.game?.pharmacy.unlockedRooms ?? []).join(','));
  const rooms = roomsKey ? roomsKey.split(',') : [];
  const otcFill = useFill((s) => {
    const cap = capacityOf(s, 'shelf');
    return (usedVolume(s, 'shelf') / cap) * 2.2;
  });
  const rxFill = useFill((s) => shelfRatio(s, (id) => s.medicines.find((m) => m.id === id)?.prescriptionOnly ?? false, 90));
  const whFill = useFill((s) => (usedVolume(s, 'warehouse') / capacityOf(s, 'warehouse')) * 1.6);
  return (
    <group>
      <Counter counter2={rooms.includes('counter-2')} />
      <FrontArea otcFill={otcFill} islandShelf={(up.shelf ?? 0) >= 1} extraChairs={up['waiting-room'] ?? 0} decor={up.decor ?? 0} ac={(up.ac ?? 0) >= 1} queueDisplay={(up['service-system'] ?? 0) >= 1} />
      <StaffArea rxFill={rxFill} />
      <StorageRoom fill={whFill} />
      <Lab equipment={up['compounding-equipment'] ?? 0} />
      <Admin computerLevel={up.computer ?? 0} />
      <Expansions rooms={rooms} />
    </group>
  );
}

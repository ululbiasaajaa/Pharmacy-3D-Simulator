import { create } from 'zustand';
import type { Object3D } from 'three';

/** Status dunia 3D yang bersifat visual/sesi (tidak disimpan ke save game). */
interface WorldStore {
  doorsOpen: Record<string, boolean>;
  toggleDoor: (id: string) => void;
  setDoor: (id: string, open: boolean) => void;
  /** Posisi pemain terkini (untuk minimap/tes & pintu otomatis). */
  player: { x: number; z: number; yaw: number };
  setPlayer: (x: number, z: number, yaw: number) => void;
  /** Mobil boks PBF sudah berhenti di area bongkar muat (collider aktif hanya saat parkir penuh). */
  vanParked: boolean;
  setVanParked: (parked: boolean) => void;
}

export const useWorld = create<WorldStore>((set) => ({
  doorsOpen: {},
  toggleDoor: (id) => set((s) => ({ doorsOpen: { ...s.doorsOpen, [id]: !s.doorsOpen[id] } })),
  setDoor: (id, open) => set((s) => (s.doorsOpen[id] === open ? s : { doorsOpen: { ...s.doorsOpen, [id]: open } })),
  player: { x: 0, z: 0, yaw: 0 },
  setPlayer: (x, z, yaw) => set({ player: { x, z, yaw } }),
  vanParked: false,
  setVanParked: (vanParked) => set((s) => (s.vanParked === vanParked ? s : { vanParked })),
}));

/** Registri objek 3D yang dapat dituju raycast (di luar React state demi performa). */
export const interactableObjects = new Map<string, Object3D>();

/** Objek penghalang (dinding) agar interaksi tidak menembus tembok. */
export const occluderObjects = new Map<string, Object3D>();

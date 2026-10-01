import * as THREE from 'three';

/** Material bersama (dibuat sekali) agar scene ringan. Semua aset 3D dibuat dari primitif sendiri. */
const std = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.05, ...extra });

export const MAT = {
  floorFront: std('#dfe7e6', { roughness: 0.55 }),
  floorBack: std('#c9d1cf', { roughness: 0.7 }),
  floorLab: std('#e8f1f3', { roughness: 0.5 }),
  floorExpansion: std('#b9c2bf'),
  wall: std('#f3f1ea'),
  wallAccent: std('#129e89'),
  wallBack: std('#e7e3d8'),
  ceiling: std('#fafaf7'),
  sidewalk: std('#9aa3a6'),
  road: std('#3c4448'),
  grass: std('#6f9d5b'),
  glass: new THREE.MeshStandardMaterial({ color: '#bfe6ee', transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.1 }),
  counterTop: std('#f5f5f0', { roughness: 0.35 }),
  counterBody: std('#0e655b'),
  wood: std('#a57a52'),
  woodDark: std('#6f4f35'),
  metal: std('#9aa6ab', { metalness: 0.6, roughness: 0.35 }),
  metalDark: std('#4b565b', { metalness: 0.5, roughness: 0.4 }),
  white: std('#ffffff', { roughness: 0.4 }),
  black: std('#1f2426', { roughness: 0.4 }),
  screen: new THREE.MeshStandardMaterial({ color: '#0b2a35', emissive: '#1b8fa8', emissiveIntensity: 0.6 }),
  lightPanel: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fffbe8', emissiveIntensity: 1.2 }),
  lightWarm: new THREE.MeshStandardMaterial({ color: '#fff3d6', emissive: '#ffcf7a', emissiveIntensity: 1.1 }),
  door: std('#d9d3c4'),
  doorLocked: std('#8a6b5c'),
  fabric: std('#2f6f8f'),
  plant: std('#3f8f4a'),
  pot: std('#b8663f'),
  cardboard: std('#b98e5c'),
  board: std('#2a4a3f'),
  paper: std('#fbfaf5'),
  fridgeBody: std('#e8eef2', { roughness: 0.3, metalness: 0.2 }),
  highlight: new THREE.MeshBasicMaterial({ color: '#5eead4', wireframe: true, transparent: true, opacity: 0.85 }),
  barrier: std('#f59e0b'),
};

export const BOX_COLORS = ['#e76f51', '#2a9d8f', '#e9c46a', '#f4a261', '#264653', '#8ab17d', '#b5838d', '#6d597a', '#4895ef', '#f28482'];

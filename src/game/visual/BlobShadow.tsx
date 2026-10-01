import * as THREE from 'three';

let material: THREE.MeshBasicMaterial | null = null;
const geometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

/** Material bayangan bulat lembut (gradien radial), dibuat sekali dan dipakai bersama. */
function blobMaterial() {
  if (material) return material;
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(0.45, 'rgba(0,0,0,0.32)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(c);
  material = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
  return material;
}

/** Bayangan kontak di bawah karakter (pengganti bayangan real-time yang mahal). */
export function BlobShadow({ size = 0.75, y = 0.006 }: { size?: number; y?: number }) {
  return <mesh geometry={geometry} material={blobMaterial()} position={[0, y, 0]} scale={[size, 1, size]} renderOrder={2} raycast={() => null} />;
}

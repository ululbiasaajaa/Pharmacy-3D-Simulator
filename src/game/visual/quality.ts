import { useMemo } from 'react';
import { useSettings } from '@/stores/settingsStore';

export type GraphicsQuality = 'low' | 'medium' | 'high';

/**
 * Profil visual per tingkat kualitas grafis (lihat ART_DIRECTION.md §8).
 * Satu tempat untuk semua keputusan "seberapa berat" agar mudah disetel.
 */
export interface VisualProfile {
  quality: GraphicsQuality;
  /** Resolusi dasar tekstur prosedural (px). */
  texSize: number;
  /** Normal & roughness map prosedural. */
  detailMaps: boolean;
  /** Bayangan matahari real-time. */
  sunShadows: boolean;
  /** Halo cahaya palsu di sekitar sumber cahaya. */
  halos: boolean;
  /** Resolusi environment map (IBL). */
  envResolution: number;
  /** Jumlah lampu interior dinamis. */
  interiorLights: number;
  /** Filter anisotropik tekstur lantai/dinding. */
  anisotropy: number;
  dpr: [number, number];
  antialias: boolean;
}

export function visualProfile(quality: GraphicsQuality): VisualProfile {
  switch (quality) {
    case 'low':
      return { quality, texSize: 256, detailMaps: false, sunShadows: false, halos: false, envResolution: 64, interiorLights: 0, anisotropy: 1, dpr: [0.75, 1], antialias: false };
    case 'high':
      return { quality, texSize: 1024, detailMaps: true, sunShadows: true, halos: true, envResolution: 256, interiorLights: 4, anisotropy: 8, dpr: [1, 2], antialias: true };
    default:
      return { quality, texSize: 512, detailMaps: true, sunShadows: false, halos: true, envResolution: 128, interiorLights: 2, anisotropy: 4, dpr: [1, 1.5], antialias: true };
  }
}

export function useVisualProfile(): VisualProfile {
  const quality = useSettings((s) => s.settings.graphicsQuality);
  return useMemo(() => visualProfile(quality), [quality]);
}

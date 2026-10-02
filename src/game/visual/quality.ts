import { useMemo } from 'react';
import { useSettings } from '@/stores/settingsStore';

export type GraphicsQuality = 'low' | 'medium' | 'high' | 'ultra';

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
  /** Post-processing (ART_DIRECTION.md §7): AO layar, bloom selektif, antialias di composer. */
  postfx: { ao: false | 'half' | 'full'; aoSamples: number; denoiseSamples: number; bloom: boolean; msaa: number; smaa: boolean };
}

const NO_POSTFX: VisualProfile['postfx'] = { ao: false, aoSamples: 0, denoiseSamples: 0, bloom: false, msaa: 0, smaa: false };

export function visualProfile(quality: GraphicsQuality): VisualProfile {
  switch (quality) {
    case 'low':
      return { quality, texSize: 256, detailMaps: false, sunShadows: false, halos: false, envResolution: 64, interiorLights: 0, anisotropy: 1, dpr: [0.75, 1], antialias: false, postfx: NO_POSTFX };
    case 'high':
      return { quality, texSize: 1024, detailMaps: true, sunShadows: true, halos: true, envResolution: 256, interiorLights: 4, anisotropy: 8, dpr: [1, 2], antialias: true, postfx: NO_POSTFX };
    case 'ultra':
      // Composer + AO layar + bloom: ±35 ms/frame di Iris Xe 1080p (ART_DIRECTION.md §12) → hanya untuk GPU diskrit.
      return { quality, texSize: 1024, detailMaps: true, sunShadows: true, halos: false, envResolution: 256, interiorLights: 4, anisotropy: 8, dpr: [1, 2], antialias: false, postfx: { ao: 'half', aoSamples: 12, denoiseSamples: 4, bloom: true, msaa: 0, smaa: true } };
    default:
      // DPR maks 1,25: pada layar HiDPI (DPR 1,5) beban piksel turun ±30% tanpa perbedaan tajam yang berarti.
      return { quality, texSize: 512, detailMaps: true, sunShadows: false, halos: true, envResolution: 128, interiorLights: 2, anisotropy: 4, dpr: [1, 1.25], antialias: true, postfx: NO_POSTFX };
  }
}

export function useVisualProfile(): VisualProfile {
  const quality = useSettings((s) => s.settings.graphicsQuality);
  return useMemo(() => visualProfile(quality), [quality]);
}

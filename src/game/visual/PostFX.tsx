import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import type { VisualProfile } from './quality';

/**
 * Post-processing (ART_DIRECTION.md §7):
 * - AO layar (N8AO) memberi kedalaman di sudut dinding, kaki perabot, bawah rak, dan karakter;
 * - bloom selektif hanya untuk luminans di atas ambang (panel LED, papan nama, layar);
 * - antialias SMAA (MSAA di composer terlalu mahal untuk GPU terintegrasi — lihat §12);
 * - tone mapping Neutral dipindah ke akhir rantai (composer mematikan tone mapping renderer;
 *   exposure tetap diambil dari `gl.toneMappingExposure`).
 * Profil tanpa post-processing tidak memakai composer sama sekali.
 */
type PostFxOptions = VisualProfile['postfx'];

/** Hanya mode pengembangan: menimpa opsi post-processing untuk benchmark (`localStorage`). */
function devOverride(): Partial<PostFxOptions> {
  if (!import.meta.env.DEV) return {};
  try {
    return JSON.parse(localStorage.getItem('pharmacy3d.postfxDebug') ?? '{}') as Partial<PostFxOptions>;
  } catch {
    return {};
  }
}

export function PostFX({ profile }: { profile: VisualProfile }) {
  const o = { ...profile.postfx, ...devOverride() };
  if (!o.ao && !o.bloom && !o.smaa) return null;
  const effects = [];
  if (o.ao) {
    effects.push(
      <N8AO
        key="ao"
        aoRadius={1.3}
        distanceFalloff={1}
        intensity={4.5}
        aoSamples={o.aoSamples}
        denoiseSamples={o.denoiseSamples}
        denoiseRadius={8}
        halfRes={o.ao === 'half'}
        depthAwareUpsampling={o.ao === 'half'}
      />,
    );
  }
  if (o.bloom) effects.push(<Bloom key="bloom" luminanceThreshold={1.05} luminanceSmoothing={0.2} intensity={0.32} mipmapBlur levels={5} radius={0.6} />);
  effects.push(<ToneMapping key="tone" mode={ToneMappingMode.NEUTRAL} />);
  if (o.smaa) effects.push(<SMAA key="smaa" />);
  return (
    <EffectComposer multisampling={o.msaa} enableNormalPass={false}>
      {effects}
    </EffectComposer>
  );
}

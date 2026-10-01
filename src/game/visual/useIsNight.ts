import { useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { daylight } from './daylight';

/** Status gelap/terang kasar dari jam permainan (render ulang hanya saat ambang terlewati). */
export function useIsNight(threshold = 0.5): boolean {
  const [night, setNight] = useState(() => daylight.current.night > threshold);
  useFrame(() => {
    const n = daylight.current.night > threshold;
    if (n !== night) setNight(n);
  });
  return night;
}

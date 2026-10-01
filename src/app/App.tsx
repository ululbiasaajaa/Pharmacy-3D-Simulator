import { lazy, Suspense } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { MainMenu } from '@/components/screens/MainMenu';
import { NewGameScreen } from '@/components/screens/NewGameScreen';
import { LoadScreen } from '@/components/screens/LoadScreen';
import { SettingsScreen } from '@/components/screens/SettingsScreen';
import { GuideScreen } from '@/components/screens/GuideScreen';
import { CreditsScreen } from '@/components/screens/CreditsScreen';

// Layar permainan (Three.js) dimuat terpisah agar menu utama cepat tampil.
const PlayScreen = lazy(() => import('@/components/screens/PlayScreen'));

function Loading() {
  return (
    <div className="flex h-full items-center justify-center text-slate-300" role="status">
      Memuat apotek…
    </div>
  );
}

/** HashRouter dipakai agar build statis dapat di-host di mana saja tanpa konfigurasi server. */
export function App() {
  return (
    <HashRouter>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<MainMenu />} />
          <Route path="/new" element={<NewGameScreen />} />
          <Route path="/load" element={<LoadScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/guide" element={<GuideScreen />} />
          <Route path="/credits" element={<CreditsScreen />} />
          <Route path="/play" element={<PlayScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </HashRouter>
  );
}

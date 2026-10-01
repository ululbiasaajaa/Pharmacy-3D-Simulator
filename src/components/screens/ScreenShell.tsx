import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/primitives';
import { useT } from '@/app/i18n';

/** Kerangka halaman menu (latar, judul, tombol kembali). */
export function ScreenShell({ title, children, back = '/', wide }: { title: string; children: ReactNode; back?: string | null; wide?: boolean }) {
  const nav = useNavigate();
  const t = useT();
  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(ellipse_at_top,_#12433e_0%,_#0b1215_60%)]">
      <div className={`mx-auto px-4 py-6 sm:py-10 ${wide ? 'max-w-5xl' : 'max-w-3xl'}`}>
        <div className="mb-6 flex items-center gap-3">
          {back !== null && (
            <Button variant="ghost" onClick={() => nav(back)} aria-label={t('common.back')}>
              ← {t('common.back')}
            </Button>
          )}
          <h1 className="text-2xl font-bold text-white sm:text-3xl">{title}</h1>
        </div>
        {children}
      </div>
    </div>
  );
}

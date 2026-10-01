import { act } from '@/stores/gameStore';
import { useUi } from '@/stores/uiStore';
import { Badge, Button, Callout, Modal } from '@/components/ui/primitives';
import { useFeedback, useGameState } from './shared';
import { abortLesson, startLesson } from '@/domain/guidance';
import { LESSONS } from '@/data/lessons';

const GLOSSARY: { term: string; meaning: string; source: string }[] = [
  { term: 'FEFO', meaning: 'First Expired, First Out — barang yang kedaluwarsa lebih dulu dikeluarkan lebih dulu.', source: 'Prinsip umum manajemen persediaan' },
  { term: 'Batch / nomor lot', meaning: 'Kelompok produksi dengan tanggal kedaluwarsa yang sama; memudahkan pelacakan.', source: 'Contoh simulasi' },
  { term: 'Etiket', meaning: 'Label pada wadah obat berisi identitas pasien, nama obat, jumlah, dan aturan pakai.', source: 'Contoh simulasi' },
  { term: 'Iter', meaning: 'Tanda pada resep bahwa resep boleh diulang sejumlah kali.', source: 'Contoh simulasi' },
  { term: 'Stock opname', meaning: 'Pemeriksaan jumlah fisik stok untuk mencocokkan catatan.', source: 'Prinsip umum inventaris' },
  { term: 'HPP', meaning: 'Harga pokok penjualan — biaya batch yang terjual.', source: 'Akuntansi dasar' },
];

export function LessonsPanel() {
  const game = useGameState();
  const close = useUi((s) => s.closePanel);
  const fb = useFeedback();
  const active = game.lessons.activeLessonId;
  return (
    <Modal title="Pelajaran (Learning Mode)" subtitle={`${game.lessons.completed.length}/${LESSONS.length} selesai`} onClose={close} testId="panel-lessons">
      {game.mode !== 'learning' ? (
        <Callout tone="info">Pelajaran tersedia pada Learning Mode.</Callout>
      ) : (
        <div className="space-y-4">
          {fb.node}
          <ul className="space-y-2">
            {LESSONS.map((l) => {
              const done = game.lessons.completed.includes(l.id);
              const isActive = active === l.id;
              const feedback = [...game.lessons.feedback].reverse().find((f) => f.lessonId === l.id);
              return (
                <li key={l.id} className={`rounded-xl border p-3 text-sm ${isActive ? 'border-sky-500 bg-sky-950/30' : 'border-ink-700'}`} data-testid={`lesson-${l.id}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-white">
                        {l.title} {done && <Badge tone="green">Selesai</Badge>} {isActive && <Badge tone="blue">Aktif</Badge>}
                      </div>
                      <div className="text-muted text-xs">{l.summary}</div>
                    </div>
                    {isActive ? (
                      <Button size="sm" variant="ghost" onClick={() => act(abortLesson)}>
                        Hentikan
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={!!active}
                        data-testid={`start-${l.id}`}
                        onClick={() => {
                          if (fb.show(act((s) => startLesson(s, l.id)), `Pelajaran dimulai: ${l.title}`)) close();
                        }}
                      >
                        {done ? 'Ulangi' : 'Mulai'}
                      </Button>
                    )}
                  </div>
                  {isActive && (
                    <ul className="mt-2 list-disc pl-5 text-xs text-slate-200">
                      {l.intro.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  )}
                  {feedback && (
                    <div className="mt-2 rounded-lg bg-ink-850 p-2 text-xs">
                      <div className="font-semibold">Umpan balik terakhir — nilai {feedback.score}</div>
                      <ul className="list-disc pl-4">
                        {feedback.lines.map((x) => (
                          <li key={x}>{x}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="text-muted mt-1 text-[11px]">Sumber: {l.source}</div>
                </li>
              );
            })}
          </ul>
          <section>
            <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-brand-300">Glosarium</h3>
            <dl className="grid gap-2 md:grid-cols-2">
              {GLOSSARY.map((g) => (
                <div key={g.term} className="rounded-lg border border-ink-700 p-2 text-sm">
                  <dt className="font-semibold">{g.term}</dt>
                  <dd className="text-muted text-xs">{g.meaning}</dd>
                  <dd className="text-[10px] text-slate-400">Sumber: {g.source}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      )}
    </Modal>
  );
}

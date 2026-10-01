import { useState, type ReactNode } from 'react';
import { useGame } from '@/stores/gameStore';
import { useUi } from '@/stores/uiStore';
import { Badge, Callout } from '@/components/ui/primitives';
import { isFeatureUnlocked, requiredLevel, FEATURE_NAMES } from '@/domain/progression';
import { batchState, type BatchState } from '@/domain/inventory';
import { dayToDate } from '@/domain/time';
import type { FeatureKey } from '@/domain/config';
import type { GameState, MedicineBatch } from '@/domain/types';

/** State permainan (panel hanya dirender saat permainan berjalan). */
export function useGameState(): GameState {
  return useGame((s) => s.game)!;
}

export function useClose() {
  return useUi((s) => s.closePanel);
}

/** Pesan hasil aksi (sukses/galat) yang konsisten di semua panel. */
export function useFeedback() {
  const [msg, setMsg] = useState<{ tone: 'success' | 'error' | 'info' | 'warn'; text: string } | null>(null);
  const show = (r: { ok: boolean; error?: string; message?: string } | undefined, success?: string) => {
    if (!r) return false;
    if (!r.ok) setMsg({ tone: 'error', text: r.error ?? 'Gagal.' });
    else setMsg({ tone: 'success', text: r.message ?? success ?? 'Berhasil.' });
    return r.ok;
  };
  const node = msg ? (
    <div className="mb-3">
      <Callout tone={msg.tone}>{msg.text}</Callout>
    </div>
  ) : null;
  return { show, node, setMsg };
}

export function FeatureLock({ feature, children }: { feature: FeatureKey; children: ReactNode }) {
  const game = useGameState();
  if (isFeatureUnlocked(game, feature)) return <>{children}</>;
  return (
    <Callout tone="warn" title={`${FEATURE_NAMES[feature]} terkunci`}>
      Fitur ini terbuka pada Level {requiredLevel(feature)}. Selesaikan pelayanan dan misi untuk mendapatkan pengalaman.
    </Callout>
  );
}

const STATE_BADGE: Record<BatchState, { tone: 'green' | 'amber' | 'red' | 'slate' | 'violet'; label: string }> = {
  ok: { tone: 'green', label: 'Layak' },
  'near-expiry': { tone: 'amber', label: 'Hampir ED' },
  expired: { tone: 'red', label: 'KEDALUWARSA' },
  quarantined: { tone: 'violet', label: 'Karantina' },
  empty: { tone: 'slate', label: 'Kosong' },
  disposed: { tone: 'slate', label: 'Dimusnahkan' },
};

export function BatchBadge({ batch, day }: { batch: MedicineBatch; day: number }) {
  const st = batchState(batch, day);
  const b = STATE_BADGE[st];
  return <Badge tone={b.tone}>{b.label}</Badge>;
}

export function formatExpiry(batch: MedicineBatch, day: number) {
  const d = dayToDate(batch.expiryDay);
  const diff = batch.expiryDay - day;
  const date = `${d.getUTCDate().toString().padStart(2, '0')}/${(d.getUTCMonth() + 1).toString().padStart(2, '0')}/${d.getUTCFullYear()}`;
  return `${date} (${diff <= 0 ? `lewat ${-diff} hr` : `${diff} hr lagi`})`;
}

export function SimNote({ children }: { children?: ReactNode }) {
  return <p className="text-muted mt-3 text-[11px]">ⓘ {children ?? 'Data obat & aturan bersifat contoh simulasi, bukan informasi klinis.'}</p>;
}

import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { audio } from '@/services/audio/audioEngine';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-500 hover:bg-brand-400 text-white border-brand-400',
  secondary: 'bg-ink-800 hover:bg-ink-700 text-slate-100 border-ink-600',
  danger: 'bg-rose-700 hover:bg-rose-600 text-white border-rose-500',
  ghost: 'bg-transparent hover:bg-ink-800 text-slate-200 border-transparent',
  success: 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  onClick,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'px-2.5 py-1 text-xs', md: 'px-3.5 py-2 text-sm', lg: 'px-5 py-3 text-base' };
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${VARIANTS[variant]} ${sizes[size]} ${className}`}
      onClick={(e) => {
        audio.unlock();
        audio.play('click');
        onClick?.(e);
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Badge({ tone = 'slate', children, title }: { tone?: 'slate' | 'green' | 'amber' | 'red' | 'blue' | 'violet'; children: ReactNode; title?: string }) {
  const tones = {
    slate: 'bg-ink-700 text-slate-200 border-ink-600',
    green: 'bg-emerald-900/60 text-emerald-200 border-emerald-700',
    amber: 'bg-amber-900/60 text-amber-200 border-amber-700',
    red: 'bg-rose-900/60 text-rose-200 border-rose-700',
    blue: 'bg-sky-900/60 text-sky-200 border-sky-700',
    violet: 'bg-violet-900/60 text-violet-200 border-violet-700',
  };
  return (
    <span title={title} className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function ProgressBar({ value, max = 100, tone = 'brand', label }: { value: number; max?: number; tone?: 'brand' | 'amber' | 'red' | 'green'; label?: string }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  const tones = { brand: 'bg-brand-400', amber: 'bg-amber-400', red: 'bg-rose-500', green: 'bg-emerald-400' };
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-ink-700" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
      <div className={`h-full ${tones[tone]} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  width = 'max-w-5xl',
  footer,
  testId,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose?: () => void;
  children: ReactNode;
  width?: string;
  footer?: ReactNode;
  testId?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 p-2 sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        data-testid={testId}
        className={`panel animate-pop flex max-h-[94vh] w-full ${width} flex-col overflow-hidden rounded-2xl shadow-2xl outline-none`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-ink-700 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-white">{title}</h2>
            {subtitle && <div className="text-muted mt-0.5 text-xs">{subtitle}</div>}
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Tutup panel">
              ✕ <span className="hidden sm:inline">Tutup (Esc)</span>
            </Button>
          )}
        </div>
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
        {footer && <div className="border-t border-ink-700 px-4 py-3 sm:px-5">{footer}</div>}
      </div>
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: ReactNode; disabled?: boolean; title?: string }[]; value: T; onChange: (id: T) => void }) {
  return (
    <div className="mb-3 flex flex-wrap gap-1 border-b border-ink-700 pb-2" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={value === t.id}
          disabled={t.disabled}
          title={t.title}
          onClick={() => {
            audio.play('click');
            onChange(t.id);
          }}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${value === t.id ? 'bg-brand-600 text-white' : 'text-slate-300 hover:bg-ink-800'}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'good' | 'bad' | 'warn' }) {
  const color = tone === 'good' ? 'text-emerald-300' : tone === 'bad' ? 'text-rose-300' : tone === 'warn' ? 'text-amber-300' : 'text-white';
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-850 px-3 py-2">
      <div className="text-muted text-[11px] font-medium uppercase tracking-wide">{label}</div>
      <div className={`mt-0.5 text-lg font-semibold tabular-nums ${color}`}>{value}</div>
      {hint && <div className="text-muted text-[11px]">{hint}</div>}
    </div>
  );
}

export function NumberStepper({ value, onChange, min = 0, max = 9999, step = 1, label }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; label?: string }) {
  const clamp = (v: number) => Math.max(min, Math.min(max, Math.round(v)));
  return (
    <div className="inline-flex items-center overflow-hidden rounded-lg border border-ink-600">
      <button type="button" aria-label={`Kurangi ${label ?? ''}`} className="bg-ink-800 px-2 py-1 hover:bg-ink-700 disabled:opacity-40" disabled={value <= min} onClick={() => onChange(clamp(value - step))}>
        −
      </button>
      <input
        aria-label={label ?? 'Jumlah'}
        className="w-14 bg-ink-900 py-1 text-center text-sm tabular-nums outline-none"
        type="number"
        value={value}
        min={min}
        max={max}
        onFocus={(e) => e.target.select()}
        onChange={(e) => onChange(clamp(Number(e.target.value) || 0))}
      />
      <button type="button" aria-label={`Tambah ${label ?? ''}`} className="bg-ink-800 px-2 py-1 hover:bg-ink-700 disabled:opacity-40" disabled={value >= max} onClick={() => onChange(clamp(value + step))}>
        +
      </button>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="text-muted rounded-xl border border-dashed border-ink-600 px-4 py-8 text-center text-sm">{children}</div>;
}

export function Callout({ tone = 'info', children, title }: { tone?: 'info' | 'warn' | 'error' | 'success'; children: ReactNode; title?: string }) {
  const tones = {
    info: 'border-sky-700 bg-sky-950/50 text-sky-100',
    warn: 'border-amber-700 bg-amber-950/50 text-amber-100',
    error: 'border-rose-700 bg-rose-950/50 text-rose-100',
    success: 'border-emerald-700 bg-emerald-950/50 text-emerald-100',
  };
  const icon = { info: 'ℹ', warn: '⚠', error: '✖', success: '✔' }[tone];
  return (
    <div className={`rounded-lg border px-3 py-2 text-sm ${tones[tone]}`} role={tone === 'error' ? 'alert' : 'status'}>
      {title && (
        <div className="mb-0.5 font-semibold">
          <span aria-hidden>{icon}</span> {title}
        </div>
      )}
      {!title && <span aria-hidden className="mr-1">{icon}</span>}
      {children}
    </div>
  );
}

export function ConfirmDialog({ title, message, confirmLabel = 'Ya', onConfirm, onCancel, danger }: { title: string; message: ReactNode; confirmLabel?: string; onConfirm: () => void; onCancel: () => void; danger?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div role="alertdialog" aria-modal="true" aria-label={title} className="panel animate-pop w-full max-w-md rounded-2xl p-5 shadow-2xl">
        <h3 className="text-lg font-semibold">{title}</h3>
        <div className="text-muted mt-2 text-sm">{message}</div>
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={onCancel}>Batal</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-200">{label}</span>
      {children}
      {hint && <span className="text-muted mt-1 block text-xs">{hint}</span>}
    </label>
  );
}

export const inputClass = 'w-full rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-white outline-none focus:border-brand-400';

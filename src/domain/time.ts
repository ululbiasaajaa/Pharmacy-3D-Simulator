import { TIME } from './config';
import type { AbsMinute } from './types';

export const dayOf = (abs: AbsMinute) => Math.floor(abs / TIME.minutesPerDay) + 1;
export const minuteOfDay = (abs: AbsMinute) => ((abs % TIME.minutesPerDay) + TIME.minutesPerDay) % TIME.minutesPerDay;
export const absAt = (day: number, minute: number): AbsMinute => (day - 1) * TIME.minutesPerDay + minute;

export function formatClock(abs: AbsMinute): string {
  const m = minuteOfDay(abs);
  const h = Math.floor(m / 60);
  const mm = Math.floor(m % 60);
  return `${h.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
}

/** Tanggal kalender simulasi: hari 1 = Senin, 5 Januari 2026. */
const EPOCH = Date.UTC(2026, 0, 5);
const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export function dayToDate(day: number): Date {
  return new Date(EPOCH + (day - 1) * 86_400_000);
}

export function formatDay(day: number): string {
  const d = dayToDate(day);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function formatDayLong(day: number): string {
  const d = dayToDate(day);
  return `${DAY_NAMES[d.getUTCDay()]}, ${formatDay(day)}`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} mnt`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h < 24) return m ? `${h} j ${m} mnt` : `${h} jam`;
  const d = Math.floor(h / 24);
  const hh = h % 24;
  return hh ? `${d} hr ${hh} j` : `${d} hari`;
}

export function formatMoney(n: number): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}Rp ${Math.abs(Math.round(n)).toLocaleString('id-ID')}`;
}

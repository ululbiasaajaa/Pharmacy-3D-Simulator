import { create } from 'zustand';

/** Pesan singkat di tengah layar (mis. alasan objek tidak dapat digunakan). */
export const useFlash = create<{ message: string | null; at: number }>(() => ({ message: null, at: 0 }));

export function flashMessage(message: string) {
  useFlash.setState({ message, at: Date.now() });
}

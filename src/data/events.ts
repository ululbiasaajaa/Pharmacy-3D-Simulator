import type { EventDef } from '@/domain/types';

/** Event acak. Dampak ekonomi dikendalikan oleh sistem (bukan oleh AI/naratif). */
export const EVENTS: EventDef[] = [
  { id: 'ev-surge', kind: 'patient-surge', name: 'Lonjakan Pasien', description: 'Musim flu: kedatangan pasien meningkat dua kali lipat.', durationMinutes: 180, magnitude: 0.5, minDay: 2, weight: 3 },
  { id: 'ev-delay', kind: 'delivery-delay', name: 'Keterlambatan Pengiriman', description: 'Hujan deras dan macet: pesanan dalam perjalanan terlambat 6 jam.', durationMinutes: 360, magnitude: 360, minDay: 2, weight: 2 },
  { id: 'ev-demand-vit', kind: 'demand-boost', name: 'Permintaan Vitamin Naik', description: 'Banyak pelanggan mencari vitamin dan suplemen.', durationMinutes: 300, magnitude: 3, category: 'vitamin', minDay: 2, weight: 2 },
  { id: 'ev-demand-cough', kind: 'demand-boost', name: 'Musim Batuk Pilek', description: 'Permintaan obat batuk dan pilek meningkat.', durationMinutes: 300, magnitude: 3, category: 'batuk-pilek', minDay: 2, weight: 2 },
  { id: 'ev-inspection', kind: 'inspection', name: 'Pemeriksaan Inventaris', description: 'Petugas akan memeriksa rak di akhir event. Pastikan tidak ada batch kedaluwarsa di rak!', durationMinutes: 240, magnitude: 1, minDay: 3, weight: 1.5 },
  { id: 'ev-service-day', kind: 'service-day', name: 'Hari Pelayanan Khusus', description: 'Hari kesehatan: reputasi dari pelayanan 2×, pasien lebih sabar.', durationMinutes: 240, magnitude: 2, minDay: 2, weight: 1.5 },
  { id: 'ev-price', kind: 'price-increase', name: 'Kenaikan Harga Pemasok', description: 'Harga beli dari seluruh pemasok naik 15% selama satu hari.', durationMinutes: 1440, magnitude: 0.15, minDay: 3, weight: 1 },
];

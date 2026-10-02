/**
 * Posisi pejalan kaki yang sedang berada di luar (pasien & pejalan kaki ambient), diperbarui tiap frame.
 * Dibaca oleh lalu lintas agar kendaraan berhenti untuk orang di zebra cross / di depannya.
 */
export const crowd = new Map<string, { x: number; z: number }>();

/**
 * Kendaraan yang sedang bergerak (lalu lintas & mobil boks): posisi tengah + arah gerak pada sumbu X
 * (+1 timur, −1 barat, 0 = di gang). Dibaca portal gerbang & kendaraan lain (jaga jarak).
 */
export const vehicles = new Map<string, { x: number; z: number; dir: number; half: number; speed: number }>();

/** Status jalan bersama: angkot sedang berhenti di halte (penumpang naik/turun). */
export const streetState = { halteDwelling: false, halteArrivals: 0 };

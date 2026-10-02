/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  optimizeDeps: {
    // Dipra-bundel sejak server dinyalakan: bila ditemukan saat PlayScreen dimuat, Vite me-reload
    // halaman (state permainan hilang tepat setelah tombol Mulai ditekan).
    include: [
      'three/examples/jsm/geometries/RoundedBoxGeometry.js',
      'three/examples/jsm/utils/BufferGeometryUtils.js',
      'three/examples/jsm/utils/SkeletonUtils.js',
      'three/examples/jsm/loaders/GLTFLoader.js',
      'three/examples/jsm/libs/meshopt_decoder.module.js',
      'postprocessing',
      '@react-three/postprocessing',
      'n8ao',
    ],
  },
  server: {
    port: 5173,
    proxy: {
      // Proxy AI opsional (lihat server/ai-proxy.mjs). Game tetap berjalan tanpa proxy ini.
      '/api/ai': 'http://localhost:8787',
    },
  },
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Post-processing hanya dipakai profil Ultra (dimuat malas lewat dynamic import) → biarkan
          // pemecahan otomatis. Grup manual menarik dependensinya (three core) sehingga harus dihindari.
          if (/node_modules[\\/](postprocessing|n8ao|@react-three[\\/]postprocessing)[\\/]/.test(id)) return undefined;
          // Pemisah path bisa `/` atau `\` (Windows) → cocokkan keduanya.
          if (/node_modules[\\/]three[\\/]/.test(id)) return 'three';
          if (/node_modules[\\/]@react-three[\\/]/.test(id)) return 'r3f';
          return undefined;
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.mjs'],
  },
});

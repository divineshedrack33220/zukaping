import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Set DEV_API_TARGET to point the dev proxy elsewhere, e.g. the hosted service:
//   DEV_API_TARGET=https://lemon16.onrender.com npm run dev
const API_TARGET = process.env.DEV_API_TARGET || 'http://127.0.0.1:8080';

export default defineConfig({
  plugins: [react()],
  // Use a root-relative base so client-side routes (BrowserRouter) and the
  // PWA service worker resolve assets correctly at any depth.
  base: '/',
  build: {
    outDir: 'dist',
    sourcemap: true,
    chunkSizeWarningLimit: 1200,
  },
  server: {
    // Vite's default bound ::1 only, so http://127.0.0.1:3000 gave
    // ERR_CONNECTION_REFUSED while http://localhost:3000 worked. Pinning IPv4
    // loopback makes both spellings answer, without exposing the dev server to
    // the local network.
    host: '127.0.0.1',
    port: 3000,
    open: true,
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
        secure: false,
      },
      '/ws': {
        target: API_TARGET,
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
});

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Relative base so the build works at https://<user>.github.io/auto-video-edit/
// (HashRouter keeps routing inside the page).
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});

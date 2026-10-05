/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Like the game, the dashboard calls /api on its own origin and Vite forwards it to the local
// analytics backend.
const proxy = {
  '/api': process.env.ANALYTICS_BACKEND_URL ?? 'http://localhost:3001'
};

export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5174, strictPort: true, proxy },
  preview: { port: 4174, strictPort: true, proxy },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}']
  }
});

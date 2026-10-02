/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

// The browser posts analytics to /api on its own origin; Vite forwards it to the local backend.
const proxy = {
  '/api': process.env.ANALYTICS_BACKEND_URL ?? 'http://localhost:3001'
};

export default defineConfig({
  base: './',
  server: { proxy },
  preview: { proxy },
  test: {
    include: ['src/**/*.test.ts']
  }
});

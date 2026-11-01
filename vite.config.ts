import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 5199 },
  test: { include: ['tests/**/*.test.ts'], testTimeout: 180000 },
} as any);

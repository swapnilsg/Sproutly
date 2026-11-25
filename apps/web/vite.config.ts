/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defaultClientConditions, defineConfig } from 'vite';

// E2E runs use their own ports so they never collide with `pnpm dev`.
const webPort = Number(process.env.WEB_PORT ?? 3000);
const apiPort = Number(process.env.API_PORT ?? 4000);

export default defineConfig({
  plugins: [react()],
  // Workspace packages (e.g. @sproutly/catalogue) are bundled from their TypeScript source.
  resolve: { conditions: ['source', ...defaultClientConditions] },
  server: {
    port: webPort,
    strictPort: true,
    proxy: {
      '/api': `http://localhost:${apiPort}`,
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'public/**/*.test.ts'],
  },
});

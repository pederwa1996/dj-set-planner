/// <reference types="vitest" />
import { defineConfig, type ProxyOptions } from 'vite';
import react from '@vitejs/plugin-react';

// Samme proxy-stier som i render.yaml, så nettoppslag virker likt lokalt og på Render
const apiProxy: Record<string, ProxyOptions> = {
  '/api/getsongbpm': { target: 'https://api.getsong.co', changeOrigin: true, rewrite: (p) => p.replace(/^\/api\/getsongbpm/, '') },
  '/api/deezer': { target: 'https://api.deezer.com', changeOrigin: true, rewrite: (p) => p.replace(/^\/api\/deezer/, '') },
};

export default defineConfig({
  plugins: [react()],
  server: { proxy: apiProxy },
  preview: { proxy: apiProxy },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['src/test-setup.ts'],
  },
});

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const enablePWA = env.VITE_PWA === 'true';

  const plugins: any[] = [react(), tailwindcss()];

  // PWA is ONLY enabled for web deployments (VITE_PWA=true).
  // For Capacitor native builds, PWA is disabled to avoid Service Worker
  // cache conflicts with the local APK assets (prevents "update zombie").
  if (enablePWA) {
    plugins.push(
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico'],
        manifest: {
          name: '智能记账本',
          short_name: '记账本',
          description: 'AI 驱动的智能记账应用',
          theme_color: '#10b981',
          background_color: '#f9fafb',
          display: 'standalone',
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/api\.deepseek\.com\/.*/i,
              handler: 'NetworkFirst',
              options: { cacheName: 'ai-api-cache', expiration: { maxEntries: 50, maxAgeSeconds: 3600 } },
            },
          ],
        },
      })
    );
  }

  return {
    plugins,
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});

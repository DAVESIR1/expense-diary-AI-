import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          id: '/',
          name: 'Expense Diary AI - ખર્ચ ડાયરી',
          short_name: 'ExpenseDiary',
          description: 'Multi-OS Minimal AI Expense & Income Diary',
          theme_color: '#faf8f5',
          background_color: '#faf8f5',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/icon.svg',
              sizes: '192x192 512x512',
              type: 'image/svg+xml',
              purpose: 'any',
            },
          ],
        },
        devOptions: {
          enabled: true,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          // Split vendor libraries out of the app bundle so the main chunk
          // stays under the 500 kB advisory limit and caching is better.
          manualChunks: (id) => {
            // Huge ClearSMS Indian bank/investment rule databases (~270 kB of JSON).
            // Keep them in a rarely-changed "data" chunk for better caching.
            if (id.includes('/src/services/clearsms/') && /\.(json)$/.test(id)) {
              return 'clearsms-rules';
            }
            if (id.includes('/node_modules/react') || id.includes('/node_modules/react-dom')) {
              return 'react-vendor';
            }
            if (id.includes('/node_modules/lucide-react')) {
              return 'lucide-icons';
            }
            return undefined;
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

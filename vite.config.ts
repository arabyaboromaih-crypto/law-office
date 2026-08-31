import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import {defineConfig} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(() => {
  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon-192.png', 'icon-512.png'],
        manifest: {
          name: 'مؤسسة رميح للمحاماة والاستشارات القانونية',
          short_name: 'رميح للمحاماة',
          description: 'نظام متكامل لإدارة القضايا والموكلين والشركات وأجندة الجلسات والماليات والأرشيف وسجل العمليات متوافق بالكامل مع سير العمل في المحاكم المصرية.',
          theme_color: '#1e293b',
          background_color: '#0f172a',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: 'icon-192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'icon-512.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: 'icon-192-maskable.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable'
            },
            {
              src: 'icon-512-maskable.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ],
          shortcuts: [
            {
              name: 'القضايا',
              short_name: 'القضايا',
              description: 'استعراض وإدارة القضايا الجارية والمنتهية',
              url: '/#cases',
              icons: [{ src: 'icon-192.png', sizes: '192x192' }]
            },
            {
              name: 'المهام',
              short_name: 'المهام',
              description: 'متابعة وإسناد المهام والمسؤوليات القانونية',
              url: '/#tasks',
              icons: [{ src: 'icon-192.png', sizes: '192x192' }]
            },
            {
              name: 'الشركات',
              short_name: 'الشركات',
              description: 'إدارة الموكلين من الشركات والمؤسسات',
              url: '/#clients',
              icons: [{ src: 'icon-192.png', sizes: '192x192' }]
            }
          ]
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB
          skipWaiting: true,
          clientsClaim: true,
          navigateFallbackDenylist: [/^\/api/],
          runtimeCaching: [
            {
              urlPattern: /^\/api\/.*/,
              handler: 'NetworkOnly'
            },
            {
              urlPattern: /.*cloudflarestorage.*/,
              handler: 'NetworkOnly'
            },
            {
              urlPattern: /.*firestore.googleapis.com.*/,
              handler: 'NetworkOnly'
            },
            {
              urlPattern: /.*firebase.*/,
              handler: 'NetworkOnly'
            },
            {
              urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365
                }
              }
            },
            {
              urlPattern: /^https:\/\/cdnjs\.cloudflare\.com\/.*/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'static-resources',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 * 30
                }
              }
            }
          ]
        },
        devOptions: {
          enabled: true,
          type: 'module',
          navigateFallback: 'index.html'
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: false,
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

// Versionsangaben für die Einstellungen: Nummer aus package.json, Code-Stand aus Git, Datum des Baus.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }
const commit = (() => {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD']).toString().trim()
  } catch {
    return ''
  }
})()

// https://vite.dev/config/
export default defineConfig({
  // Relative Pfade, damit die App unter jeder Adresse läuft
  // (GitHub Pages im Unterordner, Cloudflare Pages, Netlify).
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_COMMIT__: JSON.stringify(commit),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'logo.svg', 'apple-touch-icon-180x180.png', 'custom-icons/**/*'],
      manifest: {
        name: 'Vampire Survivors Cheatsheet',
        short_name: 'VS Cheatsheet',
        description:
          'Unofficial companion app for Vampire Survivors · Inoffizielle Begleit-App für Vampire Survivors',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'any',
        background_color: '#140b1f',
        theme_color: '#140b1f',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Alles vorab cachen, damit die App komplett offline läuft.
        globPatterns: ['**/*.{js,css,html,svg,png,webp,jpg,ico,json,woff2}'],
        // Originalbilder aus dem Wiki: beim ersten Anzeigen speichern, danach auch offline nutzbar.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/vampire\.survivors\.wiki\/images\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'wiki-bilder',
              expiration: { maxEntries: 1500, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})

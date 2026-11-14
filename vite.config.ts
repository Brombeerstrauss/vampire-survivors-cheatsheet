/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // Relative Pfade, damit die App unter jeder Adresse läuft
  // (GitHub Pages im Unterordner, Cloudflare Pages, Netlify).
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'logo.svg', 'apple-touch-icon-180x180.png', 'custom-icons/**/*'],
      manifest: {
        name: 'VS Companion – Begleiter für Vampire Survivors',
        short_name: 'VS Companion',
        description:
          'Inoffizielle Begleit-App für Vampire Survivors: Entwicklungen, Lauf-Tracker und Empfehlungen.',
        lang: 'de',
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
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})

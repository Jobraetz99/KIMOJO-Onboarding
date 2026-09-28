import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      manifest: {
        name: 'KIMOJO Onboarding',
        short_name: 'KIMOJO',
        description: 'Mitarbeiter-Onboarding für KIMOJO Therapiezentren',
        theme_color: '#BF3B36',
        background_color: '#FAFAFA',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        // Der Chat-Canvas (botframework-webchat) ist mehrere MB gross und wird
        // ohnehin erst beim Öffnen des Prozesshelfers nachgeladen – er gehört
        // nicht in den Precache.
        globIgnores: ['**/CopilotChat-*.js'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/graph\.microsoft\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'graph-api-cache',
              expiration: { maxAgeSeconds: 60 * 5 }
            }
          }
        ]
      }
    })
  ],
  server: {
    host: true,
    port: 5173,
  },
  resolve: {
    alias: { '@': '/src' }
  }
})

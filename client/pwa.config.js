export const pwaOptions = {
  injectRegister: false,
  registerType: 'prompt',
  includeAssets: ['logo.png', 'mask-icon.svg'],
  manifest: {
    name: 'Riven - Flashcard Study App',
    short_name: 'Riven',
    description: 'A beautiful flashcard app with spaced repetition and a streak garden that grows with you',
    theme_color: '#1a1a18',
    background_color: '#1a1a18',
    display: 'standalone',
    orientation: 'portrait',
    scope: '/',
    start_url: '/',
    categories: ['education', 'productivity'],
    prefer_related_applications: false,
    icons: [
      {
        src: 'logo.png',
        sizes: '192x192',
        type: 'image/png'
      },
      {
        src: 'logo.png',
        sizes: '512x512',
        type: 'image/png'
      },
      {
        src: 'logo.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable'
      }
    ],
    shortcuts: [
      {
        name: 'Create Deck',
        short_name: 'Create',
        description: 'Create a new flashcard deck',
        url: '/create',
        icons: [{ src: 'logo.png', sizes: '192x192' }]
      }
    ]
  },
  workbox: {
    // Keep install work bounded. Hashed route chunks are cached only after the
    // browser actually visits them, instead of downloading the whole app.
    globPatterns: [
      'index.html',
      'manifest.webmanifest',
      'assets/index-*.js',
      'assets/index-*.css',
    ],
    // Prompt-mode updates need both app-triggered SKIP_WAITING and worker-side clientsClaim
    // so an already-open tab swaps to the newly activated controller immediately.
    clientsClaim: true,
    // App is fully offline-first with IndexedDB, no API caching needed
    navigateFallback: 'index.html',
    navigateFallbackDenylist: [/^\/api/],
    // Runtime caching for fonts
    runtimeCaching: [
      {
        urlPattern: /\/assets\/.*-[A-Za-z0-9_-]+\.(?:js|css|woff2?|png|svg|webp)$/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'riven-route-assets-v1',
          expiration: {
            maxEntries: 120,
            maxAgeSeconds: 60 * 60 * 24 * 30
          },
          cacheableResponse: {
            statuses: [0, 200]
          }
        }
      },
      {
        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'google-fonts-cache',
          expiration: {
            maxEntries: 10,
            maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
          },
          cacheableResponse: {
            statuses: [0, 200]
          }
        }
      },
      {
        urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'gstatic-fonts-cache',
          expiration: {
            maxEntries: 10,
            maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
          },
          cacheableResponse: {
            statuses: [0, 200]
          }
        }
      },
      // Cache Supabase storage images (avatars, card images, uploads)
      {
        urlPattern: /^https:\/\/.*supabase.*\/storage\/.*\.(png|jpg|jpeg|webp|gif|svg)$/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'supabase-image-cache',
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
          },
          cacheableResponse: {
            statuses: [0, 200]
          }
        }
      },
      // Cache DiceBear avatar SVGs
      {
        urlPattern: /^https:\/\/api\.dicebear\.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'dicebear-avatar-cache',
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
          },
          cacheableResponse: {
            statuses: [0, 200]
          }
        }
      }
    ]
  }
}

export default pwaOptions

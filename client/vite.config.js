import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import { pwaOptions } from './pwa.config.js'

const sentrySourceMapsEnabled = Boolean(
  process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT
)

function manualChunks(id) {
  if (!id.includes('/node_modules/')) return undefined

  if (
    id.includes('/node_modules/react/')
    || id.includes('/node_modules/react-dom/')
    || id.includes('/node_modules/react-router-dom/')
    || id.includes('/node_modules/@remix-run/')
    || id.includes('/node_modules/scheduler/')
  ) {
    return 'vendor-react'
  }

  if (id.includes('/node_modules/idb/')) return 'vendor-db'
  if (id.includes('/node_modules/gsap/')) return 'vendor-gsap'
  if (id.includes('/node_modules/motion/')) return 'vendor-motion'
  if (id.includes('/node_modules/@tiptap/') || id.includes('/node_modules/prosemirror-')) return 'vendor-tiptap'
  if (id.includes('/node_modules/react-pdf/') || id.includes('/node_modules/pdfjs-dist/')) return 'vendor-pdf'
  if (id.includes('/node_modules/@sentry/')) return 'vendor-sentry'
  if (id.includes('/node_modules/@supabase/')) return 'vendor-supabase'
  return undefined
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA(pwaOptions),
    ...(sentrySourceMapsEnabled
      ? [
          sentryVitePlugin({
            org: process.env.SENTRY_ORG,
            project: process.env.SENTRY_PROJECT,
            authToken: process.env.SENTRY_AUTH_TOKEN,
            release:
              process.env.SENTRY_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA || undefined,
            telemetry: false,
          }),
        ]
      : []),
  ],
  esbuild: {
    drop: ['debugger'],
    // RIV-021: strip console.* in production builds (Sentry uses explicit captureException,
    // not console capture, so error reporting is unaffected).
    pure: ['console.log', 'console.info', 'console.debug', 'console.warn', 'console.error'],
  },
  build: {
    sourcemap: sentrySourceMapsEnabled,
    manifest: true,
    // Optimize chunk splitting for faster initial load
    cssCodeSplit: true,
    // esbuild minify (default, ~10x faster than terser)
    rollupOptions: {
      output: {
        manualChunks
      }
    },
    // Increase chunk size warning limit since we're code splitting
    chunkSizeWarningLimit: 600,
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})

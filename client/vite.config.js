import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import { pwaOptions } from './pwa.config.js'

const sentrySourceMapsEnabled = Boolean(
  process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT
)

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
    pure: ['console.log', 'console.info', 'console.debug'],
  },
  build: {
    sourcemap: sentrySourceMapsEnabled,
    // Optimize chunk splitting for faster initial load
    cssCodeSplit: true,
    // esbuild minify (default, ~10x faster than terser)
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-db': ['idb'],
          'vendor-gsap': ['gsap'],
          'vendor-motion': ['motion'],
          'vendor-tiptap': [
            '@tiptap/react', '@tiptap/starter-kit',
            '@tiptap/extension-horizontal-rule', '@tiptap/extension-placeholder',
            '@tiptap/suggestion'
          ],
          'vendor-pdf': ['react-pdf'],
          'vendor-sentry': ['@sentry/react'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-analytics': ['posthog-js'],
        }
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

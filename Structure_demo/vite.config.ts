import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Secure Storage App',
        short_name: 'SecureStorage',
        description: 'Secure, encrypted file storage application',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@noble/curves/bls12-381': path.resolve(__dirname, 'node_modules/@noble/curves/bls12-381.js'),
      '@noble/hashes/utils': path.resolve(__dirname, 'node_modules/@noble/hashes/utils.js'),
      '@noble/hashes/sha2': path.resolve(__dirname, 'node_modules/@noble/hashes/sha2.js')
    }
  },
  optimizeDeps: {
    include: ['@noble/curves/bls12-381', '@noble/hashes/utils', '@noble/hashes/sha2']
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://localhost:3000',
        changeOrigin: true,
        secure: false, // Allow self-signed certificates
      }
    }
  }
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@noble/curves/bls12-381': path.resolve(__dirname, 'node_modules/@noble/curves/bls12-381.js'),
      '@noble/hashes/utils': path.resolve(__dirname, 'node_modules/@noble/hashes/utils.js'),
      '@noble/hashes/sha2': path.resolve(__dirname, 'node_modules/@noble/hashes/sha2.js')
    }
  },
  optimizeDeps: {
    include: ['@noble/curves/bls12-381', '@noble/hashes/utils', '@noble/hashes/sha2']
  }
})

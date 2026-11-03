import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Served as a GitHub Pages project site, which lands at
// https://jovian.wang/mood-gallery/ (project sites inherit the user-site domain).
export default defineConfig({
  base: '/mood-gallery/',
  plugins: [react()],
  build: {
    // three.js (the Final Stretch map) and Firebase are already split into lazy chunks;
    // the largest of them is still ~1 MB minified, which is expected.
    chunkSizeWarningLimit: 1100,
  },
})

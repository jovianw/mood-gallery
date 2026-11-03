import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Served as a GitHub Pages project site, which lands at
// https://jovian.wang/mood-gallery/ (project sites inherit the user-site domain).
export default defineConfig({
  base: '/mood-gallery/',
  plugins: [react()],
})

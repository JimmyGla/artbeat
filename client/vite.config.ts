import { defineConfig } from 'vite'
import { readFileSync } from 'node:fs'

// Stamped into the bundle so crash reports say which build they came from.
// Read from package.json rather than an env var: a version that has to be set
// by hand is a version that is silently wrong, and "which release broke this"
// is the first question any crash report has to answer.
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(version),
  },
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})

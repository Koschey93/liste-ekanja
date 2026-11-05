import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

export default defineConfig({
  plugins: [preact()],
  server: {
    // alerts Worker runs locally via `npx wrangler dev` (port 8790)
    proxy: { '/api': 'http://localhost:8790' },
  },
})

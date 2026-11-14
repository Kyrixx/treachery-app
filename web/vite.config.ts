import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: { emptyOutDir: false }, // keeps dist/.gitkeep so `go build` works on a fresh clone
  server: { proxy: { '/ws': { target: 'ws://localhost:8080', ws: true } } },
})

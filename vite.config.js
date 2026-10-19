import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// En GitHub Pages el sitio vive en https://miniduck0216.github.io/hospital-solca/
export default defineConfig({
  base: '/hospital-solca/',
  plugins: [react()],
  json: { stringify: true },          // el modelo 3D es grande: JSON.parse es más rápido que un objeto literal
  build: { chunkSizeWarningLimit: 9000 },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

// En GitHub Pages el sitio vive en https://miniduck0216.github.io/hospital-solca/
// Página principal: planta baja real (index.html). El prototipo anterior de 5 pisos sigue en /prototipo/.
export default defineConfig({
  base: '/hospital-solca/',
  plugins: [react()],
  json: { stringify: true },          // el modelo 3D del prototipo es grande: JSON.parse es más rápido que un objeto literal
  build: {
    chunkSizeWarningLimit: 9000,
    rollupOptions: { input: { main: resolve(__dirname, 'index.html'), prototipo: resolve(__dirname, 'prototipo/index.html') } },
  },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

// Dos publicaciones del mismo mapa:
// - GitHub Pages (npm run build → dist/): https://miniduck0216.github.io/hospital-solca/
// - Portal de OM3 (npm run build:portal → dist-portal/): https://<portal>/mapa/, en el mismo origen que la API de OM3
//   (el navegador no deja que una página pública pida datos a una dirección de la red interna). Las variables de
//   ese build están en .env.portal; OMNIUM_FRONTEND copia dist-portal/ a su dist/mapa/ (npm run mapa:incluir).
// Página principal: planta baja real (index.html). El prototipo anterior de 5 pisos sigue en /prototipo/.
export default defineConfig(({ mode }) => {
  const portal = mode === 'portal'
  return {
    base: portal ? '/mapa/' : '/hospital-solca/',
    plugins: [react()],
    define: { __VERSION__: JSON.stringify(String(Date.now())) },   // evita que el navegador use datos viejos del plano
    json: { stringify: true },          // el modelo 3D del prototipo es grande: JSON.parse es más rápido que un objeto literal
    build: {
      outDir: portal ? 'dist-portal' : 'dist',
      chunkSizeWarningLimit: 9000,
      rollupOptions: { input: { main: resolve(__dirname, 'index.html'), prototipo: resolve(__dirname, 'prototipo/index.html') } },
    },
  }
})

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import '../ui/mapa2d/mapa2d.css'
import './pb.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// memoria del mapa (ver public/sw.js): solo en el sitio publicado; la versión del programa va en la dirección del
// service worker, así cada publicación instala uno nuevo y borra la memoria vieja
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js?v=${__VERSION__}`, { scope: import.meta.env.BASE_URL }).catch(() => {})
  })
}

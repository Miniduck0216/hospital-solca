import { create } from 'zustand'
import { ORIGEN_INICIAL, ORIGEN_URL } from './lib/lugares.js'
import { NP } from './lib/datos.js'

export const useStore = create((set) => ({
  modo: '2d',             // '2d' mapa · '3d' recorrido
  nivel: ORIGEN_URL ? ORIGEN_URL.piso : 0,   // 0…NP−1 pisos · NP techo
  modoMuros: 'recorte',
  velocidad: 1,
  horaTexto: '10:00',
  verGrafo: false,
  accesible: false,
  orden: null,
  ruta: null,
  zona: null,
  aviso: null,
  // mapa 2D
  piso2d: ORIGEN_INICIAL.piso,
  origen2d: ORIGEN_INICIAL,
  destino2d: null,
  navegando: false,
  setModo: (modo) => set({ modo }),
  setNivel: (nivel) => set({ nivel: Math.max(0, Math.min(NP, nivel)) }),
  setModoMuros: (modoMuros) => set({ modoMuros }),
  setVelocidad: (velocidad) => set({ velocidad }),
  setHoraTexto: (horaTexto) => set({ horaTexto }),
  toggleGrafo: () => set((s) => ({ verGrafo: !s.verGrafo })),
  toggleAccesible: () => set((s) => ({ accesible: !s.accesible })),
  ordenar: (objetivo) => set((s) => ({ orden: { id: (s.orden?.id || 0) + 1, objetivo }, aviso: null })),
  setRuta: (ruta) => set({ ruta }),
  setZona: (zona) => set({ zona }),
  setAviso: (aviso) => set({ aviso }),
  setPiso2d: (piso2d) => set({ piso2d }),
  setOrigen2d: (origen2d) => set({ origen2d, navegando: false }),
  setDestino2d: (destino2d) => set({ destino2d, navegando: false }),
  intercambiar2d: () => set((s) => (s.destino2d && !s.destino2d.especial ? { origen2d: s.destino2d, destino2d: s.origen2d, navegando: false } : {})),
  setNavegando: (navegando) => set({ navegando }),
}))

// Igual que cargarDatos, pero en un hilo aparte (cargaPiso.worker.js): la pantalla no se traba mientras se prepara
// el piso. Si el navegador no tiene hilos o el hilo falla, se prepara aquí mismo.
// (va en su propio archivo: el hilo importa datos.js y no debe incluirse a sí mismo)
import { cargarDatos, compilarConfig } from './datos.js'

let hilo = null
let nPedido = 0
const pendientes = new Map()

export function cargarDatosEnHilo(cambiosLocales = null, opciones = {}) {
  const aqui = () => cargarDatos(cambiosLocales, opciones)
  if (typeof Worker === 'undefined' || hilo === false) return aqui()
  try {
    if (!hilo) {
      hilo = new Worker(new URL('./cargaPiso.worker.js', import.meta.url), { type: 'module' })
      hilo.onmessage = ({ data }) => { const p = pendientes.get(data.id); pendientes.delete(data.id); p?.(data) }
      // el hilo no arrancó (navegador viejo, bloqueo): lo pendiente y lo que venga se prepara aquí
      hilo.onerror = () => { for (const p of pendientes.values()) p({ error: 'sin hilo' }); pendientes.clear(); hilo = false }
    }
  } catch { hilo = false; return aqui() }
  return new Promise((ok) => {
    const id = ++nPedido
    pendientes.set(id, ok)
    hilo.postMessage({ id, cambios: cambiosLocales, opciones })
  }).then(({ d, error }) => {
    if (error) return aqui()
    d.cfg = compilarConfig(d.cfgCruda)
    return d
  })
}

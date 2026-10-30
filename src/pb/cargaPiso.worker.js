// Hilo aparte para preparar un piso (descarga, reglas y rejilla de navegación) sin trabar la pantalla: en el tótem,
// preparar los pisos que no se están viendo dejaba el mapa congelado varios segundos al arrancar. Ver cargarDatosEnHilo.
import { cargarDatos } from './datos.js'

self.onmessage = async ({ data: { id, cambios, opciones } }) => {
  try {
    const d = await cargarDatos(cambios, opciones)
    // las reglas compiladas tienen funciones y expresiones (no pasan entre hilos): se vuelven a armar con d.cfgCruda
    delete d.cfg
    // las rejillas se entregan sin copiarlas
    const buffers = [...new Set(Object.values(d.nav).filter((v) => ArrayBuffer.isView(v)).map((v) => v.buffer))]
    self.postMessage({ id, d }, buffers)
  } catch (e) {
    self.postMessage({ id, error: e.message || String(e) })
  }
}

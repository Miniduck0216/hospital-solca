// Modo ligero: para el tótem (procesador modesto) o equipos con poca memoria. Baja la calidad del 3D (sin sombras,
// sin antialias, 30 cuadros por segundo, menos árboles y adornos) y aligera las animaciones del 2D.
// ?ligero=1 lo fuerza; ?ligero=0 lo apaga; ?modo=totem lo enciende.
const P = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams()
const forzado = P.get('ligero')
const nav = typeof navigator !== 'undefined' ? navigator : {}
const equipoModesto = (nav.deviceMemory || 8) <= 4 && (nav.hardwareConcurrency || 8) <= 4
export const LIGERO = forzado === '1' ? true : forzado === '0' ? false : P.get('modo') === 'totem' || equipoModesto

// ejecuta fn cuando el navegador está libre (para no trabar la pantalla mientras se preparan los otros pisos)
export const enReposo = (fn) => (typeof requestIdleCallback === 'function'
  ? requestIdleCallback(fn, { timeout: 1500 })
  : setTimeout(fn, 60))

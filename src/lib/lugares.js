// Catálogo de lugares para el mapa 2D (destinos, baños, salidas) y sus categorías
import { H, nodeById, cuartoById } from './datos.js'

export const CATEGORIAS = [
  { id: 'banos', nombre: 'Baños', icono: 'bano', color: '#1F8FB3' },
  { id: 'emergencia', nombre: 'Emergencia', icono: 'emergencia', color: '#D7443A' },
  { id: 'consulta', nombre: 'Consultas', icono: 'consulta', color: '#2F5BEA' },
  { id: 'diagnostico', nombre: 'Exámenes e imágenes', icono: 'diagnostico', color: '#7A55C7' },
  { id: 'tratamiento', nombre: 'Tratamientos', icono: 'tratamiento', color: '#D98A1F' },
  { id: 'hospitalizacion', nombre: 'Hospitalización', icono: 'hospitalizacion', color: '#2E9A5B' },
  { id: 'servicios', nombre: 'Servicios', icono: 'servicios', color: '#5B6B7C' },
  { id: 'administracion', nombre: 'Atención y pagos', icono: 'administracion', color: '#B04A7E' },
  { id: 'circulacion', nombre: 'Ascensores y escaleras', icono: 'ascensor', color: '#46576A' },
  { id: 'salidas', nombre: 'Entradas y salidas', icono: 'salida', color: '#1E9E8B' },
]
export const catById = Object.fromEntries(CATEGORIAS.map((c) => [c.id, c]))

const ICONO_NOMBRE = [
  [/^Baño|^Baños/, 'bano'], [/^Ascensores/, 'ascensor'], [/^Escalera/, 'escalera'], [/Farmacia/, 'farmacia'],
  [/^Caja/, 'caja'], [/Hall/, 'info'], [/Cafetería/, 'cafe'], [/Capilla/, 'capilla'], [/Odontolog/, 'consulta'],
]
export function iconoDe(nombre, cat) {
  for (const [re, ic] of ICONO_NOMBRE) if (re.test(nombre)) return ic
  return catById[cat]?.icono || 'servicios'
}

const categoriaDe = (d) => {
  if (/^Baño|^Baños/.test(d.nombre)) return 'banos'
  return d.cat
}

const salidas = H.salidas

export const LUGARES = [
  ...salidas,
  ...H.destinos.map((d) => ({ nombre: d.nombre, nodo: d.nodo, piso: d.piso, x: d.x, y: d.y, cat: categoriaDe(d), codigo: d.codigo })),
].map((l, i) => {
  const zona = nodeById[l.nodo]?.zona
  return { ...l, id: l.codigo || `${l.nodo}#${i}`, icono: iconoDe(l.nombre, l.cat), cuarto: zona ? cuartoById[zona] : null, dep: zona ? cuartoById[zona]?.dep : null }
})

// Punto de partida desde la URL, como los códigos QR de los kioscos: ?origen=<código> (también acepta ?origin=)
function origenDeUrl() {
  try {
    const q = new URLSearchParams(window.location.search)
    const c = (q.get('origen') || q.get('origin') || '').trim().toLowerCase()
    return c ? LUGARES.find((l) => l.codigo === c) || null : null
  } catch { return null }
}
export const ORIGEN_URL = origenDeUrl()
export const ORIGEN_INICIAL = ORIGEN_URL || LUGARES[0]
export const enlaceDe = (l) => `${window.location.origin}${window.location.pathname}?origen=${encodeURIComponent(l.codigo)}`
export const BANO_CERCANO = { id: 'bano-cercano', nombre: 'Baño más cercano', cat: 'banos', icono: 'bano', especial: 'bano' }
export const NOMBRES_PISO = H.pisos.map((p) => p.nombre)
export const CORTO_PISO = H.pisos.map((p) => p.clave)

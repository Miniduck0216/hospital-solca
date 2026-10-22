// Datos de la planta baja real (exportados desde el plano del hospital) y georreferencia sobre el mapa.
export const BASE = import.meta.env.BASE_URL

export async function cargarDatos() {
  const r = await fetch(`${BASE}pb/datos.json`)
  if (!r.ok) throw new Error('No se pudo cargar el plano')
  const d = await r.json()
  const bin = atob(d.nav.celdas)
  const celdas = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) celdas[i] = bin.charCodeAt(i)
  d.nav.celdas = celdas
  const bin2 = atob(d.nav.cuarto)
  const cuarto = new Uint8Array(bin2.length)
  for (let i = 0; i < bin2.length; i++) cuarto[i] = bin2.charCodeAt(i)
  d.nav.cuarto = cuarto
  // ambientes de paso (las rutas pueden cruzarlos sin recargo)
  d.nav.paso = new Uint8Array(d.ambientes.length + 1)
  d.nav.paso[0] = 1
  d.ambientes.forEach((a, k) => { d.nav.paso[k + 1] = ['circulacion', 'espera'].includes(a.cat) || !a.nombre ? 1 : 0 })
  d.nav.indice = Object.fromEntries(d.ambientes.map((a, k) => [a.id, k + 1]))
  return d
}

// --- georreferencia (misma fórmula que planta_real/web/exportar_datos.py)
let G = null
const M_LAT = 110574
export function usarGeo(geo) { G = { ...geo, mLon: 111320 * Math.cos((geo.lat0 * Math.PI) / 180), t: (geo.ang * Math.PI) / 180 } }
export function aLonLat(x, y) {
  const dx = x - G.cx, dy = y - G.cy
  const e = Math.cos(G.t) * dx - Math.sin(G.t) * dy + G.ox
  const n = Math.sin(G.t) * dx + Math.cos(G.t) * dy + G.oy
  return [G.lon0 + e / G.mLon, G.lat0 + n / M_LAT]
}
export function dePlano(lon, lat) {
  const e = (lon - G.lon0) * G.mLon - G.ox, n = (lat - G.lat0) * M_LAT - G.oy
  const t = -G.t
  return [Math.cos(t) * e - Math.sin(t) * n + G.cx, Math.sin(t) * e + Math.cos(t) * n + G.cy]
}
// rumbo del mapa para que el plano quede derecho (su eje y hacia arriba)
export const rumbo = () => -G.ang

// --- categorías (colores suaves para los ambientes y color de acento para íconos y rutas)
export const CATS = {
  consulta: { nombre: 'Consultorios', relleno: '#E3EBFC', acento: '#3768DE', icono: 'consulta' },
  espera: { nombre: 'Salas de espera', relleno: '#E2F3E7', acento: '#2E9D5B', icono: 'silla' },
  banos: { nombre: 'Baños', relleno: '#DDF0F7', acento: '#1B95BD', icono: 'bano' },
  farmacia: { nombre: 'Farmacia', relleno: '#EFE7FB', acento: '#8455D3', icono: 'farmacia' },
  administracion: { nombre: 'Atención y trámites', relleno: '#FFF0D6', acento: '#DB7F12', icono: 'administracion' },
  circulacion: { nombre: 'Halls y pasillos', relleno: '#FFFFFF', acento: '#6A7684', icono: 'piso' },
  apoyo: { nombre: 'Servicios de apoyo', relleno: '#EDF0F3', acento: '#7D8896', icono: 'servicios' },
  escaleras: { nombre: 'Escaleras', relleno: '#E4E7EC', acento: '#4B5563', icono: 'escalera' },
  ascensores: { nombre: 'Ascensores', relleno: '#E4E7EC', acento: '#4B5563', icono: 'ascensor' },
  otro: { nombre: 'Otros', relleno: '#F2F4F7', acento: '#8A94A3', icono: 'servicios' },
}
export const ICONO_LUGAR = {
  bano: 'bano', ascensor: 'ascensor', escalera: 'escalera', farmacia: 'farmacia', caja: 'caja', informacion: 'info',
  espera: 'silla', capilla: 'capilla', laboratorio: 'diagnostico', consulta: 'consulta', administracion: 'administracion',
}

// --- búsqueda sin tildes
export const plano = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// punto dentro de polígono (anillo exterior) y ambiente en un punto
export function dentro([x, y], anillo) {
  let c = false
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i], [xj, yj] = anillo[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}
export function ambienteEn(d, p) {
  let mejor = null
  for (const a of d.ambientes) {
    if (!a.pg.length || !dentro(p, a.pg[0])) continue
    if (!mejor || a.area < mejor.area) mejor = a
  }
  return mejor
}

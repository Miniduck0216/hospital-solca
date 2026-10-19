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

const salidas = [
  { nombre: 'Entrada principal', nodo: 'pb-o-30.0', piso: 0, x: 30, y: -1.5, cat: 'salidas' },
  { nombre: 'Entrada de Emergencia', nodo: 'pb-o-6.0', piso: 0, x: 6, y: -1.5, cat: 'salidas' },
]

export const LUGARES = [
  ...salidas,
  ...H.destinos.map((d) => ({ nombre: d.nombre, nodo: d.nodo, piso: d.piso, x: d.x, y: d.y, cat: categoriaDe(d) })),
].map((l, i) => {
  const zona = nodeById[l.nodo]?.zona
  return { ...l, id: `${l.nodo}#${i}`, icono: iconoDe(l.nombre, l.cat), cuarto: zona ? cuartoById[zona] : null, dep: zona ? cuartoById[zona]?.dep : null }
})

export const ORIGEN_INICIAL = LUGARES[0]
export const BANO_CERCANO = { id: 'bano-cercano', nombre: 'Baño más cercano', cat: 'banos', icono: 'bano', especial: 'bano' }
export const NOMBRES_PISO = H.pisos.map((p) => p.nombre)
export const CORTO_PISO = ['PB', 'P1', 'P2']

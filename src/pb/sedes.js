// Respaldo local del dibujo por hospital: public/sedes/<sede>/<edificio>/ (edificio.json, exterior.json, perfil.json,
// techos.json y pisos/<piso>/…). Una sede de OM3 es un hospital por ciudad; cada sede tiene edificios (PRINCIPAL por
// defecto). El dibujo publicado en OM3 (/geo) sigue mandando: esta carpeta es lo que se usa si OM3 no tiene uno.
// (sin dependencias de Vite: lo usan también los scripts de node)

/** Carpeta de cada sede de OM3 (ID_SEDE → nombre de la carpeta) */
export const SEDES = {
  1: 'quito',
  2: 'imbabura',
  3: 'santo-domingo',
  4: 'tungurahua',
  5: 'chimborazo',
  6: 'manabi',
  7: 'machala',
  8: 'cuenca',
  21: 'loja',
}
export const SEDE_DEFECTO = 'quito'
export const EDIFICIO_DEFECTO = 'principal'
export const CARPETA_DEFECTO = `sedes/${SEDE_DEFECTO}/${EDIFICIO_DEFECTO}/`

// «Santo Domingo» → santo-domingo, «MANABÍ» → manabi
const nombreCarpeta = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

/** Nombre de la carpeta de una sede: por su número de OM3 o por su nombre; null si no se reconoce */
export function carpetaSede(sede) {
  if (sede == null || sede === '') return null
  const s = String(sede).trim()
  if (/^\d+$/.test(s)) return SEDES[Number(s)] || null
  const n = nombreCarpeta(s)
  return n || null
}

/** Nombre de la carpeta de un edificio (PRINCIPAL → principal) */
export function carpetaEdificio(edificio) {
  const n = edificio == null ? '' : nombreCarpeta(edificio)
  return n || EDIFICIO_DEFECTO
}

const paramsDe = (u) => {
  if (!u) return null
  try { return new URL(u, 'http://x/').searchParams } catch { return null }
}

/**
 * Carpeta del respaldo local según la consulta de la página: ?sede=&edificio=, o los de ?geo= o ?config=
 * (…/geo?sede=1&edificio=PRINCIPAL, …/mapa/publicado?sede=1). Sin sede reconocible: quito/principal.
 * @returns {string} 'sedes/<sede>/<edificio>/' (relativa a la raíz del sitio)
 */
export function carpetaRespaldo(busqueda = '') {
  const p = new URLSearchParams(busqueda)
  const fuentes = [p, paramsDe(p.get('geo')), paramsDe(p.get('config'))].filter(Boolean)
  const de = (k) => fuentes.map((f) => f.get(k)).find((v) => v != null && v !== '')
  const sede = carpetaSede(de('sede'))
  if (!sede) return CARPETA_DEFECTO
  return `sedes/${sede}/${carpetaEdificio(de('edificio'))}/`
}

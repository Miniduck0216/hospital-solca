// Lo que la página pidió al abrir: sede, edificio, origen del dibujo (OM3 o public/), respaldo local y dirección de
// la configuración publicada. Se lee UNA vez, al cargar el módulo, antes de que App reescriba la URL con
// history.replaceState (origen y destino). Vista3D se carga perezoso y, si leyera location.search entonces, vería la
// URL reescrita (sin sede) y pediría los techos y el 3D de Quito.
import { CONFIG_OM3_URL } from './datos.js'
import { origenGeoDeUrl, geoDeSede, configDeSede } from './geometria.js'
import { carpetaRespaldo, sedeDeBusqueda, SEDES_INFO } from './sedes.js'

/** Parámetros de la página que se conservan al reescribir la URL y en los enlaces que se comparten (QR) */
export const PARAMS_CONSERVAR = ['modo', 'padre', 'config', 'sede', 'edificio', 'geo', 'vista']
const PARAMS_SEDE = ['sede', 'edificio', 'config', 'geo']

export function leerPagina(busqueda = '', pagina = globalThis.location?.href) {
  return {
    busqueda,
    sede: sedeDeBusqueda(busqueda),
    geo: origenGeoDeUrl(busqueda, pagina) || geoDeSede(busqueda, CONFIG_OM3_URL, pagina),
    respaldo: carpetaRespaldo(busqueda),
    config: configDeSede(busqueda, CONFIG_OM3_URL, pagina),
  }
}

export const PAGINA = leerPagina(typeof location === 'undefined' ? '' : location.search)

/** Consulta de la URL que refleja el origen y el destino, con el modo, la sede y el origen del dibujo de la página */
export function consultaCompartir(params, { origen, destino, via = 'ascensor', accesible = false } = {}) {
  const p = new URLSearchParams()
  for (const k of PARAMS_CONSERVAR) if (params.get(k)) p.set(k, params.get(k))
  if (via !== 'ascensor') p.set('via', via)
  if (accesible) p.set('accesible', '1')
  if (origen) p.set('origen', origen)
  if (destino) p.set('destino', destino)
  return p.toString()
}

/** Enlace del código QR «Usted está aquí»: el punto de partida en la misma sede, edificio y origen del dibujo */
export function enlaceQR(base, params, origen) {
  const p = new URLSearchParams()
  for (const k of PARAMS_SEDE) if (params.get(k)) p.set(k, params.get(k))
  p.set('origen', origen)
  return `${base}?${p}`
}

/** Nombre del hospital para mostrar: el del edificio publicado; si no, «Hospital SOLCA <sede>» */
export function nombreHospital(edificio, sede = PAGINA.sede) {
  const n = edificio?.manifiesto?.edificioNombre || edificio?.nombre
  if (n) return n
  const info = sede?.info || (sede?.id != null ? SEDES_INFO[sede.id] : null)
  return info ? `Hospital SOLCA ${info.nombre}` : 'Hospital SOLCA'
}

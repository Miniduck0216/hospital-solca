// Modo de inserción y modo «elegir» (OM3 fija la ubicación de un tótem tocando el mapa).
// Sin JSX ni React: lo usan App.jsx y las pruebas (node --test).

const URL_OK = (u) => { try { const x = new URL(u); return x.protocol === 'https:' || x.protocol === 'http:' ? x : null } catch { return null } }

/**
 * Lee de la consulta de la página el modo de inserción y la ventana padre de OM3.
 * - modo=totem | guia | admin: insertado en OM3 (sin administración propia ni enlaces que saquen del mapa)
 * - modo=admin&padre=<origen de OM3>: editor del mapa dentro de OM3 (modoAdmin)
 * - modo=admin&padre=…&elegir=1: elegir un lugar para el tótem (elegir); no abre el editor
 * - modo=totem&padre=…: tótem con el mapa siempre cargado (padreTotem)
 * @param {string|URLSearchParams} busqueda
 */
export function leerModo(busqueda = '') {
  const p = busqueda instanceof URLSearchParams ? busqueda : new URLSearchParams(busqueda)
  const modo = p.get('modo')
  const insertado = ['totem', 'guia', 'admin'].includes(modo) ? modo : null
  const padreDe = (m) => (insertado === m ? URL_OK(p.get('padre') || '')?.origin || null : null)
  const padre = padreDe('admin')
  const elegir = !!padre && p.get('elegir') === '1'
  return { insertado, padre, modoAdmin: !!padre && !elegir, elegir, padreTotem: padreDe('totem') }
}

// id de un lugar en todo el edificio: los de la planta baja quedan igual (a47, entrada-puerta-1: los usa OM3);
// los de otros pisos llevan el piso adelante (P1:a12). Es el mismo id que acepta ?origen= y el mensaje mapa-ir.
export const idGlobal = (piso, id) => (piso === 'PB' ? id : `${piso}:${id}`)

/** Piso del id de un lugar: «P1:a12» → P1; sin prefijo, PB. */
export const pisoDeId = (id) => String(id || '').match(/^([A-Z0-9]{1,3}):/)?.[1] || 'PB'

/**
 * Número de piso como lo usa OM3: SB -1, PB 0, P1 1, P2 2…; si el id no sigue esa forma, el nivel del edificio.
 * @param {string} pisoId
 * @param {number} [nivel] nivel del piso en edificio.json (respaldo)
 */
export function numeroPiso(pisoId, nivel) {
  if (pisoId === 'SB') return -1
  if (pisoId === 'PB') return 0
  const m = String(pisoId || '').match(/^P(\d+)$/)
  if (m) return Number(m[1])
  return Number.isFinite(nivel) ? nivel : 0
}

/**
 * Mensaje que el mapa manda a OM3 al elegir un lugar: { tipo: 'mapa-elegido', id, nombre, piso }.
 * `id` sirve tal cual como origen (?origen= o mapa-ir); `piso` es un número (ver numeroPiso).
 * @param {{ id?: string, local: string, piso: string, nombre: string, etiqueta?: string }} lugar (de armarLugares)
 * @param {number} [nivel]
 */
export function mensajeElegido(lugar, nivel) {
  // las entradas llevan su piso en el nombre de la guía («Acceso 2 (PB)»): a OM3 va el nombre sin él (etiqueta)
  return { tipo: 'mapa-elegido', id: idGlobal(lugar.piso, lugar.local ?? lugar.id), nombre: lugar.etiqueta || lugar.nombre, piso: numeroPiso(lugar.piso, nivel) }
}

// Modo de inserción, modo «elegir» (OM3 fija la ubicación de un tótem tocando el mapa) y modo «ver» (vista previa
// de solo lectura con el pin del tótem).
// Sin JSX ni React: lo usan App.jsx y las pruebas (node --test).

const URL_OK = (u) => { try { const x = new URL(u); return x.protocol === 'https:' || x.protocol === 'http:' ? x : null } catch { return null } }

/**
 * Lee de la consulta de la página el modo de inserción y la ventana padre de OM3.
 * - modo=totem | guia | admin: insertado en OM3 (sin administración propia ni enlaces que saquen del mapa)
 * - modo=admin&padre=<origen de OM3>: editor del mapa dentro de OM3 (modoAdmin)
 * - modo=admin&padre=…&elegir=1: elegir un lugar para el tótem (elegir); no abre el editor
 * - modo=admin&ver=1: vista previa de solo lectura (ver): el mapa centrado en el pin, sin paneles; con padre acepta
 *   mapa-marcar. Si vienen ver=1 y elegir=1, gana ver
 * - marcar=<id> (solo con elegir o ver): lugar marcado con el pin al abrir (mismo formato que ?origen=)
 * - modo=totem&padre=…: tótem con el mapa siempre cargado (padreTotem)
 * @param {string|URLSearchParams} busqueda
 */
export function leerModo(busqueda = '') {
  const p = busqueda instanceof URLSearchParams ? busqueda : new URLSearchParams(busqueda)
  const modo = p.get('modo')
  const insertado = ['totem', 'guia', 'admin'].includes(modo) ? modo : null
  const padreDe = (m) => (insertado === m ? URL_OK(p.get('padre') || '')?.origin || null : null)
  const padre = padreDe('admin')
  const ver = insertado === 'admin' && p.get('ver') === '1'
  const elegir = !ver && !!padre && p.get('elegir') === '1'
  const marcar = ver || elegir ? idValido(p.get('marcar')) : null
  return { insertado, padre, modoAdmin: !!padre && !elegir && !ver, elegir, ver, marcar, padreTotem: padreDe('totem') }
}

/** id de lugar aceptable en ?marcar= o en mapa-marcar (a12, P1:a12, entrada-puerta-1, SB:L-x1); si no, null. */
export const idValido = (id) => (typeof id === 'string' && /^[A-Za-z0-9][A-Za-z0-9:_.-]{0,79}$/.test(id) ? id : null)

/**
 * Pin del lugar marcado: { id, piso, x, y, texto }. Las entradas y los puntos van en su sitio; un ambiente, en el
 * centro de su rótulo (lbl), que cae dentro del cuarto (su punto de destino suele estar en la puerta).
 * @param {{ id: string, piso: string, x: number, y: number, lbl?: number[], entrada?: boolean }|null} lugar
 * @param {string} [texto]
 */
export function pinDe(lugar, texto = 'Tótem') {
  if (!lugar || !Number.isFinite(lugar.x) || !Number.isFinite(lugar.y)) return null
  const enRotulo = !lugar.entrada && Array.isArray(lugar.lbl) && Number.isFinite(lugar.lbl[0]) && Number.isFinite(lugar.lbl[1])
  const [x, y] = enRotulo ? lugar.lbl : [lugar.x, lugar.y]
  return { id: lugar.id, piso: lugar.piso, x, y, texto }
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

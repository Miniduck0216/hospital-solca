// Sedes de OM3 (un hospital por ciudad) y respaldo local del dibujo.
//
// El dibujo de cada sede lo publica OM3 (GET /v1/administracion/mapa/geo?sede=&edificio=). Solo Quito trae además un
// respaldo en el sitio, public/sedes/quito/principal/ (edificio.json, exterior.json, perfil.json, techos.json y
// pisos/<piso>/…), que se usa si OM3 no responde. Las demás sedes no tienen respaldo: si OM3 no tiene un plano publicado
// el mapa lo dice («Esta sede todavía no tiene plano publicado en OM3») y muestra el mapa base en el centro de la ciudad;
// nunca cae al plano de Quito.
// (sin dependencias de Vite: lo usan también los scripts de node)

/**
 * Sedes de OM3: ID_SEDE → carpeta, nombre y centro aproximado de la ciudad ([lon, lat]) para el mapa base.
 * El centro de Quito es el del hospital (el mismo de su plano).
 */
export const SEDES_INFO = {
  1: { carpeta: 'quito', nombre: 'Quito', centro: [-78.4689, -0.1366] },
  2: { carpeta: 'imbabura', nombre: 'Imbabura (Ibarra)', centro: [-78.1223, 0.3517] },
  3: { carpeta: 'santo-domingo', nombre: 'Santo Domingo', centro: [-79.1754, -0.2530] },
  4: { carpeta: 'tungurahua', nombre: 'Tungurahua (Ambato)', centro: [-78.6168, -1.2491] },
  5: { carpeta: 'chimborazo', nombre: 'Chimborazo (Riobamba)', centro: [-78.6546, -1.6636] },
  6: { carpeta: 'manabi', nombre: 'Manabí (Portoviejo)', centro: [-80.4545, -1.0546] },
  7: { carpeta: 'machala', nombre: 'Machala', centro: [-79.9554, -3.2581] },
  8: { carpeta: 'cuenca', nombre: 'Cuenca', centro: [-79.0059, -2.9001] },
  21: { carpeta: 'loja', nombre: 'Loja', centro: [-79.2042, -3.9931] },
}
/** Carpeta de cada sede de OM3 (ID_SEDE → nombre de la carpeta) */
export const SEDES = Object.fromEntries(Object.entries(SEDES_INFO).map(([id, s]) => [id, s.carpeta]))
export const SEDE_DEFECTO = 'quito'
export const EDIFICIO_DEFECTO = 'principal'
export const CARPETA_DEFECTO = `sedes/${SEDE_DEFECTO}/${EDIFICIO_DEFECTO}/`
/** Sedes con respaldo local en public/sedes/ (solo Quito) */
export const CON_RESPALDO = [SEDE_DEFECTO]

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

/** ¿La sede (carpeta) tiene respaldo local en public/? */
export const tieneRespaldo = (carpeta) => CON_RESPALDO.includes(carpeta)

/** Datos de una sede por su carpeta: { id, carpeta, nombre, centro } o null */
export function infoSede(carpeta) {
  const e = Object.entries(SEDES_INFO).find(([, s]) => s.carpeta === carpeta)
  return e ? { id: Number(e[0]), ...e[1] } : null
}

const paramsDe = (u) => {
  if (!u) return null
  try { return new URL(u, 'http://x/').searchParams } catch { return null }
}

/**
 * Sede y edificio pedidos en la consulta de la página: ?sede=&edificio=, o los de ?geo= o ?config=
 * (…/geo?sede=1&edificio=PRINCIPAL, …/mapa/publicado?sede=1). Sin sede reconocible: quito/principal.
 * @returns {{ sede: string, edificio: string, id: number|null, info: object|null }}
 */
export function sedeDeBusqueda(busqueda = '') {
  const p = new URLSearchParams(busqueda)
  const fuentes = [p, paramsDe(p.get('geo')), paramsDe(p.get('config'))].filter(Boolean)
  const de = (k) => fuentes.map((f) => f.get(k)).find((v) => v != null && v !== '')
  const sede = carpetaSede(de('sede')) || SEDE_DEFECTO
  const info = infoSede(sede)
  return { sede, edificio: carpetaEdificio(de('edificio')), id: info?.id ?? null, info }
}

/**
 * Carpeta del respaldo local según la consulta de la página (ver sedeDeBusqueda).
 * @returns {string|null} 'sedes/quito/<edificio>/' (relativa a la raíz del sitio) o null si la sede no tiene respaldo
 */
export function carpetaRespaldo(busqueda = '') {
  const { sede, edificio } = sedeDeBusqueda(busqueda)
  return tieneRespaldo(sede) ? `sedes/${sede}/${edificio}/` : null
}

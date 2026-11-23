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

/** Nombre de la carpeta de una sede de OM3: por su número o por su nombre; null si no es una de SEDES_INFO */
export function carpetaSede(sede) {
  if (sede == null || sede === '') return null
  const s = String(sede).trim()
  if (/^\d+$/.test(s)) return SEDES[Number(s)] || null
  const n = nombreCarpeta(s)
  return Object.values(SEDES).includes(n) ? n : null
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
 * (…/geo?sede=1&edificio=PRINCIPAL, …/mapa/publicado?sede=1&edificio=PRINCIPAL). Cada sede va por separado:
 *   - la página base, sin ?sede=, ?geo= ni ?config=: quito/principal (lo único que cae a Quito);
 *   - ?sede= de una sede de SEDES_INFO: esa sede; el edificio, el de ?edificio= o principal;
 *   - ?sede= que no es una sede de OM3 (9, abc): sede null;
 *   - ?geo= o ?config= sin sede o sin edificio (OM3 siempre los manda): sede o edificio null.
 * Con sede o edificio null el mapa no carga ningún plano: avisa que la sede no tiene plano publicado (SinPlano).
 * @returns {{ sede: string|null, edificio: string|null, id: number|null, info: object|null, base: boolean }}
 */
export const CODIGO_EDIFICIO = /^[A-Z0-9_-]{1,20}$/
const vacio = (v) => v == null || v === ''

export function sedeDeBusqueda(busqueda = '') {
  const p = new URLSearchParams(busqueda)
  const om3 = [p.get('geo'), p.get('config')].filter((v) => v && v !== '0' && v !== 'public').map(paramsDe).filter(Boolean)
  const conOm3 = [p.get('geo'), p.get('config')].some((v) => v && v !== '0' && v !== 'public')
  // con ?geo= o ?config=, la sede y el edificio salen solo de esas direcciones (lo que se va a pedir a OM3); un ?sede=
  // o ?edificio= de la página que no coincide no se mezcla: no hay sede (no se juntan el respaldo de una con el
  // plano de otra)
  const de = (k) => (conOm3 ? om3 : [p]).map((f) => f.get(k)).find((v) => !vacio(v))
  const pedida = de('sede')
  if (pedida == null && !conOm3) {
    return { sede: SEDE_DEFECTO, edificio: EDIFICIO_DEFECTO, codigo: 'PRINCIPAL', id: 1, info: infoSede(SEDE_DEFECTO), base: true }
  }
  let sede = carpetaSede(pedida)
  const ed = de('edificio')
  let edificio = ed != null ? carpetaEdificio(ed) : conOm3 ? null : EDIFICIO_DEFECTO
  if (conOm3) {
    const pSede = p.get('sede'), pEd = p.get('edificio')
    if (!vacio(pSede) && carpetaSede(pSede) !== sede) sede = null
    if (!vacio(pEd) && edificio && carpetaEdificio(pEd) !== edificio) edificio = null
  }
  // código del edificio para OM3, tal cual (en mayúsculas): PRINCIPAL, TORRE_B
  const codigo = ed != null ? String(ed).trim().toUpperCase() : edificio ? 'PRINCIPAL' : null
  const info = sede ? infoSede(sede) : null
  return { sede, edificio, codigo: codigo && CODIGO_EDIFICIO.test(codigo) ? codigo : null, id: info?.id ?? null, info, base: false }
}

/**
 * Carpeta del respaldo local según la consulta de la página (ver sedeDeBusqueda).
 * @returns {string|null} 'sedes/quito/<edificio>/' (relativa a la raíz del sitio) o null si la sede no tiene respaldo
 *   (otra sede, una sede desconocida o sin edificio)
 */
export function carpetaRespaldo(busqueda = '') {
  const { sede, edificio } = sedeDeBusqueda(busqueda)
  return sede && edificio && tieneRespaldo(sede) ? `sedes/${sede}/${edificio}/` : null
}

/** Clave de los cambios del administrador guardados en el navegador: una por sede y edificio */
export const CLAVE_CAMBIOS = 'solca-admin-cambios'
export const claveCambios = (sede, edificio) => (sede && edificio ? `${CLAVE_CAMBIOS}:${sede}:${edificio}` : null)

/**
 * Cambios del administrador guardados en este navegador para una sede y edificio (texto JSON o null). La clave vieja,
 * única por origen ('solca-admin-cambios'), era de Quito: solo quito/principal la hereda (se copia a la nueva, sin
 * borrarla). Sin sede o sin edificio no hay cambios locales.
 */
export function leerCambiosLocales(almacen, sede, edificio) {
  const clave = claveCambios(sede, edificio)
  if (!clave || !almacen) return null
  let v = almacen.getItem(clave)
  if (v == null && sede === SEDE_DEFECTO && edificio === EDIFICIO_DEFECTO) {
    const viejo = almacen.getItem(CLAVE_CAMBIOS)
    if (viejo != null) {
      // se copia y la vieja se deja: una pestaña abierta con la versión anterior sigue guardando ahí y no pierde nada
      try { almacen.setItem(clave, viejo) } catch { /* sin espacio: se lee igual */ }
      v = viejo
    }
  }
  return v
}

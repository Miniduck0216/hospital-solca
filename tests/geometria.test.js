// Proveedor de geometría (src/pb/geometria.js): el dibujo sale de OM3 (GET /geo y /geo/:id/archivo) o de public/.
// OM3 se simula con el paquete que arma scripts/plano_paquete.mjs desde public/ (el mismo que se sube).
import './fetchPublic.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cargarDatos } from '../src/pb/datos.js'
import { origenGeoDeUrl, urlArchivo, unirPisos, crearProveedor, geoDeSede, SinPlano, MENSAJE_SIN_PLANO } from '../src/pb/geometria.js'
import { carpetaRespaldo, carpetaSede, CARPETA_DEFECTO, SEDES_INFO, sedeDeBusqueda, tieneRespaldo, claveCambios, leerCambiosLocales } from '../src/pb/sedes.js'
import { armarPaquete } from '../scripts/plano_paquete.mjs'
import { leerPagina, consultaCompartir, enlaceQR, nombreHospital, PARAMS_CONSERVAR } from '../src/pb/paginaInicial.js'
import { configDeSede } from '../src/pb/geometria.js'

const OM3 = 'https://om3.test/api/v1/administracion/mapa'
const { archivos, manifiesto } = armarPaquete({ sede: 1, edificio: 'PRINCIPAL', generado: '2026-11-16T00:00:00Z' })
const paquete = new Map(archivos)
const respuesta = (status, cuerpo) => ({ ok: status >= 200 && status < 300, status, json: async () => cuerpo })
const publico = globalThis.fetch

// OM3 simulado: `estado` decide cómo contesta; `pedidos` guarda lo que se pidió
function simularOm3({ geo = 200, archivo = () => 200, manifiestoCambiado = null } = {}) {
  const pedidos = []
  globalThis.fetch = async (url, init = {}) => {
    const u = new URL(String(url), 'http://local/')
    if (u.origin !== 'https://om3.test') return publico(url, init)
    pedidos.push({ url: u, init })
    if (u.pathname.endsWith('/mapa/geo')) {
      if (geo !== 200) return respuesta(geo, { error: 'sin versión publicada' })
      return respuesta(200, { version: { id: 7, version: 3, estado: u.searchParams.get('vista') ? 'BORRADOR' : 'PUBLICADA' }, hash: 'abc', manifiesto: manifiestoCambiado || manifiesto, base: `${OM3}/geo/7/archivo` })
    }
    const m = u.pathname.match(/\/geo\/(\d+)\/archivo$/)
    if (m) {
      const ruta = u.searchParams.get('ruta')
      const st = archivo(ruta)
      if (st !== 200) return respuesta(st, null)
      if (!paquete.has(ruta)) return respuesta(404, null)
      return respuesta(200, JSON.parse(paquete.get(ruta).toString('utf8')))
    }
    return respuesta(404, null)
  }
  return pedidos
}
const silenciar = () => {
  const avisos = []
  const antes = console.warn
  console.warn = (...a) => avisos.push(a.join(' '))
  return { avisos, fin: () => { console.warn = antes } }
}
const geoDe = (q) => origenGeoDeUrl(q)

test('origen: sin parámetros, public/; ?geo= y ?config= (…/publicado) llevan a GET /geo; ?vista= solo es token en modo admin', () => {
  assert.equal(origenGeoDeUrl(''), null)
  assert.equal(origenGeoDeUrl('?modo=totem&vista=3d'), null)
  assert.equal(origenGeoDeUrl(`?geo=${encodeURIComponent(`${OM3}/geo?sede=2&edificio=NORTE`)}&geo2=x`).url, `${OM3}/geo?sede=2&edificio=NORTE`)
  assert.equal(origenGeoDeUrl(`?config=${encodeURIComponent(`${OM3}/publicado?sede=1&edificio=PRINCIPAL`)}`).url, `${OM3}/geo?sede=1&edificio=PRINCIPAL`)
  // sin sede o sin edificio no se supone ninguno (antes: 1 y PRINCIPAL): no hay origen y el mapa avisa SinPlano
  assert.equal(origenGeoDeUrl(`?config=${encodeURIComponent(`${OM3}/publicado?sede=1`)}`), null)
  assert.equal(origenGeoDeUrl(`?config=${encodeURIComponent(`${OM3}/publicado`)}`), null)
  assert.equal(origenGeoDeUrl(`?geo=${encodeURIComponent(`${OM3}/geo?edificio=PRINCIPAL`)}`), null)
  assert.equal(origenGeoDeUrl(`?config=${encodeURIComponent(`${OM3}/otra`)}`), null)
  assert.equal(origenGeoDeUrl(`?config=${encodeURIComponent(`${OM3}/publicado`)}&geo=0`), null)
  const admin = origenGeoDeUrl(`?modo=admin&vista=tok123&config=${encodeURIComponent(`${OM3}/publicado?sede=1&edificio=PRINCIPAL`)}`)
  assert.equal(admin.vista, 'tok123')
  assert.equal(new URL(admin.url).searchParams.get('vista'), 'tok123')
  assert.equal(origenGeoDeUrl(`?modo=admin&vista=3d&geo=${encodeURIComponent(`${OM3}/geo?sede=1&edificio=PRINCIPAL`)}`).vista, null)
  assert.equal(origenGeoDeUrl(`?modo=admin&vista=3d&geo=${encodeURIComponent(`${OM3}/geo`)}`), null)
  assert.equal(origenGeoDeUrl('?geo=javascript:alert(1)'), null)
  // OM3 manda el token dentro de ?geo= (y también en ?vista=): la URL de geo se usa tal cual
  const enGeo = origenGeoDeUrl(`?modo=admin&vista=tokA&geo=${encodeURIComponent(`${OM3}/geo?sede=1&edificio=PRINCIPAL&vista=tokA`)}`)
  assert.deepEqual(enGeo, { url: `${OM3}/geo?sede=1&edificio=PRINCIPAL&vista=tokA`, vista: 'tokA' })
  // celular (QR): geo= sin modo admin, publicado
  assert.deepEqual(origenGeoDeUrl(`?modo=guia&vista=3d&geo=${encodeURIComponent(`${OM3}/geo?sede=1&edificio=PRINCIPAL`)}`), { url: `${OM3}/geo?sede=1&edificio=PRINCIPAL`, vista: null })
})

test('respaldo local: solo Quito lo tiene; la sede sale de ?sede=&edificio= o de ?geo=/?config=; solo la página base es Quito', () => {
  assert.equal(CARPETA_DEFECTO, 'sedes/quito/principal/')
  assert.equal(carpetaRespaldo(''), 'sedes/quito/principal/')
  assert.equal(carpetaRespaldo('?modo=totem'), 'sedes/quito/principal/')
  assert.equal(carpetaRespaldo('?sede=1&edificio=ANEXO'), 'sedes/quito/anexo/')
  assert.equal(carpetaRespaldo('?sede=quito'), 'sedes/quito/principal/')
  // las demás sedes no tienen respaldo (null): nunca caen al plano de Quito
  assert.equal(carpetaRespaldo('?sede=3'), null)
  assert.equal(carpetaRespaldo('?sede=21&edificio=ANEXO'), null)
  assert.equal(carpetaRespaldo('?sede=MANABÍ'), null)
  assert.equal(carpetaRespaldo(`?geo=${encodeURIComponent(`${OM3}/geo?sede=8&edificio=PRINCIPAL`)}`), null)
  assert.equal(carpetaRespaldo(`?config=${encodeURIComponent('/api/v1/administracion/mapa/publicado?sede=7')}`), null)
  assert.equal(carpetaRespaldo('?sede=../../x&edificio=../y'), null)
  // sede desconocida: ninguna (antes caía a Quito)
  assert.equal(carpetaRespaldo('?sede=99'), null)
  assert.equal(carpetaRespaldo('?sede=9'), null)
  assert.equal(carpetaRespaldo('?sede=abc'), null)
  // ?config= o ?geo= sin sede o sin edificio: ninguna
  assert.equal(carpetaRespaldo(`?config=${encodeURIComponent('/api/v1/administracion/mapa/publicado')}`), null)
  assert.equal(carpetaRespaldo(`?config=${encodeURIComponent('/api/v1/administracion/mapa/publicado?sede=1')}`), null)
  assert.equal(carpetaRespaldo(`?config=${encodeURIComponent('/api/v1/administracion/mapa/publicado?sede=1&edificio=PRINCIPAL')}`), 'sedes/quito/principal/')
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 21].map(carpetaSede), ['quito', 'imbabura', 'santo-domingo', 'tungurahua', 'chimborazo', 'manabi', 'machala', 'cuenca', 'loja'])
  assert.deepEqual(Object.values(SEDES_INFO).filter((s) => tieneRespaldo(s.carpeta)).map((s) => s.carpeta), ['quito'])
})

test('sede de la página: base = Quito; ?sede= desconocida o ?geo=/?config= sin sede o edificio = ninguna', () => {
  assert.deepEqual(sedeDeBusqueda(''), { ...sedeDeBusqueda(''), sede: 'quito', edificio: 'principal', id: 1, base: true })
  assert.equal(sedeDeBusqueda('?modo=totem&vista=3d').sede, 'quito')
  assert.equal(sedeDeBusqueda('?geo=0').sede, 'quito')
  for (const q of ['?sede=9', '?sede=abc', '?sede=0', `?geo=${encodeURIComponent(`${OM3}/geo?edificio=PRINCIPAL`)}`, `?config=${encodeURIComponent(`${OM3}/publicado`)}`]) {
    const s = sedeDeBusqueda(q)
    assert.equal(s.sede, null, q)
    assert.equal(s.info, null, q)
    assert.equal(s.base, false, q)
  }
  assert.equal(sedeDeBusqueda(`?config=${encodeURIComponent(`${OM3}/publicado?sede=3`)}`).edificio, null)
  assert.equal(sedeDeBusqueda('?sede=3').edificio, 'principal')
  assert.equal(carpetaSede('abc'), null)
  assert.equal(carpetaSede('Santo Domingo'), 'santo-domingo')
})

test('cambios del administrador en el navegador: una clave por sede y edificio; la vieja solo pasa a quito/principal', () => {
  const almacen = () => {
    const m = new Map()
    return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }
  }
  assert.equal(claveCambios('quito', 'principal'), 'solca-admin-cambios:quito:principal')
  assert.equal(claveCambios('imbabura', 'principal'), 'solca-admin-cambios:imbabura:principal')
  assert.equal(claveCambios(null, 'principal'), null)
  // otra sede no hereda la clave vieja (era de Quito)
  const a = almacen(); a.setItem('solca-admin-cambios', '{"version":2,"pisos":{"PB":{}}}')
  assert.equal(leerCambiosLocales(a, 'santo-domingo', 'principal'), null)
  assert.equal(leerCambiosLocales(a, 'quito', 'anexo'), null)
  assert.ok(a.m.has('solca-admin-cambios'))
  // quito/principal la hereda: se copia a la nueva y la vieja se deja (una pestaña vieja abierta sigue guardando ahí)
  assert.equal(leerCambiosLocales(a, 'quito', 'principal'), '{"version":2,"pisos":{"PB":{}}}')
  assert.equal(a.m.get('solca-admin-cambios:quito:principal'), '{"version":2,"pisos":{"PB":{}}}')
  assert.ok(a.m.has('solca-admin-cambios'))
  // ya copiada, manda la nueva aunque la vieja cambie
  a.setItem('solca-admin-cambios', '{"viejo":1}')
  assert.equal(leerCambiosLocales(a, 'quito', 'principal'), '{"version":2,"pisos":{"PB":{}}}')
  // cada sede lee solo la suya; sin sede, nada
  a.setItem('solca-admin-cambios:imbabura:principal', '{"x":1}')
  assert.equal(leerCambiosLocales(a, 'imbabura', 'principal'), '{"x":1}')
  assert.equal(leerCambiosLocales(a, 'santo-domingo', 'principal'), null)
  assert.equal(leerCambiosLocales(a, null, null), null)
})

test('sedes: las 9 de OM3 con su carpeta y el centro de su ciudad (lon, lat dentro del Ecuador)', () => {
  assert.deepEqual(Object.keys(SEDES_INFO).map(Number), [1, 2, 3, 4, 5, 6, 7, 8, 21])
  for (const s of Object.values(SEDES_INFO)) {
    const [lon, lat] = s.centro
    assert.ok(lon > -81.5 && lon < -75 && lat > -5.1 && lat < 1.5, s.carpeta)
    assert.ok(s.nombre)
  }
  const sd = sedeDeBusqueda('?sede=santo-domingo&edificio=principal')
  assert.equal(sd.id, 3)
  assert.equal(sd.edificio, 'principal')
  assert.deepEqual(sd.info.centro, SEDES_INFO[3].centro)
  assert.equal(sedeDeBusqueda(`?geo=${encodeURIComponent(`${OM3}/geo?sede=2&edificio=PRINCIPAL`)}`).sede, 'imbabura')
})

test('sede sin respaldo y sin ?geo=: el dibujo se pide al /geo del OM3 por defecto (Quito no)', () => {
  const pub = `${OM3}/publicado`
  assert.deepEqual(geoDeSede('?sede=3', pub), { url: `${OM3}/geo?sede=3&edificio=PRINCIPAL`, vista: null })
  assert.equal(geoDeSede('?sede=imbabura&edificio=anexo', pub).url, `${OM3}/geo?sede=2&edificio=ANEXO`)
  assert.equal(geoDeSede('?sede=1', pub), null)
  assert.equal(geoDeSede('', pub), null)
  assert.equal(geoDeSede('?sede=3', null), null)
  assert.equal(geoDeSede('?sede=3&geo=0', pub), null)
  assert.equal(geoDeSede('?sede=3', `${OM3}/otra`), null)
})

test('sede sin respaldo: sin plano en OM3 (404, caída o sin ?geo=) avisa «sin plano publicado» y no cae a Quito', async () => {
  const prov = crearProveedor({ base: '/', carpeta: null, version: 't', avisar: () => {} })
  assert.equal(await prov.edificio(), null)
  assert.equal(await prov.urlRespaldo('techos.json'), null)
  assert.equal(await prov.json('pisos/pb/datos.json'), null)
  await assert.rejects(cargarDatos(null, { respaldo: null }), (e) => e instanceof SinPlano && e.message === MENSAJE_SIN_PLANO)
  const s = silenciar()
  try {
    simularOm3({ geo: 404 })
    await assert.rejects(cargarDatos(null, { geo: { url: `${OM3}/geo?sede=3&edificio=PRINCIPAL`, vista: null }, respaldo: null }), SinPlano)
    simularOm3({ archivo: (r) => (r === 'edificio.json' ? 500 : 200) })
    await assert.rejects(cargarDatos(null, { geo: { url: `${OM3}/geo?sede=21&edificio=PRINCIPAL`, vista: null }, respaldo: null }), SinPlano)
    assert.match(s.avisos.join(' '), /no tiene respaldo local/)
    assert.doesNotMatch(s.avisos.join(' '), /se usa el de public/)
  } finally { s.fin(); globalThis.fetch = publico }
})

test('sede sin respaldo con plano publicado en OM3: se dibuja el de OM3, con su perfil o sin perfil (nunca el de Quito)', async () => {
  try {
    simularOm3({ archivo: (r) => (r === 'perfil.json' ? 404 : 200) })
    const d = await cargarDatos(null, { pisoId: 'P1', geo: { url: `${OM3}/geo?sede=5&edificio=PRINCIPAL`, vista: null }, respaldo: null })
    assert.equal(d.edificio.origen.tipo, 'om3')
    assert.ok(d.ambientes.length > 0)
    assert.deepEqual(d.perfil, [])
    simularOm3()
    const e = await cargarDatos(null, { pisoId: 'P1', geo: { url: `${OM3}/geo?sede=6&edificio=PRINCIPAL`, vista: null }, respaldo: null })
    assert.deepEqual(e.perfil, JSON.parse(paquete.get('perfil.json').toString('utf8')).huella)
  } finally { globalThis.fetch = publico }
})

test('respaldo de Quito: otro edificio sin carpeta propia no tiene respaldo (no cae a quito/principal)', async () => {
  const avisos = []
  const prov = crearProveedor({ base: '/', carpeta: 'sedes/quito/anexo/', version: 't', avisar: (m) => avisos.push(m) })
  assert.equal(await prov.edificio(), null)
  assert.equal(await prov.urlRespaldo('techos.json'), null)
  assert.match(avisos.join(' '), /No hay respaldo local en sedes\/quito\/anexo\//)
  await assert.rejects(cargarDatos(null, { respaldo: 'sedes/quito/anexo/' }), SinPlano)
  const d = await cargarDatos(null, { pisoId: 'P1', respaldo: 'sedes/quito/principal/' })
  assert.ok(d.ambientes.length > 0 && d.perfil.length > 0)
})

test('public/: las direcciones son las de siempre (<base><ruta>?v=<versión>)', () => {
  assert.equal(urlArchivo(undefined, 'pb/solca_pb.glb', '/hospital-solca/', '123'), '/hospital-solca/pb/solca_pb.glb?v=123')
  assert.equal(urlArchivo({ tipo: 'public' }, 'pb/datos.json', '/', 'x'), '/pb/datos.json?v=x')
  assert.equal(urlArchivo({ tipo: 'public', base: '/mapa/sedes/quito/principal/' }, 'pisos/pb/datos.json', '/mapa/', 'x'), '/mapa/sedes/quito/principal/pisos/pb/datos.json?v=x')
  assert.equal(urlArchivo({ tipo: 'om3', archivos: `${OM3}/geo/7/archivo`, vista: null }, 'pisos/PB/solca_pb.glb'), `${OM3}/geo/7/archivo?ruta=pisos%2FPB%2Fsolca_pb.glb`)
})

test('OM3 responde: el piso se lee del paquete y se dibuja igual que desde public/', async () => {
  const pedidos = simularOm3()
  const geo = geoDe(`?geo=${encodeURIComponent(`${OM3}/geo?sede=1&edificio=PRINCIPAL`)}`)
  const d = await cargarDatos(null, { geo, pisoId: 'PB' })
  const p = await cargarDatos(null, { pisoId: 'PB' })
  assert.equal(d.edificio.origen.tipo, 'om3')
  assert.equal(d.edificio.origen.version, 7)
  assert.equal(p.edificio.origen.tipo, 'public')
  const rutas = pedidos.map((x) => x.url.searchParams.get('ruta')).filter(Boolean)
  assert.deepEqual(rutas, ['edificio.json', 'pisos/PB/datos.json', 'pisos/PB/config.json', 'exterior.json'])
  for (const k of ['muros', 'puertas', 'huella', 'gradas', 'trazos', 'entradas', 'parqueos', 'canchas', 'calles']) assert.deepEqual(d[k], p[k], k)
  assert.deepEqual(d.ambientes.map((a) => [a.id, a.nombre, a.cat]), p.ambientes.map((a) => [a.id, a.nombre, a.cat]))
  assert.deepEqual(Buffer.from(d.nav.celdas), Buffer.from(p.nav.celdas))
  assert.deepEqual(d.cfgCruda, p.cfgCruda)
  assert.deepEqual(d.edificio.conectores, p.edificio.conectores)
  // los .glb salen de OM3 (sin ?v=: la versión ya va en la dirección y OM3 los marca immutable)
  assert.equal(urlArchivo(d.edificio.origen, d.piso.glb[1]), `${OM3}/geo/7/archivo?ruta=pisos%2FPB%2Fsolca_pb_este.glb&sede=1&edificio=PRINCIPAL`)
  // cada archivo lleva la sede y el edificio pedidos (OM3 comprueba que la versión sea de ese edificio)
  const archivos = pedidos.filter((x) => x.url.searchParams.get('ruta'))
  assert.ok(archivos.length && archivos.every((x) => x.url.searchParams.get('sede') === '1' && x.url.searchParams.get('edificio') === 'PRINCIPAL'))
  assert.ok(pedidos.every((x) => x.init.cache !== 'no-store'))
})

test('OM3 da 404 (sin versión publicada) o no responde: se usa public/ y se avisa en la consola', async () => {
  for (const [i, estado] of [404, 500].entries()) {
    simularOm3({ geo: estado })
    const s = silenciar()
    try {
      const d = await cargarDatos(null, { geo: geoDe(`?geo=${encodeURIComponent(`${OM3}/geo?sede=1&edificio=PRINCIPAL&prueba=${i}`)}`), pisoId: 'P1' })
      assert.equal(d.edificio.origen.tipo, 'public')
      assert.equal(d.piso.datos, 'pisos/p1/datos.json')
      assert.ok(d.ambientes.length > 0)
      assert.match(s.avisos.join('\n'), new RegExp(`El plano de OM3 no está disponible \\(GET /geo respondió ${estado}\\)`))
    } finally { s.fin() }
  }
})

test('un archivo de OM3 falla a mitad de carga: el piso se vuelve a leer de public/', async () => {
  simularOm3({ archivo: (r) => (r === 'pisos/SB/datos.json' ? 503 : 200) })
  const s = silenciar()
  try {
    const d = await cargarDatos(null, { geo: geoDe(`?geo=${encodeURIComponent(`${OM3}/geo?sede=1&edificio=MITAD`)}`), pisoId: 'SB' })
    assert.equal(d.edificio.origen.tipo, 'public')
    assert.equal(d.piso.datos, 'pisos/sb/datos.json')
    assert.match(s.avisos.join('\n'), /pisos\/SB\/datos.json respondió 503/)
  } finally { s.fin() }
})

test('vista previa (?modo=admin&vista=<token>): pide el borrador con el token y sin guardar en caché', async () => {
  const pedidos = simularOm3()
  const geo = geoDe(`?modo=admin&vista=tok-15min&config=${encodeURIComponent(`${OM3}/publicado?sede=1&edificio=PREVIA`)}`)
  const d = await cargarDatos(null, { geo, pisoId: 'P2', sinPublicados: true })
  assert.equal(d.edificio.origen.vista, 'tok-15min')
  assert.ok(pedidos.length >= 3)
  for (const x of pedidos) assert.equal(x.url.searchParams.get('vista'), 'tok-15min', x.url.href)
  assert.ok(pedidos.slice(1).every((x) => x.init.cache === 'no-store'))
  assert.equal(new URL(urlArchivo(d.edificio.origen, 'pisos/P2/solca_p2.glb')).searchParams.get('vista'), 'tok-15min')
})

test('token en ?geo= pero OM3 contesta la versión publicada: los archivos van sin token y con caché', async () => {
  const pedidos = simularOm3()
  const geo = geoDe(`?geo=${encodeURIComponent(`${OM3}/geo?sede=1&edificio=PUBLI&vista=viejo`)}`)
  globalThis.fetch = ((f) => async (url, init) => {
    const r = await f(url, init)
    if (String(url).includes('/mapa/geo?')) { const b = await r.json(); b.version.estado = 'PUBLICADA'; return respuesta(200, b) }
    return r
  })(globalThis.fetch)
  const d = await cargarDatos(null, { geo, pisoId: 'P3' })
  assert.equal(d.edificio.origen.vista, null)
  assert.equal(pedidos[0].url.searchParams.get('vista'), 'viejo')
  assert.ok(pedidos.slice(1).every((x) => !x.url.searchParams.has('vista') && x.init.cache !== 'no-store'))
})

test('pisos dinámicos: la lista sale del manifiesto (nombre, nivel, altura) cuando el dibujo viene de OM3', async () => {
  const m = { ...manifiesto, pisos: manifiesto.pisos.filter((p) => p.clave !== 'P3').map((p) => (p.clave === 'P1' ? { ...p, nombre: 'Primer piso' } : p)) }
  simularOm3({ manifiestoCambiado: m })
  const d = await cargarDatos(null, { geo: geoDe(`?geo=${encodeURIComponent(`${OM3}/geo?sede=1&edificio=DINAMICO`)}`), pisoId: 'PB' })
  assert.deepEqual(d.edificio.pisos.map((p) => p.id), ['SB', 'PB', 'P1', 'P2'])
  assert.equal(d.edificio.pisos.find((p) => p.id === 'P1').nombre, 'Primer piso')
  assert.equal(d.edificio.pisos.find((p) => p.id === 'PB').altura, 384)
  // un piso del manifiesto que edificio.json no trae se arma con las rutas del paquete
  const u = unirPisos({ pisos: [] }, { pisos: [{ clave: 'P4', nombre: 'Piso 4', nivel: 4, altura: 400 }] })
  assert.deepEqual(u[0], { id: 'P4', nombre: 'Piso 4', corto: 'P4', nivel: 4, altura: 400, disponible: true, datos: 'pisos/P4/datos.json', config: 'pisos/P4/config.json', glb: null })
})

test('portal de OM3 (/mapa/): ?config= y ?geo= relativos a la página; sin página siguen pidiendo dirección completa', () => {
  const pagina = 'https://portal.test/mapa/?modo=totem'
  const r = origenGeoDeUrl(`?config=${encodeURIComponent('/api/v1/administracion/mapa/publicado?sede=1&edificio=PRINCIPAL')}`, pagina)
  assert.equal(r.url, 'https://portal.test/api/v1/administracion/mapa/geo?sede=1&edificio=PRINCIPAL')
  assert.equal(origenGeoDeUrl(`?geo=${encodeURIComponent('/api/v1/administracion/mapa/geo?sede=2&edificio=PRINCIPAL')}`, pagina).url, 'https://portal.test/api/v1/administracion/mapa/geo?sede=2&edificio=PRINCIPAL')
  // sin sede o sin edificio: nada (no se supone sede 1 ni PRINCIPAL)
  assert.equal(origenGeoDeUrl('?config=/api/v1/administracion/mapa/publicado', pagina), null)
  assert.equal(origenGeoDeUrl('?geo=/api/v1/administracion/mapa/geo?sede=2', pagina), null)
  assert.equal(origenGeoDeUrl(`?config=${encodeURIComponent('/api/v1/administracion/mapa/publicado?sede=1&edificio=PRINCIPAL')}`, undefined), null)
})

test('URL reescrita (origen y destino): conserva modo, padre, config, sede, edificio, geo y vista', () => {
  const geo = `${OM3}/geo?sede=3&edificio=PRINCIPAL`
  const p = new URLSearchParams(`?sede=3&edificio=principal&geo=${encodeURIComponent(geo)}&vista=tok9&modo=admin&padre=https%3A%2F%2Fom3.test&config=${encodeURIComponent(`${OM3}/publicado?sede=3&edificio=PRINCIPAL`)}&otro=x`)
  const q = new URLSearchParams(consultaCompartir(p, { origen: 'entrada-pb-acceso-pb-1', destino: 'a12', via: 'escalera', accesible: true }))
  for (const k of PARAMS_CONSERVAR) assert.equal(q.get(k), p.get(k), k)
  assert.equal(q.get('origen'), 'entrada-pb-acceso-pb-1')
  assert.equal(q.get('destino'), 'a12')
  assert.equal(q.get('via'), 'escalera')
  assert.equal(q.get('accesible'), '1')
  assert.equal(q.get('otro'), null)
  // al recargar con la URL reescrita, la sede sigue siendo la misma (no Quito)
  assert.equal(sedeDeBusqueda(`?${q}`).sede, 'santo-domingo')
})

test('QR «Usted está aquí»: lleva sede, edificio, config y geo de la página, y el nombre del hospital de esa sede', () => {
  const p = new URLSearchParams(`?sede=2&edificio=PRINCIPAL&modo=totem&origen=x`)
  const u = new URL(enlaceQR('https://mapa.test/', p, 'entrada-pb-acceso-pb-3'))
  assert.equal(u.searchParams.get('sede'), '2')
  assert.equal(u.searchParams.get('edificio'), 'PRINCIPAL')
  assert.equal(u.searchParams.get('origen'), 'entrada-pb-acceso-pb-3')
  assert.equal(u.searchParams.get('modo'), null)
  assert.equal(nombreHospital({ nombre: 'Hospital SOLCA Imbabura' }), 'Hospital SOLCA Imbabura')
  assert.equal(nombreHospital({ manifiesto: { edificioNombre: 'Torre B' }, nombre: 'x' }), 'Torre B')
  assert.equal(nombreHospital(null, sedeDeBusqueda('?sede=3')), 'Hospital SOLCA Santo Domingo')
  assert.equal(nombreHospital(null, sedeDeBusqueda('')), 'Hospital SOLCA Quito')
})

test('página inicial: se lee una vez (sede, origen del dibujo, respaldo y config) y no depende de la URL de después', () => {
  const pub = `${OM3}/publicado`
  const sd = leerPagina('?sede=3', 'https://mapa.test/')
  assert.equal(sd.sede.sede, 'santo-domingo')
  assert.equal(sd.respaldo, null)
  // sin ?config= ni ?geo=, el OM3 por defecto (en las pruebas, el de datos.js) con la sede y el edificio
  assert.match(sd.config, /\/publicado\?sede=3&edificio=PRINCIPAL$/)
  assert.match(sd.geo.url, /\/geo\?sede=3&edificio=PRINCIPAL$/)
  const q = leerPagina('', 'https://mapa.test/')
  assert.equal(q.respaldo, 'sedes/quito/principal/')
  assert.equal(q.geo, null)
  assert.match(q.config, /\/publicado\?sede=1&edificio=PRINCIPAL$/)
  // configDeSede: ?config= tal cual; sin sede reconocible, nada
  assert.equal(configDeSede(`?config=${encodeURIComponent(`${pub}?sede=2&edificio=PRINCIPAL`)}`, pub), `${pub}?sede=2&edificio=PRINCIPAL`)
  assert.equal(configDeSede('?sede=abc', pub), null)
  assert.equal(configDeSede('?sede=8&edificio=torre_b', pub), `${pub}?sede=8&edificio=TORRE_B`)
})

test('?geo=/?config= mandan sobre ?sede=: si no coinciden no hay sede; el código del edificio va tal cual a OM3', () => {
  const g = (s, e) => encodeURIComponent(`${OM3}/geo?sede=${s}&edificio=${e}`)
  assert.equal(sedeDeBusqueda(`?sede=1&geo=${g(3, 'PRINCIPAL')}`).sede, null)
  assert.equal(carpetaRespaldo(`?sede=1&geo=${g(3, 'PRINCIPAL')}`), null)
  assert.equal(sedeDeBusqueda(`?sede=3&geo=${g(3, 'PRINCIPAL')}`).sede, 'santo-domingo')
  assert.equal(sedeDeBusqueda(`?sede=santo-domingo&geo=${g(3, 'PRINCIPAL')}`).sede, 'santo-domingo')
  assert.equal(sedeDeBusqueda(`?edificio=ANEXO&geo=${g(3, 'PRINCIPAL')}`).edificio, null)
  assert.equal(sedeDeBusqueda(`?geo=${g(3, 'TORRE_B')}`).codigo, 'TORRE_B')
  assert.equal(geoDeSede('?sede=3&edificio=torre_b', `${OM3}/publicado`).url, `${OM3}/geo?sede=3&edificio=TORRE_B`)
  assert.equal(geoDeSede('?sede=3&edificio=no%20vale', `${OM3}/publicado`), null)
})

test('techos.json y perfil.json: del paquete de OM3; si OM3 no los tiene, del respaldo local (solo Quito) o null, sin caer', async () => {
  const s = silenciar()
  try {
    // OM3 los trae (el paquete de Quito los lleva): salen de OM3
    let pedidos = simularOm3()
    const prov = crearProveedor({ geo: { url: `${OM3}/geo?sede=1&edificio=PRINCIPAL&t=1`, vista: null }, base: '/', carpeta: 'sedes/quito/principal/', version: 't' })
    const t = await prov.opcional('techos.json')
    assert.deepEqual(t, JSON.parse(paquete.get('techos.json').toString('utf8')))
    assert.ok(pedidos.some((x) => x.url.searchParams.get('ruta') === 'techos.json' && x.url.searchParams.get('sede') === '1'))
    assert.ok(Array.isArray((await prov.opcional('perfil.json')).huella))
    // OM3 responde 404 (versión sin techos): sede sin respaldo -> null, y el proveedor sigue en OM3 (no cae)
    pedidos = simularOm3({ archivo: (r) => (r === 'techos.json' || r === 'perfil.json' ? 404 : 200) })
    const sd = crearProveedor({ geo: { url: `${OM3}/geo?sede=3&edificio=PRINCIPAL&t=2`, vista: null }, base: '/', carpeta: null, version: 't' })
    assert.equal(await sd.opcional('techos.json'), null)
    assert.equal(await sd.opcional('perfil.json'), null)
    assert.equal(sd.origen.tipo, 'om3')
    assert.ok(await sd.json('pisos/PB/datos.json'))
    assert.equal(sd.origen.tipo, 'om3')
    // Quito con 404 en OM3: el de su respaldo local
    simularOm3({ archivo: (r) => (r === 'techos.json' ? 404 : 200) })
    const q = crearProveedor({ geo: { url: `${OM3}/geo?sede=1&edificio=PRINCIPAL&t=3`, vista: null }, base: '/', carpeta: 'sedes/quito/principal/', version: 't' })
    assert.ok(Object.keys(await q.opcional('techos.json')).length > 0)
    assert.equal(q.origen.tipo, 'om3')
    assert.doesNotMatch(s.avisos.join(' '), /no está disponible/)
  } finally { s.fin(); globalThis.fetch = publico }
})

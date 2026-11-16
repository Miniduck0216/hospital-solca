// Proveedor de geometría (src/pb/geometria.js): el dibujo sale de OM3 (GET /geo y /geo/:id/archivo) o de public/.
// OM3 se simula con el paquete que arma scripts/plano_paquete.mjs desde public/ (el mismo que se sube).
import './fetchPublic.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cargarDatos } from '../src/pb/datos.js'
import { origenGeoDeUrl, urlArchivo, unirPisos } from '../src/pb/geometria.js'
import { armarPaquete } from '../scripts/plano_paquete.mjs'

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
  assert.equal(origenGeoDeUrl(`?config=${encodeURIComponent(`${OM3}/publicado?sede=1`)}`).url, `${OM3}/geo?sede=1&edificio=PRINCIPAL`)
  assert.equal(origenGeoDeUrl(`?config=${encodeURIComponent(`${OM3}/otra`)}`), null)
  assert.equal(origenGeoDeUrl(`?config=${encodeURIComponent(`${OM3}/publicado`)}&geo=0`), null)
  const admin = origenGeoDeUrl(`?modo=admin&vista=tok123&config=${encodeURIComponent(`${OM3}/publicado?sede=1&edificio=PRINCIPAL`)}`)
  assert.equal(admin.vista, 'tok123')
  assert.equal(new URL(admin.url).searchParams.get('vista'), 'tok123')
  assert.equal(origenGeoDeUrl(`?modo=admin&vista=3d&geo=${encodeURIComponent(`${OM3}/geo`)}`).vista, null)
  assert.equal(origenGeoDeUrl('?geo=javascript:alert(1)'), null)
  // OM3 manda el token dentro de ?geo= (y también en ?vista=): la URL de geo se usa tal cual
  const enGeo = origenGeoDeUrl(`?modo=admin&vista=tokA&geo=${encodeURIComponent(`${OM3}/geo?sede=1&edificio=PRINCIPAL&vista=tokA`)}`)
  assert.deepEqual(enGeo, { url: `${OM3}/geo?sede=1&edificio=PRINCIPAL&vista=tokA`, vista: 'tokA' })
  // celular (QR): geo= sin modo admin, publicado
  assert.deepEqual(origenGeoDeUrl(`?modo=guia&vista=3d&geo=${encodeURIComponent(`${OM3}/geo?sede=1&edificio=PRINCIPAL`)}`), { url: `${OM3}/geo?sede=1&edificio=PRINCIPAL`, vista: null })
})

test('public/: las direcciones son las de siempre (<base><ruta>?v=<versión>)', () => {
  assert.equal(urlArchivo(undefined, 'pb/solca_pb.glb', '/hospital-solca/', '123'), '/hospital-solca/pb/solca_pb.glb?v=123')
  assert.equal(urlArchivo({ tipo: 'public' }, 'pb/datos.json', '/', 'x'), '/pb/datos.json?v=x')
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
  assert.equal(urlArchivo(d.edificio.origen, d.piso.glb[1]), `${OM3}/geo/7/archivo?ruta=pisos%2FPB%2Fsolca_pb_este.glb`)
  assert.ok(pedidos.every((x) => x.init.cache !== 'no-store'))
})

test('OM3 da 404 (sin versión publicada) o no responde: se usa public/ y se avisa en la consola', async () => {
  for (const [i, estado] of [404, 500].entries()) {
    simularOm3({ geo: estado })
    const s = silenciar()
    try {
      const d = await cargarDatos(null, { geo: geoDe(`?geo=${encodeURIComponent(`${OM3}/geo?sede=9&edificio=X${i}`)}`), pisoId: 'P1' })
      assert.equal(d.edificio.origen.tipo, 'public')
      assert.equal(d.piso.datos, 'p1/datos.json')
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
    assert.equal(d.piso.datos, 'sb/datos.json')
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
  const r = origenGeoDeUrl('?config=/api/v1/administracion/mapa/publicado', pagina)
  assert.equal(r.url, 'https://portal.test/api/v1/administracion/mapa/geo?sede=1&edificio=PRINCIPAL')
  assert.equal(origenGeoDeUrl('?geo=/api/v1/administracion/mapa/geo?sede=2', pagina).url, 'https://portal.test/api/v1/administracion/mapa/geo?sede=2')
  assert.equal(origenGeoDeUrl('?config=/api/v1/administracion/mapa/publicado', undefined), null)
})

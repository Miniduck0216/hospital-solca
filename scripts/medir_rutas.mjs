// Mide las rutas de pacientes de Quito piso por piso: largo de cada ruta de una muestra de pares origen → destino y si
// algún punto de la línea cae sobre un muro, dentro de un cuarto cerrado (que no sea el origen ni el destino) o en un
// área del personal. Sirve para comparar el trazado antes y después de un cambio:
//
//   node scripts/medir_rutas.mjs [CARPETA] > despues.json      (CARPETA: raíz de otra copia del repo, p. ej. un worktree
//                                                               de main; por defecto este mismo repo)
//   node scripts/medir_rutas.mjs --comparar antes.json despues.json
//
// La muestra es fija: desde la Puerta 1 a Información, Farmacia, Cajas, RPIS, Laboratorio e Imagen, y 20 pares al azar
// (semilla fija) en la planta baja y 10 en cada uno de los otros pisos. La configuración de OM3 sale de
// tests/fixtures/config-om3.json (la misma de las pruebas).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const AQUI = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

// (las pruebas importan revisar: el script solo corre si se lo llama directamente)
const directo = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
if (directo && process.argv[2] === '--comparar') {
  comparar(JSON.parse(fs.readFileSync(process.argv[3], 'utf8')), JSON.parse(fs.readFileSync(process.argv[4], 'utf8')))
} else if (directo) {
  await medir(path.resolve(process.argv[2] || AQUI))
}

async function medir(raiz) {
  const PUB = path.join(raiz, 'public')
  const FIX = path.join(AQUI, 'tests', 'fixtures', 'config-om3.json')
  globalThis.__VERSION__ = 'medir'
  globalThis.fetch = async (url) => {
    const u = String(url)
    if (/^https?:/.test(u)) {
      if (new URL(u).pathname.endsWith('/mapa/publicado')) return { ok: true, json: async () => JSON.parse(fs.readFileSync(FIX, 'utf8')) }
      return { ok: false, json: async () => null }
    }
    const f = path.join(PUB, u.replace(/^\/+/, '').split('?')[0])
    if (!fs.existsSync(f)) return { ok: false, json: async () => null }
    return { ok: true, json: async () => JSON.parse(fs.readFileSync(f, 'utf8')) }
  }
  const imp = (f) => import(pathToFileURL(path.join(raiz, 'src', 'pb', f)).href)
  const { cargarDatos, cargarEdificio, usarGeo } = await imp('datos.js')
  const { buscarRuta } = await imp('ruta.js')
  const edificio = await cargarEdificio()
  const out = []
  // generador con semilla fija: la misma muestra en las dos copias del repo
  let semilla = 20261124
  const azar = () => ((semilla = (semilla * 1103515245 + 12345) % 2147483648) / 2147483648)
  for (const piso of edificio.pisos.filter((p) => p.disponible)) {
    const d = await cargarDatos(null, { pisoId: piso.id })
    usarGeo(d.geo)
    const lugares = d.ambientes.filter((a) => a.nombre && a.dest && !a.personal && !a.oculto && !a.eliminado)
      .map((a) => ({ id: a.id, nombre: a.nombre, punto: a.dest }))
      .concat((d.entradas || []).map((e) => ({ id: e.id, nombre: e.nombre, punto: [e.x, e.y] })))
      .sort((a, b) => (a.id < b.id ? -1 : 1))
    const pares = []
    if (piso.id === 'PB') {
      const p1 = lugares.find((l) => l.id === 'entrada-puerta-1')
      for (const re of [/^Espera · Secretaría · Información$/, /^Farmacia$/, /^Cajas 1 · Planta Baja$/, /^RPIS$/, /^Laboratorio Clínico$/, /^Imagen$/]) {
        const l = lugares.find((x) => re.test(x.nombre))
        if (p1 && l) pares.push([p1, l])
      }
    }
    for (let n = piso.id === 'PB' ? 20 : 10; n > 0;) {
      const a = lugares[Math.floor(azar() * lugares.length)], b = lugares[Math.floor(azar() * lugares.length)]
      if (a.id === b.id) continue
      pares.push([a, b]); n--
    }
    for (const [o, t] of pares) {
      const r = buscarRuta(d, o.punto, t.punto, [o.id, t.id])
      out.push({ piso: piso.id, origen: `${o.id} ${o.nombre}`, destino: `${t.id} ${t.nombre}`, metros: r ? +r.metros.toFixed(1) : null, fallas: r ? revisar(d, r.pts, o.id, t.id) : [] })
    }
  }
  process.stdout.write(JSON.stringify(out, null, 1))
}

// tramos de la línea (muestreada cada 10 cm) que cruzan un muro, un cuarto cerrado con nombre que no es el origen ni
// el destino, o un área del personal sin recorrido de pacientes trazado. No cuentan el primer y el último medio metro
// (la salida del cuarto de origen y la entrada por la puerta del destino) ni los roces de menos de 30 cm con una
// esquina (la línea va de centro a centro de celdas de 25 cm y las curvas se validan contra la rejilla).
export function revisar(d, pts, idO, idD) {
  const { w, h, x0, y0, res, celdas, cuarto, red, indice } = d.nav
  const qO = indice[idO] || 0, qD = indice[idD] || 0
  const muestras = []
  let L = 0
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i]
    const l = Math.hypot(bx - ax, by - ay)
    const n = Math.max(1, Math.ceil(l / 0.1))
    for (let k = i === 1 ? 0 : 1; k <= n; k++) muestras.push({ s: L + (l * k) / n, x: ax + ((bx - ax) * k) / n, y: ay + ((by - ay) * k) / n })
    L += l
  }
  const corridas = new Map()   // falla → { actual, max } en metros
  let previas = new Set()
  for (const m of muestras) {
    const fallas = new Set()
    if (m.s >= 0.5 && m.s <= L - 0.5) {
      const x = Math.round((m.x - x0) / res), y = Math.round((m.y - y0) / res)
      if (x < 0 || y < 0 || x >= w || y >= h) fallas.add('fuera')
      else {
        const j = y * w + x, q = cuarto[j]
        if (!celdas[j]) fallas.add('muro')
        else if (q && q !== qO && q !== qD) {
          const a = d.ambientes[q - 1]
          if (a.personal && !red[j]) fallas.add(`personal: ${a.nombre}`)
          else if (a.nombre && !d.nav.paso[q] && !red[j]) fallas.add(`cuarto: ${a.nombre}`)
        }
      }
    }
    for (const f of fallas) {
      const c = corridas.get(f) || { actual: 0, max: 0 }
      c.actual = previas.has(f) ? c.actual + 0.1 : 0.1
      c.max = Math.max(c.max, c.actual)
      corridas.set(f, c)
    }
    previas = fallas
  }
  return [...corridas].filter(([, c]) => c.max >= 0.3).map(([f, c]) => `${f} (${c.max.toFixed(1)} m)`)
}

function comparar(antes, despues) {
  const clave = (r) => `${r.piso}|${r.origen}|${r.destino}`
  const A = new Map(antes.map((r) => [clave(r), r]))
  let mas = 0, menos = 0, iguales = 0, ganado = 0
  console.log('| Piso | Origen | Destino | Antes (m) | Después (m) | Cambio | Fallas después |')
  console.log('|---|---|---|---|---|---|---|')
  for (const r of despues) {
    const a = A.get(clave(r))
    const ma = a?.metros, md = r.metros
    const dif = ma != null && md != null ? md - ma : null
    if (dif != null) { if (dif > 0.5) mas++; else if (dif < -0.5) { menos++; ganado += -dif } else iguales++ }
    const cambio = dif == null ? '—' : `${dif > 0 ? '+' : ''}${dif.toFixed(1)}${ma ? ` (${((100 * dif) / ma).toFixed(0)} %)` : ''}`
    console.log(`| ${r.piso} | ${r.origen} | ${r.destino} | ${ma ?? 'sin ruta'} | ${md ?? 'sin ruta'} | ${cambio} | ${r.fallas.join('; ') || '—'} |`)
  }
  const fallasAntes = antes.filter((r) => r.fallas.length).length, fallasDespues = despues.filter((r) => r.fallas.length).length
  console.log(`\n${despues.length} rutas: ${menos} más cortas (${ganado.toFixed(1)} m menos en total), ${iguales} iguales, ${mas} más largas.`)
  console.log(`Rutas con puntos en muros o cuartos: antes ${fallasAntes}, después ${fallasDespues}.`)
  console.log(`Sin ruta: antes ${antes.filter((r) => r.metros == null).length}, después ${despues.filter((r) => r.metros == null).length}.`)
}

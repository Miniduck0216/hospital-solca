// Comprobación cruzada del vaciado: el mapa de esta rama (plano solo con geometría + la configuración de OM3 armada con
// la semilla, tests/fixtures/config-om3.json) debe mostrar lo mismo que el mapa de antes del vaciado (commit REF, con los
// nombres en datos.json y config.json). Compara, piso por piso: cada ambiente y lugar (nombre, categoría, ícono, solo
// personal, ventanilla, punto de acceso, oculto, baños privados), las entradas, los letreros y las rejillas de
// navegación (paso, franja, puertas abiertas, escalones, alcanzables): es decir, también las rutas.
//
// Uso: node scripts/comparar_om3.mjs [REF]   (REF por defecto 2c6eb6e; necesita el historial de git)
// Termina con código 1 si hay alguna diferencia.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const REF = process.argv[2] || '2c6eb6e'
const FIXTURE = path.join(RAIZ, 'tests', 'fixtures', 'config-om3.json')
const git = (args) => execFileSync('git', ['-C', RAIZ, ...args], { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })

// fetch de prueba: «antes» lee public/ del commit REF; «ahora», la carpeta de trabajo y la configuración de OM3
let fuente = 'antes'
const cacheGit = new Map()
globalThis.__VERSION__ = 'comparar'
globalThis.fetch = async (url) => {
  const u = String(url)
  const no = { ok: false, json: async () => null }
  if (/^https?:/.test(u)) {
    if (fuente === 'ahora' && new URL(u).pathname.endsWith('/mapa/publicado')) return { ok: true, json: async () => JSON.parse(fs.readFileSync(FIXTURE, 'utf8')) }
    return no
  }
  const rel = u.replace(/^\/+/, '').split('?')[0]
  if (fuente === 'antes') {
    if (!cacheGit.has(rel)) {
      try { cacheGit.set(rel, git(['show', `${REF}:public/${rel}`])) } catch { cacheGit.set(rel, null) }
    }
    const t = cacheGit.get(rel)
    return t == null ? no : { ok: true, json: async () => JSON.parse(t) }
  }
  const f = path.join(RAIZ, 'public', rel)
  return fs.existsSync(f) ? { ok: true, json: async () => JSON.parse(fs.readFileSync(f, 'utf8')) } : no
}

// el datos.js de antes, tal cual estaba en REF (no importa otros módulos)
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'comparar-om3-'))
const datosAntes = path.join(tmp, 'datos_antes.mjs')
fs.writeFileSync(datosAntes, git(['show', `${REF}:src/pb/datos.js`]))
const antes = await import(pathToFileURL(datosAntes).href)
const ahora = await import(pathToFileURL(path.join(RAIZ, 'src', 'pb', 'datos.js')).href)

const difs = []
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const resumen = (a) => ({
  nombre: a.nombre || null, cat: a.cat, icono: a.icono || null, personal: !!a.personal, ventanilla: !!a.ventanilla,
  dest: a.dest || null, oculto: !!a.oculto, nuevo: !!a.nuevo, lbl: a.lbl || null, area: a.area ?? null,
  enCuarto: a.enCuarto ?? null, dentroDe: a.dentroDe ?? null,
})
const letrero = (l) => ({ nombre: l.nombre, x: l.x, y: l.y, zona: !!l.zona, cat: l.cat || null })
const totales = { ambientes: 0, conNombre: 0, lugares: 0, entradas: 0, letreros: 0, rejillas: 0 }

fuente = 'antes'
const edificio = await antes.cargarEdificio()
for (const p of edificio.pisos.filter((x) => x.disponible)) {
  fuente = 'antes'
  const dA = await antes.cargarDatos(null, { pisoId: p.id })
  fuente = 'ahora'
  const dB = await ahora.cargarDatos(null, { pisoId: p.id })
  if (dB.sinInformacion) difs.push(`${p.id}: la configuración de OM3 no trae información del piso`)
  const porId = new Map(dB.ambientes.map((a) => [a.id, a]))
  if (dA.ambientes.length !== dB.ambientes.length) difs.push(`${p.id}: ${dA.ambientes.length} ambientes antes, ${dB.ambientes.length} ahora`)
  for (const a of dA.ambientes) {
    const b = porId.get(a.id)
    if (!b) { difs.push(`${p.id}:${a.id} (${a.nombre}) no está ahora`); continue }
    const ra = resumen(a), rb = resumen(b)
    for (const k of Object.keys(ra)) if (!igual(ra[k], rb[k])) difs.push(`${p.id}:${a.id} ${k}: antes ${JSON.stringify(ra[k])}, ahora ${JSON.stringify(rb[k])}`)
    totales[a.nuevo ? 'lugares' : 'ambientes']++
    if (a.nombre) totales.conNombre++
  }
  const eB = new Map(dB.entradas.map((e) => [e.id, e]))
  for (const e of dA.entradas) {
    totales.entradas++
    const b = eB.get(e.id)
    if (!b || b.nombre !== e.nombre || b.x !== e.x || b.y !== e.y) difs.push(`${p.id}:${e.id} entrada: antes ${e.nombre}, ahora ${b?.nombre}`)
  }
  const lA = (dA.cfg.letreros || []).map(letrero), lB = (dB.letreros || []).map(letrero)
  totales.letreros += lA.length
  if (!igual(lA, lB)) difs.push(`${p.id}: letreros distintos (${lA.length} antes, ${lB.length} ahora)`)
  // rejillas de navegación: si son iguales, las rutas también
  // nav.paso va por posición del ambiente; los lugares (sin celdas) pueden venir en otro orden (OM3 los ordena por
  // CODIGO): se compara por id
  const pasoDe = (d) => Object.fromEntries(d.ambientes.map((a, k) => [a.id, d.nav.paso[k + 1]]))
  const pA = pasoDe(dA), pB = pasoDe(dB)
  totales.rejillas++
  for (const id of Object.keys(pA)) if (pA[id] !== pB[id]) difs.push(`${p.id}:${id} nav.paso: antes ${pA[id]}, ahora ${pB[id]}`)
  for (const k of ['celdas', 'cuarto', 'red', 'vereda', 'banda', 'bandaAdmin', 'escalon', 'dRed']) {
    totales.rejillas++
    const x = dA.nav[k], y = dB.nav[k]
    if (!x || !y || x.length !== y.length || Buffer.compare(Buffer.from(x.buffer, x.byteOffset, x.byteLength), Buffer.from(y.buffer, y.byteOffset, y.byteLength)) !== 0) {
      difs.push(`${p.id}: rejilla nav.${k} distinta`)
    }
  }
  if (!igual([...dA.nav.alcanzable].sort(), [...dB.nav.alcanzable].sort())) difs.push(`${p.id}: ambientes alcanzables distintos`)
  if (!igual([...dA.nav.ventanilla].sort(), [...dB.nav.ventanilla].sort())) difs.push(`${p.id}: ventanillas distintas`)
  if (!igual(dA.murosExtra, dB.murosExtra) || !igual(dA.pasosAbiertos, dB.pasosAbiertos)) difs.push(`${p.id}: pasos o muros distintos`)
}
fs.rmSync(tmp, { recursive: true, force: true })

console.log(`Comparado con ${REF}: ${totales.ambientes} ambientes y ${totales.lugares} lugares (${totales.conNombre} con nombre), `
  + `${totales.entradas} entradas, ${totales.letreros} letreros y ${totales.rejillas} rejillas de navegación.`)
if (difs.length) {
  console.log(`${difs.length} diferencias:`)
  for (const d of difs.slice(0, 200)) console.log(`  - ${d}`)
  process.exit(1)
}
console.log('Sin diferencias: el mapa con el plano vaciado y la configuración de OM3 muestra lo mismo que antes.')

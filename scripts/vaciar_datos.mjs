// Deja el plano del mapa solo con geometría: toda la información de los ambientes (nombres, íconos, categorías,
// solo personal, ventanillas, lugares, nombres de las entradas y letreros) sale de la base de OM3
// (OMN_DBA.OMN_ADM_PLANO_*, GET /api/v1/administracion/mapa/publicado). Ver README → «Datos del mapa».
//
// Uso: node scripts/vaciar_datos.mjs [carpeta] [--nombres]   (reescribe pisos/<piso>/datos.json y config.json del
//   respaldo local; carpeta por defecto: public/sedes/quito/principal)
// --nombres (sedes nuevas, planta_real/pisos/regenerar.sh --sede): antes de vaciar guarda los nombres que trae el DXF
//   en pisos/<piso>/nombres.json ({ "a12": { "nombre": "Consultorio 3", "cat": "consulta" } }); va en el paquete y OM3
//   crea con ellos, al publicar, los ambientes que todavía no tiene. Si el piso no tiene config.json, lo crea vacío.
// Es idempotente: se puede volver a correr sobre un plano ya vaciado. Antes de vaciar un plano regenerado desde el DWG,
// genere la semilla de OM3 desde esta carpeta (OMNIUM_MS_GESTION_HOSPITALARIA: npm run plano:semilla -- <carpeta>).
//
// Qué queda en datos.json:
//   fuente, geo, altura, huella, muros, ventanas, barandas, puertas, trazos_puertas, trazos, muebles, gradas, viseras,
//   nav, parqueos, poi (contexto exterior) y, de cada ambiente: id, cat (solo el tipo estructural: circulacion,
//   espera, escaleras, ascensores o banos; el resto queda «otro» hasta que llega la categoría de OM3), area, pg, lbl,
//   dest (la puerta según el plano) y paso. De cada entrada: id, x, y, fx, fy, ancho.
// Qué queda en config.json: piso, nota, pasos (muros y pasos trazados sobre el plano) y puertasAuto (ids de los
//   cuartos a los que se les abre la puerta que el plano no dibuja).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
// categorías que entienden el mapa y OM3 (CATEGORIAS); otra cualquiera queda «otro»
import { CATEGORIAS } from './plano_estructura.mjs'

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const ES_CLI = !!process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
const ARGS = ES_CLI ? process.argv.slice(2) : []
const PUB = path.resolve(RAIZ, ARGS.find((a) => !a.startsWith('--')) || 'public/sedes/quito/principal')
const leer = (rel) => JSON.parse(fs.readFileSync(path.join(PUB, rel), 'utf8'))
// mismo formato que los escribe planta_real (datos.json compacto; config.json con sangría de 1), con LF
const escribir = (rel, v, sangria) => fs.writeFileSync(path.join(PUB, rel), JSON.stringify(v, null, sangria), 'utf8')

// tipos que el plano necesita para trazar rutas sin OM3: pasillos y halls (paso), escaleras (escalones), ascensores y baños
export const TIPOS_ESTRUCTURALES = ['circulacion', 'espera', 'escaleras', 'ascensores', 'banos']
const CAMPOS_AMBIENTE = ['id', 'cat', 'area', 'pg', 'lbl', 'dest', 'paso']
const CAMPOS_ENTRADA = ['id', 'x', 'y', 'fx', 'fy', 'ancho']
const CAMPOS_CONFIG = ['piso', 'nota', 'pasos', 'puertasAuto']
const NOTA = 'Solo geometría del piso: pasos (muros y pasos trazados) y puertasAuto (ids de cuartos con puerta que el '
  + 'plano no dibuja). Los nombres, categorías, íconos, ventanillas, lugares, entradas y letreros vienen de OM3.'

// «Vestidor Vestidor · Vestidor» → «Vestidor»: rótulos repetidos que el plano deja dos veces en el mismo cuarto
export function limpiarNombre(n) {
  const partes = []
  for (const p of String(n || '').split(' · ')) {
    const q = p.split(/\s+/).filter((w, i, ws) => w && (i === 0 || w.toLowerCase() !== ws[i - 1].toLowerCase())).join(' ')
    if (q && !partes.some((x) => x.toLowerCase() === q.toLowerCase())) partes.push(q)
  }
  return partes.join(' · ')
}

/** Nombres que trae el plano (antes de vaciarlo): { id: { nombre, cat } } de los ambientes con nombre */
export function nombresDelPiso(datos) {
  const out = {}
  for (const a of datos.ambientes || []) {
    const nombre = typeof a.nombre === 'string' ? limpiarNombre(a.nombre.trim()).slice(0, 200) : ''
    if (!nombre || !/^a\d{1,5}$/.test(a.id)) continue
    out[a.id] = { nombre, cat: CATEGORIAS.includes(a.cat) ? a.cat : 'otro' }
  }
  return out
}

const elegir = (o, campos) => Object.fromEntries(campos.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]))
const esId = (s) => /^a\d+$/.test(s)

// nombres finales como los armaba el mapa antes del vaciado (ventanillas → renombres → ajustes): para pasar
// puertasAuto de nombres a ids
function nombresFinales(ambientes, c) {
  const amb = ambientes.map((a) => ({ id: a.id, nombre: a.nombre ?? null, area: a.area }))
  const renombres = (c.renombres || []).map((r) => ({ ...r, re: new RegExp(r.patron) }))
  for (const a of amb) {
    const rn = renombres.find((x) => x.re.test(a.nombre || '') && (x.areaMax == null || a.area < x.areaMax))
    if (!rn) continue
    if ('nombre' in rn) a.nombre = rn.nombre
    else if (rn.sufijo) a.nombre = `${a.nombre}${rn.sufijo}`
  }
  for (const [id, aj] of Object.entries(c.ajustes || {})) {
    const a = amb.find((x) => x.id === id)
    if (!a || a.nombre !== aj.si) continue
    if (typeof aj.nombre === 'string' && aj.nombre.trim()) a.nombre = aj.nombre.trim().slice(0, 80)
    if (aj.oculto === true) a.nombre = null
  }
  return amb
}

export function vaciarPiso(datos, config = {}) {
  const pa = config.puertasAuto || []
  let puertasAuto = pa
  if (pa.some((x) => !esId(x))) {
    const amb = nombresFinales(datos.ambientes, config)
    if (!amb.some((a) => a.nombre)) throw new Error('puertasAuto tiene nombres, pero el plano ya no: no se pueden pasar a ids')
    puertasAuto = [...new Set(pa.flatMap((x) => (esId(x) ? [x] : amb.filter((a) => a.nombre === x).map((a) => a.id))))]
  }
  const { nombre, ambientes, entradas, ...resto } = datos
  const nuevoDatos = {
    ...resto,
    ambientes: ambientes.map((a) => {
      const b = elegir(a, CAMPOS_AMBIENTE)
      b.cat = TIPOS_ESTRUCTURALES.includes(a.cat) ? a.cat : 'otro'
      return b
    }),
    entradas: (entradas || []).map((e) => elegir(e, CAMPOS_ENTRADA)),
  }
  const nuevoConfig = { ...elegir(config, CAMPOS_CONFIG), nota: NOTA, pasos: config.pasos || [], puertasAuto }
  if (!config.piso) delete nuevoConfig.piso
  return { datos: nuevoDatos, config: nuevoConfig }
}

if (ES_CLI) {
  const edificio = leer('edificio.json')
  const conNombres = ARGS.includes('--nombres')
  for (const p of edificio.pisos) {
    if (!p.datos) continue
    if (conNombres) {
      const n = nombresDelPiso(leer(p.datos))
      const rutaN = path.posix.join(path.posix.dirname(p.datos), 'nombres.json')
      // (idempotente: un plano ya vaciado no trae nombres y no borra los que ya se guardaron)
      if (Object.keys(n).length || !fs.existsSync(path.join(PUB, rutaN))) escribir(rutaN, n, 1)
      console.log(`${p.id}: ${Object.keys(n).length} nombres del plano en nombres.json`)
      if (!p.config) {
        p.config = path.posix.join(path.posix.dirname(p.datos), 'config.json')
        if (!fs.existsSync(path.join(PUB, p.config))) escribir(p.config, { pasos: [], puertasAuto: [] }, 1)
      }
    }
    const config = p.config && fs.existsSync(path.join(PUB, p.config)) ? leer(p.config) : {}
    const v = vaciarPiso(leer(p.datos), config)
    escribir(p.datos, v.datos)
    if (p.config) escribir(p.config, v.config, 1)
    console.log(`${p.id}: ${v.datos.ambientes.length} ambientes, ${v.datos.entradas.length} entradas, `
      + `${v.config.pasos.length} pasos, ${v.config.puertasAuto.length} puertas automáticas`)
  }
  if (conNombres) escribir('edificio.json', edificio, 1)
}

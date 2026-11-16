// Arma el paquete (.zip) del dibujo de un edificio para subirlo a OM3 (contrato de planos, fase 1), a partir de lo que
// hoy está publicado en public/: edificio.json, exterior.json y, por piso, datos.json, config.json y los .glb.
// Los archivos van tal cual (no se convierten); solo edificio.json cambia sus rutas a las del paquete (pisos/<CLAVE>/…).
// Antes de escribir se valida la estructura (plano_estructura.mjs); si algo falla no se escribe nada.
//
// Uso: npm run plano:paquete -- --sede 1 --edificio PRINCIPAL [--salida ruta.zip] [--notas "texto"]
//   (sin --salida: plano_<sede>_<edificio>.zip en la carpeta actual)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { escribirZip } from './zip.mjs'
import { validarPaquete, CLAVE, LIMITES } from './plano_estructura.mjs'

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

/**
 * @returns {{ archivos: [string, Buffer][], manifiesto: object }}
 */
export function armarPaquete({ publico = path.join(RAIZ, 'public'), sede, edificio, notas = '', generado = new Date().toISOString() }) {
  const leer = (rel) => fs.readFileSync(path.join(publico, rel))
  const edif = JSON.parse(leer('edificio.json').toString('utf8'))
  const pisos = (edif.pisos || []).filter((p) => p.disponible !== false).sort((a, b) => a.nivel - b.nivel)
  const archivos = []
  const delPiso = []
  const fuentes = new Set()
  const pisosManifiesto = []
  const pisosEdificio = []
  for (const p of pisos) {
    if (!CLAVE.test(p.id)) throw new Error(`La clave del piso ${p.id} no cumple ${CLAVE}`)
    const dir = `pisos/${p.id}`
    const datos = leer(p.datos)
    const d = JSON.parse(datos.toString('utf8'))
    if (d.fuente) fuentes.add(d.fuente)
    delPiso.push([`${dir}/datos.json`, datos])
    const nuevo = { ...p, datos: `${dir}/datos.json` }
    if (p.config && fs.existsSync(path.join(publico, p.config))) {
      delPiso.push([`${dir}/config.json`, leer(p.config)])
      nuevo.config = `${dir}/config.json`
    } else delete nuevo.config
    const glb = [].concat(p.glb ?? []).filter(Boolean).filter((g) => fs.existsSync(path.join(publico, g)))
    for (const g of glb) delPiso.push([`${dir}/${path.posix.basename(g)}`, leer(g)])
    const rutasGlb = glb.map((g) => `${dir}/${path.posix.basename(g)}`)
    if (Array.isArray(p.glb)) nuevo.glb = rutasGlb
    else if (rutasGlb.length) nuevo.glb = rutasGlb[0]
    else delete nuevo.glb
    pisosEdificio.push(nuevo)
    pisosManifiesto.push({ clave: p.id, nombre: p.nombre || p.id, nivel: p.nivel, altura: Number.isFinite(d.altura) ? Math.round(d.altura * 100) : null })
  }
  // pisos que no están disponibles: no van en el paquete ni en edificio.json
  const edificioPaquete = { ...edif, pisos: pisosEdificio }
  const manifiesto = {
    formato: 1,
    sede: Number(sede),
    edificio: String(edificio),
    pisos: pisosManifiesto,
    generado,
    fuente: [...fuentes].join(' | '),
    notas: notas || `Carga inicial desde public/ de hospital-solca (${edif.nombre || 'edificio'})`,
  }
  archivos.push(['manifest.json', Buffer.from(JSON.stringify(manifiesto, null, 1) + '\n')])
  archivos.push(['edificio.json', Buffer.from(JSON.stringify(edificioPaquete, null, 1) + '\n')])
  if (fs.existsSync(path.join(publico, 'exterior.json'))) archivos.push(['exterior.json', leer('exterior.json')])
  archivos.push(...delPiso)
  return { archivos, manifiesto }
}

/** Arma, valida y escribe el zip. Lanza un error con la lista de problemas si no es válido. */
export function generarZip(opciones) {
  const { archivos, manifiesto } = armarPaquete(opciones)
  const zip = escribirZip(archivos)
  const limites = { ...LIMITES, ...(process.env.PLANO_MAX_MB ? { zipMB: Number(process.env.PLANO_MAX_MB) } : {}) }
  const v = validarPaquete(new Map(archivos), { tamanoZip: zip.length, limites })
  if (v.errores.length) {
    const e = new Error(`El paquete no es válido:\n- ${v.errores.join('\n- ')}`)
    e.errores = v.errores
    throw e
  }
  return { zip, archivos, manifiesto, avisos: v.avisos }
}

function argumentos(argv) {
  const o = {}
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i]
    if (!k.startsWith('--')) continue
    o[k.slice(2)] = argv[i + 1]
    i++
  }
  return o
}

const mb = (n) => (n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(2)} MB`)

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = argumentos(process.argv.slice(2))
  if (!a.sede || !a.edificio || !/^\d+$/.test(a.sede)) {
    console.error('Uso: npm run plano:paquete -- --sede 1 --edificio PRINCIPAL [--salida ruta.zip] [--notas "texto"]')
    process.exit(2)
  }
  try {
    const { zip, archivos, avisos } = generarZip({ sede: a.sede, edificio: a.edificio, notas: a.notas })
    const salida = path.resolve(a.salida || `plano_${a.sede}_${a.edificio}.zip`)
    fs.writeFileSync(salida, zip)
    for (const [ruta, b] of archivos) console.log(`${ruta.padEnd(28)} ${mb(b.length).padStart(10)}`)
    for (const x of avisos) console.warn(`Aviso: ${x}`)
    console.log(`\n${salida}\n${archivos.length} archivos · sin comprimir ${mb(archivos.reduce((s, [, b]) => s + b.length, 0))} · zip ${mb(zip.length)}`)
  } catch (e) {
    console.error(e.message)
    process.exit(1)
  }
}

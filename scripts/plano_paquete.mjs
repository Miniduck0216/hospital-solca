// Arma el paquete (.zip) del dibujo de un edificio para subirlo a OM3 (contrato de planos, fase 1): edificio.json,
// exterior.json, techos.json, perfil.json y, por piso, datos.json, config.json, nombres.json y los .glb. Los toma de:
//   - Quito (sede 1): el respaldo local public/sedes/quito/principal/ (ver src/pb/sedes.js);
//   - otra sede: la carpeta de trabajo del pipeline, planta_real/salida_sedes/<sede>/<edificio>/ (la escribe
//     planta_real/pisos/regenerar.sh --sede <s> --edificio <e>; no va en public/: el mapa la lee de OM3);
//   - o la carpeta que se pase con --carpeta.
// Los archivos van tal cual (no se convierten); solo edificio.json cambia sus rutas a las del paquete (pisos/<CLAVE>/…).
// Antes de escribir se valida la estructura (plano_estructura.mjs); si algo falla no se escribe nada.
//
// Uso: npm run plano:paquete -- --sede 1 --edificio PRINCIPAL [--carpeta dir] [--salida ruta.zip] [--notas "texto"]
//   (sin --salida: plano_<sede>_<edificio>.zip en la carpeta actual)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { escribirZip } from './zip.mjs'
import { validarPaquete, CLAVE, LIMITES } from './plano_estructura.mjs'
import { carpetaSede, carpetaEdificio, tieneRespaldo } from '../src/pb/sedes.js'

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

/**
 * @returns {{ archivos: [string, Buffer][], manifiesto: object }}
 */
/**
 * Carpeta de donde sale el dibujo de una sede y edificio de OM3: Quito (1, PRINCIPAL → public/sedes/quito/principal);
 * las demás, la carpeta de trabajo del pipeline (3, PRINCIPAL → planta_real/salida_sedes/santo-domingo/principal).
 */
export function carpetaPublica(sede, edificio) {
  const s = carpetaSede(sede)
  if (!s) throw new Error(`La sede ${sede} no tiene carpeta en src/pb/sedes.js`)
  if (tieneRespaldo(s)) return path.join(RAIZ, 'public', 'sedes', s, carpetaEdificio(edificio))
  return path.join(RAIZ, 'planta_real', 'salida_sedes', s, carpetaEdificio(edificio))
}

export function armarPaquete({ sede, edificio, publico = carpetaPublica(sede, edificio), notas = '', generado = new Date().toISOString() }) {
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
    // nombres que trae el DXF (sedes nuevas): OM3 los usa al publicar para crear los ambientes que aún no existen
    if (fs.existsSync(path.join(publico, path.posix.dirname(p.datos), 'nombres.json'))) {
      delPiso.push([`${dir}/nombres.json`, leer(path.posix.join(path.posix.dirname(p.datos), 'nombres.json'))])
    }
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
    ...(edif.nombre ? { edificioNombre: String(edif.nombre).slice(0, 200) } : {}),
    pisos: pisosManifiesto,
    generado,
    fuente: [...fuentes].join(' | '),
    notas: notas || `Carga inicial desde ${path.relative(RAIZ, publico).split(path.sep).join('/')} de hospital-solca (${edif.nombre || 'edificio'})`,
  }
  archivos.push(['manifest.json', Buffer.from(JSON.stringify(manifiesto, null, 1) + '\n')])
  archivos.push(['edificio.json', Buffer.from(JSON.stringify(edificioPaquete, null, 1) + '\n')])
  // opcionales del edificio: alrededores, techos del 3D y perfil de la planta baja (tal cual)
  for (const f of ['exterior.json', 'techos.json', 'perfil.json']) if (fs.existsSync(path.join(publico, f))) archivos.push([f, leer(f)])
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
    console.error('Uso: npm run plano:paquete -- --sede 1 --edificio PRINCIPAL [--carpeta dir] [--salida ruta.zip] [--notas "texto"]')
    process.exit(2)
  }
  try {
    const { zip, archivos, avisos } = generarZip({ sede: a.sede, edificio: a.edificio, notas: a.notas, ...(a.carpeta ? { publico: path.resolve(a.carpeta) } : {}) })
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

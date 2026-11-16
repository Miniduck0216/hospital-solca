// Paquete del plano para OM3 (npm run plano:paquete) y estructura mínima que se valida antes de escribirlo.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { armarPaquete, generarZip } from '../scripts/plano_paquete.mjs'
import { validarPaquete, validarDatosPiso, clasificarRuta } from '../scripts/plano_estructura.mjs'
import { leerZip } from '../scripts/zip.mjs'

const PUB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public')
const { zip, archivos, manifiesto, avisos } = generarZip({ sede: 1, edificio: 'PRINCIPAL', generado: '2026-11-16T00:00:00Z' })
const mapa = () => new Map(archivos)
const conCambio = (ruta, fn) => {
  const m = mapa()
  const v = JSON.parse(m.get(ruta).toString('utf8'))
  m.set(ruta, Buffer.from(JSON.stringify(fn(v) ?? v)))
  return m
}

test('el paquete trae manifest, edificio, exterior y, por piso, datos, config y .glb (los archivos tal cual)', () => {
  const rutas = archivos.map(([r]) => r)
  assert.deepEqual(rutas.slice(0, 3), ['manifest.json', 'edificio.json', 'exterior.json'])
  for (const c of ['SB', 'PB', 'P1', 'P2', 'P3']) for (const f of ['datos.json', 'config.json']) assert.ok(rutas.includes(`pisos/${c}/${f}`), `${c}/${f}`)
  assert.ok(rutas.includes('pisos/PB/solca_pb_este.glb'))
  const m = new Map(archivos)
  assert.deepEqual(m.get('pisos/PB/datos.json'), fs.readFileSync(path.join(PUB, 'pb', 'datos.json')))
  assert.deepEqual(m.get('pisos/SB/solca_sb.glb'), fs.readFileSync(path.join(PUB, 'sb', 'solca_sb.glb')))
  assert.deepEqual(avisos, [])
})

test('manifest: formato 1, sede, edificio y cada piso con nombre, nivel y altura (cm)', () => {
  assert.equal(manifiesto.formato, 1)
  assert.equal(manifiesto.sede, 1)
  assert.equal(manifiesto.edificio, 'PRINCIPAL')
  assert.deepEqual(manifiesto.pisos.map((p) => [p.clave, p.nivel]), [['SB', -1], ['PB', 0], ['P1', 1], ['P2', 2], ['P3', 3]])
  assert.equal(manifiesto.pisos[1].nombre, 'Planta baja')
  assert.ok(manifiesto.pisos.every((p) => p.altura === 384))
})

test('edificio.json del paquete apunta a pisos/<CLAVE>/… y conserva conectores y tiempos', () => {
  const e = JSON.parse(new Map(archivos).get('edificio.json').toString('utf8'))
  const pub = JSON.parse(fs.readFileSync(path.join(PUB, 'edificio.json'), 'utf8'))
  assert.deepEqual(e.pisos.find((p) => p.id === 'PB').glb, ['pisos/PB/solca_pb.glb', 'pisos/PB/solca_pb_este.glb'])
  assert.equal(e.pisos.find((p) => p.id === 'SB').datos, 'pisos/SB/datos.json')
  assert.deepEqual(e.conectores, pub.conectores)
  assert.deepEqual(e.tiempos, pub.tiempos)
})

test('el zip se lee de vuelta igual y no pasa los límites', () => {
  const z = leerZip(zip)
  assert.equal(z.size, archivos.length)
  for (const [r, b] of archivos) assert.deepEqual(z.get(r).datos, b, r)
  assert.ok(zip.length < 60 * 1024 * 1024)
  assert.deepEqual(validarPaquete(new Map([...z].map(([r, x]) => [r, x.datos])), { tamanoZip: zip.length }).errores, [])
})

test('rutas: solo dentro del paquete, sin .., sin absolutas, solo .json y .glb', () => {
  for (const r of ['../x.json', '/edificio.json', 'C:/x.json', 'pisos/PB/../SB/datos.json', 'pisos/pb/datos.json', 'pisos/PB/x.png', 'pisos/ABCD/datos.json', 'otro.json', 'pisos\\PB\\datos.json']) {
    assert.equal(clasificarRuta(r), null, r)
  }
  assert.deepEqual(clasificarRuta('pisos/P1/solca_p1.glb'), { tipo: 'glb', piso: 'P1' })
})

test('validación: falta un datos.json, clave mal escrita, .glb falso, conector a un piso que no está', () => {
  const sinDatos = mapa(); sinDatos.delete('pisos/P2/datos.json')
  assert.ok(validarPaquete(sinDatos).errores.includes('Falta pisos/P2/datos.json'))
  const clave = conCambio('manifest.json', (m) => { m.pisos[0].clave = 'sb1x' })
  assert.ok(validarPaquete(clave).errores.some((e) => /pisos\[0\]\.clave/.test(e)))
  const glb = mapa(); glb.set('pisos/P1/solca_p1.glb', Buffer.from('no es glb'))
  assert.ok(validarPaquete(glb).errores.includes('pisos/P1/solca_p1.glb no es un .glb (glTF binario)'))
  const con = conCambio('edificio.json', (e) => { e.conectores[0].paradas.push({ piso: 'P9', ambiente: 'a1' }) })
  assert.ok(validarPaquete(con).errores.some((e) => /piso P9/.test(e)))
  const extra = mapa(); extra.set('pisos/P9/datos.json', Buffer.from('{}'))
  assert.ok(validarPaquete(extra).errores.some((e) => /P9 no está en manifest.json/.test(e)))
  const noJson = mapa(); noJson.set('exterior.json', Buffer.from('{'))
  assert.ok(validarPaquete(noJson).errores.includes('exterior.json no es JSON válido'))
})

test('estructura mínima de datos.json: geo, listas, ambientes aN y rejilla nav del tamaño w·h', () => {
  const d = JSON.parse(fs.readFileSync(path.join(PUB, 'p2', 'datos.json'), 'utf8'))
  assert.deepEqual(validarDatosPiso('p2', d).errores, [])
  assert.equal(validarDatosPiso('p2', d).ids.length, d.ambientes.length)
  const malo = structuredClone(d)
  delete malo.geo.ang
  malo.muros = null
  malo.ambientes[0].id = 'x1'
  malo.ambientes[1].pg = []
  malo.nav.w += 1
  const e = validarDatosPiso('p2', malo).errores
  for (const t of ['geo.ang', 'muros debe ser una lista', 'ambientes[0].id', 'ambientes[1].pg', 'nav.celdas debe tener']) assert.ok(e.some((x) => x.includes(t)), t)
  assert.ok(validarDatosPiso('x', []).errores.length)
})

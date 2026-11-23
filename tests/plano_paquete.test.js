// Paquete del plano para OM3 (npm run plano:paquete) y estructura mínima que se valida antes de escribirlo.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { armarPaquete, generarZip, carpetaPublica } from '../scripts/plano_paquete.mjs'
import { validarPaquete, validarDatosPiso, clasificarRuta, validarNombres, CATEGORIAS } from '../scripts/plano_estructura.mjs'
import os from 'node:os'
import { limpiarNombre, nombresDelPiso } from '../scripts/vaciar_datos.mjs'
import { leerZip } from '../scripts/zip.mjs'

const PUB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sedes', 'quito', 'principal')
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
  assert.deepEqual(m.get('pisos/PB/datos.json'), fs.readFileSync(path.join(PUB, 'pisos', 'pb', 'datos.json')))
  assert.deepEqual(m.get('pisos/SB/solca_sb.glb'), fs.readFileSync(path.join(PUB, 'pisos', 'sb', 'solca_sb.glb')))
  assert.deepEqual(avisos, [])
})

test('manifest: formato 1, sede, edificio y cada piso con nombre, nivel y altura (cm)', () => {
  assert.equal(manifiesto.formato, 1)
  assert.equal(manifiesto.sede, 1)
  assert.equal(manifiesto.edificio, 'PRINCIPAL')
  assert.equal(manifiesto.edificioNombre, 'Hospital SOLCA Quito')
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
  const d = JSON.parse(fs.readFileSync(path.join(PUB, 'pisos', 'p2', 'datos.json'), 'utf8'))
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

test('nombres.json (opcional por piso): ids del datos.json, nombre de 1 a 200 caracteres y categoría conocida', () => {
  assert.deepEqual(clasificarRuta('pisos/PB/nombres.json'), { tipo: 'nombres', piso: 'PB' })
  assert.deepEqual(CATEGORIAS, ['consulta', 'espera', 'banos', 'farmacia', 'administracion', 'circulacion', 'apoyo', 'escaleras', 'ascensores', 'otro'])
  const ids = JSON.parse(new Map(archivos).get('pisos/P2/datos.json').toString('utf8')).ambientes.map((a) => a.id)
  const bueno = { [ids[0]]: { nombre: 'Consultorio 3', cat: 'consulta' }, [ids[1]]: { nombre: 'Bodega', cat: 'otro' } }
  const m = mapa(); m.set('pisos/P2/nombres.json', Buffer.from(JSON.stringify(bueno)))
  assert.deepEqual(validarPaquete(m).errores, [])
  const malo = { b1: { nombre: 'x', cat: 'otro' }, a999999: { nombre: 'x', cat: 'otro' }, a99999: { nombre: 'x', cat: 'otro' },
    [ids[0]]: { nombre: '', cat: 'consulta' }, [ids[1]]: { nombre: 'x'.repeat(201), cat: 'vertical' }, [ids[2]]: 'Bodega' }
  const e = validarNombres('pisos/P2/nombres.json', malo, ids)
  for (const t of ['b1: el id', 'a999999: el id', 'a99999: no está', `${ids[0]}.nombre`, `${ids[1]}.nombre`, `${ids[1]}.cat`, `${ids[2]} debe ser`]) assert.ok(e.some((x) => x.includes(t)), t)
  const m2 = mapa(); m2.set('pisos/P2/nombres.json', Buffer.from('[]'))
  assert.ok(validarPaquete(m2).errores.some((x) => x.includes('nombres.json debe ser un objeto')))
  const m3 = mapa(); m3.set('pisos/P9/nombres.json', Buffer.from('{}'))
  assert.ok(validarPaquete(m3).errores.some((x) => /P9 no está en manifest.json/.test(x)))
})

test('manifest: edificioNombre es opcional, texto de 1 a 200 caracteres', () => {
  assert.ok(validarPaquete(conCambio('manifest.json', (x) => { x.edificioNombre = 5 })).errores.some((e) => e.includes('edificioNombre')))
  assert.deepEqual(validarPaquete(conCambio('manifest.json', (x) => { delete x.edificioNombre })).errores, [])
})

test('carpeta de origen: Quito, public/; las demás sedes, la carpeta de trabajo del pipeline (fuera de public/)', () => {
  assert.equal(carpetaPublica(1, 'PRINCIPAL'), PUB)
  assert.equal(carpetaPublica(3, 'PRINCIPAL'), path.join(PUB, '..', '..', '..', '..', 'planta_real', 'salida_sedes', 'santo-domingo', 'principal'))
  assert.equal(carpetaPublica(2, 'PRINCIPAL').split(path.sep).slice(-3).join('/'), 'salida_sedes/imbabura/principal')
  assert.throws(() => carpetaPublica(99, 'PRINCIPAL'), /no tiene carpeta/)
})

test('sede nueva: el paquete sale de la carpeta de trabajo (--carpeta) e incluye nombres.json por piso', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plano-sede-'))
  try {
    fs.mkdirSync(path.join(dir, 'pisos', 'pb'), { recursive: true })
    const d = JSON.parse(fs.readFileSync(path.join(PUB, 'pisos', 'p2', 'datos.json'), 'utf8'))
    fs.writeFileSync(path.join(dir, 'pisos', 'pb', 'datos.json'), JSON.stringify(d))
    fs.writeFileSync(path.join(dir, 'pisos', 'pb', 'nombres.json'), JSON.stringify({ [d.ambientes[0].id]: { nombre: 'Hall', cat: 'circulacion' } }))
    fs.writeFileSync(path.join(dir, 'edificio.json'), JSON.stringify({ nombre: 'Hospital SOLCA Prueba', pisoInicial: 'PB', conectores: [],
      pisos: [{ id: 'PB', nombre: 'Planta baja', corto: 'PB', nivel: 0, disponible: true, datos: 'pisos/pb/datos.json' }] }))
    const r = generarZip({ sede: 3, edificio: 'PRINCIPAL', publico: dir, generado: '2026-11-22T00:00:00Z' })
    assert.deepEqual(r.archivos.map(([x]) => x), ['manifest.json', 'edificio.json', 'pisos/PB/datos.json', 'pisos/PB/nombres.json'])
    assert.equal(r.manifiesto.sede, 3)
    assert.equal(r.manifiesto.edificioNombre, 'Hospital SOLCA Prueba')
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('nombres.json: rótulos repetidos en el mismo cuarto se dicen una vez; categorías fuera de la lista quedan «otro»', () => {
  assert.equal(limpiarNombre('Vestidor Vestidor · Vestidor'), 'Vestidor')
  assert.equal(limpiarNombre('Utileria Limpia · Estacion Enfermería'), 'Utileria Limpia · Estacion Enfermería')
  assert.equal(limpiarNombre('Sshh · SSHH'), 'Sshh')
  const n = nombresDelPiso({ ambientes: [{ id: 'a1', nombre: 'Bodega Bodega', cat: 'apoyo' }, { id: 'a2', nombre: 'Gradas', cat: 'vertical' }, { id: 'a3', nombre: '', cat: 'otro' }] })
  assert.deepEqual(n, { a1: { nombre: 'Bodega', cat: 'apoyo' }, a2: { nombre: 'Gradas', cat: 'otro' } })
})

test('validación como OM3: código del edificio, de 1 a 50 pisos, nivel entre -200 y 200, pasos y puertasAuto listas', () => {
  const ed = validarPaquete(conCambio('manifest.json', (m) => { m.edificio = 'torre b' })).errores
  assert.ok(ed.some((e) => e.includes('edificio debe cumplir')))
  assert.deepEqual(validarPaquete(conCambio('manifest.json', (m) => { m.edificio = 'torre_b-2' })).errores, [])
  const niv = validarPaquete(conCambio('manifest.json', (m) => { m.pisos[0].nivel = 201 })).errores
  assert.ok(niv.some((e) => e.includes('entre -200 y 200')))
  const muchos = validarPaquete(conCambio('manifest.json', (m) => { m.pisos = Array.from({ length: 51 }, (_, i) => ({ clave: `X${i}`, nombre: 'x', nivel: i })) })).errores
  assert.ok(muchos.some((e) => e.includes('a lo sumo 50 pisos')))
  const cfg = validarPaquete(conCambio('pisos/PB/config.json', (c) => { c.pasos = {}; c.puertasAuto = 'a1' })).errores
  assert.ok(cfg.some((e) => e.includes('pasos debe ser una lista')) && cfg.some((e) => e.includes('puertasAuto debe ser una lista')))
})

test('techos.json y perfil.json (opcionales) van en el paquete tal cual y se validan como en OM3', () => {
  const rutas = archivos.map(([r]) => r)
  assert.ok(rutas.includes('techos.json') && rutas.includes('perfil.json'))
  assert.deepEqual(new Map(archivos).get('techos.json'), fs.readFileSync(path.join(PUB, 'techos.json')))
  assert.deepEqual(clasificarRuta('techos.json'), { tipo: 'techos' })
  assert.deepEqual(clasificarRuta('perfil.json'), { tipo: 'perfil' })
  const t = mapa(); t.set('techos.json', Buffer.from('[]'))
  assert.ok(validarPaquete(t).errores.includes('techos.json debe ser un objeto'))
  const p = mapa(); p.set('perfil.json', Buffer.from('{"huella":{}}'))
  assert.ok(validarPaquete(p).errores.includes('perfil.json debe ser un objeto con huella (lista)'))
  const sin = mapa(); sin.delete('techos.json'); sin.delete('perfil.json')
  assert.deepEqual(validarPaquete(sin).errores, [])
})

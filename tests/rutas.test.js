// Pruebas de rutas sobre el plano real (node --test). Ejecutar: npm test
import './fetchPublic.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cargarDatos, usarGeo, ambienteEn } from '../src/pb/datos.js'
import { buscarRuta, metrosHasta } from '../src/pb/ruta.js'
import { elegirConector, rutaEdificio, segundosVerticales } from '../src/pb/rutaEdificio.js'

const d = await cargarDatos()
usarGeo(d.geo)
const puerta1 = d.entradas.find((e) => e.id === 'entrada-puerta-1')
const P1 = { id: puerta1.id, punto: [puerta1.x, puerta1.y] }
const amb = (id) => d.ambientes.find((a) => a.id === id)
const destinos = d.ambientes.filter((a) => a.nombre && a.dest && !a.personal)

test('desde Puerta 1 hay ruta a todos los lugares de pacientes (salvo personal o servicio)', () => {
  const sin = destinos.filter((a) => !buscarRuta(d, P1.punto, a.dest, [P1.id, a.id])).map((a) => a.nombre)
  assert.deepEqual(sin.sort(), ['Abastecimiento', 'Ducto Sanitario'])
})

test('las rutas no cruzan la farmacia ni pasan por pasillos de bloque', () => {
  for (const a of destinos) {
    const r = buscarRuta(d, P1.punto, a.dest, [P1.id, a.id])
    if (!r) continue
    for (const p of r.pts) {
      const b = ambienteEn(d, p)
      if (a.nombre !== 'Farmacia') assert.notEqual(b?.nombre, 'Farmacia', `${a.nombre} cruza la farmacia`)
    }
  }
})

test('Farmacia, Tesorería y los 5 módulos terminan frente a su ventanilla', () => {
  for (const id of ['a4', 'a61', 'a100', 'a102', 'a103', 'a101', 'a104']) {
    const a = amb(id)
    const r = buscarRuta(d, P1.punto, a.dest, [P1.id, a.id])
    assert.ok(r, a.nombre)
    const fin = r.pts[r.pts.length - 1]
    assert.ok(Math.hypot(fin[0] - a.dest[0], fin[1] - a.dest[1]) < 0.6, `${a.nombre} termina lejos de su ventanilla`)
  }
})

test('metrosHasta mide en una sola búsqueda lo mismo que el A* hasta cada ascensor y escalera', () => {
  const paradas = ['a73', 'a75', 'a76', 'a21', 'a72']
  const m = metrosHasta(d, P1.punto, P1.id, paradas)
  for (const id of paradas) {
    const r = buscarRuta(d, P1.punto, amb(id).dest, [P1.id, id])
    assert.ok(m[id] != null && r, id)
    // el A* suaviza y acorta esquinas; la búsqueda por celdas mide un poco más
    assert.ok(Math.abs(m[id] - r.metros) / r.metros < 0.25, `${id}: ${m[id].toFixed(1)} vs ${r.metros.toFixed(1)}`)
  }
})

test('ruta accesible: no pisa escalones ni entra a las escaleras', () => {
  let conRuta = 0
  for (const a of destinos) {
    if (a.cat === 'escaleras') continue
    const r = buscarRuta(d, P1.punto, a.dest, [P1.id, a.id], { accesible: true })
    if (!r) continue
    conRuta++
    for (const p of r.pts) assert.notEqual(ambienteEn(d, p)?.cat, 'escaleras', `${a.nombre} pasa por una escalera`)
  }
  assert.ok(conRuta >= destinos.length - 8, `solo ${conRuta} de ${destinos.length} con ruta accesible`)
})

// ---- entre pisos: elección del conector con distancias inventadas
const EDIF = {
  pisos: [{ id: 'PB', nivel: 0 }, { id: 'P2', nivel: 2 }],
  tiempos: { velocidadMs: 1.2, ascensorEsperaS: 45, ascensorPorPisoS: 5, escaleraPorPisoS: 15 },
  conectores: [
    { id: 'asc', tipo: 'ascensor', nombre: 'Ascensores del Hall', accesible: true, paradas: [{ piso: 'PB', ambiente: 'A' }, { piso: 'P2', ambiente: 'A2' }] },
    { id: 'esc', tipo: 'escalera', nombre: 'Escalera', accesible: false, paradas: [{ piso: 'PB', ambiente: 'E' }, { piso: 'P2', ambiente: 'E2' }] },
  ],
}
const O = { piso: 'PB' }, D = { piso: 'P2' }

test('por defecto usa el ascensor aunque la escalera sea más rápida, y ofrece la escalera como alternativa', () => {
  const r = elegirConector({ edificio: EDIF, origen: O, destino: D, metrosOrigen: { A: 60, E: 20 }, metrosDestino: { A2: 10, E2: 10 } })
  assert.equal(r.elegida.tipo, 'ascensor')
  assert.equal(r.alternativa.tipo, 'escalera')
  assert.ok(r.alternativa.segundos < r.elegida.segundos)
  assert.equal(r.aviso, null)
})

test('con via=escalera usa la escalera; con cualquiera, lo más rápido', () => {
  const base = { edificio: EDIF, origen: O, destino: D, metrosOrigen: { A: 60, E: 20 }, metrosDestino: { A2: 10, E2: 10 } }
  assert.equal(elegirConector({ ...base, via: 'escalera' }).elegida.tipo, 'escalera')
  assert.equal(elegirConector({ ...base, via: 'cualquiera' }).elegida.tipo, 'escalera')
})

test('accesible: solo ascensor, sin alternativa por escaleras; si no hay ascensor, no hay ruta', () => {
  const r = elegirConector({ edificio: EDIF, origen: O, destino: D, accesible: true, metrosOrigen: { A: 60, E: 20 }, metrosDestino: { A2: 10, E2: 10 } })
  assert.equal(r.elegida.tipo, 'ascensor')
  assert.equal(r.alternativa, null)
  const sinAsc = elegirConector({ edificio: EDIF, origen: O, destino: D, accesible: true, metrosOrigen: { E: 20 }, metrosDestino: { E2: 10 } })
  assert.equal(sinAsc.elegida, null)
  assert.match(sinAsc.aviso, /accesible/)
})

test('si el ascensor no llega a ese piso, usa la escalera y lo avisa', () => {
  const r = elegirConector({ edificio: EDIF, origen: O, destino: D, metrosOrigen: { E: 20 }, metrosDestino: { E2: 10 } })
  assert.equal(r.elegida.tipo, 'escalera')
  assert.match(r.aviso, /escalera/)
})

test('tiempo vertical: ascensor = espera + piso; escalera = por piso', () => {
  assert.equal(segundosVerticales('ascensor', 2, EDIF.tiempos), 55)
  assert.equal(segundosVerticales('escalera', -2, EDIF.tiempos), 30)
})

test('ruta de dos pisos sobre el plano real (planta baja usada como piso de prueba)', () => {
  // edificio de prueba: «P2» es una copia de la planta baja, con ascensores y escaleras en el mismo lugar
  const conectores = [
    { id: 'hall', tipo: 'ascensor', nombre: 'Ascensores del Hall', accesible: true, paradas: [{ piso: 'PB', ambiente: 'a73' }, { piso: 'P2', ambiente: 'a73' }] },
    { id: 'norte', tipo: 'ascensor', nombre: 'Ascensores norte', accesible: true, paradas: [{ piso: 'PB', ambiente: 'a75' }, { piso: 'P2', ambiente: 'a75' }] },
    { id: 'esc', tipo: 'escalera', nombre: 'Escalera', accesible: false, paradas: [{ piso: 'PB', ambiente: 'a21' }, { piso: 'P2', ambiente: 'a21' }] },
  ]
  const edificio = { ...EDIF, conectores }
  const dest = amb('a23') // Ginecología · 4
  const args = { edificio, pisos: { PB: d, P2: d }, origen: { piso: 'PB', ...P1 }, destino: { piso: 'P2', id: dest.id, punto: dest.dest }, buscar: buscarRuta, medir: metrosHasta }
  const r = rutaEdificio(args)
  assert.equal(r.tramos.length, 2)
  assert.equal(r.vertical.tipo, 'ascensor')
  assert.match(r.vertical.texto, /suba/)
  assert.ok(r.alternativa && r.alternativa.tipo === 'escalera')
  const e = rutaEdificio({ ...args, via: 'escalera' })
  assert.equal(e.vertical.tipo, 'escalera')
  const acc = rutaEdificio({ ...args, accesible: true })
  assert.equal(acc.vertical.tipo, 'ascensor')
  assert.equal(acc.alternativa, null)
})

test('se puede partir desde cualquier lugar de pacientes («Estoy aquí»), también desde un consultorio', () => {
  const sin = destinos.filter((a) => !buscarRuta(d, a.dest, P1.punto, [a.id, P1.id])).map((a) => a.nombre)
  assert.deepEqual(sin.sort(), ['Abastecimiento', 'Ducto Sanitario'])
})

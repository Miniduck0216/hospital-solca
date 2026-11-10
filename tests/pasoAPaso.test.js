// Pruebas del «paso a paso» (node --test). Ejecutar: npm test
import './fetchPublic.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cargarDatos, cargarEdificio, usarGeo } from '../src/pb/datos.js'
import { buscarRuta, indicaciones, metrosHasta } from '../src/pb/ruta.js'
import { rutaEdificio } from '../src/pb/rutaEdificio.js'
import { listaPasos, puntoEn } from '../src/pb/pasoAPaso.js'

const cerca = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-9

test('puntoEn: inicio, mitad de un segmento, una esquina y recorte a los extremos', () => {
  const L = [[0, 0], [10, 0], [10, 5]]
  assert.ok(cerca(puntoEn(L, 0), [0, 0]))
  assert.ok(cerca(puntoEn(L, 4), [4, 0]))
  assert.ok(cerca(puntoEn(L, 10), [10, 0]))
  assert.ok(cerca(puntoEn(L, 12.5), [10, 2.5]))
  assert.ok(cerca(puntoEn(L, -3), [0, 0]), 'antes del inicio: el primer punto')
  assert.ok(cerca(puntoEn(L, 99), [10, 5]), 'más allá del final: el último punto')
  assert.ok(cerca(puntoEn(L, Infinity), [10, 5]))
  assert.ok(cerca(puntoEn([[3, 4]], 7), [3, 4]), 'un solo punto')
  assert.equal(puntoEn([], 1), null)
})

test('listaPasos de Puerta 1 → una habitación del piso 3: puntos dentro de cada piso y un paso vertical', async () => {
  const d = await cargarDatos()
  usarGeo(d.geo)
  const edificio = await cargarEdificio()
  const pisos = { PB: d }
  for (const p of edificio.pisos) if (p.id !== 'PB' && p.disponible) pisos[p.id] = await cargarDatos(null, { pisoId: p.id })
  const puerta1 = d.entradas.find((e) => e.id === 'entrada-puerta-1')
  const hab = pisos.P3.ambientes.find((a) => /^Hab/.test(a.nombre) && a.dest && !a.personal)
  const r = rutaEdificio({
    edificio, pisos, buscar: buscarRuta, medir: metrosHasta,
    origen: { piso: 'PB', id: puerta1.id, punto: [puerta1.x, puerta1.y] },
    destino: { piso: 'P3', id: hab.id, punto: hab.dest },
  })
  assert.ok(r && !r.sinRuta, 'sin ruta')
  // los pasos de cada tramo, armados como en App.jsx
  const n = r.tramos.length
  const nombre = r.vertical?.conector?.nombre || 'el ascensor'
  const tramos = r.tramos.map((t, k) => {
    const pasos = indicaciones(pisos[t.piso], t, k === 0 ? { id: puerta1.id, nombre: 'Puerta 1' } : { id: '', nombre }, k === n - 1 ? hab : { id: '', nombre })
    if (k < n - 1) pasos[pasos.length - 1] = { tipo: 'fin', texto: `Llega a ${nombre}` }
    return { ...t, pasos }
  })
  const ruta = { ...r, tramos }
  const lista = listaPasos(ruta)
  // mismo número de pasos que la lista del panel de ruta
  assert.equal(lista.length, tramos.reduce((m, t, k) => m + t.pasos.length - (k > 0 ? 1 : 0), 1))
  assert.deepEqual([...new Set(lista.map((p) => p.piso))], ['PB', 'P3'])
  for (const p of lista) {
    const h = pisos[p.piso].huella.flatMap((pg) => pg[0])
    const xs = h.map((q) => q[0]), ys = h.map((q) => q[1])
    assert.ok(Array.isArray(p.punto) && p.punto.every(Number.isFinite), `${p.texto}: sin punto`)
    assert.ok(p.punto[0] >= Math.min(...xs) - 1 && p.punto[0] <= Math.max(...xs) + 1 && p.punto[1] >= Math.min(...ys) - 1 && p.punto[1] <= Math.max(...ys) + 1,
      `${p.texto} (${p.piso}) cae fuera del piso`)
  }
  const verticales = lista.filter((p) => p.tipo === 'ascensor' || p.tipo === 'escalera')
  assert.equal(verticales.length, 1)
  const v = verticales[0]
  assert.equal(v.piso, 'PB')
  assert.equal(v.texto, r.vertical.texto)
  assert.ok(cerca(v.punto, tramos[0].pts[tramos[0].pts.length - 1]), 'el cambio de piso es al final del primer tramo')
  // el paso vertical va justo después de los del primer tramo; el primero de la lista es la salida
  assert.equal(lista.indexOf(v), tramos[0].pasos.length)
  assert.equal(lista[0].tipo, 'inicio')
  assert.equal(lista[lista.length - 1].tipo, 'fin')
})

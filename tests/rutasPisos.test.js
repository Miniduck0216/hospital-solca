// Rutas a otros pisos (node --test): desde la Puerta 1 se llega a los ambientes de todos los pisos por el ascensor (o la
// escalera), con un tramo hasta la parada del piso de salida y otro desde la parada del piso de llegada hasta el
// destino. El fin del primer tramo se marca con «Sube a …» / «Baja a …» (siguientePiso), no con el destino.
import './fetchPublic.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cargarDatos, cargarEdificio, usarGeo } from '../src/pb/datos.js'
import { buscarRuta, metrosHasta } from '../src/pb/ruta.js'
import { rutaEdificio, paradaEn, siguientePiso, destinoMasCercano } from '../src/pb/rutaEdificio.js'

const edificioBase = await cargarEdificio()
const pisos = {}
for (const p of edificioBase.pisos.filter((x) => x.disponible)) pisos[p.id] = await cargarDatos(null, { pisoId: p.id })
usarGeo(pisos.PB.geo)
const edificio = pisos.PB.edificio
const p1 = pisos.PB.entradas.find((e) => e.id === 'entrada-puerta-1')
const ORIGEN = { piso: 'PB', punto: [p1.x, p1.y], id: p1.id }
const destinos = (pid) => pisos[pid].ambientes.filter((a) => a.nombre && a.dest && !a.personal && !a.oculto && !a.eliminado)
const ir = (pid, a, via) => rutaEdificio({ edificio, pisos, origen: ORIGEN, destino: { piso: pid, punto: a.dest, id: a.id }, via, buscar: buscarRuta, medir: metrosHasta })

// ¿el punto está a 1 m o menos de una celda del cuarto del ambiente?
const tocaCuarto = (d, [x, y], id) => {
  const n = d.nav, q = n.indice[id]
  const cx = Math.round((x - n.x0) / n.res), cy = Math.round((y - n.y0) / n.res)
  for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) if (q && n.cuarto[(cy + dy) * n.w + cx + dx] === q) return true
  return false
}

// sin ruta por los datos del plano: la escalera de emergencia (P1 a53, P2 a13, P3 a19) solo une P1, P2 y P3 y no tiene
// paso abierto al resto de su piso; el pasillo a82 del Piso 1 está aislado del resto de la franja
const SIN_RUTA = { P1: ['a53', 'a82'], P2: ['a13'], P3: ['a19'] }

test('desde la Puerta 1 se llega a todos los ambientes de los otros pisos: tramo hasta el conector y tramo hasta el destino', () => {
  const informe = {}
  for (const pid of Object.keys(pisos).filter((x) => x !== 'PB')) {
    const malas = []
    let llegan = 0
    for (const a of destinos(pid)) {
      const r = ir(pid, a)
      if (SIN_RUTA[pid]?.includes(a.id)) { assert.ok(!r || r.sinRuta, `${pid}:${a.id} ahora tiene ruta: quitarlo de SIN_RUTA`); continue }
      if (!r || r.sinRuta) { malas.push(`${pid}:${a.id} ${a.nombre}: ${r?.aviso || 'sin ruta'}`); continue }
      assert.equal(r.tramos.length, 2, `${pid}:${a.id}`)
      const [t1, t2] = r.tramos
      assert.equal(t1.piso, 'PB')
      assert.equal(t2.piso, pid)
      // el primer tramo empieza en la Puerta 1; el segundo empieza en la parada del mismo conector en el piso de llegada
      assert.ok(Math.hypot(t1.pts[0][0] - p1.x, t1.pts[0][1] - p1.y) < 1, `${pid}:${a.id} no sale de la Puerta 1`)
      const c = r.vertical.conector
      assert.ok(paradaEn(c, 'PB') && paradaEn(c, pid), `${pid}:${a.id}: ${c.id} no une PB y ${pid}`)
      // el último punto queda en el destino (a menos de 3 m) o en su puerta (a 1 m del cuarto del destino)
      const u = t2.pts[t2.pts.length - 1]
      assert.ok(Math.hypot(u[0] - a.dest[0], u[1] - a.dest[1]) < 3 || tocaCuarto(pisos[pid], u, a.id), `${pid}:${a.id} termina lejos del destino`)
      assert.ok(r.metros > 0 && r.segundos > 0)
      llegan++
    }
    informe[pid] = llegan
    assert.deepEqual(malas, [], `${pid}`)
  }
  // Subsuelo 95, Piso 1 105, Piso 2 62, Piso 3 71 (con los datos de public/ y la configuración de OM3 de prueba)
  assert.ok(informe.SB >= 95 && informe.P1 >= 105 && informe.P2 >= 62 && informe.P3 >= 71, JSON.stringify(informe))
})

test('ruta a otro piso por la escalera también llega (via=escalera)', () => {
  const a = destinos('P1').find((x) => x.nombre === 'Hab 109')
  const r = ir('P1', a, 'escalera')
  assert.equal(r.vertical.tipo, 'escalera')
  assert.equal(r.tramos.length, 2)
})

test('siguientePiso: el fin del tramo de salida dice a qué piso se sube o se baja', () => {
  const a = destinos('P1').find((x) => x.nombre === 'Hab 109')
  const r = ir('P1', a)
  assert.deepEqual(siguientePiso(r, 'PB', pisos), { piso: 'P1', tipo: 'ascensor', texto: `Sube a ${pisos.P1.piso.corto || 'P1'}` })
  assert.equal(siguientePiso(r, 'P1', pisos), null)   // último tramo: termina en el destino
  const b = destinos('SB')[0]
  const rb = ir('SB', b)
  assert.match(siguientePiso(rb, 'PB', pisos).texto, /^Baja a /)
  assert.equal(siguientePiso(null, 'PB', pisos), null)
  assert.equal(siguientePiso({ tramos: [{ piso: 'PB' }] }, 'PB', pisos), null)
})

test('tótem con varios destinos en otros pisos (destinos=): elige uno y la ruta llega en dos tramos', () => {
  const cands = ['P1', 'P2'].map((pid) => { const a = destinos(pid).find((x) => /^Hab/.test(x.nombre)); return { piso: pid, id: a.id, punto: a.dest } })
  const r = destinoMasCercano({ edificio, pisos, origen: ORIGEN, candidatos: cands, buscar: buscarRuta, medir: metrosHasta })
  assert.ok(r)
  assert.equal(r.ruta.tramos.length, 2)
  assert.equal(r.ruta.tramos[1].piso, cands[r.indice].piso)
})

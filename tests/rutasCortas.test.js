// Rutas cortas (node --test): la ruta corta por los halls y las salas de espera cuando eso ahorra camino, sin cruzar
// muros ni cuartos cerrados, y el mapa elige el más cercano entre varios destinos posibles (?destinos=, mapa-ir).
import './fetchPublic.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cargarDatos, usarGeo } from '../src/pb/datos.js'
import { buscarRuta, metrosHasta } from '../src/pb/ruta.js'
import { destinoMasCercano, listaDestinos } from '../src/pb/rutaEdificio.js'
import { revisar } from '../scripts/medir_rutas.mjs'

const d = await cargarDatos()
usarGeo(d.geo)
const puerta1 = d.entradas.find((e) => e.id === 'entrada-puerta-1')
const P1 = { id: puerta1.id, punto: [puerta1.x, puerta1.y] }
const amb = (id) => d.ambientes.find((a) => a.id === id)
const ruta = (id) => buscarRuta(d, P1.punto, amb(id).dest, [P1.id, id])

// largo máximo desde la Puerta 1 (antes del cambio entre paréntesis)
const TOPES = {
  a142: 52,   // Espera · Secretaría · Información (120,4 m: daba la vuelta por el Pasillo Central)
  a345: 47,   // Cajas 1 · Planta Baja (49,2 m)
  a124: 75,   // Laboratorio Clínico (75,1 m)
  a110: 56,   // Imagen (57,1 m)
  a4: 16,     // Farmacia (15,3 m)
  a16: 9,     // RPIS (8,1 m)
}

test('desde la Puerta 1, las rutas más pedidas no pasan de su largo esperado', () => {
  for (const [id, tope] of Object.entries(TOPES)) {
    const r = ruta(id)
    assert.ok(r, `${amb(id).nombre} sin ruta`)
    assert.ok(r.metros <= tope, `${amb(id).nombre}: ${r.metros.toFixed(1)} m (tope ${tope} m)`)
  }
})

test('Puerta 1 → Espera · Secretaría · Información entra por su puerta del pasillo, no rodea por el Pasillo Central', () => {
  const r = ruta('a142')
  // el vano de la puerta (un cuarto chico sin nombre entre el pasillo y la sala de espera) ahora es paso
  assert.equal(d.nav.paso[d.nav.indice.a409], 1)
  // la ruta no baja hasta el Pasillo Central (y ≈ 75) ni pasa por el pasillo del fondo (x ≈ 113)
  assert.ok(r.pts.every(([x, y]) => y < 70 && x < 95), 'la ruta da la vuelta')
})

// Cruces que quedan (en main eran 54 rutas con cruces, varias de 3 a 5 m). Los baños de minusválidos están dentro de
// los SS.HH. generales: la ruta pasa por ellos a propósito. Los de 0,3 a 0,4 m son el borde de un vano rozado por la
// curva de un giro. Quedan por corregir SS.HH. (a306) e Información · Secretaría de Quimioterapia. Se toleran estos
// con su largo actual; un cruce nuevo, o uno que crezca, hace fallar la prueba.
const CRUCES_CONOCIDOS = {
  a90: { 'cuarto: SS.HH. Mujeres': 9.1 },
  a91: { 'cuarto: SS.HH. Hombres': 8.6 },
  a154: { muro: 0.3 }, a160: { muro: 0.3 }, a176: { muro: 0.3 }, a177: { muro: 0.3 }, a186: { muro: 0.3 },
  a230: { muro: 0.3 }, a347: { muro: 0.4 }, a386: { muro: 0.3 }, a401: { muro: 0.3 },
  a306: { muro: 1.4 },
  'L-pb-quimio-informacion': { muro: 1.8 },
}

test('las rutas desde la Puerta 1 no atraviesan muros, cuartos cerrados ni áreas del personal (salvo los cruces conocidos)', () => {
  const destinos = d.ambientes.filter((a) => a.nombre && a.dest && !a.personal)
  const malas = []
  for (const a of destinos) {
    const r = buscarRuta(d, P1.punto, a.dest, [P1.id, a.id])
    if (!r) continue
    const f = revisar(d, r.pts, P1.id, a.id).filter((txt) => {
      const [, falla, m] = txt.match(/^(.*) \(([\d.]+) m\)$/)
      const tope = CRUCES_CONOCIDOS[a.id]?.[falla]
      return tope === undefined || Number(m) > tope + 0.05
    })
    if (f.length) malas.push(`${a.id} ${a.nombre}: ${f.join('; ')}`)
  }
  assert.deepEqual(malas, [])
})

test('desde un cuarto, la línea sale por su puerta (no cruza el muro del cuarto de origen)', () => {
  // Baño (a362) → Gastroenterología: antes salía recta del punto de acceso y atravesaba el muro
  for (const [o, t] of [['a362', 'a116'], ['a181', 'a257'], ['a277', 'a40']]) {
    const r = buscarRuta(d, amb(o).dest, amb(t).dest, [o, t])
    assert.ok(r, `${o} → ${t}`)
    assert.deepEqual(revisar(d, r.pts, o, t), [], `${amb(o).nombre} → ${amb(t).nombre}`)
  }
})

test('listaDestinos: ids separados por coma o en un arreglo, sin vacíos ni repetidos', () => {
  assert.deepEqual(listaDestinos('a12, P1:a7,,entrada-puerta-4,a12'), ['a12', 'P1:a7', 'entrada-puerta-4'])
  assert.deepEqual(listaDestinos(['a142', ' L-pb-quimio-informacion ', 7, null]), ['a142', 'L-pb-quimio-informacion'])
  assert.deepEqual(listaDestinos(null), [])
  assert.deepEqual(listaDestinos(''), [])
})

const EDIF = { tiempos: { velocidadMs: 1.2, ascensorEsperaS: 45, ascensorPorPisoS: 5, escaleraPorPisoS: 15 } }
const punto = (id) => {
  const a = amb(id)
  if (a) return { piso: 'PB', id, punto: a.dest }
  const l = d.ambientes.find((x) => x.id === id)
  return { piso: 'PB', id, punto: l.dest }
}

test('destinoMasCercano: entre las dos Información de la planta baja elige la de la ruta más corta', () => {
  const cands = [punto('L-pb-quimio-informacion'), punto('a142')]
  const r = destinoMasCercano({ edificio: EDIF, pisos: { PB: d }, origen: { piso: 'PB', ...P1 }, candidatos: cands, buscar: buscarRuta, medir: metrosHasta })
  assert.equal(cands[r.indice].id, 'a142')
  assert.ok(Math.abs(r.ruta.metros - ruta('a142').metros) < 0.01)
  // el orden de los candidatos no cambia la elección
  const r2 = destinoMasCercano({ edificio: EDIF, pisos: { PB: d }, origen: { piso: 'PB', ...P1 }, candidatos: cands.slice().reverse(), buscar: buscarRuta, medir: metrosHasta })
  assert.equal(cands.slice().reverse()[r2.indice].id, 'a142')
})

test('destinoMasCercano: el baño más cercano de la Puerta 1, entre varios', () => {
  const banos = ['a54', 'a55', 'a77', 'a421', 'a362']
  const r = destinoMasCercano({ edificio: EDIF, pisos: { PB: d }, origen: { piso: 'PB', ...P1 }, candidatos: banos.map(punto), buscar: buscarRuta, medir: metrosHasta })
  const largos = Object.fromEntries(banos.map((id) => [id, ruta(id).metros]))
  const mejor = banos.reduce((m, id) => (largos[id] < largos[m] ? id : m))
  assert.equal(banos[r.indice], mejor)
})

test('destinoMasCercano: cuenta el cambio de piso (un candidato arriba, aunque esté a pocos metros, pierde)', () => {
  // edificio de prueba: «P2» es una copia de la planta baja; el candidato de arriba está en el mismo lugar que RPIS
  const edificio = {
    ...EDIF,
    pisos: [{ id: 'PB', nivel: 0 }, { id: 'P2', nivel: 2 }],
    conectores: [{ id: 'hall', tipo: 'ascensor', nombre: 'Ascensores del Hall', accesible: true, paradas: [{ piso: 'PB', ambiente: 'a73' }, { piso: 'P2', ambiente: 'a73' }] }],
  }
  const arriba = { piso: 'P2', id: 'a16', punto: amb('a16').dest }
  const abajo = punto('a110')   // Imagen, 55 m en la misma planta
  const r = destinoMasCercano({ edificio, pisos: { PB: d, P2: d }, origen: { piso: 'PB', ...P1 }, candidatos: [arriba, abajo], buscar: buscarRuta, medir: metrosHasta })
  assert.equal(r.indice, 1)
  assert.equal(r.ruta.tramos.length, 1)
  // sin candidatos con ruta: null
  assert.equal(destinoMasCercano({ edificio, pisos: { PB: d }, origen: { piso: 'PB', ...P1 }, candidatos: [{ piso: 'P3', id: 'x', punto: [0, 0] }], buscar: buscarRuta, medir: metrosHasta }), null)
})

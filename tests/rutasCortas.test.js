// Rutas cortas (node --test): la ruta corta por los halls y las salas de espera cuando eso ahorra camino, sin cruzar
// muros ni cuartos cerrados, y el mapa elige el más cercano entre varios destinos posibles (?destinos=, mapa-ir).
import './fetchPublic.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cargarDatos, usarGeo } from '../src/pb/datos.js'
import { buscarRuta, metrosHasta } from '../src/pb/ruta.js'
import { destinoMasCercano, listaDestinos } from '../src/pb/rutaEdificio.js'
import { revisar, holguraMuros } from '../scripts/medir_rutas.mjs'
import { puntosRuta, PASO_RUTA, CADA } from '../src/pb/puntosRuta.js'

const d = await cargarDatos()
usarGeo(d.geo)
const puerta1 = d.entradas.find((e) => e.id === 'entrada-puerta-1')
const P1 = { id: puerta1.id, punto: [puerta1.x, puerta1.y] }
const amb = (id) => d.ambientes.find((a) => a.id === id)
const ruta = (id) => buscarRuta(d, P1.punto, amb(id).dest, [P1.id, id])

// largo máximo desde la Puerta 1 (antes de «rutas cortas» entre paréntesis). Las rutas por el centro de los pasillos
// son entre 0 y 1,5 m más largas que las que rozaban las paredes (Imagen 55,3 → 56,3 m; Cajas 1 45,2 → 46,7 m).
const TOPES = {
  a142: 52,   // Espera · Secretaría · Información (120,4 m: daba la vuelta por el Pasillo Central)
  a345: 48,   // Cajas 1 · Planta Baja (49,2 m)
  a124: 76,   // Laboratorio Clínico (75,1 m)
  a110: 57.5, // Imagen (57,1 m)
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

// Cruces que se toleran: ninguno. Antes de las rutas por el centro de los pasillos quedaban 13 (rozaban el borde de un
// vano en la curva de un giro, o la ventanilla de SS.HH. e Información · Secretaría de Quimioterapia está marcada
// sobre el mostrador y la línea lo atravesaba hasta el punto). Los baños de minusválidos tienen su puerta dentro de los
// SS.HH. generales: revisar no cuenta ese cuarto (antesala del destino).
const CRUCES_CONOCIDOS = {}

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

// ---------- rutas por el centro de los pasillos y trazo en pasos

// destinos de «Ruta a Cajas» del tótem: los candidatos de caja que OM3 manda en ?destinos= (sede 1). Cajas 2 · Planta
// Baja (a374) no tiene punto de llegada en el plano y no entra en la elección.
const CAJAS = ['a19', 'a345', 'a6', 'a61']
const ORIGENES_TOTEM = [['entrada-puerta-1', P1.punto], ['a5', amb('a5').dest]]   // Puerta 1 y Hall Puerta 1 · Información

test('Ruta a Cajas desde el tótem: cada candidato y el más cercano van por el centro, sin cruzar muros', () => {
  for (const [oid, o] of ORIGENES_TOTEM) {
    const cands = CAJAS.map((id) => ({ piso: 'PB', id, punto: amb(id).dest }))
    const cerca = destinoMasCercano({ edificio: EDIF, pisos: { PB: d }, origen: { piso: 'PB', id: oid, punto: o }, candidatos: cands, buscar: buscarRuta, medir: metrosHasta })
    assert.ok(cerca, `${oid}: sin caja más cercana`)
    for (const id of CAJAS) {
      const r = buscarRuta(d, o, amb(id).dest, [oid, id])
      assert.ok(r, `${oid} → ${id} sin ruta`)
      assert.deepEqual(revisar(d, r.pts, oid, id), [], `${oid} → ${amb(id).nombre}`)
      // a más de 45 cm de los muros dibujados (salvo el primer y el último metro: la puerta)
      const h = holguraMuros(d, r.pts)
      assert.equal(h.dentro, 0, `${oid} → ${amb(id).nombre} pisa un muro`)
      assert.ok(h.minima >= 0.45, `${oid} → ${amb(id).nombre}: pasa a ${h.minima.toFixed(2)} m de un muro en ${h.donde}`)
    }
  }
})

test('Hall Puerta 1 · Información → Hall de Cajas: sigue el centro del hall y entra por el medio del vano', () => {
  const r = buscarRuta(d, amb('a5').dest, amb('a6').dest, ['a5', 'a6'])
  assert.ok(r.metros < 10, `${r.metros.toFixed(1)} m`)
  assert.ok(holguraMuros(d, r.pts).minima >= 0.6)
})

test('las rutas desde la Puerta 1 no pisan los muros dibujados y casi todas van a más de 25 cm de ellos', () => {
  const destinos = d.ambientes.filter((a) => a.nombre && a.dest && !a.personal)
  const dentro = [], pegadas = []
  let n = 0
  for (const a of destinos) {
    const r = buscarRuta(d, P1.punto, a.dest, [P1.id, a.id])
    if (!r) continue
    n++
    const h = holguraMuros(d, r.pts)
    // el baño de minusválidos se alcanza por dentro de los SS.HH. (sus tabiques) y Triaje por un pasillo exterior de
    // 1 m junto a la fachada
    if (h.dentro >= 0.1 && !['a90', 'a91', 'a219'].includes(a.id)) dentro.push(`${a.id} ${a.nombre}: ${h.dentro.toFixed(2)} m`)
    if (h.minima < 0.25) pegadas.push(a.id)
  }
  assert.deepEqual(dentro, [])
  // antes de las rutas por el centro: 31 de 253 pasaban a menos de 20 cm de un muro
  assert.ok(pegadas.length <= n * 0.03, `${pegadas.length} de ${n} rutas a menos de 25 cm de un muro: ${pegadas.join(', ')}`)
})

test('la ruta no se acerca a las paredes más que su camino: en la rejilla, cada punto con holgura o en una puerta', () => {
  // holgura de la rejilla (dMuro) a lo largo de varias rutas: la mediana de cada ruta pasa de 60 cm
  for (const id of ['a142', 'a345', 'a124', 'a110', 'a4']) {
    const r = ruta(id)
    const hs = []
    for (const p of puntosRuta(r.pts, 0.25)) {
      const cx = Math.round((p.x - d.nav.x0) / d.nav.res), cy = Math.round((p.y - d.nav.y0) / d.nav.res)
      hs.push(d.nav.dMuro[cy * d.nav.w + cx] / 100)
    }
    hs.sort((a, b) => a - b)
    assert.ok(hs[hs.length >> 1] >= 0.6, `${amb(id).nombre}: holgura mediana ${hs[hs.length >> 1]} m`)
  }
})

test('puntosRuta: pasos a distancia constante, siguiendo los giros, con el último en el destino', () => {
  // puntos seguidos: entre 0,35 y 0,4 m (de lejos el mapa ralea, ver CADA)
  assert.ok(PASO_RUTA >= 0.35 && PASO_RUTA <= 0.4)
  const P = [[0, 0], [3.5, 0], [3.5, 2.2]]
  const p = puntosRuta(P, 1)
  assert.deepEqual(p.slice(0, 4).map((q) => [q.x, q.y]), [[0, 0], [1, 0], [2, 0], [3, 0]])
  // el quinto paso ya dobló la esquina: 0,5 m después del giro
  assert.ok(Math.abs(p[4].x - 3.5) < 1e-9 && Math.abs(p[4].y - 0.5) < 1e-9)
  // separación constante a lo largo de la línea
  for (let i = 1; i < p.length - 1; i++) assert.ok(Math.abs(p[i].s - p[i - 1].s - 1) < 1e-9)
  const u = p[p.length - 1]
  assert.deepEqual([u.x, u.y, +u.s.toFixed(6)], [3.5, 2.2, 5.7])
  assert.deepEqual([p[4].dx, p[4].dy], [0, 1])
  assert.deepEqual(puntosRuta([]), [])
  // con el paso por defecto: separación PASO_RUTA
  const q0 = puntosRuta(P)
  for (let i = 1; i < q0.length - 1; i++) assert.ok(Math.abs(q0[i].s - q0[i - 1].s - PASO_RUTA) < 1e-9)
  // una ruta real: un paso cada PASO_RUTA metros (más el del destino)
  const r = ruta('a345')
  const q = puntosRuta(r.pts)
  assert.ok(Math.abs(q.length - Math.ceil(r.metros / PASO_RUTA)) <= 1, `${q.length} pasos para ${r.metros.toFixed(1)} m`)
})

test('CADA: los pasos solo se ralean cuando se pegarían (al menos 7,5 px entre centros)', () => {
  const px = (z) => 6.7 * 2 ** (z - 20)   // píxeles por metro (latitud de Quito)
  for (let z = 16; z <= 22.5; z += 0.1) {
    const n = CADA.find(([zz]) => z >= zz)[1]
    assert.ok(n * PASO_RUTA * px(z) >= 7.5 - 1e-6, `zoom ${z.toFixed(1)}: ${(n * PASO_RUTA * px(z)).toFixed(1)} px`)
    // y no se ralea de más: con la mitad se pegarían
    if (n > 1) assert.ok((n / 2) * PASO_RUTA * px(z) < 7.5 + 1e-6)
  }
})

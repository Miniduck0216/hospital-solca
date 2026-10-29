// Pruebas de la guía del hospital, la búsqueda por nombre (?consulta=) y la barra de navegación (node --test)
import './fetchPublic.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cargarDatos, usarGeo } from '../src/pb/datos.js'
import { buscarRuta, indicaciones, proximoPaso } from '../src/pb/ruta.js'
import { agruparGuia, buscarLugar, juntarIguales } from '../src/pb/guia.js'

const d = await cargarDatos()
usarGeo(d.geo)
const lugares = d.ambientes.filter((a) => a.nombre && a.dest && !a.personal)
  .map((a) => ({ id: a.id, nombre: a.nombre, cat: a.cat, area: a.area, piso: 'PB', pisoCorto: 'PB' }))

test('la guía agrupa por piso y por tipo, con las consultas antes que los baños', () => {
  const g = agruparGuia(lugares, d.edificio.pisos)
  assert.equal(g.length, 1)
  assert.equal(g[0].piso, 'PB')
  const cats = g[0].grupos.map((x) => x.cat)
  if (cats.includes('consulta') && cats.includes('banos')) assert.ok(cats.indexOf('consulta') < cats.indexOf('banos'))
  assert.equal(g[0].grupos.reduce((n, x) => n + x.lugares.length, 0), lugares.length)
})

test('buscar por nombre ignora tildes y mayúsculas, y prefiere el nombre exacto', () => {
  const un = lugares.find((l) => l.cat === 'consulta') || lugares[0]
  assert.equal(buscarLugar(lugares, un.nombre.toUpperCase())?.id, un.id)
  const farm = lugares.find((l) => /farmacia/i.test(l.nombre))
  if (farm) assert.match(buscarLugar(lugares, 'farmácia').nombre, /Farmacia/i)
  assert.equal(buscarLugar(lugares, 'zzz no existe'), null)
  assert.equal(buscarLugar(lugares, ''), null)
})

test('la barra de navegación avanza de paso en paso hasta la llegada', () => {
  const p1 = d.entradas.find((e) => e.id === 'entrada-puerta-1')
  const dest = d.ambientes.find((a) => a.nombre === 'Farmacia') || d.ambientes.find((a) => a.nombre && a.dest && !a.personal)
  const r = buscarRuta(d, [p1.x, p1.y], dest.dest, [p1.id, dest.id])
  assert.ok(r)
  const pasos = indicaciones(d, r, { nombre: 'Puerta 1' }, dest)
  assert.ok(pasos.every((p) => typeof p.en === 'number'))
  const L = r.metros || pasos[pasos.length - 1].en
  const ini = proximoPaso(pasos, 0, L)
  const fin = proximoPaso(pasos, L, L)
  assert.ok(ini && fin)
  assert.equal(fin.paso.tipo, 'fin')
  assert.equal(fin.faltan, 0)
  assert.ok(ini.k <= fin.k)
})

test('los lugares con el mismo nombre en un piso se juntan y se elige el más cercano', () => {
  const xs = [
    { id: 'b1', nombre: 'Baño', cat: 'banos', piso: 'PB', x: 0, y: 0 },
    { id: 'b2', nombre: 'Baño', cat: 'banos', piso: 'PB', x: 10, y: 0 },
    { id: 'b3', nombre: 'Baño', cat: 'banos', piso: 'P1', x: 0, y: 0 },
    { id: 'c1', nombre: 'Cardiología', cat: 'consulta', piso: 'PB', x: 5, y: 5 },
  ]
  const r = juntarIguales(xs, { piso: 'PB', x: 9, y: 0 })
  assert.equal(r.length, 3)
  const pb = r.find((l) => l.piso === 'PB' && l.cat === 'banos')
  assert.equal(pb.id, 'b2')
  assert.equal(pb.cuantos, 2)
  assert.equal(r.find((l) => l.piso === 'P1').cuantos, undefined)
})

test('la guía empieza en la planta baja y deja los subsuelos al final', () => {
  const pisos = [{ id: 'SB', nivel: -1 }, { id: 'PB', nivel: 0 }, { id: 'P1', nivel: 1 }]
  const g = agruparGuia([{ id: 'x', nombre: 'A', cat: 'otro', piso: 'SB' }, { id: 'y', nombre: 'B', cat: 'otro', piso: 'P1' }, { id: 'z', nombre: 'C', cat: 'otro', piso: 'PB' }], pisos)
  assert.deepEqual(g.map((p) => p.piso), ['PB', 'P1', 'SB'])
})

// Pruebas del plano vaciado (solo geometría) con la información de los ambientes que llega de OM3 (node --test).
// La configuración de OM3 de prueba es tests/fixtures/config-om3.json (ver fetchPublic.js).
import './fetchPublic.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CONFIG_OM3_URL, aplicarCambios, cargarDatos, tieneInformacion, usarGeo } from '../src/pb/datos.js'
import { buscarRuta } from '../src/pb/ruta.js'
import { buscarLugar } from '../src/pb/guia.js'
import { TIPOS_ESTRUCTURALES } from '../scripts/vaciar_datos.mjs'

const PUB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public')
const leer = (rel) => JSON.parse(fs.readFileSync(path.join(PUB, rel), 'utf8'))
const edificio = leer('edificio.json')
const SIN_OM3 = { cambiosUrl: 'https://om3-caido.test/api/v1/gestion_hospitalaria/mapa/otra' }

test('el plano no trae nombres, íconos, ventanillas, lugares ni letreros: solo geometría e ids', () => {
  for (const p of edificio.pisos.filter((x) => x.disponible)) {
    const d = leer(p.datos)
    assert.equal(d.nombre, undefined, p.id)
    for (const a of d.ambientes) {
      assert.deepEqual(Object.keys(a).filter((k) => !['id', 'cat', 'area', 'pg', 'lbl', 'dest', 'paso'].includes(k)), [], `${p.id}:${a.id}`)
      assert.ok(TIPOS_ESTRUCTURALES.includes(a.cat) || a.cat === 'otro', `${p.id}:${a.id} ${a.cat}`)
    }
    for (const e of d.entradas) assert.equal(e.nombre, undefined, `${p.id}:${e.id}`)
    const c = leer(p.config)
    assert.deepEqual(Object.keys(c).filter((k) => !['piso', 'nota', 'pasos', 'puertasAuto'].includes(k)), [], p.id)
    for (const id of c.puertasAuto) assert.match(id, /^a\d+$/, `${p.id} puertasAuto`)
  }
})

test('sin parámetro ?config= se usa la configuración de OM3 por defecto (DEV)', () => {
  assert.equal(CONFIG_OM3_URL, 'https://dev-omniumportal.solcaquito.org.ec/api/v1/gestion_hospitalaria/mapa/publicado')
})

test('con OM3: nombres, categorías, íconos, ventanillas, entradas y letreros llegan de la configuración', async () => {
  const d = await cargarDatos()
  assert.equal(d.sinInformacion, false)
  const farmacia = d.ambientes.find((a) => a.id === 'a4')
  assert.equal(farmacia.nombre, 'Farmacia')
  assert.equal(farmacia.cat, 'farmacia')
  assert.equal(farmacia.icono, 'farmacia')
  assert.equal(farmacia.ventanilla, true)
  assert.equal(d.entradas.find((e) => e.id === 'entrada-puerta-1').nombre, 'Puerta 1')
  assert.ok(d.letreros.some((l) => l.zona && l.nombre === 'Zona 1'))
  assert.ok(d.ambientes.some((a) => a.nuevo && /^Hab\. 01/.test(a.nombre)), 'lugares de OM3')
  // la búsqueda por nombre (?consulta=) y el destino por id (?destino=a4) usan lo que llegó de OM3
  const lugares = d.ambientes.filter((a) => a.nombre && a.dest && !a.personal).map((a) => ({ ...a, piso: 'PB' }))
  assert.equal(buscarLugar(lugares, 'farmacia')?.id, 'a4')
  // solo personal: viene marcado en OM3 (la regla soloPersonal ya no está en el plano)
  assert.ok(d.ambientes.some((a) => a.personal && /^Bodega/.test(a.nombre || '')))
})

test('el ícono de un ambiente se puede cambiar desde la configuración (y uno desconocido no se aplica)', async () => {
  const d = await cargarDatos(null, SIN_OM3)
  aplicarCambios(d, { ambientes: { a47: { nombre: 'Informes', icono: 'informacion' }, a48: { icono: 'cohete' } } })
  assert.equal(d.ambientes.find((a) => a.id === 'a47').icono, 'informacion')
  assert.equal(d.ambientes.find((a) => a.id === 'a48').icono, undefined)
})

test('sin OM3: el plano se dibuja y traza rutas, sin nombres y con aviso', async () => {
  const d = await cargarDatos(null, SIN_OM3)
  usarGeo(d.geo)
  assert.equal(d.sinInformacion, true)
  assert.equal(d.ambientes.filter((a) => a.nombre).length, 0)
  assert.ok(d.ambientes.length > 400 && d.nav.banda.some((v) => v), 'geometría y franja de paso')
  const p1 = d.entradas.find((e) => e.id === 'entrada-puerta-1')
  assert.equal(p1.nombre, 'Entrada')
  // ruta desde la Puerta 1 hasta la farmacia (a4), solo con la geometría
  const a4 = d.ambientes.find((a) => a.id === 'a4')
  assert.ok(buscarRuta(d, [p1.x, p1.y], a4.dest, [p1.id, a4.id]), 'ruta sin OM3')
  // configuración vacía: igual que si no llegara
  assert.equal(tieneInformacion({ pasos: [] }), false)
  assert.equal(tieneInformacion({ entradas: { 'entrada-puerta-1': { nombre: 'Puerta 1' } } }), true)
})

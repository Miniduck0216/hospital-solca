// Eliminar y restaurar desde el editor: un ambiente del plano queda marcado (eliminado) y un lugar nuevo sale de la
// lista. El mapa (tótem, celular, búsquedas) no lo muestra ni lo usa como destino (node --test).
import './fetchPublic.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cargarDatos } from '../src/pb/datos.js'
import { buscarLugar } from '../src/pb/guia.js'
import { cambiarAmbiente, eliminarAmbiente, eliminarLugar, estaEliminado, restaurarAmbiente } from '../src/pb/editor.js'

// lugares como los arma App.jsx (armarLugares): con nombre, punto de acceso y no solo del personal
const lugaresDe = (d) => d.ambientes.filter((a) => a.nombre && a.dest && !a.personal).map((a) => ({ ...a, piso: 'PB' }))
const conPB = (cp) => ({ version: 2, pisos: { PB: cp } })

test('editor: eliminar marca el ambiente y conserva sus datos; restaurar quita la marca', () => {
  const cp = { ambientes: { a4: { nombre: 'Farmacia', cat: 'farmacia' } }, lugares: [], pasos: [] }
  const sin = eliminarAmbiente(cp, 'a4')
  assert.deepEqual(sin.ambientes.a4, { nombre: 'Farmacia', cat: 'farmacia', eliminado: true })
  assert.equal(estaEliminado(sin, 'a4'), true)
  assert.equal(cp.ambientes.a4.eliminado, undefined, 'no cambia la configuración original')
  const otra = restaurarAmbiente(sin, 'a4')
  assert.deepEqual(otra.ambientes.a4, { nombre: 'Farmacia', cat: 'farmacia' })
  assert.ok(!('eliminado' in otra.ambientes.a4), 'sin la marca vacía (lo que va a OM3 queda limpio)')
  assert.equal(estaEliminado(otra, 'a4'), false)
  // un campo en undefined se quita (p. ej. el ícono «Según la categoría»)
  assert.deepEqual(cambiarAmbiente({ ambientes: { a4: { icono: 'caja' } } }, 'a4', { icono: undefined }).ambientes.a4, {})
})

test('editor: eliminar un lugar nuevo lo quita de la lista y deja los demás', () => {
  const cp = { lugares: [{ id: 'L-1', nombre: 'Módulo 06', x: 1, y: 2 }, { id: 'L-2', nombre: 'Caja 3', x: 3, y: 4 }] }
  assert.deepEqual(eliminarLugar(cp, 'L-1').lugares.map((l) => l.id), ['L-2'])
  assert.equal(cp.lugares.length, 2)
})

test('mapa: un ambiente eliminado no tiene nombre ni letrero, no es destino ni se encuentra al buscar', async () => {
  const antes = await cargarDatos()
  assert.equal(buscarLugar(lugaresDe(antes), 'farmacia')?.id, 'a4')
  const d = await cargarDatos(conPB({ ambientes: { a4: { eliminado: true } } }))
  const a4 = d.ambientes.find((a) => a.id === 'a4')
  assert.equal(a4.nombre, null)
  assert.equal(a4.eliminado, true)
  assert.ok(a4.pg.length, 'el cuarto sigue en el plano')
  assert.ok(!lugaresDe(d).some((l) => l.id === 'a4'), 'no es destino (tótem, celular, ?destino=a4)')
  assert.notEqual(buscarLugar(lugaresDe(d), 'farmacia')?.id, 'a4')
  // la ruta no lo cruza como si fuera un espacio abierto sin nombre
  assert.equal(d.nav.paso[d.nav.indice.a4], 0)
})

test('mapa: el borrador del editor de OM3 con un ambiente eliminado y luego restaurado', async () => {
  const opciones = { sinPublicados: true }
  const borrador = { ambientes: { a4: { nombre: 'Farmacia', cat: 'farmacia', eliminado: true }, a5: { nombre: 'Caja' } } }
  const d = await cargarDatos(conPB(borrador), opciones)
  assert.equal(d.ambientes.find((a) => a.id === 'a4').nombre, null)
  assert.equal(d.ambientes.find((a) => a.id === 'a5').nombre, 'Caja')
  const r = await cargarDatos(conPB(restaurarAmbiente(borrador, 'a4')), opciones)
  const a4 = r.ambientes.find((a) => a.id === 'a4')
  assert.equal(a4.nombre, 'Farmacia')
  assert.equal(a4.eliminado, undefined)
})

test('mapa: un lugar nuevo eliminado ya no está', async () => {
  const opciones = { sinPublicados: true }
  const cp = { lugares: [{ id: 'L-prueba-1', nombre: 'Módulo 06', cat: 'administracion', x: 10, y: 10 }] }
  const con = await cargarDatos(conPB(cp), opciones)
  assert.ok(con.ambientes.some((a) => a.id === 'L-prueba-1'))
  const sin = await cargarDatos(conPB(eliminarLugar(cp, 'L-prueba-1')), opciones)
  assert.ok(!sin.ambientes.some((a) => a.id === 'L-prueba-1'))
})

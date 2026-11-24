// Pruebas del modo elegir (OM3 fija la ubicación de un tótem tocando el mapa) y de la lectura del modo (node --test).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { idGlobal, leerModo, mensajeElegido, numeroPiso, pisoDeId } from '../src/pb/elegir.js'

const OM3 = 'https://dev-omniumportal.solcaquito.org.ec'

test('elegir=1 con modo=admin y padre activa el modo elegir, no el editor', () => {
  const m = leerModo(`?modo=admin&elegir=1&padre=${encodeURIComponent(OM3 + '/admin/mapa')}&sede=quito&edificio=principal`)
  assert.deepEqual(m, { insertado: 'admin', padre: OM3, modoAdmin: false, elegir: true, padreTotem: null })
})

test('sin elegir, modo=admin con padre sigue siendo el editor de siempre', () => {
  assert.deepEqual(leerModo(`?modo=admin&padre=${OM3}`), { insertado: 'admin', padre: OM3, modoAdmin: true, elegir: false, padreTotem: null })
  assert.equal(leerModo(`?modo=admin&padre=${OM3}&elegir=0`).elegir, false)
  assert.equal(leerModo(`?modo=admin&padre=${OM3}&elegir=0`).modoAdmin, true)
})

test('elegir no se activa sin padre válido ni fuera de modo=admin', () => {
  assert.deepEqual(leerModo('?modo=admin&elegir=1'), { insertado: 'admin', padre: null, modoAdmin: false, elegir: false, padreTotem: null })
  assert.equal(leerModo('?modo=admin&elegir=1&padre=javascript:alert(1)').elegir, false)
  assert.equal(leerModo(`?modo=totem&elegir=1&padre=${OM3}`).elegir, false)
  assert.equal(leerModo(`?modo=guia&elegir=1&padre=${OM3}`).elegir, false)
  assert.equal(leerModo('?elegir=1').elegir, false)
})

test('los demás modos quedan igual que antes', () => {
  assert.deepEqual(leerModo(''), { insertado: null, padre: null, modoAdmin: false, elegir: false, padreTotem: null })
  assert.deepEqual(leerModo('?origen=entrada-puerta-1&destino=a12'), { insertado: null, padre: null, modoAdmin: false, elegir: false, padreTotem: null })
  assert.deepEqual(leerModo(`?modo=totem&padre=${OM3}`), { insertado: 'totem', padre: null, modoAdmin: false, elegir: false, padreTotem: OM3 })
  assert.deepEqual(leerModo('?modo=guia'), { insertado: 'guia', padre: null, modoAdmin: false, elegir: false, padreTotem: null })
  assert.equal(leerModo('?modo=otro').insertado, null)
  // acepta también URLSearchParams
  assert.equal(leerModo(new URLSearchParams(`modo=admin&padre=${OM3}&elegir=1`)).elegir, true)
})

test('id elegido: el mismo formato que el origen de OM3', () => {
  assert.equal(idGlobal('PB', 'entrada-puerta-1'), 'entrada-puerta-1')
  assert.equal(idGlobal('PB', 'a12'), 'a12')
  assert.equal(idGlobal('PB', 'L-abc'), 'L-abc')
  assert.equal(idGlobal('P1', 'a12'), 'P1:a12')
  assert.equal(idGlobal('SB', 'a3'), 'SB:a3')
  assert.equal(idGlobal('P2', 'entrada-acceso-1'), 'P2:entrada-acceso-1')
  // ida y vuelta con el piso del id (como resuelve ?origen= y como lo lee pisoDeLugar en OM3)
  for (const [p, id] of [['PB', 'a7'], ['P3', 'a8'], ['SB', 'a1'], ['PB', 'entrada-puerta-1']]) assert.equal(pisoDeId(idGlobal(p, id)), p)
  assert.equal(pisoDeId(''), 'PB')
  assert.equal(pisoDeId(null), 'PB')
})

test('piso como número: SB -1, PB 0, P1 1…', () => {
  assert.equal(numeroPiso('SB'), -1)
  assert.equal(numeroPiso('PB'), 0)
  assert.equal(numeroPiso('P1'), 1)
  assert.equal(numeroPiso('P3'), 3)
  assert.equal(numeroPiso('P12'), 12)
  // otra forma de piso: el nivel del edificio
  assert.equal(numeroPiso('M1', 2), 2)
  assert.equal(numeroPiso('M1'), 0)
})

test('mensaje mapa-elegido', () => {
  const ambienteP1 = { id: 'P1:a12', local: 'a12', piso: 'P1', nombre: 'Consultorio 12' }
  assert.deepEqual(mensajeElegido(ambienteP1, 1), { tipo: 'mapa-elegido', id: 'P1:a12', nombre: 'Consultorio 12', piso: 1 })
  const puerta = { id: 'entrada-puerta-1', local: 'entrada-puerta-1', piso: 'PB', nombre: 'Puerta 1 · Entrada principal', entrada: true }
  assert.deepEqual(mensajeElegido(puerta, 0), { tipo: 'mapa-elegido', id: 'entrada-puerta-1', nombre: 'Puerta 1 · Entrada principal', piso: 0 })
  // la entrada va con su nombre sin el piso que le agrega la guía
  const acceso = { id: 'P1:entrada-acceso-2', local: 'entrada-acceso-2', piso: 'P1', nombre: 'Acceso 2 (P1)', etiqueta: 'Acceso 2', entrada: true }
  assert.deepEqual(mensajeElegido(acceso, 1), { tipo: 'mapa-elegido', id: 'P1:entrada-acceso-2', nombre: 'Acceso 2', piso: 1 })
  const punto ={ id: 'SB:L-x1', local: 'L-x1', piso: 'SB', nombre: 'Ventanilla' }
  assert.deepEqual(mensajeElegido(punto, -1), { tipo: 'mapa-elegido', id: 'SB:L-x1', nombre: 'Ventanilla', piso: -1 })
})

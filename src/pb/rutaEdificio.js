// Rutas entre pisos: se elige el ascensor o la escalera y se arma la ruta por tramos (piso de salida, conector,
// piso de llegada). No se busca sobre todos los pisos a la vez: por cada ruta se hacen
//   1) una búsqueda desde el origen hasta todas las paradas del piso de salida (metrosHasta),
//   2) una búsqueda desde el destino hasta todas las paradas del piso de llegada,
// y se suma el tiempo vertical de cada conector. Luego solo se trazan los dos tramos del conector elegido.
// Así el costo no crece con la cantidad de ascensores ni de pisos.
//
// Preferencias:
//   via: 'ascensor' (por defecto) | 'escalera' | 'cualquiera'
//   accesible: true → solo conectores accesibles (ascensores) y sin escalones dentro de cada piso

export const VIAS = ['ascensor', 'escalera', 'cualquiera']
export const VIA_POR_DEFECTO = 'ascensor'

const TIEMPOS_DEF = { velocidadMs: 1.2, ascensorEsperaS: 45, ascensorPorPisoS: 5, escaleraPorPisoS: 15 }

/** Segundos que toma subir o bajar `pisos` niveles con un conector. */
export function segundosVerticales(tipo, pisos, tiempos = TIEMPOS_DEF) {
  const t = { ...TIEMPOS_DEF, ...tiempos }
  const n = Math.abs(pisos)
  if (n === 0) return 0
  return tipo === 'ascensor' ? t.ascensorEsperaS + t.ascensorPorPisoS * n : t.escaleraPorPisoS * n
}

/** Parada de un conector en un piso (o null si no llega a ese piso). */
export const paradaEn = (conector, pisoId) => conector.paradas.find((p) => p.piso === pisoId) || null

/**
 * Elige el conector para ir de un piso a otro.
 * @param e.edificio   { pisos: [{ id, nivel }], conectores, tiempos }
 * @param e.origen     { piso }  e.destino { piso }
 * @param e.metrosOrigen   { [ambienteParada]: metros } desde el origen hasta cada parada de su piso
 * @param e.metrosDestino  { [ambienteParada]: metros } desde el destino hasta cada parada de su piso
 * @returns { elegida, alternativa, opciones, aviso } (elegida = null si no hay forma de llegar)
 */
export function elegirConector({ edificio, origen, destino, metrosOrigen, metrosDestino, via = VIA_POR_DEFECTO, accesible = false }) {
  const tiempos = { ...TIEMPOS_DEF, ...(edificio.tiempos || {}) }
  const nivel = (id) => edificio.pisos.find((p) => p.id === id)?.nivel
  const dn = nivel(destino.piso) - nivel(origen.piso)
  const opciones = []
  for (const c of edificio.conectores || []) {
    if (accesible && !c.accesible) continue
    const a = paradaEn(c, origen.piso), b = paradaEn(c, destino.piso)
    if (!a || !b) continue
    const mA = metrosOrigen[a.ambiente], mB = metrosDestino[b.ambiente]
    if (mA == null || mB == null) continue
    const segundos = (mA + mB) / tiempos.velocidadMs + segundosVerticales(c.tipo, dn, tiempos)
    opciones.push({ conector: c, tipo: c.tipo, paradaOrigen: a, paradaDestino: b, metros: mA + mB, segundos })
  }
  opciones.sort((x, y) => x.segundos - y.segundos)
  const mejorDe = (tipo) => opciones.find((o) => o.tipo === tipo) || null
  let elegida = via === 'cualquiera' ? opciones[0] || null : mejorDe(via)
  let aviso = null
  if (!elegida && opciones.length) {
    elegida = opciones[0]
    aviso = via === 'ascensor'
      ? 'No hay un ascensor que llegue a ese piso por aquí: la ruta usa la escalera.'
      : 'No hay una escalera que llegue a ese piso por aquí: la ruta usa el ascensor.'
  }
  if (!elegida) {
    aviso = accesible ? 'No hay una ruta accesible (con ascensor) hasta ese piso.' : 'No hay un ascensor ni una escalera que unan esos pisos.'
  }
  // alternativa: lo mejor del otro tipo (el paciente puede cambiar a escaleras o a ascensor con un toque)
  const alternativa = elegida && !accesible ? opciones.find((o) => o.tipo !== elegida.tipo) || null : null
  return { elegida: elegida || null, alternativa, opciones, aviso }
}

/**
 * Indicación del tramo vertical: «Tome los Ascensores del Hall y suba al Piso 2».
 */
export function textoVertical(op, edificio, origen, destino) {
  const piso = edificio.pisos.find((p) => p.id === destino.piso)
  const sube = (piso?.nivel ?? 0) > (edificio.pisos.find((p) => p.id === origen.piso)?.nivel ?? 0)
  const verbo = op.tipo === 'ascensor' ? 'Tome' : 'Use'
  return `${verbo} ${op.conector.nombre || (op.tipo === 'ascensor' ? 'el ascensor' : 'la escalera')} y ${sube ? 'suba' : 'baje'} ${piso?.id === 'SB' ? 'al Subsuelo' : `a ${piso?.nombre || destino.piso}`}`
}

/**
 * Ruta completa entre dos puntos del edificio, con tramos por piso.
 * @param pisos   { [pisoId]: d } datos ya cargados de cada piso involucrado
 * @param buscar  (d, desde, hasta, ids, opts) => { pts, metros } | null     (buscarRuta de ruta.js)
 * @param medir   (d, desde, idOrigen, objetivos, opts) => { [id]: metros }  (metrosHasta de ruta.js)
 */
export function rutaEdificio({ edificio, pisos, origen, destino, via = VIA_POR_DEFECTO, accesible = false, buscar, medir }) {
  const opts = { accesible }
  if (origen.piso === destino.piso) {
    const r = buscar(pisos[origen.piso], origen.punto, destino.punto, [origen.id, destino.id], opts)
    return r ? { tramos: [{ piso: origen.piso, ...r }], metros: r.metros, vertical: null, alternativa: null, aviso: null } : null
  }
  const dO = pisos[origen.piso], dD = pisos[destino.piso]
  const paradas = (pisoId) => (edificio.conectores || []).map((c) => paradaEn(c, pisoId)?.ambiente).filter(Boolean)
  const metrosOrigen = medir(dO, origen.punto, origen.id, paradas(origen.piso), opts)
  const metrosDestino = medir(dD, destino.punto, destino.id, paradas(destino.piso), opts)
  const sel = elegirConector({ edificio, origen, destino, metrosOrigen, metrosDestino, via, accesible })
  if (!sel.elegida) return { tramos: [], metros: 0, vertical: null, alternativa: null, aviso: sel.aviso, sinRuta: true }
  const tramos = armarTramos(sel.elegida, { pisos, origen, destino, buscar, opts })
  if (!tramos) return { tramos: [], metros: 0, vertical: null, alternativa: null, aviso: 'No se pudo trazar la ruta.', sinRuta: true }
  return {
    tramos,
    metros: tramos.reduce((s, t) => s + t.metros, 0),
    segundos: sel.elegida.segundos,
    vertical: { tipo: sel.elegida.tipo, conector: sel.elegida.conector, texto: textoVertical(sel.elegida, edificio, origen, destino) },
    alternativa: sel.alternativa ? { tipo: sel.alternativa.tipo, segundos: sel.alternativa.segundos, conector: sel.alternativa.conector } : null,
    aviso: sel.aviso,
  }
}

function armarTramos(op, { pisos, origen, destino, buscar, opts }) {
  const dO = pisos[origen.piso], dD = pisos[destino.piso]
  const pa = ambientePunto(dO, op.paradaOrigen.ambiente), pb = ambientePunto(dD, op.paradaDestino.ambiente)
  if (!pa || !pb) return null
  const t1 = buscar(dO, origen.punto, pa, [origen.id, op.paradaOrigen.ambiente], opts)
  const t2 = buscar(dD, pb, destino.punto, [op.paradaDestino.ambiente, destino.id], opts)
  if (!t1 || !t2) return null
  return [{ piso: origen.piso, ...t1 }, { piso: destino.piso, ...t2 }]
}

const ambientePunto = (d, id) => {
  const a = d?.ambientes?.find((x) => x.id === id)
  return a ? a.dest || a.lbl : null
}

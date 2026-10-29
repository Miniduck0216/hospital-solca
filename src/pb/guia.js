// Guía del hospital: el directorio completo (por piso y por tipo de servicio) que se abre desde la barra de búsqueda,
// y la búsqueda de un lugar por su nombre (para los enlaces de OM3 con ?consulta=Cardiología).
import { CATS, plano } from './datos.js'

// orden de los tipos dentro de cada piso: primero lo que más se busca
// las entradas van al final: casi nunca son el destino de un paciente
export const ORDEN_CATS = ['consulta', 'administracion', 'farmacia', 'espera', 'banos', 'ascensores', 'escaleras', 'apoyo', 'circulacion', 'otro', 'entrada']
const nombreCat = (c) => (c === 'entrada' ? 'Entradas y salidas' : c === 'ascensores' ? 'Ascensores' : CATS[c]?.nombre || 'Otros')

const rango = (n = 0) => (n >= 0 ? n : 100 - n)

/**
 * Junta los lugares que se llaman igual en el mismo piso (los 40 «Baño», los «Consultorio» sin número) en una sola
 * fila: se elige el más cercano a donde está la persona y se cuenta cuántos hay.
 * @param origen { piso, x, y } punto de partida (o null)
 */
export function juntarIguales(lugares, origen = null) {
  const grupos = new Map()
  for (const l of lugares) {
    const k = `${l.piso}|${l.entrada ? 'e' : l.cat}|${plano(l.nombre)}`
    if (!grupos.has(k)) grupos.set(k, [])
    grupos.get(k).push(l)
  }
  const dist = (l) => (origen && origen.piso === l.piso ? Math.hypot(l.x - origen.x, l.y - origen.y) : 0)
  return [...grupos.values()].map((xs) => {
    if (xs.length === 1) return xs[0]
    const cerca = xs.reduce((m, l) => (dist(l) < dist(m) ? l : m), xs[0])
    return { ...cerca, cuantos: xs.length }
  })
}

/**
 * Agrupa los lugares por piso (en el orden de `pisos`) y, dentro de cada piso, por tipo.
 * @returns [{ piso, nombre, grupos: [{ cat, nombre, lugares }] }]
 */
export function agruparGuia(lugares, pisos = []) {
  // planta baja primero (donde se entra), luego los pisos de arriba y al final los subsuelos
  const orden = [...pisos].sort((a, b) => rango(a.nivel) - rango(b.nivel)).map((p) => p.id)
  const porPiso = new Map()
  for (const l of lugares) {
    if (!porPiso.has(l.piso)) porPiso.set(l.piso, [])
    porPiso.get(l.piso).push(l)
  }
  return [...porPiso.entries()]
    .sort(([a], [b]) => (orden.indexOf(a) + 1 || 99) - (orden.indexOf(b) + 1 || 99))
    .map(([piso, ls]) => {
      const porCat = new Map()
      for (const l of ls) {
        const c = l.entrada ? 'entrada' : l.cat
        if (!porCat.has(c)) porCat.set(c, [])
        porCat.get(c).push(l)
      }
      const grupos = [...porCat.entries()]
        .sort(([a], [b]) => (ORDEN_CATS.indexOf(a) + 1 || 99) - (ORDEN_CATS.indexOf(b) + 1 || 99))
        .map(([cat, xs]) => ({ cat, nombre: nombreCat(cat), lugares: xs.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true })) }))
      const p = pisos.find((x) => x.id === piso)
      return { piso, nombre: p?.nombre || ls[0]?.pisoNombre || piso, corto: p?.corto || piso, grupos }
    })
}

/**
 * Busca un lugar por texto (nombre de la consulta o del servicio, sin importar tildes ni mayúsculas).
 * Prefiere: nombre idéntico, luego nombre que empieza con el texto, luego que lo contiene, luego todas las palabras;
 * a igualdad, los consultorios y los de menos letras.
 */
export function buscarLugar(lugares, texto) {
  const t = plano(texto).trim().replace(/\s+/g, ' ')
  if (!t) return null
  const palabras = t.split(' ').filter((w) => w.length > 2)
  let mejor = null, nota = 0
  for (const l of lugares) {
    if (l.entrada) continue
    const n = plano(l.nombre)
    let v = n === t ? 4 : n.startsWith(t) ? 3 : n.includes(t) ? 2 : palabras.length && palabras.every((w) => n.includes(w)) ? 1 : 0
    if (!v) continue
    v += (l.cat === 'consulta' ? 0.5 : 0) - n.length / 1000
    if (v > nota) { nota = v; mejor = l }
  }
  return mejor
}

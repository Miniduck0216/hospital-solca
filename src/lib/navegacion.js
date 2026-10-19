import { H, H_PISO, NIVELES, nodeById, cuartoById, cuartoEn, nodosDeZona, nodoAmbiente, tipoArista } from './datos.js'
import { segmentoLibre, puntoLibre } from './obstaculos.js'

const d3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.h || 0) - (b.h || 0))
const adj = {}
H.nodos.forEach((n) => (adj[n.id] = []))
for (const [a, b, t] of H.aristas) {
  // costo: distancia real; el ascensor suma una espera fija y la escalera pesa un poco más
  const base = t === 'ascensor' ? 12 : d3(nodeById[a], nodeById[b]) * (t === 'escalera' ? 1.6 : 1)
  adj[a].push([b, base, t]); adj[b].push([a, base, t])
}

// montículo binario mínimo para la lista abierta del A*
class Monticulo {
  constructor() { this.a = [] }
  get size() { return this.a.length }
  push(k, v) {
    const a = this.a; a.push([k, v]); let i = a.length - 1
    while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p }
  }
  pop() {
    const a = this.a, top = a[0], last = a.pop()
    if (a.length) {
      a[0] = last; let i = 0
      for (;;) {
        const l = 2 * i + 1, r = l + 1; let m = i
        if (l < a.length && a[l][0] < a[m][0]) m = l
        if (r < a.length && a[r][0] < a[m][0]) m = r
        if (m === i) break
        ;[a[m], a[i]] = [a[i], a[m]]; i = m
      }
    }
    return top[1]
  }
}

// A* con heurística en línea recta 3D; "accesible" evita las escaleras
export function aStar(inicio, meta, { accesible = false } = {}) {
  if (inicio === meta) return { camino: [inicio], costo: 0 }
  const M = nodeById[meta]
  const g = new Map([[inicio, 0]])
  const vino = new Map()
  const cerrados = new Set()
  const abiertos = new Monticulo()
  abiertos.push(d3(nodeById[inicio], M), inicio)
  while (abiertos.size) {
    const cur = abiertos.pop()
    if (cerrados.has(cur)) continue
    if (cur === meta) {
      const camino = [cur]
      while (vino.has(camino[0])) camino.unshift(vino.get(camino[0]))
      return { camino, costo: g.get(meta) }
    }
    cerrados.add(cur)
    for (const [v, w, t] of adj[cur]) {
      if (accesible && t === 'escalera') continue
      if (cerrados.has(v)) continue
      const tg = g.get(cur) + w
      if (!g.has(v) || tg < g.get(v)) { vino.set(v, cur); g.set(v, tg); abiertos.push(tg + d3(nodeById[v], M), v) }
    }
  }
  return null
}

// de muchos destinos posibles (p. ej. todos los baños), los más prometedores para calcular rutas reales
export function cercanos(desde, ids, n = 8) {
  const est = (id) => { const b = nodeById[id]; return Math.hypot(b.x - desde.x, b.y - desde.y) + Math.abs((b.h || 0) - (desde.h || 0)) * 6 }
  return [...ids].sort((a, b) => est(a) - est(b)).slice(0, n)
}

const NO_DESTINO = new Set(['escalera', 'ascensores'])
// Ajusta un punto pedido dentro de un ambiente: lo aleja de muros y muebles y garantiza línea libre desde algún nodo
export function destinoEnAmbiente(piso, x, y) {
  const room = cuartoEn(piso, x, y)
  if (!room || NO_DESTINO.has(room.tipo)) return null
  const m = 0.35
  const p = { x: Math.min(Math.max(x, room.x0 + m), room.x1 - m), y: Math.min(Math.max(y, room.y0 + m), room.y1 - m) }
  const nodos = nodosDeZona(room.id).filter((n) => n.piso === piso)
  if (!nodos.length) return null
  if (puntoLibre(piso, p.x, p.y)) {
    const vis = nodos.filter((n) => segmentoLibre(piso, n, p).libre)
    if (vis.length) return { room, punto: p, nodos: vis }
  }
  const base = nodoAmbiente(room.id) || nodos.reduce((a, b) => (Math.hypot(a.x - p.x, a.y - p.y) < Math.hypot(b.x - p.x, b.y - p.y) ? a : b))
  let lo = 0, hi = 1
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2
    const q = { x: base.x + (p.x - base.x) * mid, y: base.y + (p.y - base.y) * mid }
    if (puntoLibre(piso, q.x, q.y) && segmentoLibre(piso, base, q).libre) lo = mid; else hi = mid
  }
  return { room, punto: { x: base.x + (p.x - base.x) * lo, y: base.y + (p.y - base.y) * lo }, nodos: [base] }
}

// estado: { pos:{x,y,h,piso}, anclas:[ids] } · objetivo: {tipo:'nodo',id} | {tipo:'punto',piso,x,y}
export function planificar(estado, objetivo, opciones = {}) {
  let metas, final = null, room
  if (objetivo.tipo === 'nodo') {
    metas = [objetivo.id]
    room = cuartoById[nodeById[objetivo.id].zona] || null
  } else {
    const r = destinoEnAmbiente(objetivo.piso, objetivo.x, objetivo.y)
    if (!r) return null
    room = r.room
    final = { ...r.punto, piso: objetivo.piso, h: objetivo.piso * H_PISO }
    metas = r.nodos.map((n) => n.id)
    const aqui = cuartoEn(estado.pos.piso, estado.pos.x, estado.pos.y)
    if (estado.pos.piso === objetivo.piso && aqui?.id === room.id && Math.abs(estado.pos.h - final.h) < 0.05 && segmentoLibre(objetivo.piso, estado.pos, final).libre) {
      return { puntos: [estado.pos, final], costo: d3(estado.pos, final), destino: room, final, anclasFinal: metas }
    }
  }
  let mejor = null
  for (const a of estado.anclas) for (const m of metas) {
    const r = aStar(a, m, opciones)
    if (!r) continue
    const costo = d3(estado.pos, nodeById[a]) + r.costo + (final ? d3(nodeById[m], final) : 0)
    if (!mejor || costo < mejor.costo) mejor = { ...r, costo }
  }
  if (!mejor) return null
  const puntos = [estado.pos, ...mejor.camino.map((id) => ({ ...nodeById[id] }))]
  if (final) puntos.push(final)
  let metros = 0
  for (let i = 1; i < puntos.length; i++) if (tipoArista(puntos[i - 1].id, puntos[i].id) !== 'ascensor') metros += d3(puntos[i - 1], puntos[i])
  return { puntos, costo: mejor.costo, metros, destino: room, final, anclasFinal: [mejor.camino[mejor.camino.length - 1]] }
}

// ---------- instrucciones ----------
function giro(a, b, c) {
  const v1 = { x: b.x - a.x, y: b.y - a.y }, v2 = { x: c.x - b.x, y: c.y - b.y }
  if (Math.hypot(v1.x, v1.y) < 0.05 || Math.hypot(v2.x, v2.y) < 0.05) return null
  const ang = (Math.atan2(v1.x * v2.y - v1.y * v2.x, v1.x * v2.x + v1.y * v2.y) * 180) / Math.PI
  if (Math.abs(ang) < 35) return null
  return ang > 0 ? 'izquierda' : 'derecha'
}
const nombreCuarto = (c) => (c ? c.nombre : '')

export function instrucciones(plan, desde) {
  const { puntos, destino } = plan
  const out = []
  const ini = cuartoEn(desde.piso, desde.x, desde.y)
  if (ini && destino && ini.id !== destino.id && ini.tipo !== 'pasillo' && ini.tipo !== 'exterior') out.push(['Sal de ', { b: nombreCuarto(ini) }, '.'])
  for (let i = 1; i < puntos.length - 1; i++) {
    const n = puntos[i], sig = puntos[i + 1], prev = puntos[i - 1]
    const t = n.id && sig.id ? tipoArista(n.id, sig.id) : 'caminar'
    if (t === 'ascensor') {
      let j = i + 1
      while (j < puntos.length - 1 && puntos[j].id && puntos[j + 1].id && tipoArista(puntos[j].id, puntos[j + 1].id) === 'ascensor') j++
      out.push([{ b: 'Toma el ascensor' }, ` hasta ${NIVELES[puntos[j].piso]}.`])
      i = j
      continue
    }
    if (t === 'escalera') {
      let j = i + 1
      while (j < puntos.length - 1 && puntos[j].id && puntos[j + 1].id && tipoArista(puntos[j].id, puntos[j + 1].id) === 'escalera') j++
      const sube = (puntos[j].h || 0) > (n.h || 0)
      out.push([{ b: sube ? 'Sube por la escalera' : 'Baja por la escalera' }, ` hasta ${NIVELES[puntos[j].piso]}.`])
      i = j
      continue
    }
    if (n.tipo === 'puerta') {
      const c = cuartoEn(sig.piso, sig.x, sig.y)
      if (c && c.tipo === 'exterior') out.push(['Sal a la ', { b: 'plaza de ingreso' }, '.'])
      else if (c && c.tipo !== 'pasillo' && c.id !== cuartoEn(prev.piso, prev.x, prev.y)?.id) {
        const ultimo = out[out.length - 1]
        const yaDicho = ultimo && ultimo.some((p) => typeof p === 'object' && p.b === c.dep)
        if (!yaDicho || c.nombre !== c.dep) out.push(['Entra a ', { b: nombreCuarto(c) }, '.'])
      }
      else if (c && c.tipo === 'pasillo') out.push(['Sal al ', { b: c.nombre.toLowerCase() }, '.'])
      continue
    }
    const g = giro(prev, n, sig)
    if (g) {
      // solo se anuncian giros en pasillos y en la plaza; dentro de un ambiente sobra
      const aqui = cuartoEn(n.piso, n.x, n.y)
      if (!aqui || (aqui.tipo !== 'pasillo' && aqui.tipo !== 'exterior')) continue
      const hacia = cuartoEn(n.piso, (n.x + sig.x) / 2, (n.y + sig.y) / 2)
      const metros = Math.round(Math.hypot(sig.x - n.x, sig.y - n.y))
      if (metros < 2 && sig.tipo !== 'puerta') continue
      if (sig.tipo === 'puerta') {
        const c = cuartoEn(sig.piso, sig.x + (sig.x - n.x) * 0.3, sig.y + (sig.y - n.y) * 0.3)
        out.push(['Gira a la ', { b: g }, c && c.tipo !== 'pasillo' && c.tipo !== 'exterior' ? ': ahí está ' : '.', ...(c && c.tipo !== 'pasillo' && c.tipo !== 'exterior' ? [{ b: c.dep || c.nombre }, '.'] : [])])
      } else if (hacia && hacia.tipo === 'pasillo') out.push(['Gira a la ', { b: g }, ` hacia el ${hacia.nombre.toLowerCase()} y camina ${metros} m.`])
      else out.push(['Gira a la ', { b: g }, ` y camina ${metros} m.`])
    }
  }
  if (destino) out.push(['Llegaste a ', { b: destino.nombre }, ` (${NIVELES[destino.piso]}).`])
  return out
}

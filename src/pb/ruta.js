// Rutas sobre la rejilla de navegación del plano real (celdas de 25 cm): A* con 8 vecinos, costo extra junto a
// los muros (la ruta va por el centro de los pasillos) y suavizado por línea de vista.
import { ambienteEn } from './datos.js'

class Monticulo {
  constructor() { this.k = []; this.p = [] }
  push(k, p) {
    const K = this.k, P = this.p
    let i = K.length
    K.push(k); P.push(p)
    while (i > 0) {
      const j = (i - 1) >> 1
      if (P[j] <= p) break
      K[i] = K[j]; P[i] = P[j]; i = j
    }
    K[i] = k; P[i] = p
  }
  pop() {
    const K = this.k, P = this.p
    const top = K[0]
    const k = K.pop(), p = P.pop()
    if (K.length) {
      let i = 0
      const n = K.length
      for (;;) {
        let c = 2 * i + 1
        if (c >= n) break
        if (c + 1 < n && P[c + 1] < P[c]) c++
        if (P[c] >= p) break
        K[i] = K[c]; P[i] = P[c]; i = c
      }
      K[i] = k; P[i] = p
    }
    return top
  }
  get size() { return this.k.length }
}

function celda(nav, x, y) {
  return [Math.round((x - nav.x0) / nav.res), Math.round((y - nav.y0) / nav.res)]
}
function libreMasCercana(nav, cx, cy) {
  const { w, h, celdas } = nav
  for (let r = 0; r < 40; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
      const x = cx + dx, y = cy + dy
      if (x >= 0 && y >= 0 && x < w && y < h && celdas[y * w + x]) return [x, y]
    }
  }
  return null
}

function visible(nav, a, b) {
  const { w, celdas } = nav
  let [x0, y0] = a
  const [x1, y1] = b
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1
  let err = dx - dy
  for (;;) {
    const c = celdas[y0 * w + x0]
    if (!c || c > 5) return false        // no se corta por celdas pegadas al muro
    if (x0 === x1 && y0 === y1) return true
    const e2 = 2 * err
    if (e2 > -dy) { err -= dy; x0 += sx }
    if (e2 < dx) { err += dx; y0 += sy }
  }
}

export function buscarRuta(d, desde, hasta) {
  const nav = d.nav
  const { w, h, celdas, res } = nav
  const ini = libreMasCercana(nav, ...celda(nav, desde[0], desde[1]))
  const fin = libreMasCercana(nav, ...celda(nav, hasta[0], hasta[1]))
  if (!ini || !fin) return null
  const N = w * h
  const g = new Float32Array(N).fill(Infinity)
  const de = new Int32Array(N).fill(-1)
  const cerrado = new Uint8Array(N)
  const s = ini[1] * w + ini[0], t = fin[1] * w + fin[0]
  const hx = (i) => { const x = i % w, y = (i / w) | 0; const ax = Math.abs(x - fin[0]), ay = Math.abs(y - fin[1]); return Math.max(ax, ay) + 0.4142 * Math.min(ax, ay) }
  const mo = new Monticulo()
  g[s] = 0
  mo.push(s, hx(s))
  const V = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142]]
  while (mo.size) {
    const i = mo.pop()
    if (cerrado[i]) continue
    if (i === t) break
    cerrado[i] = 1
    const x = i % w, y = (i / w) | 0
    for (const [ddx, ddy, c] of V) {
      const nx = x + ddx, ny = y + ddy
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
      const j = ny * w + nx
      const cj = celdas[j]
      if (!cj || cerrado[j]) continue
      if (ddx && ddy && (!celdas[y * w + nx] || !celdas[ny * w + x])) continue
      const ng = g[i] + c * (1 + (cj - 1) * 0.45)
      if (ng < g[j]) { g[j] = ng; de[j] = i; mo.push(j, ng + hx(j)) }
    }
  }
  if (de[t] === -1 && s !== t) return null
  const camino = []
  for (let i = t; i !== -1; i = de[i]) camino.push([i % w, (i / w) | 0])
  camino.reverse()
  // suavizado
  const suave = [camino[0]]
  let k = 0
  while (k < camino.length - 1) {
    let j = camino.length - 1
    while (j > k + 1 && !visible(nav, camino[k], camino[j])) j--
    suave.push(camino[j])
    k = j
  }
  const pts = suave.map(([x, y]) => [nav.x0 + x * res, nav.y0 + y * res])
  pts[0] = [desde[0], desde[1]]
  pts.push([hasta[0], hasta[1]])
  let metros = 0
  for (let i = 1; i < pts.length; i++) metros += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
  return { pts, metros }
}

// indicaciones paso a paso: giros y los ambientes por donde se pasa
export function indicaciones(d, ruta, origen, destino) {
  const P = ruta.pts
  const pasos = [{ tipo: 'inicio', texto: `Sal desde ${origen.nombre}` }]
  let acum = 0
  let zona = null
  for (let i = 1; i < P.length; i++) {
    const [ax, ay] = P[i - 1], [bx, by] = P[i]
    const tramo = Math.hypot(bx - ax, by - ay)
    acum += tramo
    const amb = ambienteEn(d, [(ax + bx) / 2, (ay + by) / 2])
    if (amb && amb.nombre && (amb.cat === 'circulacion' || amb.cat === 'espera')) zona = amb.nombre
    if (i < P.length - 1) {
      const [cx, cy] = P[i + 1]
      const a1 = Math.atan2(by - ay, bx - ax), a2 = Math.atan2(cy - by, cx - bx)
      let da = ((a2 - a1) * 180) / Math.PI
      while (da > 180) da -= 360
      while (da < -180) da += 360
      if (Math.abs(da) > 32 && acum > 1.5) {
        const lado = da > 0 ? 'izquierda' : 'derecha'
        const donde = ambienteEn(d, [bx, by])
        const en = donde && donde.nombre && donde.id !== destino.id ? ` en ${donde.nombre}` : ''
        pasos.push({ tipo: 'camina', texto: `Camina ${Math.max(1, Math.round(acum))} m${zona ? ` por ${zona}` : ''}` })
        pasos.push({ tipo: lado, texto: `Gira a la ${lado}${en}` })
        acum = 0
      }
    }
  }
  if (acum > 0.5) pasos.push({ tipo: 'camina', texto: `Camina ${Math.max(1, Math.round(acum))} m${zona ? ` por ${zona}` : ''}` })
  pasos.push({ tipo: 'fin', texto: `Llegaste a ${destino.nombre}` })
  // juntar "camina" seguidos
  const out = []
  for (const p of pasos) {
    const u = out[out.length - 1]
    if (u && u.tipo === 'camina' && p.tipo === 'camina') u.texto = p.texto
    else out.push(p)
  }
  return out
}

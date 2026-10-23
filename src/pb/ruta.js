// Rutas para pacientes sobre la rejilla de navegación del plano real (celdas de 25 cm).
// Los pacientes caminan solo por la red de pasillos trazada en el plano (líneas verdes) y su franja cercana.
// La ruta termina en la puerta del destino: no entra a consultorios, farmacia, baños ni oficinas.
// Sale de su propio cuarto (origen) por la puerta. Línea: A* sobre la rejilla, estirado por línea de vista y
// curvas en cada giro validadas contra la franja.
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
function libreMasCercana(nav, cx, cy, pasa) {
  const { w, h } = nav
  for (let r = 0; r < 40; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
      const x = cx + dx, y = cy + dy
      if (x >= 0 && y >= 0 && x < w && y < h && pasa(y * w + x)) return [x, y]
    }
  }
  return null
}

// línea de vista entre dos celdas: no puede cruzar muros ni salir de la franja
function visible(nav, pasa, a, b, lim = 3) {
  const { w, celdas } = nav
  let [x0, y0] = a
  const [x1, y1] = b
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1
  let err = dx - dy
  for (;;) {
    const j = y0 * w + x0
    if (!pasa(j) || celdas[j] > lim) return false
    if (x0 === x1 && y0 === y1) return true
    const e2 = 2 * err
    if (e2 > -dy) { err -= dy; x0 += sx }
    if (e2 < dx) { err += dx; y0 += sy }
  }
}

// curva en cada giro: el vértice se reemplaza por una curva cuadrática que empieza y termina en el pasillo.
// Si la curva se saldría de la franja, se prueba un radio más chico y, si no cabe, se deja el giro.
function redondear(P, enPaso) {
  if (P.length < 3) return P
  const out = [P[0]]
  for (let i = 1; i < P.length - 1; i++) {
    const V = P[i], A = P[i - 1], B = P[i + 1]
    const la = Math.hypot(A[0] - V[0], A[1] - V[1]), lb = Math.hypot(B[0] - V[0], B[1] - V[1])
    let hecho = false
    for (const r of [2.2, 1.6, 1.1, 0.7, 0.4]) {
      const f = Math.min(r, 0.5 * la, 0.5 * lb)
      if (f < 0.12) continue
      const a = [V[0] + ((A[0] - V[0]) * f) / la, V[1] + ((A[1] - V[1]) * f) / la]
      const b = [V[0] + ((B[0] - V[0]) * f) / lb, V[1] + ((B[1] - V[1]) * f) / lb]
      const curva = [a]
      for (let k = 1; k <= 8; k++) {
        const t = k / 9
        curva.push([(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * V[0] + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * V[1] + t * t * b[1]])
      }
      curva.push(b)
      if (curva.every(enPaso)) { out.push(...curva); hecho = true; break }
    }
    if (!hecho) out.push(V)
  }
  out.push(P[P.length - 1])
  return out
}

// quita esquinas que no cambian de dirección (menos de 12°) o quedan a menos de 0,6 m de la anterior
function limpiar(P) {
  if (P.length < 3) return P
  const out = [P[0]]
  for (let i = 1; i < P.length - 1; i++) {
    const A = out[out.length - 1], V = P[i], B = P[i + 1]
    if (Math.hypot(V[0] - A[0], V[1] - A[1]) < 0.6) continue
    const a1 = Math.atan2(V[1] - A[1], V[0] - A[0]), a2 = Math.atan2(B[1] - V[1], B[0] - V[0])
    let da = Math.abs(((a2 - a1) * 180) / Math.PI) % 360
    if (da > 180) da = 360 - da
    if (da < 12) continue
    out.push(V)
  }
  out.push(P[P.length - 1])
  return out
}

// ids = [origen, destino]. Si el destino es un ambiente, la ruta termina en su puerta.
export function buscarRuta(d, desde, hasta, ids = [], opts = {}) {
  const nav = d.nav
  const { w, h, celdas, res, cuarto, red, vereda } = nav
  const banda = opts.admin && nav.bandaAdmin ? nav.bandaAdmin : nav.banda
  const qO = nav.indice[ids[0]] || 0      // cuarto de origen: se sale de él
  const qD = nav.indice[ids[1]] || 0      // cuarto de destino: solo se llega hasta su puerta
  const pasa = (j) => !!celdas[j] && (banda[j] === 1 || (qO !== 0 && cuarto[j] === qO))
  const meta = (j) => qD !== 0 && !!celdas[j] && cuarto[j] === qD
  const ini = libreMasCercana(nav, ...celda(nav, desde[0], desde[1]), pasa)
  const fin = qD ? null : libreMasCercana(nav, ...celda(nav, hasta[0], hasta[1]), pasa)
  if (!ini || (!qD && !fin)) return null
  const N = w * h
  const g = new Float32Array(N).fill(Infinity)
  const de = new Int32Array(N).fill(-1)
  const cerrado = new Uint8Array(N)
  const s = ini[1] * w + ini[0]
  const t = fin ? fin[1] * w + fin[0] : -1
  const hx = (i) => {
    if (!fin) return 0
    const x = i % w, y = (i / w) | 0
    const ax = Math.abs(x - fin[0]), ay = Math.abs(y - fin[1])
    return Math.max(ax, ay) + 0.4142 * Math.min(ax, ay)
  }
  const mo = new Monticulo()
  g[s] = 0
  mo.push(s, hx(s))
  const V = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142]]
  let final = -1
  while (mo.size) {
    const i = mo.pop()
    if (cerrado[i]) continue
    if (qD ? meta(i) : i === t) { final = i; break }
    cerrado[i] = 1
    const x = i % w, y = (i / w) | 0
    for (const [ddx, ddy, c] of V) {
      const nx = x + ddx, ny = y + ddy
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
      const j = ny * w + nx
      if (cerrado[j] || !(pasa(j) || meta(j))) continue
      if (ddx && ddy && (!celdas[y * w + nx] || !celdas[ny * w + x])) continue
      const cj = celdas[j]
      // la red de las líneas verdes cuesta menos: la ruta la sigue; la franja, un poco más
      // la vereda exterior es el último recurso: solo se usa para salir/entrar por fuera si por dentro no hay camino razonable
      const ng = g[i] + c * (1 + (cj - 1) * 0.45) * (vereda && vereda[j] ? 6 : red[j] || meta(j) ? 1 : 2.5)
      if (ng < g[j]) { g[j] = ng; de[j] = i; mo.push(j, ng + hx(j)) }
    }
  }
  if (final === -1) return null
  const camino = []
  for (let i = final; i !== -1; i = de[i]) camino.push([i % w, (i / w) | 0])
  camino.reverse()

  // 1) estirado: solo quedan los vértices donde la línea deja de ser recta
  const esq = [camino[0]]
  let k = 0
  while (k < camino.length - 1) {
    let j = camino.length - 1
    // primero una línea que se aleje de las paredes; si no existe, una más cercana a ellas
    while (j > k + 1 && !visible(nav, (q) => pasa(q) || meta(q), camino[k], camino[j], 3)) j--
    if (j === k + 1) { j = camino.length - 1; while (j > k + 1 && !visible(nav, (q) => pasa(q) || meta(q), camino[k], camino[j], 6)) j-- }
    esq.push(camino[j])
    k = j
  }
  const aMetros = ([x, y]) => [nav.x0 + x * res, nav.y0 + y * res]
  const esquinas = limpiar(esq.map(aMetros))
  esquinas[0] = [desde[0], desde[1]]
  if (!qD) esquinas.push([hasta[0], hasta[1]])

  // 2) curvas en los giros (cada una se valida contra la franja)
  const enPaso = (p) => {
    const cx = Math.round((p[0] - nav.x0) / res), cy = Math.round((p[1] - nav.y0) / res)
    if (cx < 0 || cy < 0 || cx >= w || cy >= h) return false
    const j = cy * w + cx
    return pasa(j) || meta(j)
  }
  const pts = redondear(esquinas, enPaso)

  let metros = 0
  for (let i = 1; i < pts.length; i++) metros += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
  return { pts, esquinas, metros }
}

// indicaciones paso a paso: giros reales (sobre la línea estirada, no sobre el suavizado) y ambientes por donde se pasa
export function indicaciones(d, ruta, origen, destino) {
  const P = ruta.esquinas || ruta.pts
  const pasos = [{ tipo: 'inicio', texto: `Sal desde ${origen.nombre}` }]
  let acum = 0
  let zona = null
  for (let i = 1; i < P.length; i++) {
    const [ax, ay] = P[i - 1], [bx, by] = P[i]
    acum += Math.hypot(bx - ax, by - ay)
    const amb = ambienteEn(d, [(ax + bx) / 2, (ay + by) / 2])
    if (amb && amb.nombre && (amb.cat === 'circulacion' || amb.cat === 'espera')) zona = amb.nombre
    if (i < P.length - 1) {
      const [cx, cy] = P[i + 1]
      const a1 = Math.atan2(by - ay, bx - ax), a2 = Math.atan2(cy - by, cx - bx)
      let da = ((a2 - a1) * 180) / Math.PI
      while (da > 180) da -= 360
      while (da < -180) da += 360
      if (Math.abs(da) > 35 && acum > 1.5) {
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
  pasos.push({ tipo: 'fin', texto: `Llegaste a la puerta de ${destino.nombre}` })
  // juntar "camina" seguidos
  const out = []
  for (const p of pasos) {
    const u = out[out.length - 1]
    if (u && u.tipo === 'camina' && p.tipo === 'camina') u.texto = p.texto
    else out.push(p)
  }
  return out
}

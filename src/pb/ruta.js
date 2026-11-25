// Rutas para pacientes sobre la rejilla de navegación del plano real (celdas de 25 cm).
// Los pacientes caminan solo por la red de pasillos trazada en el plano (líneas verdes) y su franja cercana.
// La ruta termina en la puerta del destino: no entra a consultorios, farmacia, baños ni oficinas.
// Sale de su propio cuarto (origen) por la puerta. Línea: A* sobre la rejilla con un costo que crece cerca de las
// paredes (la ruta busca el centro de los pasillos), estirado por línea de vista sin acercarse a los muros más que el
// camino de la rejilla y curvas en cada giro validadas igual.
import { ambienteEn } from './datos.js'

// Costo por metro según dónde se camina. La red de líneas verdes cuesta 1; el resto de la franja (halls, salas de
// espera, pasillos abiertos sin línea trazada) apenas un poco más, para que la ruta siga los pasillos cuando el largo es
// parecido pero corte por el hall cuando eso ahorra camino. (Antes era 2,5: una ruta podía dar una vuelta de más del
// doble por la red antes que cruzar un hall.) La vereda exterior es el último recurso.
export const COSTO_FRANJA = 1.15
export const COSTO_VEREDA = 6
// Centro de los pasillos: cada paso cuesta más cuanto más cerca de un muro o del borde de la franja (holgura menor que
// ANCHO_CENTRO). En un pasillo de hasta 2·ANCHO_CENTRO de ancho el camino más barato va por su eje.
export const ANCHO_CENTRO = 1.2
export const PESO_PARED = 2.5
// La línea estirada no se acerca a las paredes a menos de HOLGURA (o de la fracción FRACCION_HOLGURA de la holgura
// del camino de la rejilla en ese tramo, si el pasillo es más angosto). Sin esto, la línea de vista cortaba las
// esquinas rozando el muro y, con la tolerancia de 6, cruzaba en diagonal pegada a las paredes.
export const HOLGURA = 0.75
export const FRACCION_HOLGURA = 0.85

// celda sobre un muro del dibujo que la rejilla no tiene (ver murosDibujados): se pasa solo si no hay otro camino
export const COSTO_MURO_DIBUJADO = 4

// multiplicador de costo por la cercanía a las paredes (dMuro en cm)
const porPared = (dMuro, j, dib) => {
  if (!dMuro) return 1
  const f = (ANCHO_CENTRO - dMuro[j] / 100) / ANCHO_CENTRO
  return (f > 0 ? 1 + PESO_PARED * f * f : 1) * (dib && dib[j] ? COSTO_MURO_DIBUJADO : 1)
}

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
// celda de paso más cercana a un punto. Primero se camina por el piso libre desde el punto (sin cruzar muros, hasta
// 10 m): así un punto de acceso dentro de un cuarto encuentra la salida de su propio cuarto y no la celda del pasillo
// del otro lado del muro. Si el punto cae en un muro o no hay salida, la más cercana en línea recta.
function libreMasCercana(nav, cx, cy, pasa) {
  const { w, h, celdas } = nav
  if (cx >= 0 && cy >= 0 && cx < w && cy < h && celdas[cy * w + cx]) {
    const i0 = cy * w + cx
    const visto = new Map([[i0, 0]])
    const cola = [i0]
    for (let k = 0; k < cola.length; k++) {
      const i = cola[k]
      if (pasa(i)) return [i % w, (i / w) | 0]
      const x = i % w, y = (i / w) | 0, n = visto.get(i)
      if (n >= 40) continue
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
        const j = ny * w + nx
        if (!celdas[j] || visto.has(j)) continue
        visto.set(j, n + 1); cola.push(j)
      }
    }
  }
  for (let r = 0; r < 40; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
      const x = cx + dx, y = cy + dy
      if (x >= 0 && y >= 0 && x < w && y < h && pasa(y * w + x)) return [x, y]
    }
  }
  return null
}

// curva en cada giro: el vértice se reemplaza por una curva cuadrática que empieza y termina en el pasillo.
// Si la curva se saldría de la franja, se prueba un radio más chico y, si no cabe, se deja el giro.
function redondear(P, enPaso, reqs = []) {
  if (P.length < 3) return P
  const out = [P[0]]
  for (let i = 1; i < P.length - 1; i++) {
    const V = P[i], A = P[i - 1], B = P[i + 1]
    const req = Math.min(reqs[i - 1] ?? 0, reqs[i] ?? 0)
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
      if (curva.every((p) => enPaso(p, req))) { out.push(...curva); hecho = true; break }
    }
    if (!hecho) out.push(V)
  }
  out.push(P[P.length - 1])
  return out
}

// quita esquinas que no cambian de dirección (menos de 12°) o quedan a menos de 0,6 m de la anterior, solo si la línea
// directa sin esa esquina sigue libre y con la holgura de los tramos que reemplaza (recto): en un tramo largo, 12° de
// diferencia corren la línea más de un metro y podía atravesar un muro. R: holgura exigida a cada tramo de P.
function limpiar(P, R = [], recto = () => true) {
  if (P.length < 3) return { P, R }
  const out = [P[0]], outR = []
  let rA = R[0] ?? 0   // holgura del tramo que llega a la esquina pendiente
  for (let i = 1; i < P.length - 1; i++) {
    const A = out[out.length - 1], V = P[i], B = P[i + 1]
    const r = Math.min(rA, R[i] ?? 0)
    let quitar = false
    if (recto(A, B, r)) {
      if (Math.hypot(V[0] - A[0], V[1] - A[1]) < 0.6) quitar = true
      else {
        const a1 = Math.atan2(V[1] - A[1], V[0] - A[0]), a2 = Math.atan2(B[1] - V[1], B[0] - V[0])
        let da = Math.abs(((a2 - a1) * 180) / Math.PI) % 360
        if (da > 180) da = 360 - da
        if (da < 12) quitar = true
      }
    }
    if (quitar) { rA = r; continue }
    out.push(V); outR.push(rA); rA = R[i] ?? 0
  }
  out.push(P[P.length - 1]); outR.push(rA)
  return { P: out, R: outR }
}

// ¿el tramo recto a→b (en metros) no pisa muros? Los últimos 30 cm no cuentan: el punto puede estar en el borde del
// mostrador o del muro
function sinMuro(nav, a, b) {
  const { w, h, celdas, res, x0, y0 } = nav
  const L = Math.hypot(b[0] - a[0], b[1] - a[1])
  const n = Math.max(1, Math.ceil(L / (res / 2)))
  for (let k = 0; k <= n; k++) {
    if (L * (1 - k / n) < 0.3) break
    const x = Math.round((a[0] + ((b[0] - a[0]) * k) / n - x0) / res), y = Math.round((a[1] + ((b[1] - a[1]) * k) / n - y0) / res)
    if (x < 0 || y < 0 || x >= w || y >= h || !celdas[y * w + x]) return false
  }
  return true
}

// puerta de un cuarto de origen: sus celdas libres que tocan la franja de paso. Se sale desde ahí y no desde el
// punto de acceso, que puede quedar en un rincón del cuarto separado de la puerta por el mobiliario.
function puertasDe(nav, q, banda) {
  const { w, h, celdas, cuarto } = nav
  const out = []
  if (!q) return out
  for (let i = 0; i < w * h; i++) {
    if (cuarto[i] !== q || !celdas[i]) continue
    const x = i % w, y = (i / w) | 0
    for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
      if (j >= 0 && banda[j] === 1 && cuarto[j] !== q) { out.push(i); break }
    }
  }
  return out
}

// ids = [origen, destino]. Si el destino es un ambiente, la ruta termina en su puerta.
export function buscarRuta(d, desde, hasta, ids = [], opts = {}) {
  const nav = d.nav
  const { w, h, celdas, res, cuarto, red, vereda, dMuro } = nav
  const banda = opts.admin && nav.bandaAdmin ? nav.bandaAdmin : nav.banda
  // un ambiente con ventanilla (Farmacia) no se cruza ni se entra: la ruta empieza o termina en el punto frente a ella
  const vent = (q) => (nav.ventanilla && nav.ventanilla.has(q) ? 0 : q)
  const qO = vent(nav.indice[ids[0]] || 0)      // cuarto de origen: se sale de él
  const qD = vent(nav.indice[ids[1]] || 0)      // cuarto de destino: solo se llega hasta su puerta
  // ruta accesible: sin escalones (gradas y escaleras); el destino puede ser la propia escalera
  const esc = opts.accesible && nav.escalon ? nav.escalon : null
  const pasa = (j) => !!celdas[j] && (banda[j] === 1 || (qO !== 0 && cuarto[j] === qO)) && !(esc && esc[j] && cuarto[j] !== qD)
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
  const V = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142]]
  const aEstrella = (semillas) => {
    g.fill(Infinity); de.fill(-1); cerrado.fill(0)
    const mo = new Monticulo()
    for (const k of semillas) { g[k] = 0; mo.push(k, hx(k)) }
    while (mo.size) {
      const i = mo.pop()
      if (cerrado[i]) continue
      if (qD ? meta(i) : i === t) return i
      cerrado[i] = 1
      const x = i % w, y = (i / w) | 0
      for (const [ddx, ddy, c] of V) {
        const nx = x + ddx, ny = y + ddy
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
        const j = ny * w + nx
        if (cerrado[j] || !(pasa(j) || meta(j))) continue
        if (ddx && ddy && (!celdas[y * w + nx] || !celdas[ny * w + x])) continue
        const cj = celdas[j]
        // la red de las líneas verdes cuesta menos: la ruta la sigue; la franja, apenas más (ver COSTO_FRANJA)
        // la vereda exterior es el último recurso: solo se usa para salir/entrar por fuera si por dentro no hay camino razonable
        const ng = g[i] + c * (dMuro ? porPared(dMuro, j, nav.muroDibujado) : 1 + (cj - 1) * 0.45) * (vereda && vereda[j] ? COSTO_VEREDA : red[j] || meta(j) ? 1 : COSTO_FRANJA)
        if (ng < g[j]) { g[j] = ng; de[j] = i; mo.push(j, ng + hx(j)) }
      }
    }
    return -1
  }
  // origen en un cuarto cerrado: se sale caminando por dentro del cuarto hasta su puerta; si el punto de acceso quedó
  // encerrado por el mobiliario, se parte de todas sus puertas a la vez
  let porPuertas = false
  let final = aEstrella([s])
  if (final === -1 && qO && !nav.paso[qO]) {
    const puertas = puertasDe(nav, qO, banda)
    if (puertas.length) { porPuertas = true; final = aEstrella(puertas) }
  }
  if (final === -1) return null
  const camino = []
  for (let i = final; i !== -1; i = de[i]) camino.push([i % w, (i / w) | 0])
  camino.reverse()

  // holgura (m) de una celda; sin dMuro (datos viejos) no se exige
  const holgura = (j) => (dMuro ? dMuro[j] / 100 : Infinity)
  const libreEn = (j) => pasa(j) || meta(j)
  // ¿el tramo recto a→b (en celdas, con decimales) es caminable con al menos `req` metros de holgura? Se revisa cada
  // medio lado de celda y las celdas vecinas del punto (piso y techo): así la línea no pasa entre dos esquinas de
  // muro en diagonal. maxRed: sin alejarse de la red de pasillos más que esas celdas.
  const tramoLibre = (a, b, req, maxRed = 255) => {
    const dRed = nav.dRed
    const L = Math.hypot(b[0] - a[0], b[1] - a[1])
    const n = Math.max(1, Math.ceil(L * 2))
    for (let k = 0; k <= n; k++) {
      const u = a[0] + ((b[0] - a[0]) * k) / n, v = a[1] + ((b[1] - a[1]) * k) / n
      const xs = [Math.floor(u), Math.ceil(u)], ys = [Math.floor(v), Math.ceil(v)]
      for (const x of xs) for (const y of ys) {
        if (x < 0 || y < 0 || x >= w || y >= h) return false
        if (!celdas[y * w + x]) return false
      }
      const x = Math.round(u), y = Math.round(v), j = y * w + x
      const r = typeof req === 'function' ? req(k / n) : req
      if (!libreEn(j) || holgura(j) < r - 1e-6 || (dRed && dRed[j] > maxRed)) return false
    }
    return true
  }

  // 1) estirado: solo quedan los vértices donde la línea deja de ser recta. Un atajo vale si en cada punto no se
  // acerca a las paredes más que el tramo del camino de la rejilla que reemplaza en ese lugar (o que HOLGURA): en un
  // pasillo la línea queda en el eje y solo se arrima a la puerta al llegar a ella; en un hall no roza las esquinas.
  const hc = camino.map(([x, y]) => holgura(y * w + x))
  const VENT = 3   // celdas del camino a cada lado que cuentan para la holgura local
  const local = (q) => {
    let m = Infinity
    for (let i = Math.max(0, q - VENT); i <= Math.min(camino.length - 1, q + VENT); i++) m = Math.min(m, hc[i])
    return Math.min(HOLGURA, FRACCION_HOLGURA * m)
  }
  const esq = [camino[0]]
  const reqs = []   // holgura exigida a cada tramo de esq (la menor del tramo: sirve para las curvas)
  let k = 0
  while (k < camino.length - 1) {
    // holgura mínima del camino de la rejilla desde k
    const minDesde = new Float64Array(camino.length)
    let m = Infinity
    for (let q = k; q < camino.length; q++) { m = Math.min(m, hc[q]); minDesde[q] = m }
    const req = (q) => Math.min(HOLGURA, FRACCION_HOLGURA * minDesde[q])
    const reqLocal = (q) => (t) => local(Math.round(k + t * (q - k)))
    // la línea no se aleja de la red de pasillos más que sus extremos (y al menos 1 m de tolerancia): sigue los
    // pasillos en vez de cortar los halls en diagonal
    const tope = (q) => {
      const dr = nav.dRed
      if (!dr) return 255
      const da = dr[camino[k][1] * w + camino[k][0]], db = dr[camino[q][1] * w + camino[q][0]]
      return Math.max(4, da, db) + 1
    }
    let j = camino.length - 1
    while (j > k + 1 && !tramoLibre(camino[k], camino[j], reqLocal(j), tope(j))) j--
    esq.push(camino[j])
    reqs.push(j === k + 1 ? 0 : req(j))
    k = j
  }
  const aMetros = ([x, y]) => [nav.x0 + x * res, nav.y0 + y * res]
  const aCelda = (p) => [(p[0] - nav.x0) / res, (p[1] - nav.y0) / res]
  const { P: esquinas, R: reqEsq } = limpiar(esq.map(aMetros), reqs, (A, B, r) => tramoLibre(aCelda(A), aCelda(B), r))
  // la línea empieza en el origen: si la rejilla arrancó lejos de él (en la puerta o en la celda libre más cercana), se
  // agrega ese tramo corto en vez de mover la primera esquina, que llevaba la línea recta a través de los muros. Si
  // ese tramo atravesaría un muro (punto de acceso en un rincón del cuarto o sobre el mostrador), la línea empieza en
  // la puerta o en el piso libre junto al punto
  const [ex, ey] = esquinas[0]
  if (porPuertas || Math.hypot(ex - desde[0], ey - desde[1]) > 0.3) {
    if (sinMuro(nav, esquinas[0], desde)) { esquinas.unshift([desde[0], desde[1]]); reqEsq.unshift(0) }
  } else esquinas[0] = [desde[0], desde[1]]
  // el destino suelto (un lugar, una ventanilla) se une con un tramo recto solo si no atraviesa un muro: un punto
  // marcado sobre el mostrador o la pared queda del otro lado, y la ruta termina en el piso frente a él
  if (!qD) {
    const u = esquinas[esquinas.length - 1]
    if (Math.hypot(hasta[0] - u[0], hasta[1] - u[1]) <= 0.3 || sinMuro(nav, u, hasta)) { esquinas.push([hasta[0], hasta[1]]); reqEsq.push(0) }
  }

  // 2) curvas en los giros: cada punto de la curva, en la franja y con la holgura de los dos tramos que une
  const enPaso = (p, req = 0) => {
    const cx = Math.round((p[0] - nav.x0) / res), cy = Math.round((p[1] - nav.y0) / res)
    if (cx < 0 || cy < 0 || cx >= w || cy >= h) return false
    const j = cy * w + cx
    return libreEn(j) && holgura(j) >= req - 1e-6
  }
  const pts = redondear(esquinas, enPaso, reqEsq)

  let metros = 0
  for (let i = 1; i < pts.length; i++) metros += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
  return { pts, esquinas, metros }
}

// indicaciones paso a paso: giros reales (sobre la línea estirada, no sobre el suavizado) y ambientes por donde se pasa
export function indicaciones(d, ruta, origen, destino) {
  const P = ruta.esquinas || ruta.pts
  // cada paso lleva «en»: metros desde el inicio del tramo hasta donde ocurre (el giro o la llegada); con eso la
  // barra de navegación muestra la próxima indicación y cuánto falta para ella
  const pasos = [{ tipo: 'inicio', texto: `Sal desde ${origen.nombre}`, en: 0 }]
  let acum = 0
  let tot = 0
  let zona = null
  for (let i = 1; i < P.length; i++) {
    const [ax, ay] = P[i - 1], [bx, by] = P[i]
    const l = Math.hypot(bx - ax, by - ay)
    acum += l
    tot += l
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
        pasos.push({ tipo: 'camina', texto: `Camina ${Math.max(1, Math.round(acum))} m${zona ? ` por ${zona}` : ''}`, en: tot })
        pasos.push({ tipo: lado, texto: `Gira a la ${lado}${en}`, en: tot })
        acum = 0
      }
    }
  }
  if (acum > 0.5) pasos.push({ tipo: 'camina', texto: `Camina ${Math.max(1, Math.round(acum))} m${zona ? ` por ${zona}` : ''}`, en: tot })
  pasos.push({ tipo: 'fin', texto: `Llegaste a la puerta de ${destino.nombre}`, en: tot })
  // juntar "camina" seguidos
  const out = []
  for (const p of pasos) {
    const u = out[out.length - 1]
    if (u && u.tipo === 'camina' && p.tipo === 'camina') { u.texto = p.texto; u.en = p.en }
    else out.push(p)
  }
  return out
}

/**
 * Próxima indicación del recorrido: la primera maniobra (giro, cambio de piso o llegada) que todavía no se alcanza.
 * @param pasos pasos del tramo (con «en», en metros de las esquinas de la ruta)
 * @param s metros caminados según el personaje; L largo de la ruta dibujada (algo distinto al de las esquinas)
 * @returns { k, paso, faltan } índice del paso, el paso y los metros que faltan para llegar a él
 */
export function proximoPaso(pasos, s, L) {
  if (!pasos?.length) return null
  const largo = pasos[pasos.length - 1].en || 0
  const k = largo > 0 && L > 0 ? L / largo : 1
  for (let i = 0; i < pasos.length; i++) {
    const p = pasos[i]
    if (p.tipo === 'inicio' || p.tipo === 'camina') continue
    const faltan = (p.en ?? 0) * k - s
    if (faltan > 0.8 || i === pasos.length - 1) return { k: i, paso: p, faltan: Math.max(0, faltan) }
  }
  return null
}

/**
 * Metros caminando desde un punto hasta la puerta de varios ambientes a la vez (una sola búsqueda, Dijkstra).
 * Sirve para elegir el ascensor o la escalera: se mide la distancia a todas sus paradas del piso en una pasada.
 * @param objetivos ids de ambientes (paradas de ascensores o escaleras)
 * @returns { [id]: metros } solo de los que se alcanzan
 */
export function metrosHasta(d, desde, idOrigen, objetivos, opts = {}) {
  const nav = d.nav
  const { w, h, celdas, res, cuarto, red, vereda, dMuro } = nav
  const banda = opts.admin && nav.bandaAdmin ? nav.bandaAdmin : nav.banda
  const vent = (q) => (nav.ventanilla && nav.ventanilla.has(q) ? 0 : q)
  const qO = vent(nav.indice[idOrigen] || 0)
  const metaDe = new Map()
  for (const id of objetivos) { const q = nav.indice[id]; if (q) metaDe.set(q, id) }
  const esc = opts.accesible && nav.escalon ? nav.escalon : null
  const pasa = (j) => !!celdas[j] && (banda[j] === 1 || (qO !== 0 && cuarto[j] === qO)) && !(esc && esc[j])
  const ini = libreMasCercana(nav, ...celda(nav, desde[0], desde[1]), pasa)
  const out = {}
  if (!ini) return out
  const N = w * h
  const g = new Float32Array(N).fill(Infinity)
  const m = new Float32Array(N)
  const cerrado = new Uint8Array(N)
  const s = ini[1] * w + ini[0]
  const mo = new Monticulo()
  const semillas = qO && !nav.paso[qO] ? puertasDe(nav, qO, banda) : []
  for (const k of semillas.length ? semillas : [s]) { g[k] = 0; mo.push(k, 0) }
  const V = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142]]
  let faltan = metaDe.size
  while (mo.size && faltan > 0) {
    const i = mo.pop()
    if (cerrado[i]) continue
    cerrado[i] = 1
    const q = cuarto[i]
    if (metaDe.has(q) && !(metaDe.get(q) in out)) { out[metaDe.get(q)] = m[i]; faltan--; continue }
    const x = i % w, y = (i / w) | 0
    for (const [ddx, ddy, c] of V) {
      const nx = x + ddx, ny = y + ddy
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
      const j = ny * w + nx
      const esMeta = metaDe.has(cuarto[j]) && !!celdas[j]
      if (cerrado[j] || !(pasa(j) || esMeta)) continue
      if (ddx && ddy && (!celdas[y * w + nx] || !celdas[ny * w + x])) continue
      const cj = celdas[j]
      const ng = g[i] + c * (dMuro ? porPared(dMuro, j, nav.muroDibujado) : 1 + (cj - 1) * 0.45) * (vereda && vereda[j] ? COSTO_VEREDA : red[j] || esMeta ? 1 : COSTO_FRANJA)
      if (ng < g[j]) { g[j] = ng; m[j] = m[i] + c * res; mo.push(j, ng) }
    }
  }
  return out
}

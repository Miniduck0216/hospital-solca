// Datos de la planta baja real (exportados desde el plano del hospital) y georreferencia sobre el mapa.
export const BASE = import.meta.env.BASE_URL

export async function cargarDatos(cambiosLocales = null) {
  const r = await fetch(`${BASE}pb/datos.json?v=${__VERSION__}`)
  if (!r.ok) throw new Error('No se pudo cargar el plano')
  const d = await r.json()
  // cambios del administrador: los publicados en el repositorio y los guardados en este navegador
  const publicados = await fetch(`${BASE}pb/cambios.json?v=${__VERSION__}`).then((x) => (x.ok ? x.json() : null)).catch(() => null)
  aplicarCambios(d, publicados)
  aplicarCambios(d, cambiosLocales)
  const bin = atob(d.nav.celdas)
  const celdas = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) celdas[i] = bin.charCodeAt(i)
  d.nav.celdas = celdas
  const bin2 = atob(d.nav.cuarto)
  const cuarto = new Uint8Array(bin2.length)
  for (let i = 0; i < bin2.length; i++) cuarto[i] = bin2.charCodeAt(i)
  d.nav.cuarto = cuarto
  // espacios que la franja de paso puede cruzar: pasillos, halls, salas de espera y accesos verticales
  const ABIERTOS = ['circulacion', 'espera', 'escaleras', 'ascensores']
  d.nav.paso = new Uint8Array(d.ambientes.length + 1)
  d.nav.paso[0] = 1
  d.ambientes.forEach((a, k) => { d.nav.paso[k + 1] = (ABIERTOS.includes(a.cat) && !SOLO_PERSONAL.test(a.nombre || '')) || (!a.nombre && a.area >= 30) ? 1 : 0 })
  // red de pasillos para pacientes (trazada sobre el plano): 1 = pasillo de la red
  const bin3 = atob(d.nav.red)
  d.nav.red = new Uint8Array(bin3.length)
  for (let i = 0; i < bin3.length; i++) d.nav.red[i] = bin3.charCodeAt(i)
  // vereda exterior (franja alrededor del edificio): también es paso para llegar a las puertas exteriores
  const bin4 = atob(d.nav.vereda)
  d.nav.vereda = new Uint8Array(bin4.length)
  for (let i = 0; i < bin4.length; i++) d.nav.vereda[i] = bin4.charCodeAt(i)
  // franja de paso (ver bandaDeRed)
  d.nav.banda = bandaDeRed(d)
  // el interior de un cuarto cerrado no es paso: la ruta solo llega a su puerta (ver buscarRuta, meta)
  // (salvo los ganchos trazados en verde o rojo que entran a un consultorio: son su acceso)
  for (let i = 0; i < d.nav.banda.length; i++) if (d.nav.cuarto[i] && !d.nav.paso[d.nav.cuarto[i]] && !d.nav.red[i]) d.nav.banda[i] = 0
  unirPorDentro(d, d.nav.banda)
  abrirPuertas(d, d.nav.banda)
  d.nav.indice = Object.fromEntries(d.ambientes.map((a, k) => [a.id, k + 1]))
  d.nav.alcanzable = alcanzables(d)
  // administración: la franja más los pasillos de personal (sin cuartos cerrados)
  d.nav.bandaAdmin = Uint8Array.from(d.nav.banda)
  for (let i = 0; i < d.nav.bandaAdmin.length; i++) {
    const c = d.nav.cuarto[i]
    if (!d.nav.bandaAdmin[i] && d.nav.celdas[i] && c && SOLO_PERSONAL.test(d.ambientes[c - 1].nombre || '')) d.nav.bandaAdmin[i] = 1
  }
  return d
}

// Un tramo trazado (verde o rojo) que solo se une al resto por la vereda exterior se conecta también por dentro:
// el paciente entra por donde se trazó, sin salir del hospital. Se busca el paso más corto (hasta 6 m) por pasillos,
// halls o pasillos de bloque, nunca por un cuarto cerrado.
function unirPorDentro(d, banda) {
  const { w, h, celdas, cuarto, red, paso, vereda } = d.nav
  const N = w * h
  const staff = new Uint8Array(d.ambientes.length + 1)
  d.ambientes.forEach((a, k) => { staff[k + 1] = SOLO_PERSONAL.test(a.nombre || '') ? 1 : 0 })
  const dentro = (j) => banda[j] && !vereda[j]
  // un muro que el trazo cruza (una puerta que el modelo no tiene) también se puede abrir: solo junto al trazo
  const cerca = new Uint8Array(N)
  for (let i = 0; i < N; i++) {
    if (!red[i]) continue
    const x = i % w, y = (i / w) | 0
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const nx = x + dx, ny = y + dy
      if (nx >= 0 && ny >= 0 && nx < w && ny < h) cerca[ny * w + nx] = 1
    }
  }
  const cruzable = (j) => !vereda[j] && (celdas[j] ? (cuarto[j] === 0 || !!paso[cuarto[j]] || !!staff[cuarto[j]]) : cerca[j] === 1)
  const V8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]
  const comp = new Int32Array(N).fill(-1)
  const tam = [0]
  for (let i = 0; i < N; i++) {
    if (!dentro(i) || comp[i] >= 0) continue
    const c = tam.length; tam.push(0)
    const pila = [i]; comp[i] = c
    while (pila.length) {
      const p = pila.pop(); tam[c]++
      const x = p % w, y = (p / w) | 0
      for (const [dx, dy] of V8.slice(0, 4)) {
        const nx = x + dx, ny = y + dy
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
        const j = ny * w + nx
        if (dentro(j) && comp[j] < 0) { comp[j] = c; pila.push(j) }
      }
    }
  }
  let main = 1
  for (let c = 1; c < tam.length; c++) if (tam[c] > tam[main]) main = c
  const conRed = new Uint8Array(tam.length)
  for (let i = 0; i < N; i++) if (comp[i] > 0 && red[i]) conRed[comp[i]] = 1
  const LIM = Math.round(6 / d.nav.res)
  const dist = new Int32Array(N)
  const prev = new Int32Array(N)
  for (let c = 1; c < tam.length; c++) {
    if (c === main || !conRed[c]) continue
    dist.fill(-1)
    const cola = []
    for (let i = 0; i < N; i++) if (comp[i] === c) { dist[i] = 0; prev[i] = -1; cola.push(i) }
    let fin = -1
    for (let q = 0; q < cola.length && fin < 0; q++) {
      const p = cola[q]
      if (dist[p] >= LIM) continue
      const x = p % w, y = (p / w) | 0
      for (const [dx, dy] of V8) {
        const nx = x + dx, ny = y + dy
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
        if (dx && dy && (!cruzable(y * w + nx) || !cruzable(ny * w + x))) continue
        const j = ny * w + nx
        if (dist[j] >= 0) continue
        if (comp[j] === main) { prev[j] = p; fin = j; break }
        if (!cruzable(j)) continue
        dist[j] = dist[p] + 1; prev[j] = p; cola.push(j)
      }
    }
    if (fin < 0) continue
    for (let i = prev[fin]; i >= 0 && comp[i] !== c; i = prev[i]) {
      // un poco de ancho para que el trazo suavizado no roce los muros
      for (const j of [i, i - 1, i + 1, i - w, i + w]) {
        if (!cruzable(j)) continue
        if (!celdas[j]) celdas[j] = 3
        banda[j] = 1
      }
    }
  }
}

// cambios del administrador (ver Admin.jsx): nombre, categoría y punto de acceso de un ambiente
function aplicarCambios(d, cambios) {
  if (!cambios || !cambios.ambientes) return
  for (const [id, c] of Object.entries(cambios.ambientes)) {
    const a = d.ambientes.find((x) => x.id === id)
    if (!a) continue
    if (typeof c.nombre === 'string' && c.nombre.trim()) a.nombre = c.nombre.trim()
    if (c.cat && CATS[c.cat]) a.cat = c.cat
    if (Array.isArray(c.dest) && c.dest.length === 2) a.dest = c.dest
  }
}

// franja de paso: la red verde y los pasillos y halls abiertos conectados a ella. Los pasillos internos de los bloques
// son solo del personal y no entran. Un cuarto cerrado (consultorio, farmacia, oficina) aporta solo su puerta: la franja
// no sigue hacia adentro. Si un cuarto queda sin camino por pasillos públicos, se traza un acceso hasta la franja.
const SOLO_PERSONAL = /^Pasillo Bloque/

function bandaDeRed(d) {
  const { w, h, celdas, cuarto, red, paso, vereda } = d.nav
  const N = w * h
  const staff = new Uint8Array(d.ambientes.length + 1)
  d.ambientes.forEach((a, k) => { staff[k + 1] = SOLO_PERSONAL.test(a.nombre || '') ? 1 : 0 })
  // el pasillo de bloque solo es de personal, salvo donde se trazó verde o rojo (eso es un recorrido de paciente)
  const libre = (j) => !!celdas[j] && (!staff[cuarto[j]] || red[j] === 1)
  const publico = (j) => libre(j) && (cuarto[j] === 0 || !!paso[cuarto[j]])
  const orto = (i) => {
    const x = i % w, y = (i / w) | 0, r = []
    if (x > 0) r.push(i - 1)
    if (x < w - 1) r.push(i + 1)
    if (y > 0) r.push(i - w)
    if (y < h - 1) r.push(i + w)
    return r
  }
  const vecinos = (i) => {
    const x = i % w, y = (i / w) | 0, r = []
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = x + dx, ny = y + dy
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
      if (dx && dy && (!celdas[y * w + nx] || !celdas[ny * w + x])) continue
      r.push(ny * w + nx)
    }
    return r
  }
  // 1) la franja desde la red, por espacios públicos
  const banda = new Uint8Array(N)
  const cola = []
  for (let i = 0; i < N; i++) if ((red[i] || vereda[i]) && libre(i)) { banda[i] = 1; cola.push(i) }
  for (let k = 0; k < cola.length; k++) {
    const i = cola[k]
    if (cuarto[i] && !paso[cuarto[i]]) continue   // cuarto cerrado: la franja no sigue hacia adentro
    for (const j of vecinos(i)) {
      if (banda[j] || !libre(j)) continue
      banda[j] = 1; cola.push(j)
    }
  }
  // 2) componentes de la franja (4 vecinos): la principal es la de más celdas
  const comp = new Int32Array(N).fill(-1)
  const tam = [0]
  for (let i = 0; i < N; i++) {
    if (!banda[i] || comp[i] >= 0) continue
    const c = tam.length; tam.push(0)
    const pila = [i]; comp[i] = c
    while (pila.length) {
      const p = pila.pop(); tam[c]++
      for (const j of orto(p)) if (banda[j] && comp[j] < 0) { comp[j] = c; pila.push(j) }
    }
  }
  let main = 1
  for (let c = 1; c < tam.length; c++) if (tam[c] > tam[main]) main = c
  // 3) cuartos que no tocan la componente principal: acceso desde su puerta por espacios públicos
  const porCuarto = d.ambientes.map(() => [])
  for (let i = 0; i < N; i++) if (cuarto[i]) porCuarto[cuarto[i] - 1].push(i)
  const enMain = (j) => banda[j] && comp[j] === main
  const alcanza = (cells) => cells.some((i) => enMain(i) || orto(i).some(enMain))
  const vis = new Int32Array(N)
  const prev = new Int32Array(N)
  let stamp = 0
  d.ambientes.forEach((a, k) => {
    const cells = porCuarto[k]
    if (!a.nombre || staff[k + 1] || !cells.length || alcanza(cells)) return
    stamp++
    const frente = []
    for (const i of cells) for (const n of orto(i)) {
      if (cuarto[n] !== k + 1 && publico(n) && vis[n] !== stamp) { vis[n] = stamp; prev[n] = -1; frente.push(n) }
    }
    let fin = -1
    for (let q = 0; q < frente.length && fin < 0; q++) {
      const p = frente[q]
      if (enMain(p)) { fin = p; break }
      for (const j of vecinos(p)) {
        if (vis[j] === stamp || !publico(j)) continue
        vis[j] = stamp; prev[j] = p; frente.push(j)
      }
    }
    if (fin < 0) return
    for (let p = fin; p !== -1; p = prev[p]) { banda[p] = 1; comp[p] = main }
  })
  return banda
}

// cuartos cuya puerta no se ve en el plano: se abre un vano a través del muro hasta el pasillo público más cercano.
// Solo atraviesa muro: no pasa por otros cuartos ni por pasillos de bloque.
const PUERTAS_AUTO = ['Cajas', 'Consultorio · 35', 'Tesorería', 'Secretaría – Control', 'Minusválidos', 'SS.HH.']

function abrirPuertas(d, banda) {
  const { w, h, celdas, cuarto, paso } = d.nav
  const N = w * h
  const orto = (i) => {
    const x = i % w, y = (i / w) | 0, r = []
    if (x > 0) r.push(i - 1)
    if (x < w - 1) r.push(i + 1)
    if (y > 0) r.push(i - w)
    if (y < h - 1) r.push(i + w)
    return r
  }
  const personal = (c) => c > 0 && SOLO_PERSONAL.test(d.ambientes[c - 1].nombre || '')
  const publico = (j) => celdas[j] > 0 && !personal(cuarto[j]) && (cuarto[j] === 0 || !!paso[cuarto[j]])
  // muro que se puede abrir: cualquier celda sin paso (muro); el interior de los cuartos no se toca
  const muro = (j) => celdas[j] === 0 && !personal(cuarto[j])
  d.ambientes.forEach((a, k) => {
    if (!PUERTAS_AUTO.includes(a.nombre)) return
    const prev = new Int32Array(N).fill(-2)
    const dist = new Int32Array(N).fill(-1)
    const cola = []
    let ya = false
    for (let i = 0; i < N; i++) {
      if (cuarto[i] !== k + 1) continue
      for (const j of orto(i)) {
        if (banda[j] && !personal(cuarto[j])) ya = true
        if (muro(j) && dist[j] < 0) { dist[j] = 1; prev[j] = -1; cola.push(j) }
      }
    }
    if (ya) return   // ya tiene camino por la franja
    let fin = -1, final = -1
    for (let s = 0; s < cola.length && fin < 0; s++) {
      const p = cola[s]
      for (const j of orto(p)) {
        if (publico(j) && banda[j]) { fin = p; final = j; break }
        if (muro(j) && dist[j] < 0 && dist[p] < 40) { dist[j] = dist[p] + 1; prev[j] = p; cola.push(j) }
      }
    }
    if (fin < 0) return
    const camino = []
    for (let p = fin; p !== -1; p = prev[p]) camino.push(p)
    // vano de ~0,75 m: 3 celdas de ancho alrededor de cada celda del muro
    for (const c of camino) {
      const x = c % w, y = (c / w) | 0
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
        const j = ny * w + nx
        if (muro(j)) { celdas[j] = 3; banda[j] = 1 }
      }
    }
    banda[final] = 1
  })
}

// ambientes a los que se llega: su puerta da a la franja de paso. Lo que no, la app lo avisa al elegirlo.
function alcanzables(d) {
  const { w, h, celdas, cuarto, banda } = d.nav
  const reach = new Set()
  for (let i = 0; i < w * h; i++) {
    if (!cuarto[i] || !celdas[i] || banda[i]) continue
    const x = i % w, y = (i / w) | 0
    if ((x > 0 && banda[i - 1]) || (x < w - 1 && banda[i + 1]) || (y > 0 && banda[i - w]) || (y < h - 1 && banda[i + w])) reach.add(cuarto[i])
  }
  return reach
}

// --- georreferencia (misma fórmula que planta_real/web/exportar_datos.py)
let G = null
const M_LAT = 110574
export function usarGeo(geo) { G = { ...geo, mLon: 111320 * Math.cos((geo.lat0 * Math.PI) / 180), t: (geo.ang * Math.PI) / 180 } }
export function aLonLat(x, y) {
  const dx = x - G.cx, dy = y - G.cy
  const e = Math.cos(G.t) * dx - Math.sin(G.t) * dy + G.ox
  const n = Math.sin(G.t) * dx + Math.cos(G.t) * dy + G.oy
  return [G.lon0 + e / G.mLon, G.lat0 + n / M_LAT]
}
export function dePlano(lon, lat) {
  const e = (lon - G.lon0) * G.mLon - G.ox, n = (lat - G.lat0) * M_LAT - G.oy
  const t = -G.t
  return [Math.cos(t) * e - Math.sin(t) * n + G.cx, Math.sin(t) * e + Math.cos(t) * n + G.cy]
}
// rumbo del mapa para que el plano quede derecho (su eje y hacia arriba)
export const rumbo = () => -G.ang

// --- categorías (colores suaves para los ambientes y color de acento para íconos y rutas)
export const CATS = {
  consulta: { nombre: 'Consultorios', relleno: '#E3EBFC', acento: '#3768DE', icono: 'consulta' },
  espera: { nombre: 'Salas de espera', relleno: '#E2F3E7', acento: '#2E9D5B', icono: 'silla' },
  banos: { nombre: 'Baños', relleno: '#DDF0F7', acento: '#1B95BD', icono: 'bano' },
  farmacia: { nombre: 'Farmacia', relleno: '#EFE7FB', acento: '#8455D3', icono: 'farmacia' },
  administracion: { nombre: 'Atención y trámites', relleno: '#FFF0D6', acento: '#DB7F12', icono: 'administracion' },
  circulacion: { nombre: 'Halls y pasillos', relleno: '#FFFFFF', acento: '#6A7684', icono: 'piso' },
  apoyo: { nombre: 'Servicios de apoyo', relleno: '#EDF0F3', acento: '#7D8896', icono: 'servicios' },
  escaleras: { nombre: 'Escaleras', relleno: '#E4E7EC', acento: '#4B5563', icono: 'escalera' },
  ascensores: { nombre: 'Ascensores', relleno: '#E4E7EC', acento: '#4B5563', icono: 'ascensor' },
  otro: { nombre: 'Otros', relleno: '#F2F4F7', acento: '#8A94A3', icono: 'servicios' },
}
export const ICONO_LUGAR = {
  bano: 'bano', ascensor: 'ascensor', escalera: 'escalera', farmacia: 'farmacia', caja: 'caja', informacion: 'info',
  espera: 'silla', capilla: 'capilla', laboratorio: 'diagnostico', consulta: 'consulta', administracion: 'administracion',
}

// --- búsqueda sin tildes
export const plano = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// punto dentro de polígono (anillo exterior) y ambiente en un punto
export function dentro([x, y], anillo) {
  let c = false
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i], [xj, yj] = anillo[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}
export function ambienteEn(d, p) {
  let mejor = null
  for (const a of d.ambientes) {
    if (!a.pg.length || !dentro(p, a.pg[0])) continue
    if (!mejor || a.area < mejor.area) mejor = a
  }
  return mejor
}

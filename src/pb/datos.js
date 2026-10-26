// Datos de la planta baja real (exportados desde el plano del hospital) y georreferencia sobre el mapa.
// (en las pruebas con node no hay import.meta.env: se usa la raíz)
export const BASE = import.meta.env?.BASE_URL ?? "/"

const pedirJson = (url) => fetch(url).then((x) => (x.ok ? x.json() : null)).catch(() => null)

// Edificio: pisos disponibles, conectores verticales (ascensores y escaleras) y tiempos para las rutas entre pisos
const EDIFICIO_RESPALDO = {
  pisoInicial: 'PB',
  pisos: [{ id: 'PB', nombre: 'Planta baja', corto: 'PB', nivel: 0, disponible: true, datos: 'pb/datos.json', config: 'pb/config.json', glb: 'pb/solca_pb.glb' }],
  conectores: [],
  tiempos: { velocidadMs: 1.2, ascensorEsperaS: 45, ascensorPorPisoS: 5, escaleraPorPisoS: 15 },
}
let edificioCache = null
export async function cargarEdificio() {
  edificioCache ??= pedirJson(`${BASE}edificio.json?v=${__VERSION__}`).then((e) => e || EDIFICIO_RESPALDO)
  return edificioCache
}

// Reglas propias de cada piso (antes escritas en el código): pasillos solo de personal, ventanillas, puertas que se
// abren solas, nombres corregidos y letreros extra. Ver public/pb/config.json.
export function compilarConfig(c = {}) {
  const patrones = (c.soloPersonal || []).map((p) => new RegExp(p))
  return {
    esPersonal: (nombre) => patrones.some((r) => r.test(nombre || '')),
    ventanillas: c.ventanillas || {},
    puertasAuto: c.puertasAuto || [],
    renombres: (c.renombres || []).map((r) => ({ ...r, re: new RegExp(r.patron) })),
    letreros: c.letreros || [],
    // ajustes por ambiente (ver planta_real/pisos/ajustes.py): se aplican solo si el ambiente conserva el nombre «si»
    ajustes: c.ajustes || {},
  }
}

/**
 * Carga un piso: su plano, sus reglas y los cambios del administrador.
 * @param cambiosLocales cambios en borrador (vista previa del administrador) que se suman a los publicados
 * @param opciones.pisoId piso a cargar (por defecto el inicial del edificio)
 * @param opciones.cambiosUrl de dónde leer los cambios publicados (OM3); si no, pb/cambios.json del sitio
 */
export async function cargarDatos(cambiosLocales = null, opciones = {}) {
  const edificio = await cargarEdificio()
  const piso = edificio.pisos.find((p) => p.id === (opciones.pisoId || edificio.pisoInicial) && p.disponible)
  if (!piso) throw new Error('Ese piso todavía no tiene plano')
  const r = await fetch(`${BASE}${piso.datos}?v=${__VERSION__}`)
  if (!r.ok) throw new Error('No se pudo cargar el plano')
  const d = await r.json()
  d.edificio = edificio
  d.piso = piso
  d.cfg = compilarConfig((piso.config && (await pedirJson(`${BASE}${piso.config}?v=${__VERSION__}`))) || {})
  // cambios del administrador publicados: en OM3 (cambiosUrl) o, si no, en el repositorio
  // (en el editor de OM3 el borrador ya es el estado completo: no se suman los publicados)
  const publicados = opciones.sinPublicados ? null : await pedirJson(opciones.cambiosUrl || `${BASE}pb/cambios.json?v=${__VERSION__}`)
  // ambientes que se atienden por ventanilla: el paciente llega al punto frente a ella y no entra al cuarto
  for (const a of d.ambientes) if (d.cfg.ventanillas[a.nombre]) { a.dest = d.cfg.ventanillas[a.nombre].slice(); a.ventanilla = true }
  // nombres corregidos (p. ej. el lado del personal de los módulos de Gestión Privados no es un lugar aparte)
  for (const a of d.ambientes) {
    const rn = d.cfg.renombres.find((x) => x.re.test(a.nombre || '') && (x.areaMax == null || a.area < x.areaMax))
    if (!rn) continue
    if ('nombre' in rn) a.nombre = rn.nombre
    else if (rn.sufijo) a.nombre = `${a.nombre}${rn.sufijo}`
  }
  d.cambiosPasos = []
  const ajustes = Object.fromEntries(Object.entries(d.cfg.ajustes)
    .filter(([id, c]) => d.ambientes.find((x) => x.id === id)?.nombre === c.si))
  aplicarCambios(d, { ambientes: ajustes })
  aplicarCambios(d, cambiosDelPiso(publicados, piso.id))
  aplicarCambios(d, cambiosDelPiso(cambiosLocales, piso.id))
  // solo personal: por regla del piso o marcado por el administrador
  for (const a of d.ambientes) a.personal = a.personal ?? d.cfg.esPersonal(a.nombre)
  const bin = atob(d.nav.celdas)
  const celdas = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) celdas[i] = bin.charCodeAt(i)
  d.nav.celdas = celdas
  const bin2 = atob(d.nav.cuarto)
  const bytes2 = new Uint8Array(bin2.length)
  for (let i = 0; i < bin2.length; i++) bytes2[i] = bin2.charCodeAt(i)
  // con más de 255 ambientes el índice del cuarto va en 2 bytes (little-endian): nav.cuartoBits = 16
  d.nav.cuarto = d.nav.cuartoBits === 16 ? new Uint16Array(bytes2.buffer) : bytes2
  // espacios que la franja de paso puede cruzar: pasillos, halls, salas de espera y accesos verticales
  const ABIERTOS = ['circulacion', 'espera', 'escaleras', 'ascensores']
  d.nav.paso = new Uint8Array(d.ambientes.length + 1)
  d.nav.paso[0] = 1
  // a.paso: vestíbulo o recepción que reparte a varios cuartos (marcado al importar el plano por su número de puertas)
  d.ambientes.forEach((a, k) => { d.nav.paso[k + 1] = ((ABIERTOS.includes(a.cat) || a.paso) && !a.personal) || (!a.nombre && a.area >= 30) ? 1 : 0 })
  // red de pasillos para pacientes (trazada sobre el plano): 1 = pasillo de la red
  const bin3 = atob(d.nav.red)
  d.nav.red = new Uint8Array(bin3.length)
  for (let i = 0; i < bin3.length; i++) d.nav.red[i] = bin3.charCodeAt(i)
  // vereda exterior (franja alrededor del edificio): también es paso para llegar a las puertas exteriores
  const bin4 = atob(d.nav.vereda)
  d.nav.vereda = new Uint8Array(bin4.length)
  for (let i = 0; i < bin4.length; i++) d.nav.vereda[i] = bin4.charCodeAt(i)
  // pasos del administrador: muros nuevos, pasos abiertos y líneas de recorrido de pacientes
  aplicarPasos(d)
  // escalones (gradas de escaleras y desniveles): la ruta accesible no pasa por ellos
  d.nav.escalon = marcarEscalones(d)
  // franja de paso (ver bandaDeRed)
  d.nav.banda = bandaDeRed(d)
  // el interior de un cuarto cerrado no es paso: la ruta solo llega a su puerta (ver buscarRuta, meta)
  // (salvo los ganchos trazados en verde o rojo que entran a un consultorio: son su acceso)
  for (let i = 0; i < d.nav.banda.length; i++) if (d.nav.cuarto[i] && !d.nav.paso[d.nav.cuarto[i]] && !d.nav.red[i]) d.nav.banda[i] = 0
  unirPorDentro(d, d.nav.banda)
  abrirPuertas(d, d.nav.banda)
  d.nav.indice = Object.fromEntries(d.ambientes.map((a, k) => [a.id, k + 1]))
  d.nav.ventanilla = new Set(d.ambientes.flatMap((a, k) => (a.ventanilla ? [k + 1] : [])))
  d.nav.alcanzable = alcanzables(d)
  // administración: la franja más los pasillos de personal (sin cuartos cerrados)
  d.nav.bandaAdmin = Uint8Array.from(d.nav.banda)
  for (let i = 0; i < d.nav.bandaAdmin.length; i++) {
    const c = d.nav.cuarto[i]
    if (!d.nav.bandaAdmin[i] && d.nav.celdas[i] && c && d.ambientes[c - 1].personal) d.nav.bandaAdmin[i] = 1
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
  d.ambientes.forEach((a, k) => { staff[k + 1] = a.personal ? 1 : 0 })
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

// ---------- cambios del administrador ----------
// Formato 2 (OM3, ver OMNIUM_MS_GESTION_HOSPITALARIA mapa.*):
//   { version: 2, pisos: { PB: { ambientes: { a47: { nombre, cat, dest, ventanilla, oculto, personal } },
//                                lugares: [{ id, nombre, cat, x, y }],
//                                pasos: [{ tipo: 'cerrar' | 'abrir' | 'linea', puntos: [[x, y], ...] }] } } }
// El formato 1 ({ ambientes }) del primer administrador vale para la planta baja.
export function cambiosDelPiso(cambios, pisoId) {
  if (!cambios || typeof cambios !== 'object') return null
  if (cambios.pisos) return cambios.pisos[pisoId] || null
  return cambios.ambientes && pisoId === 'PB' ? cambios : null
}

const ID_LUGAR = /^L-[A-Za-z0-9_-]{1,40}$/
const esPunto = (p) => Array.isArray(p) && p.length === 2 && p.every((v) => Number.isFinite(v))

export function aplicarCambios(d, cambios) {
  if (!cambios) return
  for (const [id, c] of Object.entries(cambios.ambientes || {})) {
    const a = d.ambientes.find((x) => x.id === id)
    if (!a || !c) continue
    if (typeof c.nombre === 'string' && c.nombre.trim()) a.nombre = c.nombre.trim().slice(0, 80)
    if (c.cat && CATS[c.cat]) a.cat = c.cat
    if (esPunto(c.dest)) a.dest = c.dest.slice()
    // ventanilla: el paciente llega al punto (dest) y no entra; false la quita
    if (typeof c.ventanilla === 'boolean') a.ventanilla = c.ventanilla && !!a.dest
    if (typeof c.personal === 'boolean') a.personal = c.personal
    // oculto: deja de ser lugar (sin nombre, sin letrero, no es destino)
    if (c.oculto === true) { a.nombre = null; a.oculto = true }
  }
  // lugares nuevos: un punto con nombre (un módulo nuevo, una ventanilla, un servicio sin cuarto propio)
  for (const l of cambios.lugares || []) {
    if (!l || !ID_LUGAR.test(l.id) || !esPunto([l.x, l.y]) || typeof l.nombre !== 'string' || !l.nombre.trim()) continue
    const previo = d.ambientes.find((x) => x.id === l.id)
    const nuevo = { id: l.id, nombre: l.nombre.trim().slice(0, 80), cat: CATS[l.cat] ? l.cat : 'otro', area: 0, pg: [],
      lbl: [l.x, l.y], dest: [l.x, l.y], ventanilla: true, nuevo: true, personal: !!l.personal }
    if (previo) Object.assign(previo, nuevo)
    else d.ambientes.push(nuevo)
  }
  for (const p of cambios.pasos || []) {
    if (!p || !['cerrar', 'abrir', 'linea'].includes(p.tipo) || !Array.isArray(p.puntos) || p.puntos.length < 2 || !p.puntos.every(esPunto)) continue
    d.cambiosPasos.push({ tipo: p.tipo, puntos: p.puntos.slice(0, 50) })
  }
}

// Pasos sobre la rejilla de navegación (y su dibujo en 2D y 3D):
// - cerrar: muro nuevo de 15 cm (la ruta ya no pasa); se dibuja como muro en 2D y 3D
// - abrir: vano de 1 m en un muro (puerta que el plano no tiene); se marca como paso
// - linea: recorrido de pacientes, igual que una línea verde del plano
function aplicarPasos(d) {
  const { w, h, x0, y0, res, celdas, red } = d.nav
  d.murosExtra = []
  d.pasosAbiertos = []
  const marcar = (a, b, ancho, fn) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1])
    const n = Math.max(1, Math.ceil(L / (res / 2)))
    const r = Math.ceil(ancho / 2 / res)
    for (let k = 0; k <= n; k++) {
      const x = a[0] + ((b[0] - a[0]) * k) / n, y = a[1] + ((b[1] - a[1]) * k) / n
      const cx = Math.round((x - x0) / res), cy = Math.round((y - y0) / res)
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const nx = cx + dx, ny = cy + dy
        if (nx < 0 || ny < 0 || nx >= w || ny >= h || Math.hypot(dx, dy) * res > ancho / 2 + 1e-6) continue
        fn(ny * w + nx)
      }
    }
  }
  const rect = (a, b, g) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    const nx = (-(b[1] - a[1]) / L) * g / 2, ny = ((b[0] - a[0]) / L) * g / 2
    return [[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny], [a[0] + nx, a[1] + ny]]
  }
  for (const p of d.cambiosPasos) {
    for (let k = 0; k < p.puntos.length - 1; k++) {
      const a = p.puntos[k], b = p.puntos[k + 1]
      if (p.tipo === 'cerrar') {
        marcar(a, b, 0.3, (i) => { celdas[i] = 0; red[i] = 0 })
        d.murosExtra.push([rect(a, b, 0.15)])
      } else if (p.tipo === 'abrir') {
        marcar(a, b, 1.0, (i) => { if (!celdas[i]) celdas[i] = 3; red[i] = 1 })
        d.pasosAbiertos.push([a, b])
      } else {
        marcar(a, b, 0.6, (i) => { if (celdas[i]) red[i] = 1 })
      }
    }
  }
  if (d.murosExtra.length) d.muros = [...d.muros, ...d.murosExtra]
}

// celdas con escalones: cada línea de grada del plano (30 cm de ancho) y el interior de las escaleras
function marcarEscalones(d) {
  const { w, h, x0, y0, res, cuarto } = d.nav
  const m = new Uint8Array(w * h)
  for (const l of d.gradas || []) {
    for (let k = 0; k < l.length - 1; k++) {
      const a = l[k], b = l[k + 1]
      const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (res / 2)))
      for (let t = 0; t <= n; t++) {
        const cx = Math.round((a[0] + ((b[0] - a[0]) * t) / n - x0) / res), cy = Math.round((a[1] + ((b[1] - a[1]) * t) / n - y0) / res)
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = cx + dx, ny = cy + dy
          if (nx >= 0 && ny >= 0 && nx < w && ny < h) m[ny * w + nx] = 1
        }
      }
    }
  }
  const esc = new Uint8Array(d.ambientes.length + 1)
  d.ambientes.forEach((a, k) => { esc[k + 1] = a.cat === 'escaleras' ? 1 : 0 })
  for (let i = 0; i < m.length; i++) if (esc[cuarto[i]]) m[i] = 1
  return m
}

// franja de paso: la red verde y los pasillos y halls abiertos conectados a ella. Los pasillos internos de los bloques
// son solo del personal y no entran. Un cuarto cerrado (consultorio, farmacia, oficina) aporta solo su puerta: la franja
// no sigue hacia adentro. Si un cuarto queda sin camino por pasillos públicos, se traza un acceso hasta la franja.
function bandaDeRed(d) {
  const { w, h, celdas, cuarto, red, paso, vereda } = d.nav
  const N = w * h
  const staff = new Uint8Array(d.ambientes.length + 1)
  d.ambientes.forEach((a, k) => { staff[k + 1] = a.personal ? 1 : 0 })
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

function abrirPuertas(d, banda) {
  const { w, h, celdas, cuarto, paso, vereda } = d.nav
  const N = w * h
  const orto = (i) => {
    const x = i % w, y = (i / w) | 0, r = []
    if (x > 0) r.push(i - 1)
    if (x < w - 1) r.push(i + 1)
    if (y > 0) r.push(i - w)
    if (y < h - 1) r.push(i + w)
    return r
  }
  const personal = (c) => c > 0 && !!d.ambientes[c - 1].personal
  // muro que se puede abrir: cualquier celda sin paso (muro); el interior de los cuartos no se toca
  const muro = (j) => celdas[j] === 0 && !personal(cuarto[j])
  d.ambientes.forEach((a, k) => {
    if (!d.cfg.puertasAuto.includes(a.nombre)) return
    const q = k + 1
    // espacio libre que se puede cruzar sin romper nada: vestíbulos sin nombre y espacios abiertos (no otros cuartos)
    // (y otros baños: el cubículo de Minusválidos puede estar dentro de un SS.HH. y se llega cruzándolo)
    const libre = (j) => celdas[j] > 0 && cuarto[j] !== q && !personal(cuarto[j]) &&
      (cuarto[j] === 0 || !!paso[cuarto[j]] || (a.cat === 'banos' && d.ambientes[cuarto[j] - 1].cat === 'banos'))
    // llegada: la franja de paso interior (no la vereda de afuera)
    const llega = (j) => banda[j] === 1 && !vereda[j] && !personal(cuarto[j]) && cuarto[j] !== q
    // la búsqueda parte del piso libre del cuarto (no de sus muros: un muro junto a la franja no es una puerta)
    const costo = new Int32Array(N).fill(-1)
    const prev = new Int32Array(N).fill(-1)
    const cola = []
    for (let i = 0; i < N; i++) {
      if (cuarto[i] !== q || !celdas[i]) continue
      if (orto(i).some(llega)) return   // ya tiene puerta a la franja
      costo[i] = 0; cola.push(i)
    }
    // 0-1: cruzar espacio libre no cuesta, cada celda de muro cuesta 1. Así se usa el vano real (p. ej. el
    // vestíbulo compartido de dos baños) y, si hay que abrir, se rompe el muro más delgado.
    let fin = -1, final = -1
    const deque = cola.slice()
    let cab = 0
    while (cab < deque.length) {
      const p = deque[cab++]
      let hecho = false
      for (const j of orto(p)) {
        if (llega(j)) { fin = p; final = j; hecho = true; break }
        const c = libre(j) ? 0 : muro(j) ? 1 : -1
        if (c < 0) continue
        const nc = costo[p] + c
        if (nc > 12 || (costo[j] >= 0 && costo[j] <= nc)) continue
        costo[j] = nc; prev[j] = p
        if (c === 0) deque.splice(cab, 0, j); else deque.push(j)
      }
      if (hecho) break
    }
    if (fin < 0) return
    const camino = []
    for (let p = fin; p !== -1 && cuarto[p] !== q; p = prev[p]) camino.push(p)
    for (const c of camino) {
      if (!muro(c)) { banda[c] = 1; continue }   // vestíbulo: pasa a ser paso
      // vano de ~0,75 m: 3 celdas de ancho alrededor de cada celda del muro
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

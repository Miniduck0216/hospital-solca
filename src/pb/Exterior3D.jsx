// Exterior del 3D en estilo isométrico de maqueta (como las ilustraciones de referencia): base del edificio con
// canto, vereda clara, calles del campus, árboles de copa redonda y algunas personas en las entradas. Los
// parqueaderos ya no se dibujan (recargaban la vista): solo una señal «P» en cada uno. Árboles y personas son
// decorativos; en el modo ligero (tótem) hay menos.
import { useMemo } from 'react'
import * as THREE from 'three'
import { dePlano } from './datos.js'
import { LIGERO } from './rendimiento.js'

// plano (x, y) -> escena (x, -y)
const enPoli = ([x, y], anillo) => {
  let c = false
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i], [xj, yj] = anillo[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}
// ensancha un anillo e metros (inglete), útil para la vereda alrededor del edificio
export function ensanchar(anillo0, e) {
  const anillo = anillo0[0][0] === anillo0[anillo0.length - 1][0] && anillo0[0][1] === anillo0[anillo0.length - 1][1] ? anillo0.slice(0, -1) : anillo0
  let area = 0
  for (let i = 0; i < anillo.length; i++) { const [x1, y1] = anillo[i], [x2, y2] = anillo[(i + 1) % anillo.length]; area += x1 * y2 - x2 * y1 }
  const s = area > 0 ? 1 : -1
  const n = anillo.length
  return anillo.map((p, i) => {
    const a = anillo[(i - 1 + n) % n], b = anillo[(i + 1) % n]
    const d1 = [p[0] - a[0], p[1] - a[1]], d2 = [b[0] - p[0], b[1] - p[1]]
    const l1 = Math.hypot(...d1) || 1, l2 = Math.hypot(...d2) || 1
    const n1 = [s * d1[1] / l1, -s * d1[0] / l1], n2 = [s * d2[1] / l2, -s * d2[0] / l2]
    let m = [n1[0] + n2[0], n1[1] + n2[1]]
    const ml = Math.hypot(...m) || 1
    m = [m[0] / ml, m[1] / ml]
    const k = Math.min(3, 1 / Math.max(0.35, m[0] * n1[0] + m[1] * n1[1]))
    return [p[0] + m[0] * e * k, p[1] + m[1] * e * k]
  })
}
const distSeg = (p, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L))
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)
}
const forma = (anillo, huecos = []) => {
  const f = new THREE.Shape(anillo.map(([x, y]) => new THREE.Vector2(x, y)))
  for (const h of huecos) f.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))))
  return f
}
const losa = (shape, alto) => {
  const g = new THREE.ExtrudeGeometry(shape, { depth: alto, bevelEnabled: false })
  g.rotateX(-Math.PI / 2)
  return g
}
// generador pseudoaleatorio con semilla: la maqueta sale igual cada vez
function azar(semilla = 7) {
  let s = semilla
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646 }
}
// puntos cada "paso" metros a lo largo de un anillo
function aLoLargo(anillo, paso) {
  const out = []
  for (let i = 0; i < anillo.length; i++) {
    const a = anillo[i], b = anillo[(i + 1) % anillo.length]
    const L = Math.hypot(b[0] - a[0], b[1] - a[1])
    for (let s = paso / 2; s < L; s += paso) out.push([a[0] + ((b[0] - a[0]) * s) / L, a[1] + ((b[1] - a[1]) * s) / L, Math.atan2(b[1] - a[1], b[0] - a[0])])
  }
  return out
}

const VERDES = ['#5DAE57', '#6CBF5E', '#4E9E4A', '#7BC86C']

// ruido suave con semilla (suma de ondas): agrupa los árboles en bosquecillos en vez de repartirlos parejo
function ruido(x, y) {
  return (Math.sin(x * 0.071 + 1.3) * Math.cos(y * 0.063 - 0.7) + Math.sin((x + y) * 0.037 + 2.1) * 0.8 +
    Math.cos((x - y) * 0.052 - 1.1) * 0.6) / 2.4
}

export function Exterior({ d, mapa = null, losa: losaPiso = null }) {
  const datos = useMemo(() => {
    const rnd = azar(11)
    // en los pisos altos el suelo es el perfil del hospital (planta baja): los árboles van afuera de él, no
    // alrededor del piso (que cae sobre la planta baja)
    const suelo = d.perfil?.length ? d.perfil : d.huella
    const huellas = suelo.map((pg) => pg[0])
    const parqueos = d.parqueos.map((p) => p.ll.map(([lo, la]) => dePlano(lo, la)))
    // contornos ensanchados calculados una vez (se consultan miles de veces al repartir los árboles)
    const cache = new Map()
    const ancho = (lista, m, k) => { const c = `${k}${m}`; if (!cache.has(c)) cache.set(c, lista.map((h) => ensanchar(h, m))); return cache.get(c) }
    const dentroEdif = (p, m = 0) => (m ? ancho(huellas, m, 'h') : huellas).some((h) => enPoli(p, h))
    const enParqueo = (p, m = 0) => (m ? ancho(parqueos, m, 'p') : parqueos).some((q) => enPoli(p, q))
    const cercaEntrada = (p, r) => d.entradas.some((e) => Math.hypot(p[0] - e.x, p[1] - e.y) < r)

    // base del edificio (canto de maqueta) y vereda; la base queda 3 cm bajo la losa (no comparten plano)
    const anillos = (losaPiso || suelo).map((pg) => pg[0])
    const base = anillos.map((h) => losa(forma(ensanchar(h, 0.3)), 0.55))
    const vereda = anillos.map((h) => losa(forma(ensanchar(h, 2.6)), 0.3))
    // parqueaderos: una señal «P» en el centro de cada uno
    const senales = parqueos.map((q) => [q.reduce((s, p) => s + p[0], 0) / q.length, q.reduce((s, p) => s + p[1], 0) / q.length])

    // árboles: en el pasto del mapa (no en calles, veredas ni otros edificios), agrupados en bosquecillos como en
    // el terreno real, con aire alrededor del hospital y de los parqueaderos. Sin mapa: unos pocos alrededor.
    const arboles = []
    const libre = (p, sep) => !arboles.some((a) => Math.hypot(a.x - p[0], a.y - p[1]) < sep)
    const poner = (p, s0 = 0.85) => arboles.push({ x: p[0], y: p[1], s: s0 + rnd() * 0.5, c: VERDES[Math.floor(rnd() * VERDES.length)] })
    // calles del campus (del mapa base): asfalto continuo con los parqueaderos; los árboles no caen sobre ellas
    const aPlano = (anillo) => anillo.map(([lo, la]) => dePlano(lo, la))
    const callesPl = (d.calles || []).map((pg) => pg.map(aPlano))
    const veredasPl = (d.veredasExt || []).map((pg) => pg.map(aPlano))
    const caja = (r) => { const xs = r.map((p) => p[0]), ys = r.map((p) => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] }
    const cajas = callesPl.map((pg) => caja(pg[0]))
    const enCalle = (p, m = 2.5) => callesPl.some((pg, k) => {
      const b = cajas[k]
      if (p[0] < b[0] - m || p[0] > b[2] + m || p[1] < b[1] - m || p[1] > b[3] + m) return false
      // dentro del anillo exterior y fuera de sus huecos, o a menos de m de un borde
      const dentro = enPoli(p, pg[0]) && !pg.slice(1).some((h) => enPoli(p, h))
      if (dentro) return true
      return pg.some((r) => r.some((q, i) => { const o = r[(i + 1) % r.length]; return distSeg(p, q, o) < m }))
    })
    const calles = callesPl.map((pg) => losa(forma(pg[0], pg.slice(1)), 0.12))
    const veredasC = veredasPl.map((pg) => losa(forma(pg[0], pg.slice(1)), 0.13))
    const fuera = (p) => !enCalle(p) && !dentroEdif(p, 8) && !enParqueo(p, 3.5) && !cercaEntrada(p, 10)
    // zonas de árboles de la foto satelital: se llenan a la separación de cada zona (bosques más tupidos que hileras)
    const zonas = (d.zonasArboles || []).map((z) => ({ sep: z.sep, pg: z.ll.map(([lo, la]) => dePlano(lo, la)) }))
    for (const z of zonas) {
      const xs = z.pg.map((p) => p[0]), ys = z.pg.map((p) => p[1])
      // un árbol por celda de la separación de la zona (con algo de azar), y no todos: claros entre los grupos
      for (let y = Math.min(...ys); y <= Math.max(...ys); y += z.sep) {
        for (let x = Math.min(...xs); x <= Math.max(...xs); x += z.sep) {
          const p = [x + (rnd() - 0.5) * z.sep * 0.6, y + (rnd() - 0.5) * z.sep * 0.6]
          if (rnd() < 0.18 || !enPoli(p, z.pg) || !fuera(p) || !libre(p, z.sep * 0.9)) continue
          poner(p, z.sep < 5.5 ? 1.0 : 0.85)
        }
      }
    }
    if (zonas.length) { /* con las zonas de la foto no se reparten árboles al azar */ } else if (mapa) {
      const { px, PX, LADO, centro } = mapa
      const pasto = (x, y) => {
        const c = Math.round(((x - centro[0]) / LADO + 0.5) * PX), f = Math.round((0.5 - (y - centro[1]) / LADO) * PX)
        if (c < 0 || f < 0 || c >= PX || f >= PX) return false
        const i = (f * PX + c) * 4, r = px[i], g = px[i + 1], b = px[i + 2]
        return g > r + 12 && g > b + 12
      }
      // pasto en un radio de 3 m (lejos del borde de calles y veredas)
      const enPasto = (x, y) => pasto(x, y) && pasto(x + 3, y) && pasto(x - 3, y) && pasto(x, y + 3) && pasto(x, y - 3)
      const xs = huellas.flat().map((p) => p[0]), ys = huellas.flat().map((p) => p[1])
      const x0 = Math.min(...xs) - 70, x1 = Math.max(...xs) + 70, y0 = Math.min(...ys) - 70, y1 = Math.max(...ys) + 70
      const PASO = 3.2
      for (let y = y0; y <= y1; y += PASO) {
        for (let x = x0; x <= x1; x += PASO) {
          const p = [x + (rnd() - 0.5) * PASO * 0.9, y + (rnd() - 0.5) * PASO * 0.9]
          const n = ruido(p[0], p[1])
          // bosquecillos donde el ruido es alto; árboles sueltos en el resto del pasto
          const prob = n > 0.25 ? 0.55 : n > 0.05 ? 0.12 : 0.025
          if (rnd() > prob || !enPasto(p[0], p[1]) || !fuera(p)) continue
          if (!libre(p, n > 0.25 ? 4.6 : 7)) continue
          poner(p, n > 0.25 ? 0.95 : 0.8)
        }
      }
    } else {
      for (const h of huellas) for (const p of aLoLargo(ensanchar(h, 9), 16)) if (fuera(p) && libre(p, 8)) poner(p)
    }
    // modo ligero: uno de cada tres árboles (la forma de los bosques se mantiene) y sin personas
    if (LIGERO) { const pocos = arboles.filter((_, k) => k % 3 === 0); arboles.length = 0; arboles.push(...pocos) }
    // personas en algunas entradas, un poco afuera
    const gente = LIGERO ? [] : d.entradas.map((e, k) => {
      const dx = (e.fx ?? e.x) - e.x, dy = (e.fy ?? e.y) - e.y, L = Math.hypot(dx, dy) || 1
      return { x: e.x + (dx / L) * 3.2 + (k % 2 ? 0.8 : -0.8), y: e.y + (dy / L) * 3.2, giro: Math.atan2(-dx, -dy), c: ['#E67E22', '#16A085', '#C0392B', '#2980B9', '#8E44AD', '#27AE60', '#D35400', '#2C3E50'][k % 8] }
    })
    // canchas deportivas: piso de color con su borde claro y las líneas de juego
    const canchas = (d.canchas || []).map((c) => {
      const q = c.ll.map(([lo, la]) => dePlano(lo, la))
      return { tipo: c.tipo, piso: losa(forma(q), 0.1), borde: losa(forma(ensanchar(q, 1.2), [q.slice().reverse()]), 0.08),
        lineas: losa(forma(ensanchar(q, -1.0), [ensanchar(q, -1.12).reverse()]), 0.11) }
    })
    return { base, vereda, senales, arboles, gente, canchas, calles, veredasC }
  }, [d, mapa, losaPiso])

  return (
    <group>
      {datos.base.map((g, k) => <mesh key={'b' + k} geometry={g} position-y={-0.58} receiveShadow castShadow><meshLambertMaterial color="#E7D7BC" /></mesh>)}
      {datos.vereda.map((g, k) => <mesh key={'v' + k} geometry={g} position-y={-0.5} receiveShadow><meshLambertMaterial color="#E9E6DF" /></mesh>)}
      {datos.calles.map((g, k) => <mesh key={'c' + k} geometry={g} position-y={-0.21} receiveShadow><meshLambertMaterial color="#59616D" /></mesh>)}
      {datos.veredasC.map((g, k) => <mesh key={'w' + k} geometry={g} position-y={-0.21} receiveShadow><meshLambertMaterial color="#E9E6DF" /></mesh>)}
      {datos.canchas.map((c, k) => (
        <group key={'c' + k} position-y={-0.2}>
          <mesh geometry={c.borde} receiveShadow><meshLambertMaterial color="#DCD8CF" /></mesh>
          <mesh geometry={c.piso} receiveShadow><meshLambertMaterial color={c.tipo === 'tenis' ? '#5B7FB8' : '#6E9BD1'} /></mesh>
          <mesh geometry={c.lineas}><meshLambertMaterial color="#F4F4F0" /></mesh>
        </group>
      ))}
      <Arboles key={datos.arboles.length} arboles={datos.arboles} />
      {datos.senales.map((p, k) => <SenalParqueo key={'p' + k} x={p[0]} y={p[1]} />)}
      {datos.gente.map((p, k) => <Persona key={k} {...p} />)}
    </group>
  )
}

// instancias: una malla por pieza, muchas copias (rápido aunque haya cientos de autos y árboles)
function Instancias({ items, geo, color, colores, poner }) {
  const ref = useMemo(() => ({ current: null }), [])
  const tmp = useMemo(() => new THREE.Object3D(), [])
  return (
    <instancedMesh ref={(m) => {
      if (!m || ref.current === m) return
      ref.current = m
      items.forEach((it, i) => { poner(tmp, it); tmp.updateMatrix(); m.setMatrixAt(i, tmp.matrix); if (colores) m.setColorAt(i, new THREE.Color(colores(it))) })
      m.instanceMatrix.needsUpdate = true
      if (m.instanceColor) m.instanceColor.needsUpdate = true
    }} args={[null, null, Math.max(1, items.length)]} castShadow receiveShadow frustumCulled={false}>
      {geo}
      <meshLambertMaterial color={colores ? '#FFFFFF' : color} flatShading />
    </instancedMesh>
  )
}

function Arboles({ arboles }) {
  return (
    <group>
      <Instancias items={arboles} geo={<cylinderGeometry args={[0.13, 0.18, 1.6, 6]} />} color="#8B5E3C"
        poner={(o, a) => { o.position.set(a.x, 0.6 * a.s, -a.y); o.rotation.set(0, 0, 0); o.scale.setScalar(a.s) }} />
      <Instancias items={arboles} geo={<icosahedronGeometry args={[1.3, 1]} />} colores={(a) => a.c}
        poner={(o, a) => { o.position.set(a.x, 2.3 * a.s, -a.y); o.rotation.set(0, a.x, 0); o.scale.setScalar(a.s) }} />
    </group>
  )
}

// persona de pie en las entradas (estilo de figura simple de las ilustraciones)
function Persona({ x, y, giro, c }) {
  return (
    <group position={[x, -0.2, -y]} rotation-y={giro}>
      <mesh position={[-0.1, 0.45, 0]} castShadow><boxGeometry args={[0.15, 0.9, 0.2]} /><meshLambertMaterial color="#2C3E50" /></mesh>
      <mesh position={[0.1, 0.45, 0]} castShadow><boxGeometry args={[0.15, 0.9, 0.2]} /><meshLambertMaterial color="#2C3E50" /></mesh>
      <mesh position={[0, 1.2, 0]} castShadow><boxGeometry args={[0.44, 0.62, 0.26]} /><meshLambertMaterial color={c} /></mesh>
      <mesh position={[0, 1.66, 0]} castShadow><sphereGeometry args={[0.15, 12, 10]} /><meshLambertMaterial color="#E2B48E" /></mesh>
      <mesh position={[0, 1.74, -0.02]} castShadow><sphereGeometry args={[0.155, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshLambertMaterial color="#3A2A20" /></mesh>
    </group>
  )
}

// señal de parqueadero: poste gris con una placa azul y la «P» blanca (de frente a la cámara)
let texturaP = null
function placaP() {
  if (texturaP) return texturaP
  const cv = document.createElement('canvas')
  cv.width = cv.height = 128
  const c = cv.getContext('2d')
  c.fillStyle = '#2F6FDE'
  c.beginPath(); c.roundRect ? c.roundRect(6, 6, 116, 116, 22) : c.rect(6, 6, 116, 116); c.fill()
  c.lineWidth = 8; c.strokeStyle = '#FFFFFF'; c.stroke()
  c.fillStyle = '#FFFFFF'; c.font = '900 92px "Nunito Sans", "Segoe UI", system-ui, sans-serif'
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('P', 64, 70)
  texturaP = new THREE.CanvasTexture(cv)
  texturaP.colorSpace = THREE.SRGBColorSpace
  return texturaP
}
function SenalParqueo({ x, y }) {
  const t = useMemo(placaP, [])
  return (
    <group position={[x, -0.2, -y]}>
      <mesh position-y={1.5}><cylinderGeometry args={[0.08, 0.1, 3, 8]} /><meshLambertMaterial color="#7F8C8D" /></mesh>
      <sprite position-y={3.6} scale={[2.4, 2.4, 1]}><spriteMaterial map={t} /></sprite>
    </group>
  )
}

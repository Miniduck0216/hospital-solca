// Exterior del 3D en estilo isométrico de maqueta (como las ilustraciones de referencia): base del edificio con
// canto, vereda clara, parqueaderos de asfalto con cajones pintados y autos, postes de luz, árboles de copa
// redonda y algunas personas en las entradas. Los árboles, autos y personas son decorativos.
import { useMemo } from 'react'
import * as THREE from 'three'
import { dePlano } from './datos.js'

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

const COLORES_AUTO = ['#E74C3C', '#F1C40F', '#3498DB', '#2ECC71', '#ECF0F1', '#E67E22', '#9B59B6', '#34495E', '#1ABC9C', '#F5F6FA']
const VERDES = ['#5DAE57', '#6CBF5E', '#4E9E4A', '#7BC86C']

// cajones de parqueo dentro del polígono: filas de 5 m con pasillos de 6 m, alineadas con su lado más largo
function cajones(pts) {
  let mejor = 0, ang = 0
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length]
    const L = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (L > mejor) { mejor = L; ang = Math.atan2(b[1] - a[1], b[0] - a[0]) }
  }
  const ux = Math.cos(ang), uy = Math.sin(ang), vx = -uy, vy = ux
  const us = pts.map(([x, y]) => x * ux + y * uy), vs = pts.map(([x, y]) => x * vx + y * vy)
  const u0 = Math.min(...us), u1 = Math.max(...us), v0 = Math.min(...vs), v1 = Math.max(...vs)
  const W = 2.6, D = 5.0, PAS = 6.5
  const out = []
  let v = v0 + 1.2
  let fila = 0
  while (v + D < v1 - 1) {
    for (let u = u0 + 1.2; u + W < u1 - 1; u += W) {
      const cu = u + W / 2, cv = v + D / 2
      const esq = [[u, v], [u + W, v], [u, v + D], [u + W, v + D]].map(([a, b]) => [a * ux + b * vx, a * uy + b * vy])
      if (esq.every((p) => enPoli(p, pts))) out.push({ x: cu * ux + cv * vx, y: cu * uy + cv * vy, ang, frente: fila % 2 })
    }
    v += D + (fila % 2 === 0 ? 0 : PAS)
    fila++
  }
  return out
}

export function Exterior({ d }) {
  const datos = useMemo(() => {
    const rnd = azar(11)
    // en los pisos altos el suelo es el perfil del hospital (planta baja): los árboles van afuera de él, no
    // alrededor del piso (que cae sobre la planta baja)
    const suelo = d.perfil?.length ? d.perfil : d.huella
    const huellas = suelo.map((pg) => pg[0])
    const parqueos = d.parqueos.map((p) => p.ll.map(([lo, la]) => dePlano(lo, la)))
    const dentroEdif = (p) => huellas.some((h) => enPoli(p, h))
    const enParqueo = (p, m = 0) => parqueos.some((q) => enPoli(p, m ? ensanchar(q, m) : q))
    const cercaEntrada = (p, r) => d.entradas.some((e) => Math.hypot(p[0] - e.x, p[1] - e.y) < r)

    // base del edificio (canto de maqueta) y vereda
    const base = suelo.map((pg) => losa(forma(ensanchar(pg[0], 0.3)), 0.55))
    const vereda = suelo.map((pg) => losa(forma(ensanchar(pg[0], 2.6)), 0.3))
    // parqueaderos
    const asfalto = parqueos.map((q) => losa(forma(q), 0.12))
    const borde = parqueos.map((q) => losa(forma(ensanchar(q, 0.7), [q.slice().reverse()]), 0.22))
    const plazas = parqueos.flatMap((q) => cajones(q))
    const autos = plazas.filter(() => rnd() < 0.62).map((c) => ({ ...c, color: COLORES_AUTO[Math.floor(rnd() * COLORES_AUTO.length)], giro: c.frente ? Math.PI : 0 }))
    // árboles: anillo a 5 m del edificio y alrededor de los parqueaderos, sin tapar entradas ni parqueos
    const arboles = []
    const sumar = (p) => {
      if (dentroEdif(p) || enParqueo(p, 0.5) || cercaEntrada(p, 5)) return
      if (arboles.some((a) => Math.hypot(a.x - p[0], a.y - p[1]) < 4)) return
      arboles.push({ x: p[0], y: p[1], s: 0.85 + rnd() * 0.45, c: VERDES[Math.floor(rnd() * VERDES.length)] })
    }
    for (const h of huellas) for (const p of aLoLargo(ensanchar(h, 5.2), 7)) sumar(p)
    for (const q of parqueos) for (const p of aLoLargo(ensanchar(q, 2.4), 8)) sumar(p)
    // postes de luz en los bordes de los parqueaderos
    const postes = parqueos.flatMap((q) => aLoLargo(ensanchar(q, 0.35), 16)).filter((p) => !dentroEdif(p))
    // personas en algunas entradas, un poco afuera
    const gente = d.entradas.map((e, k) => {
      const dx = (e.fx ?? e.x) - e.x, dy = (e.fy ?? e.y) - e.y, L = Math.hypot(dx, dy) || 1
      return { x: e.x + (dx / L) * 3.2 + (k % 2 ? 0.8 : -0.8), y: e.y + (dy / L) * 3.2, giro: Math.atan2(-dx, -dy), c: ['#E67E22', '#16A085', '#C0392B', '#2980B9', '#8E44AD', '#27AE60', '#D35400', '#2C3E50'][k % 8] }
    })
    return { base, vereda, asfalto, borde, plazas, autos, arboles, postes, gente }
  }, [d])

  return (
    <group>
      {datos.base.map((g, k) => <mesh key={'b' + k} geometry={g} position-y={-0.55} receiveShadow castShadow><meshLambertMaterial color="#E7D7BC" /></mesh>)}
      {datos.vereda.map((g, k) => <mesh key={'v' + k} geometry={g} position-y={-0.5} receiveShadow><meshLambertMaterial color="#E9E6DF" /></mesh>)}
      {datos.asfalto.map((g, k) => <mesh key={'a' + k} geometry={g} position-y={-0.2} receiveShadow><meshLambertMaterial color="#59616D" /></mesh>)}
      {datos.borde.map((g, k) => <mesh key={'o' + k} geometry={g} position-y={-0.2} receiveShadow><meshLambertMaterial color="#DCD8CF" /></mesh>)}
      <Cajones plazas={datos.plazas} />
      <Autos autos={datos.autos} />
      <Arboles arboles={datos.arboles} />
      <Postes postes={datos.postes} />
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

function Cajones({ plazas }) {
  // dos rayas blancas por cajón (los lados) y una al fondo
  const rayas = useMemo(() => plazas.flatMap((c) => {
    const ux = Math.cos(c.ang), uy = Math.sin(c.ang), vx = -uy, vy = ux
    return [-1.3, 1.3].map((o) => ({ x: c.x + ux * o, y: c.y + uy * o, ang: c.ang, lado: true }))
      .concat([{ x: c.x + vx * (c.frente ? 2.5 : -2.5), y: c.y + vy * (c.frente ? 2.5 : -2.5), ang: c.ang, lado: false }])
  }), [plazas])
  return (
    <Instancias items={rayas} geo={<boxGeometry args={[1, 0.02, 1]} />} color="#F4F4F0"
      poner={(o, r) => { o.position.set(r.x, -0.07, -r.y); o.rotation.set(0, r.ang, 0); o.scale.set(r.lado ? 0.12 : 2.6, 1, r.lado ? 5 : 0.12) }} />
  )
}

function Autos({ autos }) {
  const pos = (o, a, y, sx, sy, sz, dz = 0) => {
    // el auto mira a lo largo del cajón (perpendicular a la fila)
    o.position.set(a.x, y, -a.y); o.rotation.set(0, a.ang + a.giro, 0); o.scale.set(sx, sy, sz)
    o.translateZ(dz / sz)
  }
  return (
    <group>
      <Instancias items={autos} geo={<boxGeometry args={[1, 1, 1]} />} colores={(a) => a.color} poner={(o, a) => pos(o, a, 0.42, 1.8, 0.62, 4.1)} />
      <Instancias items={autos} geo={<boxGeometry args={[1, 1, 1]} />} color="#2C3E50" poner={(o, a) => pos(o, a, 0.98, 1.56, 0.5, 2.1, -0.2)} />
      <Instancias items={autos} geo={<boxGeometry args={[1, 1, 1]} />} colores={(a) => a.color} poner={(o, a) => pos(o, a, 1.26, 1.6, 0.08, 2.0, -0.2)} />
      {[[-0.82, 1.3], [0.82, 1.3], [-0.82, -1.3], [0.82, -1.3]].map(([wx, wz], k) => (
        <Instancias key={k} items={autos} geo={<cylinderGeometry args={[0.33, 0.33, 0.24, 10]} />} color="#1E1E24"
          poner={(o, a) => { o.position.set(a.x, 0.18, -a.y); o.rotation.set(0, a.ang + a.giro, 0); o.translateX(wx); o.translateZ(wz); o.rotateZ(Math.PI / 2); o.scale.set(1, 1, 1) }} />
      ))}
    </group>
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

function Postes({ postes }) {
  return (
    <group>
      <Instancias items={postes} geo={<cylinderGeometry args={[0.07, 0.09, 5.2, 6]} />} color="#7F8C8D"
        poner={(o, p) => { o.position.set(p[0], 2.4, -p[1]); o.rotation.set(0, 0, 0); o.scale.setScalar(1) }} />
      <Instancias items={postes} geo={<boxGeometry args={[0.9, 0.12, 0.3]} />} color="#ECF0F1"
        poner={(o, p) => { o.position.set(p[0], 5.0, -p[1]); o.rotation.set(0, p[2], 0); o.scale.setScalar(1) }} />
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

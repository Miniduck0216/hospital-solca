// Vista 3D: el modelo real de la planta baja (el mismo IFC que va a Revit, convertido a GLB) sobre el mapa de
// la zona, con la ruta dibujada en el piso y un recorrido que la sigue.
import { Suspense, forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import maplibregl from 'maplibre-gl'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, useGLTF, Line, Html } from '@react-three/drei'
import { BASE, aLonLat, rumbo, dePlano, CATS } from './datos.js'
import { Cargando } from './Cargando.jsx'
import { Exterior } from './Exterior3D.jsx'
import { Letreros } from './Letreros3D.jsx'
import { LIGERO, REDUCIR } from './rendimiento.js'

const E = ([x, y], h = 0) => new THREE.Vector3(x, h, -y)    // plano (x, y) -> escena

function SueloMapa({ centro, onListo }) {
  const [tex, setTex] = useState(null)
  const LADO = 560, PX = LIGERO ? 1024 : 2048
  useEffect(() => {
    let vivo = true
    const div = document.createElement('div')
    Object.assign(div.style, { position: 'fixed', left: '-99999px', top: '0', width: PX + 'px', height: PX + 'px', pointerEvents: 'none' })
    document.body.appendChild(div)
    const c = aLonLat(centro[0], centro[1])
    const mpp = LADO / PX
    const zoom = Math.log2((78271.517 * Math.cos((c[1] * Math.PI) / 180)) / mpp)
    let map
    try {
      map = new maplibregl.Map({ container: div, style: 'https://tiles.openfreemap.org/styles/positron', center: c, zoom, bearing: rumbo(),
        interactive: false, attributionControl: false, pixelRatio: 1, preserveDrawingBuffer: true, fadeDuration: 0 })
      // estilo sobrio de plano de sitio: césped apagado de fondo, calles gris claro, aceras casi blancas, sin rótulos
      // (el fondo conserva algo de verde: Exterior3D reconoce el pasto por ese tono al repartir árboles)
      map.on('style.load', () => {
        for (const l of map.getStyle().layers) {
          try {
            if (l.type === 'symbol') map.setLayoutProperty(l.id, 'visibility', 'none')
            else if (l.type === 'background') map.setPaintProperty(l.id, 'background-color', '#D3E0CC')
            else if (l.type === 'fill' && /water/.test(l.id)) map.setPaintProperty(l.id, 'fill-color', '#C9DCE6')
            else if (l.type === 'fill' && /building/.test(l.id)) map.setPaintProperty(l.id, 'fill-color', '#E6E8EB')
            else if (l.type === 'fill' && /park|grass|wood|garden|pitch|forest|scrub|meadow|cemetery/.test(l.id)) map.setPaintProperty(l.id, 'fill-color', '#C3D4BC')
            else if (l.type === 'fill') map.setPaintProperty(l.id, 'fill-color', '#D3E0CC')
            else if (l.type === 'line' && /path|pedestrian|footway|steps|track/.test(l.id)) map.setPaintProperty(l.id, 'line-color', '#ECEDEF')
            else if (l.type === 'line' && /casing/.test(l.id)) map.setPaintProperty(l.id, 'line-color', '#E1E4E8')
            else if (l.type === 'line' && /road|highway|street|bridge|tunnel|motorway|trunk|primary|secondary|tertiary|minor|service/.test(l.id)) map.setPaintProperty(l.id, 'line-color', '#AEB4BC')
            else if (l.type === 'line' && /boundary|admin/.test(l.id)) map.setLayoutProperty(l.id, 'visibility', 'none')
          } catch { /* capa sin esa propiedad */ }
        }
      })
    } catch { div.remove(); return }
    let hecho = false
    let intentos = 0
    let espera = 0   // reintento del suelo (se cancela al salir del 3D)
    const copiar = () => {
      if (!vivo || hecho) return
      // ¿ya hay calles dibujadas? (si el lienzo es liso todavía no llegaron las teselas)
      const prueba = document.createElement('canvas')
      prueba.width = prueba.height = 64
      const pc = prueba.getContext('2d', { willReadFrequently: true })
      pc.drawImage(map.getCanvas(), 0, 0, 64, 64)
      const px = pc.getImageData(0, 0, 64, 64).data
      let s1 = 0, s2 = 0
      for (let i = 0; i < px.length; i += 4) { const v = px[i] + px[i + 1] + px[i + 2]; s1 += v; s2 += v * v }
      const n = px.length / 4
      const desv = Math.sqrt(Math.max(0, s2 / n - (s1 / n) ** 2))
      if (desv < 4 && intentos++ < 8) { espera = setTimeout(() => { map.triggerRepaint(); map.once('idle', copiar) }, 1200); return }
      hecho = true
      const cv = document.createElement('canvas')
      cv.width = cv.height = PX
      const ctx = cv.getContext('2d')
      ctx.drawImage(map.getCanvas(), 0, 0, PX, PX)
      const t = new THREE.CanvasTexture(cv)
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = LIGERO ? 1 : 8
      t.generateMipmaps = true
      t.minFilter = THREE.LinearMipmapLinearFilter
      setTex(t)
      // el exterior pone los árboles donde el mapa tiene pasto (no sobre calles, veredas ni edificios vecinos)
      try { onListo?.({ px: ctx.getImageData(0, 0, PX, PX).data, PX, LADO, centro }) } catch { /* sin lectura del lienzo */ }
      map.remove(); div.remove()
    }
    map.once('idle', copiar)
    map.on('error', () => {})
    return () => { vivo = false; clearTimeout(espera); try { map.remove() } catch { /* listo */ } div.remove() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <mesh rotation-x={-Math.PI / 2} position={[centro[0], -0.62, -centro[1]]} receiveShadow renderOrder={-1}>
      <planeGeometry args={[LADO, LADO]} />
      {tex ? <meshBasicMaterial key="mapa" map={tex} toneMapped={false} polygonOffset polygonOffsetFactor={4} polygonOffsetUnits={4} />
        : <meshBasicMaterial key="liso" color="#D3E0CC" toneMapped={false} polygonOffset polygonOffsetFactor={4} polygonOffsetUnits={4} />}
    </mesh>
  )
}

// el GLB trae los pisos agrupados por color (pisos|r,g,b|h): cada grupo toma la paleta de interiores de la categoría
// más parecida (la misma del mapa 2D)
// paleta sobria: tonos casi neutros por tipo de ambiente (apenas un matiz para distinguirlos), pasillos casi blancos;
// el único color fuerte de la vista es el azul del destino y de la ruta
const PALETA = Object.fromEntries(Object.entries(CATS).map(([k, c]) => [k, c.relleno]))
const AZUL = '#2F5BEA'
// los colores con que se exportaron los GLB (los rellenos de CATS de entonces): con ellos se reconoce la categoría de
// cada grupo de pisos del modelo. No cambian aunque cambie la paleta de CATS (cambiarían al regenerar los GLB).
const RELLENO_GLB = { consulta: '#E3EBFC', espera: '#E2F3E7', banos: '#DDF0F7', farmacia: '#EFE7FB', administracion: '#FFF0D6', circulacion: '#FFFFFF',
  apoyo: '#EDF0F3', escaleras: '#E4E7EC', ascensores: '#E4E7EC', otro: '#F2F4F7' }
const ACENTOS = Object.entries(RELLENO_GLB).map(([k, c]) => ({ rgb: new THREE.Color(c), color: new THREE.Color(PALETA[k] || PALETA.otro) }))
function colorDePiso(nombre) {
  const [r, g, b] = (nombre.split('|')[1] || '0,0,0').split(',').map(Number)
  let mejor = null, dist = Infinity
  for (const a of ACENTOS) {
    const k = (a.rgb.r - r) ** 2 + (a.rgb.g - g) ** 2 + (a.rgb.b - b) ** 2
    if (k < dist) { dist = k; mejor = a }
  }
  return mejor ? mejor.color.clone() : null
}

// hojas de puerta y manijas del modelo: en el piso que se mira se ocultan porque la web dibuja sus propias puertas que
// se abren (ver Puertas); en los demás pisos quedan las del modelo, cerradas
// MARCO: los marcos de las puertas del modelo (gris oscuro); se pintan aparte para que el vano se lea contra el muro
const MARCO = 'muros|0.102,0.109,0.130'
// nombre de una malla del modelo tal como se exportó (grupo|r,g,b|h). Al cargar el GLB, three.js quita los puntos de
// los nombres («muros|0.360,0.160,0.053» queda «muros|0360,0160,0053») y guarda el original en userData.name: sin
// esto no se reconocían las hojas de puerta del modelo (quedaban a la vista, encimadas con las de la página) ni el
// color de cada grupo de pisos
const nombreDe = (o) => {
  const n = o.userData?.name || o.parent?.userData?.name || o.name || o.parent?.name || ''
  return n.includes('.') ? n : n.replace(/(^|[|,])(\d)(\d{2,3})(?=[|,]|$)/g, '$1$2.$3')
}
const HOJAS_MADERA = ['muros|0.360,0.160,0.053', 'muros|0.562,0.026,0.014']
const OCULTOS = [...HOJAS_MADERA, 'muebles|0.672,0.672,0.706']

// altura de un piso a otro (muros de 3,84 m + losa) y cuánto suben los pisos de arriba al mirar uno de abajo
export const H_PISO = 4.2
const ALZAR = 38

// un piso del edificio: su modelo (una o varias partes), su techo y su posición. Estados:
// 'activo' (el que se mira: muros cortados a la altura elegida, pisos de color y puertas que se abren),
// 'abajo' (completo, con su techo), 'arriba' (sube y desaparece) y 'oculto' (el subsuelo bajo tierra)
function Piso3D({ p, techo, estado, corte, letreros, y0 = p.nivel * H_PISO }) {
  const grupo = useRef()
  const plano = useMemo(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), 9999), [])
  const meta = estado === 'arriba' ? y0 + ALZAR + Math.max(0, p.nivel) * 6 : y0
  const activo = estado === 'activo'
  useEffect(() => { plano.constant = activo && corte < 3.8 ? y0 + corte : 9999 }, [activo, corte, y0, plano])
  useFrame((_, dt) => {
    const g = grupo.current
    if (!g) return
    const k = 1 - Math.exp(-Math.min(dt, 0.25) * 3.2)
    g.position.y += (meta - g.position.y) * k
    // al subir se va desvaneciendo: deja de dibujarse cuando ya está lejos
    g.visible = estado !== 'oculto' && !(estado === 'arriba' && g.position.y > y0 + ALZAR * 0.8)
  })
  const glb = Array.isArray(p.glb) ? p.glb : [p.glb]
  return (
    <group ref={grupo} position-y={y0} visible={estado !== 'oculto'}>
      {glb.filter(Boolean).map((u) => (
        <Suspense key={u} fallback={null}><ParteEdificio url={u} activo={activo} corte={activo ? corte : 9} letreros={activo && letreros} plano={plano} /></Suspense>
      ))}
      {techo && !activo && <Techo huella={techo} />}
    </group>
  )
}

function ParteEdificio({ url, activo, corte, letreros, plano }) {
  const { scene } = useGLTF(`${BASE}${url}?v=${__VERSION__}`)
  const { gl } = useThree()
  // tapa de los muros cortados: al recortar la altura, el interior hueco del muro se veía como un bloque gris
  // descuadrado; las caras traseras se pintan del color de la tapa y el corte se ve macizo. La tapa es oscura, como el
  // muro seccionado de un plano de arquitectura: da el contorno de cada cuarto sobre los pisos claros
  const tapa = useMemo(() => new THREE.MeshBasicMaterial({ color: '#5B6472', side: THREE.BackSide }), [])
  useEffect(() => { gl.localClippingEnabled = true; tapa.clippingPlanes = [plano] }, [gl, plano, tapa])
  useEffect(() => () => tapa.dispose(), [tapa])
  useEffect(() => {
    scene.traverse((o) => {
      if (!o.isMesh || o.userData.tapa) return
      o.castShadow = true
      o.receiveShadow = true
      const nombre = nombreDe(o)
      const g = nombre.split('|')[0]
      if (OCULTOS.some((k) => nombre.startsWith(k))) {
        o.visible = !activo
        // hojas de madera del modelo: en los pisos que no se miran salen claras, como las de la página (#E4E1DB)
        if (!activo && !o.userData.clara && HOJAS_MADERA.some((k) => nombre.startsWith(k))) { o.material = o.material.clone(); o.material.color.set('#E4E1DB'); o.userData.clara = true }
        return
      }
      const m = o.material
      if (g === 'pisos' && !o.userData.coloreado) {
        const c = colorDePiso(nombre)
        if (c) { o.material = m.clone(); o.material.color.copy(c); o.material.roughness = 0.95 }
        o.userData.coloreado = true
      }
      // los pisos de color del piso que se mira los dibuja PisosColor (con el destino resaltado); en los demás
      // quedan los del modelo
      if (g === 'pisos') o.visible = !activo || nombre.startsWith('pisos|0.384')
      if (g === 'letreros') o.visible = letreros
      if (g === 'viseras') o.visible = corte >= 3.8
      // paleta de interiores: muros casi blancos, mobiliario gris claro, marcos de puerta gris medio
      if ((g === 'muros' || g === 'muebles') && !o.userData.tono && o.material?.color) {
        const hsl = o.material.color.getHSL({})
        if (nombre.startsWith(MARCO)) { o.material = o.material.clone(); o.material.color.set('#6B7280'); o.material.roughness = 0.9 }
        else if (nombre.startsWith('muros|0.902')) { o.material = o.material.clone(); o.material.color.set('#FAFAF8'); o.material.roughness = 1 }
        else if (hsl.s < 0.12) { o.material = o.material.clone(); o.material.color.set(g === 'muros' ? '#F1F2F3' : '#D9DDE2'); o.material.roughness = 1 }
        // mobiliario de color (madera, tapizados): se apaga hacia el gris para que no compita con la ruta
        else if (g === 'muebles' && !o.material.transparent) { o.material = o.material.clone(); o.material.color.setHSL(hsl.h, hsl.s * 0.35, 0.45 + hsl.l * 0.5); o.material.roughness = 1 }
        o.userData.tono = true
      }
      if (o.material && g !== 'pisos') { o.material.clippingPlanes = [plano]; o.material.clipShadows = true; o.material.needsUpdate = true }
      // el modelo queda en memoria al salir del 3D: al volver, su tapa tenía el plano de corte de la vista anterior
      // (ya sin uso) y no se recortaba; los cuartos se veían como bloques macizos con muros bajos o medios
      const tapaVieja = o.userData.conTapa && o.children.find((c) => c.userData.tapa)
      if (tapaVieja && tapaVieja.material !== tapa) tapaVieja.material = tapa
      if (g === 'muros' && !o.userData.conTapa && o.material && !o.material.transparent) {
        o.material.side = THREE.FrontSide
        const t = new THREE.Mesh(o.geometry, tapa)
        t.userData.tapa = true
        t.raycast = () => {}
        o.add(t)
        o.userData.conTapa = true
      }
    })
  }, [scene, activo, corte, letreros, plano, tapa])
  return <primitive object={scene} />
}

// techo de un piso: losa sobre su huella (con los patios y tragaluces abiertos) y un antepecho en el borde
const TECHO = new THREE.MeshStandardMaterial({ color: '#D9DCE0', roughness: 0.95 })
const ANTEPECHO = new THREE.MeshStandardMaterial({ color: '#EEF0F2', roughness: 1 })
function Techo({ huella }) {
  const geos = useMemo(() => {
    const V = ([x, y]) => new THREE.Vector2(x, y)
    const losas = [], bordes = []
    for (const pg of huella || []) {
      const [ext, ...huecos] = pg
      if (!ext || ext.length < 3) continue
      const anillo = ext[0][0] === ext[ext.length - 1][0] && ext[0][1] === ext[ext.length - 1][1] ? ext.slice(0, -1) : ext
      const forma = new THREE.Shape(anillo.map(V))
      for (const h of huecos) forma.holes.push(new THREE.Path(h.map(V)))
      const g = new THREE.ExtrudeGeometry(forma, { depth: 0.36, bevelEnabled: false })
      g.rotateX(-Math.PI / 2)
      losas.push(g)
      // antepecho: el borde exterior, 25 cm hacia adentro, 0,9 m de alto
      const borde = new THREE.Shape(anillo.map(V))
      borde.holes.push(new THREE.Path(ensanchar(anillo, -0.25).map(V)))
      const b = new THREE.ExtrudeGeometry(borde, { depth: 0.9, bevelEnabled: false })
      b.rotateX(-Math.PI / 2)
      b.translate(0, 0.36, 0)
      bordes.push(b)
    }
    return { losas, bordes }
  }, [huella])
  // R3F no libera las geometrías que se pasan como prop: se liberan al desmontar
  useEffect(() => () => [...geos.losas, ...geos.bordes].forEach((g) => g.dispose()), [geos])
  // la losa va justo bajo el piso de arriba (que la tapa donde lo hay) y se ve como azotea donde no
  return (
    <group position-y={3.84}>
      {geos.losas.map((g, k) => <mesh key={'l' + k} geometry={g} material={TECHO} receiveShadow castShadow />)}
      {geos.bordes.map((g, k) => <mesh key={'b' + k} geometry={g} material={ANTEPECHO} castShadow />)}
    </group>
  )
}

// medidas de la ruta: largo total y punto/dirección a una distancia dada
function medir(pts) {
  const acum = [0]
  for (let i = 1; i < pts.length; i++) acum.push(acum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
  const L = acum[acum.length - 1]
  const en = (s) => {
    let k = 1
    while (k < acum.length - 1 && acum[k] < s) k++
    const t = (s - acum[k - 1]) / ((acum[k] - acum[k - 1]) || 1)
    return { x: pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * t, y: pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * t, dx: pts[k][0] - pts[k - 1][0], dy: pts[k][1] - pts[k - 1][1] }
  }
  return { L, en }
}

// ruta 3D: el camino que recorre el personaje, simplificado (Douglas-Peucker, 0,25 m) con las esquinas apenas
// redondeadas (0,5 m). Va pegado al piso y respeta la profundidad: muros y personaje la tapan como debe.
// Lo caminado (gris) y lo que falta (azul) son dos líneas que no se solapan, partidas en la posición del personaje;
// el filete blanco va debajo de ambas y asoma poco.
// No se usan las «esquinas» del tramo: el personaje camina la curva de redondeo, y una línea recta por esas
// esquinas se separaría de él hasta casi un metro.
function simplificar(P, tol) {
  if (P.length < 3) return P
  const keep = new Uint8Array(P.length)
  keep[0] = 1; keep[P.length - 1] = 1
  const pila = [[0, P.length - 1]]
  while (pila.length) {
    const [a, b] = pila.pop()
    const [ax, ay] = P[a], [bx, by] = P[b]
    const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1
    let mx = 0, im = -1
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((P[i][0] - ax) * dy - (P[i][1] - ay) * dx) / l
      if (d > mx) { mx = d; im = i }
    }
    if (mx > tol) { keep[im] = 1; pila.push([a, im], [im, b]) }
  }
  return P.filter((_, i) => keep[i])
}

// redondea cada vértice con un arco de radio r (sin pasar de la mitad de los tramos vecinos)
function redondearEsquinas(P, r, seg) {
  if (P.length < 3) return P
  const out = [P[0]]
  for (let i = 1; i < P.length - 1; i++) {
    const V = P[i], A = P[i - 1], B = P[i + 1]
    const la = Math.hypot(A[0] - V[0], A[1] - V[1]) || 1, lb = Math.hypot(B[0] - V[0], B[1] - V[1]) || 1
    const u = [(A[0] - V[0]) / la, (A[1] - V[1]) / la], w = [(B[0] - V[0]) / lb, (B[1] - V[1]) / lb]
    const phi = Math.acos(Math.max(-1, Math.min(1, u[0] * w[0] + u[1] * w[1])))   // ángulo interior del giro
    if (phi > Math.PI * 0.94) { out.push(V); continue }   // casi recto: no hay esquina
    const t = Math.tan(phi / 2)
    const rr = Math.min(r, 0.5 * la * t, 0.5 * lb * t)
    const d = rr / t
    const T1 = [V[0] + u[0] * d, V[1] + u[1] * d], T2 = [V[0] + w[0] * d, V[1] + w[1] * d]
    const bx = u[0] + w[0], by = u[1] + w[1], bl = Math.hypot(bx, by) || 1
    const dc = rr / Math.sin(phi / 2)
    const C = [V[0] + (bx / bl) * dc, V[1] + (by / bl) * dc]
    const a1 = Math.atan2(T1[1] - C[1], T1[0] - C[0])
    let da = Math.atan2(T2[1] - C[1], T2[0] - C[0]) - a1
    while (da > Math.PI) da -= 2 * Math.PI
    while (da < -Math.PI) da += 2 * Math.PI
    out.push(T1)
    for (let k = 1; k < seg; k++) {
      const a = a1 + (da * k) / seg
      out.push([C[0] + rr * Math.cos(a), C[1] + rr * Math.sin(a)])
    }
    out.push(T2)
  }
  out.push(P[P.length - 1])
  return out
}

// punto de la línea más cercano a p: el tramo (seg-1, seg) y el punto; busca cerca del último tramo y, si
// la persona está lejos de todo eso, en toda la línea
function cercano(D, p, pista) {
  let mejor = Infinity, seg = 1, pt = D[0]
  const buscar = (ini, fin) => {
    for (let i = ini; i <= fin; i++) {
      const [ax, ay] = D[i - 1], [bx, by] = D[i]
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1
      const t = Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / l2))
      const qx = ax + dx * t, qy = ay + dy * t, d = (qx - p[0]) ** 2 + (qy - p[1]) ** 2
      if (d < mejor) { mejor = d; seg = i; pt = [qx, qy] }
    }
  }
  buscar(Math.max(1, pista - 3), Math.min(D.length - 1, pista + 60))
  if (mejor > 9) { mejor = Infinity; buscar(1, D.length - 1) }
  return { seg, pt }
}

function Ruta({ ruta, andado, persona }) {
  const D = useMemo(() => redondearEsquinas(simplificar(ruta.pts, 0.25), 0.5, LIGERO ? 2 : 4), [ruta])
  const cum = useMemo(() => {
    const c = [0]
    for (let i = 1; i < D.length; i++) c.push(c[i - 1] + Math.hypot(D[i][0] - D[i - 1][0], D[i][1] - D[i - 1][1]))
    return c
  }, [D])
  const total = cum[cum.length - 1] || 0
  const linea = useMemo(() => D.map((p) => E(p, 0.09)), [D])
  const filete = useMemo(() => D.map((p) => E(p, 0.086)), [D])
  // dónde va el personaje sobre la línea; se actualiza cada 0,1 m (no en cada cuadro)
  const [corte, setCorte] = useState(null)   // { seg, pt, arc } o null
  const ult = useRef(-1)
  useFrame(() => {
    const p = persona.current
    if (andado.current === null || !p) {
      if (ult.current !== -1) { ult.current = -1; setCorte(null) }
      return
    }
    const { seg, pt } = cercano(D, p, corte ? corte.seg : 1)
    const arc = cum[seg - 1] + Math.hypot(pt[0] - D[seg - 1][0], pt[1] - D[seg - 1][1])
    if (ult.current !== -1 && Math.abs(arc - ult.current) < 0.1) return
    ult.current = arc
    setCorte({ seg, pt, arc })
  })
  const [gris, azul] = useMemo(() => {
    if (!corte) return [null, linea]
    const g = corte.arc >= 0.05 ? [...D.slice(0, corte.seg), corte.pt].map((q) => E(q, 0.09)) : null
    const a = total - corte.arc >= 0.05 ? [corte.pt, ...D.slice(corte.seg)].map((q) => E(q, 0.09)) : null
    return [g, a]
  }, [corte, D, linea, total])
  return (
    <group>
      <Line points={filete} color="#FFFFFF" lineWidth={LIGERO ? 7 : 8.5} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
      {azul && <Line points={azul} color={AZUL} lineWidth={LIGERO ? 5 : 6} polygonOffset polygonOffsetFactor={-4} polygonOffsetUnits={-4} />}
      {gris && <Line points={gris} color="#B9C3D3" lineWidth={LIGERO ? 5 : 6} polygonOffset polygonOffsetFactor={-4} polygonOffsetUnits={-4} />}
      <Meta pos={ruta.pts[ruta.pts.length - 1]} />
    </group>
  )
}

// destino: un disco azul fijo en el piso con borde blanco (sin pulso ni columna de luz); el cuarto de destino ya
// va pintado de azul (ver PisosColor)
function Meta({ pos }) {
  return (
    <group position={E(pos, 0)}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.1}><circleGeometry args={[0.66, 40]} /><meshBasicMaterial color="#FFFFFF" toneMapped={false} /></mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.11}><circleGeometry args={[0.5, 40]} /><meshBasicMaterial color={AZUL} toneMapped={false} /></mesh>
    </group>
  )
}

// personaje: una persona estilizada de formas redondeadas (cabeza esférica, torso, brazos y piernas en cápsula),
// de un solo azul con la cabeza un tono más clara y sin cara. Al caminar balancea piernas y brazos y el cuerpo
// sube y baja un poco; el ritmo sale de la distancia recorrida (paso.current.s), no del reloj, para que los pies
// no patinen. Quieta cuando el recorrido está en pausa o detenido; sin balanceo con movimiento reducido.
const PASO = 1.4   // metros de una vuelta completa del paso (dos pasos)
const PUNTA = (() => {
  const f = new THREE.Shape([new THREE.Vector2(-0.2, 0.5), new THREE.Vector2(0.2, 0.5), new THREE.Vector2(0, 0.86)])
  const g = new THREE.ShapeGeometry(f)
  g.rotateX(Math.PI / 2)   // al piso: la punta (y del dibujo) queda hacia +z
  return g
})()
function Personaje({ paso }) {
  const cuerpo = useRef(), piernaI = useRef(), piernaD = useRef(), brazoI = useRef(), brazoD = useRef()
  const amp = useRef(0)
  const geo = useMemo(() => {
    const cs = LIGERO ? 2 : 4, rs = LIGERO ? 8 : 14
    return {
      cabeza: new THREE.SphereGeometry(0.115, LIGERO ? 10 : 18, LIGERO ? 8 : 14),
      torso: new THREE.CapsuleGeometry(0.17, 0.34, cs, rs),
      brazo: new THREE.CapsuleGeometry(0.07, 0.42, cs, LIGERO ? 6 : 10),
      pierna: new THREE.CapsuleGeometry(0.105, 0.62, cs, LIGERO ? 6 : 10),
    }
  }, [])
  const mat = useMemo(() => ({
    cuerpo: new THREE.MeshStandardMaterial({ color: AZUL, roughness: 0.8 }),
    cabeza: new THREE.MeshStandardMaterial({ color: '#6F92F5', roughness: 0.8 }),
  }), [])
  useEffect(() => () => {
    Object.values(geo).forEach((g) => g.dispose())
    Object.values(mat).forEach((m) => m.dispose())
  }, [geo, mat])
  useFrame((_, dt) => {
    const p = paso.current
    const quiere = p.mov && !REDUCIR ? 1 : 0
    amp.current += (quiere - amp.current) * (1 - Math.exp(-Math.min(dt, 0.1) * 10))
    const a = amp.current
    const ang = (p.s / PASO) * Math.PI * 2
    const sw = Math.sin(ang) * 0.45 * a   // piernas en contrafase; brazos al revés, algo más cortos
    piernaI.current.rotation.x = sw; piernaD.current.rotation.x = -sw
    brazoI.current.rotation.x = -sw * 0.8; brazoD.current.rotation.x = sw * 0.8
    // el cuerpo baja un poco a mitad de cada paso (dos veces por vuelta); los pies quedan hundidos en el piso
    cuerpo.current.position.y = (-0.02 * a * (1 - Math.cos(2 * ang))) / 2
  })
  return (
    <group ref={cuerpo}>
      <mesh geometry={geo.torso} material={mat.cuerpo} position-y={1.2} castShadow />
      <mesh geometry={geo.cabeza} material={mat.cabeza} position-y={1.585} castShadow />
      <group ref={brazoI} position={[-0.25, 1.4, 0]}><mesh geometry={geo.brazo} material={mat.cuerpo} position-y={-0.28} castShadow /></group>
      <group ref={brazoD} position={[0.25, 1.4, 0]}><mesh geometry={geo.brazo} material={mat.cuerpo} position-y={-0.28} castShadow /></group>
      <group ref={piernaI} position={[-0.11, 0.85, 0]}><mesh geometry={geo.pierna} material={mat.cuerpo} position-y={-0.415} castShadow /></group>
      <group ref={piernaD} position={[0.11, 0.85, 0]}><mesh geometry={geo.pierna} material={mat.cuerpo} position-y={-0.415} castShadow /></group>
      <mesh rotation-x={-Math.PI / 2} position-y={0.1}><ringGeometry args={[0.38, 0.5, 40]} /><meshBasicMaterial color="#FFFFFF" toneMapped={false} /></mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.1}><circleGeometry args={[0.38, 32]} /><meshBasicMaterial color={AZUL} transparent opacity={0.3} toneMapped={false} /></mesh>
      <mesh geometry={PUNTA} position-y={0.1}><meshBasicMaterial color={AZUL} side={THREE.DoubleSide} toneMapped={false} /></mesh>
    </group>
  )
}

// puertas: cada hoja gira sobre su bisagra. Las que cruza la ruta están abiertas (hacia donde se camina) desde que
// aparece la ruta, sin animación; en el recorrido se abren al acercarse el personaje (a menos de 2,4 m, hacia el lado
// contrario a él) y se cierran cuando se aleja.
// Con los muros bajos (corte por debajo del dintel) la hoja maciza quedaba recortada como una tabla suelta: ahí se
// dibuja el símbolo de plano en el piso (la hoja abierta y su arco de 90°), quieto y en una sola malla.
const ALTO_HOJA = 2.04
function cruce(a, b, p, q) {
  // intersección de los segmentos a-b (puerta) y p-q (tramo de ruta): devuelve t en p-q o null
  const r = [b[0] - a[0], b[1] - a[1]], s = [q[0] - p[0], q[1] - p[1]]
  const den = r[0] * s[1] - r[1] * s[0]
  if (Math.abs(den) < 1e-9) return null
  const ap = [p[0] - a[0], p[1] - a[1]]
  const u = (ap[0] * s[1] - ap[1] * s[0]) / den, t = (ap[0] * r[1] - ap[1] * r[0]) / den
  return u >= -0.05 && u <= 1.05 && t >= 0 && t <= 1 ? t : null
}
function Puertas({ puertas, plano, persona, ruta, recorrer, corte }) {
  const hojas = useMemo(() => {
    const out = []
    for (const p of puertas) {
      const a = p.a, b = p.b
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
      const tramos = p.doble ? [[a, mid], [b, mid]] : [[a, b]]
      for (const [h, f] of tramos) {
        const dx = f[0] - h[0], dy = f[1] - h[1], L = Math.hypot(dx, dy)
        if (L < 0.2) continue
        const ux = dx / L, uy = dy / L
        // la hoja va a "c" metros del eje, sobre la normal de la puerta (calculada con su dirección a -> b)
        const D = [b[0] - a[0], b[1] - a[1]], DL = Math.hypot(...D) || 1
        const n = [-D[1] / DL, D[0] / DL]
        const nl = [-uy, ux]   // normal propia de esta hoja
        const lado = n[0] * nl[0] + n[1] * nl[1]
        const off = (p.c || 0) * lado
        // la bisagra va en la cara del muro donde está la hoja (a "c" del eje): así la hoja gira pegada a la jamba
        const eje = [h[0] + nl[0] * off, h[1] + nl[1] * off]
        // sin ruta, el símbolo abre hacia la cara donde está montada la hoja (las dos hojas de una doble, al mismo lado)
        const abre0 = (p.c || 0) < -0.01 ? -lado : lado
        out.push({ h, eje, a, b, u: [ux, uy], L: p.doble ? L - 0.005 : L - 0.1, ini: p.doble ? 0.005 : 0.05, th: Math.atan2(uy, ux), nl, abre0: abre0 >= 0 ? 1 : -1, ducto: p.ducto, mid })
      }
    }
    return out
  }, [puertas])
  // puertas que cruza la ruta: distancia a lo largo de la ruta y hacia qué lado se abren (hacia donde se camina)
  const enRuta = useMemo(() => {
    const m = new Map()
    if (!ruta) return m
    const P = ruta.pts
    let acum = 0
    for (let i = 1; i < P.length; i++) {
      const p = P[i - 1], q = P[i], L = Math.hypot(q[0] - p[0], q[1] - p[1])
      hojas.forEach((hj, k) => {
        if (m.has(k)) return
        const t = cruce(hj.a, hj.b, p, q)
        if (t === null) return
        const v = [q[0] - p[0], q[1] - p[1]]
        m.set(k, { s: acum + t * L, abre: v[0] * hj.nl[0] + v[1] * hj.nl[1] > 0 ? Math.PI / 2 : -Math.PI / 2 })
      })
      acum += L
    }
    return m
  }, [ruta, hojas])
  // con muros bajos: símbolo en el piso; con muros medios o completos: la hoja de 2,04 m
  const simbolo = corte < ALTO_HOJA + 0.06
  const grupos = useRef([])
  const ang = useRef(new Float32Array(hojas.length))
  useEffect(() => { ang.current = new Float32Array(hojas.length) }, [hojas])
  const mats = useMemo(() => {
    const canto = new THREE.MeshStandardMaterial({ color: '#8A8F98', roughness: 0.8 })
    const cara = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 })
    const clara = cara('#E4E1DB'), ducto = cara('#B9A9A6')
    // caja: +x, -x, +y, -y son los cantos; +z y -z, las caras de la hoja
    return { canto, clara, ducto, hoja: [canto, canto, canto, canto, clara, clara], hojaDucto: [canto, canto, canto, canto, ducto, ducto],
      manija: new THREE.MeshStandardMaterial({ color: '#8A8F98', roughness: 0.4, metalness: 0.4 }),
      linea: new THREE.MeshBasicMaterial({ color: '#4B5563', side: THREE.DoubleSide, toneMapped: false, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }) }
  }, [])
  useEffect(() => { for (const m of [mats.canto, mats.clara, mats.ducto, mats.manija]) m.clippingPlanes = [plano] }, [mats, plano])
  // símbolo de plano de todas las puertas en una sola malla: la hoja abierta (4 cm) y el arco que recorre al abrir
  const geoSimbolo = useMemo(() => {
    if (!simbolo) return null
    const v = []
    const cinta = (pts, medio) => {
      for (let i = 1; i < pts.length; i++) {
        const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]
        const l = Math.hypot(x1 - x0, y1 - y0) || 1
        const nx = (-(y1 - y0) / l) * medio, ny = ((x1 - x0) / l) * medio
        v.push(x0 + nx, 0, -(y0 + ny), x0 - nx, 0, -(y0 - ny), x1 + nx, 0, -(y1 + ny), x1 + nx, 0, -(y1 + ny), x0 - nx, 0, -(y0 - ny), x1 - nx, 0, -(y1 - ny))
      }
    }
    hojas.forEach((hj, k) => {
      const r = enRuta.get(k)
      const s = r ? Math.sign(r.abre) : hj.abre0
      const w = [hj.nl[0] * s, hj.nl[1] * s]   // hacia donde queda la hoja abierta
      const R = hj.ini + hj.L
      cinta([hj.eje, [hj.eje[0] + w[0] * R, hj.eje[1] + w[1] * R]], 0.03)
      if (hj.ducto) return
      const arco = []
      for (let i = 0; i <= 8; i++) {
        const t = (i / 8) * (Math.PI / 2), c = Math.cos(t), q = Math.sin(t)
        arco.push([hj.eje[0] + (hj.u[0] * c + w[0] * q) * R, hj.eje[1] + (hj.u[1] * c + w[1] * q) * R])
      }
      cinta(arco, 0.012)
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3))
    return g
  }, [simbolo, hojas, enRuta])
  useEffect(() => () => geoSimbolo?.dispose(), [geoSimbolo])
  useFrame((_, dt) => {
    if (simbolo) return
    const q = persona.current
    hojas.forEach((hj, k) => {
      const g = grupos.current[k]
      if (!g) return
      let meta = 0
      const r = enRuta.get(k)
      if (recorrer) {
        if (q && Math.hypot(q[0] - hj.mid[0], q[1] - hj.mid[1]) < 2.4) {
          if (r) meta = r.abre
          else {
            // gira hacia el lado contrario de donde viene la persona
            const lado = (q[0] - hj.h[0]) * hj.nl[0] + (q[1] - hj.h[1]) * hj.nl[1]
            meta = lado > 0 ? -Math.PI / 2 : Math.PI / 2
            if (ang.current[k] !== 0 && Math.sign(ang.current[k]) !== Math.sign(meta)) meta = ang.current[k] > 0 ? Math.PI / 2 : -Math.PI / 2
          }
        }
        // en el recorrido la hoja gira de verdad (rápido); con movimiento reducido cambia de golpe
        ang.current[k] = REDUCIR ? meta : ang.current[k] + (meta - ang.current[k]) * (1 - Math.exp(-Math.min(dt, 0.1) * 8))
      } else ang.current[k] = r ? r.abre : 0   // fuera del recorrido: las de la ruta, abiertas; sin ola ni giro
      g.rotation.y = hj.th + ang.current[k]
    })
  })
  if (simbolo) return <mesh geometry={geoSimbolo} material={mats.linea} position-y={0.062} renderOrder={2} frustumCulled={false} />
  return (
    <group>
      {hojas.map((hj, k) => (
        <group key={k} ref={(el) => { grupos.current[k] = el }} position={E(hj.eje, 0)} rotation-y={hj.th}>
          {/* local +x = a lo largo de la hoja; la normal del plano (nl) es -z local */}
          <mesh position={[hj.ini + hj.L / 2, 0.01 + ALTO_HOJA / 2, 0]} material={hj.ducto ? mats.hojaDucto : mats.hoja} castShadow>
            <boxGeometry args={[hj.L, ALTO_HOJA, 0.04]} />
          </mesh>
          {/* manija: una barra corta a cada cara de la hoja */}
          {!hj.ducto && [0.035, -0.035].map((z) => (
            <mesh key={z} position={[hj.ini + hj.L - 0.12, 1.0, z]} material={mats.manija}>
              <boxGeometry args={[0.12, 0.02, 0.03]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

// el personaje recorre la ruta a 1,3 m/s. La cámara lo acompaña como en un juego en tercera persona: se traslada con
// él, y con el ratón (o el dedo) se puede girar alrededor, subir o bajar la mirada y acercar, sin perderlo de foco
function Caminante({ ruta, recorrer, pausa = false, controles, libre, andado, alTerminar, onAvance, desde, persona, base = 0 }) {
  const ref = useRef()
  const t = useRef(0)
  const fin = useRef(false)
  const { L, en } = useMemo(() => medir(ruta.pts), [ruta])
  const prev = useRef(null)
  const llegada = useRef(0)   // segundos desde que empezó el recorrido (la cámara se acomoda detrás en el primero)
  const ultAv = useRef(0)
  const paso = useRef({ s: 0, mov: false })   // distancia y si camina ahora: para el paso de la figura
  // el recorrido sigue donde iba (al volver del 2D o si la ruta se recalcula mientras se camina)
  useEffect(() => {
    t.current = recorrer && desde ? Math.max(0, desde()) : 0
    fin.current = false; andado.current = recorrer ? t.current : null; prev.current = null; llegada.current = 0; ultAv.current = 0
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruta, recorrer, andado])
  useFrame((_, dt) => {
    if (!ref.current) return
    // tope de 0,25 s por cuadro: en un equipo lento el personaje no camina en cámara lenta
    // en pausa (esperando el ascensor, por ejemplo) el personaje se queda quieto
    if (recorrer && !fin.current && !pausa) t.current += Math.min(dt, 0.25) * 1.3
    const s = Math.min(t.current, L)
    const q = en(s)
    if (recorrer) andado.current = s
    paso.current.s = s; paso.current.mov = recorrer && !pausa && !fin.current && s < L
    ref.current.position.set(q.x, 0.02, -q.y)
    persona.current = [q.x, q.y]
    // el frente del personaje (+z local) mira hacia donde avanza
    ref.current.rotation.y = Math.atan2(q.dx, -q.dy)
    if (recorrer && controles.current) {
      const c = controles.current
      const obj = new THREE.Vector3(q.x, base + 1.3, -q.y)
      const kd = Math.min(dt, 0.1)
      llegada.current += kd
      // cámara libre: mientras la persona gira, mueve o acerca (o con el recorrido en pausa) no se toca la cámara;
      // al soltar, tras un momento, cámara y foco se trasladan juntos de vuelta al personaje (sin cambiar el giro)
      const suelta = !pausa && libre.current.dedos === 0 && performance.now() >= libre.current.hasta
      if (llegada.current < 1.4 && !libre.current.tocado) {
        // al empezar: la cámara se coloca detrás del personaje
        c.target.lerp(obj, 1 - Math.exp(-kd * 6))
        const atras = new THREE.Vector3(-q.dx, 0, q.dy).normalize()
        c.object.position.lerp(obj.clone().add(atras.multiplyScalar(6)).add(new THREE.Vector3(0, 3.2, 0)), 1 - Math.exp(-kd * 4))
        c.update()
      } else if (suelta) {
        const falta = obj.clone().sub(c.target)
        // si ya va pegado lo sigue al instante; si la persona la había alejado, vuelve con suavidad
        const corr = falta.length() < 0.6 ? falta : falta.multiplyScalar(1 - Math.exp(-kd * 3))
        c.target.add(corr)
        c.object.position.add(corr)
        c.update()
      }
      prev.current = obj
    }
    // avance para la barra de navegación (paso actual y metros que faltan), unas 4 veces por segundo
    if (recorrer && (llegada.current - (ultAv.current || 0) > 0.25 || s >= L)) { ultAv.current = llegada.current; onAvance?.(s, L) }
    if (recorrer && s >= L && !fin.current) { fin.current = true; alTerminar?.() }
  })
  return <group ref={ref}><Personaje paso={paso} /></group>
}

// la cámara llega al lugar elegido en el buscador (en 1,2 s, igual a cualquier velocidad de cuadros) y deja un anillo
// fijo que se desvanece; con movimiento reducido la cámara va de una vez
function MarcaFoco({ foco, controles, base = 0 }) {
  const grupo = useRef()
  const aro = useRef(), disco = useRef()
  const t0 = useRef(-1)
  const meta = useMemo(() => new THREE.Vector3(foco.x, base + 0.4, -foco.y), [foco, base])
  useEffect(() => { t0.current = performance.now() }, [foco])
  useFrame((_, dt) => {
    if (!grupo.current || t0.current < 0) return
    const s = (performance.now() - t0.current) / 1000
    grupo.current.visible = s < 2.5
    if (!grupo.current.visible) return
    // 1,5 s a la vista y un segundo para desvanecerse
    const o = Math.min(1, Math.max(0, 2.5 - s))
    if (aro.current) aro.current.opacity = 0.85 * o
    if (disco.current) disco.current.opacity = 0.2 * o
    const c = controles.current
    if (c && s < 1.2) {
      const k = REDUCIR ? 1 : 1 - Math.exp(-Math.min(dt, 0.1) * 5)
      c.target.lerp(meta, k)
      c.object.position.lerp(meta.clone().add(new THREE.Vector3(0, 30, 24)), REDUCIR ? 1 : k * 0.5)
      c.update()
    }
  })
  return (
    <group ref={grupo} position={[meta.x, meta.y - 0.32, meta.z]}>
      <mesh rotation-x={-Math.PI / 2}><ringGeometry args={[1.75, 2.0, 48]} /><meshBasicMaterial ref={aro} color={AZUL} transparent opacity={0.85} /></mesh>
      <mesh rotation-x={-Math.PI / 2}><circleGeometry args={[1.1, 40]} /><meshBasicMaterial ref={disco} color={AZUL} transparent opacity={0.2} /></mesh>
    </group>
  )
}

// pisos de cada ambiente con la paleta de interiores (la misma del 2D) sobre la losa del modelo; el destino en azul
// el contorno de cada ambiente queda unos centímetros antes del muro; se ensancha 12 cm (inglete) para que el piso de
// color llegue hasta debajo del muro y no quede una franja clara descuadrada
function ensanchar(anillo, e) {
  let area = 0
  for (let i = 0; i < anillo.length; i++) { const [x1, y1] = anillo[i], [x2, y2] = anillo[(i + 1) % anillo.length]; area += x1 * y2 - x2 * y1 }
  const s = area > 0 ? 1 : -1   // antihorario: la normal exterior es (dy, -dx)
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

// muros agregados por el administrador (pasos cerrados): se levantan igual que los del modelo
function MurosExtra({ muros, plano }) {
  const geos = useMemo(() => muros.map((pg) => {
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(pg[0].map(([x, y]) => new THREE.Vector2(x, y))), { depth: 3.84, bevelEnabled: false })
    g.rotateX(-Math.PI / 2)
    return g
  }), [muros])
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#FAFAF8', roughness: 1 }), [])
  useEffect(() => { mat.clippingPlanes = [plano] }, [mat, plano])
  useEffect(() => () => { geos.forEach((g) => g.dispose()); mat.dispose() }, [geos, mat])
  return <group>{geos.map((g, k) => <mesh key={k} geometry={g} material={mat} castShadow receiveShadow />)}</group>
}

function PisosColor({ d, destino }) {
  const piezas = useMemo(() => d.ambientes.filter((a) => a.pg.length && a.pg[0].length > 2).map((a) => {
    const [ext0, ...huecos] = a.pg
    const ext = ensanchar(ext0[0][0] === ext0[ext0.length - 1][0] && ext0[0][1] === ext0[ext0.length - 1][1] ? ext0.slice(0, -1) : ext0, 0.12)
    const forma = new THREE.Shape(ext.map(([x, y]) => new THREE.Vector2(x, y)))
    for (const h of huecos) forma.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))))
    const g = new THREE.ShapeGeometry(forma)
    g.rotateX(-Math.PI / 2)
    const plano = !!(a.cat === 'circulacion' || a.cat === 'espera' || (!a.nombre && a.area >= 30))
    // los cuartos van 5 mm sobre los pasillos: donde se tocan (en las puertas) no parpadean
    return { id: a.id, g, y: plano ? 0 : 0.005, color: plano ? PALETA[a.cat] || PALETA.circulacion : PALETA[a.cat] || PALETA.otro }
  }), [d])
  useEffect(() => () => piezas.forEach((p) => p.g.dispose()), [piezas])
  return (
    <group position-y={0.04}>
      {piezas.map((p) => (
        <mesh key={p.id} geometry={p.g} position-y={p.y} receiveShadow>
          <meshStandardMaterial color={destino && destino.id === p.id ? AZUL : p.color} roughness={0.95} polygonOffset polygonOffsetFactor={-2} />
        </mesh>
      ))}
    </group>
  )
}

// pantalla táctil (tótem, celular): sin rueda ni clic derecho; se usan dedos y los botones + / −
const TACTIL = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches

// acerca o aleja la cámara hacia su foco de forma suave (botones + / − del dock, sin rueda del ratón)
function ZoomSuave({ controles, pedido }) {
  useFrame((_, dt) => {
    const c = controles.current, p = pedido.current
    if (!c || !p) return
    const k = 1 - Math.exp(-Math.min(dt, 0.1) * 8)
    const dir = c.object.position.clone().sub(c.target)
    const dist = dir.length()
    const meta = Math.min(c.maxDistance, Math.max(c.minDistance, p.dist))
    const nueva = dist + (meta - dist) * k
    c.object.position.copy(c.target).add(dir.setLength(nueva))
    if (p.target) c.target.lerp(p.target, k)
    c.update()
    if (Math.abs(nueva - meta) < 0.05 && (!p.target || c.target.distanceTo(p.target) < 0.05)) pedido.current = null
  })
  return null
}

// gestos sobre el lienzo durante el recorrido: con un dedo o el ratón abajo, la cámara es de la persona; al soltar se
// espera 2,5 s (si arrastró) antes de volver al personaje; la rueda solo acerca o aleja, así que basta medio segundo
function GestosLibres({ libre, recorrer }) {
  const { gl } = useThree()
  useEffect(() => {
    const L = libre.current
    L.dedos = 0; L.hasta = 0; L.tocado = false
    if (!recorrer) return
    const el = gl.domElement
    const ids = new Set()
    let x0 = 0, y0 = 0, movio = false
    const abajo = (e) => { ids.add(e.pointerId); L.dedos = ids.size; L.tocado = true; movio = false; x0 = e.clientX; y0 = e.clientY }
    const mueve = (e) => { if (ids.size && Math.hypot(e.clientX - x0, e.clientY - y0) > 6) movio = true }
    const arriba = (e) => {
      if (!ids.delete(e.pointerId)) return
      L.dedos = ids.size
      if (!ids.size) L.hasta = performance.now() + (movio ? 2500 : 300)
    }
    const rueda = () => { L.tocado = true; L.hasta = Math.max(L.hasta, performance.now() + 600) }
    el.addEventListener('pointerdown', abajo, true)
    window.addEventListener('pointermove', mueve, true)
    window.addEventListener('pointerup', arriba, true)
    window.addEventListener('pointercancel', arriba, true)
    el.addEventListener('wheel', rueda, { capture: true, passive: true })
    return () => {
      el.removeEventListener('pointerdown', abajo, true)
      window.removeEventListener('pointermove', mueve, true)
      window.removeEventListener('pointerup', arriba, true)
      window.removeEventListener('pointercancel', arriba, true)
      el.removeEventListener('wheel', rueda, true)
    }
  }, [gl, recorrer, libre])
  return null
}

// plano cercano de la cámara según lo lejos que mire: de cerca (recorrido) 0,1 m para que no corte las paredes junto
// al personaje (se veían huecas); de lejos más grande, para que el piso, las veredas y el pasto no parpadeen
function PlanoCercano({ controles }) {
  useFrame(({ camera }) => {
    const c = controles.current
    if (!c) return
    const dist = camera.position.distanceTo(c.target)
    const near = Math.min(4, Math.max(0.1, dist * 0.012))
    if (Math.abs(camera.near - near) / camera.near > 0.15) { camera.near = near; camera.updateProjectionMatrix() }
  })
  return null
}

// la cámara sigue al piso que se mira: al cambiar de piso (o al armar el edificio) se traslada en altura, suave
function SeguirAltura({ controles, altura }) {
  const actual = useRef(altura)
  useFrame((_, dt) => {
    const c = controles.current
    if (!c) return
    const k = 1 - Math.exp(-Math.min(dt, 0.1) * 3.2)
    const dy = (altura - actual.current) * k
    if (Math.abs(altura - actual.current) < 0.005) return
    actual.current += dy
    c.target.y += dy
    c.object.position.y += dy
    c.update()
  })
  return null
}

// modo ligero: el lienzo se dibuja a pedido y este reloj lo pide a 30 cuadros por segundo (la mitad del trabajo de la
// tarjeta gráfica del tótem; los movimientos se ven igual de suaves para seguir la ruta)
function Cuadros({ fps = 30 }) {
  const { invalidate } = useThree()
  useEffect(() => {
    const id = setInterval(() => { if (!document.hidden) invalidate() }, 1000 / fps)
    return () => clearInterval(id)
  }, [invalidate, fps])
  return null
}

// para revisar la escena desde la consola o pruebas automáticas: window.__escena3d.scene / .gl
function Depurar() {
  const { gl, scene } = useThree()
  useEffect(() => { window.__escena3d = { gl, scene } }, [gl, scene])
  return null
}

const ORDEN = (a, b) => a.nivel - b.nivel
export const Vista3D = forwardRef(function Vista3D({ d, pisos = {}, ruta, destino, foco, recorrer = false, pausa = false, onFinRecorrer, onAvance, desde, onPiso }, fwd) {
  const [corte, setCorte] = useState(1.2)   // muros bajos por defecto: se ven los pisos, como en una planta de arquitectura
  const [letreros, setLetreros] = useState(true)
  const [opciones, setOpciones] = useState(false)   // altura de muros y letreros: plegados para no recargar la pantalla
  const [panel, setPanel] = useState(false)   // celular: el panel Vista va cerrado y se abre con su botón (ver pb.css)
  // la ayuda de gestos se ve unos segundos al abrir el 3D y se va
  const [ayuda, setAyuda] = useState(true)
  useEffect(() => { const t = setTimeout(() => setAyuda(false), 7000); return () => clearTimeout(t) }, [])
  // edificio completo (con sus techos) o un piso a la vista (los de arriba suben y se apartan)
  const [armado, setArmado] = useState(!ruta && !foco)
  const pisoId = d.piso?.id || 'PB'
  const lista = useMemo(() => (d.edificio?.pisos || [{ ...(d.piso || {}), id: pisoId, nivel: 0, glb: d.piso?.glb || 'pb/solca_pb.glb', disponible: true }])
    .filter((p) => p.disponible).sort(ORDEN), [d, pisoId])
  const nivel = lista.find((p) => p.id === pisoId)?.nivel ?? 0
  // el subsuelo, cuando se mira, sube al nivel del suelo: se ve con el mapa y sus alrededores (no enterrado)
  const base = Math.max(0, nivel) * H_PISO
  // al elegir un piso (en el selector o en el buscador) o al trazar una ruta, se mira ese piso
  const pisoAntes = useRef(pisoId)
  useEffect(() => { if (pisoAntes.current !== pisoId) { pisoAntes.current = pisoId; setArmado(false) } }, [pisoId])
  useEffect(() => { if (ruta || foco) setArmado(false) }, [ruta, foco])
  useEffect(() => { if (recorrer) setArmado(false) }, [recorrer])
  // al caminar, el panel Vista se cierra para no tapar el mapa
  useEffect(() => { if (recorrer) setPanel(false) }, [recorrer])
  const [techos, setTechos] = useState({})
  const [mapa, setMapa] = useState(null)
  useEffect(() => {
    let vivo = true
    fetch(`${BASE}techos.json?v=${__VERSION__}`).then((r) => (r.ok ? r.json() : {})).then((t) => vivo && setTechos(t)).catch(() => {})
    return () => { vivo = false }
  }, [])
  const controles = useRef()
  const pedidoZoom = useRef(null)
  // cámara libre durante el recorrido: dedos/ratón sobre el lienzo y hasta cuándo no seguir al personaje
  const libre = useRef({ dedos: 0, hasta: 0, tocado: false })
  const distActual = () => { const c = controles.current; return c ? c.object.position.distanceTo(c.target) : 150 }
  // el suelo y el exterior son siempre los de la planta baja
  const pb = pisos.PB || d
  const hu = pb.huella.flatMap((pg) => pg[0])
  const cx = (Math.min(...hu.map((p) => p[0])) + Math.max(...hu.map((p) => p[0]))) / 2
  const cy = (Math.min(...hu.map((p) => p[1])) + Math.max(...hu.map((p) => p[1]))) / 2
  const altura = armado ? 6 : base
  useImperativeHandle(fwd, () => ({
    // el dock eligió un piso: se deja el edificio completo y se ve ese piso (aunque ya fuera el piso a la vista)
    verPiso: () => setArmado(false),
    acercar: () => { pedidoZoom.current = { dist: (pedidoZoom.current?.dist ?? distActual()) / 2.2 } },
    alejar: () => { pedidoZoom.current = { dist: (pedidoZoom.current?.dist ?? distActual()) * 2.2 } },
    centrar: () => {
      const c = controles.current
      if (!c) return
      // con una ruta a la vista: centra al personaje (de cerca, sin cambiar el giro) y vuelve a seguirlo
      if (ruta && persona.current && !armado) {
        libre.current.hasta = 0
        const [px, py] = persona.current
        const t = new THREE.Vector3(px, base + 1.3, -py)
        // caminando, el seguimiento lo trae; quieto o en pausa, lo trae el zoom suave
        pedidoZoom.current = { dist: Math.min(14, Math.max(6, distActual())), target: recorrer && !pausa ? undefined : t }
        return
      }
      // sin ruta: vuelve a la vista isométrica inicial del edificio
      c.object.position.set(cx + 95, altura + 110, -cy + 95)
      pedidoZoom.current = { dist: Math.hypot(95, 110, 95), target: new THREE.Vector3(cx, altura, -cy) }
    },
    // «paso a paso»: la cámara va a un punto del plano del piso a la vista (sin cambiar el giro), ni muy cerca ni muy lejos
    listo: () => !!controles.current,
    irA: (x, y) => {
      if (!controles.current) return
      pedidoZoom.current = { dist: Math.min(18, Math.max(8, distActual())), target: new THREE.Vector3(x, base + 1.3, -y) }
    },
  }))
  const andado = useRef(null)
  const persona = useRef(null)
  // plano de corte del piso a la vista (puertas y muros agregados); los modelos tienen el suyo (ver Piso3D)
  const plano = useMemo(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), 9999), [])
  useEffect(() => { plano.constant = corte >= 3.8 ? 9999 : base + corte }, [corte, plano, base])
  useEffect(() => { if (!ruta) persona.current = null }, [ruta])
  // para revisar la maqueta desde la consola o pruebas automáticas: window.__vista3d.controles
  useEffect(() => { window.__vista3d = { controles, setCorte, setArmado, setMapa, centro: [cx, cy] } }, [])
  const estadoDe = (p) => {
    if (armado) return p.nivel < 0 ? 'oculto' : 'abajo'
    if (p.id === pisoId) return 'activo'
    if (p.nivel > nivel) return 'arriba'
    // bajo tierra: el subsuelo solo se ve cuando es el piso a la vista
    return p.nivel < 0 ? 'oculto' : 'abajo'
  }
  return (
    <div className="pb-3d">
      <Canvas shadows={!LIGERO} flat dpr={LIGERO ? 1 : [1, 2]} frameloop={LIGERO ? 'demand' : 'always'} camera={{ position: [cx + 95, altura + 110, -cy + 95], fov: 32, near: 0.5, far: 2400 }}
        gl={{ antialias: !LIGERO, powerPreference: LIGERO ? 'low-power' : 'high-performance' }}>
        {LIGERO && <Cuadros fps={30} />}
        <Depurar />
        {/* luz pareja y fría, sol suave: con la paleta clara, más luz quemaría los pisos a blanco (el lienzo no lleva
            curva de tonos) */}
        <color attach="background" args={['#EEF0F3']} />
        <fog attach="fog" args={['#EEF0F3', 380, 900]} />
        <hemisphereLight args={['#FFFFFF', '#E3E6EA', 2.0]} />
        <directionalLight position={[cx + 70, 140, -cy + 30]} intensity={1.2} castShadow={!LIGERO} shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-110} shadow-camera-right={110} shadow-camera-top={110} shadow-camera-bottom={-110} shadow-camera-near={10} shadow-camera-far={450}
          shadow-bias={-0.0004} shadow-normalBias={0.06} target-position={[cx, 0, -cy]} />
        {lista.map((p) => (
          <Piso3D key={p.id} p={p} techo={techos[p.id]} estado={estadoDe(p)} corte={corte} letreros={letreros}
            y0={!armado && p.id === pisoId ? base : p.nivel * H_PISO} />
        ))}
        <SueloMapa centro={[cx, cy]} onListo={setMapa} />
        <Exterior d={pb} mapa={mapa} losa={!armado && nivel < 0 ? d.huella : null} />
        {/* lo del piso a la vista: pisos de color, puertas, letreros, ruta y personaje, a su altura */}
        {!armado && (
          <group position-y={base}>
            <PisosColor d={d} destino={destino} />
            <MurosExtra muros={d.murosExtra || []} plano={plano} />
            <Puertas puertas={d.puertas} plano={plano} persona={persona} ruta={ruta} recorrer={recorrer} corte={corte} />
            <Letreros d={d} visibles={letreros} />
            {ruta && <Ruta ruta={ruta} andado={andado} persona={persona} />}
            {ruta && <Caminante ruta={ruta} recorrer={recorrer} pausa={pausa} controles={controles} libre={libre} andado={andado} alTerminar={onFinRecorrer} onAvance={onAvance} desde={desde} persona={persona} base={base} />}
          </group>
        )}
        {foco && !armado && <MarcaFoco foco={foco} controles={controles} base={base} />}
        <SeguirAltura controles={controles} altura={altura} />
        <ZoomSuave controles={controles} pedido={pedidoZoom} />
        <GestosLibres libre={libre} recorrer={recorrer} />
        <PlanoCercano controles={controles} />
        <OrbitControls ref={controles} touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }} target={[cx, altura, -cy]} maxPolarAngle={recorrer ? Math.PI / 1.9 : Math.PI / 2.08} minDistance={recorrer ? 1.5 : 4} maxDistance={recorrer ? 160 : 460} enablePan enableDamping zoomSpeed={1.8} />
      </Canvas>
      {/* en celular, botón redondo que abre o cierra el panel (oculto en escritorio y en el tótem, ver pb.css) */}
      <button type="button" className="pb-3d-abrir" aria-expanded={panel} aria-controls="pb-3d-ctrl" aria-label="Opciones de la vista" onClick={() => setPanel((v) => !v)}>Vista</button>
      <div id="pb-3d-ctrl" className={`pb-3d-ctrl${panel ? ' abierto' : ''}`} role="group" aria-label="Opciones de la vista 3D">
        <span className="pb-3d-t">Vista</span>
        {/* el piso se elige con el botón de piso del dock (App.jsx): aquí solo se alterna con el edificio completo */}
        <div className="pb-pisos3d" role="group" aria-label="Piso a la vista">
          <button aria-pressed={armado} onClick={() => { setArmado((v) => !v); setPanel(false) }}
            title={armado ? `Volver al ${lista.find((p) => p.id === pisoId)?.nombre || 'piso'}` : 'Todo el hospital, con sus techos'}>Edificio completo</button>
        </div>
        {!armado && (
          <button className="pb-3d-mas" aria-expanded={opciones} onClick={() => setOpciones((v) => !v)}>{opciones ? 'Menos opciones' : 'Más opciones'}</button>
        )}
        {!armado && opciones && (<>
          <span className="pb-3d-t">Altura de muros</span>
          <div className="pb-seg">
            {[[1.2, 'Bajos'], [2.6, 'Medios'], [3.9, 'Completos']].map(([v, t]) => (
              <button key={v} aria-pressed={corte === v} onClick={() => { setCorte(v); setPanel(false) }}>{t}</button>
            ))}
          </div>
          <label className="pb-check"><input type="checkbox" checked={letreros} onChange={(e) => { setLetreros(e.target.checked); setPanel(false) }} /> Letreros</label>
        </>)}
      </div>
      {ayuda && <p className="pb-ayuda3d">{TACTIL
        ? 'Un dedo para girar · pellizca para acercar · dos dedos para mover · o usa + y −'
        : 'Arrastra para girar · rueda o pellizco para acercar · clic derecho para mover'}</p>}
    </div>
  )
})

useGLTF.preload?.(`${BASE}pb/solca_pb.glb?v=${__VERSION__}`)

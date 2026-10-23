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

const E = ([x, y], h = 0) => new THREE.Vector3(x, h, -y)    // plano (x, y) -> escena

function SueloMapa({ centro }) {
  const [tex, setTex] = useState(null)
  const LADO = 560, PX = 2048
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
      // estilo de maqueta isométrica: césped de fondo, calles de asfalto oscuro, aceras claras, sin rótulos
      map.on('style.load', () => {
        for (const l of map.getStyle().layers) {
          try {
            if (l.type === 'symbol') map.setLayoutProperty(l.id, 'visibility', 'none')
            else if (l.type === 'background') map.setPaintProperty(l.id, 'background-color', '#A9D18E')
            else if (l.type === 'fill' && /water/.test(l.id)) map.setPaintProperty(l.id, 'fill-color', '#7EC8E3')
            else if (l.type === 'fill' && /building/.test(l.id)) map.setPaintProperty(l.id, 'fill-color', '#E8E1D3')
            else if (l.type === 'fill' && /park|grass|wood|garden|pitch|forest|scrub|meadow|cemetery/.test(l.id)) map.setPaintProperty(l.id, 'fill-color', '#93C47D')
            else if (l.type === 'fill') map.setPaintProperty(l.id, 'fill-color', '#B4D79C')
            else if (l.type === 'line' && /path|pedestrian|footway|steps|track/.test(l.id)) map.setPaintProperty(l.id, 'line-color', '#E9E3D6')
            else if (l.type === 'line' && /casing/.test(l.id)) map.setPaintProperty(l.id, 'line-color', '#E4DED2')
            else if (l.type === 'line' && /road|highway|street|bridge|tunnel|motorway|trunk|primary|secondary|tertiary|minor|service/.test(l.id)) map.setPaintProperty(l.id, 'line-color', '#5A626E')
            else if (l.type === 'line' && /boundary|admin/.test(l.id)) map.setLayoutProperty(l.id, 'visibility', 'none')
          } catch { /* capa sin esa propiedad */ }
        }
      })
    } catch { div.remove(); return }
    let hecho = false
    let intentos = 0
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
      console.info('[suelo 3D] intento', intentos, 'variación', desv.toFixed(1))
      if (desv < 4 && intentos++ < 8) { setTimeout(() => { map.triggerRepaint(); map.once('idle', copiar) }, 1200); return }
      hecho = true
      const cv = document.createElement('canvas')
      cv.width = cv.height = PX
      const ctx = cv.getContext('2d')
      ctx.drawImage(map.getCanvas(), 0, 0, PX, PX)
      const t = new THREE.CanvasTexture(cv)
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = 8
      setTex(t)
      map.remove(); div.remove()
    }
    map.once('idle', copiar)
    map.on('error', () => {})
    return () => { vivo = false; try { map.remove() } catch { /* listo */ } div.remove() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <mesh rotation-x={-Math.PI / 2} position={[centro[0], -0.22, -centro[1]]} receiveShadow>
      <planeGeometry args={[LADO, LADO]} />
      {tex ? <meshBasicMaterial key="mapa" map={tex} toneMapped={false} /> : <meshBasicMaterial key="liso" color="#A9D18E" toneMapped={false} />}
    </mesh>
  )
}

// el GLB trae los pisos agrupados por color (pisos|r,g,b|h): cada grupo toma la paleta de interiores de la categoría
// más parecida (la misma del mapa 2D): cuartos celestes, farmacia lila, baños turquesa, pasillos claros
// paleta de maqueta isométrica: colores planos y saturados por tipo de ambiente, pasillos en tono arena
const PALETA = { consulta: '#78AEEA', administracion: '#EE9A6B', apoyo: '#A7B2BE', otro: '#B9C2CC', farmacia: '#B08AE0', banos: '#4FC3C9', escaleras: '#C2C8D0', ascensores: '#C2C8D0', circulacion: '#E9D8BC', espera: '#F2C255' }
const ACENTOS = Object.entries(CATS).map(([k, c]) => ({ rgb: new THREE.Color(c.relleno), color: new THREE.Color(PALETA[k] || PALETA.otro) }))
function colorDePiso(nombre) {
  const [r, g, b] = (nombre.split('|')[1] || '0,0,0').split(',').map(Number)
  let mejor = null, dist = Infinity
  for (const a of ACENTOS) {
    const k = (a.rgb.r - r) ** 2 + (a.rgb.g - g) ** 2 + (a.rgb.b - b) ** 2
    if (k < dist) { dist = k; mejor = a }
  }
  return mejor ? mejor.color.clone() : null
}

// hojas de puerta y manijas del modelo: se ocultan porque la web dibuja sus propias puertas que se abren (ver Puertas)
const OCULTOS = ['muros|0.360,0.160,0.053', 'muros|0.562,0.026,0.014', 'muebles|0.672,0.672,0.706']
// tapa de los muros cortados: al recortar la altura, el interior hueco del muro se veía como un bloque gris
// descuadrado; las caras traseras se pintan del color de la tapa y el corte se ve macizo
const TAPA = new THREE.MeshBasicMaterial({ color: '#E6DED0', side: THREE.BackSide })

function Edificio({ corte, letreros, plano }) {
  const { scene } = useGLTF(`${BASE}pb/solca_pb.glb?v=${__VERSION__}`)
  const { gl } = useThree()
  useEffect(() => { gl.localClippingEnabled = true; TAPA.clippingPlanes = [plano] }, [gl, plano])
  useEffect(() => {
    scene.traverse((o) => {
      if (!o.isMesh) return
      o.castShadow = true
      o.receiveShadow = true
      const nombre = o.name || o.parent?.name || ''
      const g = nombre.split('|')[0]
      if (OCULTOS.some((k) => nombre.startsWith(k))) { o.visible = false; return }
      // los pisos de color los dibuja PisosColor (paleta de maqueta); del modelo solo queda la losa base
      if (g === 'pisos' && !nombre.startsWith('pisos|0.384')) { o.visible = false; return }
      if (g === 'letreros') o.visible = letreros
      if (g === 'viseras') o.visible = corte >= 3.8
      const m = o.material
      if (g === 'pisos' && !o.userData.coloreado) {
        const c = colorDePiso(o.name || o.parent?.name || '')
        if (c) { o.material = m.clone(); o.material.color.copy(c); o.material.roughness = 0.85 }
        o.userData.coloreado = true
      }
      // paleta de interiores: muros casi blancos con un toque celeste, mobiliario celeste suave
      // (solo las piezas grises: puertas, vidrios y madera conservan su color)
      if ((g === 'muros' || g === 'muebles') && !o.userData.tono && m?.color) {
        const hsl = m.color.getHSL({})
        // muros de maqueta: blanco cálido y mate; mobiliario gris en celeste suave
        if (nombre.startsWith('muros|0.902')) { o.material = m.clone(); o.material.color.set('#FBF7EF'); o.material.roughness = 1 }
        else if (hsl.s < 0.12) { o.material = m.clone(); o.material.color.set(g === 'muros' ? '#F3EFE6' : '#C6D8F0'); o.material.roughness = 0.9 }
        o.userData.tono = true
      }
      if (o.material && g !== 'pisos') { const m = o.material; m.clippingPlanes = [plano]; m.clipShadows = true; m.needsUpdate = true }
      if (g === 'muros' && !o.userData.tapa && o.material && !o.material.transparent) {
        o.material.side = THREE.FrontSide
        const tapa = new THREE.Mesh(o.geometry, TAPA)
        tapa.userData.tapa = true
        tapa.raycast = () => {}
        o.add(tapa)
        o.userData.tapa = true
      }
    })
  }, [scene, corte, letreros, plano])
  return <primitive object={scene} />
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

// ruta 3D: franja suave en el piso y una fila de puntos que avanza (como en el 2D); lo ya caminado queda gris
const PASO_PUNTOS = 1.0
function Ruta({ ruta, andado }) {
  const { L, en } = useMemo(() => medir(ruta.pts), [ruta])
  const n = Math.max(2, Math.floor(L / PASO_PUNTOS) + 2)
  const malla = useRef()
  const franja = useMemo(() => ruta.pts.map((p) => E(p, 0.07)), [ruta])
  const tmp = useMemo(() => new THREE.Object3D(), [])
  const colores = useMemo(() => ({ ir: new THREE.Color('#1E2A4A'), hecho: new THREE.Color('#B9C3D3'), luz: new THREE.Color('#4C6FFF') }), [])
  useFrame(({ clock }) => {
    const m = malla.current
    if (!m) return
    const t = clock.elapsedTime
    const fase = (t * 0.8) % PASO_PUNTOS
    const cabeza = (t * 7) % (L + 12)
    for (let k = 0; k < n; k++) {
      const s = fase + k * PASO_PUNTOS
      if (s > L) { tmp.scale.setScalar(0); tmp.updateMatrix(); m.setMatrixAt(k, tmp.matrix); continue }
      const q = en(s)
      tmp.position.set(q.x, 0.16, -q.y)
      tmp.scale.setScalar(1)
      tmp.updateMatrix()
      m.setMatrixAt(k, tmp.matrix)
      const a = andado.current
      m.setColorAt(k, a !== null ? (s < a ? colores.hecho : colores.ir) : s <= cabeza && s > cabeza - 5 ? colores.luz : colores.ir)
    }
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  })
  return (
    <group>
      <Line points={franja} color="#1E2A4A" lineWidth={14} transparent opacity={0.12} />
      <instancedMesh key={n} ref={malla} args={[null, null, n]} frustumCulled={false}>
        <sphereGeometry args={[0.15, 14, 10]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <Meta pos={ruta.pts[ruta.pts.length - 1]} />
    </group>
  )
}

// destino: un aro lila que pulsa en el piso y una columna de luz suave (no un pin)
function Meta({ pos }) {
  const aro = useRef()
  useFrame(({ clock }) => {
    if (!aro.current) return
    const k = 1 + 0.25 * ((clock.elapsedTime * 0.9) % 1)
    aro.current.scale.set(k, k, 1)
    aro.current.material.opacity = 0.9 - 0.7 * ((clock.elapsedTime * 0.9) % 1)
  })
  return (
    <group position={E(pos, 0)}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.1}><circleGeometry args={[0.9, 40]} /><meshBasicMaterial color="#7C83E6" transparent opacity={0.45} toneMapped={false} /></mesh>
      <mesh ref={aro} rotation-x={-Math.PI / 2} position-y={0.11}><ringGeometry args={[1.0, 1.25, 48]} /><meshBasicMaterial color="#7C83E6" transparent toneMapped={false} /></mesh>
      <mesh position-y={1.6}><cylinderGeometry args={[0.55, 0.85, 3.2, 32, 1, true]} /><meshBasicMaterial color="#7C83E6" transparent opacity={0.16} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} /></mesh>
    </group>
  )
}

// personaje: cuerpo articulado (cabeza, cabello, torso, brazos y piernas con zapatos) de 1,7 m
// que balancea brazos y piernas al caminar y respira cuando está quieto
const PIEL = '#E2B48E'
function Personaje({ caminando }) {
  const brazoI = useRef(), brazoD = useRef(), piernaI = useRef(), piernaD = useRef(), torso = useRef()
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const a = caminando.current ? Math.sin(t * 7.5) * 0.55 : 0
    if (piernaI.current) { piernaI.current.rotation.x = a; piernaD.current.rotation.x = -a }
    if (brazoI.current) { brazoI.current.rotation.x = -a * 0.8; brazoD.current.rotation.x = a * 0.8 }
    if (torso.current) torso.current.position.y = caminando.current ? 0.02 * Math.abs(Math.cos(t * 7.5)) : 0.008 * Math.sin(t * 2)
  })
  const mat = (c, r = 0.7) => <meshStandardMaterial color={c} roughness={r} />
  const pierna = (ref, x) => (
    <group ref={ref} position={[x, 0.86, 0]}>
      <mesh position-y={-0.4} castShadow><capsuleGeometry args={[0.075, 0.62, 6, 12]} />{mat('#24324F')}</mesh>
      <mesh position={[0, -0.82, 0.05]} castShadow><boxGeometry args={[0.13, 0.08, 0.27]} />{mat('#F4F6FA', 0.5)}</mesh>
    </group>
  )
  const brazo = (ref, x) => (
    <group ref={ref} position={[x, 1.42, 0]}>
      <mesh position-y={-0.22} castShadow><capsuleGeometry args={[0.055, 0.3, 6, 10]} />{mat('#4C6FFF')}</mesh>
      <mesh position-y={-0.5} castShadow><capsuleGeometry args={[0.045, 0.2, 6, 10]} />{mat(PIEL)}</mesh>
    </group>
  )
  return (
    <group>
      {pierna(piernaI, -0.1)}
      {pierna(piernaD, 0.1)}
      <group ref={torso}>
        <mesh position-y={1.17} castShadow><capsuleGeometry args={[0.17, 0.38, 8, 16]} />{mat('#4C6FFF')}</mesh>
        <mesh position-y={0.9} castShadow><cylinderGeometry args={[0.16, 0.17, 0.12, 16]} />{mat('#24324F')}</mesh>
        {brazo(brazoI, -0.235)}
        {brazo(brazoD, 0.235)}
        <mesh position-y={1.5} castShadow><cylinderGeometry args={[0.05, 0.055, 0.08, 12]} />{mat(PIEL)}</mesh>
        <mesh position-y={1.64} castShadow><sphereGeometry args={[0.12, 24, 18]} />{mat(PIEL, 0.6)}</mesh>
        <mesh position={[0, 1.69, -0.015]} scale={[1.05, 0.8, 1.08]} castShadow><sphereGeometry args={[0.12, 24, 18, 0, Math.PI * 2, 0, Math.PI / 1.7]} />{mat('#3A2A20', 0.8)}</mesh>
        <mesh position={[-0.042, 1.66, 0.108]}><sphereGeometry args={[0.014, 8, 8]} />{mat('#1E2A4A', 0.4)}</mesh>
        <mesh position={[0.042, 1.66, 0.108]}><sphereGeometry args={[0.014, 8, 8]} />{mat('#1E2A4A', 0.4)}</mesh>
      </group>
      {/* sombra de contacto y aro de "usted está aquí" */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.05}><ringGeometry args={[0.42, 0.52, 40]} /><meshBasicMaterial color="#4C6FFF" transparent opacity={0.8} toneMapped={false} /></mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.04}><circleGeometry args={[0.42, 32]} /><meshBasicMaterial color="#1E2A4A" transparent opacity={0.18} /></mesh>
    </group>
  )
}

// puertas animadas: cada hoja gira sobre su bisagra; se abre (90°, hacia el lado contrario a la persona) cuando el
// personaje se acerca a menos de 2,4 m y se cierra cuando se aleja
const MADERA = '#9C6B3E'
function Puertas({ puertas, plano, persona }) {
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
        const off = (p.c || 0) * (n[0] * nl[0] + n[1] * nl[1])
        out.push({ h, L: p.doble ? L - 0.005 : L - 0.1, ini: p.doble ? 0.005 : 0.05, th: Math.atan2(uy, ux), off, nl, ducto: p.ducto, mid })
      }
    }
    return out
  }, [puertas])
  const grupos = useRef([])
  const ang = useRef(new Float32Array(hojas.length))
  const mats = useMemo(() => ({
    madera: new THREE.MeshStandardMaterial({ color: MADERA, roughness: 0.7 }),
    roja: new THREE.MeshStandardMaterial({ color: '#C0392B', roughness: 0.7 }),
    manija: new THREE.MeshStandardMaterial({ color: '#D7DBE0', roughness: 0.3, metalness: 0.6 }),
  }), [])
  useEffect(() => { for (const m of Object.values(mats)) m.clippingPlanes = [plano] }, [mats, plano])
  useFrame((_, dt) => {
    const q = persona.current
    hojas.forEach((hj, k) => {
      const g = grupos.current[k]
      if (!g) return
      let meta = 0
      if (q && Math.hypot(q[0] - hj.mid[0], q[1] - hj.mid[1]) < 2.4) {
        // gira hacia el lado contrario de donde viene la persona
        const lado = (q[0] - hj.h[0]) * hj.nl[0] + (q[1] - hj.h[1]) * hj.nl[1]
        meta = lado > 0 ? -Math.PI / 2 : Math.PI / 2
        if (ang.current[k] !== 0 && Math.sign(ang.current[k]) !== Math.sign(meta)) meta = ang.current[k] > 0 ? Math.PI / 2 : -Math.PI / 2
      }
      ang.current[k] += (meta - ang.current[k]) * (1 - Math.exp(-Math.min(dt, 0.1) * 6))
      g.rotation.y = hj.th + ang.current[k]
    })
  })
  return (
    <group>
      {hojas.map((hj, k) => (
        <group key={k} ref={(el) => { grupos.current[k] = el }} position={E(hj.h, 0)} rotation-y={hj.th}>
          {/* local +x = a lo largo de la hoja; la normal del plano (nl) es -z local */}
          <mesh position={[hj.ini + hj.L / 2, 0.01 + 1.02, -hj.off]} material={hj.ducto ? mats.roja : mats.madera} castShadow>
            <boxGeometry args={[hj.L, 2.04, 0.04]} />
          </mesh>
          {!hj.ducto && (
            <mesh position={[hj.ini + hj.L - 0.12, 1.0, -hj.off]} material={mats.manija}>
              <boxGeometry args={[0.14, 0.04, 0.14]} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  )
}

// el personaje recorre la ruta a 1,3 m/s. La cámara lo acompaña como en un juego en tercera persona: se traslada con
// él, y con el ratón (o el dedo) se puede girar alrededor, subir o bajar la mirada y acercar, sin perderlo de foco
function Caminante({ ruta, recorrer, controles, andado, alTerminar, persona }) {
  const ref = useRef()
  const t = useRef(0)
  const caminando = useRef(false)
  const fin = useRef(false)
  const { L, en } = useMemo(() => medir(ruta.pts), [ruta])
  const prev = useRef(null)
  const llegada = useRef(0)   // segundos desde que empezó el recorrido (la cámara se acomoda detrás en el primero)
  useEffect(() => { t.current = 0; fin.current = false; andado.current = recorrer ? 0 : null; prev.current = null; llegada.current = 0 }, [ruta, recorrer, andado])
  useFrame((_, dt) => {
    if (!ref.current) return
    if (recorrer && !fin.current) t.current += Math.min(dt, 0.1) * 1.3
    const s = Math.min(t.current, L)
    const q = en(s)
    caminando.current = recorrer && !fin.current && s < L
    if (recorrer) andado.current = s
    ref.current.position.set(q.x, 0.02, -q.y)
    persona.current = [q.x, q.y]
    // el frente del personaje (+z local) mira hacia donde avanza
    ref.current.rotation.y = Math.atan2(q.dx, -q.dy)
    if (recorrer && controles.current) {
      const c = controles.current
      const obj = new THREE.Vector3(q.x, 1.3, -q.y)
      const kd = Math.min(dt, 0.1)
      llegada.current += kd
      if (llegada.current < 1.4) {
        // al empezar: la cámara se coloca detrás del personaje
        c.target.lerp(obj, 1 - Math.exp(-kd * 6))
        const atras = new THREE.Vector3(-q.dx, 0, q.dy).normalize()
        c.object.position.lerp(obj.clone().add(atras.multiplyScalar(6)).add(new THREE.Vector3(0, 3.2, 0)), 1 - Math.exp(-kd * 4))
      } else {
        // después: cámara y foco se trasladan con el personaje; el giro lo decide quien mira
        const delta = prev.current ? obj.clone().sub(prev.current) : new THREE.Vector3()
        c.target.add(delta)
        c.object.position.add(delta)
        c.target.lerp(obj, 1 - Math.exp(-kd * 4))
      }
      prev.current = obj
      c.update()
    }
    if (recorrer && s >= L && !fin.current) { fin.current = true; alTerminar?.() }
  })
  return <group ref={ref}><Personaje caminando={caminando} /></group>
}

// la cámara llega al lugar elegido en el buscador y deja un anillo que pulsa unos segundos
function MarcaFoco({ foco, controles }) {
  const grupo = useRef()
  const t0 = useRef(-1)
  const meta = useMemo(() => new THREE.Vector3(foco.x, 0.4, -foco.y), [foco])
  useEffect(() => { t0.current = performance.now() }, [foco])
  useFrame(() => {
    if (!grupo.current || t0.current < 0) return
    const s = (performance.now() - t0.current) / 1000
    grupo.current.visible = s < 3.6
    if (!grupo.current.visible) return
    const k = 1 + 0.18 * Math.sin(s * 5)
    grupo.current.scale.set(k, 1, k)
    const c = controles.current
    if (c && s < 2.2) {
      c.target.lerp(meta, 0.07)
      c.object.position.lerp(meta.clone().add(new THREE.Vector3(0, 30, 24)), 0.035)
      c.update()
    }
  })
  return (
    <group ref={grupo} position={[meta.x, 0.08, meta.z]}>
      <mesh rotation-x={-Math.PI / 2}><ringGeometry args={[1.6, 2.1, 48]} /><meshBasicMaterial color="#2F5BEA" transparent opacity={0.85} /></mesh>
      <mesh rotation-x={-Math.PI / 2}><circleGeometry args={[1.1, 40]} /><meshBasicMaterial color="#2F5BEA" transparent opacity={0.22} /></mesh>
    </group>
  )
}

// pisos de cada ambiente con la paleta de interiores (la misma del 2D) sobre la losa del modelo; el destino en lila
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
  return (
    <group position-y={0.04}>
      {piezas.map((p) => (
        <mesh key={p.id} geometry={p.g} position-y={p.y} receiveShadow>
          <meshStandardMaterial color={destino && destino.id === p.id ? '#7C83E6' : p.color} roughness={0.9} polygonOffset polygonOffsetFactor={-2} />
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

export const Vista3D = forwardRef(function Vista3D({ d, ruta, destino, foco, recorrer = false, setRecorrer = () => {}, onFinRecorrer }, fwd) {
  const [corte, setCorte] = useState(1.2)   // muros bajos por defecto: se ven los pisos, como en una maqueta isométrica
  const [letreros, setLetreros] = useState(true)
  const controles = useRef()
  const pedidoZoom = useRef(null)
  const distActual = () => { const c = controles.current; return c ? c.object.position.distanceTo(c.target) : 150 }
  useImperativeHandle(fwd, () => ({
    acercar: () => { pedidoZoom.current = { dist: (pedidoZoom.current?.dist ?? distActual()) / 1.6 } },
    alejar: () => { pedidoZoom.current = { dist: (pedidoZoom.current?.dist ?? distActual()) * 1.6 } },
    centrar: () => {
      const c = controles.current
      if (!c) return
      // vuelve a la vista isométrica inicial del edificio
      c.object.position.set(cx + 95, 110, -cy + 95)
      pedidoZoom.current = { dist: Math.hypot(95, 110, 95), target: new THREE.Vector3(cx, 0, -cy) }
    },
  }))
  const hu = d.huella.flatMap((pg) => pg[0])
  const cx = (Math.min(...hu.map((p) => p[0])) + Math.max(...hu.map((p) => p[0]))) / 2
  const cy = (Math.min(...hu.map((p) => p[1])) + Math.max(...hu.map((p) => p[1]))) / 2
  const andado = useRef(null)
  const persona = useRef(null)
  const plano = useMemo(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), 99), [])
  useEffect(() => { plano.constant = corte >= 3.8 ? 99 : corte }, [corte, plano])
  useEffect(() => { if (!ruta) persona.current = null }, [ruta])
  return (
    <div className="pb-3d">
      <Canvas shadows flat dpr={[1, 2]} camera={{ position: [cx + 95, 110, -cy + 95], fov: 32, near: 0.5, far: 3000 }} gl={{ antialias: true }}>
        <color attach="background" args={['#F2EAD8']} />
        <fog attach="fog" args={['#F2EAD8', 300, 700]} />
        <hemisphereLight args={['#FFFFFF', '#D8CDB8', 1.25]} />
        <directionalLight position={[cx + 70, 120, -cy + 30]} intensity={2.1} castShadow shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-90} shadow-camera-right={90} shadow-camera-top={90} shadow-camera-bottom={-90} shadow-camera-near={10} shadow-camera-far={400}
          shadow-bias={-0.0004} shadow-normalBias={0.06} target-position={[cx, 0, -cy]} />
        <Suspense fallback={<Html center><div className="pb-cargando">Cargando el modelo 3D…</div></Html>}>
          <Edificio corte={corte} letreros={letreros} plano={plano} />
        </Suspense>
        <SueloMapa centro={[cx, cy]} />
        <PisosColor d={d} destino={destino} />
        <Puertas puertas={d.puertas} plano={plano} persona={persona} />
        <Exterior d={d} />
        <Letreros d={d} visibles={letreros} />
        {ruta && <Ruta ruta={ruta} andado={andado} />}
        {foco && <MarcaFoco foco={foco} controles={controles} />}
        {ruta && <Caminante ruta={ruta} recorrer={recorrer} controles={controles} andado={andado} alTerminar={onFinRecorrer} persona={persona} />}
        <ZoomSuave controles={controles} pedido={pedidoZoom} />
        <OrbitControls ref={controles} touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }} target={[cx, 0, -cy]} maxPolarAngle={recorrer ? Math.PI / 1.9 : Math.PI / 2.08} minDistance={recorrer ? 1.5 : 4} maxDistance={recorrer ? 30 : 420} enablePan={!recorrer} enableDamping />
      </Canvas>
      <div className="pb-3d-ctrl" role="group" aria-label="Opciones de la vista 3D">
        <span className="pb-3d-t">Altura de muros</span>
        <div className="pb-seg">
          {[[1.2, 'Bajos'], [2.6, 'Medios'], [3.9, 'Completos']].map(([v, t]) => (
            <button key={v} aria-pressed={corte === v} onClick={() => setCorte(v)}>{t}</button>
          ))}
        </div>
        <label className="pb-check"><input type="checkbox" checked={letreros} onChange={(e) => setLetreros(e.target.checked)} /> Letreros</label>
        {ruta && <button className="btn-negro pb-recorrer" onClick={() => setRecorrer(!recorrer)}>{recorrer ? 'Detener recorrido' : `Recorrer hasta ${destino?.nombre || 'el destino'}`}</button>}
      </div>
      <p className="pb-ayuda3d">{TACTIL
        ? 'Un dedo para girar · pellizca para acercar · dos dedos para mover · o usa + y −'
        : 'Arrastra para girar · rueda o pellizco para acercar · clic derecho para mover'}</p>
    </div>
  )
})

useGLTF.preload?.(`${BASE}pb/solca_pb.glb?v=${__VERSION__}`)

// Vista 3D: el modelo real de la planta baja (el mismo IFC que va a Revit, convertido a GLB) sobre el mapa de
// la zona, con la ruta dibujada en el piso y un recorrido que la sigue.
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import maplibregl from 'maplibre-gl'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, useGLTF, Line, Html } from '@react-three/drei'
import { BASE, aLonLat, rumbo, dePlano, CATS } from './datos.js'
import { Cargando } from './Cargando.jsx'

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
      // el estilo claro del mapa casi no se distingue en 3D: se triplica la distancia al blanco
      // (las calles siguen blancas; el fondo, las manzanas y los edificios se oscurecen)
      const img = ctx.getImageData(0, 0, PX, PX)
      const q = img.data
      for (let i = 0; i < q.length; i += 4) {
        q[i] = Math.max(0, 255 - (255 - q[i]) * 3.2) * 0.96
        q[i + 1] = Math.max(0, 255 - (255 - q[i + 1]) * 3.2) * 0.98
        q[i + 2] = Math.max(0, 255 - (255 - q[i + 2]) * 3.2) * 0.95
      }
      ctx.putImageData(img, 0, 0)
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
      {tex ? <meshBasicMaterial key="mapa" map={tex} toneMapped={false} /> : <meshBasicMaterial key="liso" color="#D3DAD0" toneMapped={false} />}
    </mesh>
  )
}

// el GLB trae los pisos agrupados por color (pisos|r,g,b|h): cada grupo toma la paleta de interiores de la categoría
// más parecida (la misma del mapa 2D): cuartos celestes, farmacia lila, baños turquesa, pasillos claros
const PALETA = { consulta: '#A9C8F0', administracion: '#B3CEF0', apoyo: '#C3D3E8', otro: '#C7D4E6', farmacia: '#BFAEEE', banos: '#9FD6E8', escaleras: '#CDD5E0', ascensores: '#CDD5E0', circulacion: '#F4F7FB', espera: '#D6ECDD' }
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

function Edificio({ corte, letreros }) {
  const { scene } = useGLTF(`${BASE}pb/solca_pb.glb?v=${__VERSION__}`)
  const { gl } = useThree()
  const plano = useMemo(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), 99), [])
  useEffect(() => { gl.localClippingEnabled = true }, [gl])
  useEffect(() => {
    scene.traverse((o) => {
      if (!o.isMesh) return
      o.castShadow = true
      o.receiveShadow = true
      const g = (o.name || o.parent?.name || '').split('|')[0]
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
        if (hsl.s < 0.12) { o.material = m.clone(); o.material.color.set(g === 'muros' ? '#EEF3FA' : '#C6D8F0'); o.material.roughness = 0.9 }
        o.userData.tono = true
      }
      if (o.material && g !== 'pisos') { const m = o.material; m.clippingPlanes = [plano]; m.clipShadows = true; m.needsUpdate = true }
    })
    plano.constant = corte >= 3.8 ? 99 : corte
  }, [scene, corte, letreros, plano])
  return <primitive object={scene} />
}

function Ruta({ ruta }) {
  const puntos = useMemo(() => ruta.pts.map((p) => E(p, 0.09)), [ruta])
  return (
    <group>
      <Line points={puntos} color="#1E2A4A" lineWidth={8} dashed dashSize={0.05} gapSize={1.1} />
      <mesh position={E(ruta.pts[0], 0.35)}><sphereGeometry args={[0.35, 24, 16]} /><meshStandardMaterial color="#4C6FFF" /></mesh>
      <group position={E(ruta.pts[ruta.pts.length - 1], 0)}>
        <mesh position-y={1.6}><coneGeometry args={[0.45, 1.2, 24]} /><meshStandardMaterial color="#7C83E6" /></mesh>
        <mesh position-y={2.35}><sphereGeometry args={[0.55, 24, 16]} /><meshStandardMaterial color="#7C83E6" /></mesh>
      </group>
    </group>
  )
}

// persona que recorre la ruta (1,3 m/s); la cámara la sigue si «recorrer» está activo
function Caminante({ ruta, recorrer, controles, alTerminar }) {
  const ref = useRef()
  const t = useRef(0)
  const segs = useMemo(() => {
    const out = []
    let acc = 0
    for (let i = 1; i < ruta.pts.length; i++) {
      const a = ruta.pts[i - 1], b = ruta.pts[i]
      const l = Math.hypot(b[0] - a[0], b[1] - a[1])
      out.push({ a, b, l, acc })
      acc += l
    }
    return { out, total: acc }
  }, [ruta])
  useEffect(() => { t.current = 0 }, [ruta, recorrer])
  useFrame((_, dt) => {
    if (!ref.current) return
    t.current += dt * (recorrer ? 1.3 : 0)
    const d = Math.min(t.current, segs.total)
    const s = segs.out.find((q) => d <= q.acc + q.l) || segs.out[segs.out.length - 1]
    const f = s.l ? (d - s.acc) / s.l : 0
    const x = s.a[0] + (s.b[0] - s.a[0]) * f, y = s.a[1] + (s.b[1] - s.a[1]) * f
    ref.current.position.set(x, 0, -y)
    ref.current.rotation.y = Math.atan2(s.b[0] - s.a[0], s.b[1] - s.a[1]) + Math.PI
    if (recorrer && controles.current) {
      const c = controles.current
      const obj = new THREE.Vector3(x, 1.2, -y)
      c.target.lerp(obj, 0.08)
      const dir = new THREE.Vector3(-(s.b[0] - s.a[0]), 0, (s.b[1] - s.a[1])).normalize()
      const cam = obj.clone().add(dir.multiplyScalar(9)).add(new THREE.Vector3(0, 7, 0))
      c.object.position.lerp(cam, 0.04)
      c.update()
    }
    if (recorrer && d >= segs.total) alTerminar?.()
  })
  return (
    <group ref={ref}>
      <mesh position-y={0.85} castShadow><capsuleGeometry args={[0.24, 0.9, 6, 12]} /><meshStandardMaterial color="#2F5BEA" /></mesh>
      <mesh position-y={1.62} castShadow><sphereGeometry args={[0.2, 16, 12]} /><meshStandardMaterial color="#F2C9A0" /></mesh>
    </group>
  )
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

// puntos de luz que avanzan sobre la ruta (dan sensación de movimiento sin tapar el recorrido)
function Flujo({ ruta }) {
  const grupo = useRef()
  const { out, total } = useMemo(() => {
    const o = []
    let acc = 0
    for (let i = 1; i < ruta.pts.length; i++) {
      const a = ruta.pts[i - 1], b = ruta.pts[i]
      const l = Math.hypot(b[0] - a[0], b[1] - a[1])
      o.push({ a, b, l, acc })
      acc += l
    }
    return { out: o, total: acc }
  }, [ruta])
  useFrame(({ clock }) => {
    if (!grupo.current || total <= 0) return
    grupo.current.children.forEach((hijo, k) => {
      const s = ((clock.elapsedTime * 2.2 + (k * total) / grupo.current.children.length) % total)
      const seg = out.find((q) => s <= q.acc + q.l) || out[out.length - 1]
      const f = seg.l ? (s - seg.acc) / seg.l : 0
      hijo.position.set(seg.a[0] + (seg.b[0] - seg.a[0]) * f, 0.22, -(seg.a[1] + (seg.b[1] - seg.a[1]) * f))
    })
  })
  return (
    <group ref={grupo}>
      {Array.from({ length: 9 }, (_, k) => <mesh key={k}><sphereGeometry args={[0.18, 12, 10]} /><meshBasicMaterial color="#FFFFFF" toneMapped={false} /></mesh>)}
    </group>
  )
}

// parqueaderos del exterior: losas de asfalto sobre el piso del mapa
// pisos de cada ambiente con la paleta de interiores (la misma del 2D) sobre la losa del modelo; el destino en lila
function PisosColor({ d, destino }) {
  const piezas = useMemo(() => d.ambientes.filter((a) => a.pg.length && a.pg[0].length > 2).map((a) => {
    const [ext, ...huecos] = a.pg
    const forma = new THREE.Shape(ext.map(([x, y]) => new THREE.Vector2(x, y)))
    for (const h of huecos) forma.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))))
    const g = new THREE.ShapeGeometry(forma)
    g.rotateX(-Math.PI / 2)
    const plano = !!(a.cat === 'circulacion' || a.cat === 'espera' || (!a.nombre && a.area >= 30))
    return { id: a.id, g, color: plano ? PALETA[a.cat] || PALETA.circulacion : PALETA[a.cat] || PALETA.otro }
  }), [d])
  return (
    <group position-y={0.04}>
      {piezas.map((p) => (
        <mesh key={p.id} geometry={p.g} receiveShadow>
          <meshStandardMaterial color={destino && destino.id === p.id ? '#7C83E6' : p.color} roughness={0.9} polygonOffset polygonOffsetFactor={-2} />
        </mesh>
      ))}
    </group>
  )
}

function Parqueos({ parqueos }) {
  const geos = useMemo(() => parqueos.map((p) => {
    const pts = p.ll.map(([lo, la]) => dePlano(lo, la))
    const forma = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)))
    const g = new THREE.ExtrudeGeometry(forma, { depth: 0.08, bevelEnabled: false })
    g.rotateX(-Math.PI / 2)
    return g
  }), [parqueos])
  return (
    <group>
      {geos.map((g, k) => (
        <mesh key={k} geometry={g} position-y={-0.02} receiveShadow>
          <meshStandardMaterial color="#C4CCD6" roughness={0.95} />
        </mesh>
      ))}
    </group>
  )
}

export function Vista3D({ d, ruta, destino, foco }) {
  const [corte, setCorte] = useState(2.6)
  const [letreros, setLetreros] = useState(true)
  const [recorrer, setRecorrer] = useState(false)
  const controles = useRef()
  const hu = d.huella.flatMap((pg) => pg[0])
  const cx = (Math.min(...hu.map((p) => p[0])) + Math.max(...hu.map((p) => p[0]))) / 2
  const cy = (Math.min(...hu.map((p) => p[1])) + Math.max(...hu.map((p) => p[1]))) / 2
  useEffect(() => setRecorrer(false), [ruta])
  return (
    <div className="pb-3d">
      <Canvas shadows flat dpr={[1, 2]} camera={{ position: [cx - 55, 85, -cy + 95], fov: 40, near: 0.5, far: 3000 }} gl={{ antialias: true }}>
        <color attach="background" args={['#E4EBE3']} />
        <fog attach="fog" args={['#E4EBE3', 260, 620]} />
        <hemisphereLight args={['#FFFFFF', '#C9D3DE', 1.5]} />
        <directionalLight position={[cx - 60, 120, -cy + 40]} intensity={1.6} castShadow shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-90} shadow-camera-right={90} shadow-camera-top={90} shadow-camera-bottom={-90} shadow-camera-near={10} shadow-camera-far={400}
          target-position={[cx, 0, -cy]} />
        <Suspense fallback={<Html center><div className="pb-cargando">Cargando el modelo 3D…</div></Html>}>
          <Edificio corte={corte} letreros={letreros} />
        </Suspense>
        <SueloMapa centro={[cx, cy]} />
        <PisosColor d={d} destino={destino} />
        <Parqueos parqueos={d.parqueos} />
        {ruta && <Ruta ruta={ruta} />}
        {ruta && <Flujo ruta={ruta} />}
        {foco && <MarcaFoco foco={foco} controles={controles} />}
        {ruta && <Caminante ruta={ruta} recorrer={recorrer} controles={controles} alTerminar={() => {}} />}
        <OrbitControls ref={controles} target={[cx, 0, -cy]} maxPolarAngle={Math.PI / 2.08} minDistance={4} maxDistance={420} enableDamping />
      </Canvas>
      <div className="pb-3d-ctrl" role="group" aria-label="Opciones de la vista 3D">
        <span className="pb-3d-t">Altura de muros</span>
        <div className="pb-seg">
          {[[1.2, 'Bajos'], [2.6, 'Medios'], [3.9, 'Completos']].map(([v, t]) => (
            <button key={v} aria-pressed={corte === v} onClick={() => setCorte(v)}>{t}</button>
          ))}
        </div>
        <label className="pb-check"><input type="checkbox" checked={letreros} onChange={(e) => setLetreros(e.target.checked)} /> Letreros</label>
        {ruta && <button className="btn-negro pb-recorrer" onClick={() => setRecorrer((r) => !r)}>{recorrer ? 'Detener recorrido' : `Recorrer hasta ${destino?.nombre || 'el destino'}`}</button>}
      </div>
      <p className="pb-ayuda3d">Arrastra para girar · rueda o pellizco para acercar · clic derecho para mover</p>
    </div>
  )
}

useGLTF.preload?.(`${BASE}pb/solca_pb.glb?v=${__VERSION__}`)

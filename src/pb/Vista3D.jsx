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

// el personaje recorre la ruta a 1,3 m/s; la cámara lo sigue por detrás mientras «recorrer» está activo
function Caminante({ ruta, recorrer, controles, andado, alTerminar }) {
  const ref = useRef()
  const t = useRef(0)
  const caminando = useRef(false)
  const fin = useRef(false)
  const { L, en } = useMemo(() => medir(ruta.pts), [ruta])
  useEffect(() => { t.current = 0; fin.current = false; andado.current = recorrer ? 0 : null }, [ruta, recorrer, andado])
  useFrame((_, dt) => {
    if (!ref.current) return
    if (recorrer && !fin.current) t.current += Math.min(dt, 0.1) * 1.3
    const s = Math.min(t.current, L)
    const q = en(s)
    caminando.current = recorrer && !fin.current && s < L
    if (recorrer) andado.current = s
    ref.current.position.set(q.x, 0.02, -q.y)
    // el frente del personaje (+z local) mira hacia donde avanza
    ref.current.rotation.y = Math.atan2(q.dx, -q.dy)
    if (recorrer && controles.current) {
      const c = controles.current
      const obj = new THREE.Vector3(q.x, 1.1, -q.y)
      // suavizado según el tiempo del cuadro: en equipos lentos la cámara llega igual de rápido
      const kd = Math.min(dt, 0.1)
      c.target.lerp(obj, 1 - Math.exp(-kd * 6))
      const atras = new THREE.Vector3(-q.dx, 0, q.dy).normalize()
      c.object.position.lerp(obj.clone().add(atras.multiplyScalar(6.5)).add(new THREE.Vector3(0, 4.5, 0)), 1 - Math.exp(-kd * 2.5))
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

export function Vista3D({ d, ruta, destino, foco, recorrer = false, setRecorrer = () => {}, onFinRecorrer }) {
  const [corte, setCorte] = useState(2.6)
  const [letreros, setLetreros] = useState(true)
  const controles = useRef()
  const hu = d.huella.flatMap((pg) => pg[0])
  const cx = (Math.min(...hu.map((p) => p[0])) + Math.max(...hu.map((p) => p[0]))) / 2
  const cy = (Math.min(...hu.map((p) => p[1])) + Math.max(...hu.map((p) => p[1]))) / 2
  const andado = useRef(null)
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
        {ruta && <Ruta ruta={ruta} andado={andado} />}
        {foco && <MarcaFoco foco={foco} controles={controles} />}
        {ruta && <Caminante ruta={ruta} recorrer={recorrer} controles={controles} andado={andado} alTerminar={onFinRecorrer} />}
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
        {ruta && <button className="btn-negro pb-recorrer" onClick={() => setRecorrer(!recorrer)}>{recorrer ? 'Detener recorrido' : `Recorrer hasta ${destino?.nombre || 'el destino'}`}</button>}
      </div>
      <p className="pb-ayuda3d">Arrastra para girar · rueda o pellizco para acercar · clic derecho para mover</p>
    </div>
  )
}

useGLTF.preload?.(`${BASE}pb/solca_pb.glb?v=${__VERSION__}`)

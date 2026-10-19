import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import { H, nodeById, aEscena, cuartoEn, tipoArista, H_PISO, NP } from '../lib/datos.js'
import { ORIGEN_INICIAL } from '../lib/lugares.js'
import { planificar, instrucciones, cercanos } from '../lib/navegacion.js'
import { useStore } from '../store.js'
import { vivo } from '../lib/vivo.js'
import { COLOR } from './materiales.js'

const VEL = 1.35       // m/s caminando
const VEL_ESC = 0.7    // m/s en la escalera
const VEL_ASC = 1.6    // m/s del ascensor
const d3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.h || 0) - (b.h || 0))
const tipoTramo = (A, B) => (A.id && B.id ? tipoArista(A.id, B.id) : 'caminar')

// Personaje original: se mueve solo por el grafo y por tramos rectos ya verificados como libres
export function Personaje() {
  const grupo = useRef(), cuerpo = useRef(), pI = useRef(), pD = useRef(), bI = useRef(), bD = useRef()
  const st = useRef(null)
  if (!st.current) {
    const id = nodeById[ORIGEN_INICIAL?.nodo] ? ORIGEN_INICIAL.nodo : H.inicio
    const n = nodeById[id]
    st.current = { pos: { x: n.x, y: n.y, h: n.h, piso: n.piso }, anclas: [id], plan: null, seg: 0, avance: 0, yaw: Math.PI, fase: 0, zona: null }
  }
  const orden = useStore((s) => s.orden)
  const [linea, setLinea] = useState(null)
  const [marca, setMarca] = useState(null)

  useEffect(() => {
    if (!orden) return
    const s = st.current
    const { setRuta, setAviso } = useStore.getState()
    const obj = orden.objetivo
    const desde = { pos: { ...s.pos }, anclas: s.anclas }
    const opciones = { accesible: useStore.getState().accesible }
    let plan = null
    if (obj.tipo === 'cercano') {
      for (const id of cercanos(s.pos, obj.ids)) {
        const p = planificar(desde, { tipo: 'nodo', id }, opciones)
        if (p && (!plan || p.costo < plan.costo)) plan = p
      }
    } else plan = planificar(desde, obj, opciones)
    if (!plan) { setAviso('No se puede caminar hasta ahí.'); return }
    const pts = plan.puntos.filter((p, i) => i === 0 || d3(p, plan.puntos[i - 1]) > 0.01)
    if (pts.length < 2) { setAviso(null); return }
    s.plan = { ...plan, puntos: pts }
    s.seg = 0
    s.avance = 0
    setRuta({ costo: plan.metros, pasos: instrucciones(plan, s.pos), destino: plan.destino })
    setLinea(pts.map((p) => aEscena(p.x, p.y, (p.h || 0) + 0.07)))
    const f = pts[pts.length - 1]
    setMarca(aEscena(f.x, f.y, (f.h || 0) + 0.02))
  }, [orden])

  useFrame(({ clock }, dtr) => {
    const dt = Math.min(dtr, 0.1)
    const s = st.current
    let moviendo = false
    let dir = null
    if (s.plan) {
      const pts = s.plan.puntos
      let A = pts[s.seg], B = pts[s.seg + 1]
      let L = d3(A, B)
      const velDe = (A, B) => ({ escalera: VEL_ESC, ascensor: VEL_ASC }[tipoTramo(A, B)] || VEL)
      s.avance += velDe(A, B) * dt
      while (s.avance >= L) {
        s.avance -= L
        s.seg++
        if (s.seg >= pts.length - 1) break
        A = pts[s.seg]; B = pts[s.seg + 1]; L = d3(A, B)
      }
      if (s.seg >= pts.length - 1) {
        const f = pts[pts.length - 1]
        s.pos = { x: f.x, y: f.y, h: f.h || 0, piso: f.piso }
        s.anclas = s.plan.anclasFinal
        s.plan = null
        setLinea(null)
        setMarca(null)
      } else {
        const t = L > 1e-6 ? s.avance / L : 1
        const x = A.x + (B.x - A.x) * t
        const y = A.y + (B.y - A.y) * t
        const tt = tipoTramo(A, B)
        const h = (A.h || 0) + ((B.h || 0) - (A.h || 0)) * t + (tt === 'escalera' && Math.abs((B.h || 0) - (A.h || 0)) > 0.1 ? 0.09 : 0)
        s.pos = { x, y, h, piso: Math.max(0, Math.min(NP - 1, Math.round((h - 0.2) / H_PISO))) }
        s.anclas = [A.id, B.id].filter(Boolean)
        if (!s.anclas.length) s.anclas = s.plan.anclasFinal
        moviendo = true
        if (tt !== 'ascensor') dir = [B.x - A.x, B.y - A.y]
      }
    }
    // orientación suave hacia la dirección de avance (el modelo mira hacia +Z local)
    if (dir && Math.hypot(dir[0], dir[1]) > 1e-4) {
      const meta = Math.atan2(dir[0], -dir[1])
      let d = meta - s.yaw
      while (d > Math.PI) d -= 2 * Math.PI
      while (d < -Math.PI) d += 2 * Math.PI
      s.yaw += d * Math.min(1, dt * 12)
    }
    s.fase += moviendo ? dt * 9 : 0
    const amp = moviendo ? 0.55 : 0
    const sw = Math.sin(s.fase) * amp
    const [X, Y, Z] = aEscena(s.pos.x, s.pos.y, s.pos.h)
    grupo.current.position.set(X, Y, Z)
    grupo.current.rotation.y = s.yaw
    pI.current.rotation.x += (sw - pI.current.rotation.x) * 0.3
    pD.current.rotation.x += (-sw - pD.current.rotation.x) * 0.3
    bI.current.rotation.x += (-sw * 0.8 - bI.current.rotation.x) * 0.3
    bD.current.rotation.x += (sw * 0.8 - bD.current.rotation.x) * 0.3
    cuerpo.current.position.y = moviendo ? Math.abs(Math.cos(s.fase)) * 0.035 : Math.sin(clock.elapsedTime * 2) * 0.008
    Object.assign(vivo.personaje, s.pos, { moviendo })

    const z = cuartoEn(s.pos.piso, s.pos.x, s.pos.y)?.id || null
    if (z && z !== s.zona) {
      s.zona = z
      useStore.getState().setZona(z)
    }
    // la vista sigue al personaje cuando cambia de piso (salvo en la vista de techo)
    const pisoVista = Math.max(0, Math.min(NP - 1, Math.floor((s.pos.h + 0.5) / H_PISO)))
    if (pisoVista !== s.pisoVista) {
      s.pisoVista = pisoVista
      const { nivel, setNivel } = useStore.getState()
      if (nivel !== NP && nivel !== pisoVista) setNivel(pisoVista)
    }
  })

  return (
    <>
      <group ref={grupo}>
        <mesh rotation-x={-Math.PI / 2} position-y={0.012}>
          <ringGeometry args={[0.24, 0.3, 32]} />
          <meshBasicMaterial color="#2FB4A0" transparent opacity={0.85} />
        </mesh>
        <group ref={cuerpo}>
          {/* piernas */}
          <group ref={pI} position={[0.09, 0.82, 0]}><mesh position-y={-0.4} castShadow><boxGeometry args={[0.13, 0.8, 0.15]} /><meshStandardMaterial color="#24324A" /></mesh>
            <mesh position={[0, -0.8, 0.04]} castShadow><boxGeometry args={[0.14, 0.07, 0.24]} /><meshStandardMaterial color="#F2F4F7" /></mesh></group>
          <group ref={pD} position={[-0.09, 0.82, 0]}><mesh position-y={-0.4} castShadow><boxGeometry args={[0.13, 0.8, 0.15]} /><meshStandardMaterial color="#24324A" /></mesh>
            <mesh position={[0, -0.8, 0.04]} castShadow><boxGeometry args={[0.14, 0.07, 0.24]} /><meshStandardMaterial color="#F2F4F7" /></mesh></group>
          {/* torso y brazos */}
          <mesh position-y={1.17} castShadow><capsuleGeometry args={[0.17, 0.36, 4, 12]} /><meshStandardMaterial color={COLOR.ruta} /></mesh>
          <group ref={bI} position={[0.23, 1.38, 0]}><mesh position-y={-0.27} castShadow><capsuleGeometry args={[0.05, 0.42, 4, 8]} /><meshStandardMaterial color={COLOR.ruta} /></mesh>
            <mesh position-y={-0.55}><sphereGeometry args={[0.055, 8, 6]} /><meshStandardMaterial color="#D9A37E" /></mesh></group>
          <group ref={bD} position={[-0.23, 1.38, 0]}><mesh position-y={-0.27} castShadow><capsuleGeometry args={[0.05, 0.42, 4, 8]} /><meshStandardMaterial color={COLOR.ruta} /></mesh>
            <mesh position-y={-0.55}><sphereGeometry args={[0.055, 8, 6]} /><meshStandardMaterial color="#D9A37E" /></mesh></group>
          {/* cabeza */}
          <mesh position-y={1.62} castShadow><sphereGeometry args={[0.14, 16, 12]} /><meshStandardMaterial color="#D9A37E" /></mesh>
          <mesh position={[0, 1.68, -0.02]}><sphereGeometry args={[0.145, 16, 12, 0, Math.PI * 2, 0, 1.4]} /><meshStandardMaterial color="#3B2A20" /></mesh>
          <mesh position={[0.05, 1.64, 0.125]}><sphereGeometry args={[0.018, 6, 5]} /><meshStandardMaterial color="#1B1B1B" /></mesh>
          <mesh position={[-0.05, 1.64, 0.125]}><sphereGeometry args={[0.018, 6, 5]} /><meshStandardMaterial color="#1B1B1B" /></mesh>
        </group>
      </group>
      {linea && <Line points={linea} color={COLOR.ruta} lineWidth={3} dashed dashSize={0.18} gapSize={0.1} />}
      {marca && <Marca pos={marca} />}
    </>
  )
}

function Marca({ pos }) {
  const ref = useRef()
  useFrame(({ clock }) => { const s = 1 + Math.sin(clock.elapsedTime * 5) * 0.12; ref.current.scale.set(s, s, s) })
  return (
    <group position={pos}>
      <mesh ref={ref} rotation-x={-Math.PI / 2}><ringGeometry args={[0.16, 0.26, 32]} /><meshBasicMaterial color={COLOR.ruta} transparent opacity={0.9} /></mesh>
    </group>
  )
}

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { aEscena } from '../lib/datos.js'
import { vivo } from '../lib/vivo.js'
import { focoCalido, farosAuto, mat } from './materiales.js'

// Coordenadas del plano: la calle corre de oeste a este al sur de la casa (y negativa)
const Y_ACERA = [-8, -4.5]
const Y_CALLE = [-14, -8]

const rect = (x0, y0, x1, y1, h0, h1, color, props = {}) => {
  const [X, , Z] = aEscena((x0 + x1) / 2, (y0 + y1) / 2)
  return (
    <mesh position={[X, (h0 + h1) / 2, Z]} scale={[x1 - x0, h1 - h0, y1 - y0]} material={mat(color)} receiveShadow castShadow={props.sombra !== false}>
      <boxGeometry />
    </mesh>
  )
}

export function Exterior() {
  return (
    <group>
      {/* terreno, lote, plaza, acera y calle */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.13} receiveShadow>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color="#86BA6C" />
      </mesh>
      {rect(-14, -4.5, 84, 46, -0.13, -0.11, '#97C97C', { sombra: false })}
      {rect(-80, Y_ACERA[0], 140, Y_ACERA[1], -0.13, -0.04, '#D6D8DA', { sombra: false })}
      {rect(-80, Y_CALLE[0], 140, Y_CALLE[1], -0.13, -0.1, '#4A5058', { sombra: false })}
      {rect(-80, Y_CALLE[1] - 0.15, 140, Y_CALLE[1], -0.13, -0.02, '#BFC3C7', { sombra: false })}
      {rect(-80, -20, 140, Y_CALLE[0], -0.13, -0.04, '#D6D8DA', { sombra: false })}
      {Array.from({ length: 55 }, (_, i) => <group key={i}>{rect(-78 + i * 4, -11.07, -76.2 + i * 4, -10.93, -0.1, -0.09, '#F2F2F2', { sombra: false })}</group>)}
      {/* estacionamiento este */}
      {rect(62, 0, 82, 30, -0.13, -0.08, '#7C838C', { sombra: false })}
      {Array.from({ length: 10 }, (_, i) => <group key={'e' + i}>{rect(62.2, 2 + i * 2.7, 67.2, 2.08 + i * 2.7, -0.08, -0.07, '#F2F2F2', { sombra: false })}{rect(76.8, 2 + i * 2.7, 81.8, 2.08 + i * 2.7, -0.08, -0.07, '#F2F2F2', { sombra: false })}</group>)}
      {rect(62, -4.5, 70, 0, -0.13, -0.08, '#7C838C', { sombra: false })}
      {ESTACIONADOS.map((a, i) => <AutoQuieto key={i} {...a} />)}
      <Ambulancia />
      <Seto />
      {ARBOLES.map((a, i) => <Arbol key={i} {...a} fase={i * 1.7} />)}
      {[-20, 0, 20, 40, 60, 80].map((x) => <Farol key={x} x={x} />)}
      <Autos />
      <Peatones />
      <Nubes />
      <Vecinas />
      <Bancas />
    </group>
  )
}

const ESTACIONADOS = [
  { x: 64.7, y: 3.35, c: '#2F6FB0' }, { x: 64.7, y: 8.75, c: '#F2F4F7' }, { x: 64.7, y: 14.15, c: '#3C4654' }, { x: 79.3, y: 6.05, c: '#E2533D', r: Math.PI },
  { x: 79.3, y: 16.85, c: '#F2C14E', r: Math.PI }, { x: 64.7, y: 22.25, c: '#5AA469' }, { x: 79.3, y: 25, c: '#9C5BB8', r: Math.PI },
]
function AutoQuieto({ x, y, c, r = 0 }) {
  return (
    <group position={aEscena(x, y, -0.08)} rotation-y={r}>
      <mesh position-y={0.55} castShadow><boxGeometry args={[3.9, 0.55, 1.75]} /><meshStandardMaterial color={c} metalness={0.3} roughness={0.4} /></mesh>
      <mesh position={[-0.25, 1.05, 0]} castShadow><boxGeometry args={[2.0, 0.5, 1.55]} /><meshStandardMaterial color="#26313D" metalness={0.5} roughness={0.2} /></mesh>
    </group>
  )
}
function Ambulancia() {
  const luz = useRef()
  useFrame(({ clock }) => { luz.current.material.emissiveIntensity = (Math.sin(clock.elapsedTime * 8) > 0 ? 2.5 : 0.2) })
  return (
    <group position={aEscena(3.2, -2.6, -0.04)} rotation-y={0}>
      <mesh position-y={1.2} castShadow><boxGeometry args={[5.2, 2.0, 2.1]} /><meshStandardMaterial color="#FFFFFF" /></mesh>
      <mesh position={[2.9, 0.9, 0]} castShadow><boxGeometry args={[1.2, 1.4, 2.0]} /><meshStandardMaterial color="#FFFFFF" /></mesh>
      <mesh position={[3.1, 1.25, 0]}><boxGeometry args={[0.85, 0.5, 2.02]} /><meshStandardMaterial color="#26313D" /></mesh>
      <mesh position={[0, 1.2, 1.06]}><boxGeometry args={[5.0, 0.25, 0.02]} /><meshStandardMaterial color="#E2533D" /></mesh>
      <mesh position={[0, 1.2, -1.06]}><boxGeometry args={[5.0, 0.25, 0.02]} /><meshStandardMaterial color="#E2533D" /></mesh>
      <mesh ref={luz} position={[2.2, 2.3, 0]}><boxGeometry args={[0.8, 0.15, 1.2]} /><meshStandardMaterial color="#E2533D" emissive="#E2533D" emissiveIntensity={1} /></mesh>
      {[[1.8, 0.95], [-1.8, 0.95], [1.8, -0.95], [-1.8, -0.95]].map(([a, b], i) => (
        <mesh key={i} position={[a, 0.38, b]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.38, 0.38, 0.25, 14]} /><meshStandardMaterial color="#1C2128" /></mesh>
      ))}
    </group>
  )
}
function Bancas() {
  return [14, 20, 40, 46].map((x) => <group key={x}>{rect(x, -4.2, x + 1.8, -3.8, 0.4, 0.48, '#C79A6B')}{rect(x + 0.1, -4.15, x + 0.2, -3.85, -0.1, 0.4, '#5A4632')}{rect(x + 1.6, -4.15, x + 1.7, -3.85, -0.1, 0.4, '#5A4632')}</group>)
}

const ARBOLES = [
  { x: -6, y: 3, s: 1.4 }, { x: -7, y: 12, s: 1.6 }, { x: -6, y: 22, s: 1.3 }, { x: -7, y: 32, s: 1.5 }, { x: -6, y: 41, s: 1.4 },
  { x: 6, y: 40, s: 1.5 }, { x: 18, y: 41, s: 1.3 }, { x: 30, y: 40, s: 1.6 }, { x: 42, y: 41, s: 1.4 }, { x: 54, y: 40, s: 1.5 },
  { x: 66, y: 36, s: 1.4 }, { x: 78, y: 40, s: 1.3 }, { x: 72, y: -2.5, s: 1.0 },
  { x: -30, y: -6.3, s: 1.0 }, { x: -12, y: -6.3, s: 1.0 }, { x: 16, y: -6.3, s: 1.0 }, { x: 44, y: -6.3, s: 1.0 }, { x: 74, y: -6.3, s: 1.0 }, { x: 96, y: -6.3, s: 1.0 },
]

function Arbol({ x, y, s, fase }) {
  const copa = useRef()
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    copa.current.rotation.z = Math.sin(t * 1.3 + fase) * 0.035 * vivo.viento
    copa.current.rotation.x = Math.cos(t * 1.1 + fase) * 0.025 * vivo.viento
  })
  const verdes = ['#4E8F4A', '#5FA05A', '#6DB063']
  return (
    <group position={aEscena(x, y, -0.1)} scale={s}>
      <mesh position-y={0.8} castShadow><cylinderGeometry args={[0.1, 0.16, 1.6, 7]} /><meshStandardMaterial color="#7A5634" /></mesh>
      <group ref={copa} position-y={1.5}>
        {[[0, 0.6, 0, 0.95], [0.45, 0.3, 0.2, 0.7], [-0.4, 0.35, -0.2, 0.72], [0.05, 1.2, 0.05, 0.62]].map(([a, b, c, r], i) => (
          <mesh key={i} position={[a, b, c]} castShadow><icosahedronGeometry args={[r, 0]} /><meshStandardMaterial color={verdes[i % 3]} flatShading /></mesh>
        ))}
      </group>
    </group>
  )
}

function Seto() {
  const pts = []
  for (let x = 12.5; x < 60; x += 0.6) if (!(x > 22.5 && x < 37.5)) pts.push([x, -0.6])
  for (let x = -12; x < 60; x += 0.9) pts.push([x, 45.5])
  return pts.map(([x, y], i) => (
    <group key={i}>
      <mesh position={aEscena(x, y, 0.22)} castShadow><icosahedronGeometry args={[0.34, 0]} /><meshStandardMaterial color={i % 2 ? '#5C9A50' : '#4F8C46'} flatShading /></mesh>
      {i % 4 === 0 && <mesh position={aEscena(x + 0.15, y - 0.2, 0.45)}><sphereGeometry args={[0.07, 6, 5]} /><meshStandardMaterial color={['#F2C14E', '#E56B6F', '#F4F1EA'][(i / 4) % 3]} /></mesh>}
    </group>
  ))
}

function Cerca() {
  const tramos = [[[-3, -1.6], [-3, 11]], [[-3, 11], [11, 11]], [[11, 11], [11, -1.6]]]
  const out = []
  tramos.forEach(([a, b], k) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1])
    const n = Math.round(L / 1.0)
    for (let i = 0; i <= n; i++) {
      const x = a[0] + ((b[0] - a[0]) * i) / n, y = a[1] + ((b[1] - a[1]) * i) / n
      out.push(<group key={k + '-' + i}>{rect(x - 0.05, y - 0.05, x + 0.05, y + 0.05, -0.1, 1.0, '#FFFFFF')}</group>)
    }
    const vert = a[0] === b[0]
    for (const h of [0.45, 0.85]) {
      out.push(<group key={k + 'r' + h}>{vert ? rect(a[0] - 0.025, Math.min(a[1], b[1]), a[0] + 0.025, Math.max(a[1], b[1]), h, h + 0.07, '#FFFFFF')
        : rect(Math.min(a[0], b[0]), a[1] - 0.025, Math.max(a[0], b[0]), a[1] + 0.025, h, h + 0.07, '#FFFFFF')}</group>)
    }
  })
  return out
}

function Farol({ x }) {
  const luz = useRef()
  useFrame(() => { luz.current.intensity = vivo.noche * 60 })
  const y = Y_ACERA[0] + 0.3
  return (
    <group position={aEscena(x, y, 0)}>
      <mesh position-y={2.1} castShadow><cylinderGeometry args={[0.05, 0.07, 4.2, 8]} /><meshStandardMaterial color="#2B3440" /></mesh>
      <mesh position={[0, 4.15, -0.35]}><boxGeometry args={[0.08, 0.06, 0.8]} /><meshStandardMaterial color="#2B3440" /></mesh>
      <mesh position={[0, 4.05, -0.7]} material={focoCalido}><boxGeometry args={[0.3, 0.12, 0.3]} /></mesh>
      <pointLight ref={luz} position={[0, 3.9, -0.7]} color="#FFD49A" intensity={0} distance={20} decay={1.5} />
    </group>
  )
}

const COLORES_AUTO = ['#E2532D', '#2F6FB0', '#F2F4F7', '#3C4654', '#F2C14E', '#5AA469']
function Autos() {
  const autos = useMemo(() => [
    { carril: -9.5, v: 7.5, x0: -40, c: 0 }, { carril: -9.5, v: 6.2, x0: 25, c: 2 }, { carril: -9.5, v: 8.0, x0: 70, c: 5 },
    { carril: -12.5, v: -7.0, x0: 30, c: 1 }, { carril: -12.5, v: -5.6, x0: -10, c: 3 }, { carril: -12.5, v: -8.2, x0: 90, c: 4 },
  ], [])
  return autos.map((a, i) => <Auto key={i} {...a} color={COLORES_AUTO[a.c]} />)
}
function Auto({ carril, v, x0, color }) {
  const ref = useRef()
  const x = useRef(x0)
  const ruedas = useRef([])
  useFrame((_, dt) => {
    x.current += v * Math.min(dt, 0.05)
    if (x.current > 110) x.current = -80
    if (x.current < -80) x.current = 110
    const [X, , Z] = aEscena(x.current, carril)
    ref.current.position.set(X, -0.1, Z)
    ruedas.current.forEach((r) => r && (r.rotation.y -= (v * Math.min(dt, 0.05)) / 0.32))
  })
  return (
    <group ref={ref} rotation-y={v < 0 ? Math.PI : 0}>
      <mesh position-y={0.55} castShadow><boxGeometry args={[3.9, 0.55, 1.75]} /><meshStandardMaterial color={color} metalness={0.3} roughness={0.4} /></mesh>
      <mesh position={[-0.25, 1.05, 0]} castShadow><boxGeometry args={[2.0, 0.5, 1.55]} /><meshStandardMaterial color="#26313D" metalness={0.5} roughness={0.2} /></mesh>
      {[[1.25, 0.82], [-1.25, 0.82], [1.25, -0.82], [-1.25, -0.82]].map(([a, b], i) => (
        <mesh key={i} ref={(r) => (ruedas.current[i] = r)} position={[a, 0.32, b]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.32, 0.32, 0.22, 14]} /><meshStandardMaterial color="#1C2128" /></mesh>
      ))}
      <mesh position={[1.96, 0.62, 0.55]} material={farosAuto}><boxGeometry args={[0.04, 0.14, 0.32]} /></mesh>
      <mesh position={[1.96, 0.62, -0.55]} material={farosAuto}><boxGeometry args={[0.04, 0.14, 0.32]} /></mesh>
      <mesh position={[-1.96, 0.62, 0.6]}><boxGeometry args={[0.04, 0.12, 0.26]} /><meshStandardMaterial color="#C0262D" emissive="#C0262D" emissiveIntensity={0.4} /></mesh>
      <mesh position={[-1.96, 0.62, -0.6]}><boxGeometry args={[0.04, 0.12, 0.26]} /><meshStandardMaterial color="#C0262D" emissive="#C0262D" emissiveIntensity={0.4} /></mesh>
    </group>
  )
}

function Peatones() {
  return [
    { y: -5.6, v: 1.1, x0: -20, c: '#5B86B8' }, { y: -6.8, v: -0.9, x0: 15, c: '#E2A13B' }, { y: -6.2, v: 1.2, x0: 40, c: '#5AA469' }, { y: -16.5, v: 1.0, x0: 0, c: '#9C5BB8' },
  ].map((p, i) => <Peaton key={i} {...p} />)
}
function Peaton({ y, v, x0, c }) {
  const ref = useRef(), pI = useRef(), pD = useRef()
  const x = useRef(x0)
  useFrame(({ clock }, dt) => {
    x.current += v * Math.min(dt, 0.05)
    if (x.current > 100) x.current = -60
    if (x.current < -60) x.current = 100
    const [X, , Z] = aEscena(x.current, y)
    ref.current.position.set(X, -0.04, Z)
    const s = Math.sin(clock.elapsedTime * 7 * Math.abs(v)) * 0.5
    pI.current.rotation.z = s; pD.current.rotation.z = -s
  })
  return (
    <group ref={ref} rotation-y={v < 0 ? Math.PI : 0}>
      <group ref={pI} position={[0, 0.85, 0.09]}><mesh position-y={-0.42}><boxGeometry args={[0.13, 0.85, 0.13]} /><meshStandardMaterial color="#2B3440" /></mesh></group>
      <group ref={pD} position={[0, 0.85, -0.09]}><mesh position-y={-0.42}><boxGeometry args={[0.13, 0.85, 0.13]} /><meshStandardMaterial color="#2B3440" /></mesh></group>
      <mesh position-y={1.22} castShadow><capsuleGeometry args={[0.19, 0.4, 4, 10]} /><meshStandardMaterial color={c} /></mesh>
      <mesh position-y={1.68} castShadow><sphereGeometry args={[0.13, 12, 10]} /><meshStandardMaterial color="#C9946E" /></mesh>
    </group>
  )
}

function Nubes() {
  const nubes = useMemo(() => Array.from({ length: 12 }, (_, i) => ({ x: -110 + i * 20, z: -60 + ((i * 37) % 100), y: 42 + (i % 3) * 5, s: 2.2 + (i % 4) * 0.6, v: 0.8 + (i % 3) * 0.4 })), [])
  return nubes.map((n, i) => <Nube key={i} {...n} />)
}
function Nube({ x, y, z, s, v }) {
  const ref = useRef()
  const px = useRef(x)
  useFrame((_, dt) => {
    px.current += v * Math.min(dt, 0.05) * (0.5 + vivo.viento)
    if (px.current > 130) px.current = -130
    ref.current.position.x = px.current
  })
  return (
    <group ref={ref} position={[x, y, z]} scale={s}>
      {[[0, 0, 0, 2], [1.8, -0.3, 0.4, 1.5], [-1.7, -0.4, -0.2, 1.4], [0.6, 0.8, -0.3, 1.3]].map(([a, b, c, r], i) => (
        <mesh key={i} position={[a, b, c]}><icosahedronGeometry args={[r, 1]} /><meshStandardMaterial color="#FFFFFF" flatShading transparent opacity={0.92} /></mesh>
      ))}
    </group>
  )
}

function CasaVecina({ x, y, w, h, color, techo }) {
  return (
    <group>
      {rect(x, y, x + w, y + h, -0.1, 3.0, color)}
      <group position={aEscena(x + w / 2, y + h / 2, 3.0 + 0.8)} scale={[w + 0.5, 1, h + 0.5]}>
        <mesh rotation-y={Math.PI / 4} castShadow>
          <cylinderGeometry args={[0.001, Math.SQRT1_2, 1.6, 4, 1]} />
          <meshStandardMaterial color={techo} flatShading />
        </mesh>
      </group>
      {rect(x + w / 2 - 0.45, y - 0.02, x + w / 2 + 0.45, y + 0.02, 0, 2.1, '#3C4654')}
      {rect(x + 0.6, y - 0.02, x + 1.8, y + 0.02, 1.0, 2.1, '#9CC9EE')}
      {rect(x + w - 1.8, y - 0.02, x + w - 0.6, y + 0.02, 1.0, 2.1, '#9CC9EE')}
    </group>
  )
}
function Vecinas() {
  return (<>
    <CasaVecina x={-40} y={2} w={14} h={12} color="#F2E6D8" techo="#B5523B" />
    <CasaVecina x={-38} y={22} w={12} h={11} color="#DCE8F2" techo="#4A5F78" />
    <CasaVecina x={92} y={4} w={14} h={14} color="#E8F0E0" techo="#8C4A3A" />
    <CasaVecina x={-20} y={-34} w={16} h={11} color="#F5F0E6" techo="#5B6B7C" />
    <CasaVecina x={6} y={-34} w={18} h={11} color="#F0DCD5" techo="#3F5E4A" />
    <CasaVecina x={34} y={-34} w={16} h={11} color="#E3E9EE" techo="#7A4B3A" />
    <CasaVecina x={60} y={-34} w={16} h={11} color="#F2E6D8" techo="#4A5F78" />
  </>)
}


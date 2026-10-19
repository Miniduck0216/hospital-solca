import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { vivo } from '../lib/vivo.js'
import { useStore } from '../store.js'
import { vidrio, focoCalido, farosAuto } from './materiales.js'
import { H, aEscena, H_PISO } from '../lib/datos.js'

const C = (h) => new THREE.Color(h)
const NOCHE = C('#0E1A2E'), DIA = C('#A9D3F2'), OCASO = C('#F2A46B')
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }

// Ciclo de día y noche: sol que cruza el cielo, color del cielo, niebla y luces que se encienden de noche
export function Cielo() {
  const { scene } = useThree()
  const sol = useRef()
  const hemi = useRef()
  const interiores = useRef([])
  const fondo = useMemo(() => new THREE.Color(), [])
  const ultimo = useRef('')
  useMemo(() => { scene.background = fondo; scene.fog = new THREE.Fog(fondo, 320, 900) }, [scene, fondo])

  useFrame((_, dt) => {
    const { velocidad, setHoraTexto } = useStore.getState()
    vivo.hora = (vivo.hora + (Math.min(dt, 0.1) * velocidad) / 60) % 24
    const a = ((vivo.hora - 6) / 12) * Math.PI
    const elev = Math.sin(a)
    const dia = smooth(-0.12, 0.25, elev)
    const ocaso = Math.max(0, 1 - Math.abs(elev - 0.05) / 0.25) * (elev > -0.15 ? 1 : 0)
    vivo.noche = 1 - dia
    fondo.copy(NOCHE).lerp(DIA, dia).lerp(OCASO, ocaso * 0.55)
    scene.fog.color.copy(fondo)
    if (sol.current) {
      sol.current.position.set(Math.cos(a) * 150, Math.max(15, elev * 180), 80)
      sol.current.intensity = 0.15 + 2.3 * dia
      sol.current.color.setRGB(1, 0.85 + 0.15 * (1 - ocaso), 0.7 + 0.3 * (1 - ocaso))
    }
    if (hemi.current) hemi.current.intensity = 0.35 + 0.95 * dia
    vidrio.emissiveIntensity = vivo.noche * 0.9
    focoCalido.emissiveIntensity = vivo.noche * 2.5
    farosAuto.emissiveIntensity = vivo.noche * 2
    interiores.current.forEach((l) => l && (l.intensity = vivo.noche * 40))
    vivo.viento = 0.6 + 0.4 * Math.sin(performance.now() / 4000)
    const hh = Math.floor(vivo.hora)
    const mm = Math.floor((vivo.hora - hh) * 60)
    const txt = `${String(hh).padStart(2, '0')}:${String(mm - (mm % 5)).padStart(2, '0')}`
    if (txt !== ultimo.current) { ultimo.current = txt; setHoraTexto(txt) }
  })

  // luces cálidas interiores repartidas sobre la planta (se encienden de noche)
  const luces = [[0.2, 0.25], [0.5, 0.25], [0.8, 0.3], [0.2, 0.7], [0.5, 0.6], [0.8, 0.65], [0.45, 0.85], [0.6, 0.8]].map(([u, v], i) => [u * H.ancho, v * H.largo, (i % 3) * H_PISO + 2.8])
  return (
    <>
      <hemisphereLight ref={hemi} args={['#ffffff', '#7d8f6a', 1]} />
      <directionalLight ref={sol} castShadow position={[10, 20, 10]} intensity={2}
        shadow-mapSize={[4096, 4096]} shadow-bias={-0.0004} shadow-normalBias={0.02}
        shadow-camera-left={-125} shadow-camera-right={125} shadow-camera-top={110} shadow-camera-bottom={-110} shadow-camera-far={600} />
      {luces.map((p, i) => (
        <pointLight key={i} ref={(l) => (interiores.current[i] = l)} position={aEscena(...p)} color="#FFD8A0" intensity={0} distance={45} decay={1.4} />
      ))}
    </>
  )
}

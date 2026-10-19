import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { vivo } from '../lib/vivo.js'
import { useStore } from '../store.js'
import { vidrio, focoCalido, farosAuto } from './materiales.js'
import { aEscena } from '../lib/datos.js'

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
  useMemo(() => { scene.background = fondo; scene.fog = new THREE.Fog(fondo, 110, 260) }, [scene, fondo])

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
      sol.current.position.set(Math.cos(a) * 60, Math.max(6, elev * 70), 30)
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

  const luces = [[10, 8.5, 2.8], [30, 8.5, 2.8], [50, 8.5, 2.8], [10, 23.5, 2.8], [30, 23.5, 2.8], [50, 23.5, 2.8], [15, 8.5, 7.3], [45, 23.5, 7.3], [15, 23.5, 11.8], [45, 8.5, 11.8]]
  return (
    <>
      <hemisphereLight ref={hemi} args={['#ffffff', '#7d8f6a', 1]} />
      <directionalLight ref={sol} castShadow position={[10, 20, 10]} intensity={2}
        shadow-mapSize={[4096, 4096]} shadow-bias={-0.0004} shadow-normalBias={0.02}
        shadow-camera-left={-48} shadow-camera-right={48} shadow-camera-top={40} shadow-camera-bottom={-40} shadow-camera-far={220} />
      {luces.map((p, i) => (
        <pointLight key={i} ref={(l) => (interiores.current[i] = l)} position={aEscena(...p)} color="#FFD8A0" intensity={0} distance={22} decay={1.6} />
      ))}
    </>
  )
}

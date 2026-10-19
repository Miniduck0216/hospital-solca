import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../store.js'
import { vivo } from '../lib/vivo.js'
import { aEscena, H_PISO } from '../lib/datos.js'
import { actualizarRecorte } from './recorte.js'

// Cámara de "casa de muñecas": clic para caminar, arrastrar para girar, clic derecho para desplazar,
// rueda para acercar; WASD/flechas desplazan, Q/E giran, RePág/AvPág cambian de piso, C centra en el personaje.
export function Camara() {
  const ctrl = useRef()
  const { camera } = useThree()
  const teclas = useRef(new Set())

  useEffect(() => {
    const ignorar = (e) => ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)
    const down = (e) => {
      if (ignorar(e)) return
      const k = e.key.toLowerCase()
      const { nivel, setNivel } = useStore.getState()
      if (e.key === 'PageUp') { setNivel(nivel + 1); e.preventDefault() }
      else if (e.key === 'PageDown') { setNivel(nivel - 1); e.preventDefault() }
      else if (k === 'c') vivo.enfocar = aEscena(vivo.personaje.x, vivo.personaje.y, vivo.personaje.h)
      else if (['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', '+', '-'].includes(k)) { teclas.current.add(k); e.preventDefault() }
    }
    const up = (e) => teclas.current.delete(e.key.toLowerCase())
    const blur = () => teclas.current.clear()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur) }
  }, [])

  useFrame((_, dtr) => {
    const c = ctrl.current
    if (!c) return
    const dt = Math.min(dtr, 0.05)
    const T = teclas.current
    const mover = (dx, dy, dz) => { c.target.x += dx; c.target.y += dy; c.target.z += dz; camera.position.x += dx; camera.position.y += dy; camera.position.z += dz }
    // altura del piso visible
    const { nivel } = useStore.getState()
    const yMeta = Math.min(nivel, 2) * H_PISO
    mover(0, (yMeta - c.target.y) * Math.min(1, dt * 5), 0)
    // desplazamiento con teclado relativo a la cámara
    const fx = c.target.x - camera.position.x, fz = c.target.z - camera.position.z
    const fl = Math.hypot(fx, fz) || 1
    const f = [fx / fl, fz / fl], r = [-f[1], f[0]]
    const dist = camera.position.distanceTo(c.target)
    const v = dt * Math.max(6, dist * 0.7)
    let mx = 0, mz = 0
    if (T.has('w') || T.has('arrowup')) { mx += f[0]; mz += f[1] }
    if (T.has('s') || T.has('arrowdown')) { mx -= f[0]; mz -= f[1] }
    if (T.has('d') || T.has('arrowright')) { mx += r[0]; mz += r[1] }
    if (T.has('a') || T.has('arrowleft')) { mx -= r[0]; mz -= r[1] }
    if (mx || mz) mover(mx * v, 0, mz * v)
    const giro = (T.has('q') ? 1 : 0) - (T.has('e') ? 1 : 0)
    if (giro) {
      const off = camera.position.clone().sub(c.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), giro * dt * 1.6)
      camera.position.copy(c.target).add(off)
    }
    const zoom = (T.has('-') ? 1 : 0) - (T.has('+') ? 1 : 0)
    if (zoom) {
      const off = camera.position.clone().sub(c.target)
      const l = THREE.MathUtils.clamp(off.length() * (1 + zoom * dt * 1.5), 6, 130)
      camera.position.copy(c.target).add(off.setLength(l))
    }
    // centrar en el personaje
    if (vivo.enfocar) {
      const [ex, , ez] = vivo.enfocar
      const k = Math.min(1, dt * 4)
      mover((ex - c.target.x) * k, 0, (ez - c.target.z) * k)
      if (Math.hypot(ex - c.target.x, ez - c.target.z) < 0.05) vivo.enfocar = null
    }
    // límites del terreno
    const cx = THREE.MathUtils.clamp(c.target.x, -50, 60), cz = THREE.MathUtils.clamp(c.target.z, -36, 34)
    if (cx !== c.target.x || cz !== c.target.z) mover(cx - c.target.x, 0, cz - c.target.z)
    actualizarRecorte(camera, c.target, dt)
  })

  return (
    <OrbitControls
      ref={ctrl}
      makeDefault
      enableDamping
      dampingFactor={0.12}
      minDistance={6}
      maxDistance={130}
      minPolarAngle={0.2}
      maxPolarAngle={1.35}
      screenSpacePanning={false}
      mouseButtons={{ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }}
    />
  )
}

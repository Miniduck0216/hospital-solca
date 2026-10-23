// Letreros del 3D: un tótem de señalización por cada ambiente con nombre del plano (placa del color de su categoría
// con el ícono y el nombre en blanco, sobre un poste), más los títulos de zona del plano (Zona 1, Zona 2) y las
// áreas de espera rotuladas dentro de los pasillos. Las placas siempre miran a la cámara y mantienen un tamaño legible;
// las de cuartos pequeños se ocultan al alejarse para que no se amontonen.
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { CATS } from './datos.js'

// textos del plano que no son un ambiente propio (coordenadas del plano, en metros)
const EXTRA = [
  { nombre: 'Zona 1', x: 59.1, y: 45.0, zona: true },
  { nombre: 'Zona 2', x: 38.5, y: 103.4, zona: true },
  { nombre: 'Espera Citología', x: 76.7, y: 100.6, cat: 'espera' },
  { nombre: 'Sala de Espera', x: 52.6, y: 82.7, cat: 'espera' },
]
const NAVY = '#1E2A4A'

// placa dibujada en un lienzo: esquinas redondeadas, franja de color, nombre en blanco
function placa(texto, color, zona) {
  const esc = 2
  const fs = (zona ? 40 : 26) * esc
  const cv = document.createElement('canvas')
  const ctx = cv.getContext('2d')
  const fuente = `800 ${fs}px "Nunito Sans", "Segoe UI", system-ui, sans-serif`
  ctx.font = fuente
  const tw = Math.ceil(ctx.measureText(texto).width)
  const padX = 18 * esc, padY = (zona ? 14 : 10) * esc, pico = 10 * esc
  cv.width = tw + padX * 2
  cv.height = fs + padY * 2 + pico
  const w = cv.width, h = cv.height - pico, r = 12 * esc
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(r, 0); ctx.lineTo(w - r, 0); ctx.quadraticCurveTo(w, 0, w, r); ctx.lineTo(w, h - r); ctx.quadraticCurveTo(w, h, w - r, h)
  ctx.lineTo(w / 2 + pico, h); ctx.lineTo(w / 2, h + pico); ctx.lineTo(w / 2 - pico, h)
  ctx.lineTo(r, h); ctx.quadraticCurveTo(0, h, 0, h - r); ctx.lineTo(0, r); ctx.quadraticCurveTo(0, 0, r, 0)
  ctx.closePath(); ctx.fill()
  ctx.lineWidth = 3 * esc; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.stroke()
  ctx.font = fuente; ctx.fillStyle = '#FFFFFF'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center'
  ctx.fillText(texto, w / 2, h / 2 + esc)
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return { t, asp: cv.width / cv.height }
}

const alto = (it) => (it.zona ? 6.5 : it.area >= 60 ? 4.2 : 3.2)

export function Letreros({ d, visibles = true }) {
  const items = useMemo(() => {
    const out = []
    for (const a of d.ambientes) {
      if (!a.nombre || !a.lbl) continue
      const color = (CATS[a.cat] || CATS.otro).acento
      out.push({ nombre: a.nombre, x: a.lbl[0], y: a.lbl[1], color, area: a.area, zona: false })
    }
    for (const e of EXTRA) out.push({ ...e, color: e.zona ? NAVY : (CATS[e.cat] || CATS.otro).acento, area: e.zona ? 999 : 80 })
    return out.map((it) => ({ ...it, ...placa(it.nombre, it.color, it.zona) }))
  }, [d])
  // tamaño de la placa en pantalla (fracción del alto de la vista)
  const esc = (it) => (it.zona ? 0.04 : it.area >= 60 ? 0.026 : 0.021)
  // prioridad: zonas, luego los ambientes más grandes; si dos placas se tapan en pantalla, se muestra la más importante
  const orden = useMemo(() => items.map((_, k) => k).sort((a, b) => (items[b].zona - items[a].zona) || items[b].area - items[a].area), [items])
  const grupo = useRef()
  const ult = useRef(0)
  const v = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera, size, clock }) => {
    const g = grupo.current
    if (!g || clock.elapsedTime - ult.current < 0.12) return
    ult.current = clock.elapsedTime
    const cajas = []
    for (const k of orden) {
      const hijo = g.children[k], it = items[k]
      if (!hijo) continue
      const dist = camera.position.distanceTo(hijo.position)
      const lim = it.zona ? 1e9 : it.area >= 60 ? 420 : it.area >= 20 ? 200 : 120
      let ver = visibles && dist < lim
      if (ver) {
        v.set(hijo.position.x, alto(it), hijo.position.z).project(camera)
        if (v.z > 1) ver = false
        else {
          const h = esc(it) * size.height * 1.15, w = h * it.asp
          const x = (v.x * 0.5 + 0.5) * size.width, y = (-v.y * 0.5 + 0.5) * size.height
          const c = [x - w / 2 - 3, y - h - 3, x + w / 2 + 3, y + 3]
          if (cajas.some((o) => c[0] < o[2] && c[2] > o[0] && c[1] < o[3] && c[3] > o[1])) ver = false
          else cajas.push(c)
        }
      }
      hijo.visible = ver
    }
  })
  return (
    <group ref={grupo}>
      {items.map((it, k) => (
        <group key={k} position={[it.x, 0, -it.y]}>
          {/* poste del tótem */}
          <mesh position-y={alto(it) / 2}>
            <cylinderGeometry args={[0.05, 0.05, alto(it), 6]} />
            <meshLambertMaterial color="#5B6577" />
          </mesh>
          <mesh position-y={0.04} rotation-x={-Math.PI / 2}>
            <circleGeometry args={[0.28, 16]} />
            <meshBasicMaterial color={it.color} transparent opacity={0.5} />
          </mesh>
          {/* placa: siempre de frente y de tamaño legible en pantalla */}
          <sprite position-y={alto(it)} center={[0.5, 0]} scale={[esc(it) * it.asp, esc(it), 1]} renderOrder={10}>
            <spriteMaterial map={it.t} sizeAttenuation={false} depthTest={false} transparent />
          </sprite>
        </group>
      ))}
    </group>
  )
}

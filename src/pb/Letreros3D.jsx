// Letreros del 3D: un tótem de señalización por cada ambiente con nombre del plano (placa del color de su categoría
// con el ícono y el nombre en blanco, sobre un poste), más los títulos de zona del plano (Zona 1, Zona 2) y las
// áreas de espera rotuladas dentro de los pasillos. Las placas siempre miran a la cámara y mantienen un tamaño legible;
// las de cuartos pequeños se ocultan al alejarse para que no se amontonen.
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { CATS } from './datos.js'
import { LIGERO } from './rendimiento.js'

// los textos del plano que no son un ambiente propio (Zona 1, Zona 2…) vienen de la configuración del piso
// (public/pb/config.json → letreros)
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
      // los mismos nombres que el mapa 2D y el Plano (Mapa.jsx → rotulos): todo ambiente con nombre desde 1,2 m²;
      // los del personal y los cuartos pequeños solo aparecen al acercarse (ver distancia más abajo)
      if (!a.nombre || !a.lbl || !(a.area >= 1.2 || a.nuevo)) continue
      // los baños privados (de una habitación o consultorio) no llevan letrero: no son un destino
      if (a.cat === 'banos' && a.enCuarto) continue
      const clave = ['banos', 'escaleras', 'ascensores', 'farmacia'].includes(a.cat)
      // pasillos y circulaciones genéricas: al final de la prioridad, para no tapar a los destinos
      const generico = a.cat === 'circulacion' && /^(pasillo|circulaci)/i.test(a.nombre)
      const color = (CATS[a.cat] || CATS.otro).acento
      out.push({ nombre: a.nombre, x: a.lbl[0], y: a.lbl[1], color, area: a.area, zona: false,
        personal: !!a.personal && !clave, generico, peso: generico ? -1 : clave ? Math.max(a.area, 20) : a.area })
    }
    for (const e of d.cfg?.letreros || []) out.push({ ...e, color: e.zona ? NAVY : (CATS[e.cat] || CATS.otro).acento, area: e.zona ? 999 : 80, peso: e.zona ? 999 : 80 })
    // la placa (lienzo y textura) se dibuja la primera vez que el letrero se muestra: con todos los nombres del piso,
    // crearlas de entrada pesaba en el tótem
    return out.map((it) => ({ ...it, t: null, asp: 1 }))
  }, [d])
  useEffect(() => () => { for (const it of items) it.t?.dispose() }, [items])
  // tamaño de la placa en pantalla (fracción del alto de la vista)
  const esc = (it) => (it.zona ? 0.03 : it.area >= 60 ? 0.019 : 0.016)
  // distancia de la cámara hasta la que se muestra cada letrero (como el zoom mínimo de los rótulos del 2D):
  // los grandes de lejos, los pequeños y los del personal solo de cerca
  const limite = (it) => (it.zona ? 1e9 : it.personal || it.generico ? 45 : it.area >= 60 ? 420 : it.area >= 15 ? 170 : it.area >= 4 ? 90 : 60)
  // como mucho estos letreros a la vez (los más importantes primero); solo cuentan los que caen en pantalla
  const TOPE = LIGERO ? 30 : 60
  // prioridad: zonas, luego los ambientes más grandes; si dos placas se tapan en pantalla, se muestra la más importante
  const orden = useMemo(() => items.map((_, k) => k).sort((a, b) => items[b].peso - items[a].peso), [items])
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
      let ver = visibles && dist < limite(it) && cajas.length < TOPE
      if (ver) {
        v.set(hijo.position.x, alto(it), hijo.position.z).project(camera)
        // fuera de la vista (detrás de la cámara o a los lados): no ocupa lugar en el tope
        if (v.z > 1 || v.x < -1.1 || v.x > 1.1 || v.y < -1.1 || v.y > 1.3) ver = false
        else {
          if (!it.t) {
            Object.assign(it, placa(it.nombre, it.color, it.zona))
            const sp = hijo.children[2]
            sp.material.map = it.t
            sp.material.needsUpdate = true
            sp.scale.set(esc(it) * it.asp, esc(it), 1)
          }
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
        <group key={k} position={[it.x, 0, -it.y]} visible={false}>
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
          <sprite position-y={alto(it)} center={[0.5, 0]} scale={[esc(it), esc(it), 1]} renderOrder={10}>
            <spriteMaterial sizeAttenuation={false} depthTest={false} transparent />
          </sprite>
        </group>
      ))}
    </group>
  )
}

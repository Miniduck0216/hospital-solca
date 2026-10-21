// Suelo del 3D con el mapa real de Quito (mismo estilo OpenStreetMap que el mapa 2D).
// Se dibuja una vez con MapLibre fuera de pantalla, girado para coincidir con los ejes del plano,
// y se copia como textura. Datos © OpenStreetMap contributors · OpenFreeMap.
import { useEffect, useState } from 'react'
import * as THREE from 'three'
import maplibregl from 'maplibre-gl'
import { H } from '../lib/datos.js'
import { aLonLat, ROT, ESC } from '../lib/geo.js'

const ESTILO = 'https://tiles.openfreemap.org/styles/positron'
const LADO = 760          // metros del plano que cubre el suelo
const PX = 2048           // resolución de la textura

export function SueloMapa() {
  const [tex, setTex] = useState(null)
  useEffect(() => {
    let vivo = true
    const div = document.createElement('div')
    Object.assign(div.style, { position: 'fixed', left: '-99999px', top: '0', width: PX + 'px', height: PX + 'px', pointerEvents: 'none' })
    document.body.appendChild(div)
    const centro = aLonLat(H.ancho / 2, H.largo / 2)
    const mpp = (LADO * ESC) / PX                                        // metros geográficos por píxel
    const zoom = Math.log2((78271.517 * Math.cos((centro[1] * Math.PI) / 180)) / mpp)
    let map
    try {
      map = new maplibregl.Map({
        container: div, style: ESTILO, center: centro, zoom, bearing: (-ROT * 180) / Math.PI,
        interactive: false, attributionControl: false, pixelRatio: 1, preserveDrawingBuffer: true, fadeDuration: 0,
      })
    } catch { div.remove(); return }
    map.once('idle', () => {
      if (!vivo) return
      const c = document.createElement('canvas')
      c.width = c.height = PX
      c.getContext('2d').drawImage(map.getCanvas(), 0, 0, PX, PX)
      const t = new THREE.CanvasTexture(c)
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = 8
      setTex(t)
      map.remove(); div.remove()
    })
    map.on('error', () => {})
    return () => { vivo = false; try { map.remove() } catch { /* ya eliminado */ } div.remove() }
  }, [])
  if (!tex) return null
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={-0.06} receiveShadow>
      <planeGeometry args={[LADO, LADO]} />
      <meshStandardMaterial map={tex} roughness={1} metalness={0} />
    </mesh>
  )
}

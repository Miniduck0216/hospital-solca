import * as THREE from 'three'
import { Html } from '@react-three/drei'
import { H, H_PISO, aEscena } from '../lib/datos.js'
import { useStore } from '../store.js'
import { vivo } from '../lib/vivo.js'
import { caja } from './materiales.js'

// El edificio visible es el modelo de SketchUp (ModeloSK). Aquí quedan las superficies invisibles
// para hacer clic y caminar, el acceso a las escaleras y los rótulos del piso visible.
const invisible = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })

export function Hospital() {
  const nivel = useStore((s) => s.nivel)
  const visibles = [0, 1, 2].filter((p) => p <= Math.min(nivel, 2))
  return <group>{visibles.map((p) => <Nivel key={p} piso={p} />)}</group>
}

function Nivel({ piso }) {
  const base = piso * H_PISO
  return (
    <group>
      <Losas piso={piso} base={base} />
      {H.escaleras.filter((e) => e.piso === piso && piso < 2).map((e, i) => <Escalera key={i} e={e} base={base} piso={piso} />)}
      <Etiquetas piso={piso} base={base} />
    </group>
  )
}

// ---------- losas de piso (se pueden tocar para caminar) ----------
function Losas({ piso, base }) {
  const destino = useStore((s) => s.ruta?.destino?.id)
  const ordenar = useStore((s) => s.ordenar)
  const cuartos = H.cuartos.filter((c) => c.piso === piso)
  const huecos = (c) => {
    // en pisos altos: la escalera solo tiene el rellano de llegada y el ascensor solo el hall (el resto es el ducto)
    if (piso > 0 && c.tipo === 'escalera') return [{ ...c, y1: c.y0 + 1.3 }]
    if (piso > 0 && c.tipo === 'ascensores') return [{ ...c, y1: c.y0 + 3.1 }]
    return [c]
  }
  return cuartos.flatMap((c) => huecos(c).map((r, k) => {
    const ext = c.tipo === 'exterior'
    const h1 = base + (ext ? -0.02 : 0)
    const h0 = piso === 0 ? h1 - 0.08 : base - 0.3
    const [X, , Z] = aEscena((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2)
    return (
      <mesh key={c.id + k} geometry={caja} material={invisible} position={[X, h1 + 0.01, Z]} scale={[r.x1 - r.x0, 0.02, r.y1 - r.y0]}
        onClick={(e) => {
          if (e.delta > 6) return
          e.stopPropagation()
          if (c.tipo === 'escalera') return
          ordenar({ tipo: 'punto', piso, x: e.point.x + H.ancho / 2, y: H.largo / 2 - e.point.z })
        }}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer' }}
        onPointerOut={() => (document.body.style.cursor = '')} />
    )
  }))
}

function Escalera({ e, base, piso }) {
  const ordenar = useStore((s) => s.ordenar)
  const usar = (ev) => {
    if (ev.delta > 6) return
    ev.stopPropagation()
    const x = Math.round(e.x0)
    const p = vivo.personaje.piso
    const id = p <= piso ? `${H.pisos[piso + 1].clave.toLowerCase()}-esc-${x}-llegada` : `${H.pisos[piso].clave.toLowerCase()}-esc-${x}-a0`
    ordenar({ tipo: 'nodo', id })
  }
  const [X, , Z] = aEscena((e.x0 + e.x1) / 2, (e.y0 + 1.3 + e.y1) / 2)
  return (
    <mesh geometry={caja} material={invisible} position={[X, base + 2.25, Z]} scale={[e.x1 - e.x0 - 0.2, 4.5, e.y1 - e.y0 - 1.4]} onClick={usar}
      onPointerOver={(ev) => { ev.stopPropagation(); document.body.style.cursor = 'pointer' }} onPointerOut={() => (document.body.style.cursor = '')} />
  )
}

// ---------- rótulos de departamentos del piso visible ----------
function Etiquetas({ piso, base }) {
  const nivel = useStore((s) => s.nivel)
  if (Math.min(nivel, 2) !== piso || nivel === 3) return null
  return H.destinos.filter((d) => d.piso === piso && !/Ascensores|Escalera|Baño/.test(d.nombre)).map((d, i) => (
    <Html key={i} position={aEscena(d.x, d.y, base + 0.1)} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
      <div className="lbl">{d.nombre}</div>
    </Html>
  ))
}

import { Line } from '@react-three/drei'
import { H, nodeById, aEscena } from '../lib/datos.js'
import { useStore } from '../store.js'
import { COLOR } from './materiales.js'

export function Grafo() {
  const ver = useStore((s) => s.verGrafo)
  const nivel = useStore((s) => s.nivel)
  if (!ver) return null
  const p = Math.min(nivel, 2)
  const visible = (n) => n.piso === p
  return (
    <group>
      {H.aristas.filter(([a, b]) => visible(nodeById[a]) || visible(nodeById[b])).map(([a, b, t]) => (
        <Line key={a + b} points={[aEscena(nodeById[a].x, nodeById[a].y, nodeById[a].h + 0.08), aEscena(nodeById[b].x, nodeById[b].y, nodeById[b].h + 0.08)]}
          color={t === 'caminar' ? COLOR.nodo : t === 'ascensor' ? '#E2533D' : '#E2A13B'} lineWidth={1.5} transparent opacity={0.8} />
      ))}
      {H.nodos.filter(visible).map((n) => (
        <mesh key={n.id} position={aEscena(n.x, n.y, n.h + 0.09)}>
          <sphereGeometry args={[n.tipo === 'puerta' ? 0.09 : 0.07, 10, 8]} />
          <meshBasicMaterial color={n.tipo === 'ambiente' ? '#E2533D' : COLOR.nodo} />
        </mesh>
      ))}
    </group>
  )
}

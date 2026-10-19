import { Canvas } from '@react-three/fiber'
import { Cielo } from './Cielo.jsx'
import { ModeloSK } from './ModeloSK.jsx'
import { Hospital } from './Hospital.jsx'
import { Personaje } from './Personaje.jsx'
import { Grafo } from './Grafo.jsx'
import { Camara } from './Camara.jsx'

export function Escena() {
  return (
    <Canvas shadows dpr={[1, 1.75]} camera={{ fov: 38, position: [-150, 150, 170], near: 0.5, far: 2000 }} onContextMenu={(e) => e.preventDefault()}>
      <Cielo />
      <ModeloSK />
      <Hospital />
      <Personaje />
      <Grafo />
      <Camara />
    </Canvas>
  )
}

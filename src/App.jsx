import { Escena } from './scene/Escena.jsx'
import { Panel } from './ui/Panel.jsx'
import { HUD } from './ui/HUD.jsx'
import { Vista2D } from './ui/mapa2d/Vista2D.jsx'
import { useStore } from './store.js'

export default function App() {
  const { modo, setModo } = useStore()
  return (
    <div className={`wrap modo-${modo}`}>
      <header className="cabecera">
        <div>
          <h1>Hospital de ejemplo</h1>
          <p className="sub">Levantado desde los planos de AutoCAD · 3 pisos · rutas con A* sobre el grafo de pasillos, puertas, escaleras y ascensores</p>
        </div>
        <div className="cambio-modo" role="tablist" aria-label="Forma de ver el hospital">
          <button role="tab" aria-selected={modo === '2d'} onClick={() => setModo('2d')}>Mapa 2D</button>
          <button role="tab" aria-selected={modo === '3d'} onClick={() => setModo('3d')}>Recorrido 3D</button>
        </div>
      </header>
      {modo === '2d' ? (
        <div className="stage stage-2d"><Vista2D /></div>
      ) : (
        <div className="grid">
          <div className="stage">
            <Escena />
            <HUD />
          </div>
          <Panel />
        </div>
      )}
    </div>
  )
}

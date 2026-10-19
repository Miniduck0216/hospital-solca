import { useStore } from '../store.js'
import { vivo } from '../lib/vivo.js'
import { aEscena, NIVELES, NP } from '../lib/datos.js'

const NOMBRES = [...NIVELES, 'Techo']
const MUROS = [['arriba', 'Muros arriba'], ['recorte', 'Recorte'], ['abajo', 'Muros abajo']]
const VELOCIDADES = [[0, '❚❚', 'Pausa'], [1, '▶', 'Normal'], [10, '▶▶', 'Rápido']]

export function HUD() {
  const { nivel, setNivel, modoMuros, setModoMuros, velocidad, setVelocidad, horaTexto, aviso } = useStore()
  return (
    <>
      <div className="hud hud-izq">
        <div className="grupo">
          <button onClick={() => setNivel(nivel + 1)} disabled={nivel === NP} aria-label="Subir de piso">▲</button>
          <span className="nivel">{NOMBRES[nivel]}</span>
          <button onClick={() => setNivel(nivel - 1)} disabled={nivel === 0} aria-label="Bajar de piso">▼</button>
        </div>
        <div className="grupo">
          {MUROS.map(([k, t]) => <button key={k} aria-pressed={modoMuros === k} onClick={() => setModoMuros(k)}>{t}</button>)}
        </div>
      </div>
      <div className="hud hud-der">
        <div className="grupo">
          <span className="reloj">{horaTexto}</span>
          {VELOCIDADES.map(([v, s, t]) => <button key={v} aria-pressed={velocidad === v} onClick={() => setVelocidad(v)} title={t} aria-label={t}>{s}</button>)}
          <button onClick={() => (vivo.hora = 20)} title="Saltar a la noche">Noche</button>
          <button onClick={() => (vivo.hora = 10)} title="Saltar al día">Día</button>
        </div>
        <button className="grupo" onClick={() => (vivo.enfocar = aEscena(vivo.personaje.x, vivo.personaje.y, vivo.personaje.h))}>Centrar personaje</button>
      </div>
      {aviso && <div className="aviso">{aviso}</div>}
      <div className="ayuda">Clic: caminar · Arrastrar: girar · Clic derecho: mover · Rueda: zoom · WASD / Q E · RePág / AvPág: pisos · C: centrar</div>
    </>
  )
}

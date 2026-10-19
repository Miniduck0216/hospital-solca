import { H, NIVELES, cuartoById } from '../lib/datos.js'
import { useStore } from '../store.js'

const GRUPOS = H.pisos.map((p) => ({
  piso: p.nivel,
  nombre: p.nombre,
  destinos: H.destinos.filter((d) => d.piso === p.nivel && !/^Escalera|^Ascensores/.test(d.nombre)).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
}))

export function Panel() {
  const { zona, ruta, ordenar, verGrafo, toggleGrafo, accesible, toggleAccesible } = useStore()
  const actual = zona ? cuartoById[zona] : null
  return (
    <div className="panel">
      <div className="card">
        <div className="donde">
          <span className="eti">Estás en</span>
          <b>{actual ? actual.nombre : '—'}</b>
          <span className="piso">{actual ? NIVELES[actual.piso] : ''}</span>
        </div>
        <div className="field">
          <label htmlFor="destino">Ir a</label>
          <select id="destino" value="" onChange={(e) => e.target.value && ordenar({ tipo: 'nodo', id: e.target.value })}>
            <option value="" disabled>Elige un servicio…</option>
            {GRUPOS.map((g) => (
              <optgroup key={g.piso} label={g.nombre}>
                {g.destinos.map((d) => <option key={d.nodo} value={d.nodo}>{d.nombre}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        <button className="primary" onClick={() => ordenar({ tipo: 'cercano', ids: H.banos })}>¿Dónde está el baño más cercano?</button>
        <label className="toggle"><input type="checkbox" checked={accesible} onChange={toggleAccesible} /> Ruta accesible (sin escaleras)</label>
        <label className="toggle"><input type="checkbox" checked={verGrafo} onChange={toggleGrafo} /> Mostrar grafo del piso</label>
      </div>
      <div className="card">
        {ruta ? (
          <>
            <div className="stats">
              <div><b>{Math.round(ruta.costo)} m</b><span>caminando</span></div>
              <div><b>{Math.max(1, Math.round(ruta.costo / 1.2 / 6) / 10)} min</b><span>aprox.</span></div>
            </div>
            <div className="dest"><span className="eti">Destino</span><b>{ruta.destino?.nombre}</b></div>
            <ol>
              {ruta.pasos.map((partes, i) => (
                <li key={i}>{partes.map((p, j) => (typeof p === 'string' ? p : <b key={j}>{p.b}</b>))}</li>
              ))}
            </ol>
          </>
        ) : (
          <p className="vacio">Haz clic en cualquier piso para caminar, elige un servicio en "Ir a" o toca una escalera. El personaje usa el ascensor para cambiar de piso.</p>
        )}
      </div>
    </div>
  )
}

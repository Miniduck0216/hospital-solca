// Pantalla de carga: el indicador que gira y el texto, quieto (antes cada letra entraba en secuencia).
export function Cargando({ texto }) {
  return (
    <div className="pb-error pb-cargando-k" role="status" aria-live="polite">
      <span className="pb-spinner" />
      <p className="kinetico">{texto}</p>
    </div>
  )
}

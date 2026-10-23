// Pantalla de carga con texto cinético: cada letra entra en secuencia (inspirado en los loaders de Vengeance UI;
// implementado aquí en CSS, sin dependencias nuevas).
export function Cargando({ texto }) {
  return (
    <div className="pb-error pb-cargando-k" role="status" aria-live="polite">
      <span className="pb-spinner" />
      <p className="kinetico" aria-label={texto}>
        {[...texto].map((ch, i) => (
          <span key={i} aria-hidden="true" style={{ animationDelay: `${i * 0.045}s` }}>{ch === ' ' ? ' ' : ch}</span>
        ))}
      </p>
    </div>
  )
}

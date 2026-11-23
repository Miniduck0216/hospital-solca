// Sede sin plano publicado en OM3 (y sin respaldo local, que solo tiene Quito): en vez de caer al plano de otro
// hospital, se avisa y se muestra el mapa base en el centro de la ciudad de la sede (sedes.js, SEDES_INFO).
import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'

const ESTILO = 'https://tiles.openfreemap.org/styles/positron'

export function SinPlanoSede({ sede, mensaje }) {
  const ref = useRef(null)
  const centro = sede?.info?.centro || null
  useEffect(() => {
    if (!ref.current || !centro) return
    let mapa = null
    try {
      mapa = new maplibregl.Map({ container: ref.current, style: ESTILO, center: centro, zoom: 13, attributionControl: { compact: true } })
      window.__mapaSinPlano = mapa
    } catch { /* sin WebGL: queda solo el aviso */ }
    return () => { try { mapa?.remove() } catch { /* ya quitado */ } }
  }, [centro?.[0], centro?.[1]])
  return (
    <div className="pb-sin-plano" data-sede={sede?.sede || ''}>
      {centro && <div ref={ref} className="pb-sin-plano-mapa" aria-hidden="true" />}
      <div className="pb-sin-plano-aviso" role="status">
        <strong>{mensaje}</strong>
        {sede?.info?.nombre && <span>SOLCA {sede.info.nombre}</span>}
      </div>
    </div>
  )
}

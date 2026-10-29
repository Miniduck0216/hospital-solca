// Cambio de piso durante el recorrido: una tarjeta con el edificio en corte (los pisos uno sobre otro) donde la cabina
// del ascensor —o la persona, por las escaleras— va del piso de salida al de llegada. Luego el recorrido sigue en el
// otro piso. Es solo CSS (sin 3D): liviano para el tótem. Se puede saltar con «Continuar».
import { useEffect, useMemo, useState } from 'react'
import { Icono } from '../ui/mapa2d/Iconos.jsx'

const DURACION = { ascensor: 4200, escalera: 4600 }

export function CambioPiso({ tipo = 'ascensor', de, a, nombre = '', pisos = [], onFin }) {
  // pisos del edificio de arriba hacia abajo; la cabina recorre desde «de» hasta «a»
  const lista = useMemo(() => [...pisos].sort((x, y) => y.nivel - x.nivel), [pisos])
  const iDe = Math.max(0, lista.findIndex((p) => p.id === de))
  const iA = Math.max(0, lista.findIndex((p) => p.id === a))
  const sube = iA < iDe
  const destino = lista[iA]
  // fases: puertas que se cierran → viaje → puertas que se abren
  const [fase, setFase] = useState('cierra')
  useEffect(() => {
    const total = DURACION[tipo] || 4200
    const reducir = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const t1 = setTimeout(() => setFase('viaja'), reducir ? 0 : 700)
    const t2 = setTimeout(() => setFase('abre'), reducir ? 600 : total - 800)
    const t3 = setTimeout(() => onFin?.(), reducir ? 1500 : total)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const n = Math.max(1, lista.length)
  const fila = fase === 'cierra' ? iDe : iA
  const verbo = tipo === 'escalera' ? (sube ? 'Sube por las escaleras' : 'Baja por las escaleras') : (sube ? 'Sube en el ascensor' : 'Baja en el ascensor')
  return (
    <div className="cp-fondo" role="dialog" aria-live="assertive" aria-label={`${verbo} a ${destino?.nombre || a}`}>
      <div className={`cp-tarjeta cp-${tipo} cp-${fase}`}>
        <div className="cp-edificio" style={{ '--n': n, '--fila': fila, '--viaje': `${(DURACION[tipo] || 4200) - 1500}ms` }}>
          {lista.map((p, i) => (
            <div key={p.id} className={`cp-piso${i === iDe ? ' sale' : ''}${i === iA ? ' llega' : ''}`}>
              <b>{p.corto}</b>
              {tipo === 'escalera' && <span className="cp-gradas" aria-hidden="true" />}
            </div>
          ))}
          <div className="cp-movil" aria-hidden="true">
            {tipo === 'escalera'
              ? <span className="cp-persona"><Icono nombre="caminar" size={22} color="#fff" grosor={2.4} /></span>
              : <span className="cp-cabina"><i className="cp-hoja izq" /><i className="cp-hoja der" /><Icono nombre="ascensor" size={22} color="#fff" grosor={2} /></span>}
          </div>
        </div>
        <div className="cp-txt">
          <small>{nombre || (tipo === 'escalera' ? 'Escaleras' : 'Ascensores')}</small>
          <h3><Icono nombre={sube ? 'subir' : 'bajar'} size={22} grosor={2.6} /> {verbo}</h3>
          <p>hasta <b>{destino?.nombre || a}</b></p>
          <button className="btn-negro" onClick={() => onFin?.()}>Continuar</button>
        </div>
      </div>
    </div>
  )
}

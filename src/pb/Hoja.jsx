// Tarjeta de información. En el celular es una hoja que se arrastra hacia arriba o abajo y se puede minimizar
// (toque en la raya o en la flecha). En la computadora es una tarjeta que se minimiza con su botón.
import { useEffect, useRef, useState } from 'react'
import { Icono } from '../ui/mapa2d/Iconos.jsx'

const MINI = 88
const esMovil = () => window.matchMedia('(max-width: 700px)').matches

export function Hoja({ clase, resumen, arrastrable = true, children }) {
  const [movil, setMovil] = useState(esMovil)
  const [estado, setEstado] = useState('medio')   // mini | medio | alto (solo celular)
  const [px, setPx] = useState(null)              // altura mientras se arrastra
  const [minima, setMinima] = useState(false)     // minimizada (computadora)
  const ref = useRef(null)
  const arr = useRef(null)

  useEffect(() => {
    const f = () => setMovil(esMovil())
    window.addEventListener('resize', f)
    return () => window.removeEventListener('resize', f)
  }, [])

  const sheet = movil && arrastrable
  const alturas = () => ({ mini: MINI, medio: Math.round(window.innerHeight * 0.44), alto: Math.round(window.innerHeight * 0.84) })
  const mini = sheet ? px === null && estado === 'mini' : minima

  const alternar = () => {
    if (sheet) { setPx(null); setEstado((e) => (e === 'mini' ? 'medio' : 'mini')) } else setMinima((m) => !m)
  }

  const bajar = (e) => {
    if (!sheet || e.target.closest('button')) return
    arr.current = { y: e.clientY, h: ref.current.offsetHeight, movido: false }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const mover = (e) => {
    if (!arr.current) return
    const dy = arr.current.y - e.clientY
    if (Math.abs(dy) > 4) arr.current.movido = true
    setPx(Math.max(MINI, Math.min(window.innerHeight * 0.92, arr.current.h + dy)))
  }
  const soltar = () => {
    if (!arr.current) return
    const { movido } = arr.current
    arr.current = null
    if (!movido) { setPx(null); setEstado((e) => (e === 'mini' ? 'medio' : 'mini')); return }
    const h = ref.current?.offsetHeight || MINI
    const a = alturas()
    const cerca = Object.entries(a).reduce((m, [k, v]) => (Math.abs(v - h) < Math.abs(a[m] - h) ? k : m), 'medio')
    setEstado(cerca)
    setPx(null)
  }

  return (
    <div ref={ref} className={`tarjeta hoja ${clase || ''}${mini ? ' mini' : ''}${sheet ? ' sheet' : ''}`}
      role="dialog" aria-label={resumen}
      style={sheet ? { height: px ?? alturas()[estado] } : undefined}>
      <div className="hoja-agarre" onPointerDown={bajar} onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar}>
        {sheet && <span className="hoja-raya" aria-hidden="true" />}
        <div className="hoja-cab">
          <span className="hoja-resumen">{resumen}</span>
          <button className="hoja-min" onClick={alternar} aria-label={mini ? 'Mostrar' : 'Minimizar'} aria-expanded={!mini}>
            <Icono nombre={mini ? 'subir' : 'bajar'} size={16} grosor={2.4} />
          </button>
        </div>
      </div>
      <div className="hoja-cuerpo">{children}</div>
    </div>
  )
}

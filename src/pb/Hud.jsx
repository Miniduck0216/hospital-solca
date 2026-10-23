// Piezas de la interfaz inspiradas en VengeanceUI (vengenceui.com), reescritas sin Tailwind ni framer-motion:
// - BarraFoco: la "Spotlight Navbar": una luz sigue al cursor sobre las categorías y un brillo marca la activa.
// - Dock: el "Glass Dock": barra de vidrio con íconos que crecen al pasar y una etiqueta que se desliza al ícono.
import { useEffect, useRef, useState } from 'react'
import { Icono } from '../ui/mapa2d/Iconos.jsx'

export function BarraFoco({ items, activo = null, onElegir }) {
  const nav = useRef(null)
  const fila = useRef(null)
  const [luz, setLuz] = useState(false)

  // el brillo inferior se queda en la categoría activa (o se apaga si no hay ninguna)
  useEffect(() => {
    const n = nav.current, f = fila.current
    if (!n || !f) return
    const ubicar = () => {
      const b = activo ? f.querySelector(`[data-id="${activo}"]`) : null
      if (!b) { n.style.setProperty('--amb-o', '0'); return }
      const rn = n.getBoundingClientRect(), rb = b.getBoundingClientRect()
      n.style.setProperty('--amb-x', `${rb.left - rn.left + rb.width / 2}px`)
      n.style.setProperty('--amb-o', '1')
    }
    // la categoría activa se desliza a la vista si quedó cortada
    const b = activo ? f.querySelector(`[data-id="${activo}"]`) : null
    if (b) f.scrollTo({ left: Math.max(0, b.offsetLeft - (f.clientWidth - b.offsetWidth) / 2), behavior: 'smooth' })
    ubicar()
    f.addEventListener('scroll', ubicar, { passive: true })
    return () => f.removeEventListener('scroll', ubicar)
  }, [activo])

  const mover = (e) => {
    const r = nav.current.getBoundingClientRect()
    nav.current.style.setProperty('--luz-x', `${e.clientX - r.left}px`)
  }

  return (
    <nav ref={nav} className={`foco-nav${luz ? ' luz' : ''}`} aria-label="Categorías" onPointerMove={mover} onPointerEnter={() => setLuz(true)} onPointerLeave={() => setLuz(false)}>
      <div ref={fila} className="foco-fila">
        {items.map((c) => (
          <button key={c.id} data-id={c.id} className={`foco-item${activo === c.id ? ' on' : ''}`} onClick={() => onElegir(c)}>
            <span className="foco-ic" style={{ '--c': c.color }}><Icono nombre={c.icono} size={14} color="#fff" grosor={2.2} /></span>
            {c.nombre}
          </button>
        ))}
      </div>
      <span className="foco-luz" aria-hidden="true" />
      <span className="foco-amb" aria-hidden="true" />
    </nav>
  )
}

export function Dock({ items, vertical = true }) {
  const [sobre, setSobre] = useState(null)
  const caja = useRef(null)
  const [pos, setPos] = useState(0)
  const entrar = (i, e) => {
    setSobre(i)
    const r = caja.current.getBoundingClientRect(), b = e.currentTarget.getBoundingClientRect()
    setPos(vertical ? b.top - r.top + b.height / 2 : b.left - r.left + b.width / 2)
  }
  return (
    <div ref={caja} className={`dock${vertical ? ' vertical' : ''}`} onPointerLeave={() => setSobre(null)}>
      {items.map((it, i) => (
        <button key={it.id} className={`dock-btn${it.on ? ' on' : ''}${sobre === i ? ' sobre' : ''}${sobre !== null && Math.abs(sobre - i) === 1 ? ' vecino' : ''}`}
          onPointerEnter={(e) => entrar(i, e)} onFocus={(e) => entrar(i, e)} onBlur={() => setSobre(null)} onClick={it.onClick} aria-label={it.titulo} aria-pressed={it.on ?? undefined}>
          {it.texto ? <b>{it.texto}</b> : <Icono nombre={it.icono} size={19} grosor={2} />}
        </button>
      ))}
      <span className={`dock-tip${sobre !== null ? ' ver' : ''}`} style={{ '--p': `${pos}px` }} aria-hidden="true">
        <span key={sobre}>{sobre !== null ? items[sobre].titulo : ''}</span>
      </span>
    </div>
  )
}

import { useMemo, useState, useEffect, useRef } from 'react'
import { CATEGORIAS, catById, LUGARES, BANO_CERCANO, NOMBRES_PISO } from '../../lib/lugares.js'
import { Icono, Insignia } from './Iconos.jsx'

const normal = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function Fila({ lugar, onClick, sub }) {
  const cat = catById[lugar.cat]
  return (
    <li>
      <button className="fila" onClick={onClick}>
        <Insignia icono={lugar.icono} color={cat?.color || '#5B6B7C'} />
        <span className="fila-txt"><b>{lugar.nombre}</b><small>{sub ?? `${NOMBRES_PISO[lugar.piso]} · ${cat?.nombre || ''}`}</small></span>
        <Icono nombre="flecha" size={18} className="chev" />
      </button>
    </li>
  )
}

export function Buscador({ modo, onElegir, onCerrar, categoriaInicial = null }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState(categoriaInicial)
  const input = useRef(null)
  useEffect(() => { input.current?.focus() }, [])

  const resultados = useMemo(() => {
    const t = normal(q.trim())
    if (!t) return null
    return LUGARES.filter((l) => normal(l.nombre).includes(t)).sort((a, b) => a.piso - b.piso || a.nombre.localeCompare(b.nombre, 'es'))
  }, [q])
  const conteo = useMemo(() => Object.fromEntries(CATEGORIAS.map((c) => [c.id, LUGARES.filter((l) => l.cat === c.id).length])), [])
  const lista = cat ? LUGARES.filter((l) => l.cat === cat).sort((a, b) => a.piso - b.piso || a.nombre.localeCompare(b.nombre, 'es')) : null

  return (
    <div className="buscador" role="dialog" aria-label={modo === 'origen' ? 'Elegir punto de partida' : 'Elegir destino'}>
      <div className="busc-cab">
        <button className="icono-btn" onClick={() => (cat ? setCat(null) : onCerrar())} aria-label="Volver"><Icono nombre="volver" /></button>
        <div className="busc-campo">
          <Icono nombre="buscar" size={18} />
          <input ref={input} value={q} onChange={(e) => { setQ(e.target.value); setCat(null) }} placeholder={modo === 'origen' ? '¿Dónde estás?' : '¿Qué estás buscando?'} />
          {q && <button className="icono-btn mini" onClick={() => setQ('')} aria-label="Borrar"><Icono nombre="cerrar" size={16} /></button>}
        </div>
      </div>
      <div className="busc-cuerpo">
        {resultados ? (
          resultados.length ? (
            <ul className="filas">{resultados.map((l) => <Fila key={l.id} lugar={l} onClick={() => onElegir(l)} />)}</ul>
          ) : <p className="busc-vacio">No encontramos «{q}». Prueba con otra palabra o elige una categoría.</p>
        ) : lista ? (
          <>
            <h3 className="busc-titulo">{catById[cat].nombre}</h3>
            <ul className="filas">{lista.map((l) => <Fila key={l.id} lugar={l} onClick={() => onElegir(l)} />)}</ul>
          </>
        ) : (
          <>
            {modo === 'destino' && (
              <ul className="filas destacados">
                <Fila lugar={BANO_CERCANO} sub="La ruta más corta desde donde estás" onClick={() => onElegir(BANO_CERCANO)} />
              </ul>
            )}
            {modo === 'origen' && (
              <ul className="filas destacados">
                {LUGARES.filter((l) => l.cat === 'salidas').map((l) => <Fila key={l.id} lugar={l} onClick={() => onElegir(l)} />)}
              </ul>
            )}
            <h3 className="busc-titulo">Categorías</h3>
            <ul className="filas">
              {CATEGORIAS.map((c) => (
                <li key={c.id}>
                  <button className="fila" onClick={() => setCat(c.id)}>
                    <Insignia icono={c.icono} color={c.color} />
                    <span className="fila-txt"><b>{c.nombre}</b><small>{conteo[c.id]} lugares</small></span>
                    <Icono nombre="flecha" size={18} className="chev" />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}

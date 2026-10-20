import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../../store.js'
import { H, nodeById } from '../../lib/datos.js'
import { planificar, instrucciones, cercanos } from '../../lib/navegacion.js'
import { LUGARES, CATEGORIAS, catById, NOMBRES_PISO, CORTO_PISO, BANO_CERCANO } from '../../lib/lugares.js'
import { Mapa2D, encuadreDe } from './Mapa2D.jsx'
import { Buscador } from './Buscador.jsx'
import { QR } from './QR.jsx'
import { Icono, Insignia } from './Iconos.jsx'
import './mapa2d.css'

function calcular(origen, destino, accesible) {
  if (!origen || !destino) return null
  const n0 = nodeById[origen.nodo]
  const estado = { pos: { ...n0 }, anclas: [origen.nodo] }
  const metas = destino.especial === 'bano' ? cercanos(n0, H.banos) : [destino.nodo]
  let mejor = null
  for (const m of metas) {
    const plan = planificar(estado, { tipo: 'nodo', id: m }, { accesible })
    if (plan && (!mejor || plan.costo < mejor.plan.costo)) mejor = { plan, nodo: m }
  }
  if (!mejor) return null
  const real = destino.especial ? LUGARES.find((l) => l.nodo === mejor.nodo) : destino
  const pisos = []
  for (const p of mejor.plan.puntos) if (pisos[pisos.length - 1] !== p.piso) pisos.push(p.piso)
  const ascensor = mejor.plan.puntos.some((p) => p.tipo === 'ascensor')
  return { plan: mejor.plan, destino: real, pasos: instrucciones(mejor.plan, n0), pisos, ascensor }
}

// categorías de la barra superior (los ascensores y salidas no son destinos de búsqueda)
const CHIPS = CATEGORIAS.filter((c) => !['circulacion', 'salidas'].includes(c.id))

function Campo({ tipo, lugar, onClick }) {
  return (
    <button className={`campo campo-${tipo}`} onClick={onClick}>
      <span className="campo-marca" aria-hidden="true" />
      <span className="campo-txt">
        <small>{tipo === 'origen' ? 'Desde' : 'Hasta'}</small>
        <b className={lugar ? '' : 'vacio'}>{lugar ? lugar.nombre : '¿A dónde quieres ir?'}</b>
      </span>
      {lugar && !lugar.especial && <span className="campo-piso">{CORTO_PISO[lugar.piso]}</span>}
      {lugar?.especial && <span className="campo-piso">Auto</span>}
    </button>
  )
}

const IconoMenu = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
)

export function Vista2D() {
  const { piso2d, setPiso2d, origen2d, destino2d, setOrigen2d, setDestino2d, intercambiar2d, accesible, toggleAccesible, navegando, setNavegando, setModo } = useStore()
  const [buscando, setBuscando] = useState(null)   // { modo: 'origen' | 'destino', cat? }
  const [popup, setPopup] = useState(null)
  const [encuadre, setEncuadre] = useState(null)
  const [qr, setQr] = useState(null)
  const [menu, setMenu] = useState(false)
  const cont = useRef(null)
  const mapa = useRef(null)

  const calc = useMemo(() => calcular(origen2d, destino2d, accesible), [origen2d, destino2d, accesible])

  // al cambiar la ruta: mostrar el piso de partida y encuadrar el tramo
  useEffect(() => {
    if (!calc) return
    const p0 = calc.plan.puntos[0].piso
    setPiso2d(p0)
    setEncuadre(encuadreDe(calc.plan.puntos, p0))
  }, [calc, setPiso2d])

  const cambiarPiso = (p) => {
    setPiso2d(p)
    setEncuadre(calc ? encuadreDe(calc.plan.puntos, p) : null)
    setPopup(null)
  }
  const elegirCuarto = (c, pt) => {
    if (!c) { setPopup(null); return }
    const r = cont.current.getBoundingClientRect()
    const lugar = LUGARES.find((l) => l.cuarto && l.piso === c.piso && l.cuarto.id === c.id) || LUGARES.find((l) => l.cuarto && l.piso === c.piso && l.dep === c.dep)
    setPopup({ c, lugar, x: Math.min(r.width - 150, Math.max(150, pt.x - r.left)), y: pt.y - r.top })
  }
  const iniciar = () => {
    if (!calc) return
    setNavegando(true)
    cambiarPiso(calc.plan.puntos[0].piso)
  }
  const elegirChip = (c) => {
    if (c.id === 'banos') { setDestino2d(BANO_CERCANO); return }
    setBuscando({ modo: 'destino', cat: c.id })
  }

  const metros = calc ? Math.round(calc.plan.metros) : 0
  const minutos = calc ? Math.max(1, Math.round(metros / 1.2 / 60 + (calc.ascensor ? 0.5 : 0))) : 0
  const pisosRuta = new Set(calc ? calc.pisos : [])
  const catDest = calc ? catById[calc.destino.cat] : null
  const pisosLista = H.pisos.map((p) => p.nivel).reverse()

  return (
    <div className="vista2d" ref={cont}>
      <Mapa2D ref={mapa} piso={piso2d} plan={calc?.plan} origen={origen2d} destino={calc?.destino || (destino2d?.especial ? null : destino2d)}
        onElegirCuarto={elegirCuarto} onCambiarPiso={cambiarPiso} encuadre={encuadre} />

      {/* barra superior: menú, búsqueda y logo; debajo, categorías */}
      <div className="columna-izq">
        <div className="barra">
          <div className="barra-fila">
            <button className="barra-menu" aria-label="Menú" aria-expanded={menu} onClick={() => setMenu((m) => !m)}><IconoMenu /></button>
            <button className="barra-buscar" onClick={() => setBuscando({ modo: 'destino' })}>
              <Icono nombre="buscar" size={18} />
              <span>{destino2d ? destino2d.nombre : 'Buscar en SOLCA'}</span>
            </button>
            <div className="barra-logo" aria-label="Hospital SOLCA Quito"><b>SOLCA</b><small>Quito</small></div>
          </div>
          <div className="chips" aria-label="Categorías">
            {CHIPS.map((c) => (
              <button key={c.id} className="chip-cat" onClick={() => elegirChip(c)}>
                <span className="punto" style={{ background: c.color }} aria-hidden="true" />
                {c.nombre}
              </button>
            ))}
          </div>
        </div>

        {menu && (
          <div className="menu" role="menu">
            <button role="menuitem" className={`menu-op ${accesible ? 'on' : ''}`} aria-pressed={accesible} onClick={toggleAccesible}>
              <Icono nombre="silla" size={18} /> Ruta accesible <small>{accesible ? 'activada' : 'usa ascensores'}</small>
            </button>
            <button role="menuitem" className="menu-op" disabled={!origen2d?.codigo} onClick={() => { setQr(origen2d); setMenu(false) }}>
              <Icono nombre="info" size={18} /> Código QR del punto de partida
            </button>
            <button role="menuitem" className="menu-op" onClick={() => { setModo('3d'); setMenu(false) }}>
              <Icono nombre="piso" size={18} /> Ver recorrido 3D
            </button>
          </div>
        )}

        <div className="tarjeta tarjeta-busqueda">
          <div className="campos">
            <Campo tipo="origen" lugar={origen2d} onClick={() => setBuscando({ modo: 'origen' })} />
            <Campo tipo="destino" lugar={destino2d} onClick={() => setBuscando({ modo: 'destino' })} />
            <span className="campos-guia" aria-hidden="true" />
            <button className="icono-btn intercambiar" onClick={intercambiar2d} aria-label="Intercambiar origen y destino" disabled={!destino2d || destino2d.especial}>
              <Icono nombre="intercambiar" size={18} />
            </button>
          </div>
          <div className="acciones">
            <button className="btn-negro" disabled={!calc} onClick={iniciar}>{navegando ? 'En ruta' : 'Iniciar ruta'}</button>
          </div>
        </div>
      </div>

      {/* controles: pisos, zoom y norte */}
      <div className="columna-der">
        <div className="selector-piso" role="group" aria-label="Piso">
          {pisosLista.map((p) => (
            <button key={p} aria-pressed={piso2d === p} onClick={() => cambiarPiso(p)} title={NOMBRES_PISO[p]}>
              {CORTO_PISO[p]}{pisosRuta.has(p) && <i className="punto-ruta" />}
            </button>
          ))}
        </div>
        <div className="zoom-ctrl" role="group" aria-label="Zoom">
          <button aria-label="Acercar" onClick={() => mapa.current?.acercar()}><Icono nombre="mas" /></button>
          <button aria-label="Alejar" onClick={() => mapa.current?.alejar()}><Icono nombre="menos" /></button>
          <button aria-label="Ver todo el hospital" onClick={() => mapa.current?.centrar()}><Icono nombre="centrar" /></button>
        </div>
        <div className="norte" title="Norte" aria-label="Norte">
          <svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 2l5 14-5-3-5 3z" fill="#D7443A" /><path d="M12 22l-5-6 5-3 5 3z" fill="#B8C1CB" /></svg>
          <b>N</b>
        </div>
      </div>

      {/* resumen de ruta */}
      {calc && (
        <div className={`tarjeta tarjeta-ruta ${navegando ? 'abierta' : ''}`}>
          <div className="ruta-cab">
            <Insignia icono={calc.destino.icono} color={catDest?.color || '#5B6B7C'} size={40} />
            <div>
              <b>{calc.destino.nombre}</b>
              <small>{NOMBRES_PISO[calc.destino.piso]} · {catDest?.nombre}</small>
            </div>
            <button className="icono-btn" onClick={() => { setDestino2d(null); setNavegando(false) }} aria-label="Cerrar ruta"><Icono nombre="cerrar" size={18} /></button>
          </div>
          <div className="ruta-datos">
            <span><Icono nombre="caminar" size={17} /> {metros} m</span>
            <span><Icono nombre="reloj" size={17} /> {minutos} min</span>
            <span><Icono nombre="piso" size={17} /> {calc.pisos.map((p) => CORTO_PISO[p]).join(' → ')}</span>
            {accesible && <span className="accesible"><Icono nombre="silla" size={17} /> Accesible</span>}
          </div>
          {navegando ? (
            <>
              <ol className="pasos">
                {calc.pasos.map((partes, i) => (
                  <li key={i}>{partes.map((p, j) => (typeof p === 'string' ? p : <b key={j}>{p.b}</b>))}</li>
                ))}
              </ol>
              <div className="ruta-pie">
                <button className="btn-claro" onClick={iniciar}>Repetir ruta</button>
                <button className="btn-claro" onClick={() => setNavegando(false)}>Ocultar pasos</button>
              </div>
            </>
          ) : (
            <p className="ruta-nota">Pulsa <b>Iniciar ruta</b> para ver las indicaciones paso a paso.</p>
          )}
        </div>
      )}

      {/* ficha de un ambiente tocado en el mapa */}
      {popup && (
        <div className="ficha" style={{ left: popup.x, top: popup.y }} onPointerDown={(e) => e.stopPropagation()}>
          {popup.lugar ? (
            <>
              <div className="ficha-cab">
                <Insignia icono={popup.lugar.icono} color={catById[popup.lugar.cat]?.color} size={30} />
                <div><b>{popup.c.nombre.includes('·') ? popup.c.nombre : popup.lugar.nombre}</b><small>{NOMBRES_PISO[popup.c.piso]}</small></div>
              </div>
              <div className="ficha-btns">
                <button className="btn-negro" onClick={() => { setDestino2d(popup.lugar); setPopup(null) }}>Cómo llegar</button>
                <button className="btn-claro" onClick={() => { setOrigen2d(popup.lugar); setPopup(null) }}>Estoy aquí</button>
                {popup.lugar.codigo && <button className="btn-claro" onClick={() => { setQr(popup.lugar); setPopup(null) }} aria-label="Código QR">QR</button>}
              </div>
            </>
          ) : (
            <div className="ficha-cab"><div><b>{popup.c.nombre}</b><small>Área de servicio · sin acceso al público</small></div></div>
          )}
        </div>
      )}

      {qr && <QR lugar={qr} onCerrar={() => setQr(null)} />}

      {buscando && (
        <Buscador modo={buscando.modo} categoriaInicial={buscando.cat || null} onCerrar={() => setBuscando(null)}
          onElegir={(l) => { (buscando.modo === 'origen' ? setOrigen2d : setDestino2d)(l); setBuscando(null); setPopup(null) }} />
      )}
    </div>
  )
}

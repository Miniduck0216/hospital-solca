import { useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react'
import QRCode from 'qrcode'
import { cargarDatos, usarGeo, CATS, ICONO_LUGAR, plano, dentro } from './datos.js'
import { buscarRuta, indicaciones } from './ruta.js'
import { Mapa } from './Mapa.jsx'
import { Icono, Insignia } from '../ui/mapa2d/Iconos.jsx'

const Vista3D = lazy(() => import('./Vista3D.jsx').then((m) => ({ default: m.Vista3D })))

// categorías de la barra (atajos de búsqueda)
const CHIPS = [
  { id: 'banos', nombre: 'Baños', cat: 'banos' },
  { id: 'consulta', nombre: 'Consultorios', cat: 'consulta' },
  { id: 'farmacia', nombre: 'Farmacia', cat: 'farmacia' },
  { id: 'administracion', nombre: 'Atención y trámites', cat: 'administracion' },
  { id: 'espera', nombre: 'Salas de espera', cat: 'espera' },
  { id: 'vertical', nombre: 'Escaleras y ascensores', cat: 'escaleras' },
]
const ICONO_CAT = { banos: 'bano', consulta: 'consulta', farmacia: 'farmacia', administracion: 'administracion', espera: 'silla', escaleras: 'escalera', ascensores: 'ascensor', circulacion: 'piso', apoyo: 'servicios', otro: 'servicios', entrada: 'salida' }

function distPoli(p, anillo) {
  let m = Infinity
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [ax, ay] = anillo[j], [bx, by] = anillo[i]
    const dx = bx - ax, dy = by - ay
    const t = Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / (dx * dx + dy * dy || 1)))
    m = Math.min(m, Math.hypot(p[0] - ax - t * dx, p[1] - ay - t * dy))
  }
  return m
}

// lugares: ambientes con nombre y destino alcanzable, más las entradas del edificio
function armarLugares(d) {
  const zonas = d.ambientes.filter((a) => a.nombre && (a.cat === 'circulacion' || a.cat === 'espera') && a.area > 30)
  const lugares = []
  for (const a of d.ambientes) {
    if (!a.nombre || !a.dest) continue
    let cerca = null
    if (a.cat !== 'circulacion' && a.area < 120) {
      let m = Infinity
      for (const z of zonas) {
        if (z.id === a.id) continue
        const dd = dentro(a.lbl, z.pg[0]) ? 0 : distPoli(a.lbl, z.pg[0])
        if (dd < m) { m = dd; cerca = z.nombre }
      }
    }
    lugares.push({ id: a.id, nombre: a.nombre, cat: a.cat, area: a.area, x: a.dest[0], y: a.dest[1], lbl: a.lbl, cerca, icono: ICONO_LUGAR[a.icono] || ICONO_CAT[a.cat] })
  }
  for (const e of d.entradas) {
    lugares.push({ id: e.id, nombre: e.nombre === 'Puerta 1' ? 'Puerta 1 · Entrada principal' : e.nombre, cat: 'entrada', x: e.x, y: e.y, lbl: [e.x, e.y], entrada: true, icono: 'salida' })
  }
  return lugares
}

function Campo({ tipo, lugar, onClick }) {
  return (
    <button className={`campo campo-${tipo}`} onClick={onClick}>
      <span className="campo-marca" aria-hidden="true" />
      <span className="campo-txt">
        <small>{tipo === 'origen' ? 'Desde' : 'Hasta'}</small>
        <b className={lugar ? '' : 'vacio'}>{lugar ? lugar.nombre : '¿A dónde quieres ir?'}</b>
      </span>
    </button>
  )
}

function Buscador({ lugares, modo, cat, onElegir, onCerrar }) {
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState(cat || null)
  const inp = useRef(null)
  useEffect(() => { inp.current?.focus() }, [])
  const lista = useMemo(() => {
    const t = plano(q)
    return lugares.filter((l) => {
      if (filtro === 'escaleras' && !['escaleras', 'ascensores'].includes(l.cat)) return false
      if (filtro && filtro !== 'escaleras' && l.cat !== filtro) return false
      if (!t) return modo === 'origen' ? true : l.cat !== 'circulacion' || l.area > 60
      return plano(l.nombre).includes(t) || plano(l.cerca).includes(t) || plano(CATS[l.cat]?.nombre).includes(t)
    }).sort((a, b) => (a.entrada === b.entrada ? a.nombre.localeCompare(b.nombre, 'es', { numeric: true }) : a.entrada ? -1 : 1))
  }, [q, filtro, lugares, modo])
  return (
    <div className="tarjeta pb-buscador" role="dialog" aria-label={modo === 'origen' ? 'Elegir punto de partida' : 'Elegir destino'}>
      <div className="pb-busca-fila">
        <button className="icono-btn" onClick={onCerrar} aria-label="Volver"><Icono nombre="volver" size={18} /></button>
        <input ref={inp} value={q} onChange={(e) => setQ(e.target.value)} placeholder={modo === 'origen' ? '¿Dónde estás?' : 'Buscar servicio, consultorio, baño…'} aria-label="Buscar" />
      </div>
      <div className="chips">
        {CHIPS.map((c) => (
          <button key={c.id} className={`chip-cat${filtro === c.cat ? ' on' : ''}`} onClick={() => setFiltro(filtro === c.cat ? null : c.cat)}>
            <span className="punto" style={{ background: CATS[c.cat].acento }} aria-hidden="true" />{c.nombre}
          </button>
        ))}
      </div>
      <ul className="pb-lista">
        {lista.map((l) => (
          <li key={l.id}>
            <button onClick={() => onElegir(l)}>
              <Insignia icono={l.icono} color={l.entrada ? '#14181F' : (CATS[l.cat] || CATS.otro).acento} size={32} />
              <span><b>{l.nombre}</b><small>{l.entrada ? 'Entrada del edificio' : [CATS[l.cat]?.nombre, l.cerca && `junto a ${l.cerca}`].filter(Boolean).join(' · ')}</small></span>
            </button>
          </li>
        ))}
        {!lista.length && <li className="pb-nada">No hay resultados para «{q}».</li>}
      </ul>
    </div>
  )
}

function QR({ lugar, onCerrar }) {
  const [svg, setSvg] = useState('')
  const url = `${location.origin}${location.pathname}?origen=${encodeURIComponent(lugar.id)}`
  useEffect(() => { QRCode.toString(url, { type: 'svg', margin: 1, color: { dark: '#14181F', light: '#FFFFFF' } }).then(setSvg) }, [url])
  return (
    <div className="qr-fondo" onClick={onCerrar}>
      <div className="qr-tarjeta" role="dialog" aria-label={`Código QR de ${lugar.nombre}`} onClick={(e) => e.stopPropagation()}>
        <small>Usted está aquí</small>
        <h3>{lugar.nombre}</h3>
        <p>Planta baja · Hospital SOLCA Quito</p>
        <div className="qr-img" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="qr-nota">Escanea para ver cómo llegar a cualquier servicio desde este punto.</p>
        <input readOnly value={url} onFocus={(e) => e.target.select()} aria-label="Enlace" />
        <div className="ficha-btns">
          <button className="btn-claro" onClick={() => navigator.clipboard?.writeText(url)}>Copiar enlace</button>
          <button className="btn-claro" onClick={() => window.print()}>Imprimir</button>
          <button className="btn-negro" onClick={onCerrar}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}

const ICONO_PASO = { inicio: 'caminar', camina: 'subir', izquierda: 'volver', derecha: 'flecha', fin: 'centrar' }

export default function App() {
  const [d, setD] = useState(null)
  const [error, setError] = useState(null)
  const [modo, setModo] = useState('2d')
  const [origen, setOrigen] = useState(null)
  const [destino, setDestino] = useState(null)
  const [buscando, setBuscando] = useState(null)
  const [ficha, setFicha] = useState(null)
  const [hover, setHover] = useState(null)
  const [qr, setQr] = useState(false)
  const [leyenda, setLeyenda] = useState(false)
  const mapa = useRef(null)

  useEffect(() => {
    cargarDatos().then((datos) => { usarGeo(datos.geo); setD(datos) }).catch((e) => setError(e.message))
  }, [])
  const lugares = useMemo(() => (d ? armarLugares(d) : []), [d])
  const porId = useMemo(() => Object.fromEntries(lugares.map((l) => [l.id, l])), [lugares])

  // origen por defecto (Puerta 1) o el del enlace / QR (?origen=…&destino=…)
  useEffect(() => {
    if (!lugares.length) return
    const p = new URLSearchParams(location.search)
    setOrigen(porId[p.get('origen')] || lugares.find((l) => l.id === 'entrada-puerta-1') || lugares.find((l) => l.entrada))
    if (porId[p.get('destino')]) setDestino(porId[p.get('destino')])
  }, [lugares, porId])

  const ruta = useMemo(() => {
    if (!d || !origen || !destino || origen.id === destino.id) return null
    const r = buscarRuta(d, [origen.x, origen.y], [destino.x, destino.y])
    return r ? { ...r, pasos: indicaciones(d, r, origen, destino) } : null
  }, [d, origen, destino])

  // el enlace refleja el origen y el destino (para compartir)
  useEffect(() => {
    if (!origen) return
    const p = new URLSearchParams()
    p.set('origen', origen.id)
    if (destino) p.set('destino', destino.id)
    history.replaceState(null, '', `${location.pathname}?${p}`)
  }, [origen, destino])

  const lugaresIcono = useMemo(() => lugares.filter((l) => l.entrada || ['banos', 'escaleras', 'ascensores', 'farmacia'].includes(l.cat) || ['caja', 'info', 'capilla'].includes(l.icono))
    .map((l) => ({ ...l, x: l.entrada ? l.x : l.lbl[0], y: l.entrada ? l.y : l.lbl[1], color: l.entrada ? '#14181F' : (CATS[l.cat] || CATS.otro).acento })), [lugares])

  const elegirDesdeMapa = (id) => {
    const l = porId[id] || lugares.find((x) => x.id === id)
    if (!l) { setFicha(null); return }
    setFicha(l)
  }
  const irA = (l) => { setDestino(l); setFicha(null); setBuscando(null) }

  if (error) return <div className="pb-error">No se pudo cargar el plano: {error}</div>
  if (!d) return <div className="pb-error"><span className="pb-spinner" />Cargando el plano del hospital…</div>

  const minutos = ruta ? Math.max(1, Math.round(ruta.metros / 1.2 / 60)) : 0

  return (
    <div className={`pb-app modo-${modo}`}>
      {modo === '2d'
        ? <Mapa ref={mapa} d={d} ruta={ruta} origen={origen} destino={destino} hover={hover} onElegir={elegirDesdeMapa} onHover={setHover} lugaresIcono={lugaresIcono} />
        : <Suspense fallback={<div className="pb-error"><span className="pb-spinner" />Preparando el 3D…</div>}><Vista3D d={d} ruta={ruta} destino={destino} /></Suspense>}

      {/* columna izquierda: marca, búsqueda y ruta */}
      {!buscando && (
        <div className="pb-col">
          <div className="barra">
            <div className="barra-fila">
              <div className="barra-logo" aria-label="SOLCA Quito"><b>SOLCA</b><small>Quito</small></div>
              <button className="barra-buscar" onClick={() => setBuscando({ modo: 'destino' })}>
                <Icono nombre="buscar" size={18} />
                <span>{destino ? destino.nombre : '¿A dónde quieres ir?'}</span>
              </button>
            </div>
            <div className="chips" aria-label="Categorías">
              {CHIPS.map((c) => (
                <button key={c.id} className="chip-cat" onClick={() => setBuscando({ modo: 'destino', cat: c.cat })}>
                  <span className="punto" style={{ background: CATS[c.cat].acento }} aria-hidden="true" />{c.nombre}
                </button>
              ))}
            </div>
          </div>

          {destino && (
            <div className="tarjeta pb-ruta">
              <div className="campos">
                <Campo tipo="origen" lugar={origen} onClick={() => setBuscando({ modo: 'origen' })} />
                <Campo tipo="destino" lugar={destino} onClick={() => setBuscando({ modo: 'destino' })} />
                <span className="campos-guia" aria-hidden="true" />
                <button className="icono-btn intercambiar" aria-label="Intercambiar origen y destino" onClick={() => { const o = origen; setOrigen(destino); setDestino(o) }}><Icono nombre="intercambiar" size={17} /></button>
              </div>
              {ruta ? (
                <>
                  <div className="ruta-datos">
                    <span><Icono nombre="caminar" size={15} /> {Math.round(ruta.metros)} m</span>
                    <span><Icono nombre="reloj" size={15} /> {minutos} min</span>
                    <span><Icono nombre="piso" size={15} /> Planta baja</span>
                  </div>
                  <ol className="pb-pasos">
                    {ruta.pasos.map((p, i) => (
                      <li key={i} className={`paso-${p.tipo}`}>
                        <span className="pb-paso-i"><Icono nombre={ICONO_PASO[p.tipo]} size={15} /></span>{p.texto}
                      </li>
                    ))}
                  </ol>
                  <div className="acciones">
                    {modo === '2d' && <button className="btn-negro" onClick={() => setModo('3d')}>Ver recorrido en 3D</button>}
                    {modo === '3d' && <button className="btn-negro" onClick={() => setModo('2d')}>Ver en el mapa</button>}
                    <button className="btn-claro" onClick={() => setQr(true)}>QR</button>
                    <button className="btn-claro" onClick={() => setDestino(null)} aria-label="Cerrar ruta">Cerrar</button>
                  </div>
                </>
              ) : <p className="ruta-nota">{origen?.id === destino.id ? 'Ya estás en ese lugar.' : 'No se encontró un camino hasta ese lugar dentro del plano.'}</p>}
            </div>
          )}
        </div>
      )}

      {buscando && (
        <Buscador lugares={lugares} modo={buscando.modo} cat={buscando.cat} onCerrar={() => setBuscando(null)}
          onElegir={(l) => { if (buscando.modo === 'origen') { setOrigen(l); setBuscando(null) } else irA(l) }} />
      )}

      {/* ficha al tocar un ambiente */}
      {ficha && !buscando && (
        <div className="tarjeta pb-ficha" role="dialog" aria-label={ficha.nombre}>
          <div className="pb-ficha-cab">
            <Insignia icono={ficha.icono} color={ficha.entrada ? '#14181F' : (CATS[ficha.cat] || CATS.otro).acento} size={38} />
            <div><b>{ficha.nombre}</b><small>{ficha.entrada ? 'Entrada del edificio' : `${CATS[ficha.cat]?.nombre || ''}${ficha.area ? ` · ${ficha.area.toFixed(0)} m²` : ''}`}{ficha.cerca ? ` · junto a ${ficha.cerca}` : ''}</small></div>
            <button className="icono-btn mini" onClick={() => setFicha(null)} aria-label="Cerrar"><Icono nombre="cerrar" size={16} /></button>
          </div>
          <div className="acciones">
            <button className="btn-negro" onClick={() => irA(ficha)}>Cómo llegar</button>
            <button className="btn-claro" onClick={() => { setOrigen(ficha); setFicha(null) }}>Estoy aquí</button>
          </div>
        </div>
      )}

      {/* columna derecha: 2D / 3D, zoom y leyenda */}
      <div className="pb-der">
        <div className="pb-seg pb-modo" role="tablist" aria-label="Vista">
          <button role="tab" aria-selected={modo === '2d'} onClick={() => setModo('2d')}>2D</button>
          <button role="tab" aria-selected={modo === '3d'} onClick={() => setModo('3d')}>3D</button>
        </div>
        {modo === '2d' && (
          <div className="zoom-pb">
            <button onClick={() => mapa.current?.acercar()} aria-label="Acercar"><Icono nombre="mas" size={18} /></button>
            <button onClick={() => mapa.current?.alejar()} aria-label="Alejar"><Icono nombre="menos" size={18} /></button>
            <button onClick={() => mapa.current?.centrar()} aria-label="Centrar el edificio"><Icono nombre="centrar" size={18} /></button>
          </div>
        )}
        <div className="pb-piso" title="Planta baja">PB</div>
        <button className="pb-ley-btn" onClick={() => setLeyenda((v) => !v)} aria-expanded={leyenda}>Leyenda</button>
        {leyenda && (
          <ul className="pb-leyenda">
            {['consulta', 'espera', 'banos', 'farmacia', 'administracion', 'circulacion', 'apoyo', 'escaleras'].map((k) => (
              <li key={k}><span style={{ background: CATS[k].relleno, borderColor: CATS[k].acento }} />{CATS[k].nombre}</li>
            ))}
          </ul>
        )}
      </div>

      {qr && origen && <QR lugar={origen} onCerrar={() => setQr(false)} />}
      <a className="pb-proto" href={`${import.meta.env.BASE_URL}prototipo/`}>Prototipo anterior (5 pisos)</a>
    </div>
  )
}

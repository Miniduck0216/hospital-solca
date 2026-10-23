import { useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react'
import QRCode from 'qrcode'
import { cargarDatos, usarGeo, CATS, ICONO_LUGAR, plano, dentro } from './datos.js'
import { buscarRuta, indicaciones } from './ruta.js'
import { Mapa } from './Mapa.jsx'
import { Hoja } from './Hoja.jsx'
import { Clave, PanelAdmin } from './Admin.jsx'
import { Cargando } from './Cargando.jsx'
import { BarraFoco, Dock } from './Hud.jsx'
import { Icono, Insignia } from '../ui/mapa2d/Iconos.jsx'

const Vista3D = lazy(() => import('./Vista3D.jsx').then((m) => ({ default: m.Vista3D })))

// cambios del administrador guardados en este navegador (se suman a los publicados en el repositorio)
const CLAVE_LOCAL = 'solca-admin-cambios'
function leerCambios() {
  try { return JSON.parse(localStorage.getItem(CLAVE_LOCAL)) || {} } catch { return {} }
}

// categorías de la barra (atajos de búsqueda)
const CHIPS = [
  { id: 'banos', nombre: 'Baños', cat: 'banos', icono: 'bano' },
  { id: 'consulta', nombre: 'Consultorios', cat: 'consulta', icono: 'consulta' },
  { id: 'farmacia', nombre: 'Farmacia', cat: 'farmacia', icono: 'farmacia' },
  { id: 'administracion', nombre: 'Atención y trámites', cat: 'administracion', icono: 'administracion' },
  { id: 'espera', nombre: 'Salas de espera', cat: 'espera', icono: 'silla' },
  { id: 'vertical', nombre: 'Escaleras y ascensores', cat: 'escaleras', icono: 'ascensor' },
]
// insignias redondas del color de la categoría con el ícono en blanco (como en el mapa)
const TINTA = '#1E2A4A'
const colorDe = (l) => (l.entrada ? TINTA : (CATS[l.cat] || CATS.otro).acento)
const CHIPS_FOCO = CHIPS.map((c) => ({ ...c, color: CATS[c.cat].acento }))
const chipDe = (cat) => (CHIPS.find((c) => c.cat === cat || (c.cat === 'escaleras' && cat === 'ascensores')) || {}).id || null
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
    if (!a.nombre || !a.dest || /^Pasillo Bloque/.test(a.nombre)) continue
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
      <BarraFoco items={CHIPS_FOCO} activo={chipDe(filtro)} onElegir={(c) => setFiltro(filtro === c.cat ? null : c.cat)} />
      <ul className="pb-lista">
        {lista.map((l) => (
          <li key={l.id}>
            <button onClick={() => onElegir(l)}>
              <Insignia icono={l.icono} color={colorDe(l)} size={34} />
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

// modo de inserción: «totem» (pantalla del tótem de OM3) o «guia» (celular tras escanear el QR del tótem).
// En ambos se ocultan la administración, el QR propio y los enlaces que sacan del mapa; ?vista=3d abre en 3D.
const PARAMS = new URLSearchParams(location.search)
const INSERTADO = ['totem', 'guia'].includes(PARAMS.get('modo')) ? PARAMS.get('modo') : null
const VISTA_INICIAL = PARAMS.get('vista') === '3d' ? '3d' : '2d'

const ICONO_PASO = { inicio: 'caminar', camina: 'subir', izquierda: 'izquierda', derecha: 'derecha', fin: 'destino' }

export default function App() {
  const [d, setD] = useState(null)
  const [error, setError] = useState(null)
  const [modo, setModo] = useState(VISTA_INICIAL)
  const [origen, setOrigen] = useState(null)
  const [destino, setDestino] = useState(null)
  const [foco, setFoco] = useState(null)   // lugar elegido en el buscador: la vista llega hasta él
  const [buscando, setBuscando] = useState(null)
  const [ficha, setFicha] = useState(null)
  const [hover, setHover] = useState(null)
  const [qr, setQr] = useState(false)
  const [leyenda, setLeyenda] = useState(false)
  const [admin, setAdmin] = useState(false)
  const [pedirClave, setPedirClave] = useState(false)
  const [cambios, setCambios] = useState(() => leerCambios())
  const [pickId, setPickId] = useState(null)
  const [recorrer, setRecorrer] = useState(false)   // el personaje camina la ruta (en 2D o en 3D, según la vista)
  const mapa = useRef(null)
  const vista3d = useRef(null)
  // zoom con botones en 2D y 3D: el tótem es táctil y no tiene rueda de ratón
  const vista = () => (modo === '2d' ? mapa.current : vista3d.current)

  useEffect(() => {
    cargarDatos(cambios).then((datos) => { usarGeo(datos.geo); setD(datos) }).catch((e) => setError(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // el administrador cambia un ambiente: se guarda aquí y se recalcula el plano
  const onCambiar = (id, patch) => {
    const nuevo = { ...cambios, ambientes: { ...(cambios.ambientes || {}), [id]: { ...((cambios.ambientes || {})[id] || {}), ...patch } } }
    try { localStorage.setItem(CLAVE_LOCAL, JSON.stringify(nuevo)) } catch { /* sin almacenamiento: solo en esta sesión */ }
    setCambios(nuevo)
    cargarDatos(nuevo).then((datos) => { usarGeo(datos.geo); setD(datos) })
  }
  const onRestablecer = () => {
    try { localStorage.removeItem(CLAVE_LOCAL) } catch { /* nada que borrar */ }
    setCambios({})
    cargarDatos({}).then((datos) => { usarGeo(datos.geo); setD(datos) })
  }
  const onPick = (x, y) => { if (pickId) { onCambiar(pickId, { dest: [x, y] }); setPickId(null) } }
  const lugares = useMemo(() => (d ? armarLugares(d) : []), [d])
  // ¿se llega caminando por pasillos abiertos? (si no, la app lo dice en vez de trazar por consultorios)
  const alcanzable = (l) => !!d && (l.entrada || !d.nav.indice[l.id] || d.nav.alcanzable.has(d.nav.indice[l.id]))
  const porId = useMemo(() => Object.fromEntries(lugares.map((l) => [l.id, l])), [lugares])

  // origen por defecto (Puerta 1) o el del enlace / QR (?origen=…&destino=…)
  useEffect(() => {
    if (!lugares.length) return
    const p = new URLSearchParams(location.search)
    setOrigen(porId[p.get('origen')] || lugares.find((l) => l.id === 'entrada-puerta-1') || lugares.find((l) => l.entrada))
    if (porId[p.get('destino')]) setDestino(porId[p.get('destino')])
  }, [lugares, porId])

  useEffect(() => setRecorrer(false), [origen, destino])
  const ruta = useMemo(() => {
    if (!d || !origen || !destino || origen.id === destino.id) return null
    const r = buscarRuta(d, [origen.x, origen.y], [destino.x, destino.y], [origen.id, destino.id], { admin })
    return r ? { ...r, pasos: indicaciones(d, r, origen, destino) } : null
  }, [d, origen, destino, admin])

  // si desde el origen no hay camino, ¿desde otra entrada del edificio sí? (la app lo ofrece en vez de solo decir que no)
  const alternativa = useMemo(() => {
    if (!d || !origen || !destino || origen.id === destino.id || ruta) return null
    for (const e of d.entradas) {
      if (e.id === origen.id) continue
      if (buscarRuta(d, [e.x, e.y], [destino.x, destino.y], [e.id, destino.id], { admin })) return porId[e.id] || e
    }
    return null
  }, [d, origen, destino, admin, ruta, porId])

  // el enlace refleja el origen y el destino (para compartir)
  useEffect(() => {
    if (!origen) return
    const p = new URLSearchParams()
    if (INSERTADO) p.set('modo', INSERTADO)   // el modo se conserva al cambiar origen o destino
    p.set('origen', origen.id)
    if (destino) p.set('destino', destino.id)
    history.replaceState(null, '', `${location.pathname}?${p}`)
  }, [origen, destino])

  const lugaresIcono = useMemo(() => lugares.filter((l) => l.entrada || ['banos', 'escaleras', 'ascensores', 'farmacia'].includes(l.cat) || ['caja', 'info', 'capilla'].includes(l.icono))
    .map((l) => ({ ...l, x: l.entrada ? l.x : l.lbl[0], y: l.entrada ? l.y : l.lbl[1], color: l.entrada ? TINTA : '#FFFFFF' })), [lugares])

  const elegirDesdeMapa = (id) => {
    const l = porId[id] || lugares.find((x) => x.id === id)
    if (!l) { setFicha(null); return }
    setFicha(l)
  }
  const irA = (l) => { setDestino(l); setFoco({ ...l, t: Date.now() }); setFicha(null); setBuscando(null) }

  if (error) return <div className="pb-error">No se pudo cargar el plano: {error}</div>
  if (!d) return <Cargando texto="Cargando el plano del hospital…" />

  const minutos = ruta ? Math.max(1, Math.round(ruta.metros / 1.2 / 60)) : 0

  return (
    <div className={`pb-app modo-${modo}${INSERTADO ? ` insertado-${INSERTADO}` : ''}`}>
      {modo === '2d'
        ? <Mapa ref={mapa} d={d} ruta={ruta} origen={origen} destino={destino} foco={foco} hover={hover} onElegir={elegirDesdeMapa} onHover={setHover} lugaresIcono={lugaresIcono} pick={!!pickId} onPick={onPick} recorrer={recorrer} onFinRecorrer={() => setRecorrer(false)} />
        : <Suspense fallback={<Cargando texto="Preparando el 3D…" />}><Vista3D ref={vista3d} d={d} ruta={ruta} destino={destino} foco={foco} recorrer={recorrer} setRecorrer={setRecorrer} onFinRecorrer={() => setRecorrer(false)} /></Suspense>}

      {/* columna izquierda: marca, búsqueda y ruta */}
      {admin && (
        <PanelAdmin d={d} cambios={cambios} onCambiar={onCambiar} onRestablecer={onRestablecer} pickId={pickId} onPedirPunto={setPickId} onSalir={() => { setAdmin(false); setPickId(null) }} />
      )}

      {!buscando && !admin && (
        <div className="pb-col">
          <div className="barra">
            <div className="barra-fila">
              <div className="barra-logo" aria-label="SOLCA Quito"><b>SOLCA</b><small>Quito</small></div>
              <button className="barra-buscar" onClick={() => setBuscando({ modo: 'destino' })}>
                <Icono nombre="buscar" size={18} />
                <span>{destino ? destino.nombre : '¿A dónde quieres ir?'}</span>
              </button>
            </div>
            <BarraFoco items={CHIPS_FOCO} activo={destino ? chipDe(destino.cat) : null} onElegir={(c) => setBuscando({ modo: 'destino', cat: c.cat })} />
          </div>

          {destino && (
            <Hoja clase="pb-ruta" resumen={ruta ? `${Math.round(ruta.metros)} m · ${minutos} min` : destino.nombre}>
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
                    <button className="btn-negro btn-recorrer" onClick={() => setRecorrer((r) => !r)}>
                      <Icono nombre={recorrer ? 'cerrar' : 'caminar'} size={16} color="#fff" />{recorrer ? 'Detener recorrido' : `Recorrer en ${modo === '2d' ? '2D' : '3D'}`}
                    </button>
                    <button className="btn-claro" onClick={() => setModo(modo === '2d' ? '3d' : '2d')}>{modo === '2d' ? 'Ver en 3D' : 'Ver en 2D'}</button>
                    {!INSERTADO && <button className="btn-claro" onClick={() => setQr(true)}>QR</button>}
                    <button className="btn-claro" onClick={() => setDestino(null)} aria-label="Cerrar ruta">Cerrar</button>
                  </div>
                </>
              ) : origen?.id === destino.id ? <p className="ruta-nota">Ya estás en ese lugar.</p>
                : alternativa ? (
                  <div className="ruta-alt">
                    <p className="ruta-nota">Desde {origen?.nombre} no hay un camino por pasillos abiertos. Desde <b>{alternativa.nombre}</b> sí lo hay.</p>
                    <button className="btn-negro" onClick={() => setOrigen(alternativa)}>Partir desde {alternativa.nombre}</button>
                  </div>
                ) : <p className="ruta-nota">No hay un camino por pasillos abiertos hasta ese lugar. Pregunta en Información.</p>}
            </Hoja>
          )}
        </div>
      )}

      {buscando && (
        <Buscador lugares={lugares} modo={buscando.modo} cat={buscando.cat} onCerrar={() => setBuscando(null)}
          onElegir={(l) => { if (buscando.modo === 'origen') { setOrigen(l); setBuscando(null) } else irA(l) }} />
      )}

      {/* ficha al tocar un ambiente */}
      {ficha && !buscando && (
        <Hoja clase="pb-ficha" resumen={ficha.nombre} arrastrable={false}>
          <div className="pb-ficha-cab">
            <Insignia icono={ficha.icono} color={colorDe(ficha)} size={40} />
            <div><small>{ficha.entrada ? 'Entrada del edificio' : `${CATS[ficha.cat]?.nombre || ''}${ficha.area ? ` · ${ficha.area.toFixed(0)} m²` : ''}`}{ficha.cerca ? ` · junto a ${ficha.cerca}` : ''}</small>
              {!alcanzable(ficha) && <small className="ficha-aviso">Sin camino por pasillos abiertos en el plano</small>}</div>
            <button className="icono-btn mini" onClick={() => setFicha(null)} aria-label="Cerrar"><Icono nombre="cerrar" size={16} /></button>
          </div>
          <div className="acciones">
            <button className="btn-negro" onClick={() => irA(ficha)}>Cómo llegar</button>
            <button className="btn-claro" onClick={() => { setOrigen(ficha); setFicha(null) }}>Estoy aquí</button>
          </div>
        </Hoja>
      )}

      {/* columna derecha: 2D / 3D, zoom y leyenda */}
      <div className="pb-der">
        <div className="pb-seg pb-modo" role="tablist" aria-label="Vista">
          <button role="tab" aria-selected={modo === '2d'} onClick={() => setModo('2d')}>2D</button>
          <button role="tab" aria-selected={modo === '3d'} onClick={() => setModo('3d')}>3D</button>
        </div>
        <Dock items={[
          { id: 'mas', icono: 'mas', titulo: 'Acercar', onClick: () => vista()?.acercar() },
          { id: 'menos', icono: 'menos', titulo: 'Alejar', onClick: () => vista()?.alejar() },
          { id: 'centrar', icono: 'centrar', titulo: 'Centrar el edificio', onClick: () => vista()?.centrar() },
          { id: 'piso', texto: 'PB', titulo: 'Planta baja' },
          { id: 'leyenda', icono: 'mapa', titulo: 'Leyenda', on: leyenda, onClick: () => setLeyenda((v) => !v) },
          ...(INSERTADO ? [] : [{ id: 'admin', icono: 'ajustes', titulo: admin ? 'Salir de administración' : 'Administración', on: admin, onClick: () => (admin ? setAdmin(false) : setPedirClave(true)) }]),
        ]} />
        {leyenda && (
          <ul className="pb-leyenda">
            {[['consulta', 'consulta'], ['espera', 'silla'], ['banos', 'bano'], ['farmacia', 'farmacia'], ['administracion', 'administracion'], ['circulacion', 'piso'], ['escaleras', 'escalera'], ['apoyo', 'servicios']].map(([k, ic]) => (
              <li key={k}><Insignia icono={ic} color={CATS[k].acento} size={24} />{CATS[k].nombre}</li>
            ))}
          </ul>
        )}
      </div>

      {pedirClave && <Clave onOk={() => { setAdmin(true); setPedirClave(false) }} onCerrar={() => setPedirClave(false)} />}
      {qr && origen && <QR lugar={origen} onCerrar={() => setQr(false)} />}
      {!INSERTADO && <a className="pb-proto" href={`${import.meta.env.BASE_URL}prototipo/`}>Prototipo anterior (5 pisos)</a>}
    </div>
  )
}

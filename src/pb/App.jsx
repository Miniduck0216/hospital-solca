import { useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react'
import QRCode from 'qrcode'
import { cargarDatos, cambiosDelPiso, usarGeo, CATS, ICONO_LUGAR, plano, dentro } from './datos.js'
import { buscarRuta, indicaciones, metrosHasta } from './ruta.js'
import { rutaEdificio } from './rutaEdificio.js'
import { Mapa } from './Mapa.jsx'
import { Hoja } from './Hoja.jsx'
import { Clave, PanelAdmin } from './Admin.jsx'
import { Cargando } from './Cargando.jsx'
import { BarraFoco, Dock } from './Hud.jsx'
import { Icono, Insignia } from '../ui/mapa2d/Iconos.jsx'

const Vista3D = lazy(() => import('./Vista3D.jsx').then((m) => ({ default: m.Vista3D })))

// cambios del administrador guardados en este navegador (se suman a los publicados en el repositorio)
const CLAVE_LOCAL = 'solca-admin-cambios'
// formato 2 de cambios (por piso). El formato 1 ({ ambientes }) del primer administrador era de la planta baja.
export function aFormato2(c) {
  if (!c || typeof c !== 'object') return { version: 2, pisos: {} }
  if (c.pisos) return { version: 2, pisos: c.pisos }
  return { version: 2, pisos: c.ambientes ? { PB: { ambientes: c.ambientes } } : {} }
}
function leerCambios() {
  try { return aFormato2(JSON.parse(localStorage.getItem(CLAVE_LOCAL))) } catch { return aFormato2(null) }
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

// id de un lugar en todo el edificio: los de la planta baja quedan igual (a47, entrada-puerta-1: los usa OM3);
// los de otros pisos llevan el piso adelante (P1:a12)
export const idGlobal = (piso, id) => (piso === 'PB' ? id : `${piso}:${id}`)

// lugares: ambientes con nombre y destino alcanzable, más las entradas del edificio
function armarLugares(d) {
  const piso = d.piso?.id || 'PB'
  return armarLugaresPiso(d).map((l) => ({ ...l, local: l.id, id: idGlobal(piso, l.id), piso, pisoCorto: d.piso?.corto || piso }))
}
function armarLugaresPiso(d) {
  const zonas = d.ambientes.filter((a) => a.nombre && (a.cat === 'circulacion' || a.cat === 'espera') && a.area > 30)
  const lugares = []
  for (const a of d.ambientes) {
    if (!a.nombre || !a.dest || a.personal) continue
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
              <span><b>{l.nombre}</b><small>{l.entrada ? `Entrada del edificio${l.piso !== 'PB' ? ` · ${l.pisoCorto}` : ''}` : [l.pisoCorto, CATS[l.cat]?.nombre, l.cerca && `junto a ${l.cerca}`].filter(Boolean).join(' · ')}</small></span>
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
        <p>{lugar.pisoNombre || 'Planta baja'} · Hospital SOLCA Quito</p>
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
const INSERTADO = ['totem', 'guia', 'admin'].includes(PARAMS.get('modo')) ? PARAMS.get('modo') : null
// editor dentro de OM3 (?modo=admin&padre=<origen de OM3>): sin clave (OM3 ya validó el permiso «Mapa del hospital»);
// el borrador llega y se devuelve por postMessage, solo con esa ventana padre
const URL_OK = (u) => { try { const x = new URL(u); return x.protocol === 'https:' || x.protocol === 'http:' ? x : null } catch { return null } }
const PADRE = INSERTADO === 'admin' ? URL_OK(PARAMS.get('padre') || '')?.origin || null : null
const MODO_ADMIN = !!PADRE
// cambios publicados en OM3 (?config=<url pública>); si no, los del repositorio
const CONFIG_URL = URL_OK(PARAMS.get('config') || '')?.href || null
// preferencias de ruta: ?via=ascensor|escalera|cualquiera (entre pisos) y ?accesible=1 (sin escalones)
const VIA_INICIAL = ['ascensor', 'escalera', 'cualquiera'].includes(PARAMS.get('via')) ? PARAMS.get('via') : 'ascensor'
const ACCESIBLE_INICIAL = PARAMS.get('accesible') === '1'
const VISTA_INICIAL = PARAMS.get('vista') === '3d' ? '3d' : '2d'
// piso a la vista al abrir: el del origen del enlace (?origen=P1:a12) o ?piso=P1; si no, el inicial del edificio
const PISO_INICIAL = (PARAMS.get('origen') || '').match(/^(SB|P\d):/)?.[1] || PARAMS.get('piso') || null

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
  const [admin, setAdmin] = useState(MODO_ADMIN)
  const [pedirClave, setPedirClave] = useState(false)
  const [cambios, setCambios] = useState(() => (MODO_ADMIN ? aFormato2(null) : leerCambios()))
  // selección en el plano del administrador: { tipo: 'dest', id } | { tipo: 'lugar', datos } | { tipo: 'trazo', paso, puntos }
  const [pick, setPick] = useState(null)
  const [pisoId, setPisoId] = useState(null)
  const [pisos, setPisos] = useState({})   // datos de cada piso ya cargado: { PB: d, P1: d, … }
  const [pisosAbierto, setPisosAbierto] = useState(false)
  const [accesible, setAccesible] = useState(ACCESIBLE_INICIAL)
  const [via, setVia] = useState(VIA_INICIAL)   // ascensor (por defecto) o escaleras, en rutas entre pisos
  const [recorrer, setRecorrer] = useState(false)   // el personaje camina la ruta (en 2D o en 3D, según la vista)
  const mapa = useRef(null)
  const vista3d = useRef(null)
  // zoom con botones en 2D y 3D: el tótem es táctil y no tiene rueda de ratón
  const vista = () => (modo === '2d' ? mapa.current : vista3d.current)

  // carga (o recarga, tras un cambio del administrador) un piso; `ver` lo deja como el piso a la vista
  const cargarPiso = (c, piso, ver = true) =>
    cargarDatos(c, { pisoId: piso || undefined, cambiosUrl: CONFIG_URL, sinPublicados: MODO_ADMIN })
      .then((datos) => {
        usarGeo(datos.geo)
        setPisos((ps) => ({ ...ps, [datos.piso.id]: datos }))
        if (ver) { setD(datos); setPisoId(datos.piso.id) }
        return datos
      })
  const cargar = (c, piso = pisoId) => cargarPiso(c, piso, true)
  useEffect(() => {
    const pedido = PISO_INICIAL
    cargar(cambios, pedido).catch(() => (pedido ? cargar(cambios, null) : Promise.reject(new Error('sin plano'))))
      .then((datos) => {
        // los demás pisos se cargan después, sin apuro: hacen falta para buscar en todo el edificio y trazar entre pisos
        if (!datos || MODO_ADMIN) return
        const otros = (datos.edificio?.pisos || []).filter((p) => p.disponible && p.id !== datos.piso.id)
        return otros.reduce((pr, p) => pr.then(() => cargarPiso(cambios, p.id, false).catch(() => null)), Promise.resolve())
      })
      .catch((e) => setError(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // editor en OM3: OM3 manda el borrador (estado completo) y recibe cada cambio
  useEffect(() => {
    if (!MODO_ADMIN) return
    const alRecibir = (e) => {
      if (e.origin !== PADRE || e.source !== window.parent || !e.data || e.data.tipo !== 'mapa-borrador') return
      const c = aFormato2(e.data.cambios)
      setCambios(c)
      cargar(c).catch((err) => setError(err.message))
    }
    window.addEventListener('message', alRecibir)
    window.parent.postMessage({ tipo: 'mapa-listo' }, PADRE)
    return () => window.removeEventListener('message', alRecibir)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // guarda (navegador u OM3) y recalcula el plano con los cambios del piso actual
  const guardar = (nuevo) => {
    setCambios(nuevo)
    if (MODO_ADMIN) window.parent.postMessage({ tipo: 'mapa-cambios', cambios: nuevo }, PADRE)
    else { try { localStorage.setItem(CLAVE_LOCAL, JSON.stringify(nuevo)) } catch { /* sin almacenamiento: solo en esta sesión */ } }
    cargar(nuevo)
  }
  const cambiosPiso = cambiosDelPiso(cambios, pisoId) || {}
  const conPiso = (fn) => guardar({ version: 2, pisos: { ...cambios.pisos, [pisoId]: fn({ ambientes: {}, lugares: [], pasos: [], ...cambiosPiso }) } })
  const onCambiar = (id, patch) => conPiso((cp) => ({ ...cp, ambientes: { ...cp.ambientes, [id]: { ...(cp.ambientes[id] || {}), ...patch } } }))
  const onLugar = (l) => conPiso((cp) => ({ ...cp, lugares: [...cp.lugares.filter((x) => x.id !== l.id), l] }))
  const onQuitarLugar = (id) => conPiso((cp) => ({ ...cp, lugares: cp.lugares.filter((x) => x.id !== id) }))
  const onPaso = (p) => conPiso((cp) => ({ ...cp, pasos: [...cp.pasos, p] }))
  const onQuitarPaso = (i) => conPiso((cp) => ({ ...cp, pasos: cp.pasos.filter((_, k) => k !== i) }))
  const onRestablecer = () => {
    // en OM3 se vuelve a lo guardado allá (OM3 responde con mapa-borrador); fuera, se borra todo lo local
    if (MODO_ADMIN) { setPick(null); window.parent.postMessage({ tipo: 'mapa-descartar' }, PADRE); return }
    try { localStorage.removeItem(CLAVE_LOCAL) } catch { /* nada que borrar */ }
    guardar(aFormato2(null))
  }
  const redondo = (v) => Math.round(v * 100) / 100
  const onPick = (x, y) => {
    if (!pick) return
    if (pick.tipo === 'dest') { onCambiar(pick.id, { dest: [redondo(x), redondo(y)] }); setPick(null) }
    else if (pick.tipo === 'lugar') {
      onLugar({ id: `L-${Date.now().toString(36)}`, nombre: pick.datos.nombre, cat: pick.datos.cat, x: redondo(x), y: redondo(y) })
      setPick(null)
    } else if (pick.tipo === 'trazo') setPick({ ...pick, puntos: [...pick.puntos, [redondo(x), redondo(y)]] })
  }
  // ver otro piso: la ruta se conserva (cada piso muestra su tramo)
  const verPiso = (id) => {
    setPisosAbierto(false)
    if (!id || id === pisoId) return
    if (pisos[id]) { setD(pisos[id]); setPisoId(id); setFicha(null); setHover(null) }
    else cargar(cambios, id).catch((e) => setError(e.message))
  }
  const cambiarPiso = (p) => { if (p.disponible) verPiso(p.id) }
  // lugares de todos los pisos cargados (el buscador encuentra servicios de cualquier piso)
  const lugares = useMemo(() => {
    const orden = (d?.edificio?.pisos || []).map((p) => p.id)
    return Object.values(pisos).sort((a, b) => orden.indexOf(a.piso.id) - orden.indexOf(b.piso.id)).flatMap(armarLugares)
  }, [pisos, d])
  // ¿se llega caminando por pasillos abiertos? (si no, la app lo dice en vez de trazar por consultorios)
  const alcanzable = (l) => {
    const dl = pisos[l.piso]
    return !!dl && (l.entrada || !dl.nav.indice[l.local] || dl.nav.alcanzable.has(dl.nav.indice[l.local]))
  }
  const porId = useMemo(() => Object.fromEntries(lugares.map((l) => [l.id, l])), [lugares])

  // origen por defecto (Puerta 1) o el del enlace / QR (?origen=…&destino=…)
  // (los pisos se cargan de a uno: el lugar del enlace se aplica una sola vez, cuando aparece su piso)
  const delEnlace = useRef({ origen: PARAMS.get('origen'), destino: PARAMS.get('destino') })
  useEffect(() => {
    if (!lugares.length) return
    const e = delEnlace.current
    const disponibles = (d?.edificio?.pisos || []).filter((p) => p.disponible).length
    const todos = Object.keys(pisos).length >= disponibles
    if (e.origen && porId[e.origen]) { setOrigen(porId[e.origen]); e.origen = null }
    else if (!e.origen || todos) {
      // sin origen en el enlace (o uno que no existe): la Puerta 1, cuando ya cargó la planta baja
      const p1 = lugares.find((l) => l.id === 'entrada-puerta-1') || (todos ? lugares.find((l) => l.entrada) : null)
      setOrigen((o) => o || p1 || null)
      if (todos) e.origen = null
    }
    if (e.destino && porId[e.destino]) { setDestino(porId[e.destino]); e.destino = null }
  }, [lugares, porId, pisos, d])

  useEffect(() => setRecorrer(false), [origen, destino])
  // ruta completa (puede tener tramos en dos pisos): { tramos: [{ piso, pts, metros, pasos }], metros, vertical, alternativa }
  const ruta = useMemo(() => {
    if (!origen || !destino || origen.id === destino.id) return null
    const dO = pisos[origen.piso], dD = pisos[destino.piso]
    if (!dO || !dD) return null
    const opts = { admin, accesible }
    const buscar = (dd, a, b, ids, o) => buscarRuta(dd, a, b, ids, { ...opts, ...o })
    const r = rutaEdificio({
      edificio: dO.edificio, pisos, via, accesible, admin, buscar, medir: (dd, a, id, obj, o) => metrosHasta(dd, a, id, obj, { ...opts, ...o }),
      origen: { piso: origen.piso, punto: [origen.x, origen.y], id: origen.local },
      destino: { piso: destino.piso, punto: [destino.x, destino.y], id: destino.local },
    })
    if (!r || !r.tramos.length) return r?.aviso ? { sinRuta: true, aviso: r.aviso } : null
    const conector = r.vertical?.conector
    const n = r.tramos.length
    const tramos = r.tramos.map((t, k) => {
      const dd = pisos[t.piso]
      const desde = k === 0 ? origen : { id: '', nombre: conector?.nombre || 'el ascensor' }
      const hasta = k === n - 1 ? destino : { id: '', nombre: conector?.nombre || 'el ascensor' }
      const pasos = indicaciones(dd, t, desde, hasta)
      if (k < n - 1) pasos[pasos.length - 1] = { tipo: 'fin', texto: `Llega a ${conector?.nombre || 'los ascensores'}` }
      return { ...t, pasos, nombrePiso: dd.piso?.nombre }
    })
    return { ...r, tramos }
  }, [pisos, origen, destino, admin, accesible, via])
  const rutaOk = ruta && !ruta.sinRuta ? ruta : null
  // tramo del piso a la vista (lo que dibujan el 2D y el 3D)
  const tramo = rutaOk ? rutaOk.tramos.find((t) => t.piso === pisoId) || null : null
  // al trazar una ruta nueva, la vista va al piso donde empieza
  const claveRuta = rutaOk ? `${origen?.id}>${destino?.id}>${rutaOk.vertical?.conector?.id || ''}` : ''
  useEffect(() => {
    if (rutaOk && origen && origen.piso !== pisoId) verPiso(origen.piso)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveRuta])

  // si desde el origen no hay camino, ¿desde otra entrada del edificio sí? (la app lo ofrece en vez de solo decir que no)
  const alternativa = useMemo(() => {
    if (!origen || !destino || origen.id === destino.id || rutaOk || origen.piso !== destino.piso) return null
    const dd = pisos[destino.piso]
    if (!dd) return null
    for (const e of dd.entradas) {
      const g = idGlobal(destino.piso, e.id)
      if (g === origen.id) continue
      if (buscarRuta(dd, [e.x, e.y], [destino.x, destino.y], [e.id, destino.local], { admin, accesible })) return porId[g] || null
    }
    return null
  }, [pisos, origen, destino, admin, accesible, rutaOk, porId])

  // el enlace refleja el origen y el destino (para compartir)
  useEffect(() => {
    if (!origen) return
    const p = new URLSearchParams()
    // el modo y las opciones de inserción se conservan al cambiar origen o destino
    for (const k of ['modo', 'padre', 'config']) if (PARAMS.get(k)) p.set(k, PARAMS.get(k))
    if (via !== 'ascensor') p.set('via', via)
    if (accesible) p.set('accesible', '1')
    p.set('origen', origen.id)
    if (destino) p.set('destino', destino.id)
    history.replaceState(null, '', `${location.pathname}?${p}`)
  }, [origen, destino, accesible, via])

  const lugaresIcono = useMemo(() => lugares.filter((l) => l.piso === pisoId).filter((l) => l.entrada || ['banos', 'escaleras', 'ascensores', 'farmacia'].includes(l.cat) || ['caja', 'info', 'capilla'].includes(l.icono))
    .map((l) => ({ ...l, id: l.local, x: l.entrada ? l.x : l.lbl[0], y: l.entrada ? l.y : l.lbl[1], color: l.entrada ? TINTA : '#FFFFFF' })), [lugares, pisoId])

  const elegirDesdeMapa = (id) => {
    const l = porId[idGlobal(pisoId, id)]
    if (!l) { setFicha(null); return }
    setFicha(l)
  }
  const irA = (l) => {
    setDestino(l); setFicha(null); setBuscando(null)
    // en el mismo piso la vista llega al destino; en otro piso, la ruta empieza en el piso del origen
    if (!origen || l.piso === origen.piso) { if (l.piso !== pisoId) verPiso(l.piso); setFoco({ ...l, id: l.local, t: Date.now() }) }
  }

  if (error) return <div className="pb-error">No se pudo cargar el plano: {error}</div>
  if (!d) return <Cargando texto="Cargando el plano del hospital…" />

  const minutos = rutaOk ? Math.max(1, Math.round((rutaOk.segundos || rutaOk.metros / 1.2) / 60)) : 0
  // lo que se dibuja en este piso: el tramo, y el origen y el destino con su id local (si están en este piso)
  const local = (l) => (l && l.piso === pisoId ? { ...l, id: l.local } : null)
  const destinoVista = local(destino)
  const focoVista = foco && foco.piso === pisoId ? foco : null

  return (
    <div className={`pb-app modo-${modo}${INSERTADO ? ` insertado-${INSERTADO}` : ''}`}>
      {modo === '2d'
        ? <Mapa ref={mapa} d={d} ruta={tramo} origen={local(origen)} destino={destinoVista} foco={focoVista} hover={hover} onElegir={elegirDesdeMapa} onHover={setHover} lugaresIcono={lugaresIcono} pick={!!pick} onPick={onPick} trazo={pick?.tipo === 'trazo' ? { tipo: pick.paso, puntos: pick.puntos } : null} recorrer={recorrer} onFinRecorrer={() => setRecorrer(false)} />
        : <Suspense fallback={<Cargando texto="Preparando el 3D…" />}><Vista3D key={pisoId} ref={vista3d} d={d} ruta={tramo} destino={destinoVista} foco={focoVista} recorrer={recorrer} setRecorrer={setRecorrer} onFinRecorrer={() => setRecorrer(false)} /></Suspense>}

      {/* columna izquierda: marca, búsqueda y ruta */}
      {admin && (
        <PanelAdmin d={d} cambios={cambiosPiso} onCambiar={onCambiar} onLugar={onLugar} onQuitarLugar={onQuitarLugar} onPaso={onPaso} onQuitarPaso={onQuitarPaso}
          onRestablecer={onRestablecer} pick={pick} onPick={setPick} enOm3={MODO_ADMIN}
          onSalir={MODO_ADMIN ? () => window.parent.postMessage({ tipo: 'mapa-salir' }, PADRE) : () => { setAdmin(false); setPick(null) }} />
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
            <Hoja clase="pb-ruta" resumen={rutaOk ? `${Math.round(rutaOk.metros)} m · ${minutos} min` : destino.nombre}>
              <div className="campos">
                <Campo tipo="origen" lugar={origen} onClick={() => setBuscando({ modo: 'origen' })} />
                <Campo tipo="destino" lugar={destino} onClick={() => setBuscando({ modo: 'destino' })} />
                <span className="campos-guia" aria-hidden="true" />
                <button className="icono-btn intercambiar" aria-label="Intercambiar origen y destino" onClick={() => { const o = origen; setOrigen(destino); setDestino(o) }}><Icono nombre="intercambiar" size={17} /></button>
              </div>
              {rutaOk ? (
                <>
                  <div className="ruta-datos">
                    <span><Icono nombre="caminar" size={15} /> {Math.round(rutaOk.metros)} m</span>
                    <span><Icono nombre="reloj" size={15} /> {minutos} min</span>
                    <span><Icono nombre="piso" size={15} /> {rutaOk.tramos.map((t) => pisos[t.piso]?.piso?.corto || t.piso).join(' → ')}</span>
                  </div>
                  {rutaOk.vertical && !accesible && (
                    <div className="pb-seg pb-via" role="radiogroup" aria-label="Cambiar de piso por">
                      {[['ascensor', 'Ascensor', 'ascensor'], ['escalera', 'Escaleras', 'escalera']].map(([k, t, ic]) => (
                        <button key={k} role="radio" aria-checked={rutaOk.vertical.tipo === k} onClick={() => setVia(k)}><Icono nombre={ic} size={15} /> {t}</button>
                      ))}
                    </div>
                  )}
                  {rutaOk.aviso && <p className="ruta-nota">{rutaOk.aviso}</p>}
                  <label className="pb-check pb-accesible">
                    <input type="checkbox" checked={accesible} onChange={(e) => setAccesible(e.target.checked)} />
                    <Icono nombre="accesible" size={16} /> Ruta accesible (sin escalones)
                  </label>
                  <ol className="pb-pasos">
                    {rutaOk.tramos.map((t, k) => [
                      rutaOk.tramos.length > 1 && (
                        <li key={`p${k}`} className={`paso-piso${t.piso === pisoId ? ' on' : ''}`}>
                          <button className="btn-claro mini" onClick={() => verPiso(t.piso)} aria-pressed={t.piso === pisoId}>
                            <Icono nombre="piso" size={14} /> {t.nombrePiso}{t.piso === pisoId ? ' · a la vista' : ' · ver'}
                          </button>
                        </li>
                      ),
                      ...t.pasos.filter((p, i) => !(k > 0 && i === 0)).map((p, i) => (
                        <li key={`${k}-${i}`} className={`paso-${p.tipo}`}>
                          <span className="pb-paso-i"><Icono nombre={ICONO_PASO[p.tipo]} size={15} /></span>{p.texto}
                        </li>
                      )),
                      k === 0 && rutaOk.vertical && (
                        <li key="vertical" className="paso-vertical">
                          <span className="pb-paso-i"><Icono nombre={rutaOk.vertical.tipo === 'ascensor' ? 'ascensor' : 'escalera'} size={15} /></span>{rutaOk.vertical.texto}
                        </li>
                      ),
                    ])}
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
                : !pisos[destino.piso] || !pisos[origen?.piso] ? <p className="ruta-nota">Cargando el plano del otro piso…</p>
                : ruta?.aviso ? <p className="ruta-nota">{ruta.aviso}</p>
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
            <div><small>{ficha.entrada ? 'Entrada del edificio' : `${ficha.pisoCorto} · ${CATS[ficha.cat]?.nombre || ''}${ficha.area ? ` · ${ficha.area.toFixed(0)} m²` : ''}`}{ficha.cerca ? ` · junto a ${ficha.cerca}` : ''}</small>
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
          { id: 'piso', texto: d.piso?.corto || 'PB', titulo: 'Cambiar de piso', on: pisosAbierto, onClick: () => setPisosAbierto((v) => !v) },
          { id: 'leyenda', icono: 'mapa', titulo: 'Leyenda', on: leyenda, onClick: () => setLeyenda((v) => !v) },
          ...(INSERTADO ? [] : [{ id: 'admin', icono: 'ajustes', titulo: admin ? 'Salir de administración' : 'Administración', on: admin, onClick: () => (admin ? setAdmin(false) : setPedirClave(true)) }]),
        ]} />
        {pisosAbierto && (
          <ul className="pb-leyenda pb-pisos" aria-label="Pisos">
            {[...(d.edificio?.pisos || [])].sort((a, b) => b.nivel - a.nivel).map((p) => (
              <li key={p.id}>
                <button className={p.id === pisoId ? 'on' : ''} disabled={!p.disponible} onClick={() => cambiarPiso(p)}>
                  <b>{p.corto}</b> {p.nombre}{!p.disponible && <small>plano pendiente</small>}
                </button>
              </li>
            ))}
          </ul>
        )}
        {leyenda && (
          <ul className="pb-leyenda">
            {[['consulta', 'consulta'], ['espera', 'silla'], ['banos', 'bano'], ['farmacia', 'farmacia'], ['administracion', 'administracion'], ['circulacion', 'piso'], ['escaleras', 'escalera'], ['apoyo', 'servicios']].map(([k, ic]) => (
              <li key={k}><Insignia icono={ic} color={CATS[k].acento} size={24} />{CATS[k].nombre}</li>
            ))}
          </ul>
        )}
      </div>

      {pedirClave && <Clave onOk={() => { setAdmin(true); setPedirClave(false) }} onCerrar={() => setPedirClave(false)} />}
      {qr && origen && <QR lugar={{ ...origen, pisoNombre: pisos[origen.piso]?.piso?.nombre }} onCerrar={() => setQr(false)} />}
      {!INSERTADO && <a className="pb-proto" href={`${import.meta.env.BASE_URL}prototipo/`}>Prototipo anterior (5 pisos)</a>}
    </div>
  )
}

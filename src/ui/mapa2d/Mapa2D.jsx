import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { H, cuartoEn, tipoArista } from '../../lib/datos.js'
import { LUGARES, catById, NOMBRES_PISO } from '../../lib/lugares.js'
import { InsigniaSVG, Icono } from './Iconos.jsx'

const D = H.largo
const sy = (y) => D - y            // plano (y hacia el norte) → SVG (y hacia abajo)
const MARCO = { x: -20, y: -6, w: H.ancho + 28, h: D + 22 }
const poli = (pts) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)} ${sy(y).toFixed(2)}`).join(' ') + 'Z'
const SITIO = H.sitio || null

const TINTE = {
  emergencia: '#FBE7E4', consulta: '#E7EEFD', diagnostico: '#EFE9FB', tratamiento: '#FCF0DF', hospitalizacion: '#E3F3E8',
  servicios: '#EDF0F3', administracion: '#F8E7F0', circulacion: '#EDF0F3',
}
const tinte = (c) => (c.tipo === 'pasillo' ? '#FFFFFF' : /^ban/.test(c.tipo) ? '#E1F1F7' : TINTE[c.cat] || '#EDF0F3')
const BANOS = new Set(['banos_h', 'banos_m', 'bano_acc', 'bano_hab'])
const SOLO_ICONO = (l) => ['banos', 'circulacion', 'salidas'].includes(l.cat)

function partir(nombre) {
  if (nombre.length <= 14) return [nombre]
  const p = nombre.split(' ')
  let mejor = [nombre], dif = 1e9
  for (let i = 1; i < p.length; i++) {
    const a = p.slice(0, i).join(' '), b = p.slice(i).join(' ')
    if (Math.abs(a.length - b.length) < dif) { dif = Math.abs(a.length - b.length); mejor = [a, b] }
  }
  return mejor
}

export function Mapa2D({ piso, plan, origen, destino, onElegirCuarto, onCambiarPiso, encuadre, animarRuta }) {
  const ref = useRef(null)
  const [tam, setTam] = useState({ w: 800, h: 600 })
  const [vista, setVista] = useState(MARCO)
  const gesto = useRef({ punteros: new Map(), movido: false })

  // tamaño del contenedor
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setTam({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])

  // ajusta el encuadre pedido (todo el piso o la ruta) a la proporción del contenedor
  // encaja el rectángulo pedido en el área libre (descontando las tarjetas flotantes)
  const ajustar = useCallback((b) => {
    const movil = tam.w < 700
    const m = movil ? { l: 8, t: 175, r: 62, b: plan ? tam.h * 0.36 : 8 } : { l: tam.w > 1000 ? 400 : 330, t: 16, r: 76, b: 16 }
    const aw = Math.max(80, tam.w - m.l - m.r), ah = Math.max(80, tam.h - m.t - m.b)
    const kk = Math.max(b.w / aw, b.h / ah)
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2
    setVista({ x: cx - (m.l + aw / 2) * kk, y: cy - (m.t + ah / 2) * kk, w: tam.w * kk, h: tam.h * kk })
  }, [tam.w, tam.h, !!plan])
  useEffect(() => {
    if (encuadre) return ajustar(encuadre)
    if (tam.w < 700 && origen && origen.piso === piso) return ajustar({ x: origen.x - 13, y: sy(origen.y) - 14, w: 26, h: 20 })
    ajustar(MARCO)
  }, [encuadre, ajustar])

  const k = vista.w / Math.max(1, tam.w)          // metros por píxel
  const aPlano = (cx, cy) => {
    const r = ref.current.getBoundingClientRect()
    return { x: vista.x + ((cx - r.left) / r.width) * vista.w, Y: vista.y + ((cy - r.top) / r.height) * vista.h }
  }
  const zoom = (f, cx, cy) => setVista((v) => {
    const w = Math.min(MARCO.w * 2.2, Math.max(6, v.w * f)); const real = w / v.w
    const r = ref.current.getBoundingClientRect()
    const px = cx === undefined ? 0.5 : (cx - r.left) / r.width, py = cy === undefined ? 0.5 : (cy - r.top) / r.height
    return { x: v.x + v.w * px * (1 - real), y: v.y + v.h * py * (1 - real), w, h: v.h * real }
  })
  useEffect(() => {
    const el = ref.current
    const rueda = (e) => { e.preventDefault(); zoom(Math.exp(e.deltaY * 0.0015), e.clientX, e.clientY) }
    el.addEventListener('wheel', rueda, { passive: false })
    return () => el.removeEventListener('wheel', rueda)
  })

  const abajo = (e) => {
    gesto.current.punteros.set(e.pointerId, { x: e.clientX, y: e.clientY })
    gesto.current.movido = false
  }
  const mover = (e) => {
    const g = gesto.current
    const prev = g.punteros.get(e.pointerId)
    if (!prev) return
    const r = ref.current.getBoundingClientRect()
    if (g.punteros.size === 2) {
      const [a, b] = [...g.punteros.values()]
      const otro = [...g.punteros.entries()].find(([id]) => id !== e.pointerId)[1]
      const d0 = Math.hypot(a.x - b.x, a.y - b.y), d1 = Math.hypot(e.clientX - otro.x, e.clientY - otro.y)
      if (d0 > 0) zoom(d0 / d1, (e.clientX + otro.x) / 2, (e.clientY + otro.y) / 2)
      g.movido = true
    } else {
      const dx = e.clientX - prev.x, dy = e.clientY - prev.y
      if (!g.movido && Math.abs(dx) + Math.abs(dy) > 3) { g.movido = true; try { ref.current.setPointerCapture(e.pointerId) } catch { /* sin captura */ } }
      if (g.movido) setVista((v) => ({ ...v, x: v.x - (dx / r.width) * v.w, y: v.y - (dy / r.height) * v.h }))
    }
    g.punteros.set(e.pointerId, { x: e.clientX, y: e.clientY })
  }
  const arriba = (e) => {
    const g = gesto.current
    g.punteros.delete(e.pointerId)
    if (!g.movido && g.punteros.size === 0) {
      const p = aPlano(e.clientX, e.clientY)
      const c = cuartoEn(piso, p.x, sy(p.Y))
      onElegirCuarto(c && c.tipo !== 'pasillo' ? c : null, { x: e.clientX, y: e.clientY })
    }
  }

  // ---------- geometría del piso
  const geo = useMemo(() => {
    const cuartos = H.cuartos.filter((c) => c.piso === piso && c.tipo !== 'exterior')
    const muros = H.piezas.filter((p) => p.piso === piso && p.h0 === 0)
    const ventanas = H.ventanas.filter((v) => v.piso === piso)
    const ancho = {}
    for (const c of cuartos) {
      const a = ancho[c.dep] || [1e9, -1e9]
      ancho[c.dep] = [Math.min(a[0], c.x0), Math.max(a[1], c.x1)]
    }
    const lugares = LUGARES.filter((l) => l.piso === piso).map((l) => ({ ...l, ancho: l.dep && ancho[l.dep] ? ancho[l.dep][1] - ancho[l.dep][0] : 0 }))
    return { cuartos, muros, ventanas, lugares }
  }, [piso])

  // ---------- ruta: tramos de este piso y cambios de piso
  const ruta = useMemo(() => {
    if (!plan) return null
    const P = plan.puntos
    const tramos = []; let actual = []
    const cambios = []
    for (let i = 0; i < P.length; i++) {
      const p = P[i]
      if (p.piso === piso) {
        const vertical = i > 0 && P[i - 1].id && p.id && tipoArista(P[i - 1].id, p.id) === 'ascensor'
        if (vertical && actual.length) { tramos.push(actual); actual = [] }
        actual.push(p)
      } else if (actual.length) { tramos.push(actual); actual = [] }
      const sig = P[i + 1], ant = P[i - 1]
      const vert = (u, v) => (u.id && v.id ? tipoArista(u.id, v.id) : 'caminar')
      const dePaso = ant && sig && ant.piso !== piso && sig.piso !== piso     // piso intermedio del ascensor
      if (sig && p.piso === piso && sig.piso !== piso && !dePaso) {
        let j = i + 1
        while (j + 1 < P.length && vert(P[j], P[j + 1]) === 'ascensor') j++
        const hacia = P[j].piso
        cambios.push({ x: p.x, y: p.y, hacia, medio: vert(p, sig) === 'ascensor' ? 'ascensor' : 'escalera', sube: hacia > piso, sale: true })
      }
      if (ant && p.piso === piso && ant.piso !== piso && !dePaso) {
        let j = i - 1
        while (j - 1 >= 0 && vert(P[j - 1], P[j]) === 'ascensor') j--
        cambios.push({ x: p.x, y: p.y, hacia: P[j].piso, medio: vert(ant, p) === 'ascensor' ? 'ascensor' : 'escalera', sale: false })
      }
    }
    if (actual.length) tramos.push(actual)
    const ini = P[0].piso === piso ? P[0] : null
    const fin = P[P.length - 1].piso === piso ? P[P.length - 1] : null
    return { tramos: tramos.filter((t) => t.length > 1), cambios, ini, fin }
  }, [plan, piso])

  const depOrigen = origen?.cuarto?.dep && origen.piso === piso ? origen.cuarto.dep : null
  const depDestino = destino?.cuarto?.dep && destino.piso === piso ? destino.cuarto.dep : null
  const colorDestino = destino ? catById[destino.cat]?.color || '#2F5BEA' : '#2F5BEA'
  const fs = 12 * k
  const detalle = k < 0.035

  return (
    <div className="mapa2d" ref={ref} onPointerDown={abajo} onPointerMove={mover} onPointerUp={arriba} onPointerCancel={arriba}>
      <svg viewBox={`${vista.x} ${vista.y} ${vista.w} ${vista.h}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`Plano de ${NOMBRES_PISO[piso]}`}>
        <defs>
          <filter id="sombra-edificio" x="-5%" y="-5%" width="110%" height="115%"><feDropShadow dx="0" dy="0.35" stdDeviation="0.45" floodColor="#1B2B3C" floodOpacity="0.16" /></filter>
        </defs>
        {/* entorno: lote, calles y parqueos del mapa real */}
        {SITIO && <path d={poli(SITIO.lote)} fill="#E9EEE4" />}
        {SITIO && Object.values(SITIO.parqueos).map((pp, i) => <path key={i} d={poli(pp)} fill="#E1E5EA" />)}
        {SITIO && Object.entries(SITIO.calles).map(([n, c]) => (
          <path key={n} d={poli(c.eje).slice(0, -1)} stroke="#D5DAE0" strokeWidth={c.ancho} fill="none" strokeLinecap="butt" />
        ))}
        {SITIO && k < 0.45 && Object.entries(SITIO.calles).map(([n, c]) => {
          const [[x0, y0], [x1, y1]] = c.eje
          // rótulo a la altura del edificio sobre el eje de la calle
          let t = 0.5, mejor = 1e9
          for (let u = 0; u <= 1; u += 0.02) {
            const x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u
            const d = Math.hypot(x - H.ancho / 2, y - D / 2)
            if (d < mejor) { mejor = d; t = u }
          }
          const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t
          let ang = (Math.atan2(-(y1 - y0), x1 - x0) * 180) / Math.PI
          if (ang > 90) ang -= 180
          if (ang < -90) ang += 180
          return <text key={n + 't'} transform={`translate(${x} ${sy(y)}) rotate(${ang})`} className="txt-calle" fontSize={fs}>{n}</text>
        })}
        {H.cuartos.filter((c) => c.piso === piso && c.tipo === 'exterior').map((c, i) => (
          <rect key={'ext' + i} x={c.x0} y={sy(c.y1)} width={c.x1 - c.x0} height={c.y1 - c.y0} rx={0.6} fill="#E8E3DA" />
        ))}
        {piso > 0 && H.contornos?.[piso - 1] && <path d={poli(H.contornos[piso - 1])} fill="#E3E7EC" stroke="#CDD3DA" strokeWidth={0.3} />}
        {H.contornos?.[piso]
          ? <path d={poli(H.contornos[piso])} fill="#FFFFFF" filter="url(#sombra-edificio)" />
          : <rect x={-0.15} y={sy(D + 0.15)} width={H.ancho + 0.3} height={D + 0.3} rx={0.3} fill="#FFFFFF" filter="url(#sombra-edificio)" />}
        {/* ambientes */}
        {geo.cuartos.map((c, ci) => {
          const activo = (depDestino && c.dep === depDestino && c.tipo !== 'bano_hab') || (depOrigen && c.dep === depOrigen)
          const esDest = depDestino && c.dep === depDestino
          return (
            <rect key={ci} x={c.x0} y={sy(c.y1)} width={c.x1 - c.x0} height={c.y1 - c.y0}
              fill={activo ? (esDest ? colorDestino : '#2F5BEA') : tinte(c)} fillOpacity={activo ? 0.2 : 1}
              className={c.tipo === 'pasillo' ? '' : 'cuarto'} />
          )
        })}
        {/* ventanas y muros */}
        {geo.ventanas.map((v, i) => v.eje === 'h'
          ? <rect key={i} x={v.a} y={sy(v.c) - 0.11} width={v.b - v.a} height={0.22} fill="#BFDDF2" />
          : <rect key={i} x={v.c - 0.11} y={sy(v.b)} width={0.22} height={v.b - v.a} fill="#BFDDF2" />)}
        {geo.muros.map((m, i) => (
          <rect key={i} x={m.x0} y={sy(m.y1)} width={m.x1 - m.x0} height={m.y1 - m.y0} fill={m.ext ? '#7F8A97' : m.h1 <= 2.01 ? '#C4CBD3' : '#9AA4AF'}
            opacity={m.rol === 'bajo' ? 0 : 1} />
        ))}
        {/* números de cuartos (con zoom) */}
        {detalle && geo.cuartos.filter((c) => c.nombre.includes('·') && (c.x1 - c.x0) * (c.y1 - c.y0) > 6).map((c, ci) => (
          <text key={ci + 't'} x={(c.x0 + c.x1) / 2} y={sy((c.y0 + c.y1) / 2)} className="txt-cuarto" fontSize={fs * 0.82}>
            {c.nombre.split('·').pop().trim()}
          </text>
        ))}
        {/* ruta */}
        {ruta && ruta.tramos.map((t, i) => {
          const d = t.map((p, j) => `${j ? 'L' : 'M'}${p.x.toFixed(2)} ${sy(p.y).toFixed(2)}`).join(' ')
          let L = 0
          for (let j = 1; j < t.length; j++) L += Math.hypot(t[j].x - t[j - 1].x, t[j].y - t[j - 1].y)
          return (
            <g key={`${animarRuta}-${i}`}>
              <path d={d} className="ruta-borde" vectorEffect="non-scaling-stroke" />
              <path d={d} className="ruta-linea" vectorEffect="non-scaling-stroke" style={{ '--L': (L / k + 40).toFixed(1) }} />
              <path d={d} className="ruta-flujo" vectorEffect="non-scaling-stroke" />
            </g>
          )
        })}
        {/* lugares */}
        {geo.lugares.map((l) => {
          const cat = catById[l.cat]
          const r = 10.5 * k
          const esDest = destino && destino.nodo === l.nodo
          const corto = l.cat === 'banos' ? l.nombre.replace(/^Baños? /, '').replace(/^./, (c) => c.toUpperCase()) : null
          const lineas = SOLO_ICONO(l) ? [] : partir(l.nombre)
          const conTexto = lineas.length && (detalle || l.ancho > 5 || k < 0.05)
          return (
            <g key={l.id} opacity={destino && !esDest && depDestino ? 0.55 : 1}>
              <InsigniaSVG x={l.x} y={sy(l.y)} r={r} icono={l.icono} color={cat?.color || '#5B6B7C'} activo={esDest} />
              {corto && k < 0.05 && <text x={l.x} y={sy(l.y) + r + fs * 0.95} className="txt-lugar" fontSize={fs * 0.82}>{corto}</text>}
              {conTexto && lineas.map((t, j) => (
                <text key={j} x={l.x} y={sy(l.y) + r + fs * (1.05 + j * 1.1)} className="txt-lugar" fontSize={fs}>{t}</text>
              ))}
            </g>
          )
        })}
        {/* cambios de piso */}
        {ruta && ruta.cambios.map((c, i) => {
          const texto = c.sale ? `${c.sube ? 'Sube' : 'Baja'} a ${NOMBRES_PISO[c.hacia]}` : `Desde ${NOMBRES_PISO[c.hacia]}`
          const w = (texto.length * 6.6 + 34) * k, h = 24 * k
          return (
            <g key={i} transform={`translate(${c.x} ${sy(c.y) - 26 * k})`} className={c.sale ? 'chip-piso activo' : 'chip-piso'}
              onPointerUp={(e) => { if (c.sale) { e.stopPropagation(); onCambiarPiso(c.hacia) } }}>
              <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={h / 2} />
              <g transform={`translate(${-w / 2 + 6 * k} ${-8 * k}) scale(${(16 * k) / 24})`} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d={c.medio === 'ascensor' ? 'M5 3h14v18H5zM9 10.5l3-3 3 3M9 13.5l3 3 3-3' : 'M3.5 20h4.5v-4.5h4.5V11H17V6.5h3.5'} />
              </g>
              <text x={-w / 2 + 26 * k} y={0} fontSize={11 * k} dominantBaseline="central">{texto}</text>
            </g>
          )
        })}
        {/* origen y destino */}
        {ruta?.ini && (
          <g transform={`translate(${ruta.ini.x} ${sy(ruta.ini.y)})`}>
            <circle r={16 * k} className="pulso" />
            <circle r={8 * k} fill="#2F5BEA" stroke="#fff" strokeWidth={3 * k} />
          </g>
        )}
        {!plan && origen && origen.piso === piso && (
          <g transform={`translate(${origen.x} ${sy(origen.y)})`}>
            <circle r={16 * k} className="pulso" />
            <circle r={8 * k} fill="#2F5BEA" stroke="#fff" strokeWidth={3 * k} />
          </g>
        )}
        {ruta?.fin && (
          <g transform={`translate(${ruta.fin.x} ${sy(ruta.fin.y)}) scale(${k})`} className="pin-destino">
            <path d="M0 0c-2-7-12-12-12-21a12 12 0 0 1 24 0c0 9-10 14-12 21z" fill="#14181F" stroke="#fff" strokeWidth="2" />
            <circle cy={-21} r={7} fill={colorDestino} />
          </g>
        )}
      </svg>
      <div className="zoom-ctrl" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
        <button aria-label="Acercar" onClick={() => zoom(0.7)}><Icono nombre="mas" /></button>
        <button aria-label="Alejar" onClick={() => zoom(1.4)}><Icono nombre="menos" /></button>
        <button aria-label="Ver todo el piso" onClick={() => ajustar(MARCO)}><Icono nombre="centrar" /></button>
      </div>
      {H.anguloNorte !== undefined && (
        <div className="norte" title="Norte" style={{ transform: `rotate(${H.anguloNorte}deg)` }} aria-label="Norte">
          <svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 2l5 14-5-3-5 3z" fill="#D7443A" /><path d="M12 22l-5-6 5-3 5 3z" fill="#B8C1CB" /></svg>
          <b>N</b>
        </div>
      )}
    </div>
  )
}

export function encuadreDe(puntos, piso) {
  const ps = puntos.filter((p) => p.piso === piso)
  if (!ps.length) return MARCO
  const xs = ps.map((p) => p.x), ys = ps.map((p) => sy(p.y))
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
  const pad = 5
  const w = Math.max(18, x1 - x0 + pad * 2), h = Math.max(12, y1 - y0 + pad * 2)
  return { x: (x0 + x1) / 2 - w / 2, y: (y0 + y1) / 2 - h / 2, w, h }
}

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { renderToStaticMarkup } from 'react-dom/server'
import { H, tipoArista } from '../../lib/datos.js'
import { LUGARES, catById, NOMBRES_PISO } from '../../lib/lugares.js'
import { Insignia } from './Iconos.jsx'
import { aLonLat, limitesGeo } from '../../lib/geo.js'

// Mapa vectorial de OpenStreetMap (estilo claro, sin clave). Datos © OpenStreetMap contributors.
const ESTILO = 'https://tiles.openfreemap.org/styles/positron'
const FONDO = { version: 8, sources: {}, layers: [{ id: 'fondo', type: 'background', paint: { 'background-color': '#E9EDF1' } }] }
const EDIFICIO = { x: 0, y: 0, w: H.ancho, h: H.largo }
const CENTRO = aLonLat(H.ancho / 2, H.largo / 2)

const TINTE = {
  emergencia: '#FBE7E4', consulta: '#E7EEFD', diagnostico: '#EFE9FB', tratamiento: '#FCF0DF', hospitalizacion: '#E3F3E8',
  servicios: '#EDF0F3', administracion: '#F8E7F0', circulacion: '#EDF0F3',
}
const tinte = (c) => (c.tipo === 'pasillo' ? '#FFFFFF' : /^ban/.test(c.tipo) ? '#E1F1F7' : TINTE[c.cat] || '#EDF0F3')
const SOLO_ICONO = (l) => ['banos', 'circulacion', 'salidas'].includes(l.cat)

const anillo = (pts) => {
  const r = pts.map(([x, y]) => aLonLat(x, y))
  return [...r, r[0]]
}
const rectanguloGeo = (c) => [[c.x0, c.y0], [c.x1, c.y0], [c.x1, c.y1], [c.x0, c.y1]]

// huella del edificio por piso (los contornos del modelo, georreferenciados)
const EDIFICIO_FC = {
  type: 'FeatureCollection',
  features: (H.pisos || []).map((p, i) => ({
    type: 'Feature',
    properties: { piso: p.nivel },
    geometry: { type: 'Polygon', coordinates: [anillo(H.contornos?.[p.nivel] || rectanguloGeo({ x0: 0, y0: 0, x1: H.ancho, y1: H.largo }))] },
  })),
}
const CUARTOS_FC_BASE = H.cuartos.map((c, k) => ({ c, k }))

function pad(tam, plan) {
  if (tam.w < 700) return { top: 250, left: 12, right: 66, bottom: plan ? tam.h * 0.46 : 20 }
  return { top: 30, left: tam.w > 1000 ? 470 : 400, right: 92, bottom: 30 }
}

export const Mapa2D = forwardRef(function Mapa2D({ piso, plan, origen, destino, onElegirCuarto, onCambiarPiso, encuadre }, fwd) {
  const ref = useRef(null)
  const mapa = useRef(null)
  const [listo, setListo] = useState(false)
  const cb = useRef({})
  cb.current = { onElegirCuarto, onCambiarPiso }

  // ---------- datos derivados
  const depOrigen = origen?.cuarto?.dep
  const depDestino = destino?.cuarto?.dep
  const colorDestino = destino ? catById[destino.cat]?.color || '#2F5BEA' : '#2F5BEA'

  const ambientesFC = useMemo(() => ({
    type: 'FeatureCollection',
    features: CUARTOS_FC_BASE.map(({ c, k }) => {
      const esDest = depDestino && c.piso === destino.piso && c.dep === depDestino
      const activo = (depDestino && c.piso === destino.piso && c.dep === depDestino && c.tipo !== 'bano_hab')
        || (depOrigen && c.piso === origen.piso && c.dep === depOrigen)
      let color = c.tipo === 'exterior' ? '#E8E3DA' : tinte(c)
      let op = 1
      if (activo) { color = esDest ? colorDestino : '#2F5BEA'; op = 0.22 }
      return {
        type: 'Feature',
        properties: { piso: c.piso, k, color, op, pasillo: c.tipo === 'pasillo' ? 1 : 0 },
        geometry: { type: 'Polygon', coordinates: [anillo(rectanguloGeo(c))] },
      }
    }),
  }), [depOrigen, depDestino, origen, destino, colorDestino])

  // tramos de la ruta, separados por piso
  const rutaFC = useMemo(() => {
    if (!plan) return { type: 'FeatureCollection', features: [] }
    const segs = []
    let cur = null
    for (const p of plan.puntos) {
      if (!cur || cur.piso !== p.piso) { cur = { piso: p.piso, c: [] }; segs.push(cur) }
      cur.c.push(aLonLat(p.x, p.y))
    }
    return {
      type: 'FeatureCollection',
      features: segs.filter((s) => s.c.length > 1).map((s) => ({
        type: 'Feature', properties: { piso: s.piso }, geometry: { type: 'LineString', coordinates: s.c },
      })),
    }
  }, [plan])

  // cambios de piso, inicio y fin de la ruta en este piso
  const ruta = useMemo(() => {
    if (!plan) return null
    const P = plan.puntos
    const cambios = []
    for (let i = 0; i < P.length; i++) {
      const p = P[i]
      const sig = P[i + 1], ant = P[i - 1]
      const vert = (u, v) => (u.id && v.id ? tipoArista(u.id, v.id) : 'caminar')
      const dePaso = ant && sig && ant.piso !== piso && sig.piso !== piso
      if (sig && p.piso === piso && sig.piso !== piso && !dePaso) {
        let j = i + 1
        while (j + 1 < P.length && vert(P[j], P[j + 1]) === 'ascensor') j++
        cambios.push({ x: p.x, y: p.y, hacia: P[j].piso, medio: vert(p, sig) === 'ascensor' ? 'ascensor' : 'escalera', sube: P[j].piso > piso, sale: true })
      }
      if (ant && p.piso === piso && ant.piso !== piso && !dePaso) {
        let j = i - 1
        while (j - 1 >= 0 && vert(P[j - 1], P[j]) === 'ascensor') j--
        cambios.push({ x: p.x, y: p.y, hacia: P[j].piso, medio: vert(ant, p) === 'ascensor' ? 'ascensor' : 'escalera', sale: false })
      }
    }
    const ini = P[0].piso === piso ? P[0] : null
    const fin = P[P.length - 1].piso === piso ? P[P.length - 1] : null
    return { cambios, ini, fin }
  }, [plan, piso])

  // ---------- mapa: creación
  useEffect(() => {
    const map = new maplibregl.Map({
      container: ref.current, style: ESTILO, center: CENTRO, zoom: 17.4, minZoom: 14.5, maxZoom: 21,
      dragRotate: false, pitchWithRotate: false, touchPitch: false, attributionControl: { compact: true }, fadeDuration: 0,
    })
    mapa.current = map
    // MapLibre no sigue los cambios de tamaño del contenedor: se redimensiona al cambiar
    const ro = new ResizeObserver(() => map.resize())
    ro.observe(ref.current)
    const marco = () => {
      const cerca = map.getZoom() >= 18.3
      ref.current?.classList.toggle('zoom-cerca', cerca)
    }
    map.on('zoom', marco)
    // si el mapa base no carga (sin red), se usa un fondo liso: el plano sigue funcionando
    let respaldo = false
    map.on('error', () => {
      if (!respaldo && !map.getSource('edificio')) { respaldo = true; map.setStyle(FONDO) }
    })
    const preparar = () => {
      if (map.getSource('edificio')) return
      map.addSource('edificio', { type: 'geojson', data: EDIFICIO_FC })
      map.addLayer({ id: 'edificio-previo', type: 'fill', source: 'edificio', paint: { 'fill-color': '#DCE2E9', 'fill-opacity': 0.9 } })
      map.addLayer({ id: 'edificio-sombra', type: 'line', source: 'edificio', paint: { 'line-color': '#7D8A99', 'line-width': 5, 'line-opacity': 0.12, 'line-blur': 4 } })
      map.addLayer({ id: 'edificio', type: 'fill', source: 'edificio', paint: { 'fill-color': '#FFFFFF' } })
      map.addLayer({ id: 'edificio-borde', type: 'line', source: 'edificio', paint: { 'line-color': '#8D98A6', 'line-width': 1.6 } })
      map.addSource('ambientes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'ambientes', type: 'fill', source: 'ambientes', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': ['get', 'op'] } })
      map.addLayer({ id: 'ambientes-borde', type: 'line', source: 'ambientes', filter: ['==', ['get', 'pasillo'], 0], paint: { 'line-color': '#BAC3CE', 'line-width': 0.8 } })
      map.addSource('ruta', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'ruta-borde', type: 'line', source: 'ruta', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#FFFFFF', 'line-width': 10 } })
      map.addLayer({ id: 'ruta-linea', type: 'line', source: 'ruta', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#2F5BEA', 'line-width': 5.5 } })
      marco()
      setListo(true)
    }
    map.on('style.load', preparar)
    map.on('click', (e) => {
      const r = ref.current.getBoundingClientRect()
      const pt = { x: r.left + e.point.x, y: r.top + e.point.y }
      const f = map.queryRenderedFeatures(e.point, { layers: ['ambientes'] })
      const c = f.length ? H.cuartos[f[0].properties.k] : null
      if (c && c.tipo !== 'pasillo') cb.current.onElegirCuarto(c, pt)
      else cb.current.onElegirCuarto(null, pt)
    })
    return () => { ro.disconnect(); map.remove(); mapa.current = null; setListo(false) }
  }, [])

  // ---------- datos y filtros por piso
  useEffect(() => {
    const map = mapa.current
    if (!listo || !map) return
    const filtro = ['==', ['get', 'piso'], piso]
    ;['edificio', 'edificio-borde', 'edificio-sombra'].forEach((id) => map.setFilter(id, filtro))
    map.setFilter('edificio-previo', piso > 0 ? ['==', ['get', 'piso'], piso - 1] : ['==', ['get', 'piso'], -1])
    map.setFilter('ambientes', filtro)
    map.setFilter('ambientes-borde', ['all', filtro, ['==', ['get', 'pasillo'], 0]])
    map.setFilter('ruta-borde', filtro)
    map.setFilter('ruta-linea', filtro)
  }, [listo, piso])

  useEffect(() => { if (listo) mapa.current?.getSource('ambientes').setData(ambientesFC) }, [listo, ambientesFC])
  useEffect(() => { if (listo) mapa.current?.getSource('ruta').setData(rutaFC) }, [listo, rutaFC])

  // ---------- encuadre
  const encuadrar = (rect, instantaneo) => {
    const map = mapa.current
    if (!map || !ref.current) return
    const t = { w: ref.current.clientWidth, h: ref.current.clientHeight }
    map.fitBounds(limitesGeo(rect), { padding: pad(t, plan), maxZoom: 20.5, duration: instantaneo ? 0 : 650 })
  }
  useImperativeHandle(fwd, () => ({
    acercar: () => mapa.current?.zoomIn({ duration: 300 }),
    alejar: () => mapa.current?.zoomOut({ duration: 300 }),
    centrar: () => encuadrar(EDIFICIO),
  }))
  useEffect(() => {
    if (!listo) return
    if (encuadre) return encuadrar(encuadre)
    const t = ref.current
    const movil = t && t.clientWidth < 700
    if (movil && origen && origen.piso === piso) {
      return encuadrar({ x: origen.x - 14, y: origen.y - 14, w: 28, h: 28 })
    }
    encuadrar(EDIFICIO, true)
  }, [listo, encuadre])

  // ---------- marcadores HTML: lugares, origen, destino y cambios de piso
  const marcadores = useRef([])
  useEffect(() => {
    const map = mapa.current
    if (!listo || !map) return
    marcadores.current.forEach((m) => m.remove())
    const nuevos = []
    const add = (el, lng, lat, anclaje = 'center') => {
      const m = new maplibregl.Marker({ element: el, anchor: anclaje }).setLngLat([lng, lat]).addTo(map)
      nuevos.push(m)
    }
    const ptoPantalla = (el) => {
      const b = el.getBoundingClientRect()
      return { x: b.left + b.width / 2, y: b.top + b.height / 2 }
    }
    LUGARES.filter((l) => l.piso === piso).forEach((l) => {
      const cat = catById[l.cat]
      const esDest = destino && destino.nodo === l.nodo
      const el = document.createElement('button')
      el.className = `marca-lugar${esDest ? ' activo' : ''}${destino && !esDest && depDestino ? ' atenuado' : ''}`
      el.setAttribute('aria-label', l.nombre)
      el.innerHTML = renderToStaticMarkup(<Insignia icono={l.icono} color={cat?.color || '#5B6B7C'} size={SOLO_ICONO(l) ? 26 : 30} />)
      if (!SOLO_ICONO(l)) {
        const t = document.createElement('span')
        t.className = 'marca-texto'
        t.textContent = l.nombre
        el.appendChild(t)
      }
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        const pt = ptoPantalla(el)
        cb.current.onElegirCuarto(l.cuarto && l.cuarto.piso === piso ? l.cuarto : null, pt)
      })
      const [lng, lat] = aLonLat(l.x, l.y)
      add(el, lng, lat)
    })
    const origenPunto = ruta?.ini ?? (!plan && origen && origen.piso === piso ? origen : null)
    if (origenPunto) {
      const el = document.createElement('div')
      el.className = 'marca-origen'
      el.innerHTML = '<i></i><b></b>'
      const [lng, lat] = aLonLat(origenPunto.x, origenPunto.y)
      add(el, lng, lat)
    }
    if (ruta?.fin) {
      const el = document.createElement('div')
      el.className = 'marca-destino'
      el.innerHTML = `<svg width="30" height="38" viewBox="0 0 24 30" aria-hidden="true"><path d="M12 29C8 22 2 16 2 10a10 10 0 0 1 20 0c0 6-6 12-10 19z" fill="#14181F" stroke="#fff" stroke-width="2"/><circle cx="12" cy="10" r="4.6" fill="${colorDestino}"/></svg>`
      const [lng, lat] = aLonLat(ruta.fin.x, ruta.fin.y)
      add(el, lng, lat, 'bottom')
    }
    ruta?.cambios.forEach((c) => {
      const texto = c.sale ? `${c.sube ? 'Sube' : 'Baja'} a ${NOMBRES_PISO[c.hacia]}` : `Desde ${NOMBRES_PISO[c.hacia]}`
      const el = document.createElement('button')
      el.className = `marca-cambio${c.sale ? ' activo' : ''}`
      el.setAttribute('aria-label', texto)
      const icono = c.medio === 'ascensor'
        ? 'M5 3h14v18H5zM9 10.5l3-3 3 3M9 13.5l3 3 3-3'
        : 'M3.5 20h4.5v-4.5h4.5V11H17V6.5h3.5'
      el.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="${icono}"/></svg><span>${texto}</span>`
      if (c.sale) el.addEventListener('click', (e) => { e.stopPropagation(); cb.current.onCambiarPiso(c.hacia) })
      const [lng, lat] = aLonLat(c.x, c.y)
      add(el, lng, lat)
    })
    marcadores.current = nuevos
    return () => nuevos.forEach((m) => m.remove())
  }, [listo, piso, plan, origen, destino, ruta, colorDestino, depDestino])

  return (
    <div className="mapa2d" ref={ref} role="region" aria-label={`Mapa de ${NOMBRES_PISO[piso]}`} />
  )
})

// rectángulo (plano, metros) que encuadra los puntos de la ruta en un piso
export function encuadreDe(puntos, piso) {
  const ps = puntos.filter((p) => p.piso === piso)
  if (!ps.length) return EDIFICIO
  const xs = ps.map((p) => p.x), ys = ps.map((p) => p.y)
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
  const m = 6
  const w = Math.max(18, x1 - x0 + m * 2), h = Math.max(12, y1 - y0 + m * 2)
  return { x: (x0 + x1) / 2 - w / 2, y: (y0 + y1) / 2 - h / 2, w, h }
}

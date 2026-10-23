// Mapa 2D: calles, parqueaderos y manzanas reales de OpenStreetMap (OpenFreeMap) con la planta baja real del
// hospital encima: ambientes por color, muros, ventanas, puertas, mobiliario, nombres, íconos y la ruta.
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { renderToStaticMarkup } from 'react-dom/server'
import { aLonLat, rumbo, CATS, ICONO_LUGAR } from './datos.js'
import { Icono } from '../ui/mapa2d/Iconos.jsx'

const ESTILO = 'https://tiles.openfreemap.org/styles/positron'
const FONDO = { version: 8, sources: {}, layers: [{ id: 'fondo', type: 'background', paint: { 'background-color': '#ECEFF3' } }] }
const FC = (features) => ({ type: 'FeatureCollection', features })
const anillos = (pg) => pg.map((r) => r.map(([x, y]) => aLonLat(x, y)))
const polis = (lista, props = () => ({})) => FC(lista.map((pg, i) => ({ type: 'Feature', properties: props(pg, i), geometry: { type: 'Polygon', coordinates: anillos(pg) } })))
const lineas = (lista) => FC(lista.map((l) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: l.map(([x, y]) => aLonLat(x, y)) } })))

function capas(d) {
  const amb = FC(d.ambientes.filter((a) => a.pg.length).map((a) => ({
    type: 'Feature', id: Number(a.id.slice(1)),
    properties: { id: a.id, color: (CATS[a.cat] || CATS.otro).relleno, pasillo: a.cat === 'circulacion' ? 1 : 0 },
    geometry: { type: 'Polygon', coordinates: anillos(a.pg) },
  })))
  const rotulos = FC(d.ambientes.filter((a) => a.nombre && a.area >= 1.2).map((a) => ({
    type: 'Feature', properties: { nombre: a.nombre, area: a.area, orden: -a.area, pasillo: a.cat === 'circulacion' ? 1 : 0 },
    geometry: { type: 'Point', coordinates: aLonLat(a.lbl[0], a.lbl[1]) },
  })))
  const parqueos = FC(d.parqueos.map((p) => ({ type: 'Feature', properties: { nombre: p.nombre }, geometry: { type: 'Polygon', coordinates: [[...p.ll, p.ll[0]]] } })))
  return {
    huella: polis(d.huella),
    ambientes: amb,
    rotulos,
    muros: polis(d.muros),
    ventanas: polis(d.ventanas),
    muebles: FC(d.muebles.map((m) => ({ type: 'Feature', properties: { t: m.t }, geometry: { type: 'Polygon', coordinates: anillos(m.pg) } }))),
    trazos: lineas(d.trazos),
    puertas: lineas(d.trazos_puertas),
    gradas: lineas(d.gradas),
    viseras: polis(d.viseras),
    parqueos,
  }
}

const vacio = FC([])

export const Mapa = forwardRef(function Mapa({ d, ruta, origen, destino, hover, onElegir, onHover, lugaresIcono }, fwd) {
  const ref = useRef(null)
  const mapa = useRef(null)
  const [listo, setListo] = useState(false)
  const cb = useRef({})
  cb.current = { onElegir, onHover }
  const marcas = useRef([])
  const marcasRuta = useRef([])
  const anim = useRef(0)

  useImperativeHandle(fwd, () => ({
    acercar: () => mapa.current?.zoomIn(),
    alejar: () => mapa.current?.zoomOut(),
    centrar: () => encuadrar(),
    irA: (x, y, z = 20) => mapa.current?.easeTo({ center: aLonLat(x, y), zoom: z, duration: 700 }),
  }))

  const encuadrar = (pts) => {
    const map = mapa.current
    if (!map) return
    let xs, ys
    if (pts && pts.length) { xs = pts.map((p) => p[0]); ys = pts.map((p) => p[1]) } else {
      const h = d.huella.flatMap((pg) => pg[0]); xs = h.map((p) => p[0]); ys = h.map((p) => p[1])
    }
    const esq = [[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.min(...ys)], [Math.min(...xs), Math.max(...ys)], [Math.max(...xs), Math.max(...ys)]].map(([x, y]) => aLonLat(x, y))
    const lo = esq.map((p) => p[0]), la = esq.map((p) => p[1])
    const ancho = ref.current?.clientWidth || 800
    const alto = ref.current?.clientHeight || 800
    const pad = ancho < 700 ? { top: 150, bottom: pts ? Math.round(alto * 0.55) : 40, left: 24, right: 24 } : { top: 60, bottom: 60, left: ancho > 1100 ? 450 : 410, right: 90 }
    map.fitBounds([[Math.min(...lo), Math.min(...la)], [Math.max(...lo), Math.max(...la)]], { padding: pad, bearing: rumbo(), duration: 800, maxZoom: 20 })
  }

  // ---------- creación del mapa
  useEffect(() => {
    const c = aLonLat(54, 60)
    const map = new maplibregl.Map({
      container: ref.current, style: ESTILO, center: c, zoom: 17.6, minZoom: 15, maxZoom: 21.5, bearing: rumbo(),
      pitchWithRotate: false, touchPitch: false, dragRotate: false, attributionControl: { compact: true }, fadeDuration: 0,
    })
    mapa.current = map
    const ro = new ResizeObserver(() => map.resize())
    ro.observe(ref.current)
    let respaldo = false
    map.on('error', () => { if (!respaldo && !map.getSource('huella')) { respaldo = true; map.setStyle(FONDO) } })
    const C = capas(d)
    const preparar = () => {
      if (map.getSource('huella')) return
      // el mapa base más suave: menos rótulos de comercios
      for (const l of map.getStyle().layers) if (/poi|housenumber/.test(l.id)) map.setLayoutProperty(l.id, 'visibility', 'none')
      for (const [k, v] of Object.entries(C)) map.addSource(k, { type: 'geojson', data: v })
      map.addSource('ruta', { type: 'geojson', data: vacio })
      map.addSource('ruta-hecha', { type: 'geojson', data: vacio })
      const fuente = map.getStyle().glyphs ? ['Noto Sans Bold'] : undefined
      // exterior: parqueaderos
      map.addLayer({ id: 'parqueos', type: 'fill', source: 'parqueos', paint: { 'fill-color': '#DCE3EC', 'fill-opacity': 0.85 } })
      map.addLayer({ id: 'parqueos-borde', type: 'line', source: 'parqueos', paint: { 'line-color': '#AFBBCB', 'line-width': 1, 'line-dasharray': [2, 1.5] } })
      if (fuente) map.addLayer({ id: 'parqueos-txt', type: 'symbol', source: 'parqueos', layout: { 'text-field': ['concat', 'P  ', ['get', 'nombre']], 'text-font': fuente, 'text-size': 12, 'text-allow-overlap': false }, paint: { 'text-color': '#4E6A8C', 'text-halo-color': '#fff', 'text-halo-width': 1.4 } })
      // edificio
      map.addLayer({ id: 'viseras', type: 'fill', source: 'viseras', paint: { 'fill-color': '#E7E3DA', 'fill-opacity': 0.75 } })
      map.addLayer({ id: 'viseras-borde', type: 'line', source: 'viseras', paint: { 'line-color': '#A69F92', 'line-width': 1, 'line-dasharray': [3, 2] } })
      map.addLayer({ id: 'huella-sombra', type: 'line', source: 'huella', paint: { 'line-color': '#5C6B7D', 'line-width': 10, 'line-opacity': 0.12, 'line-blur': 8, 'line-translate': [0, 3] } })
      map.addLayer({ id: 'huella', type: 'fill', source: 'huella', paint: { 'fill-color': '#FFFFFF' } })
      map.addLayer({ id: 'ambientes', type: 'fill', source: 'ambientes', paint: {
        'fill-color': ['case', ['boolean', ['feature-state', 'destino'], false], '#2F5BEA', ['get', 'color']],
        'fill-opacity': ['case', ['boolean', ['feature-state', 'destino'], false], 0.2, ['boolean', ['feature-state', 'hover'], false], 0.75, 1],
      } })
      map.addLayer({ id: 'ambientes-hover', type: 'line', source: 'ambientes', paint: {
        'line-color': ['case', ['boolean', ['feature-state', 'destino'], false], '#2F5BEA', '#2F5BEA'],
        'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 2.4, ['boolean', ['feature-state', 'destino'], false], 2.4, 0],
        'line-opacity': 0.9,
      } })
      map.addLayer({ id: 'muebles', type: 'fill', source: 'muebles', minzoom: 18.3, paint: {
        'fill-color': ['match', ['get', 't'], 'sanitario', '#FFFFFF', 'silla', '#C9D3E0', 'camilla', '#CFE7E6', '#E9E4DA'],
        'fill-outline-color': '#9AA6B4',
      } })
      map.addLayer({ id: 'trazos', type: 'line', source: 'trazos', minzoom: 18.8, paint: { 'line-color': '#97A3B2', 'line-width': 0.6 } })
      map.addLayer({ id: 'gradas', type: 'line', source: 'gradas', minzoom: 17.5, paint: { 'line-color': '#8A96A5', 'line-width': 0.8 } })
      map.addLayer({ id: 'puertas', type: 'line', source: 'puertas', minzoom: 18.6, paint: { 'line-color': '#9AA6B4', 'line-width': 0.7 } })
      map.addLayer({ id: 'ventanas', type: 'fill', source: 'ventanas', paint: { 'fill-color': '#BFE0F4', 'fill-outline-color': '#5B9CC8' } })
      map.addLayer({ id: 'muros', type: 'fill', source: 'muros', paint: { 'fill-color': '#3E4652' } })
      // ruta: base blanca, línea azul y trazos que avanzan
      map.addLayer({ id: 'ruta-borde', type: 'line', source: 'ruta', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#FFFFFF', 'line-width': ['interpolate', ['linear'], ['zoom'], 17, 7, 20, 14] } })
      map.addLayer({ id: 'ruta-linea', type: 'line', source: 'ruta', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#2F5BEA', 'line-width': ['interpolate', ['linear'], ['zoom'], 17, 4, 20, 8] } })
      map.addLayer({ id: 'ruta-flujo', type: 'line', source: 'ruta', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#FFFFFF', 'line-opacity': 0.85, 'line-width': ['interpolate', ['linear'], ['zoom'], 17, 1.5, 20, 3], 'line-dasharray': [0, 4, 3] } })
      if (fuente) {
        map.addLayer({ id: 'rotulos', type: 'symbol', source: 'rotulos', minzoom: 16.8, filter: ['any', ['>=', ['get', 'area'], 60], ['>=', ['zoom'], ['case', ['>=', ['get', 'area'], 15], 17.8, 18.8]]], layout: {
          'text-field': ['get', 'nombre'], 'text-font': fuente,
          'text-size': ['interpolate', ['linear'], ['zoom'], 17, ['case', ['>=', ['get', 'area'], 150], 12, 10], 20, ['case', ['>=', ['get', 'area'], 60], 17, 13]],
          'text-max-width': 7, 'text-line-height': 1.1, 'symbol-sort-key': ['get', 'orden'], 'text-padding': 2,
          'text-rotation-alignment': 'viewport', 'text-letter-spacing': 0.01,
        }, paint: { 'text-color': ['case', ['==', ['get', 'pasillo'], 1], '#7A8696', '#26303C'], 'text-halo-color': 'rgba(255,255,255,0.9)', 'text-halo-width': 1.4 } })
      }
      // interacción: resaltar al pasar el cursor y elegir con clic
      let hoverId = null
      map.on('mousemove', 'ambientes', (e) => {
        const f = e.features[0]
        if (hoverId !== null && hoverId !== f.id) map.setFeatureState({ source: 'ambientes', id: hoverId }, { hover: false })
        hoverId = f.id
        map.setFeatureState({ source: 'ambientes', id: hoverId }, { hover: true })
        map.getCanvas().style.cursor = 'pointer'
        cb.current.onHover?.(f.properties.id)
      })
      map.on('mouseleave', 'ambientes', () => {
        if (hoverId !== null) map.setFeatureState({ source: 'ambientes', id: hoverId }, { hover: false })
        hoverId = null
        map.getCanvas().style.cursor = ''
        cb.current.onHover?.(null)
      })
      map.on('click', 'ambientes', (e) => cb.current.onElegir?.(e.features[0].properties.id, e.point))
      setListo(true)
      encuadrar()
    }
    map.on('style.load', preparar)
    if (map.isStyleLoaded()) preparar()
    return () => { ro.disconnect(); cancelAnimationFrame(anim.current); map.remove(); mapa.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d])

  // ---------- íconos de lugares (baños, ascensores, farmacia, entradas…)
  useEffect(() => {
    const map = mapa.current
    if (!map || !listo) return
    marcas.current.forEach((m) => m.remove())
    marcas.current = []
    for (const l of lugaresIcono) {
      const el = document.createElement('button')
      el.className = 'pb-pin' + (l.entrada ? ' entrada' : '') + (l.entrada && /^Acceso/.test(l.nombre) ? ' menor' : '')
      el.title = l.nombre
      el.innerHTML = renderToStaticMarkup(<span className="pb-pin-c"><Icono nombre={l.icono} size={15} color={l.entrada ? '#fff' : '#14181F'} grosor={2} /></span>)
        + (l.entrada ? `<span class="pb-pin-t">${l.nombre}</span>` : '')
      el.addEventListener('click', (ev) => { ev.stopPropagation(); cb.current.onElegir?.(l.id, null) })
      marcas.current.push(new maplibregl.Marker({ element: el }).setLngLat(aLonLat(l.x, l.y)).addTo(map))
    }
    const zoomClase = () => {
      ref.current?.classList.toggle('pb-cerca', map.getZoom() >= 18.6)
      ref.current?.classList.toggle('pb-medio', map.getZoom() >= 17.6)
    }
    zoomClase()
    map.on('zoom', zoomClase)
    return () => map.off('zoom', zoomClase)
  }, [listo, lugaresIcono])

  // ---------- destino resaltado
  useEffect(() => {
    const map = mapa.current
    if (!map || !listo) return
    for (const a of d.ambientes) map.setFeatureState({ source: 'ambientes', id: Number(a.id.slice(1)) }, { destino: !!destino && destino.id === a.id })
  }, [listo, destino, d])

  // ---------- ruta animada y marcas de inicio / fin
  useEffect(() => {
    const map = mapa.current
    if (!map || !listo) return
    marcasRuta.current.forEach((m) => m.remove())
    marcasRuta.current = []
    cancelAnimationFrame(anim.current)
    if (!ruta) { map.getSource('ruta').setData(vacio); return }
    const coords = ruta.pts.map(([x, y]) => aLonLat(x, y))
    // la línea se dibuja de a poco y luego los trazos blancos avanzan
    const total = coords.length
    let t0 = performance.now()
    const crecer = (now) => {
      const k = Math.min(1, (now - t0) / 900)
      const n = Math.max(2, Math.ceil(k * total))
      const parcial = coords.slice(0, n)
      if (k < 1 && n < total) {
        const a = coords[n - 1], b = coords[n] || a, f = k * total - (n - 1)
        parcial[n - 1] = [a[0] + (b[0] - a[0]) * Math.max(0, f), a[1] + (b[1] - a[1]) * Math.max(0, f)]
      }
      map.getSource('ruta').setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: k < 1 ? parcial : coords } })
      if (k < 1) anim.current = requestAnimationFrame(crecer)
      else { t0 = now; anim.current = requestAnimationFrame(fluir) }
    }
    const pasos = [[0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0], [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5]]
    let paso = 0
    const fluir = (now) => {
      if (now - t0 > 70) { t0 = now; paso = (paso + 1) % pasos.length; map.setPaintProperty('ruta-flujo', 'line-dasharray', pasos[paso]) }
      anim.current = requestAnimationFrame(fluir)
    }
    const reducir = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reducir) map.getSource('ruta').setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: coords } })
    else anim.current = requestAnimationFrame(crecer)
    const ini = document.createElement('div')
    ini.className = 'marca-origen'
    ini.innerHTML = '<i></i><b></b>'
    const fin = document.createElement('div')
    fin.className = 'marca-destino'
    fin.innerHTML = '<svg width="30" height="40" viewBox="0 0 30 40"><path d="M15 39C15 39 28 23.5 28 14A13 13 0 0 0 2 14C2 23.5 15 39 15 39Z" fill="#14181F"/><circle cx="15" cy="14" r="5.2" fill="#fff"/></svg>'
    marcasRuta.current.push(new maplibregl.Marker({ element: ini }).setLngLat(coords[0]).addTo(map))
    marcasRuta.current.push(new maplibregl.Marker({ element: fin, anchor: 'bottom' }).setLngLat(coords[coords.length - 1]).addTo(map))
    encuadrar(ruta.pts)
    return () => cancelAnimationFrame(anim.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listo, ruta])

  // ---------- resaltar desde la lista (hover externo)
  useEffect(() => {
    const map = mapa.current
    if (!map || !listo) return
    for (const a of d.ambientes) map.setFeatureState({ source: 'ambientes', id: Number(a.id.slice(1)) }, { hover: hover === a.id })
  }, [hover, listo, d])

  return <div ref={ref} className="pb-mapa" aria-label="Mapa de la planta baja del Hospital SOLCA" />
})

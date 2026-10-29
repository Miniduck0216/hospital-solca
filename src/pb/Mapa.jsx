// Mapa 2D: calles, parqueaderos y manzanas reales de OpenStreetMap (OpenFreeMap) con la planta baja real del
// hospital encima, al estilo de los mapas de interiores (Situm): cuartos como bloques celestes con borde blanco,
// pasillos planos y claros, íconos redondos por categoría, nombres y la ruta como una fila de puntos.
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { renderToStaticMarkup } from 'react-dom/server'
import { aLonLat, dePlano, rumbo, CATS, ICONO_LUGAR } from './datos.js'
import { Icono } from '../ui/mapa2d/Iconos.jsx'
import { LIGERO } from './rendimiento.js'

const ESTILO = 'https://tiles.openfreemap.org/styles/positron'
const FONDO = { version: 8, sources: {}, layers: [{ id: 'fondo', type: 'background', paint: { 'background-color': '#ECEFF3' } }] }
const FC = (features) => ({ type: 'FeatureCollection', features })
// paleta de interiores: bloques celestes; farmacia lila, baños turquesa; pasillos y salas de espera quedan planos
const BLOQUE = { consulta: '#BAD4F4', administracion: '#C2D8F3', apoyo: '#CCDAEB', otro: '#CFDBEA', farmacia: '#CBBEF1', banos: '#B2E0EE', escaleras: '#D5DCE6', ascensores: '#D5DCE6' }
const PLANO = { circulacion: '#F6F8FB', espera: '#E2F1E6' }
const ALTO = 2.6
const esPlano = (a) => !!PLANO[a.cat] || (!a.nombre && a.area >= 30)
const TINTA_RUTA = '#1E2A4A'

// Con el mapa inclinado, un punto a h metros de altura se ve h·sen(inclinación)/(metros por píxel) más arriba que su
// pie. Los rótulos y los íconos de los bloques se suben eso para quedar sobre el techo (y no por debajo, en el piso).
function alzarSobreTechos(map, marcas = []) {
  const lat = map.getCenter().lat
  const mpp = (40075016.686 * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** map.getZoom())
  const px = Math.round(((ALTO + 0.12) * Math.sin((map.getPitch() * Math.PI) / 180)) / mpp)
  if (map.getLayer('rotulos-techo')) map.setPaintProperty('rotulos-techo', 'text-translate', [0, -px])
  for (const m of marcas) if (m._sobreTecho) m.setOffset([0, -px])
}
// ambientes que llevan ícono en el mapa (los mismos que arma App.jsx): su nombre va justo debajo del ícono
// ícono en el mapa: los baños solo si dan a la circulación (el de cada habitación se busca, pero no se marca: serían decenas)
const conPin = (a) => (a.cat === 'banos' ? !a.personal && !a.ventanilla
  : ['escaleras', 'ascensores', 'farmacia'].includes(a.cat) || ['caja', 'informacion', 'capilla'].includes(a.icono))
const anillos = (pg) => pg.map((r) => r.map(([x, y]) => aLonLat(x, y)))
const polis = (lista, props = () => ({})) => FC(lista.map((pg, i) => ({ type: 'Feature', properties: props(pg, i), geometry: { type: 'Polygon', coordinates: anillos(pg) } })))
const lineas = (lista) => FC(lista.map((l) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: l.map(([x, y]) => aLonLat(x, y)) } })))

function capas(d) {
  const amb = FC(d.ambientes.filter((a) => a.pg.length).map((a) => ({
    type: 'Feature', id: Number(a.id.slice(1)),
    properties: { id: a.id, color: esPlano(a) ? (PLANO[a.cat] || PLANO.circulacion) : (BLOQUE[a.cat] || BLOQUE.otro), alto: esPlano(a) ? 0 : ALTO, pasillo: a.cat === 'circulacion' ? 1 : 0 },
    geometry: { type: 'Polygon', coordinates: anillos(a.pg) },
  })))
  const rotulos = FC(d.ambientes.filter((a) => a.nombre && (a.area >= 1.2 || a.nuevo)).map((a) => ({
    type: 'Feature', properties: { nombre: a.nombre, area: a.area, orden: -a.area, personal: a.personal ? 1 : 0, pasillo: a.cat === 'circulacion' ? 1 : 0, pin: conPin(a) ? 1 : 0, techo: esPlano(a) ? 0 : 1 },
    geometry: { type: 'Point', coordinates: aLonLat(a.lbl[0], a.lbl[1]) },
  })))
  // parqueaderos: solo una señal «P» en el centro de cada uno (el área ya se ve en el mapa base)
  const centro = (ll) => [ll.reduce((s, p) => s + p[0], 0) / ll.length, ll.reduce((s, p) => s + p[1], 0) / ll.length]
  const parqueos = FC(d.parqueos.map((p) => ({ type: 'Feature', properties: { nombre: p.nombre }, geometry: { type: 'Point', coordinates: centro(p.ll) } })))
  return {
    huella: polis(d.huella),
    perfil: polis(d.perfil || []),
    ambientes: amb,
    rotulos,
    muros: polis(d.muros),
    // barandas de las escaleras (barra entre tramos): bajas, no muros
    barandas: polis(d.barandas || []),
    gradas: lineas(d.gradas),
    // pasos abiertos por el administrador (puertas que el plano no tiene)
    pasos: lineas(d.pasosAbiertos || []),
    viseras: polis(d.viseras),
    parqueos,
  }
}

const vacio = FC([])

export const Mapa = forwardRef(function Mapa({ d, ruta, origen, destino, foco, hover, onElegir, onHover, lugaresIcono, pick = false, onPick, recorrer = false, onFinRecorrer, onAvance, trazo = null }, fwd) {
  const ref = useRef(null)
  const mapa = useRef(null)
  const [listo, setListo] = useState(false)
  const cb = useRef({})
  cb.current = { onElegir, onHover, onPick, pick, onFinRecorrer, onAvance }
  const marcas = useRef([])
  const marcasRuta = useRef([])
  const anim = useRef(0)
  const andado = useRef(null)   // metros recorridos por el personaje (null: sin recorrido)
  const animCam = useRef(0)

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
    // al recrear el mapa (datos nuevos del administrador o de otro piso) se espera a que cargue su estilo
    setListo(false)
    const map = new maplibregl.Map({
      container: ref.current, style: ESTILO, center: c, zoom: 17.6, minZoom: 15, maxZoom: 21.5, bearing: rumbo(), pitch: 40, maxPitch: 60,
      pitchWithRotate: false, touchPitch: false, dragRotate: false, attributionControl: { compact: true }, fadeDuration: 0,
      ...(LIGERO ? { pixelRatio: 1, antialias: false } : {}),
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
      map.addSource('ruta-puntos', { type: 'geojson', data: vacio })
      map.addSource('trazo', { type: 'geojson', data: vacio })
      const fuente = map.getStyle().glyphs ? ['Noto Sans Bold'] : undefined
      // exterior al estilo de mapa de interiores: áreas verdes de OSM en verde césped, manzanas claras
      try {
        for (const l of map.getStyle().layers) {
          if (l.type === 'background') map.setPaintProperty(l.id, 'background-color', '#EEF0EC')
          else if (l.type === 'fill' && /park|grass|wood|garden|pitch|cemetery|scrub|forest|meadow/.test(l.id)) { map.setPaintProperty(l.id, 'fill-color', '#BFE0A8'); map.setPaintProperty(l.id, 'fill-opacity', 1) }
          else if (l.type === 'fill' && /building/.test(l.id)) map.setPaintProperty(l.id, 'fill-color', '#E2E6EC')
          else if (l.type === 'fill' && /residential|landuse/.test(l.id)) map.setPaintProperty(l.id, 'fill-color', '#E9EDE4')
        }
      } catch { /* estilo de respaldo sin esas capas */ }
      map.setLight({ anchor: 'map', color: '#FFFFFF', intensity: 0.2, position: [1.4, 200, 35] })
      map.addLayer({ id: 'parqueos', type: 'circle', source: 'parqueos', minzoom: 16, paint: { 'circle-color': '#2F6FDE', 'circle-radius': ['interpolate', ['linear'], ['zoom'], 16, 7, 20, 13], 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 2 } })
      if (fuente) map.addLayer({ id: 'parqueos-txt', type: 'symbol', source: 'parqueos', minzoom: 16, layout: { 'text-field': 'P', 'text-font': fuente, 'text-size': ['interpolate', ['linear'], ['zoom'], 16, 10, 20, 17], 'text-allow-overlap': true }, paint: { 'text-color': '#FFFFFF' } })
      // edificio: losa clara con sombra suave
      map.addLayer({ id: 'viseras', type: 'fill', source: 'viseras', paint: { 'fill-color': '#E9ECF1', 'fill-opacity': 0.8 } })
      // perfil del hospital (planta baja) bajo los pisos altos: losa gris clara con su borde
      map.addLayer({ id: 'perfil', type: 'fill', source: 'perfil', paint: { 'fill-color': '#E3E7ED', 'fill-opacity': 0.9 } })
      map.addLayer({ id: 'perfil-borde', type: 'line', source: 'perfil', paint: { 'line-color': '#9AA6B6', 'line-width': 1.2 } })
      map.addLayer({ id: 'huella-sombra', type: 'line', source: 'huella', paint: { 'line-color': '#4A5D78', 'line-width': 14, 'line-opacity': 0.14, 'line-blur': 10, 'line-translate': [0, 4] } })
      map.addLayer({ id: 'huella', type: 'fill', source: 'huella', paint: { 'fill-color': '#F6F8FB' } })
      // piso de cada ambiente (plano): pasillos y salas de espera se ven aquí; es también la capa que recibe el clic
      map.addLayer({ id: 'ambientes', type: 'fill', source: 'ambientes', paint: {
        'fill-color': ['case', ['boolean', ['feature-state', 'destino'], false], '#7C83E6', ['get', 'color']],
        'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.8, 1],
      } })
      map.addLayer({ id: 'pasos', type: 'line', source: 'pasos', layout: { 'line-cap': 'round' }, paint: { 'line-color': '#2E9D5B', 'line-width': ['interpolate', ['linear'], ['zoom'], 17, 2, 20, 6], 'line-dasharray': [1, 1.5] } })
      map.addLayer({ id: 'gradas', type: 'line', source: 'gradas', minzoom: LIGERO ? 19 : 17.5, paint: { 'line-color': '#9AA8BA', 'line-width': 0.8 } })
      // cuartos como bloques: el destino se pinta lila, el que está bajo el cursor un poco más intenso
      map.addLayer({ id: 'ambientes-3d', type: 'fill-extrusion', source: 'ambientes', filter: ['>', ['get', 'alto'], 0], paint: {
        'fill-extrusion-color': ['case', ['boolean', ['feature-state', 'destino'], false], '#7C83E6', ['boolean', ['feature-state', 'hover'], false], '#97BCEB', ['get', 'color']],
        'fill-extrusion-height': ['get', 'alto'], 'fill-extrusion-base': 0, 'fill-extrusion-opacity': 0.96, 'fill-extrusion-vertical-gradient': true,
      } })
      // muros blancos un poco más altos que los bloques: el borde blanco de cada cuarto
      map.addLayer({ id: 'muros', type: 'fill-extrusion', source: 'muros', paint: { 'fill-extrusion-color': '#FBFCFE', 'fill-extrusion-height': ALTO + 0.12, 'fill-extrusion-base': 0, 'fill-extrusion-opacity': 0.96 } })
      map.addLayer({ id: 'barandas', type: 'fill-extrusion', source: 'barandas', paint: { 'fill-extrusion-color': '#B8C2D0', 'fill-extrusion-height': 1.0, 'fill-extrusion-base': 0, 'fill-extrusion-opacity': 0.96 } })
      map.addLayer({ id: 'viseras-3d', type: 'fill-extrusion', source: 'viseras', paint: { 'fill-extrusion-color': '#E9ECF1', 'fill-extrusion-height': 4.2, 'fill-extrusion-base': 3.7, 'fill-extrusion-opacity': 0.6 } })
      // ruta: una fila de puntos oscuros que avanza (ver el efecto de la ruta)
      map.addLayer({ id: 'ruta-halo', type: 'line', source: 'ruta', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': TINTA_RUTA, 'line-opacity': 0.1, 'line-width': ['interpolate', ['linear'], ['zoom'], 17, 8, 20, 18] } })
      map.addLayer({ id: 'ruta-puntos', type: 'circle', source: 'ruta-puntos', paint: {
        'circle-color': ['match', ['get', 'p'], 1, '#4C6FFF', 2, '#B9C3D3', TINTA_RUTA],
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 17, 1.8, 19, 3.4, 21, 5.5],
        'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 17, 0.6, 20, 1.4],
        'circle-pitch-alignment': 'map',
      } })
      // trazo del administrador mientras dibuja un paso (abrir, cerrar o línea de recorrido)
      map.addLayer({ id: 'trazo-linea', type: 'line', source: 'trazo', filter: ['==', ['geometry-type'], 'LineString'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: {
        'line-color': ['match', ['get', 'tipo'], 'cerrar', '#C0392B', 'abrir', '#2E9D5B', '#1B95BD'], 'line-width': 4, 'line-dasharray': [2, 1] } })
      map.addLayer({ id: 'trazo-puntos', type: 'circle', source: 'trazo', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 5, 'circle-color': '#fff', 'circle-stroke-width': 2, 'circle-stroke-color': '#1E2A4A' } })
      if (fuente) {
        // el nombre va sobre el techo del bloque (2,6 m): con el mapa inclinado, el techo se ve más arriba que el piso,
        // así que los rótulos de los bloques se suben en pantalla (ver alzarSobreTechos); los de pasillos quedan en el piso
        const rot = (id, techo) => ({ id, type: 'symbol', source: 'rotulos', minzoom: 16.8, filter: ['all', ['==', ['get', 'techo'], techo], ['any', ['==', ['get', 'personal'], 0], ['>=', ['zoom'], 19.6]], ['any', ['>=', ['get', 'area'], 60], ['>=', ['zoom'], ['case', ['>=', ['get', 'area'], 15], 17.8, 18.8]]]], layout: {
          'text-field': ['get', 'nombre'], 'text-font': fuente,
          'text-size': ['interpolate', ['linear'], ['zoom'], 17, ['case', ['>=', ['get', 'area'], 150], 12, 10], 20, ['case', ['>=', ['get', 'area'], 60], 16, 12.5]],
          'text-max-width': 7, 'text-line-height': 1.1, 'symbol-sort-key': ['get', 'orden'], 'text-padding': 2,
          'text-rotation-alignment': 'viewport', 'text-letter-spacing': 0.01,
          'text-anchor': ['case', ['==', ['get', 'pin'], 1], 'top', 'center'], 'text-offset': ['case', ['==', ['get', 'pin'], 1], ['literal', [0, 1.1]], ['literal', [0, 0]]],
        }, paint: { 'text-color': ['case', ['==', ['get', 'pasillo'], 1], '#7487A3', '#22314D'], 'text-halo-color': 'rgba(255,255,255,0.92)', 'text-halo-width': 1.5,
          'text-translate-anchor': 'viewport' } })
        map.addLayer(rot('rotulos', 0))
        map.addLayer(rot('rotulos-techo', 1))
        alzarSobreTechos(map, marcas.current)
        map.on('move', () => alzarSobreTechos(map, marcas.current))
      }
      // interacción: resaltar al pasar el cursor y elegir con clic
      let hoverId = null
      // con el mapa inclinado, lo que se ve bajo el cursor es el techo del bloque (no su piso, que queda más abajo en
      // pantalla): primero se buscan los bloques en 3D (MapLibre los ordena por cercanía a la cámara) y, si no hay
      // ninguno, los pisos planos (pasillos y salas de espera)
      const ambienteEn = (punto) => {
        const b = map.queryRenderedFeatures(punto, { layers: ['ambientes-3d'] })
        if (b.length) return b[0]
        return map.queryRenderedFeatures(punto, { layers: ['ambientes'], filter: ['==', ['get', 'alto'], 0] })[0] || null
      }
      const soltar = () => {
        if (hoverId !== null) map.setFeatureState({ source: 'ambientes', id: hoverId }, { hover: false })
        hoverId = null
        map.getCanvas().style.cursor = cb.current.pick ? 'crosshair' : ''
        cb.current.onHover?.(null)
      }
      map.on('mousemove', (e) => {
        const f = ambienteEn(e.point)
        if (!f) { if (hoverId !== null) soltar(); return }
        if (hoverId !== f.id) {
          if (hoverId !== null) map.setFeatureState({ source: 'ambientes', id: hoverId }, { hover: false })
          hoverId = f.id
          map.setFeatureState({ source: 'ambientes', id: hoverId }, { hover: true })
          cb.current.onHover?.(f.properties.id)
        }
        if (!cb.current.pick) map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseout', soltar)
      map.on('click', (e) => { if (cb.current.pick) return; const f = ambienteEn(e.point); if (f) cb.current.onElegir?.(f.properties.id, e.point) })
      map.on('click', (e) => { if (cb.current.pick) { const [x, y] = dePlano(e.lngLat.lng, e.lngLat.lat); cb.current.onPick?.(x, y) } })
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
    if (!map || !listo || !map.getSource('ambientes')) return
    marcas.current.forEach((m) => m.remove())
    marcas.current = []
    for (const l of lugaresIcono) {
      const el = document.createElement('button')
      el.className = 'pb-pin' + (l.entrada ? ' entrada' : '') + (l.entrada && /^Acceso/.test(l.nombre) ? ' menor' : '')
      el.title = l.nombre
      // insignia redonda del color de su categoría con el ícono en blanco (como los mapas de interiores)
      const color = l.entrada ? TINTA_RUTA : (CATS[l.cat] || CATS.otro).acento
      el.style.setProperty('--pin', color)
      el.innerHTML = renderToStaticMarkup(<span className="pb-pin-c"><Icono nombre={l.icono} size={14} color="#fff" grosor={2.2} /></span>)
        + (l.entrada ? `<span class="pb-pin-t">${l.nombre}</span>` : '')   // el nombre de los demás lo pone la capa de rótulos, debajo del ícono
      el.addEventListener('click', (ev) => { ev.stopPropagation(); cb.current.onElegir?.(l.id, null) })
      const mk = new maplibregl.Marker({ element: el }).setLngLat(aLonLat(l.x, l.y)).addTo(map)
      mk._sobreTecho = !l.entrada && !['circulacion', 'espera'].includes(l.cat)   // ícono de un bloque: va sobre su techo
      marcas.current.push(mk)
    }
    alzarSobreTechos(map, marcas.current)
    const zoomClase = () => {
      ref.current?.classList.toggle('pb-cerca', map.getZoom() >= 18.6)
      ref.current?.classList.toggle('pb-medio', map.getZoom() >= 17.6)
    }
    zoomClase()
    map.on('zoom', zoomClase)
    return () => map.off('zoom', zoomClase)
  }, [listo, lugaresIcono])

  // ---------- buscador: la vista llega al lugar elegido (si no hay ruta, que la ruta ya encuadra) y lo marca con un pulso
  useEffect(() => {
    const map = mapa.current
    if (!map || !listo || !map.getSource('ambientes') || !foco) return
    if (!ruta) map.easeTo({ center: aLonLat(foco.x, foco.y), zoom: Math.max(map.getZoom(), 19.4), pitch: 45, bearing: rumbo(), duration: 1000 })
    const el = document.createElement('div')
    el.className = 'marca-foco'
    el.innerHTML = '<i></i><i></i>'
    const m = new maplibregl.Marker({ element: el }).setLngLat(aLonLat(foco.x, foco.y)).addTo(map)
    const t = setTimeout(() => m.remove(), 3400)
    return () => { clearTimeout(t); m.remove() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foco, listo])

  useEffect(() => { const c = mapa.current?.getCanvas(); if (c) c.style.cursor = pick ? 'crosshair' : '' }, [pick])

  // ---------- trazo en curso del administrador
  useEffect(() => {
    const map = mapa.current
    if (!map || !listo || !map.getSource('ambientes') || !map.getSource('trazo')) return
    const pts = (trazo?.puntos || []).map(([x, y]) => aLonLat(x, y))
    const f = pts.map((c) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: c } }))
    if (pts.length > 1) f.push({ type: 'Feature', properties: { tipo: trazo.tipo }, geometry: { type: 'LineString', coordinates: pts } })
    map.getSource('trazo').setData(FC(f))
  }, [trazo, listo])

  // ---------- destino resaltado
  useEffect(() => {
    const map = mapa.current
    if (!map || !listo || !map.getSource('ambientes')) return
    for (const a of d.ambientes) map.setFeatureState({ source: 'ambientes', id: Number(a.id.slice(1)) }, { destino: !!destino && destino.id === a.id })
  }, [listo, destino, d])

  // ---------- ruta animada y marcas de inicio / fin
  useEffect(() => {
    const map = mapa.current
    if (!map || !listo || !map.getSource('ambientes')) return
    marcasRuta.current.forEach((m) => m.remove())
    marcasRuta.current = []
    cancelAnimationFrame(anim.current)
    if (!ruta) { map.getSource('ruta').setData(vacio); map.getSource('ruta-puntos').setData(vacio); return }
    const coords = ruta.pts.map(([x, y]) => aLonLat(x, y))
    map.getSource('ruta').setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: coords } })
    // puntos cada 1,3 m a lo largo de la ruta: aparecen desde el origen y luego avanzan; un tramo azul recorre la fila
    const P = ruta.pts
    const acum = [0]
    for (let i = 1; i < P.length; i++) acum.push(acum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]))
    const L = acum[acum.length - 1]
    const PASO = 1.3
    const enDist = (s) => {
      let k = 1
      while (k < acum.length - 1 && acum[k] < s) k++
      const t = (s - acum[k - 1]) / ((acum[k] - acum[k - 1]) || 1)
      return [P[k - 1][0] + (P[k][0] - P[k - 1][0]) * t, P[k - 1][1] + (P[k][1] - P[k - 1][1]) * t]
    }
    const puntos = (hasta, fase, cabeza) => {
      const f = []
      for (let s = fase; s <= hasta; s += PASO) {
        const [x, y] = enDist(s)
        // 2 = tramo ya caminado por el personaje (gris), 1 = destello que avanza, 0 = por recorrer
        const a = andado.current
        const p = a !== null ? (s < a ? 2 : 0) : cabeza !== null && s <= cabeza && s > cabeza - 5 ? 1 : 0
        f.push({ type: 'Feature', properties: { p }, geometry: { type: 'Point', coordinates: aLonLat(x, y) } })
      }
      return FC(f)
    }
    const src = map.getSource('ruta-puntos')
    const reducir = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reducir) src.setData(puntos(L, 0, null))
    else {
      const t0 = performance.now()
      let ult = 0
      const cuadro = (now) => {
        const t = now - t0
        if (now - ult > (LIGERO ? 140 : 50)) {
          ult = now
          if (t < 900) src.setData(puntos(L * (t / 900), 0, null))
          else {
            const m = (t - 900) / 1000
            src.setData(puntos(L, (m * 0.8) % PASO, (m * 7) % (L + 12)))
          }
        }
        anim.current = requestAnimationFrame(cuadro)
      }
      anim.current = requestAnimationFrame(cuadro)
    }
    const ini = document.createElement('div')
    ini.className = 'marca-origen'
    ini.innerHTML = '<i></i><b></b>'
    const fin = document.createElement('div')
    fin.className = 'marca-destino'
    fin.innerHTML = '<svg width="30" height="40" viewBox="0 0 30 40"><path d="M15 39C15 39 28 23.5 28 14A13 13 0 0 0 2 14C2 23.5 15 39 15 39Z" fill="#7C83E6" stroke="#fff" stroke-width="2"/><circle cx="15" cy="14" r="5.2" fill="#fff"/></svg>'
    marcasRuta.current.push(new maplibregl.Marker({ element: ini }).setLngLat(coords[0]).addTo(map))
    marcasRuta.current.push(new maplibregl.Marker({ element: fin, anchor: 'bottom' }).setLngLat(coords[coords.length - 1]).addTo(map))
    encuadrar(ruta.pts)
    return () => cancelAnimationFrame(anim.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listo, ruta])

  // ---------- recorrido: un personaje camina la ruta a 1,3 m/s y la cámara lo sigue; lo caminado queda en gris
  useEffect(() => {
    const map = mapa.current
    if (!map || !listo || !map.getSource('ambientes') || !ruta || !recorrer) { andado.current = null; return }
    const P = ruta.pts
    const acum = [0]
    for (let i = 1; i < P.length; i++) acum.push(acum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]))
    const L = acum[acum.length - 1]
    const en = (s) => {
      let k = 1
      while (k < acum.length - 1 && acum[k] < s) k++
      const t = (s - acum[k - 1]) / ((acum[k] - acum[k - 1]) || 1)
      return { x: P[k - 1][0] + (P[k][0] - P[k - 1][0]) * t, y: P[k - 1][1] + (P[k][1] - P[k - 1][1]) * t, dx: P[k][0] - P[k - 1][0], dy: P[k][1] - P[k - 1][1] }
    }
    const el = document.createElement('div')
    el.className = 'caminante-2d'
    el.innerHTML = '<span class="cam-cono"></span><span class="cam-cuerpo">' + renderToStaticMarkup(<Icono nombre="caminar" size={18} color="#fff" grosor={2.4} />) + '</span>'
    const p0 = en(0)
    const m = new maplibregl.Marker({ element: el }).setLngLat(aLonLat(p0.x, p0.y)).addTo(map)
    andado.current = 0
    map.easeTo({ center: aLonLat(p0.x, p0.y), zoom: 20.2, pitch: 50, duration: 900 })
    let t0 = null
    let ultAv = 0
    const paso = (now) => {
      if (t0 === null) t0 = now + 900
      const sAct = Math.max(0, Math.min(L, ((now - t0) / 1000) * 1.3))
      // avance para la barra de navegación (paso actual y metros que faltan), unas 4 veces por segundo
      if (now - ultAv > 250 || sAct >= L) { ultAv = now; cb.current.onAvance?.(sAct, L) }
      const q = en(sAct)
      andado.current = sAct
      m.setLngLat(aLonLat(q.x, q.y))
      // el cono apunta hacia donde camina (ángulo en pantalla = rumbo del tramo menos el giro del mapa)
      const ang = (Math.atan2(q.dx, q.dy) * 180) / Math.PI + rumbo()
      el.style.setProperty('--dir', `${ang - map.getBearing()}deg`)
      if (now > t0) map.jumpTo({ center: aLonLat(q.x, q.y) })
      if (sAct >= L) { cb.current.onFinRecorrer?.(); return }
      animCam.current = requestAnimationFrame(paso)
    }
    animCam.current = requestAnimationFrame(paso)
    return () => { cancelAnimationFrame(animCam.current); m.remove(); andado.current = null }
  }, [listo, ruta, recorrer])

  // ---------- resaltar desde la lista (hover externo)
  useEffect(() => {
    const map = mapa.current
    if (!map || !listo || !map.getSource('ambientes')) return
    for (const a of d.ambientes) map.setFeatureState({ source: 'ambientes', id: Number(a.id.slice(1)) }, { hover: hover === a.id })
  }, [hover, listo, d])

  return <div ref={ref} className="pb-mapa" aria-label="Mapa de la planta baja del Hospital SOLCA" />
})

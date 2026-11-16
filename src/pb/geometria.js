// Proveedor de geometría: de dónde salen los archivos del dibujo (edificio.json, exterior.json y, por piso, datos.json,
// config.json y los .glb). Solo cambia el origen; el dibujo usa el mismo código en los dos casos.
//
// - public/ (como siempre): sin parámetros, o con ?geo=0.
// - OM3 (contrato de planos, fase 1): con ?geo=<url de GET /geo?sede=&edificio=> o, si la URL trae ?config=<…/mapa/publicado>,
//   la misma dirección con /geo en lugar de /publicado (misma sede y edificio). Se lee el manifiesto y luego cada archivo
//   con GET /geo/:versionId/archivo?ruta=<ruta en el paquete>.
// - Vista previa del borrador (editor de OM3): ?modo=admin&vista=<token> (?vista= es la vista del mapa solo si vale
//   exactamente 2d, plano o 3d) o ?geo=…/geo?…&vista=<token>. El manifiesto se pide con la URL de ?geo= tal cual y el
//   token se añade a cada /geo/:id/archivo mientras la versión sea borrador.
// Si OM3 no responde, da 404 o el manifiesto no sirve, se usan los archivos de public/ (y se avisa en la consola).

export class CaidaOm3 extends Error {}

const VISTAS = ['2d', 'plano', '3d']   // ?vista= también elige la vista del mapa: esos valores no son un token
const PLAZO_MS = 8000

const urlValida = (u, base) => {
  try {
    const x = base ? new URL(u, base) : new URL(u)
    return x.protocol === 'https:' || x.protocol === 'http:' ? x : null
  } catch { return null }
}

/**
 * Lee de la consulta de la página de dónde sale el dibujo.
 * @param pagina dirección de la página: ?geo= y ?config= pueden ser relativas a ella (portal de OM3: /api/…)
 * @returns {{ url: string, vista: string|null } | null} null = public/
 */
export function origenGeoDeUrl(busqueda = '', pagina = globalThis.location?.href) {
  const p = new URLSearchParams(busqueda)
  const geo = p.get('geo')
  if (geo === '0' || geo === 'public') return null
  const token = p.get('modo') === 'admin' && p.get('vista') && !VISTAS.includes(p.get('vista')) ? p.get('vista') : null
  let url = geo ? urlValida(geo, pagina) : null
  if (!url && p.get('config')) {
    const c = urlValida(p.get('config'), pagina)
    if (c && /\/publicado\/?$/.test(c.pathname)) {
      c.pathname = c.pathname.replace(/\/publicado\/?$/, '/geo')
      if (!c.searchParams.has('sede')) c.searchParams.set('sede', '1')
      if (!c.searchParams.has('edificio')) c.searchParams.set('edificio', 'PRINCIPAL')
      url = c
    }
  }
  if (!url) return null
  // la URL de ?geo= se usa tal cual: si OM3 ya puso ?vista=<token> en ella, ese es el token del borrador
  const enGeo = url.searchParams.get('vista')
  if (token && !enGeo) url.searchParams.set('vista', token)
  return { url: url.href, vista: enGeo || token }
}

/** Dirección de un archivo del dibujo según su origen (es un objeto simple: pasa entre hilos). */
export function urlArchivo(origen, ruta, base = '/', version = 'dev') {
  if (!origen || origen.tipo !== 'om3') return `${base}${ruta}?v=${version}`
  const u = new URL(origen.archivos)
  u.searchParams.set('ruta', ruta)
  if (origen.vista) u.searchParams.set('vista', origen.vista)
  return u.href
}

/**
 * Pisos del edificio que llega de OM3: los del manifiesto (clave, nombre, nivel, altura) mandan sobre edificio.json;
 * un piso del manifiesto que edificio.json no trae se arma con las rutas del paquete (pisos/<CLAVE>/…).
 */
export function unirPisos(edificio, manifiesto) {
  const delEdificio = new Map((edificio.pisos || []).map((p) => [p.id, p]))
  const lista = Array.isArray(manifiesto?.pisos) && manifiesto.pisos.length ? manifiesto.pisos : null
  if (!lista) return edificio.pisos || []
  return lista.map((m) => {
    const p = delEdificio.get(m.clave) || {}
    return {
      ...p,
      id: m.clave,
      nombre: m.nombre ?? p.nombre ?? m.clave,
      corto: p.corto ?? m.clave,
      nivel: Number.isFinite(m.nivel) ? m.nivel : (p.nivel ?? 0),
      ...(Number.isFinite(m.altura) ? { altura: m.altura } : {}),
      disponible: p.disponible ?? true,
      datos: p.datos || `pisos/${m.clave}/datos.json`,
      config: p.config ?? `pisos/${m.clave}/config.json`,
      glb: p.glb ?? m.glb ?? null,
    }
  })
}

const conPlazo = (url, init) => {
  const ctl = typeof AbortController === 'undefined' ? null : new AbortController()
  const t = ctl && setTimeout(() => ctl.abort(), PLAZO_MS)
  return fetch(url, { ...init, ...(ctl ? { signal: ctl.signal } : {}) }).finally(() => clearTimeout(t))
}

/**
 * Crea el proveedor. Todo lo que devuelve son promesas de JSON o direcciones; el dibujo no sabe de dónde vienen.
 * @param o.geo     { url, vista } de origenGeoDeUrl, o null para public/
 * @param o.base    raíz de public/ (import.meta.env.BASE_URL)
 * @param o.version __VERSION__ (evita datos viejos de public/)
 * @param o.avisar  dónde se registra la caída a public/ (console.warn)
 */
export function crearProveedor({ geo = null, base = '/', version = 'dev', avisar = (...a) => console.warn(...a) } = {}) {
  const pedirJson = (url, init) => fetch(url, init).then((x) => (x.ok ? x.json() : null)).catch(() => null)
  const publico = { tipo: 'public' }
  let origen = null   // se fija al leer el edificio
  let edificioP = null

  async function deOm3() {
    const r = await conPlazo(geo.url, { cache: 'no-cache' })
    if (!r.ok) throw new Error(`GET /geo respondió ${r.status}`)
    const m = await r.json()
    const versionId = m?.version?.id ?? m?.version
    if (!m?.manifiesto || versionId == null) throw new Error('el manifiesto de OM3 no trae versión')
    const archivos = m.base ? urlValida(m.base, geo.url) : null
    let fin = archivos
    if (!fin) { fin = new URL(geo.url); fin.pathname = fin.pathname.replace(/\/geo\/?$/, `/geo/${versionId}/archivo`); fin.search = '' }
    fin.searchParams.delete('ruta')
    fin.searchParams.delete('vista')
    // el token solo acompaña a los archivos de un borrador; una versión publicada se pide sin él (y queda en caché)
    const estado = m?.version?.estado
    const vista = geo.vista && (!estado || estado === 'BORRADOR') ? geo.vista : null
    const o = { tipo: 'om3', version: versionId, hash: m.hash || null, archivos: fin.href, vista }
    const er = await conPlazo(urlArchivo(o, 'edificio.json'), { cache: o.vista ? 'no-store' : 'default' })
    if (!er.ok) throw new Error(`edificio.json respondió ${er.status}`)
    const e = await er.json()
    if (!e || !Array.isArray(e.pisos)) throw new Error('edificio.json de OM3 no trae pisos')
    return { origen: o, edificio: { ...e, pisos: unirPisos(e, m.manifiesto), manifiesto: m.manifiesto, origen: o } }
  }

  async function dePublic() {
    const e = await pedirJson(`${base}edificio.json?v=${version}`)
    return { origen: publico, edificio: e ? { ...e, origen: publico } : null }
  }

  function caer(motivo) {
    avisar(`[mapa] El plano de OM3 no está disponible (${motivo}); se usa el de public/.`)
    origen = publico
    edificioP = dePublic().then((x) => x.edificio)
    return edificioP
  }

  return {
    get origen() { return origen },
    /** edificio.json (con d.origen); null si no hay ninguno */
    edificio() {
      if (edificioP) return edificioP
      if (!geo) { origen = publico; edificioP = dePublic().then((x) => x.edificio); return edificioP }
      edificioP = deOm3().then((x) => { origen = x.origen; return x.edificio }).catch((e) => caer(e.message))
      return edificioP
    },
    url(ruta) { return urlArchivo(origen, ruta, base, version) },
    /**
     * Un .json del dibujo (null si no existe). Si OM3 falla a mitad de carga, el proveedor pasa a public/ y lanza
     * CaidaOm3: quien carga vuelve a empezar con el edificio de public/ (las rutas de los pisos cambian).
     */
    async json(ruta, { obligatorio = false } = {}) {
      if (!origen) await this.edificio()
      if (origen.tipo !== 'om3') return pedirJson(urlArchivo(origen, ruta, base, version))
      let motivo
      try {
        const r = await conPlazo(urlArchivo(origen, ruta), { cache: origen.vista ? 'no-store' : 'default' })
        if (r.ok) return await r.json()
        if (!obligatorio && r.status === 404) return null
        motivo = `${ruta} respondió ${r.status}`
      } catch (e) { motivo = `${ruta}: ${e.message}` }
      await caer(motivo)
      throw new CaidaOm3(motivo)
    },
  }
}

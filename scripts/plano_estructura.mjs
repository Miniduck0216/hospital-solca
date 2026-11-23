// Estructura del paquete del plano (contrato de planos, fase 1) y estructura mínima de datos.json que necesita el mapa.
// La usa `npm run plano:paquete` antes de escribir el zip; OM3 (MS_ADMINISTRACION) valida lo mismo al subirlo.
//
// Paquete:
//   manifest.json             { formato: 1, sede, edificio, edificioNombre?, pisos: [{ clave, nombre, nivel, altura }], generado, fuente, notas }
//   edificio.json             obligatorio: pisos (con datos/config/glb apuntando dentro del paquete) y conectores
//   exterior.json             opcional
//   techos.json               opcional: { <piso>: [[anillo, huecos…], …] } (techos del 3D, como el de Quito)
//   perfil.json               opcional: { huella: [...] } (contorno de la planta baja bajo los pisos altos)
//   pisos/<CLAVE>/datos.json  obligatorio por piso del manifiesto
//   pisos/<CLAVE>/config.json opcional
//   pisos/<CLAVE>/*.glb       opcional
//   pisos/<CLAVE>/nombres.json opcional: { "a12": { "nombre": "Consultorio 3", "cat": "consulta" }, … } con los nombres que
//                             trae el DXF (sedes nuevas). Al publicar, OM3 crea en la base los ambientes que todavía no
//                             existen con ese nombre y categoría; los datos.json siguen sin nombres.

export const CLAVE = /^[A-Z0-9]{1,3}$/
export const LIMITES = { zipMB: 60, archivoMB: 25 }
// como el validador de OM3 (MS_ADMINISTRACION): código del edificio, número de pisos y niveles
export const EDIFICIO = /^[A-Z0-9_-]{1,20}$/
export const LIMITES_PISOS = { max: 50, nivelMin: -200, nivelMax: 200 }
// categorías de ambiente que entiende el mapa y OM3 (OMNIUM_MS_ADMINISTRACION, CATEGORIAS de mapaConfig.service.ts)
export const CATEGORIAS = ['consulta', 'espera', 'banos', 'farmacia', 'administracion', 'circulacion', 'apoyo', 'escaleras', 'ascensores', 'otro']
const ID_AMBIENTE = /^a\d{1,5}$/

const esObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const num = (v) => typeof v === 'number' && Number.isFinite(v)
const ent = (v) => Number.isInteger(v)
const punto = (v) => Array.isArray(v) && v.length >= 2 && num(v[0]) && num(v[1])
const b64 = /^[A-Za-z0-9+/]*={0,2}$/
const largoB64 = (s) => Math.floor((s.length * 3) / 4) - (s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0)

/**
 * Estructura mínima de pisos/<CLAVE>/datos.json (lo que src/pb/datos.js, Mapa.jsx, Vista3D.jsx y ruta.js leen sin
 * comprobar). Devuelve la lista de errores (vacía = sirve) y los ids de ambientes.
 */
export function validarDatosPiso(ruta, d) {
  const e = []
  if (!esObj(d)) return { errores: [`${ruta}: debe ser un objeto JSON`], ids: [] }
  const g = d.geo
  if (!esObj(g)) e.push(`${ruta}: falta geo`)
  else for (const k of ['lat0', 'lon0', 'cx', 'cy', 'ang', 'ox', 'oy']) if (!num(g[k])) e.push(`${ruta}: geo.${k} debe ser un número`)
  for (const k of ['huella', 'muros', 'gradas', 'viseras', 'parqueos', 'ambientes', 'entradas']) {
    if (!Array.isArray(d[k])) e.push(`${ruta}: ${k} debe ser una lista (puede estar vacía)`)
  }
  for (const k of ['puertas', 'ventanas', 'barandas', 'trazos', 'trazos_puertas', 'muebles', 'poi']) {
    if (k in d && !Array.isArray(d[k])) e.push(`${ruta}: ${k} debe ser una lista si viene`)
  }
  if ('altura' in d && !num(d.altura)) e.push(`${ruta}: altura debe ser un número (metros)`)
  if (Array.isArray(d.huella) && !d.huella.length) e.push(`${ruta}: huella no puede estar vacía (contorno del piso)`)
  const ids = []
  if (Array.isArray(d.ambientes)) {
    if (!d.ambientes.length) e.push(`${ruta}: ambientes no puede estar vacía`)
    const vistos = new Set()
    d.ambientes.forEach((a, i) => {
      const donde = `${ruta}: ambientes[${i}]`
      if (!esObj(a)) { e.push(`${donde} debe ser un objeto`); return }
      if (typeof a.id !== 'string' || !/^a\d+$/.test(a.id)) e.push(`${donde}.id debe ser «a<número>»`)
      else if (vistos.has(a.id)) e.push(`${donde}.id repetido (${a.id})`)
      else { vistos.add(a.id); ids.push(a.id) }
      if (typeof a.cat !== 'string') e.push(`${donde}.cat debe ser texto`)
      if (!num(a.area)) e.push(`${donde}.area debe ser un número`)
      if (!Array.isArray(a.pg) || !a.pg.length || !a.pg.every((an) => Array.isArray(an) && an.length >= 3 && an.every(punto))) {
        e.push(`${donde}.pg debe ser un polígono [[[x,y],…]]`)
      }
      if ('lbl' in a && !punto(a.lbl)) e.push(`${donde}.lbl debe ser [x,y] si viene`)
    })
  }
  if (Array.isArray(d.entradas)) {
    d.entradas.forEach((x, i) => {
      if (!esObj(x) || typeof x.id !== 'string' || !num(x.x) || !num(x.y)) e.push(`${ruta}: entradas[${i}] debe tener id (texto), x e y`)
    })
  }
  const n = d.nav
  if (!esObj(n)) e.push(`${ruta}: falta nav`)
  else {
    for (const k of ['x0', 'y0', 'res']) if (!num(n[k])) e.push(`${ruta}: nav.${k} debe ser un número`)
    if (num(n.res) && n.res <= 0) e.push(`${ruta}: nav.res debe ser mayor que 0`)
    for (const k of ['w', 'h']) if (!ent(n[k]) || n[k] <= 0) e.push(`${ruta}: nav.${k} debe ser un entero mayor que 0`)
    if ('cuartoBits' in n && n.cuartoBits !== 8 && n.cuartoBits !== 16) e.push(`${ruta}: nav.cuartoBits debe ser 8 o 16`)
    const celdas = ent(n.w) && ent(n.h) ? n.w * n.h : null
    for (const k of ['celdas', 'cuarto', 'red', 'vereda']) {
      if (typeof n[k] !== 'string' || !b64.test(n[k])) { e.push(`${ruta}: nav.${k} debe ser texto base64`); continue }
      const esperado = celdas == null ? null : celdas * (k === 'cuarto' && n.cuartoBits === 16 ? 2 : 1)
      if (esperado != null && largoB64(n[k]) !== esperado) e.push(`${ruta}: nav.${k} debe tener ${esperado} bytes (w·h${k === 'cuarto' && n.cuartoBits === 16 ? '·2' : ''}), tiene ${largoB64(n[k])}`)
    }
  }
  return { errores: e, ids }
}

/** Una ruta del paquete: { tipo: 'manifest'|'edificio'|'exterior'|'datos'|'config'|'glb', piso } o null si no vale. */
export function clasificarRuta(ruta) {
  if (typeof ruta !== 'string' || !ruta || ruta.startsWith('/') || ruta.includes('\\') || /^[A-Za-z]:/.test(ruta)) return null
  if (ruta.split('/').some((s) => s === '..' || s === '.' || s === '')) return null
  if (ruta === 'manifest.json') return { tipo: 'manifest' }
  if (ruta === 'edificio.json') return { tipo: 'edificio' }
  if (ruta === 'exterior.json') return { tipo: 'exterior' }
  if (ruta === 'techos.json') return { tipo: 'techos' }
  if (ruta === 'perfil.json') return { tipo: 'perfil' }
  const m = ruta.match(/^pisos\/([^/]+)\/([^/]+)$/)
  if (!m || !CLAVE.test(m[1])) return null
  if (m[2] === 'datos.json') return { tipo: 'datos', piso: m[1] }
  if (m[2] === 'config.json') return { tipo: 'config', piso: m[1] }
  if (m[2] === 'nombres.json') return { tipo: 'nombres', piso: m[1] }
  if (/^[A-Za-z0-9._-]+\.glb$/.test(m[2])) return { tipo: 'glb', piso: m[1] }
  return null
}

/**
 * pisos/<CLAVE>/nombres.json: { "<id>": { nombre, cat } } con ids que existen en el datos.json del piso,
 * nombre de 1 a 200 caracteres y cat de CATEGORIAS.
 * @param ids ids de ambientes del datos.json del piso (null si no se pudo leer)
 */
export function validarNombres(ruta, n, ids = null) {
  const e = []
  if (!esObj(n)) return [`${ruta} debe ser un objeto { "<id>": { nombre, cat } }`]
  const existen = ids ? new Set(ids) : null
  for (const [id, v] of Object.entries(n)) {
    const donde = `${ruta}: ${id}`
    if (!ID_AMBIENTE.test(id)) { e.push(`${donde}: el id debe ser «a<número>» (hasta 5 cifras)`); continue }
    if (existen && !existen.has(id)) e.push(`${donde}: no está en pisos/${ruta.split('/')[1]}/datos.json`)
    if (!esObj(v)) { e.push(`${donde} debe ser { nombre, cat }`); continue }
    if (typeof v.nombre !== 'string' || !v.nombre.trim() || v.nombre.length > 200) e.push(`${donde}.nombre debe ser texto de 1 a 200 caracteres`)
    if (typeof v.cat !== 'string' || v.cat.length > 40 || !CATEGORIAS.includes(v.cat)) e.push(`${donde}.cat debe ser una de: ${CATEGORIAS.join(', ')}`)
  }
  return e
}

/**
 * Valida un paquete completo.
 * @param archivos Map<ruta, Buffer>
 * @returns {{ errores: string[], avisos: string[], manifiesto: object|null }}
 */
export function validarPaquete(archivos, { tamanoZip = null, limites = LIMITES } = {}) {
  const errores = []
  const avisos = []
  const json = new Map()
  if (tamanoZip != null && tamanoZip > limites.zipMB * 1024 * 1024) errores.push(`El zip pasa de ${limites.zipMB} MB`)
  for (const [ruta, b] of archivos) {
    const r = clasificarRuta(ruta)
    if (!r) { errores.push(`Ruta no permitida: ${ruta}`); continue }
    if (b.length > limites.archivoMB * 1024 * 1024) errores.push(`${ruta} pasa de ${limites.archivoMB} MB`)
    if (r.tipo === 'glb') {
      if (b.length < 12 || b.toString('latin1', 0, 4) !== 'glTF') errores.push(`${ruta} no es un .glb (glTF binario)`)
      continue
    }
    try { json.set(ruta, JSON.parse(b.toString('utf8'))) } catch { errores.push(`${ruta} no es JSON válido`) }
  }
  const m = json.get('manifest.json')
  if (!archivos.has('manifest.json')) errores.push('Falta manifest.json')
  if (!archivos.has('edificio.json')) errores.push('Falta edificio.json')
  const claves = []
  if (esObj(m)) {
    if (m.formato !== 1) errores.push('manifest.json: formato debe ser 1')
    if (!ent(m.sede) || m.sede <= 0) errores.push('manifest.json: sede debe ser un entero mayor que 0')
    if (typeof m.edificio !== 'string' || !m.edificio.trim()) errores.push('manifest.json: edificio debe ser texto')
    else if (!EDIFICIO.test(m.edificio.trim().toUpperCase())) errores.push(`manifest.json: edificio debe cumplir ${EDIFICIO} (en mayúsculas)`)
    if (m.edificioNombre != null && (typeof m.edificioNombre !== 'string' || !m.edificioNombre.trim() || m.edificioNombre.length > 200)) {
      errores.push('manifest.json: edificioNombre debe ser texto de 1 a 200 caracteres si viene')
    }
    if (!Array.isArray(m.pisos) || !m.pisos.length) errores.push('manifest.json: pisos debe ser una lista con al menos un piso')
    else if (m.pisos.length > LIMITES_PISOS.max) errores.push(`manifest.json: a lo sumo ${LIMITES_PISOS.max} pisos`)
    else m.pisos.forEach((p, i) => {
      if (!esObj(p) || typeof p.clave !== 'string' || !CLAVE.test(p.clave)) { errores.push(`manifest.json: pisos[${i}].clave debe cumplir ${CLAVE}`); return }
      if (claves.includes(p.clave)) errores.push(`manifest.json: piso ${p.clave} repetido`)
      claves.push(p.clave)
      if (typeof p.nombre !== 'string' || !p.nombre.trim()) errores.push(`manifest.json: el piso ${p.clave} no tiene nombre`)
      if (!ent(p.nivel)) errores.push(`manifest.json: el nivel del piso ${p.clave} debe ser entero`)
      else if (p.nivel < LIMITES_PISOS.nivelMin || p.nivel > LIMITES_PISOS.nivelMax) errores.push(`manifest.json: el nivel del piso ${p.clave} debe estar entre ${LIMITES_PISOS.nivelMin} y ${LIMITES_PISOS.nivelMax}`)
      if (p.altura != null && !(ent(p.altura) && p.altura >= 0)) errores.push(`manifest.json: la altura del piso ${p.clave} debe ser un entero positivo o vacía`)
    })
    for (const k of ['generado', 'fuente', 'notas']) if (k in m && typeof m[k] !== 'string') errores.push(`manifest.json: ${k} debe ser texto`)
  } else if (json.has('manifest.json')) errores.push('manifest.json debe ser un objeto')

  const ids = {}
  for (const c of claves) {
    const ruta = `pisos/${c}/datos.json`
    if (!json.has(ruta)) { errores.push(`Falta ${ruta}`); continue }
    const v = validarDatosPiso(ruta, json.get(ruta))
    errores.push(...v.errores)
    ids[c] = v.ids
  }
  for (const ruta of archivos.keys()) {
    const r = clasificarRuta(ruta)
    if (r?.piso && claves.length && !claves.includes(r.piso)) errores.push(`${ruta}: el piso ${r.piso} no está en manifest.json`)
  }
  for (const [ruta, c] of json) {
    const r = clasificarRuta(ruta)
    if (r?.tipo === 'config' && !esObj(c)) errores.push(`${ruta} debe ser un objeto`)
    if (r?.tipo === 'config' && esObj(c)) {
      for (const k of ['pasos', 'puertasAuto']) if (k in c && !Array.isArray(c[k])) errores.push(`${ruta}: ${k} debe ser una lista`)
    }
    if (r?.tipo === 'nombres') errores.push(...validarNombres(ruta, c, ids[r.piso] ?? null))
  }
  const ext = json.get('exterior.json')
  if (json.has('exterior.json') && !esObj(ext)) errores.push('exterior.json debe ser un objeto')
  if (json.has('techos.json') && !esObj(json.get('techos.json'))) errores.push('techos.json debe ser un objeto')
  if (json.has('perfil.json')) {
    const pf = json.get('perfil.json')
    if (!esObj(pf) || !Array.isArray(pf.huella)) errores.push('perfil.json debe ser un objeto con huella (lista)')
  }

  const e = json.get('edificio.json')
  if (json.has('edificio.json')) {
    if (!esObj(e) || !Array.isArray(e.pisos)) errores.push('edificio.json: debe traer pisos (lista)')
    else {
      const ide = e.pisos.map((p) => p?.id)
      for (const c of claves) if (!ide.includes(c)) errores.push(`edificio.json: falta el piso ${c} del manifiesto`)
      for (const p of e.pisos) {
        if (!esObj(p) || !claves.includes(p.id)) { errores.push(`edificio.json: el piso ${p?.id} no está en manifest.json`); continue }
        if (p.datos !== `pisos/${p.id}/datos.json`) errores.push(`edificio.json: ${p.id}.datos debe ser pisos/${p.id}/datos.json`)
        if (p.config != null && !archivos.has(p.config)) errores.push(`edificio.json: ${p.id}.config apunta a ${p.config}, que no está en el paquete`)
        for (const g of [].concat(p.glb ?? [])) {
          if (typeof g !== 'string' || !g.startsWith(`pisos/${p.id}/`) || !archivos.has(g)) errores.push(`edificio.json: ${p.id}.glb apunta a ${g}, que no está en el paquete`)
        }
      }
      if (e.pisoInicial != null && !claves.includes(e.pisoInicial)) errores.push(`edificio.json: pisoInicial ${e.pisoInicial} no está en el manifiesto`)
      if (e.conectores != null && !Array.isArray(e.conectores)) errores.push('edificio.json: conectores debe ser una lista')
      for (const c of Array.isArray(e.conectores) ? e.conectores : []) {
        for (const p of Array.isArray(c?.paradas) ? c.paradas : []) {
          if (!claves.includes(p?.piso)) errores.push(`edificio.json: el conector ${c?.id} para en el piso ${p?.piso}, que no está en el paquete`)
          else if (ids[p.piso] && !ids[p.piso].includes(p.ambiente)) avisos.push(`edificio.json: el conector ${c?.id} para en ${p.piso}:${p.ambiente}, que no está en el datos.json del piso`)
        }
      }
    }
  }
  return { errores, avisos, manifiesto: esObj(m) ? m : null }
}

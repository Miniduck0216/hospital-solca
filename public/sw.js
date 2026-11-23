// Memoria del mapa en el navegador (service worker). El plano, los modelos 3D y el programa se guardan la primera vez
// y luego se abren desde el equipo: el tótem no vuelve a descargar ~30 MB cada vez que se abre el mapa.
// - Archivos con versión (?v=… o /assets/ con huella): se sirven de la memoria; cada publicación trae otra versión
//   y la memoria anterior se borra sola.
// - La página (index.html): primero la red (para recibir cambios) y, si no hay conexión, la guardada.
// - Teselas y fuentes del mapa base: de la memoria, renovándose en segundo plano (hasta ~1500 archivos).
// - Información de los ambientes publicada en OM3 (…/mapa/publicado): primero la red y, si no hay conexión o OM3 no
//   responde, la última que llegó (así el tótem no se queda sin nombres por un corte).
// - Dibujo publicado en OM3 (…/geo y …/geo/<versión>/archivo?ruta=…): el manifiesto, primero la red y si no, el último;
//   los archivos, de la memoria. La clave es la dirección, que lleva el número de versión: dos versiones no se mezclan.
//   Al llegar un manifiesto nuevo se borran los archivos de las otras versiones. El borrador (?vista=) no se guarda.
const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev'
const PROPIO = `solca-${VERSION}`
const TESELAS = 'solca-teselas'
const OM3 = 'solca-om3'
const GEO = 'solca-geo'
const MAX_TESELAS = 1500

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('solca-') && k !== PROPIO && k !== TESELAS && k !== OM3 && k !== GEO) await caches.delete(k)
    await self.clients.claim()
  })())
})

const deMapaBase = (u) => /(^|\.)openfreemap\.org$|(^|\.)gstatic\.com$|fonts\.googleapis\.com$/.test(u.hostname)
const deOm3 = (u) => /\/mapa\/publicado$/.test(u.pathname)
const esGeo = (u) => /\/geo\/?$/.test(u.pathname)
const ARCHIVO_GEO = /\/geo\/([^/]+)\/archivo$/

// manifiesto del dibujo: primero la red; si cambió la versión, se borran los archivos de las demás
async function manifiestoGeo(req) {
  const c = await caches.open(GEO)
  try {
    const r = await fetch(req)
    if (!r.ok) return r.status === 404 ? r : ((await c.match(req)) || r)
    c.put(req, r.clone())
    const m = await r.clone().json().catch(() => null)
    const v = m && String(m.version?.id ?? m.version)
    if (v) {
      // solo se borran las versiones viejas del mismo edificio de la misma sede (los archivos llevan ?sede=&edificio=):
      // el plano de otra sede o de otro edificio que ya está en caché se conserva
      const pedido = new URL(req.url)
      const sede = pedido.searchParams.get('sede'), edificio = pedido.searchParams.get('edificio')
      const raiz = pedido.pathname.replace(/\/geo\/?$/, '/geo/')
      for (const k of await c.keys()) {
        const ku = new URL(k.url)
        const x = ku.pathname.match(ARCHIVO_GEO)
        if (x && ku.pathname.startsWith(raiz) && x[1] !== v && sede && edificio &&
            ku.searchParams.get('sede') === sede && ku.searchParams.get('edificio') === edificio) await c.delete(k)
      }
    }
    return r
  } catch {
    return (await c.match(req)) || Response.error()
  }
}
async function archivoGeo(req) {
  const c = await caches.open(GEO)
  const hit = await c.match(req)
  if (hit) return hit
  const r = await fetch(req)
  if (r.ok) c.put(req, r.clone())
  return r
}

async function redOUltima(req) {
  const c = await caches.open(OM3)
  try {
    const r = await fetch(req)
    if (r.ok) { c.put(req, r.clone()); return r }
    return (await c.match(req)) || r
  } catch {
    return (await c.match(req)) || Response.error()
  }
}

async function primeroMemoria(req) {
  const c = await caches.open(PROPIO)
  const hit = await c.match(req)
  if (hit) return hit
  const r = await fetch(req)
  if (r.ok) c.put(req, r.clone())
  return r
}
async function primeroRed(req) {
  const c = await caches.open(PROPIO)
  try {
    const r = await fetch(req)
    if (r.ok) c.put(req, r.clone())
    return r
  } catch {
    return (await c.match(req, { ignoreSearch: true })) || Response.error()
  }
}
let podando = false
async function podar(c) {
  if (podando) return
  podando = true
  try {
    const ks = await c.keys()
    for (let i = 0; i < ks.length - MAX_TESELAS; i++) await c.delete(ks[i])
  } finally { podando = false }
}
async function memoriaYRenovar(e) {
  const c = await caches.open(TESELAS)
  const hit = await c.match(e.request)
  const red = fetch(e.request).then((r) => {
    if (r.ok || r.type === 'opaque') { c.put(e.request, r.clone()); podar(c) }
    return r
  }).catch(() => hit)
  if (hit) { e.waitUntil(red); return hit }
  return red
}

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const u = new URL(req.url)
  // OM3: en GitHub Pages es otro origen; en el portal de OM3 (mapa en /mapa/) es el mismo origen (/api/…)
  if (deOm3(u)) { e.respondWith(redOUltima(req)); return }
  if (!u.searchParams.has('vista')) {
    if (esGeo(u)) { e.respondWith(manifiestoGeo(req)); return }
    if (ARCHIVO_GEO.test(u.pathname)) { e.respondWith(archivoGeo(req)); return }
  }
  if (u.origin === self.location.origin) {
    // en el portal de OM3, lo que está fuera de la carpeta del mapa (el resto del portal, su API) no se toca
    if (!u.pathname.startsWith(new URL('./', self.location.href).pathname)) return
    if (req.mode === 'navigate') { e.respondWith(primeroRed(req)); return }
    if (u.searchParams.has('v') || u.pathname.includes('/assets/') || u.pathname.includes('/marca/')) { e.respondWith(primeroMemoria(req)); return }
    return
  }
  if (deMapaBase(u)) e.respondWith(memoriaYRenovar(e))
})

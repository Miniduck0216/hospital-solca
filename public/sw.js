// Memoria del mapa en el navegador (service worker). El plano, los modelos 3D y el programa se guardan la primera vez
// y luego se abren desde el equipo: el tótem no vuelve a descargar ~30 MB cada vez que se abre el mapa.
// - Archivos con versión (?v=… o /assets/ con huella): se sirven de la memoria; cada publicación trae otra versión
//   y la memoria anterior se borra sola.
// - La página (index.html): primero la red (para recibir cambios) y, si no hay conexión, la guardada.
// - Teselas y fuentes del mapa base: de la memoria, renovándose en segundo plano (hasta ~1500 archivos).
const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev'
const PROPIO = `solca-${VERSION}`
const TESELAS = 'solca-teselas'
const MAX_TESELAS = 1500

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('solca-') && k !== PROPIO && k !== TESELAS) await caches.delete(k)
    await self.clients.claim()
  })())
})

const deMapaBase = (u) => /(^|\.)openfreemap\.org$|(^|\.)gstatic\.com$|fonts\.googleapis\.com$/.test(u.hostname)

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
  if (u.origin === self.location.origin) {
    if (!u.pathname.startsWith(new URL('./', self.location.href).pathname)) return
    if (req.mode === 'navigate') { e.respondWith(primeroRed(req)); return }
    if (u.searchParams.has('v') || u.pathname.includes('/assets/') || u.pathname.includes('/marca/')) { e.respondWith(primeroMemoria(req)); return }
    return
  }
  if (deMapaBase(u)) e.respondWith(memoriaYRenovar(e))
})

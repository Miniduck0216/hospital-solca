// Georreferenciación del plano interior de SOLCA sobre la huella real del edificio en OpenStreetMap
// (way 396030970, «Solca», building=hospital). Ajuste de similitud (rotación, escala y traslación)
// que maximiza la superposición de polígonos (IoU ≈ 0.87). Datos © OpenStreetMap contributors (ODbL).
export const ROT = -0.3752457891787809                 // rotación del plano (rad); -21.5° ≈ ángulo del norte del modelo
export const ESC = 0.8948551836579328        // metros geográficos por metro del plano
const CP = [81.6222, 69.6667]     // centro del plano (m)
const CO = [-7.1850, -1.3390]     // centro de la huella OSM en metros ENU locales
const LAT0 = -0.1366, LON0 = -78.4689
const M_LAT = 110574, M_LON = 111320 * Math.cos((LAT0 * Math.PI) / 180)

/** (x, y) del plano → [lon, lat] */
export function aLonLat(x, y) {
  const dx = x - CP[0], dy = y - CP[1]
  const c = Math.cos(ROT), s = Math.sin(ROT)
  const e = ESC * (c * dx - s * dy) + CO[0]
  const n = ESC * (s * dx + c * dy) + CO[1]
  return [LON0 + e / M_LON, LAT0 + n / M_LAT]
}

/** rectángulo del plano {x, y, w, h} → [[oeste, sur], [este, norte]] */
export function limitesGeo(r) {
  const pts = [aLonLat(r.x, r.y), aLonLat(r.x + r.w, r.y), aLonLat(r.x, r.y + r.h), aLonLat(r.x + r.w, r.y + r.h)]
  const lo = pts.map((p) => p[0]), la = pts.map((p) => p[1])
  return [[Math.min(...lo), Math.min(...la)], [Math.max(...lo), Math.max(...la)]]
}

import { H } from './datos.js'

export const RADIO = 0.25
const porPiso = {}
for (const [p, lista] of Object.entries(H.obstaculos)) porPiso[p] = lista.map(([x0, y0, x1, y1, que]) => ({ x0, y0, x1, y1, que }))

const en = (piso, x, y, r = RADIO) => (porPiso[piso] || []).find((o) => x > o.x0 - r && x < o.x1 + r && y > o.y0 - r && y < o.y1 + r) || null
export const puntoLibre = (piso, x, y, r = RADIO) => !en(piso, x, y, r)
export function segmentoLibre(piso, a, b, r = RADIO) {
  const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 0.04))
  for (let i = 0; i <= n; i++) {
    const x = a.x + ((b.x - a.x) * i) / n
    const y = a.y + ((b.y - a.y) * i) / n
    const o = en(piso, x, y, r)
    if (o) return { libre: false, x, y, o }
  }
  return { libre: true }
}

// Prueba de colisiones: aristas del grafo + 3 000 caminatas al azar entre clics en ambientes de distintos pisos
import { H, nodeById, cuartoEn, tipoArista } from '../src/lib/datos.js'
import { segmentoLibre } from '../src/lib/obstaculos.js'
import { planificar, destinoEnAmbiente } from '../src/lib/navegacion.js'

let errores = 0
const mal = (...m) => { errores++; if (errores < 60) console.log('✗', ...m) }
for (const [a, b, t] of H.aristas) {
  if (t !== 'caminar') continue
  const A = nodeById[a], B = nodeById[b]
  if (A.piso !== B.piso) continue
  const r = segmentoLibre(A.piso, A, B)
  if (!r.libre) mal(`arista ${a} → ${b}: ${r.o.que} en (${r.x.toFixed(2)}, ${r.y.toFixed(2)})`)
}
let semilla = 11
const rnd = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647)
const cuartos = H.cuartos.filter((c) => c.tipo !== 'escalera' && c.tipo !== 'ascensores')
let ok = 0
for (let k = 0; k < 1500; k++) {
  const co = cuartos[Math.floor(rnd() * cuartos.length)], cd = cuartos[Math.floor(rnd() * cuartos.length)]
  const o = destinoEnAmbiente(co.piso, co.x0 + rnd() * (co.x1 - co.x0), co.y0 + rnd() * (co.y1 - co.y0))
  if (!o) continue
  const pos = { ...o.punto, piso: co.piso, h: co.piso * H.alturaPiso }
  const plan = planificar({ pos, anclas: o.nodos.map((n) => n.id) }, { tipo: 'punto', piso: cd.piso, x: cd.x0 + rnd() * (cd.x1 - cd.x0), y: cd.y0 + rnd() * (cd.y1 - cd.y0) }, { accesible: rnd() < 0.3 })
  if (!plan) { mal('sin plan', co.id, '→', cd.id); continue }
  ok++
  for (let i = 1; i < plan.puntos.length; i++) {
    const A = plan.puntos[i - 1], B = plan.puntos[i]
    if (A.piso !== B.piso || (A.id && B.id && tipoArista(A.id, B.id) !== 'caminar')) continue
    const r = segmentoLibre(A.piso, A, B)
    if (!r.libre) { mal(`${co.id} → ${cd.id}: ${r.o.que} en (${r.x.toFixed(2)}, ${r.y.toFixed(2)})`); break }
  }
}
console.log(errores ? `\n${errores} problemas` : `✓ Sin colisiones · ${H.aristas.length} aristas · ${ok} caminatas al azar entre pisos`)
process.exit(errores ? 1 : 0)

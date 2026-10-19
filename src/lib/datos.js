import H from '../data/hospital3d.json'

export { H }
export const H_PISO = H.alturaPiso
export const NIVELES = H.pisos.map((p) => p.nombre)
export const NP = H.pisos.length          // pisos del edificio; nivel NP = vista de techo
export const CLAVES = H.pisos.map((p) => p.clave.toLowerCase())
export const nodeById = Object.fromEntries(H.nodos.map((n) => [n.id, n]))
export const cuartoById = Object.fromEntries(H.cuartos.map((c) => [c.id, c]))

// Plano (x, y) en metros → escena (X, Y, Z). El centro del edificio queda en el origen y el norte al fondo.
const CX = H.ancho / 2
const CY = H.largo / 2
export const aEscena = (x, y, h = 0) => [x - CX, h, CY - y]
export const dePlano = (X, Z) => ({ x: X + CX, y: CY - Z })

const dentro = (c, x, y) => x >= c.x0 - 1e-6 && x <= c.x1 + 1e-6 && y >= c.y0 - 1e-6 && y <= c.y1 + 1e-6
// el ambiente más pequeño que contiene el punto (los pasillos pierden frente a los cuartos)
export function cuartoEn(piso, x, y) {
  let mejor = null
  for (const c of H.cuartos) {
    if (c.piso !== piso || !dentro(c, x, y)) continue
    const k = (c.tipo === 'pasillo' ? 1e6 : 0) + (c.x1 - c.x0) * (c.y1 - c.y0)
    if (!mejor || k < mejor.k) mejor = { c, k }
  }
  return mejor ? mejor.c : null
}
export const nodosDeZona = (zona) => H.nodos.filter((n) => n.zona === zona && n.tipo !== 'puerta')
export const nodoAmbiente = (zona) => H.nodos.find((n) => n.tipo === 'ambiente' && n.ref === zona)

// tipo de cada arista (caminar / escalera / ascensor)
const tipos = new Map()
for (const [a, b, t] of H.aristas) { tipos.set(a + '|' + b, t); tipos.set(b + '|' + a, t) }
export const tipoArista = (a, b) => tipos.get(a + '|' + b) || 'caminar'

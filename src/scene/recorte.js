// Muros recortables al estilo "maqueta": cada pieza guarda su rango de altura y se recorta suavemente
// según el modo (arriba / recorte dinámico / abajo) y el piso visible.
import { useStore } from '../store.js'

const items = new Set()
export const registrar = (it) => { it.cur = it.h1; items.add(it); return () => items.delete(it) }

const ALTO_ABAJO = 0.35
export function actualizarRecorte(camara, objetivo, dt) {
  const { nivel, modoMuros } = useStore.getState()
  const pisoArriba = Math.min(nivel, 2)
  let vx = camara.position.x - objetivo.x
  let vz = camara.position.z - objetivo.z
  const l = Math.hypot(vx, vz) || 1
  vx /= l; vz /= l
  const k = Math.min(1, dt * 9)
  for (const it of items) {
    let meta = it.h1
    if (it.piso === pisoArriba && nivel < 3) {
      if (modoMuros === 'abajo') meta = Math.min(it.h1, ALTO_ABAJO)
      else if (modoMuros === 'recorte') {
        const s = it.cx * vx + it.cz * vz
        if (s > -3) meta = Math.min(it.h1, ALTO_ABAJO)
      }
    }
    it.cur += (meta - it.cur) * k
    const top = Math.min(it.h1, it.cur)
    const alto = top - it.h0
    const m = it.mesh
    if (!m) continue
    if (alto < 0.01) { m.visible = false; if (it.tapa) it.tapa.visible = false; continue }
    m.visible = true
    m.scale.y = alto
    m.position.y = it.base + it.h0 + alto / 2
    if (it.tapa) {
      const recortado = top < it.h1 - 0.02
      it.tapa.visible = it.rol !== 'alto' || !recortado
      it.tapa.position.y = it.base + top + 0.006
    }
  }
}

import { useLayoutEffect, useRef } from 'react'
import { aEscena } from '../lib/datos.js'
import { caja, mat, COLOR } from './materiales.js'
import { registrar } from './recorte.js'

// Caja del plano (x0,y0)-(x1,y1) entre las alturas h0 y h1 sobre "base". Si es recortable baja con el modo de muros.
export function Pieza({ piso = 0, x0, y0, x1, y1, h0 = 0, h1, base = 0, color = '#ffffff', material, recortable = true, tapa = false, rol = 'solido', centro, sombra = true, ...props }) {
  const ref = useRef()
  const tapaRef = useRef()
  const [X, , Z] = aEscena((x0 + x1) / 2, (y0 + y1) / 2)
  const w = Math.abs(x1 - x0), d = Math.abs(y1 - y0)
  useLayoutEffect(() => {
    if (!recortable) return
    const [cx, , cz] = centro ? aEscena(centro[0], centro[1]) : [X, 0, Z]
    return registrar({ mesh: ref.current, tapa: tapaRef.current, h0, h1, base, piso, cx, cz, rol })
  }, [recortable, h0, h1, base, piso, X, Z, rol, centro])
  return (
    <>
      <mesh ref={ref} geometry={caja} material={material || mat(color)} position={[X, base + (h0 + h1) / 2, Z]} scale={[w, h1 - h0, d]} castShadow={sombra} receiveShadow {...props} />
      {tapa && <mesh ref={tapaRef} geometry={caja} material={mat(COLOR.remate)} position={[X, base + h1 + 0.006, Z]} scale={[w + 0.004, 0.012, d + 0.004]} />}
    </>
  )
}

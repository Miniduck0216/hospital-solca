// «Paso a paso»: las indicaciones de la ruta, cada una con el piso y el punto del plano donde ocurre, para recorrerlas a
// mano (anterior / siguiente) sin iniciar la caminata. Sin React: lo usan App.jsx y las pruebas.

/**
 * Punto a cierta distancia sobre una polilínea.
 * @param pts polilínea [[x, y], …] en metros del plano
 * @param metros distancia desde el primer punto; se recorta a los extremos (negativa: el inicio; de más: el final)
 * @returns [x, y], o null si la polilínea está vacía
 */
export function puntoEn(pts, metros) {
  if (!pts || !pts.length) return null
  if (!(metros > 0)) return [pts[0][0], pts[0][1]]
  let falta = metros
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i]
    const l = Math.hypot(bx - ax, by - ay)
    if (l > 0 && falta <= l) {
      const k = falta / l
      return [ax + (bx - ax) * k, ay + (by - ay) * k]
    }
    falta -= l
  }
  const u = pts[pts.length - 1]
  return [u[0], u[1]]
}

/**
 * Pasos de la ruta en el mismo orden que la lista del panel de ruta: los de cada tramo (sin el «Sal desde…» de los
 * tramos siguientes al primero) y, tras el primer tramo, el cambio de piso (ascensor o escalera).
 * @param ruta { tramos: [{ piso, pts, esquinas?, pasos: [{ tipo, texto, en }] }], vertical?: { tipo, texto } }
 * @returns [{ tipo, texto, piso, punto: [x, y] }]
 */
export function listaPasos(ruta) {
  if (!ruta || !ruta.tramos?.length) return []
  const out = []
  ruta.tramos.forEach((t, k) => {
    // «en» se mide sobre las esquinas (la línea estirada, ver indicaciones() en ruta.js); si no están, sobre la ruta
    const linea = t.esquinas?.length ? t.esquinas : t.pts
    t.pasos.forEach((p, i) => {
      if (k > 0 && i === 0) return
      // el último paso de un tramo intermedio («Llega a los ascensores») se reescribe sin «en»: va al final del tramo
      const punto = puntoEn(linea, p.en ?? Infinity)
      out.push({ tipo: p.tipo, texto: p.texto, piso: t.piso, punto })
    })
    if (k === 0 && ruta.vertical) {
      // el cambio de piso ocurre donde termina el primer tramo
      out.push({ tipo: ruta.vertical.tipo === 'escalera' ? 'escalera' : 'ascensor', texto: ruta.vertical.texto, piso: t.piso, punto: puntoEn(t.pts, Infinity) })
    }
  })
  return out
}

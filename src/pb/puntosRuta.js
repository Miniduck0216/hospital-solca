// Trazo de la ruta como pasos: puntos redondos a distancia constante en metros sobre la línea, con sus giros.
// El mapa 2D, el Plano y el 3D dibujan estos mismos puntos (ver Mapa.jsx y Vista3D.jsx).

// metros entre dos pasos cuando se ven todos (de cerca): puntos seguidos, para que el trazo se lea como una línea de
// huellas. De lejos el mapa muestra uno de cada 2, 4, 8… (ver CADA): la distancia entre pasos sigue siendo la misma a
// lo largo de toda la ruta.
export const PASO_RUTA = 0.4

/**
 * Puntos de la ruta cada `paso` metros, desde el origen hasta el destino (el último va siempre en el destino).
 * @param pts línea de la ruta [[x, y], …] en metros del plano
 * @returns [{ x, y, s, k, dx, dy }]: s metros desde el origen, k número de paso, (dx, dy) dirección de avance
 */
export function puntosRuta(pts, paso = PASO_RUTA) {
  const out = []
  if (!pts?.length || !(paso > 0)) return out
  if (pts.length === 1) return [{ x: pts[0][0], y: pts[0][1], s: 0, k: 0, dx: 1, dy: 0 }]
  let acum = 0, sig = 0, k = 0, ult = null
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i]
    const l = Math.hypot(bx - ax, by - ay)
    if (!l) continue
    const dx = (bx - ax) / l, dy = (by - ay) / l
    while (sig <= acum + l + 1e-9) {
      const t = sig - acum
      out.push({ x: ax + dx * t, y: ay + dy * t, s: sig, k: k++, dx, dy })
      sig = k * paso
    }
    acum += l
    ult = { x: bx, y: by, dx, dy }
  }
  // el destino: si el último paso quedó a más de medio paso, se agrega uno en el destino; si quedó muy cerca, se mueve
  const u = out[out.length - 1]
  if (ult && acum - u.s > paso * 0.5) out.push({ x: ult.x, y: ult.y, s: acum, k: k++, dx: ult.dx, dy: ult.dy })
  else if (ult && u.s > 0) Object.assign(u, { x: ult.x, y: ult.y, s: acum })
  return out
}

// cada cuántos pasos se dibuja uno según el zoom del mapa: solo se ralean cuando de verdad se pegarían (menos de 7,5
// píxeles entre centros con puntos de unos 5 px). En el zoom z un metro mide unos 6,7·2^(z−20) píxeles.
export const CADA = [[21.5, 1], [20.5, 2], [19.5, 4], [18.5, 8], [17.5, 16], [16.5, 32], [15.5, 64], [0, 128]]

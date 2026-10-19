// Estado que cambia en cada cuadro (no pasa por React para no re-renderizar)
export const vivo = {
  personaje: { x: 0, y: 0, h: 0, piso: 0, moviendo: false },
  hora: 10,      // 0–24
  noche: 0,        // 0 = día, 1 = noche
  viento: 0,
  enfocar: null,   // punto de la escena hacia donde mover la cámara
}

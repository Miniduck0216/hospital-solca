import * as THREE from 'three'

const cache = new Map()
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts)
  if (!cache.has(key)) cache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...opts }))
  return cache.get(key)
}
export const caja = new THREE.BoxGeometry(1, 1, 1)

// Vidrios compartidos: de noche brillan con luz cálida (los actualiza Cielo)
export const vidrio = new THREE.MeshStandardMaterial({ color: '#9CC9EE', transparent: true, opacity: 0.38, roughness: 0.1, metalness: 0.1, emissive: '#FFC27A', emissiveIntensity: 0 })
export const vidrioBaranda = new THREE.MeshStandardMaterial({ color: '#BFE0F7', transparent: true, opacity: 0.3, roughness: 0.1 })
export const focoCalido = new THREE.MeshStandardMaterial({ color: '#FFE7B0', emissive: '#FFD27A', emissiveIntensity: 0 })
export const farosAuto = new THREE.MeshStandardMaterial({ color: '#FFF6D8', emissive: '#FFF1C2', emissiveIntensity: 0 })

export const COLOR = {
  muroExt: '#F3F5F8', muroInt: '#FAFBFC', remate: '#1E3A5F', marco: '#2F5D8A',
  ruta: '#E2532D', nodo: '#2F6FB0', madera: '#C79A6B',
  pisos: { dorm: '#D9BC94', bano: '#E4ECF2', cocina: '#E9EEF2', estar: '#EDE3D3', pasillo: '#E6DCCB', ext: '#CFCAC2', terraza: '#D8D0C4', escalera: '#C9A77E', lav: '#E4ECF2', estudio: '#D9BC94' },
}
export function colorPiso(r) {
  if (r.tipo === 'exterior') return r.id === 'terraza' ? COLOR.pisos.terraza : COLOR.pisos.ext
  if (r.tipo === 'pasillo') return COLOR.pisos.pasillo
  if (r.tipo === 'escalera') return COLOR.pisos.escalera
  if (r.id.startsWith('dorm') || r.id === 'estudio') return COLOR.pisos.dorm
  if (r.id.startsWith('bano') || r.id === 'lav') return COLOR.pisos.bano
  if (r.id === 'cocina') return COLOR.pisos.cocina
  return COLOR.pisos.estar
}

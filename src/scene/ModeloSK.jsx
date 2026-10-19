// Modelo del hospital idéntico al de SketchUp: se construye desde los mismos datos que hospital_sketchup.rb
// (muros unidos con corte a 2,60 m, losas, acabados con textura, componentes, exterior, techo y letreros).
import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import M from '../data/modelo_sk.json'
import { H, H_PISO, NP } from '../lib/datos.js'
import { useStore } from '../store.js'
import { vivo } from '../lib/vivo.js'

const CX = H.ancho / 2, CY = H.largo / 2
// plano (x, y, z arriba) → escena (X, Y arriba, Z): X = x − CX, Y = z, Z = CY − y
const PLANO_A_ESCENA = new THREE.Matrix4().set(1, 0, 0, -CX, 0, 0, 1, 0, 0, -1, 0, CY, 0, 0, 0, 1)

// ---------- acumulador de triángulos por material
class Acum {
  constructor() { this.p = []; this.n = []; this.uv = [] }
  tri(a, b, c, n) {
    const ax = Math.abs(n[0]), ay = Math.abs(n[1]), az = Math.abs(n[2])
    for (const v of [a, b, c]) {
      this.p.push(v[0], v[1], v[2]); this.n.push(n[0], n[1], n[2])
      if (ax >= ay && ax >= az) this.uv.push(v[1], v[2]); else if (ay >= az) this.uv.push(v[0], v[2]); else this.uv.push(v[0], v[1])
    }
  }
  poligono(pts, n) {
    n = n || normalNewell(pts)
    if (pts.length <= 4) { for (let i = 1; i < pts.length - 1; i++) this.tri(pts[0], pts[i], pts[i + 1], n); return }
    // polígonos cóncavos (flechas): triangulación en 2D
    const ax = Math.abs(n[0]) >= Math.abs(n[1]) && Math.abs(n[0]) >= Math.abs(n[2]) ? 0 : Math.abs(n[1]) >= Math.abs(n[2]) ? 1 : 2
    const [i, j] = [0, 1, 2].filter((k) => k !== ax)
    const tris = THREE.ShapeUtils.triangulateShape(pts.map((p) => new THREE.Vector2(p[i], p[j])), [])
    for (const [a, b, c] of tris) this.tri(pts[a], pts[b], pts[c], n)
  }
  geometria() {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2))
    g.computeBoundingSphere()
    return g
  }
}
function normalNewell(pts) {
  let x = 0, y = 0, z = 0
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length]
    x += (a[1] - b[1]) * (a[2] + b[2]); y += (a[2] - b[2]) * (a[0] + b[0]); z += (a[0] - b[0]) * (a[1] + b[1])
  }
  const l = Math.hypot(x, y, z) || 1
  return [x / l, y / l, z / l]
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cruz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const punto = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const unit = (v) => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l] }

function caja(A, x0, y0, z0, x1, y1, z1) {
  const v = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]
  const q = [[[0, 3, 2, 1], [0, 0, -1]], [[4, 5, 6, 7], [0, 0, 1]], [[0, 1, 5, 4], [0, -1, 0]], [[1, 2, 6, 5], [1, 0, 0]], [[2, 3, 7, 6], [0, 1, 0]], [[3, 0, 4, 7], [-1, 0, 0]]]
  for (const [ids, n] of q) A.poligono(ids.map((i) => v[i]), n)
}
function hexa(A, p) {
  const c = [0, 1, 2].map((k) => p.reduce((s, v) => s + v[k], 0) / 8)
  for (const ids of [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]) {
    let q = ids.map((i) => p[i])
    let n = normalNewell(q)
    const m = [0, 1, 2].map((k) => q.reduce((s, v) => s + v[k], 0) / 4)
    if (punto(n, sub(m, c)) < 0) { q = q.slice().reverse(); n = n.map((x) => -x) }
    A.poligono(q, n)
  }
}
function cilindro(A, c, eje, r, largo, n) {
  const e = unit(eje)
  let a = cruz(e, Math.abs(e[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]); a = unit(a)
  const b = cruz(e, a)
  const anillo = (t) => Array.from({ length: n }, (_, k) => {
    const g = (2 * Math.PI * k) / n
    return [0, 1, 2].map((i) => c[i] + e[i] * t + r * (Math.cos(g) * a[i] + Math.sin(g) * b[i]))
  })
  const abajo = anillo(0), arriba = anillo(largo)
  for (let k = 0; k < n; k++) {
    const k2 = (k + 1) % n
    const nn = unit(sub(abajo[k], c).map((v, i) => v - e[i] * punto(sub(abajo[k], c), e)))
    A.poligono([abajo[k], abajo[k2], arriba[k2], arriba[k]], nn)
  }
  A.poligono(abajo.slice().reverse(), e.map((x) => -x))
  A.poligono(arriba, e)
}
function poliedro(A, tris) {
  const todos = tris.flat()
  const c = [0, 1, 2].map((k) => todos.reduce((s, v) => s + v[k], 0) / todos.length)
  for (let [a, b, d] of tris) {
    let n = unit(cruz(sub(b, a), sub(d, a)))
    if (punto(n, sub(a, c)) < 0) { [b, d] = [d, b]; n = n.map((x) => -x) }
    A.tri(a, b, d, n)
  }
}
function primitiva(acums, q) {
  const A = (m) => { if (!acums.has(m)) acums.set(m, new Acum()); return acums.get(m) }
  switch (q[0]) {
    case 'b': return caja(A(q[1]), ...q.slice(2, 8))
    case 'f': return A(q[1]).poligono(q[2], q[3])
    case 'h': return hexa(A(q[1]), q[2])
    case 'c': return cilindro(A(q[1]), q[2], q[3], q[4], q[5], q[6])
    case 'p': return poliedro(A(q[1]), q[2])
  }
}

// ---------- materiales
const cargador = new THREE.TextureLoader()
const texturas = new Map()
function textura(m) {
  if (!texturas.has(m.tex)) {
    const t = cargador.load(m.tex)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    texturas.set(m.tex, t)
  }
  const t = texturas.get(m.tex).clone()
  t.repeat.set(1 / m.w, 1 / m.h)
  t.needsUpdate = true
  return t
}
const nocturnos = []     // materiales que brillan de noche (luminarias y vidrios)
function material(nombre, override) {
  const m = M.mats[override || nombre] || { color: '#B8C0C8', alpha: 1 }
  const mat = new THREE.MeshStandardMaterial({ color: m.tex ? '#FFFFFF' : m.color, roughness: 0.82, metalness: 0, side: THREE.DoubleSide })
  if (m.tex) mat.map = textura(m)
  if (m.alpha < 1) { mat.transparent = true; mat.opacity = m.alpha; mat.depthWrite = false; mat.roughness = 0.1 }
  const n = override || nombre || ''
  if (/Acero|Aluminio|Pasamanos/.test(n)) { mat.metalness = 0.45; mat.roughness = 0.4 }
  if (n === 'Luminaria' || /^Vidrio$/.test(n)) { mat.emissive = new THREE.Color(n === 'Luminaria' ? '#FFF1C8' : '#FFC27A'); mat.emissiveIntensity = 0; nocturnos.push([mat, n === 'Luminaria' ? 1.4 : 0.7]) }
  return mat
}

// ---------- textos (letreros y rótulos) como planos con textura de lienzo
function texto(t) {
  const px = 96
  const ctx = document.createElement('canvas').getContext('2d')
  const fuente = `800 ${px}px "Nunito Sans", "Segoe UI", Arial, sans-serif`
  ctx.font = fuente
  const ancho = Math.ceil(ctx.measureText(t.s).width) + 16
  const lienzo = document.createElement('canvas')
  lienzo.width = ancho; lienzo.height = Math.round(px * 1.3)
  const c = lienzo.getContext('2d')
  c.font = fuente; c.fillStyle = '#fff'; c.textBaseline = 'middle'; c.textAlign = 'center'
  c.fillText(t.s, ancho / 2, lienzo.height / 2)
  const tex = new THREE.CanvasTexture(lienzo)
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4
  const alto = t.h * 1.3, w = (alto * ancho) / lienzo.height
  const mat = new THREE.MeshStandardMaterial({ map: tex, color: M.mats[t.mat]?.color || '#fff', transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 0.9 })
  const malla = new THREE.Mesh(new THREE.PlaneGeometry(w, alto), mat)
  const R = new THREE.Vector3(...t.R), U = new THREE.Vector3(...t.U), N = R.clone().cross(U)
  const m = new THREE.Matrix4().makeBasis(R, U, N).setPosition(t.o[0] + N.x * 0.004, t.o[1] + N.y * 0.004, t.o[2])
  malla.applyMatrix4(m.premultiply(PLANO_A_ESCENA))
  malla.renderOrder = 2
  return malla
}

// ---------- construcción de cada parte (una vez): todo se funde en una malla por material
const defCache = new Map()
function defAcums(nombre) {
  if (!defCache.has(nombre)) {
    const acums = new Map()
    for (const q of M.defs[nombre]) primitiva(acums, q)
    defCache.set(nombre, acums)
  }
  return defCache.get(nombre)
}
const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _nm = new THREE.Matrix3()
function construirParte(prims) {
  const grupo = new THREE.Group()
  const acums = new Map()
  const A = (m) => { if (!acums.has(m)) acums.set(m, new Acum()); return acums.get(m) }
  for (const q of prims) {
    if (q[0] !== 'i') { primitiva(acums, q); continue }
    const [, nombre, pos, rot, esc, over] = q
    const m = new THREE.Matrix4().makeRotationZ((rot * Math.PI) / 180).scale(new THREE.Vector3(esc, esc, esc)).setPosition(pos[0], pos[1], pos[2])
    _nm.getNormalMatrix(m)
    for (const [mat, src] of defAcums(nombre)) {
      const dst = A(mat || over || null)
      for (let i = 0; i < src.p.length; i += 3) {
        _v.set(src.p[i], src.p[i + 1], src.p[i + 2]).applyMatrix4(m)
        _n.set(src.n[i], src.n[i + 1], src.n[i + 2]).applyMatrix3(_nm).normalize()
        dst.p.push(_v.x, _v.y, _v.z); dst.n.push(_n.x, _n.y, _n.z)
      }
      for (const u of src.uv) dst.uv.push(u)
    }
  }
  const materiales = []
  for (const [m, a] of acums) {
    const mat = material(m); materiales.push(mat)
    const malla = new THREE.Mesh(a.geometria(), mat)
    malla.applyMatrix4(PLANO_A_ESCENA)
    malla.castShadow = !mat.transparent; malla.receiveShadow = true
    grupo.add(malla)
  }
  return { grupo, materiales }
}

export function ModeloSK() {
  const gl = useThree((s) => s.gl)
  const { nivel, modoMuros } = useStore()
  const partes = useMemo(() => {
    const out = {}
    for (const [k, prims] of Object.entries(M.partes)) out[k] = construirParte(prims)
    for (const t of M.textos) out[t.parte]?.grupo.add(texto(t))
    return out
  }, [])
  useEffect(() => { gl.localClippingEnabled = true }, [gl])

  // visibilidad por piso y modo de muros (igual que las escenas de SketchUp)
  useEffect(() => {
    const top = Math.min(nivel, NP - 1)
    const todo = nivel === NP
    for (const [k, { grupo, materiales }] of Object.entries(partes)) {
      const p = /^\d/.test(k) ? +k[0] : null
      let visible = true
      if (k === 'techo' || k === 'portal') visible = todo
      else if (p !== null) {
        if (p > top) visible = false
        else if (k.endsWith('-cielo')) visible = todo || p < top      // el cielo raso tapa la vista desde arriba
        else if (p === top && !todo && k.endsWith('-alta')) visible = modoMuros === 'arriba'
      }
      grupo.visible = visible
      const recortar = p === top && !todo && modoMuros === 'abajo' && !k.endsWith('-alta')
      const plano = recortar ? [new THREE.Plane(new THREE.Vector3(0, -1, 0), p * H_PISO + 1.1)] : []
      for (const m of materiales) { m.clippingPlanes = plano; m.needsUpdate = true }
    }
  }, [nivel, modoMuros, partes])

  useFrame(() => { for (const [m, f] of nocturnos) m.emissiveIntensity = vivo.noche * f })

  return (
    <group>
      {Object.entries(partes).map(([k, { grupo }]) => <primitive key={k} object={grupo} />)}
      {/* terreno lejano para que no termine el mundo en el borde del lote */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.82} receiveShadow>
        <planeGeometry args={[1600, 1600]} />
        <meshStandardMaterial color="#7FAE63" />
      </mesh>
    </group>
  )
}

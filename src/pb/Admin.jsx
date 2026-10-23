// Administración del plano: entrar con clave y cambiar nombre, categoría y punto de acceso de cada ambiente.
// La clave se compara como huella SHA-256 (no queda en claro en el código). Es un control del lado del cliente:
// no sustituye una autenticación real en un servidor.
import { useMemo, useState } from 'react'
import { CATS, plano } from './datos.js'

const HUELLA_CLAVE = '2f182a944ac2d44e80704f88ac2dc12730397aa40be577e899e4c4b92cea0a48'

async function huella(texto) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto))
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function Clave({ onOk, onCerrar }) {
  const [v, setV] = useState('')
  const [error, setError] = useState(false)
  const entrar = async (e) => {
    e.preventDefault()
    let ok = false
    try { ok = (await huella(v)) === HUELLA_CLAVE } catch { ok = false }
    if (ok) onOk(); else setError(true)
  }
  return (
    <div className="qr-fondo" onClick={onCerrar}>
      <form className="qr-tarjeta admin-clave" onSubmit={entrar} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Entrar como administrador">
        <small>Administración</small>
        <h3>Entrar para editar el plano</h3>
        <input type="password" autoFocus value={v} onChange={(e) => { setV(e.target.value); setError(false) }} aria-label="Clave de administración" />
        {error && <p className="ficha-aviso">Clave incorrecta.</p>}
        <div className="ficha-btns">
          <button type="button" className="btn-claro" onClick={onCerrar}>Cancelar</button>
          <button type="submit" className="btn-negro">Entrar</button>
        </div>
      </form>
    </div>
  )
}

export function PanelAdmin({ d, cambios, onCambiar, onRestablecer, pickId, onPedirPunto, onSalir }) {
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(null)
  const lista = useMemo(() => d.ambientes
    .filter((a) => a.nombre && (!q || plano(a.nombre).includes(plano(q))))
    .slice(0, 80), [d, q])
  const a = sel ? d.ambientes.find((x) => x.id === sel) : null
  const ov = (id) => cambios?.ambientes?.[id] || {}
  const descargar = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(cambios || {}, null, 2)], { type: 'application/json' }))
    const el = document.createElement('a')
    el.href = url
    el.download = 'cambios.json'
    el.click()
    URL.revokeObjectURL(url)
  }
  return (
    <div className="tarjeta admin-panel" role="dialog" aria-label="Panel de administración">
      <div className="admin-cab">
        <b>Administración del plano</b>
        <button className="btn-claro" onClick={onSalir}>Salir</button>
      </div>
      <p className="admin-nota">Las rutas de administración pueden usar los pasillos de personal; nunca cruzan cuartos.</p>
      {!a && (
        <>
          <input className="admin-buscar" placeholder="Buscar ambiente…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar ambiente" />
          <ul className="admin-lista">
            {lista.map((x) => (
              <li key={x.id}><button onClick={() => setSel(x.id)}><b>{ov(x.id).nombre || x.nombre}</b><small>{CATS[ov(x.id).cat || x.cat]?.nombre}</small></button></li>
            ))}
          </ul>
        </>
      )}
      {a && (
        <div className="admin-edit">
          <button className="btn-claro" onClick={() => { setSel(null); if (pickId) onPedirPunto(null) }}>← Lista de ambientes</button>
          <label>Nombre
            <input value={ov(a.id).nombre ?? a.nombre} onChange={(e) => onCambiar(a.id, { nombre: e.target.value })} />
          </label>
          <label>Categoría
            <select value={ov(a.id).cat ?? a.cat} onChange={(e) => onCambiar(a.id, { cat: e.target.value })}>
              {Object.entries(CATS).map(([k, c]) => <option key={k} value={k}>{c.nombre}</option>)}
            </select>
          </label>
          <button className={pickId === a.id ? 'btn-negro' : 'btn-claro'} onClick={() => onPedirPunto(pickId === a.id ? null : a.id)}>
            {pickId === a.id ? 'Toca el plano para marcar la puerta…' : 'Marcar punto de acceso en el plano'}
          </button>
          <small className="admin-punto">Punto actual: {(ov(a.id).dest ?? a.dest) ? (ov(a.id).dest ?? a.dest).map((v) => v.toFixed(1)).join(', ') : 'sin punto'}</small>
        </div>
      )}
      <div className="admin-pie">
        <button className="btn-claro" onClick={descargar}>Descargar cambios.json</button>
        <button className="btn-claro" onClick={onRestablecer}>Restablecer</button>
      </div>
    </div>
  )
}

// Administración del plano: entrar con clave y cambiar nombre, categoría y punto de acceso de cada ambiente.
// La clave se compara como huella SHA-256 (no queda en claro en el código). Es un control del lado del cliente:
// no sustituye una autenticación real en un servidor.
import { useMemo, useState } from 'react'
import { CATS, plano } from './datos.js'

const HUELLA_CLAVE = '691e6d6caa20ff82e9d5c02e5d6629e9fba4dd0ef2d54fb0aecd753ac7dcd9ad'

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

const TIPOS_PASO = {
  abrir: { nombre: 'Abrir paso', ayuda: 'Toca dos puntos a través de un muro: se abre un vano de 1 m (una puerta que el plano no tiene).' },
  cerrar: { nombre: 'Cerrar paso', ayuda: 'Toca los puntos del muro nuevo: la ruta ya no pasa por ahí (se dibuja en 2D y 3D).' },
  linea: { nombre: 'Línea de recorrido', ayuda: 'Toca los puntos del recorrido de pacientes, como una línea verde del plano.' },
}

/**
 * Panel de administración del plano (un piso). Edita:
 * - cada ambiente: nombre, categoría, punto de acceso, ventanilla, solo personal, oculto
 * - lugares nuevos (un punto con nombre: un módulo, una ventanilla, un servicio sin cuarto propio)
 * - pasos: abrir un vano, cerrar un paso con un muro, trazar una línea de recorrido de pacientes
 * Dentro de OM3 (enOm3) los cambios se guardan como borrador en el servidor; fuera, solo en este navegador.
 */
export function PanelAdmin({ d, cambios, onCambiar, onLugar, onQuitarLugar, onPaso, onQuitarPaso, onRestablecer, pick, onPick, onSalir, enOm3 = false }) {
  const [pestana, setPestana] = useState('ambientes')
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(null)
  const [nuevo, setNuevo] = useState({ nombre: '', cat: 'administracion' })
  const lista = useMemo(() => d.ambientes
    .filter((a) => (a.nombre || cambios?.ambientes?.[a.id]?.oculto) && !a.nuevo && (!q || plano(a.nombre || '').includes(plano(q))))
    .slice(0, 80), [d, q, cambios])
  const a = sel ? d.ambientes.find((x) => x.id === sel) : null
  const ov = (id) => cambios?.ambientes?.[id] || {}
  const lugares = cambios?.lugares || []
  const pasos = cambios?.pasos || []
  const descargar = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(cambios || {}, null, 2)], { type: 'application/json' }))
    const el = document.createElement('a')
    el.href = url
    el.download = 'cambios.json'
    el.click()
    URL.revokeObjectURL(url)
  }
  const casilla = (id, campo, texto, valor) => (
    <label className="admin-check">
      <input type="checkbox" checked={!!valor} onChange={(e) => onCambiar(id, { [campo]: e.target.checked })} /> {texto}
    </label>
  )
  const trazando = pick?.tipo === 'trazo'
  return (
    <div className="tarjeta admin-panel" role="dialog" aria-label="Panel de administración">
      <div className="admin-cab">
        <b>Administración · {d.piso?.nombre || 'Planta baja'}</b>
        <button className="btn-claro" onClick={onSalir}>Salir</button>
      </div>
      <p className="admin-nota">
        {enOm3 ? 'Los cambios se guardan como borrador en OM3; se ven en el tótem cuando se publican.' : 'Los cambios se guardan solo en este navegador.'} Se aplican igual en 2D y en 3D.
      </p>
      <div className="pb-seg admin-pestanas" role="tablist">
        {[['ambientes', 'Ambientes'], ['lugares', 'Lugares nuevos'], ['pasos', 'Pasos y muros']].map(([k, t]) => (
          <button key={k} role="tab" aria-selected={pestana === k} onClick={() => { setPestana(k); onPick(null) }}>{t}</button>
        ))}
      </div>

      {pestana === 'ambientes' && !a && (
        <>
          <input className="admin-buscar" placeholder="Buscar ambiente…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar ambiente" />
          <ul className="admin-lista">
            {lista.map((x) => (
              <li key={x.id}><button onClick={() => setSel(x.id)}><b>{ov(x.id).oculto ? `(oculto) ${x.id}` : ov(x.id).nombre || x.nombre}</b><small>{CATS[ov(x.id).cat || x.cat]?.nombre}</small></button></li>
            ))}
          </ul>
        </>
      )}
      {pestana === 'ambientes' && a && (
        <div className="admin-edit">
          <button className="btn-claro" onClick={() => { setSel(null); onPick(null) }}>← Lista de ambientes</button>
          <label>Nombre
            <input value={ov(a.id).nombre ?? a.nombre ?? ''} maxLength={80} onChange={(e) => onCambiar(a.id, { nombre: e.target.value })} />
          </label>
          <label>Categoría
            <select value={ov(a.id).cat ?? a.cat} onChange={(e) => onCambiar(a.id, { cat: e.target.value })}>
              {Object.entries(CATS).map(([k, c]) => <option key={k} value={k}>{c.nombre}</option>)}
            </select>
          </label>
          <button className={pick?.id === a.id ? 'btn-negro' : 'btn-claro'} onClick={() => onPick(pick?.id === a.id ? null : { tipo: 'dest', id: a.id })}>
            {pick?.id === a.id ? 'Toca el plano para marcar la puerta…' : 'Marcar punto de acceso en el plano'}
          </button>
          <small className="admin-punto">Punto actual: {(ov(a.id).dest ?? a.dest) ? (ov(a.id).dest ?? a.dest).map((v) => v.toFixed(1)).join(', ') : 'sin punto'}</small>
          {casilla(a.id, 'ventanilla', 'Atiende por ventanilla (la ruta llega al punto y no entra)', ov(a.id).ventanilla ?? a.ventanilla)}
          {casilla(a.id, 'personal', 'Solo personal (no es destino de pacientes)', ov(a.id).personal ?? a.personal)}
          {casilla(a.id, 'oculto', 'Ocultar (sin nombre ni letrero)', ov(a.id).oculto)}
        </div>
      )}

      {pestana === 'lugares' && (
        <div className="admin-edit">
          <label>Nombre del lugar
            <input value={nuevo.nombre} maxLength={80} placeholder="Ej.: Módulo 06 · Gestión Privados" onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
          </label>
          <label>Categoría
            <select value={nuevo.cat} onChange={(e) => setNuevo({ ...nuevo, cat: e.target.value })}>
              {Object.entries(CATS).map(([k, c]) => <option key={k} value={k}>{c.nombre}</option>)}
            </select>
          </label>
          <button className={pick?.tipo === 'lugar' ? 'btn-negro' : 'btn-claro'} disabled={!nuevo.nombre.trim()}
            onClick={() => onPick(pick?.tipo === 'lugar' ? null : { tipo: 'lugar', datos: { ...nuevo, nombre: nuevo.nombre.trim() } })}>
            {pick?.tipo === 'lugar' ? 'Toca el plano donde se atiende…' : 'Ubicar en el plano'}
          </button>
          <ul className="admin-lista">
            {lugares.map((l) => (
              <li key={l.id} className="admin-fila">
                <span><b>{l.nombre}</b><small>{CATS[l.cat]?.nombre} · {l.x.toFixed(1)}, {l.y.toFixed(1)}</small></span>
                <button className="btn-claro" onClick={() => onQuitarLugar(l.id)} aria-label={`Quitar ${l.nombre}`}>Quitar</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pestana === 'pasos' && (
        <div className="admin-edit">
          <div className="admin-tipos">
            {Object.entries(TIPOS_PASO).map(([k, t]) => (
              <button key={k} className={trazando && pick.paso === k ? 'btn-negro' : 'btn-claro'}
                onClick={() => onPick(trazando && pick.paso === k ? null : { tipo: 'trazo', paso: k, puntos: [] })}>{t.nombre}</button>
            ))}
          </div>
          {trazando && (
            <>
              <p className="admin-nota">{TIPOS_PASO[pick.paso].ayuda} Puntos: {pick.puntos.length}</p>
              <div className="admin-pie">
                <button className="btn-negro" disabled={pick.puntos.length < 2} onClick={() => { onPaso({ tipo: pick.paso, puntos: pick.puntos }); onPick(null) }}>Guardar</button>
                <button className="btn-claro" disabled={!pick.puntos.length} onClick={() => onPick({ ...pick, puntos: pick.puntos.slice(0, -1) })}>Deshacer punto</button>
                <button className="btn-claro" onClick={() => onPick(null)}>Cancelar</button>
              </div>
            </>
          )}
          <ul className="admin-lista">
            {pasos.map((p, i) => (
              <li key={i} className="admin-fila">
                <span><b>{TIPOS_PASO[p.tipo]?.nombre}</b><small>{p.puntos.length} puntos</small></span>
                <button className="btn-claro" onClick={() => onQuitarPaso(i)}>Quitar</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="admin-pie">
        {!enOm3 && <button className="btn-claro" onClick={descargar}>Descargar cambios.json</button>}
        <button className="btn-claro" onClick={onRestablecer}>{enOm3 ? 'Descartar borrador' : 'Restablecer'}</button>
      </div>
    </div>
  )
}

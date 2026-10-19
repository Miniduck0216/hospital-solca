import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { enlaceDe, NOMBRES_PISO } from '../../lib/lugares.js'

// Código QR de un punto de partida (como los letreros "Usted está aquí" de los kioscos)
export function QR({ lugar, onCerrar }) {
  const [svg, setSvg] = useState('')
  const [copiado, setCopiado] = useState(false)
  const url = enlaceDe(lugar)
  useEffect(() => {
    QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#14181F', light: '#FFFFFF' } }).then(setSvg)
  }, [url])
  const copiar = () => navigator.clipboard?.writeText(url).then(() => setCopiado(true))
  return (
    <div className="qr-fondo" onClick={onCerrar}>
      <div className="qr-tarjeta" role="dialog" aria-label={`Código QR de ${lugar.nombre}`} onClick={(e) => e.stopPropagation()}>
        <small>Usted está aquí</small>
        <h3>{lugar.nombre}</h3>
        <p>{NOMBRES_PISO[lugar.piso]} · Hospital SOLCA</p>
        <div className="qr-img" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="qr-nota">Escanea para ver cómo llegar a cualquier servicio desde este punto.</p>
        <input readOnly value={url} onFocus={(e) => e.target.select()} aria-label="Enlace" />
        <div className="ficha-btns">
          <button className="btn-claro" onClick={copiar}>{copiado ? 'Copiado' : 'Copiar enlace'}</button>
          <button className="btn-claro" onClick={() => window.print()}>Imprimir</button>
          <button className="btn-negro" onClick={onCerrar}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}

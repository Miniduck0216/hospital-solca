import { H, aEscena } from '../lib/datos.js'
import { Pieza } from './Pieza.jsx'

// Modelos simples a partir de la huella de cada bloque de AutoCAD ("fondo" = lado que va contra el muro)
export function Muebles({ piso, base }) {
  return H.muebles.filter((m) => m.piso === piso && m.b !== 'ELEVADOR').map((m, i) => <Mueble key={i} m={m} base={base} />)
}

function franja(m, lado, g) {
  // lado: 'fondo' o 'frente' según el vector fondo
  const [fx, fy] = m.fondo
  const s = lado === 'fondo' ? 1 : -1
  if (fx * s > 0) return { x0: m.x1 - g, x1: m.x1, y0: m.y0, y1: m.y1 }
  if (fx * s < 0) return { x0: m.x0, x1: m.x0 + g, y0: m.y0, y1: m.y1 }
  if (fy * s > 0) return { x0: m.x0, x1: m.x1, y0: m.y1 - g, y1: m.y1 }
  return { x0: m.x0, x1: m.x1, y0: m.y0, y1: m.y0 + g }
}
const encoger = (m, d) => ({ x0: m.x0 + d, x1: m.x1 - d, y0: m.y0 + d, y1: m.y1 - d })
const largo = (m) => (m.fondo[0] !== 0 ? m.x1 - m.x0 : m.y1 - m.y0)

function Mueble({ m, base }) {
  const R = { x0: m.x0, x1: m.x1, y0: m.y0, y1: m.y1 }
  const P = (props) => <Pieza recortable={false} base={base} piso={m.piso} {...props} />
  switch (m.b) {
    case 'CAMA_HOSP': case 'CAMA_UCI': case 'CAMA_SIMPLE': {
      const L = largo(m)
      return (<>
        <P {...encoger(R, 0.03)} h0={0.25} h1={0.45} color="#C9D3DD" />
        <P {...encoger(R, 0.06)} h0={0.45} h1={0.62} color="#FFFFFF" />
        <P {...franja(m, 'frente', L * 0.55)} h0={0.62} h1={0.66} color={m.b === 'CAMA_UCI' ? '#7FB8C9' : '#8FB3DD'} />
        <P {...franja({ ...m, ...encoger(R, 0.12) }, 'fondo', 0.3)} h0={0.62} h1={0.72} color="#FFFFFF" />
        <P {...franja(m, 'fondo', 0.05)} h0={0} h1={1.0} color="#9AA7B4" />
        {m.b === 'CAMA_UCI' && <P {...franja(m, 'fondo', 0.12)} h0={1.3} h1={1.7} color="#2B3440" />}
      </>)
    }
    case 'CAMILLA':
      return (<><P {...R} h0={0.55} h1={0.78} color="#E8EEF3" /><P {...encoger(R, 0.15)} h0={0} h1={0.55} color="#9AA7B4" /><P {...franja({ ...m, ...encoger(R, 0.06) }, 'fondo', 0.3)} h0={0.78} h1={0.86} color="#FFFFFF" /></>)
    case 'SILLA': case 'SILLAS_ESPERA':
      return (<><P {...R} h0={0.4} h1={0.47} color="#2F6FB0" /><P {...franja(m, 'fondo', 0.07)} h0={0.47} h1={0.88} color="#2F6FB0" /><P {...encoger(R, 0.12)} h0={0} h1={0.4} color="#5E7389" /></>)
    case 'SILLON': case 'SILLON_QUIMIO':
      return (<><P {...R} h0={0} h1={0.45} color={m.b === 'SILLON' ? '#E2A13B' : '#5FB3A6'} /><P {...franja(m, 'fondo', 0.22)} h0={0.45} h1={0.95} color={m.b === 'SILLON' ? '#E2A13B' : '#5FB3A6'} /></>)
    case 'SILLON_DENTAL':
      return (<><P {...R} h0={0} h1={0.6} color="#5FB3A6" /><P {...franja(m, 'fondo', 0.4)} h0={0.6} h1={1.0} color="#5FB3A6" /></>)
    case 'ESCRITORIO':
      return (<><P {...R} h0={0.71} h1={0.75} color="#C79A6B" /><P {...franja(m, 'fondo', 0.04)} h0={0} h1={0.71} color="#B08355" /><P {...encoger(R, 0.08)} h0={0.75} h1={0.78} color="#2B3440" /></>)
    case 'MOSTRADOR':
      return (<><P {...R} h0={0} h1={1.05} color="#F3F5F8" /><P {...R} h0={1.05} h1={1.1} color="#2F6FB0" /></>)
    case 'ESTANTE':
      return (<><P {...R} h0={0} h1={2.0} color="#D8C3A5" /><P {...encoger(R, 0.04)} h0={0.5} h1={0.53} color="#B08355" /><P {...encoger(R, 0.04)} h0={1.1} h1={1.13} color="#B08355" /></>)
    case 'MESON_LAB':
      return (<><P {...R} h0={0} h1={0.86} color="#F3F5F8" /><P {...R} h0={0.86} h1={0.9} color="#3E4C5C" /></>)
    case 'REFRIGERADOR':
      return <P {...R} h0={0} h1={1.8} color="#E6ECF2" />
    case 'MESA_4': {
      const [X, , Z] = aEscena((m.x0 + m.x1) / 2, (m.y0 + m.y1) / 2)
      return (
        <group position={[X, base, Z]}>
          <mesh position-y={0.73} castShadow><cylinderGeometry args={[0.45, 0.45, 0.04, 24]} /><meshStandardMaterial color="#C79A6B" /></mesh>
          <mesh position-y={0.36}><cylinderGeometry args={[0.05, 0.05, 0.72, 8]} /><meshStandardMaterial color="#5E7389" /></mesh>
          {[[0.72, 0], [-0.72, 0], [0, 0.72], [0, -0.72]].map(([a, b], i) => (
            <mesh key={i} position={[a, 0.23, b]} castShadow><boxGeometry args={[0.44, 0.46, 0.44]} /><meshStandardMaterial color="#E2533D" /></mesh>
          ))}
        </group>
      )
    }
    case 'EQUIPO_TAC': {
      const [X, , Z] = aEscena((m.x0 + m.x1) / 2, (m.y0 + m.y1) / 2)
      return (<>
        <P {...franja(m, 'frente', largo(m) * 0.55)} h0={0} h1={0.85} color="#E8EEF3" />
        <group position={[X, base + 1.0, Z]}>
          <mesh rotation-y={m.fondo[0] !== 0 ? 0 : Math.PI / 2} position={[m.fondo[0] * 0.6, 0, -m.fondo[1] * 0.6]} castShadow>
            <torusGeometry args={[0.75, 0.3, 12, 32]} /><meshStandardMaterial color="#F3F5F8" />
          </mesh>
        </group>
      </>)
    }
    case 'EQUIPO_RX':
      return (<><P {...encoger(R, 0.2)} h0={0} h1={0.85} color="#E8EEF3" /><P {...franja(m, 'fondo', 0.3)} h0={0} h1={2.2} color="#9AA7B4" /></>)
    case 'INODORO':
      return (<><P {...encoger(R, 0.05)} h0={0} h1={0.42} color="#FFFFFF" /><P {...franja(m, 'fondo', 0.16)} h0={0.42} h1={0.8} color="#F2F5F8" /></>)
    case 'LAVAMANOS':
      return (<><P {...R} h0={0.78} h1={0.86} color="#FFFFFF" /><P {...encoger(R, 0.15)} h0={0} h1={0.78} color="#E6ECF2" /></>)
    case 'URINARIO':
      return <P {...R} h0={0.5} h1={1.1} color="#FFFFFF" />
    case 'DUCHA':
      return (<><P {...R} h0={0} h1={0.06} color="#D8E6F2" /><P {...franja(m, 'frente', 0.03)} h0={0.06} h1={2.0} color="#CFE6F7" /></>)
    case 'BANCA':
      return <P {...R} h0={0} h1={0.45} color="#C79A6B" />
    case 'COLCHONETA':
      return <P {...R} h0={0} h1={0.1} color="#2F6FB0" />
    case 'VELADOR':
      return <P {...R} h0={0} h1={0.6} color="#C79A6B" />
    default:
      return <P {...R} h0={0} h1={m.alto} color="#B9C8D6" />
  }
}

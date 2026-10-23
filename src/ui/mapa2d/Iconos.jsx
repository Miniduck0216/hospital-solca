// Íconos del mapa: Lucide (el set de trazo que usan los componentes de VengeanceUI / shadcn) y, donde Lucide no
// tiene uno, pictogramas propios en el mismo estilo (24 × 24, trazo redondeado): baños, ascensor y escalera.
import {
  Accessibility, Activity, Armchair, ArrowDown, ArrowDownUp, ArrowUp, Banknote, BedDouble, Box, BriefcaseMedical,
  ChevronLeft, ChevronRight, Church, ClipboardList, Clock, Coffee, CornerUpLeft, CornerUpRight, Cross, DoorOpen,
  Flag, FlaskConical, Footprints, Info, Layers, LocateFixed, Map as MapaI, Minus, Pill, Plus, QrCode, Search, Settings,
  Stethoscope, X,
} from 'lucide-react'

const LUCIDE = {
  emergencia: Cross, consulta: Stethoscope, diagnostico: FlaskConical, tratamiento: Activity, hospitalizacion: BedDouble,
  servicios: BriefcaseMedical, administracion: ClipboardList, salida: DoorOpen, farmacia: Pill, caja: Banknote, info: Info,
  cafe: Coffee, capilla: Church, silla: Armchair, buscar: Search, cerrar: X, volver: ChevronLeft, intercambiar: ArrowDownUp,
  mas: Plus, menos: Minus, centrar: LocateFixed, flecha: ChevronRight, subir: ArrowUp, bajar: ArrowDown, caminar: Footprints,
  reloj: Clock, piso: Layers, izquierda: CornerUpLeft, derecha: CornerUpRight, destino: Flag, qr: QrCode, ajustes: Settings,
  cubo: Box, mapa: MapaI, accesible: Accessibility,
}

const PROPIOS = {
  bano: <><circle cx="7" cy="4.6" r="1.7" /><path d="M5 21v-6H4l1.2-6.2h3.6L10 15H9v6" /><circle cx="17" cy="4.6" r="1.7" /><path d="M15.2 21v-12h3.6v12M17 15v6" /><path d="M12 3v18" strokeOpacity=".45" /></>,
  ascensor: <><rect x="4.5" y="3" width="15" height="18" rx="2.5" /><path d="M9 10l3-3 3 3M9 14l3 3 3-3" /></>,
  escalera: <path d="M3.5 20.5h4.5V16h4.5v-4.5H17V7h3.5" />,
}

export function Icono({ nombre, size = 20, color = 'currentColor', grosor = 2, ...rest }) {
  const L = LUCIDE[nombre]
  if (L) return <L size={size} color={color} strokeWidth={grosor} aria-hidden="true" {...rest} />
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} color={color} strokeWidth={grosor} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {PROPIOS[nombre] || PROPIOS.ascensor}
    </svg>
  )
}

// insignia redonda (para listas y tarjetas)
export function Insignia({ icono, color, tinta = '#fff', size = 34 }) {
  return (
    <span className="insignia" style={{ width: size, height: size, background: color }}>
      <Icono nombre={icono} size={size * 0.56} color={tinta} grosor={2.1} />
    </span>
  )
}

// insignia dentro de un SVG (en metros: r = radio)
export function InsigniaSVG({ x, y, r, icono, color, activo }) {
  return (
    <g transform={`translate(${x} ${y})`} className="pin-svg">
      {activo && <circle r={r * 1.55} fill={color} opacity="0.22" />}
      <circle r={r} fill={color} stroke="#fff" strokeWidth={r * 0.16} />
      <Icono nombre={icono} x={-r * 0.6} y={-r * 0.6} width={r * 1.2} height={r * 1.2} size={r * 1.2} color="#fff" grosor={2.3} />
    </g>
  )
}

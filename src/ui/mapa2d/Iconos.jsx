// Pictogramas propios (24 × 24) para el mapa 2D: se dibujan en blanco sobre una insignia de color
const P = {
  emergencia: <path d="M12 5v14M5 12h14" strokeWidth="3.2" />,
  consulta: <><path d="M7 4v5a5 5 0 0 0 10 0V4" /><path d="M12 14v1.5a4 4 0 0 0 8 0V13" /><circle cx="20" cy="11.5" r="1.6" /></>,
  diagnostico: <path d="M9.5 3.5h5M10.5 3.5v6l-5 8.5a2 2 0 0 0 1.8 3h9.4a2 2 0 0 0 1.8-3l-5-8.5v-6M7.5 15h9" />,
  tratamiento: <path d="M2.5 12.5h4l2-5 4 10 2.5-5.5h6.5" />,
  hospitalizacion: <><path d="M3 18.5V6.5M3 14.5h18v4M21 14.5v-2a3 3 0 0 0-3-3h-7.5v5" /><circle cx="6.8" cy="11.6" r="1.7" /></>,
  servicios: <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />,
  administracion: <><rect x="4" y="8" width="16" height="11" rx="1.5" /><path d="M9 8V5.5h6V8M4 13h16" /></>,
  bano: <><circle cx="7" cy="4.6" r="1.6" fill="currentColor" stroke="none" /><path d="M5.2 8h3.6v6h-1v5.5H6.2V14h-1z" fill="currentColor" stroke="none" /><circle cx="17" cy="4.6" r="1.6" fill="currentColor" stroke="none" /><path d="M17 7.6l3.3 7.4h-2.2v4.5h-2.2V15h-2.2z" fill="currentColor" stroke="none" /><path d="M12 4v16" /></>,
  ascensor: <><rect x="5" y="3" width="14" height="18" rx="1.5" /><path d="M9 10.5l3-3 3 3M9 13.5l3 3 3-3" /></>,
  escalera: <path d="M3.5 20h4.5v-4.5h4.5V11H17V6.5h3.5" />,
  salida: <path d="M13.5 4H6v16h7.5M10.5 12h10M17.5 8.5l3.5 3.5-3.5 3.5" />,
  farmacia: <><rect x="3.5" y="8.5" width="17" height="7" rx="3.5" transform="rotate(-35 12 12)" /><path d="M10 7.5l4.5 8" transform="rotate(-5 12 12)" /></>,
  caja: <path d="M15.5 7.5c-.6-1.3-2-2-3.6-2-2 0-3.4 1.1-3.4 2.7 0 3.8 7.2 2 7.2 5.8 0 1.7-1.5 2.8-3.6 2.8-1.7 0-3.2-.8-3.8-2.2M12 3.5v2M12 16.8v2.7" />,
  info: <><circle cx="12" cy="6.5" r="1.6" fill="currentColor" stroke="none" /><path d="M10 10.5h2.5V18M9.5 18h6" /></>,
  cafe: <path d="M4.5 9h12v5a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5zM16.5 10.5h1.5a2.5 2.5 0 0 1 0 5h-1.6M8 3.5c-.8 1 .8 2 0 3M12 3.5c-.8 1 .8 2 0 3" />,
  capilla: <path d="M12 3.5v17M7.5 8.5h9" />,
  silla: <><circle cx="10" cy="4.6" r="1.6" fill="currentColor" stroke="none" /><path d="M10 7.5v5.5h5l2.2 5M7.5 10.5a5.5 5.5 0 1 0 7.6 7" /></>,
  buscar: <><circle cx="10.5" cy="10.5" r="6" /><path d="M15 15l5 5" /></>,
  cerrar: <path d="M6 6l12 12M18 6L6 18" />,
  volver: <path d="M15 5l-7 7 7 7" />,
  intercambiar: <path d="M7 4v15M3.5 15.5L7 19l3.5-3.5M17 20V5M13.5 8.5L17 5l3.5 3.5" />,
  mas: <path d="M12 5v14M5 12h14" />,
  menos: <path d="M5 12h14" />,
  centrar: <><circle cx="12" cy="12" r="3.2" /><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4" /></>,
  flecha: <path d="M9 5l7 7-7 7" />,
  subir: <path d="M12 19V5M6 11l6-6 6 6" />,
  bajar: <path d="M12 5v14M6 13l6 6 6-6" />,
  caminar: <><circle cx="13" cy="4.3" r="1.7" fill="currentColor" stroke="none" /><path d="M10.5 21l2-6.5-2.5-2.5 1-4.5 3 2.5 3 1M8 11l2.5-3.5M12.5 14.5l2.5 2.5V21" /></>,
  reloj: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  piso: <path d="M12 3.5l8.5 4.5L12 12.5 3.5 8zM3.5 12L12 16.5l8.5-4.5M3.5 16L12 20.5l8.5-4.5" />,
}

export function Icono({ nombre, size = 20, color = 'currentColor', grosor = 2, ...rest }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} color={color} strokeWidth={grosor} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {P[nombre] || P.servicios}
    </svg>
  )
}

// insignia redonda (para listas y tarjetas)
export function Insignia({ icono, color, tinta = '#fff', size = 34 }) {
  return (
    <span className="insignia" style={{ width: size, height: size, background: color }}>
      <Icono nombre={icono} size={size * 0.62} color={tinta} grosor={2.2} />
    </span>
  )
}

// insignia dentro del SVG del mapa (en metros: r = radio)
export function InsigniaSVG({ x, y, r, icono, color, activo }) {
  return (
    <g transform={`translate(${x} ${y})`} className="pin-svg">
      {activo && <circle r={r * 1.55} fill={color} opacity="0.22" />}
      <circle r={r} fill={color} stroke="#fff" strokeWidth={r * 0.16} />
      <g transform={`translate(${-r * 0.62} ${-r * 0.62}) scale(${(r * 1.24) / 24})`} fill="none" color="#fff" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
        {P[icono] || P.servicios}
      </g>
    </g>
  )
}

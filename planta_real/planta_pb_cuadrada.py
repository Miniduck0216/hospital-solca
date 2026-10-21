"""
Planta baja de SOLCA Quito, ala de consulta externa · versión ORTOGONAL.
Distribución tomada de la vista superior de referencia (planta_real/referencia_pb.png), pero cuadrada a mano:
todos los ambientes son rectángulos (o polígonos rectos) en una retícula de 0,6 m. Medidas en metros,
x hacia el este, y hacia el norte. Escala estimada: ala de 58 m de ancho (coherente con la huella OSM).
Escribe un DXF con capas WF_* para scripts/dxf_a_sketchup.py.
"""
import math, sys
import ezdxf

R = lambda x0, y0, x1, y1: [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]

CONTORNO = [(0, 54.6), (30.6, 54.6), (30.6, 9.6), (37.2, 9.6), (37.2, 8.4), (51.6, 8.4), (51.6, 9.6), (54.0, 9.6),
            (54.0, 0), (58.2, 0), (58.2, 76.2), (43.8, 76.2), (43.8, 72.6), (10.2, 72.6), (10.2, 71.4), (0, 71.4)]

# filas de consultorios de 2,4 m (de sur a norte)
FILAS = [(57.0, 59.4), (59.4, 61.8), (61.8, 64.2), (64.2, 66.6), (66.6, 69.0)]


def columna(x0, x1, nombres, cat='consulta'):
    """nombres de norte a sur; None = consultorio sin rótulo"""
    out = []
    for (y0, y1), n in zip(reversed(FILAS), nombres):
        n = n or 'Consultorio (sin rótulo)'
        c = cat if not n.startswith(('Coordinación', 'Preparación')) else 'administracion' if n.startswith('Coord') else 'tratamiento'
        out.append((f'{n}|{c}|consultorio', R(x0, y0, x1, y1)))
    return out


AREAS = [
    # --- franja norte: consulta externa (columnas A–F, pasillos internos entre ellas)
    ('Baños hombres|banos|baño,sanitario', R(0.0, 67.8, 4.2, 71.4)),
    ('Recreación Infantil|servicios|juegos,niños', R(4.2, 69.0, 8.4, 71.4)),
    ('Consultorio 35|consulta|consulta externa,consultorio', R(11.4, 69.0, 14.4, 71.4)),
    *columna(4.8, 9.0, ['Pediatría 04 - 34', 'Pediatría 03 - 33', 'Preparación - 32', 'Pediatría 02 - 31', 'Pediatría 01 - 30']),
    *columna(12.6, 17.4, ['Dietética - 25', 'Medicina 04 - 26', 'Medicina 03 - 27', 'Medicina 02 - 28', 'Medicina 01 - 29']),
    *columna(22.2, 27.0, ['Endocrinología - 22', 'Neumología - 21', 'Traumatología - 20', 'Neurocirugía - 19', None]),
    ('Ascensores y escaleras norte|circulacion|ascensor,escalera', R(30.6, 66.6, 35.4, 71.4)),
    *columna(30.6, 35.4, ['Tumores Mamarios - 14', 'Tumores Mixtos - 15', 'Tumores de Cabeza y Cuello - 16', None])[:0],
    ('Tumores Mamarios - 14|consulta|mama', R(30.6, 64.2, 35.4, 66.6)),
    ('Tumores Mixtos - 15|consulta|tumores', R(30.6, 61.8, 35.4, 64.2)),
    ('Tumores de Cabeza y Cuello - 16|consulta|cabeza,cuello', R(30.6, 59.4, 35.4, 61.8)),
    ('Consultorio (sin rótulo)|consulta|consultorio', R(30.6, 57.0, 35.4, 59.4)),
    ('Consultorio 1|consulta|consultorio', R(39.6, 69.0, 43.2, 72.6)),
    ('Consultorio (sin rótulo)|consulta|consultorio', R(43.2, 69.0, 46.8, 72.6)),
    ('Baños mujeres|banos|baño,sanitario', R(43.8, 72.6, 49.2, 76.2)),
    *columna(39.6, 45.0, ['Coordinación Enfermería - 1', 'Gastroenterología - 12', 'Preconsulta - 11', 'Preconsulta - 10', 'Preconsulta - 9']),
    ('Consultorio (sin rótulo)|consulta|consultorio', R(48.6, 69.0, 54.0, 72.6)),
    *columna(48.6, 54.0, ['Ginecología - 4', 'Ginecología - 5', 'Colposcopia - 6', 'Colposcopia - 7', 'Urología']),
    ('Secretaría - Control (Pediatría y Medicina)|administracion|secretaria,turnos', R(9.0, 57.0, 11.4, 58.8)),
    ('Secretaría - Control (Especialidades)|administracion|secretaria,turnos', R(27.0, 57.0, 29.4, 58.8)),
    ('Secretaría - Control (Ginecología)|administracion|secretaria,turnos', R(45.0, 57.0, 47.4, 58.8)),
    # --- ala sur: servicios
    ('Baño accesible|banos|baño,silla de ruedas', R(30.6, 47.4, 34.8, 54.6)),
    ('Capilla|servicios|oración,capilla', R(30.6, 42.6, 34.8, 47.4)),
    ('RPIS|administracion|red pública,rpis', R(30.6, 38.4, 34.8, 42.6)),
    ('Farmacia|servicios|medicinas,farmacia', R(39.6, 43.2, 55.8, 52.2)),
    ('Ascensores sur|circulacion|ascensor', R(53.4, 34.2, 55.8, 38.4)),
    ('Farmacias Económicas|servicios|farmacia economica', R(30.6, 28.2, 34.2, 31.8)),
    ('Cajas|administracion|pagos,caja,facturación', R(53.4, 21.6, 55.8, 28.2)),
    ('Dirección|administracion|direccion,gerencia', [(30.6, 9.6), (37.2, 9.6), (37.2, 8.4), (51.6, 8.4), (51.6, 9.6), (55.8, 9.6),
                                                     (55.8, 21.6), (43.2, 21.6), (43.2, 24.0), (39.6, 24.0), (39.6, 28.2), (30.6, 28.2)]),
]
RUTAS = [
    [(1.0, 55.8), (56.9, 55.8)],                  # pasillo norte (frente a las secretarías)
    [(56.9, 0.6), (56.9, 75.0)],                  # corredor este
    [(2.4, 55.8), (2.4, 67.8)],                   # pasillo oeste (baños hombres)
    [(10.8, 55.8), (10.8, 72.0)],                 # pasillo Pediatría / Medicina
    [(19.8, 55.8), (19.8, 72.0)],                 # pasillo abierto central
    [(28.8, 55.8), (28.8, 72.0)],                 # pasillo especialidades / tumores
    [(37.5, 55.8), (37.5, 72.6)],                 # acceso norte
    [(46.8, 55.8), (46.8, 69.0)],                 # pasillo Preconsulta / Ginecología
    [(10.8, 72.0), (37.5, 72.0)],                 # franja de espera norte
    [(37.5, 72.6), (46.8, 74.4), (56.9, 74.4)],   # vestíbulo norte (baños mujeres)
    [(37.2, 55.8), (37.2, 35.4)],                 # pasillo Capilla / Farmacia
    [(30.6, 35.4), (56.9, 35.4)],                 # hall del acceso principal
    [(50.4, 35.4), (50.4, 22.8), (53.4, 22.8)],   # hall de Cajas y Dirección
]
VERTICALES = [('ASC-A', (33.0, 69.0)), ('ASC-B', (54.6, 36.3))]
INICIOS = [('Entrada principal', (30.6, 35.4)), ('Entrada norte', (37.5, 72.6))]
LUCERNARIOS = [R(43.8, 32.8, 48.6, 38.0), R(39.9, 24.0, 43.2, 26.0)]       # tragaluces del hall (sin muros)

def cerca(p, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    t = max(0, min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)))
    return (a[0] + t * dx, a[1] + t * dy)


def main(salida):
    doc = ezdxf.new('R2010'); doc.header['$INSUNITS'] = 6
    msp = doc.modelspace()
    for c in ['WF_CONTORNO', 'WF_AREAS', 'WF_NOMBRES', 'WF_RUTAS', 'WF_PUERTAS', 'WF_VERTICAL', 'WF_INICIO', 'WF_LUCERNARIOS']:
        doc.layers.add(c)
    msp.add_lwpolyline(CONTORNO, close=True, dxfattribs={'layer': 'WF_CONTORNO'})
    for nombre, poly in AREAS:
        msp.add_lwpolyline(poly, close=True, dxfattribs={'layer': 'WF_AREAS'})
        cx = sum(p[0] for p in poly) / len(poly); cy = sum(p[1] for p in poly) / len(poly)
        msp.add_text(nombre, dxfattribs={'layer': 'WF_NOMBRES', 'height': 0.5}).set_placement((cx, cy))
        # puerta en el lado más cercano a un pasillo; tramo corto de ruta hasta él
        mejor = None
        for i in range(len(poly)):
            a, b = poly[i], poly[(i + 1) % len(poly)]
            m = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
            for r in RUTAS:
                for j in range(len(r) - 1):
                    q = cerca(m, r[j], r[j + 1]); d = math.dist(m, q)
                    if mejor is None or d < mejor[0]: mejor = (d, m, q)
        _, puerta, enlace = mejor
        msp.add_circle(puerta, 0.3, dxfattribs={'layer': 'WF_PUERTAS'})
        if math.dist(puerta, enlace) > 0.05: msp.add_line(puerta, enlace, dxfattribs={'layer': 'WF_RUTAS'})
    for r in RUTAS: msp.add_lwpolyline(r, dxfattribs={'layer': 'WF_RUTAS'})
    for l in LUCERNARIOS: msp.add_lwpolyline(l, close=True, dxfattribs={'layer': 'WF_LUCERNARIOS'})
    for t, p in VERTICALES: msp.add_text(t, dxfattribs={'layer': 'WF_VERTICAL', 'height': 0.5}).set_placement(p)
    for t, p in INICIOS: msp.add_text(t, dxfattribs={'layer': 'WF_INICIO', 'height': 0.5}).set_placement(p)
    doc.saveas(salida)
    print(f'DXF ortogonal: {salida} · {len(AREAS)} ambientes')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'planta_real/planos/solca-PB.dxf')

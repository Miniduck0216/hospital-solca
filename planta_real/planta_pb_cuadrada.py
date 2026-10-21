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
            (54.0, 0), (58.2, 0), (58.2, 76.2), (44.4, 76.2), (44.4, 72.6), (10.2, 72.6), (10.2, 71.4), (0, 71.4)]

# Franja norte: seis columnas de consultorios (A–F) de 2,4 m de fondo. Entre A–B, C–D y E–F hay un pasillo
# interno cerrado arriba, al que se entra SOLO por la Secretaría - Control del fondo (ancho completo).
# Entre B–C hay un pasillo abierto que sube a la sala de espera norte; entre D–E está el acceso norte.
X = {'A': (4.8, 9.6), 'B': (13.2, 18.0), 'C': (22.8, 27.6), 'D': (31.2, 35.4), 'E': (40.2, 45.6), 'F': (49.2, 54.6)}
PUERTA = {'A': 'E', 'B': 'W', 'C': 'E', 'D': 'W', 'E': 'E', 'F': 'W'}     # hacia el pasillo interno
FILAS = [(66.6, 69.0), (64.2, 66.6), (61.8, 64.2), (59.4, 61.8), (57.0, 59.4)]   # de norte a sur


def cerca(p, a, b):
    """Punto del segmento a–b más cercano a p."""
    ax, ay = a; bx, by = b; dx, dy = bx - ax, by - ay
    L = dx * dx + dy * dy
    t = 0 if L == 0 else max(0, min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / L))
    return (ax + t * dx, ay + t * dy)


def columna(c, nombres, filas=FILAS):
    x0, x1 = X[c]
    out = []
    for (y0, y1), n in zip(filas, nombres):
        cat = 'administracion' if n.startswith('Coord') else 'tratamiento' if n.startswith('Prep') else 'consulta'
        out.append((f'{n}|{cat}|consultorio', R(x0, y0, x1, y1), PUERTA[c]))
    return out


AREAS = [  # (Nombre|categoria|sinónimos, polígono, lados con puerta: N S E W)
    # --- extremo oeste
    ('Baños mujeres (oeste)|banos|baño,sanitario', R(0.0, 67.8, 1.8, 71.4), 'S'),
    ('Baños hombres (oeste)|banos|baño,sanitario', R(1.8, 67.8, 3.6, 71.4), 'S'),
    ('Recreación Infantil|servicios|juegos,niños', R(3.6, 69.0, 8.4, 71.4), 'E'),
    ('Consultorio 35|consulta|consulta externa,consultorio', R(12.0, 69.0, 14.4, 71.4), 'W'),
    *columna('A', ['Pediatría 04 - 34', 'Pediatría 03 - 33', 'Preparación - 32', 'Pediatría 02 - 31', 'Pediatría 01 - 30']),
    *columna('B', ['Dietética - 25', 'Medicina 04 - 26', 'Medicina 03 - 27', 'Medicina 02 - 28', 'Medicina 01 - 29']),
    *columna('C', ['Endocrinología - 22', 'Neumología - 21', 'Traumatología - 20', 'Neurocirugía - 19', 'Cirugía Laparoscópica - 18']),
    ('Escaleras y ascensores norte|circulacion|ascensor,escalera', R(31.2, 66.6, 35.4, 70.8), 'E'),
    *columna('D', ['Tumores Mamarios - 14', 'Tumores Mixtos - 15', 'Tumores de Cabeza y Cuello - 16', 'Cirugía Especial - 17'], FILAS[1:]),
    ('Consultorio 1|consulta|consultorio', R(40.2, 69.0, 43.8, 72.6), 'W'),
    ('Área sin rótulo|servicios|sin rótulo', R(43.8, 69.0, 46.8, 72.6), 'E'),
    ('Baños mujeres (este)|banos|baño,sanitario', R(44.4, 72.6, 49.2, 74.4), 'E'),
    ('Baños hombres (este)|banos|baño,sanitario', R(44.4, 74.4, 49.2, 76.2), 'E'),
    *columna('E', ['Coordinación Enfermería - 1', 'Gastroenterología - 12', 'Preconsulta - 11', 'Preconsulta - 10', 'Preconsulta - 9']),
    *columna('F', ['Ginecología - 4', 'Ginecología - 5', 'Colposcopia - 6', 'Colposcopia - 7', 'Urología']),
    ('Secretaría - Control (Pediatría y Medicina)|administracion|secretaria,turnos', R(9.6, 57.0, 13.2, 58.8), 'NS'),
    ('Secretaría - Control (Especialidades y Tumores)|administracion|secretaria,turnos', R(27.6, 57.0, 31.2, 58.8), 'NS'),
    ('Secretaría - Control (Preconsulta y Ginecología)|administracion|secretaria,turnos', R(45.6, 57.0, 49.2, 58.8), 'NS'),
    # --- ala sur
    ('Baño accesible hombres|banos|baño,silla de ruedas', R(30.6, 47.4, 32.7, 54.6), 'N'),
    ('Baño accesible mujeres|banos|baño,silla de ruedas', R(32.7, 47.4, 34.8, 54.6), 'N'),
    ('Capilla|servicios|oración,capilla', R(30.6, 42.6, 34.8, 47.4), 'E'),
    ('RPIS|administracion|red pública,rpis', R(30.6, 38.4, 34.8, 42.6), 'E'),
    ('Farmacia|servicios|medicinas,farmacia', R(39.6, 43.2, 55.8, 52.2), 'S'),
    ('Ascensores sur|circulacion|ascensor', R(53.4, 34.8, 55.8, 38.4), 'W'),
    ('Farmacias Económicas|servicios|farmacia economica', R(30.6, 28.2, 33.6, 30.6), 'E'),
    ('Cajas|administracion|pagos,caja,facturación', R(53.4, 21.0, 55.8, 28.2), 'W'),
    ('Dirección|administracion|direccion,gerencia', [(30.6, 9.6), (37.2, 9.6), (37.2, 8.4), (51.6, 8.4), (51.6, 9.6), (55.8, 9.6),
                                                     (55.8, 21.0), (43.2, 21.0), (43.2, 23.4), (39.6, 23.4), (39.6, 28.2), (30.6, 28.2)], 'N'),
]
# áreas abiertas (espera): se pintan pero no llevan muros
ESPERAS = [
    ('Sala de espera norte', [(10.8, 72.6), (31.2, 72.6), (31.2, 70.8), (31.2, 69.0), (14.4, 69.0), (14.4, 71.4), (10.8, 71.4)]),
    ('Espera noreste', R(47.4, 69.0, 54.6, 72.6)),
    ('Espera de Farmacia', [(39.6, 38.4), (49.8, 38.4), (49.8, 39.6), (55.8, 39.6), (55.8, 43.2), (39.6, 43.2)]),
]
RUTAS = [
    [(2.4, 55.8), (56.4, 55.8)],                  # pasillo principal norte
    [(56.4, 0.6), (56.4, 75.0)],                  # corredor este
    [(2.4, 55.8), (2.4, 67.8)],                   # corredor oeste (baños)
    [(11.4, 58.8), (11.4, 70.2)],                 # pasillo interno A–B (entra por la secretaría)
    [(8.4, 70.2), (12.0, 70.2)],                  # Recreación Infantil y Consultorio 35
    [(20.4, 55.8), (20.4, 70.8), (31.2, 70.8)],   # pasillo abierto B–C y sala de espera norte
    [(29.4, 58.8), (29.4, 66.6)],                 # pasillo interno C–D
    [(37.8, 55.8), (37.8, 72.6)],                 # acceso norte
    [(47.4, 58.8), (47.4, 70.8)],                 # pasillo interno E–F
    [(49.2, 73.5), (56.4, 73.5)],                 # vestíbulo noreste (baños este)
    [(37.2, 55.8), (37.2, 35.4)],                 # pasillo Capilla / Farmacia
    [(30.6, 35.8), (37.2, 35.8), (37.2, 35.4), (56.4, 35.4)],   # hall del acceso principal
    [(47.7, 40.8), (47.7, 35.4)],                 # espera de Farmacia
    [(51.0, 35.4), (51.0, 19.8), (51.0, 21.0)],   # hall de Cajas y Dirección
    [(35.1, 35.4), (35.1, 29.4)],                 # Farmacias Económicas / Dirección
]
VERTICALES = [('ASC-A', (33.3, 68.7)), ('ASC-B', (54.6, 36.6))]
INICIOS = [('Entrada principal', (30.6, 35.8)), ('Entrada norte', (37.8, 72.6))]
LUCERNARIOS = [R(43.8, 33.0, 48.6, 38.4), R(39.6, 23.4, 43.2, 26.4)]

def main(salida):
    doc = ezdxf.new('R2010'); doc.header['$INSUNITS'] = 6
    msp = doc.modelspace()
    for c in ['WF_CONTORNO', 'WF_AREAS', 'WF_NOMBRES', 'WF_RUTAS', 'WF_PUERTAS', 'WF_VERTICAL', 'WF_INICIO', 'WF_LUCERNARIOS', 'WF_ESPERA']:
        doc.layers.add(c)
    msp.add_lwpolyline(CONTORNO, close=True, dxfattribs={'layer': 'WF_CONTORNO'})
    for nombre, poly, lados in AREAS:
        msp.add_lwpolyline(poly, close=True, dxfattribs={'layer': 'WF_AREAS'})
        cx = sum(p[0] for p in poly) / len(poly); cy = sum(p[1] for p in poly) / len(poly)
        msp.add_text(nombre, dxfattribs={'layer': 'WF_NOMBRES', 'height': 0.5}).set_placement((cx, cy))
        xs = [p[0] for p in poly]; ys = [p[1] for p in poly]
        for lado in lados:
            # lado del polígono en el borde pedido (el más largo), puerta en su punto medio
            borde = {'N': max(ys), 'S': min(ys), 'E': max(xs), 'W': min(xs)}[lado]
            mejor = None
            for i in range(len(poly)):
                a, b = poly[i], poly[(i + 1) % len(poly)]
                k = 1 if lado in 'NS' else 0
                if abs(a[k] - borde) < 1e-6 and abs(b[k] - borde) < 1e-6:
                    L = abs(a[1 - k] - b[1 - k])
                    if mejor is None or L > mejor[0]: mejor = (L, ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2))
            puerta = mejor[1]
            msp.add_circle(puerta, 0.3, dxfattribs={'layer': 'WF_PUERTAS'})
            # enlace: punto más cercano de la red de pasillos
            enlace = min((cerca(puerta, r[j], r[j + 1]) for r in RUTAS for j in range(len(r) - 1)), key=lambda q: math.dist(puerta, q))
            if math.dist(puerta, enlace) > 0.05: msp.add_line(puerta, enlace, dxfattribs={'layer': 'WF_RUTAS'})
    for nombre, poly in ESPERAS:
        msp.add_lwpolyline(poly, close=True, dxfattribs={'layer': 'WF_ESPERA'})
        cx = sum(p[0] for p in poly) / len(poly); cy = sum(p[1] for p in poly) / len(poly)
        msp.add_text(nombre, dxfattribs={'layer': 'WF_ESPERA', 'height': 0.5}).set_placement((cx, cy))
    for r in RUTAS: msp.add_lwpolyline(r, dxfattribs={'layer': 'WF_RUTAS'})
    for l in LUCERNARIOS: msp.add_lwpolyline(l, close=True, dxfattribs={'layer': 'WF_LUCERNARIOS'})
    for t, p in VERTICALES: msp.add_text(t, dxfattribs={'layer': 'WF_VERTICAL', 'height': 0.5}).set_placement(p)
    for t, p in INICIOS: msp.add_text(t, dxfattribs={'layer': 'WF_INICIO', 'height': 0.5}).set_placement(p)
    doc.saveas(salida)
    print(f'DXF ortogonal: {salida} · {len(AREAS)} ambientes')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'planta_real/planos/solca-PB.dxf')

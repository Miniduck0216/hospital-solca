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

CONTORNO = [(0, 54.6), (30.6, 54.6), (30.6, 9.6), (55.2, 9.6), (55.2, 0), (58.2, 0), (58.2, 76.2),
            (40.2, 76.2), (40.2, 73.2), (0, 73.2)]

AREAS = [  # «Nombre|categoria|sinónimos», polígono
    # --- franja norte: consulta externa
    ('Baños hombres|banos|baño,sanitario', R(0.0, 70.2, 4.2, 73.2)),
    ('Consultorio 35|consulta|consulta externa,consultorio', R(4.8, 70.2, 18.0, 73.2)),
    ('Pediatría 03 - 33|consulta|pediatria,niños', R(4.8, 60.0, 10.8, 68.4)),
    ('Medicina 04 - 26|consulta|medicina interna', R(12.6, 60.0, 18.0, 68.4)),
    ('Secretaría - Control (Pediatría y Medicina)|administracion|secretaria,turnos', R(4.8, 57.0, 18.0, 60.0)),
    ('Endocrinología - 22|consulta|endocrinologia,diabetes', R(22.2, 69.6, 31.2, 73.2)),
    ('Ascensores norte|circulacion|ascensor', R(31.8, 69.6, 34.8, 73.2)),
    ('Traumatología - 20|consulta|traumatologia,huesos', R(22.2, 60.0, 34.8, 67.8)),
    ('Secretaría - Control (Endocrinología y Traumatología)|administracion|secretaria,turnos', R(22.2, 57.0, 34.8, 60.0)),
    ('Baños mujeres|banos|baño,sanitario', R(43.2, 73.5, 47.4, 76.2)),
    ('Consultorio 2|consulta|consulta externa,consultorio', R(40.2, 70.2, 55.2, 73.2)),
    ('Gastroenterología - 12|consulta|gastroenterologia,digestivo', R(40.2, 60.0, 55.2, 68.4)),
    ('Secretaría - Control (Gastroenterología)|administracion|secretaria,turnos', R(40.2, 57.0, 55.2, 60.0)),
    # --- ala sur: servicios
    ('Baño accesible|banos|baño,silla de ruedas', R(30.6, 48.0, 35.4, 54.0)),
    ('Capilla|servicios|oración,capilla', R(30.6, 42.6, 35.4, 47.4)),
    ('RPIS|administracion|red pública,rpis', R(30.6, 37.8, 35.4, 42.0)),
    ('Farmacia|servicios|medicinas,farmacia', R(39.6, 42.6, 55.2, 52.2)),
    ('Ascensores sur|circulacion|ascensor', R(52.2, 32.4, 55.2, 37.2)),
    ('Farmacias Económicas|servicios|farmacia economica', R(30.6, 28.8, 39.6, 33.6)),
    ('Cajas|administracion|pagos,caja,facturación', R(52.2, 22.8, 55.2, 28.8)),
    ('Dirección|administracion|direccion,gerencia', [(30.6, 9.6), (55.2, 9.6), (55.2, 22.2), (42.0, 22.2), (42.0, 28.2), (30.6, 28.2)]),
]
RUTAS = [
    [(1.0, 55.8), (56.7, 55.8)],                  # pasillo norte (frente a las secretarías)
    [(56.7, 0.6), (56.7, 75.0)],                  # corredor este
    [(2.2, 69.3), (20.1, 69.3)],                  # pasillo de consultorios (fila superior)
    [(11.7, 55.8), (11.7, 69.3)],                 # entre Pediatría y Medicina
    [(20.1, 55.8), (20.1, 69.3)],                 # entre bloques
    [(20.1, 68.7), (37.8, 68.7)],                 # entre Endocrinología y Traumatología
    [(37.8, 55.8), (37.8, 73.2)],                 # acceso norte
    [(37.8, 69.3), (56.7, 69.3)],                 # entre Consultorio 2 y Gastroenterología
    [(37.5, 55.8), (37.5, 35.4)],                 # pasillo Capilla / Farmacia
    [(30.6, 35.4), (56.7, 35.4)],                 # hall del acceso principal
    [(47.4, 35.4), (47.4, 25.5), (52.2, 25.5)],   # hall de Cajas y Dirección
]
VERTICALES = [('ASC-A', (33.3, 69.3)), ('ASC-B', (55.2, 35.4))]
INICIOS = [('Entrada principal', (30.6, 35.4)), ('Entrada norte', (37.8, 73.2))]
LUCERNARIOS = [R(42.6, 33.6, 46.8, 38.4)]       # tragaluces del hall (referencia, sin muros)


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

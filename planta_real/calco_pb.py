"""
Calco aproximado de la planta baja de SOLCA Quito a partir de una captura en perspectiva
(planta_real/referencia_pb.png). Corrige la perspectiva con una homografía y escribe un DXF
con las capas WF_* que entiende scripts/dxf_a_sketchup.py.

Referencia de escala (ESTIMADA, reemplazar por cotas reales cuando existan):
  el rectángulo del ala calcada mide ANCHO × FONDO metros.
"""
import math, sys
import numpy as np
import ezdxf

ANCHO, FONDO = 58.0, 76.0
# esquinas del rectángulo de referencia en la imagen (px) → plano (m), y hacia el norte de la imagen
IMG = [(345, 215), (852, 220), (812, 757), (151, 750)]
PLA = [(0, FONDO), (ANCHO, FONDO), (ANCHO, 0), (0, 0)]


def homografia(src, dst):
    A = []
    for (x, y), (u, v) in zip(src, dst):
        A += [[x, y, 1, 0, 0, 0, -u * x, -u * y, -u], [0, 0, 0, x, y, 1, -v * x, -v * y, -v]]
    _, _, vt = np.linalg.svd(np.array(A, float))
    return vt[-1].reshape(3, 3) / vt[-1][-1]


Hm = homografia(IMG, PLA)


def P(p):
    x, y, w = Hm @ np.array([p[0], p[1], 1.0])
    return (round(x / w, 2), round(y / w, 2))


# ---- calco en píxeles de la captura
CONTORNO = [(345, 215), (852, 220), (812, 757), (757, 757), (762, 665), (490, 645), (528, 488), (560, 430), (585, 322), (310, 312)]
AREAS = [  # nombre|categoria|sinónimos, polígono en px
    ('Consultorios 1 - 35|consulta|consulta externa,consultorio', [(382, 222), (505, 225), (485, 300), (360, 298)]),
    ('Neumología - 21|consulta|pulmón,neumologia', [(520, 232), (614, 236), (608, 306), (516, 303)]),
    ('Ginecología - 4|consulta|ginecologia,colposcopia', [(690, 234), (735, 234), (778, 234), (815, 236), (810, 316), (680, 314)]),
    ('Baños hombres|banos|baño,sanitario', [(345, 218), (380, 219), (377, 246), (342, 245)]),
    ('Baños mujeres|banos|baño,sanitario', [(738, 222), (778, 222), (777, 240), (736, 240)]),
    ('Baño accesible|banos|baño,silla de ruedas', [(592, 322), (628, 322), (622, 346), (586, 346)]),
    ('Ascensores norte|circulacion|ascensor', [(624, 238), (654, 239), (652, 262), (621, 261)]),
    ('Capilla|servicios|oración,capilla', [(580, 347), (622, 347), (611, 395), (569, 394)]),
    ('RPIS|administracion|red pública,rpis', [(569, 396), (611, 397), (604, 424), (561, 422)]),
    ('Farmacia|servicios|medicinas,farmacia', [(665, 338), (830, 342), (826, 400), (660, 397)]),
    ('Ascensores sur|circulacion|ascensor', [(790, 430), (823, 431), (821, 458), (788, 457)]),
    ('Farmacias Económicas|servicios|farmacia economica', [(515, 458), (603, 460), (598, 486), (510, 485)]),
    ('Cajas|administracion|pagos,caja,facturación', [(765, 500), (810, 503), (806, 548), (762, 546)]),
    ('Dirección|administracion|direccion,gerencia', [(528, 490), (632, 493), (668, 550), (760, 551), (797, 560), (797, 660), (490, 642)]),
]
RUTAS = [
    [(330, 309), (585, 318), (645, 320), (845, 326)],      # pasillo norte (frente a consultorios)
    [(645, 320), (645, 440)],                               # pasillo entre Capilla y Farmacia
    [(572, 444), (645, 440), (825, 440)],                   # hall (acceso lateral → ascensores sur)
    [(845, 326), (825, 440), (822, 750)],                   # corredor este hasta el extremo sur
    [(675, 232), (672, 320)],                               # acceso norte
]
VERTICALES = [('ASC-A', (636, 262)), ('ASC-B', (805, 440))]
INICIOS = [('Entrada principal', (572, 444)), ('Entrada norte', (675, 232))]


def cerca_en_segmento(p, a, b):
    ax, ay = a; bx, by = b; dx, dy = bx - ax, by - ay
    t = max(0, min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / (dx * dx + dy * dy)))
    return (ax + t * dx, ay + t * dy)


def main(salida):
    rutas = [[P(p) for p in r] for r in RUTAS]
    doc = ezdxf.new('R2010'); doc.header['$INSUNITS'] = 6
    msp = doc.modelspace()
    for c in ['WF_CONTORNO', 'WF_AREAS', 'WF_NOMBRES', 'WF_RUTAS', 'WF_PUERTAS', 'WF_VERTICAL', 'WF_INICIO']:
        doc.layers.add(c)
    msp.add_lwpolyline([P(p) for p in CONTORNO], close=True, dxfattribs={'layer': 'WF_CONTORNO'})
    for nombre, px in AREAS:
        poly = [P(p) for p in px]
        msp.add_lwpolyline(poly, close=True, dxfattribs={'layer': 'WF_AREAS'})
        cx = sum(p[0] for p in poly) / len(poly); cy = sum(p[1] for p in poly) / len(poly)
        msp.add_text(nombre, dxfattribs={'layer': 'WF_NOMBRES', 'height': 0.6}).set_placement((cx, cy))
        # puerta: punto del borde del área más cercano a un pasillo; tramo de ruta hasta el pasillo
        mejor = None
        for i in range(len(poly)):
            a, b = poly[i], poly[(i + 1) % len(poly)]
            m = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
            for r in rutas:
                for j in range(len(r) - 1):
                    q = cerca_en_segmento(m, r[j], r[j + 1])
                    d = math.dist(m, q)
                    if mejor is None or d < mejor[0]: mejor = (d, m, q)
        _, puerta, enlace = mejor
        msp.add_circle(puerta, 0.3, dxfattribs={'layer': 'WF_PUERTAS'})
        if math.dist(puerta, enlace) > 0.05:
            msp.add_line(puerta, enlace, dxfattribs={'layer': 'WF_RUTAS'})
    for r in rutas:
        msp.add_lwpolyline(r, dxfattribs={'layer': 'WF_RUTAS'})
    for t, p in VERTICALES:
        msp.add_text(t, dxfattribs={'layer': 'WF_VERTICAL', 'height': 0.6}).set_placement(P(p))
    for t, p in INICIOS:
        msp.add_text(t, dxfattribs={'layer': 'WF_INICIO', 'height': 0.6}).set_placement(P(p))
    doc.saveas(salida)
    xs = [P(p)[0] for p in CONTORNO]; ys = [P(p)[1] for p in CONTORNO]
    print(f'DXF: {salida} · contorno {max(xs) - min(xs):.1f} × {max(ys) - min(ys):.1f} m · {len(AREAS)} áreas')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'planta_real/planos/solca-PB-calco.dxf')

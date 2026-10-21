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

ANCHO, FONDO = 58.0, 72.0
# esquinas del rectángulo de referencia en la imagen (px) → plano (m), y hacia el norte de la imagen.
# Ancho 58 m: con esa escala el edificio completo (ala + bloque gris) mide ≈131 m, como la huella de OSM (≈135 m).
IMG = [(472, 340), (1072, 316), (1105, 1070), (498, 1085)]
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
CONTORNO = [(472, 348), (800, 328), (925, 283), (1072, 283), (1105, 1070), (1060, 1072), (1055, 975), (815, 985), (810, 790), (800, 512), (478, 520)]
AREAS = [  # nombre|categoria|sinónimos, polígono en px
    ('Baños hombres|banos|baño,sanitario', [(474, 350), (512, 348), (513, 383), (475, 385)]),
    ('Consultorio 35|consulta|consulta externa,consultorio', [(560, 342), (655, 338), (655, 372), (560, 375)]),
    ('Pediatría 03 - 33|consulta|pediatria,niños', [(520, 380), (572, 378), (575, 470), (524, 472)]),
    ('Medicina 04 - 26|consulta|medicina interna', [(600, 378), (658, 376), (660, 470), (603, 472)]),
    ('Secretaría - Control (Pediatría y Medicina)|administracion|secretaria,turnos', [(524, 474), (660, 472), (660, 492), (525, 494)]),
    ('Endocrinología - 22|consulta|endocrinologia,diabetes', [(690, 340), (795, 332), (797, 375), (690, 380)]),
    ('Ascensores norte|circulacion|ascensor', [(802, 345), (842, 343), (843, 382), (802, 384)]),
    ('Traumatología - 20|consulta|traumatologia,huesos', [(708, 386), (838, 386), (840, 463), (710, 463)]),
    ('Secretaría - Control (Endocrinología y Traumatología)|administracion|secretaria,turnos', [(710, 466), (840, 466), (840, 488), (710, 490)]),
    ('Baños mujeres|banos|baño,sanitario', [(927, 286), (978, 286), (978, 306), (927, 306)]),
    ('Consultorio 2|consulta|consulta externa,consultorio', [(888, 320), (1035, 318), (1035, 358), (888, 360)]),
    ('Gastroenterología - 12|consulta|gastroenterologia,digestivo', [(888, 362), (1035, 360), (1035, 455), (888, 457)]),
    ('Secretaría - Control (Gastroenterología)|administracion|secretaria,turnos', [(890, 459), (1035, 457), (1035, 482), (890, 485)]),
    ('Baño accesible|banos|baño,silla de ruedas', [(799, 514), (842, 512), (843, 580), (800, 582)]),
    ('Capilla|servicios|oración,capilla', [(800, 585), (845, 584), (846, 640), (801, 642)]),
    ('RPIS|administracion|red pública,rpis', [(801, 645), (846, 644), (847, 680), (802, 682)]),
    ('Farmacia|servicios|medicinas,farmacia', [(893, 530), (1068, 528), (1070, 630), (895, 632)]),
    ('Ascensores sur|circulacion|ascensor', [(1045, 675), (1075, 675), (1076, 715), (1046, 715)]),
    ('Farmacias Económicas|servicios|farmacia economica', [(806, 742), (900, 742), (902, 790), (808, 792)]),
    ('Cajas|administracion|pagos,caja,facturación', [(1045, 775), (1078, 775), (1080, 845), (1046, 845)]),
    ('Dirección|administracion|direccion,gerencia', [(815, 795), (902, 795), (945, 852), (1080, 850), (1080, 970), (815, 980)]),
]
RUTAS = [
    [(490, 507), (845, 500), (1085, 495)],                  # pasillo norte, frente a las secretarías
    [(518, 377), (690, 378)],                               # pasillo de consultorios (fila superior)
    [(588, 377), (588, 505)], [(685, 378), (685, 505)],     # pasillos entre bloques de consultorios
    [(862, 323), (862, 505)],                               # acceso norte
    [(965, 360), (965, 495)],                               # pasillo de Gastroenterología
    [(870, 505), (870, 700)],                               # pasillo Capilla / Farmacia
    [(824, 712), (870, 700), (1040, 700), (1085, 700)],     # hall del acceso principal
    [(1085, 495), (1085, 1060)],                            # corredor este
    [(950, 700), (990, 800), (1040, 810)],                  # hall de Cajas y Dirección
]
VERTICALES = [('ASC-A', (822, 364)), ('ASC-B', (1058, 695))]
INICIOS = [('Entrada principal', (824, 712)), ('Entrada norte', (862, 323))]

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

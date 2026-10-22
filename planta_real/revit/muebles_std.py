"""
Mobiliario estándar para los consultorios que el plano deja vacíos: escritorio con silla del médico,
dos sillas para el paciente y camilla, colocados contra los muros y lejos de las puertas.
"""
import math
import numpy as np
from shapely.geometry import Polygon, Point
from shapely.ops import unary_union
from shapely import affinity

from categorias import es_consultorio
from modelo import lista_polis


def rect(cx, cy, largo, ancho, ang):
    r = Polygon([(-largo / 2, -ancho / 2), (largo / 2, -ancho / 2), (largo / 2, ancho / 2), (-largo / 2, ancho / 2)])
    return affinity.translate(affinity.rotate(r, ang, origin=(0, 0), use_radians=True), cx, cy)


def _ejes(pg):
    c = list(pg.minimum_rotated_rectangle.exterior.coords)
    a = math.atan2(c[1][1] - c[0][1], c[1][0] - c[0][0])
    return [a, a + math.pi / 2, a + math.pi, a + 3 * math.pi / 2]


def _ubicar(libre, pg, puertas, largo, prof, paso=0.12):
    """Mejor posición de un rectángulo (largo x prof) dentro de 'libre': contra un muro y lejos de las puertas.
    Devuelve (centro, ángulo) o None. El ángulo apunta del muro hacia el ambiente."""
    if libre.is_empty:
        return None
    x0, y0, x1, y1 = libre.bounds
    borde = pg.exterior
    mejor = None
    for ang in _ejes(pg):
        for x in np.arange(x0 + 0.1, x1, paso):
            for y in np.arange(y0 + 0.1, y1, paso):
                r = rect(x, y, largo, prof, ang)
                if not libre.contains(r):
                    continue
                # el lado de atrás (hacia -normal) debe quedar contra el muro
                n = np.array([-math.sin(ang), math.cos(ang)])
                atras = Point(x - n[0] * prof / 2, y - n[1] * prof / 2)
                d_muro = borde.distance(atras)
                d_puerta = min((pu.distance(Point(x, y)) for pu in puertas), default=5)
                score = d_muro * 3 - min(d_puerta, 3)
                if mejor is None or score < mejor[0]:
                    mejor = (score, (x, y), ang)
    return None if mejor is None else (mejor[1], mejor[2])


def amoblar(m):
    nuevos = []
    puertas_geo = [p['rect'].buffer(max(p['ancho'], 0.8)) for p in m.puertas]
    for a in m.ambientes:
        if not es_consultorio(a['nombre']) or a['area'] < 5:
            continue
        pg = a['poligono']
        dentro = [mu for mu in m.muebles if mu['poligono'].intersects(pg)]
        tiene_escritorio = any(mu['nombre'] in ('Escritorio', 'Mesón', 'Mostrador') and
                               mu['poligono'].intersection(pg).area > 0.4 for mu in dentro)
        obst = unary_union([mu['poligono'].buffer(0.15) for mu in dentro] +
                           [t['poligono'].buffer(0.1) for t in m.tabiques if t['poligono'].intersects(pg)] +
                           [g for g in puertas_geo if g.intersects(pg)])
        libre = pg.buffer(-0.06, join_style=2).difference(obst)
        puertas = [p['rect'] for p in m.puertas if p['rect'].distance(pg) < 0.3]
        if not tiene_escritorio:
            # escritorio 1,2 x 0,6 con 0,75 m para la silla del médico detrás y 0,8 m para el paciente delante
            u = _ubicar(libre, pg, puertas, 1.4, 2.15)
            if u:
                (x, y), ang = u
                n = np.array([-math.sin(ang), math.cos(ang)])
                t = np.array([math.cos(ang), math.sin(ang)])
                c = np.array([x, y])
                atras = c - n * 2.15 / 2
                esc_c = atras + n * (0.75 + 0.3)
                nuevos.append(dict(nombre='Escritorio', poligono=rect(*esc_c, 1.2, 0.6, ang), altura=0.75, cat='mueble'))
                medico = atras + n * 0.38
                nuevos += silla(medico, ang, mira=1)
                for k in (-0.3, 0.3):
                    p = esc_c + n * 0.75 + t * k
                    nuevos += silla(p, ang, mira=-1)
                libre = libre.difference(rect(x, y, 1.6, 2.35, ang))
        # camilla 1,9 x 0,7 contra un muro
        u = _ubicar(libre, pg, puertas, 1.9, 0.7)
        if u:
            (x, y), ang = u
            nuevos.append(dict(nombre='Camilla', poligono=rect(x, y, 1.9, 0.7, ang), altura=0.72, cat='camilla'))
            n = np.array([-math.sin(ang), math.cos(ang)])
            t = np.array([math.cos(ang), math.sin(ang)])
            cab = np.array([x, y]) + t * 0.75
            nuevos.append(dict(nombre='Respaldo de camilla', poligono=rect(*cab, 0.4, 0.66, ang), altura=0.95,
                               cat='camilla', z0=0.72))
    m.muebles += nuevos
    return len(nuevos)


def silla(p, ang, mira=1):
    """Asiento y respaldo; 'mira' = 1 si el ocupante mira hacia +normal."""
    n = np.array([-math.sin(ang), math.cos(ang)]) * mira
    asiento = rect(p[0], p[1], 0.46, 0.46, ang)
    resp_c = np.array(p) - n * 0.21
    respaldo = rect(resp_c[0], resp_c[1], 0.44, 0.05, ang)
    return [dict(nombre='Silla', poligono=asiento, altura=0.46, cat='silla'),
            dict(nombre='Respaldo de silla', poligono=respaldo, altura=0.90, cat='silla', z0=0.46)]

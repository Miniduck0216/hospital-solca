"""
Muros reales desde el DXF. Los muros del plano están dibujados como contornos (dos caras y remates),
así que se rasterizan las capas de muros a 2 cm y se toman como muro las regiones angostas encerradas
entre líneas (radio inscrito <= 0,3 m). Los ambientes son las regiones anchas. Devuelve polígonos shapely
en metros, con origen en la esquina SO del plano.
"""
import math
import numpy as np
import cv2
from scipy import ndimage
from shapely.geometry import Polygon, MultiPolygon
from shapely.ops import unary_union

RES = 0.02          # m por píxel
CAPAS_MURO = {'PA', 'TA', 'VE', 'P0 - Paredes', 'COL'}
RADIO_MURO = 0.30   # m: más angosto que esto es muro; más ancho es ambiente


class Lienzo:
    def __init__(self, planos, margen=2.0):
        xs = [x for _, _, p, _ in planos for x, _ in p]
        ys = [y for _, _, p, _ in planos for _, y in p]
        self.x0, self.y0 = min(xs) - margen * 1000, min(ys) - margen * 1000
        self.w = int(((max(xs) - min(xs)) / 1000 + 2 * margen) / RES) + 1
        self.h = int(((max(ys) - min(ys)) / 1000 + 2 * margen) / RES) + 1

    def px(self, x, y):           # mm del DXF -> píxel (col, fila)
        return int(round((x - self.x0) / 1000 / RES)), int(round(self.h - 1 - (y - self.y0) / 1000 / RES))

    def m(self, c, f):            # píxel -> metros locales
        return c * RES, (self.h - 1 - f) * RES

    def dibujar(self, trazos, grosor=1):
        img = np.zeros((self.h, self.w), np.uint8)
        for p in trazos:
            pts = np.array([self.px(x, y) for x, y in p], np.int32)
            cv2.polylines(img, [pts], False, 255, grosor)
        return img > 0


def contornos_a_poligonos(mascara, lienzo, simplificar=0.01):
    cs, jer = cv2.findContours(mascara.astype(np.uint8), cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    polis = []
    if jer is None:
        return polis
    jer = jer[0]
    for i, c in enumerate(cs):
        if jer[i][3] != -1:
            continue
        ext = [lienzo.m(p[0][0], p[0][1]) for p in c]
        if len(ext) < 3:
            continue
        huecos = []
        j = jer[i][2]
        while j != -1:
            h = [lienzo.m(p[0][0], p[0][1]) for p in cs[j]]
            if len(h) >= 3:
                huecos.append(h)
            j = jer[j][0]
        pg = Polygon(ext, huecos).buffer(0)
        if not pg.is_empty:
            pg = pg.simplify(simplificar)
            polis.extend(pg.geoms if isinstance(pg, MultiPolygon) else [pg])
    return polis


def extraer(planos, bloques):
    lz = Lienzo(planos)
    trazos = [p for c, _, p, _ in planos if c in CAPAS_MURO]
    # columnas en bloque: rectángulos cerrados
    for b in bloques:
        if 'COL' in b['nombre']:
            trazos += [g[1] + [g[1][0]] for g in b['geo']]
    lineas = lz.dibujar(trazos, 1)
    libre = ~lineas
    etiq, n = ndimage.label(libre)
    dist = ndimage.distance_transform_edt(libre) * RES
    maxd = ndimage.maximum(dist, etiq, index=np.arange(1, n + 1))
    exterior = {etiq[0, 0], etiq[-1, -1], etiq[0, -1], etiq[-1, 0]}
    angostas = np.zeros(n + 1, bool)
    angostas[1:] = maxd <= RADIO_MURO
    for e in exterior:
        angostas[e] = False
    relleno = angostas[etiq]
    # línea que toca un relleno de muro también es muro (las caras del muro)
    cerca = ndimage.binary_dilation(relleno, iterations=2)
    # fachadas dibujadas con varias líneas pegadas (sin hueco entre ellas): se cierran como banda
    # y muros cuyo contorno no cierra: dos caras paralelas a < 32 cm se unen; una línea suelta se descarta
    cuad = np.ones((3, 3), bool)
    banda = ndimage.binary_opening(ndimage.binary_closing(lineas, structure=cuad, iterations=8), iterations=2)
    muro = relleno | (lineas & cerca) | banda
    muro = ndimage.binary_closing(muro, iterations=1)
    polis = contornos_a_poligonos(muro, lz)
    polis = [p for p in polis if p.area > 0.01]
    return polis, lz, etiq, maxd, exterior

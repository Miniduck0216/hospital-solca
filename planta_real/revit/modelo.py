"""
Modelo de la planta baja de SOLCA Quito a partir del DXF real (DWG vinculado en Revit y exportado).
Todo en metros, coordenadas locales (origen = esquina SO del lienzo de muros).
"""
import math
import re
import numpy as np
import cv2
from scipy import ndimage
from shapely.geometry import Polygon, LineString, Point, MultiPolygon, box
from shapely.ops import unary_union, polygonize

from leer_dxf import cargar
import muros as M

ALTURA = 3.84          # piso a piso: la escalera indica 24 escalones de 0,16 m
H_PUERTA = 2.10
H_ANTEPECHO = 0.90
H_DINTEL_VENTANA = 2.40


def lista_polis(g):
    if g.is_empty:
        return []
    if isinstance(g, Polygon):
        return [g]
    return [p for p in getattr(g, 'geoms', []) if isinstance(p, Polygon) and not p.is_empty]


class Modelo:
    def __init__(self):
        self.planos, self.bloques, self.textos = cargar()
        polis, self.lz, *_ = M.extraer(self.planos, self.bloques)
        self.x0, self.y0 = self.lz.x0, self.lz.y0
        self.muros_raw = unary_union(polis)
        self._columnas()
        self._ventanas()
        self._puertas()
        self._muros()
        self._ambientes()
        self._mobiliario()
        self._gradas()

    # --- utilidades
    def L(self, p):                       # mm del DXF -> m locales
        return ((p[0] - self.x0) / 1000.0, (p[1] - self.y0) / 1000.0)

    def Lp(self, pts):
        return [self.L(p) for p in pts]

    # --- columnas
    def _columnas(self):
        cols = []
        for b in self.bloques:
            if 'COL' in b['nombre']:
                anillos = [Polygon(self.Lp(g[1])) for g in b['geo'] if len(g[1]) >= 3]
                pg = unary_union([a.buffer(0) for a in anillos if a.area > 0.01])
                if not pg.is_empty:
                    cols.append(pg.convex_hull)
        for c, t, p, cerrada in self.planos:
            if c == 'COL' and len(p) >= 4:
                pg = Polygon(self.Lp(p)).buffer(0)
                if 0.04 < pg.area < 1.5:
                    cols.append(pg)
        # quitar duplicados
        self.columnas = []
        for c in sorted(cols, key=lambda g: -g.area):
            if not any(c.intersection(o).area > 0.5 * c.area for o in self.columnas):
                self.columnas.append(c)

    # --- ventanas: bandas de la capa VE (fachada vidriada)
    def _ventanas(self):
        tr = [p for c, _, p, _ in self.planos if c == 'VE']
        lineas = self.lz.dibujar(tr, 1)
        cuad = np.ones((3, 3), bool)
        banda = ndimage.binary_opening(ndimage.binary_closing(lineas, structure=cuad, iterations=8), iterations=2)
        polis = M.contornos_a_poligonos(banda, self.lz)
        ve = unary_union([p for p in polis if p.area > 0.05])
        ve = ve.intersection(self.muros_raw.buffer(0.03))
        ve = ve.difference(unary_union(self.columnas).buffer(0.02))
        self.ventanas = [p for p in lista_polis(ve.buffer(-0.005).buffer(0.005)) if p.area > 0.08]

    # --- puertas: bisagra = centro del arco; vano = bisagra -> extremo del arco en posición cerrada
    def _puertas(self):
        self.puertas = []
        for b in self.bloques:
            n = b['nombre']
            es_puerta = n.startswith('P-IZ') or n.startswith('P-DE') or n.startswith('_U41') or \
                n.startswith('_U42') or n.startswith('_U43') or n.startswith('_U44') or n.startswith('_U45') or \
                n.startswith('-MP')
            if not es_puerta:
                continue
            arcos = [g[1] for g in b['geo'] if g[3] == 'ARC']
            hojas = [g[1] for g in b['geo'] if g[3] != 'ARC']
            hoja_pts = [self.L(q) for h in hojas for q in h]
            segs = []
            for a in arcos:
                pa = self.Lp(a)
                p0, p1 = pa[0], pa[-1]
                # centro: punto equidistante de los extremos y del punto medio del arco
                pm = pa[len(pa) // 2]
                cx, cy = circulo(p0, pm, p1)
                if cx is None:
                    continue
                r = math.dist((cx, cy), p0)
                if r < 0.4 or r > 1.6:
                    continue
                d0 = min((math.dist(p0, q) for q in hoja_pts), default=9)
                d1 = min((math.dist(p1, q) for q in hoja_pts), default=9)
                cerrado = p0 if d0 > d1 else p1
                segs.append(((cx, cy), cerrado, r))
            if not segs:
                continue
            if len(segs) == 2 and n.startswith('-MP'):
                (h1, _, r1), (h2, _, r2) = segs
                self.puertas.append(dict(a=h1, b=h2, ancho=math.dist(h1, h2), doble=True, tipo=n))
            else:
                for h, c, r in segs:
                    self.puertas.append(dict(a=h, b=c, ancho=r, doble=False, tipo=n))
        # grosor del muro en el vano (medido en la jamba) y dintel
        mur = self.muros_raw
        for p in self.puertas:
            a, b = np.array(p['a']), np.array(p['b'])
            d = (b - a) / max(np.linalg.norm(b - a), 1e-9)
            nrm = np.array([-d[1], d[0]])
            t0, t1 = None, None
            for base in (a - d * 0.06, b + d * 0.06):
                ln = LineString([tuple(base - nrm * 0.6), tuple(base + nrm * 0.6)])
                inter = ln.intersection(mur)
                for g in getattr(inter, 'geoms', [inter]):
                    if g.is_empty or g.length < 0.04:
                        continue
                    if g.distance(Point(tuple(base))) < 0.05:
                        ts = [float(np.dot(np.array(c) - base, nrm)) for c in g.coords]
                        t0, t1 = min(ts), max(ts)
                        break
                if t0 is not None:
                    break
            if t0 is None or t1 - t0 > 0.6:
                t0, t1 = -0.075, 0.075
            p['t0'], p['t1'] = t0, t1
            p['dir'], p['nrm'] = d, nrm
            p['rect'] = Polygon([tuple(a + nrm * t0), tuple(b + nrm * t0), tuple(b + nrm * t1), tuple(a + nrm * t1)])

    # --- muros finales: sin columnas ni ventanas (que se modelan aparte)
    def _muros(self):
        m = self.muros_raw.difference(unary_union(self.columnas))
        m = m.difference(unary_union(self.ventanas))
        self.muros = [p for p in lista_polis(m) if p.area > 0.02]

    # --- ambientes: regiones libres con las puertas cerradas, nombradas con los textos
    def _ambientes(self):
        lz = self.lz
        img = np.zeros((lz.h, lz.w), np.uint8)
        for pg in [self.muros_raw] + self.columnas:
            for p in lista_polis(pg):
                cv2.fillPoly(img, [np.array([px(lz, q) for q in p.exterior.coords], np.int32)], 255)
                for h in p.interiors:
                    cv2.fillPoly(img, [np.array([px(lz, q) for q in h.coords], np.int32)], 0)
        for p in self.puertas:
            cv2.fillPoly(img, [np.array([px(lz, q) for q in p['rect'].exterior.coords], np.int32)], 255)
        # cerrar pequeñas fugas
        ocup = ndimage.binary_dilation(img > 0, iterations=3)
        # exterior: se cierran las aberturas de fachada (entradas sin puerta) de hasta ~5 m
        k = 130
        pad = k + 20
        oc2 = np.pad(ocup, pad)
        cerrado = ndimage.binary_dilation(oc2, structure=np.ones((3, 3), bool), iterations=k)
        e2, _ = ndimage.label(~cerrado)
        ext = e2 == e2[0, 0]
        ext = ndimage.binary_dilation(ext, structure=np.ones((3, 3), bool), iterations=k)[pad:-pad, pad:-pad] & ~ocup
        self.mascara_exterior = ext
        # vanos sin bloque de puerta (hasta 1,2 m) también separan ambientes
        cuad = np.ones((3, 3), bool)
        ocup_sep = ndimage.binary_dilation(img > 0, structure=cuad, iterations=30)
        etiq, n = ndimage.label(~ocup_sep & ~ext)
        bordes = set()
        tam = ndimage.sum(np.ones_like(etiq), etiq, index=np.arange(1, n + 1))
        self.ambientes = []
        textos = self._etiquetas()
        for k in range(1, n + 1):
            if k in bordes or tam[k - 1] * M.RES ** 2 < 0.3:
                continue
            masc = ndimage.binary_dilation(etiq == k, structure=cuad, iterations=30) & ~ocup
            masc = ndimage.binary_dilation(masc, iterations=3)
            polis = M.contornos_a_poligonos(masc, lz, 0.03)
            if not polis:
                continue
            pg = max(polis, key=lambda g: g.area)
            dentro = [t for t in textos if pg.contains(Point(t[1], t[2]))]
            nombre = unir_nombres(dentro)
            self.ambientes.append(dict(poligono=pg, nombre=nombre, area=pg.area))
        # huella del edificio: muros cerrados con 2,6 m y sin huecos interiores; los ambientes se recortan a ella
        cerr = unary_union([self.muros_raw] + self.columnas).buffer(2.6, join_style=2).buffer(-2.6, join_style=2)
        self.huella = unary_union([Polygon(p.exterior) for p in lista_polis(cerr) if p.area > 20])
        for a in self.ambientes:
            a['poligono'] = max(lista_polis(a['poligono'].intersection(self.huella)) or [a['poligono']],
                                key=lambda g: g.area)
            a['area'] = a['poligono'].area
        self.ambientes = [a for a in self.ambientes if a['area'] > 0.8]

    def _etiquetas(self):
        fuera = {'ZONAS'}
        out = []
        for c, t, x, y, h in self.textos:
            if c in fuera:
                continue
            t = ' '.join(t.split())
            if not t or re.fullmatch(r'[sS]|N = 0.00|\d\d|24 ESCALONES.*', t):
                continue
            X, Y = self.L((x, y))
            # el punto de inserción de MTEXT es la esquina superior izquierda: centro aprox.
            out.append((t, X + len(t) * h / 1000 * 0.3, Y - h / 1000 * 0.5))
        # quitar duplicados exactos
        vistos, res = set(), []
        for t in out:
            k = (t[0], round(t[1], 1), round(t[2], 1))
            if k not in vistos:
                vistos.add(k)
                res.append(t)
        return res

    # --- mobiliario: bloques y capas de muebles
    def _mobiliario(self):
        alturas = {'AS-14': ('Inodoro', 0.40, 'sanitario'), 'INOD': ('Inodoro', 0.40, 'sanitario'),
                   'AS-03': ('Lavamanos', 0.85, 'sanitario'), 'S1': ('Lavamanos', 0.85, 'sanitario'),
                   'AS-07': ('Lavamanos doble', 0.85, 'sanitario'), 'AS-28': ('Urinario', 0.60, 'sanitario'),
                   'AS-08': ('Desagüe de piso', 0.03, 'sanitario'), 'AS-21': ('Plato de ducha', 0.05, 'sanitario'),
                   '_U32': ('Asiento', 0.45, 'mueble'), '_U40': ('Asiento', 0.45, 'mueble'),
                   'otoman': ('Otomán', 0.45, 'mueble'), 'Ventanilla': ('Ventanilla de atención', 1.05, 'mueble')}
        self.muebles = []
        for b in self.bloques:
            clave = next((k for k in alturas if b['nombre'].startswith(k)), None)
            if not clave:
                continue
            nom, h, cat = alturas[clave]
            lineas = []
            anillos = []
            for g in b['geo']:
                pts = self.Lp(g[1])
                if g[2] and len(pts) >= 3:
                    anillos.append(Polygon(pts).buffer(0))
                elif len(pts) >= 2:
                    lineas.append(LineString(pts))
            pg = unary_union([a for a in anillos if a.area > 0.002] + list(polygonize(unary_union(lineas))))
            if pg.is_empty:
                pg = unary_union(lineas).convex_hull
            pg = pg.buffer(0.005)
            if pg.area < 0.005 or pg.area > 6:
                continue
            self.muebles.append(dict(nombre=nom, poligono=pg.convex_hull if pg.geom_type != 'Polygon' else pg,
                                     altura=h, cat=cat))
        # mesones y muebles fijos dibujados en capas
        tr = [p for c, _, p, _ in self.planos if c in ('MU', 'P0 - Mobiliario', 'PDF_P0 - Mobiliario', 'NO')]
        lineas = self.lz.dibujar(tr, 1)
        cerr = ndimage.binary_closing(lineas, structure=np.ones((3, 3), bool), iterations=4)
        lleno = ndimage.binary_fill_holes(cerr)
        lleno = ndimage.binary_opening(lleno, iterations=3)
        for pg in M.contornos_a_poligonos(lleno, self.lz, 0.02):
            pg = pg.difference(self.muros_raw.buffer(0.01))
            for q in lista_polis(pg):
                if 0.15 < q.area < 25 and min_ancho(q) > 0.25:
                    self.muebles.append(dict(nombre='Mesón', poligono=q, altura=0.90, cat='mueble'))

    # --- gradas: líneas de huella paralelas (capa GR y escalera del núcleo)
    def _gradas(self):
        segs = []
        for c, t, p, _ in self.planos:
            if c != 'GR':
                continue
            pts = self.Lp(p)
            for i in range(len(pts) - 1):
                s = LineString([pts[i], pts[i + 1]])
                if s.length > 0.6:
                    segs.append(s)
        self.tramos = []
        usados = set()
        for i, s in enumerate(segs):
            if i in usados:
                continue
            ang = angulo(s)
            grupo = [i]
            for j, o in enumerate(segs):
                if j != i and j not in usados and abs(((angulo(o) - ang + 90) % 180) - 90) < 3 and \
                        abs(o.length - s.length) < 0.3 and o.distance(s) < 4.0:
                    grupo.append(j)
            if len(grupo) >= 4:
                usados.update(grupo)
                lineas = [segs[k] for k in grupo]
                self.tramos.append(lineas)


def circulo(a, b, c):
    ax, ay = a; bx, by = b; cx, cy = c
    d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by))
    if abs(d) < 1e-9:
        return None, None
    ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d
    uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d
    return ux, uy


def px(lz, q):
    return int(round(q[0] / M.RES)), int(round(lz.h - 1 - q[1] / M.RES))


def angulo(s):
    (x0, y0), (x1, y1) = s.coords[0], s.coords[-1]
    return math.degrees(math.atan2(y1 - y0, x1 - x0)) % 180


def min_ancho(pg):
    r = pg.minimum_rotated_rectangle
    c = list(r.exterior.coords)
    return min(math.dist(c[0], c[1]), math.dist(c[1], c[2]))


def unir_nombres(ts):
    """Une rótulos partidos en dos líneas (TUMORES / MAMARIOS - 14): misma columna y una línea debajo."""
    if not ts:
        return ''
    ts = sorted(ts, key=lambda t: (-t[2], t[1]))
    grupos = []
    for t in ts:
        g = next((g for g in grupos if abs(g[-1][1] - t[1]) < 1.2 and 0 < g[-1][2] - t[2] < 0.55), None)
        if g:
            g.append(t)
        else:
            grupos.append([t])
    nombres = [' '.join(x[0] for x in g) for g in grupos]
    vistos = []
    for n in nombres:
        if n not in vistos:
            vistos.append(n)
    return ' / '.join(vistos)

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

# Aberturas del pasillo central que el plano deja sin dibujar. No son muros: solo indican dónde termina
# el interior. Entre el Bloque A (y = 78,8) y Farmacia (y = 72,5) el pasillo central queda abierto al
# este por 6,3 m; el cierre sigue la línea de fachada de ambos (x = 57,65).
CIERRES = [((57.65, 72.3), (57.65, 79.0))]
# Límites entre ambientes sin muro en el plano (no se modelan como muro): el frente oeste de Farmacia
# hacia el pasillo central.
SEPARADORES = [((57.65, 53.3), (57.65, 72.3))]
# Nombre del ambiente que contiene el punto (el pasillo central que va del hall norte a Dirección).
NOMBRES = {(54.3, 70.0): 'PASILLO CENTRAL'}


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
        self._gradas()
        self._nucleo_hall()
        self._tabiques()
        self._escaleras()
        self._muros()
        self._ambientes()
        self._mobiliario()
        self._nombres()

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
            hojas = [self.Lp(g[1]) for g in b['geo'] if g[3] != 'ARC' and len(g[1]) >= 2]
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
                # la hoja (abierta) es la polilínea cuyo largo mayor se parece al radio del arco
                def largo(h):
                    xs = [q[0] for q in h]; ys = [q[1] for q in h]
                    return max(max(xs) - min(xs), max(ys) - min(ys))
                hoja = min(hojas, key=lambda h: abs(largo(h) - r)) if hojas else []
                d0 = min((math.dist(p0, q) for q in hoja), default=9)
                d1 = min((math.dist(p1, q) for q in hoja), default=9)
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


    # --- hall norte (capa Rebars): fachadas de vidrio, foso del ascensor con su puerta
    def _segmentos(self, capas):
        out = []
        for c, t, p, _ in self.planos:
            if c not in capas:
                continue
            pts = self.Lp(p)
            for i in range(len(pts) - 1):
                if math.dist(pts[i], pts[i + 1]) > 0.02:
                    out.append(LineString([pts[i], pts[i + 1]]))
        return out

    def _nucleo_hall(self):
        self.vidrios, self.foso, self.puerta_ascensor = [], [], None
        nucleo = unary_union([LineString(l.coords).envelope.buffer(0.35) for tr in self.tramos for l in tr]) \
            if self.tramos else Polygon()
        # foso: polilínea de la capa Rebars con caja de 2 a 4 m por lado
        caja = None
        for c, t, p, _ in self.planos:
            if c == 'Rebars' and len(p) >= 8:
                q = LineString(self.Lp(p)).envelope
                x0, y0, x1, y1 = q.bounds
                if 2 < x1 - x0 < 4.2 and 2 < y1 - y0 < 4.2:
                    caja = q if caja is None or q.area > caja.area else caja
        if caja is not None:
            anillo = caja.difference(caja.buffer(-0.15, join_style=2))
            # puerta del ascensor: en el lado donde está el mecanismo de puerta de la cabina
            # (tramos ortogonales de 0,8 a 1,6 m dentro del foso; los lados de la cabina se compensan)
            x0, y0, x1, y1 = caja.bounds
            cxm, cym = (x0 + x1) / 2, (y0 + y1) / 2
            dentro = [s_ for s_ in self._segmentos({'Rebars'}) if caja.buffer(-0.05).contains(s_) and
                      0.8 <= s_.length <= 1.6 and (abs(s_.coords[0][0] - s_.coords[-1][0]) < 0.02 or
                                                    abs(s_.coords[0][1] - s_.coords[-1][1]) < 0.02)]
            if dentro:
                dx = sum((s_.centroid.x - cxm) * s_.length for s_ in dentro) / (x1 - x0)
                dy = sum((s_.centroid.y - cym) * s_.length for s_ in dentro) / (y1 - y0)
                lado = ('E' if dx > 0 else 'O') if abs(dx) > abs(dy) else ('N' if dy > 0 else 'S')
            else:
                lado = 'S'
            self.lado_puerta_ascensor = lado
            lados = {'E': (x1, (y0 + y1) / 2), 'O': (x0, (y0 + y1) / 2), 'N': ((x0 + x1) / 2, y1), 'S': ((x0 + x1) / 2, y0)}
            cx, cy = lados[lado]
            if lado in 'EO':
                hueco = box(cx - 0.2, cy - 0.5, cx + 0.2, cy + 0.5)
                a, b = (cx, cy - 0.5), (cx, cy + 0.5)
            else:
                hueco = box(cx - 0.5, cy - 0.2, cx + 0.5, cy + 0.2)
                a, b = (cx - 0.5, cy), (cx + 0.5, cy)
            self.foso = lista_polis(anillo.difference(hueco))
            # líneas de la cabina dentro del foso no son gradas
            self.tramos = [tr for tr in self.tramos if not caja.contains(unary_union(tr).centroid)]
            self.puerta_ascensor = dict(a=a, b=b, rect=hueco.intersection(anillo).envelope)
            nucleo = nucleo.union(caja.buffer(0.3))
        # vidrios: tramos largos y ortogonales de la capa Rebars fuera del núcleo de escalera/ascensor
        segs = [s for s in self._segmentos({'Rebars'}) if s.length >= 1.5 and
                (abs(s.coords[0][0] - s.coords[-1][0]) < 0.02 or abs(s.coords[0][1] - s.coords[-1][1]) < 0.02)
                and not nucleo.contains(s.centroid)]
        # tabiques de la capa Rebars: dos líneas paralelas separadas 0,13–0,30 m (el vidrio va a <= 0,12 m)
        self.tabiques_rebars = []
        en_par = set()
        largos = [s_ for s_ in segs if s_.length >= 3.0]

        def alineado_con_vidrio(l):
            (xa, ya), (xb, yb) = l.coords[0], l.coords[-1]
            for g in largos:
                (ga, gb), (gc, gd) = g.coords[0], g.coords[-1]
                if abs(ya - yb) < 0.02 and abs(gb - gd) < 0.02 and abs(ya - gb) < 0.3 and g is not l and \
                        g.length > l.length + 1.0:
                    return True
                if abs(xa - xb) < 0.02 and abs(ga - gc) < 0.02 and abs(xa - ga) < 0.3 and g is not l and \
                        g.length > l.length + 1.0:
                    return True
            return False
        for i, a in enumerate(segs):
            if alineado_con_vidrio(a):
                continue
            for j in range(i + 1, len(segs)):
                b2 = segs[j]
                if alineado_con_vidrio(b2):
                    continue
                d = a.distance(b2)
                if 0.13 <= d <= 0.30 and abs(a.length - b2.length) < 0.5 and \
                        a.buffer(d + 0.02, cap_style=2).intersection(b2).length > 0.7 * min(a.length, b2.length):
                    en_par.update((i, j))
                    pg = unary_union([a, b2]).minimum_rotated_rectangle.difference(self.muros_raw)
                    self.tabiques_rebars += [q for q in lista_polis(pg) if q.area > 0.05]
        # el tabique se arma con las polilíneas completas a las que pertenecen las líneas en par
        # (incluye remates y retornos): franja entre ambas polilíneas
        if en_par:
            pares_seg = [segs[k] for k in en_par]
            polis_rb = [LineString(self.Lp(p)) for c, t, p, _ in self.planos if c == 'Rebars' and len(p) >= 2]
            madres = [pl for pl in polis_rb if any(pl.buffer(0.01).contains(sg) for sg in pares_seg)]
            if madres:
                franja = unary_union([pl.buffer(0.11, cap_style=2, join_style=2) for pl in madres])
                franja = franja.buffer(-0.095, join_style=2).difference(self.muros_raw)
                self.tabiques_rebars = [q for q in lista_polis(franja) if q.area > 0.05]
        segs = [s_ for k, s_ in enumerate(segs) if k not in en_par]
        if segs:
            # cada frente de vidrio se une de punta a punta (los huecos son puertas corredizas)
            frentes = {}
            for s_ in segs:
                (xa, ya), (xb, yb) = s_.coords[0], s_.coords[-1]
                horiz = abs(ya - yb) < 0.02
                clave = ('h', round(ya / 0.3)) if horiz else ('v', round(xa / 0.3))
                frentes.setdefault(clave, []).append(s_)
            segs = []
            for (o, _), lst in frentes.items():
                if o == 'h':
                    y = float(np.mean([l.coords[0][1] for l in lst]))
                    xs = [c[0] for l in lst for c in l.coords]
                    segs.append(LineString([(min(xs), y), (max(xs), y)]))
                else:
                    x = float(np.mean([l.coords[0][0] for l in lst]))
                    ys = [c[1] for l in lst for c in l.coords]
                    segs.append(LineString([(x, min(ys)), (x, max(ys))]))
            cortos = [s_ for s_ in segs if s_.length < 3.0]
            segs = [s_ for s_ in segs if s_.length >= 3.0]
            v = unary_union([s.buffer(0.05, cap_style=2) for s in segs]) if segs else Polygon()
            v = v.difference(self.muros_raw.buffer(0.02)).difference(unary_union(self.columnas).buffer(0.02))
            self.vidrios = [p for p in lista_polis(v) if p.area > 0.08 and min_ancho(p) < 0.4]


    # --- escaleras: tramos encadenados desde la puerta de acceso, con descansos en las esquinas
    def _escaleras(self):
        tramos = []
        for lineas in self.tramos:
            (xa, ya), (xb, yb) = lineas[0].coords[0], lineas[0].coords[-1]
            u = np.array([xb - xa, yb - ya]); u = u / np.linalg.norm(u)
            nrm = np.array([-u[1], u[0]])
            orden = sorted(lineas, key=lambda l: float(np.dot(np.array(l.centroid.coords[0]), nrm)))
            tramos.append(dict(lineas=orden, nrm=nrm))
        mids = [Point(*((np.array(p['a']) + np.array(p['b'])) / 2)) for p in self.puertas]
        libres = list(range(len(tramos)))
        self.escaleras = []
        while libres:
            # arranque: el extremo de tramo más cercano a una puerta
            mejor = None
            for i in libres:
                for lado in (0, -1):
                    d = min((tramos[i]['lineas'][lado].distance(mp) for mp in mids), default=99)
                    if mejor is None or d < mejor[0]:
                        mejor = (d, i, lado)
            _, i, lado = mejor
            cadena = []
            entrada = lado
            while True:
                libres.remove(i)
                ls = tramos[i]['lineas'] if entrada == 0 else tramos[i]['lineas'][::-1]
                cadena.append(ls)
                fin = ls[-1]
                sig = None
                for j in libres:
                    for l2 in (0, -1):
                        d = tramos[j]['lineas'][l2].distance(fin)
                        if d < 1.8 and (sig is None or d < sig[0]):
                            sig = (d, j, l2)
                if sig is None:
                    break
                _, i, entrada = sig
            n_pasos = sum(len(ls) - 1 for ls in cadena) + (len(cadena) - 1)
            riser = min(0.18, ALTURA / (max(n_pasos, 1) + 1))
            pasos, descansos, k = [], [], 0
            for t_i, ls in enumerate(cadena):
                for a, b in zip(ls[:-1], ls[1:]):
                    k += 1
                    pasos.append((unary_union([a, b]).minimum_rotated_rectangle, k * riser))
                if t_i < len(cadena) - 1:
                    k += 1
                    q = unary_union([ls[-1], cadena[t_i + 1][0]]).minimum_rotated_rectangle
                    descansos.append((q, k * riser))
            self.escaleras.append(dict(pasos=pasos, descansos=descansos, riser=riser))

    # --- tabiques dibujados con una sola línea (divisiones livianas, cubículos de baño)
    def _tabiques(self):
        mur = self.muros_raw.buffer(0.06)
        cols = unary_union(self.columnas).buffer(0.05)
        vid = unary_union(self.vidrios).buffer(0.1) if self.vidrios else Polygon()
        segs = [s for s in self._segmentos({'PA', 'TA', 'P0 - Paredes'}) if s.length > 0.5]
        out = []
        for s in segs:
            fuera = s.difference(mur).difference(cols).difference(vid)
            for g in getattr(fuera, 'geoms', [fuera]):
                if g.is_empty or g.geom_type != 'LineString' or g.length < 0.5:
                    continue
                out.append(g)
        self.tabiques = [dict(linea=LineString(list(q.minimum_rotated_rectangle.exterior.coords)[:2]), poligono=q)
                         for q in getattr(self, 'tabiques_rebars', [])]
        for g in unary_union(out).geoms if out and unary_union(out).geom_type == 'MultiLineString' else out:
            if g.length >= 0.5:
                self.tabiques.append(dict(linea=g, poligono=g.buffer(0.025, cap_style=2, join_style=2)))

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
        for a, b in SEPARADORES:
            cv2.line(img, px(lz, a), px(lz, b), 255, 3)
        extra = self.vidrios + self.foso + [t['poligono'] for t in self.tabiques]
        if self.puerta_ascensor:
            extra.append(self.puerta_ascensor['rect'])
        for pg in extra:
            for p in lista_polis(pg):
                cv2.fillPoly(img, [np.array([px(lz, q) for q in p.exterior.coords], np.int32)], 255)
        # cerrar pequeñas fugas
        ocup = ndimage.binary_dilation(img > 0, iterations=3)
        # exterior: se cierran las aberturas de fachada (entradas sin puerta) de hasta ~5 m; el borde de las
        # cubiertas (capa AY) también cierra: lo que está bajo techo es interior
        bajo_techo = lz.dibujar([p for c, _, p, _ in self.planos if c == 'AY'], 3)
        cierres = np.zeros_like(bajo_techo)
        for a, b in CIERRES:
            cv2.line(cierres.view(np.uint8), px(lz, a), px(lz, b), 1, 5)
        cierres = cierres.astype(bool)
        bajo_techo |= cierres
        ocup = ocup | cierres
        k = 130
        pad = k + 20
        oc2 = np.pad(ocup | bajo_techo, pad)
        cerrado = ndimage.binary_dilation(oc2, structure=np.ones((3, 3), bool), iterations=k)
        e2, _ = ndimage.label(~cerrado)
        ext = e2 == e2[0, 0]
        ext = ndimage.binary_dilation(ext, structure=np.ones((3, 3), bool), iterations=k)[pad:-pad, pad:-pad] & ~ocup
        self.mascara_exterior = ext
        # vanos sin bloque de puerta (hasta 1,2 m) también separan ambientes: se engruesan muros, columnas,
        # vidrios y foso; puertas y tabiques se engruesan poco para no borrar baños pequeños
        cuad = np.ones((3, 3), bool)
        duro = np.zeros_like(img)
        for pg in [self.muros_raw] + self.columnas + self.vidrios + self.foso:
            for p in lista_polis(pg):
                cv2.fillPoly(duro, [np.array([px(lz, q) for q in p.exterior.coords], np.int32)], 255)
                for h in p.interiors:
                    cv2.fillPoly(duro, [np.array([px(lz, q) for q in h.coords], np.int32)], 0)
        ocup_sep = ndimage.binary_dilation(duro > 0, structure=cuad, iterations=30) | \
            ndimage.binary_dilation(img > 0, iterations=4)
        etiq, n = ndimage.label(~ocup_sep & ~ext)
        bordes = set()
        tam = ndimage.sum(np.ones_like(etiq), etiq, index=np.arange(1, n + 1))
        self.ambientes = []
        textos = self._etiquetas()
        # cada punto libre pertenece a un solo ambiente: el de la semilla más cercana (a 4 cm por píxel)
        validas = np.zeros(n + 1, bool)
        validas[1:] = tam * M.RES ** 2 >= 0.3
        semillas = np.where(validas[etiq], etiq, 0).astype(np.int32)
        libre = ~ocup & ~ext
        f = 2
        H2, W2 = (lz.h // f) * f, (lz.w // f) * f
        sem2 = semillas[:H2:f, :W2:f]
        _, (ii, jj) = ndimage.distance_transform_edt(sem2 == 0, return_indices=True)
        cercana = sem2[ii, jj]
        del ii, jj
        asig = np.zeros_like(semillas)
        asig[:H2, :W2] = np.repeat(np.repeat(cercana, f, axis=0), f, axis=1)
        asig = np.where(libre, asig, 0)
        for k in np.unique(semillas[semillas > 0]):
            region = asig == k
            et3, n3 = ndimage.label(region)
            if n3 == 0:
                continue
            propias = np.unique(et3[(semillas == k) & region])
            propias = propias[propias > 0]
            masc = np.isin(et3, propias)
            otros = (asig > 0) & (asig != k)
            masc = ndimage.binary_dilation(masc, iterations=3) & ~otros
            for pg in M.contornos_a_poligonos(masc, lz, 0.03):
                if pg.area < 1.0:
                    continue
                dentro = [t for t in textos if pg.contains(Point(t[1], t[2]))]
                self.ambientes.append(dict(poligono=pg, nombre=unir_nombres(dentro), area=pg.area))
        # segunda pasada: espacios pequeños que la separación gruesa borró (baños con mamparas, nichos)
        cubierto = np.zeros_like(img)
        for a in self.ambientes:
            cv2.fillPoly(cubierto, [np.array([px(lz, q) for q in a['poligono'].exterior.coords], np.int32)], 255)
        resto = ~ocup & ~ext & ~ndimage.binary_dilation(cubierto > 0, iterations=4)
        resto = ndimage.binary_opening(resto, iterations=8)
        et2, n2 = ndimage.label(resto)
        for k2 in range(1, n2 + 1):
            comp = et2 == k2
            if comp.sum() * M.RES ** 2 < 1.5:
                continue
            for pg in M.contornos_a_poligonos(ndimage.binary_dilation(comp, iterations=8) & ~ocup, lz, 0.03):
                if pg.area >= 1.5:
                    dentro = [t for t in textos if pg.contains(Point(t[1], t[2]))]
                    self.ambientes.append(dict(poligono=pg, nombre=unir_nombres(dentro), area=pg.area))
        # dos consultorios numerados en un mismo ambiente: el tabique que los separa no está en el DXF
        nuevos = []
        for a in self.ambientes:
            dentro = [t for t in textos if a['poligono'].contains(Point(t[1], t[2])) and
                      re.fullmatch(r'CONSULTORIO - \d\d', t[0])]
            if len(dentro) == 2:
                (n1, x1, y1), (n2, x2, y2) = dentro
                mx, my = (x1 + x2) / 2, (y1 + y2) / 2
                dx, dy = x2 - x1, y2 - y1
                lado = Polygon([(mx - dy * 50, my + dx * 50), (mx + dy * 50, my - dx * 50),
                                (mx + dy * 50 + dx * 50, my - dx * 50 + dy * 50),
                                (mx - dy * 50 + dx * 50, my + dx * 50 + dy * 50)])
                pg = a['poligono']
                linea = LineString([(mx - dy * 50, my + dx * 50), (mx + dy * 50, my - dx * 50)]).intersection(pg)
                for nom, parte in ((n2, pg.intersection(lado)), (n1, pg.difference(lado))):
                    parte = max(lista_polis(parte), key=lambda g: g.area)
                    nuevos.append(dict(poligono=parte, nombre=nom, area=parte.area))
                if not linea.is_empty:
                    self.tabiques.append(dict(linea=linea, poligono=linea.buffer(0.05, cap_style=2)))
            else:
                nuevos.append(a)
        self.ambientes = nuevos
        # un ambiente no cruza sus puertas: se corta en cada vano y se queda la pieza mayor; sin astillas
        limpios = []
        rects = [p['rect'] for p in self.puertas]
        for a in self.ambientes:
            pg = a['poligono']
            for r in rects:
                if pg.intersects(r):
                    piezas = lista_polis(pg.difference(r.buffer(0.03, join_style=2)))
                    if piezas:
                        pg = max(piezas, key=lambda g: g.area)
            if pg.area < 3 and min_ancho(pg) < 0.5:
                continue
            a['poligono'], a['area'] = pg, pg.area
            limpios.append(a)
        self.ambientes = limpios
        # huella del edificio (losa): ambientes, muros y columnas, sin huecos interiores
        todo = unary_union([a['poligono'] for a in self.ambientes] + [self.muros_raw] + self.columnas)
        todo = todo.buffer(0.3, join_style=2).buffer(-0.3, join_style=2)
        self.huella = unary_union([Polygon(p.exterior) for p in lista_polis(todo) if p.area > 5])
        self.ambientes = [a for a in self.ambientes if a['area'] > 0.8]

    def _etiquetas(self):
        fuera = {'ZONAS'}
        out = []
        for c, t, x, y, h, ap in self.textos:
            if c in fuera:
                continue
            lineas = [l for l in t.split('\n') if l.strip()]
            t = ' '.join(t.split())
            if not t or re.fullmatch(r'[sS]|N = 0.00|24 ESCALONES.*', t):
                continue
            if re.fullmatch(r'\d\d', t):
                t = ('CONSULTORIO - ' if int(t) >= 10 else 'MÓDULO ') + t
            X, Y = self.L((x, y))
            hm = h / 1000
            ancho = max(len(l) for l in lineas) * hm * 0.62
            alto = len(lineas) * hm * 1.35
            col, fila = (ap - 1) % 3, (ap - 1) // 3          # 0 izq/arriba, 1 centro, 2 der/abajo
            cx = X + ancho * (0.5 - 0.5 * col)
            cy = Y - alto * (0.5 - 0.5 * fila)
            out.append((t, cx, cy))
        # quitar duplicados exactos
        vistos, res = set(), []
        for t in out:
            k = (t[0], round(t[1], 1), round(t[2], 1))
            if k not in vistos:
                vistos.add(k)
                res.append(t)
        return res


    # --- nombres finales: baños sin rótulo y espacios abiertos con varios rótulos
    def _nombres(self):
        san = [mu['poligono'].centroid for mu in self.muebles if mu['cat'] == 'sanitario']
        for a in self.ambientes:
            pg = a['poligono']
            fijo = next((n for q, n in NOMBRES.items() if pg.contains(Point(q))), None)
            if fijo:
                a['nombre'] = fijo
                continue
            if not a['nombre']:
                if any(pg.contains(c) for c in san):
                    a['nombre'] = 'SS.HH.'
                elif any(pg.intersection(unary_union(tr).convex_hull).area > 0.5 for tr in self.tramos):
                    a['nombre'] = 'ESCALERA'
                continue
            partes = a['nombre'].split(' / ')
            bloque = [x for x in partes if x.startswith('BLOQUE')]
            if bloque:
                otras = [x for x in partes if not x.startswith('BLOQUE')]
                a['nombre'] = ' / '.join(['PASILLO ' + bloque[0]] + otras)
                continue
            if len(partes) > 2:
                pref = [x for x in partes if 'ESPERA' in x or 'HALL' in x or 'FARMACIA' in x or 'LABORATORIO' in x]
                otras = [x for x in partes if x not in pref and not x.startswith('BLOQUE')]
                a['nombre'] = ' / '.join((pref + otras)[:2])

    # --- mobiliario: bloques y capas de muebles
    def _mobiliario(self):
        alturas = {'AS-14': ('Inodoro', 0.40, 'sanitario'), 'INOD': ('Inodoro', 0.40, 'sanitario'),
                   'AS-03': ('Lavamanos', 0.85, 'sanitario'), 'S1': ('Silla', 0.90, 'mueble'),
                   'AS-07': ('Lavamanos doble', 0.85, 'sanitario'), 'AS-28': ('Urinario', 0.60, 'sanitario'),
                   'AS-08': ('Desagüe de piso', 0.03, 'sanitario'), 'AS-21': ('Plato de ducha', 0.05, 'sanitario'),
                   '_U32': ('Lavamanos', 0.85, 'sanitario'), '_U40': ('Lavamanos', 0.85, 'sanitario'),
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
        # mesones dibujados como polilínea cerrada (mueble de lavamanos, recepción)
        for c, t, p, cerrada in self.planos:
            if c in ('P0 - Mobiliario', 'MU') and len(p) >= 4:
                q = Polygon(self.Lp(p)).buffer(0)
                if 0.25 < q.area < 12 and min_ancho(q) > 0.3:
                    self.muebles.append(dict(nombre='Mesón', poligono=q, altura=0.90, cat='mueble'))
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
        segs = [s for s in self._segmentos({'GR'}) if s.length > 0.6]
        segs += [s for s in self._segmentos({'Rebars'}) if 0.8 < s.length < 1.7]
        self.tramos = []
        usados = set()
        for i, s in enumerate(segs):
            if i in usados:
                continue
            ang = angulo(s)
            grupo = [i]
            (xa, ya), (xb, yb) = s.coords[0], s.coords[-1]
            u = np.array([xb - xa, yb - ya]) / max(s.length, 1e-9)
            def intervalo(l):
                ts = [float(np.dot(np.array(c), u)) for c in l.coords]
                return min(ts), max(ts)
            i0, i1 = intervalo(s)
            for j, o in enumerate(segs):
                if j != i and j not in usados and abs(((angulo(o) - ang + 90) % 180) - 90) < 3 and \
                        abs(o.length - s.length) < 0.3 and o.distance(s) < 4.0:
                    j0, j1 = intervalo(o)
                    if min(i1, j1) - max(i0, j0) > 0.6 * min(i1 - i0, j1 - j0):   # misma fila de huellas
                        grupo.append(j)
            if len(grupo) >= 3:
                lineas = [segs[k] for k in grupo]
                # huellas reales: espaciado regular de 0,22 a 0,40 m y al menos 1 m de avance
                (xa, ya), (xb, yb) = s.coords[0], s.coords[-1]
                u = np.array([xb - xa, yb - ya]) / max(s.length, 1e-9)
                nrm = np.array([-u[1], u[0]])
                off = sorted(float(np.dot(np.array(l.centroid.coords[0]), nrm)) for l in lineas)
                pasos = np.diff(off)
                pasos = pasos[pasos > 0.05]
                if len(pasos) >= 2 and 0.22 <= float(np.median(pasos)) <= 0.40 and off[-1] - off[0] >= 0.55:
                    usados.update(grupo)
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

"""
Modelo de un piso cualquiera con el mismo proceso de la planta baja (revit/modelo.py): muros, columnas,
ventanas, puertas, tabiques, escaleras, ambientes con nombre, mobiliario.
Los ajustes a mano de modelo.py (CIERRES, ZONAS, NOMBRES…) son de la planta baja vieja: aquí se vacían,
y cada piso puede traer los suyos en AJUSTES.
Uso: python3 planta_real/pisos/modelo_piso.py P1   (deja /tmp/modelo_P1.pkl)
"""
import os
import sys
import pickle
import traceback

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(AQUI, '..', 'revit'))
sys.path.insert(0, AQUI)

import modelo as MOD          # noqa: E402
import muros as M             # noqa: E402
from shapely.ops import unary_union  # noqa: E402
import fuente                 # noqa: E402

# ajustes propios de cada piso (mismo formato que las constantes de modelo.py)
AJUSTES = {
    'SB': {}, 'PB': {}, 'P1': {}, 'P2': {}, 'P3': {},
}
# correcciones con los PDF por zonas que revisó el hospital (planta_real/planos/p1_zonas, ver pdf_zonas.py):
# - gris: en la zona, los muros son los sombreados en gris del PDF; se quitan las líneas de muro del DXF (capas
#   PA, P0 - Paredes, TA, NO, Rebars), que dibujan también mostradores, jardineras y bordes que no son muros
# - lineas: se suman los trazos del PDF como líneas de muro (bloques dibujados en capas que no son de muros)
# - quitar: se quitan trazos de esas capas en la zona (el tragaluz triangular dibujado con la capa de ventanas)
from shapely.geometry import box, Polygon  # noqa: E402
CORRECCIONES = {
    'P1': [
        # ventanal corrido de las habitaciones del lado sur del ala oeste: dos líneas de «P0 - Paredes» de 51 m
        # (en el PDF es vidrio, no muro sombreado): se toman como ventana antes de quitar las líneas de muro
        # ventanales del lado sur (habitaciones impares y cafetería): en el DXF son tramos del contorno de muros;
        # en el PDF, dos líneas finas paralelas → bandas de ventana
        dict(tipo='ventanas_pdf', carpeta='p1_zonas', zona=box(3, 76.8, 51, 78.9), solo='1'),
        dict(tipo='gris', carpeta='p1_zonas', zona=box(-3, 70, 61.25, 100.45),
             capas={'PA', 'P0 - Paredes', 'TA', 'NO', 'Rebars'}),
        # tragaluz triangular sobre el paso entre el ala oeste y la torre: en el PDF son líneas finas, no muros
        dict(tipo='quitar', zona=Polygon([(56.5, 84.45), (68.6, 87.15), (56.5, 89.5)]), capas={'P0 - Paredes', 'VE'}),
        dict(tipo='lineas', carpeta='p1_zonas', zona=box(76, 22, 85, 41.6), solo='5',
             capas={'NO', 'TA'}),   # hall interno, recepción, TICs, jefatura, sala de reuniones
        dict(tipo='lineas', carpeta='p1_zonas', zona=box(62.8, 104.8, 70.6, 109.6), solo='3'),   # gradas de emergencia
        # ventanas de las habitaciones del ala oeste (dibujadas en «P0 - Ventanas»): cierran cada cuarto
        dict(tipo='capa', zona=box(-3, 70, 61.25, 100.45), de='P0 - Ventanas', a='VE'),
        # el bloque suelto al este de la torre es el piso alto del Banco de Sangre (encima del de la planta baja:
        # Cuarentena, Serología, Sub Bodega, Criopreservación, Centrífuga, Despachos); confirmado por el hospital,
        # aunque no está en el PDF del piso 1. Antes se borraba con dict(tipo='borrar', zona=box(92, 85, 112, 106)).
        # cierre de la habitación 17 contra la terraza (el muro del PDF llega al ventanal; el dibujo deja una rendija)
        dict(tipo='muro', zona=box(6.0, 76.95, 6.25, 77.95)),
    ],
    'PB': [
        # tabiques del DWG 2025 dibujados como pares de líneas en las capas NO y TA (laboratorio de genética, medicina
        # nuclear, emergencia, dirección…): en el plano son muros; el modelo solo tomaba los de la capa de paredes
        dict(tipo='pares', zona=box(0, -45, 200, 130), capas={'NO', 'TA'}, dmin=0.06, dmax=0.3, minimo=0.5),
    ],
    'SB': [
        # búnkeres de los aceleradores lineales 1, 2 y 3: el blindaje de hormigón va dibujado en la capa de columnas
        # (contorno exterior y caras interiores) con el forro en la capa PA. Los muros de más de 0,6 m (el muro entre
        # los aceleradores 1 y 2, de 2,4 m; los muros del laberinto, de 0,8 a 1,1 m) quedaban como «cuartos» angostos
        # entre dos líneas, y los pares de líneas de abajo cerraban con tapas sueltas el paso del laberinto. Aquí todo lo
        # que está dentro del contorno del búnker y no es el recinto de un acelerador (con su laberinto y su entrada) es
        # hormigón macizo, de la cara interior a la exterior.
        dict(tipo='macizo', zona=Polygon([(141.29, 60.5), (165.54, 60.5), (165.54, 70.15), (159.24, 70.15),
                                          (159.24, 72.6), (141.29, 72.6)]),
             capas={'COL', 'PA'}, textos=('ACELERADOR',),
             # el muro entre los aceleradores 1 y 2 llega al muro norte: el dibujo deja sin línea el tramo entre el
             # bloque central (y 69,95) y el forro del muro norte, y los dos recintos se juntaban por ahí
             cierres=[((149.64, 69.9), (149.64, 72.65)), ((150.74, 69.9), (150.74, 72.65))]),
        # búnkeres de los aceleradores, del tomógrafo y de radioterapia: muros de hormigón de 0,3 a 2,4 m dibujados como
        # pares de líneas en la capa de columnas (el modelo solo empareja muros delgados); sin los de los aceleradores,
        # que van macizos (arriba)
        dict(tipo='pares', zona=box(128, 28, 173, 73), capas={'COL'}, dmin=0.25, dmax=2.5,
             excluir=box(141.25, 60.45, 165.6, 72.65)),
        # tabique de una línea (capa NO) entre el comedor del personal y la cafetería
        dict(tipo='lineas_muro', zona=box(96.3, 27.0, 97.3, 43.2), capas={'TA', 'NO'}, minimo=0.8),
        # vanos del auditorio hacia el hall (sin bloque de puerta: se cierran y van como puertas en PUERTAS_EXTRA)
        dict(tipo='muro', zona=box(62.82, 51.45, 63.0, 53.0)),
        dict(tipo='muro', zona=box(62.82, 46.3, 63.0, 48.0)),
        dict(tipo='muro', zona=box(62.82, 40.4, 63.0, 41.85)),
        # cierre superior del muro entre los aceleradores 1 y 2 (en el plano llega hasta el muro norte del búnker)
        dict(tipo='muro', zona=box(149.9, 69.9, 150.5, 72.6)),
    ],
}


# separadores de ambientes (marco de la planta baja), como modelo.SEPARADORES: aberturas sin puerta que en el plano
# dividen dos espacios. En el subsuelo, la entrada del laberinto de cada acelerador (el vano de 2,1 m del muro sur del
# búnker): sin ellos el recinto del acelerador se juntaba con el pasillo de radioterapia en un solo ambiente
SEPARADORES_PB = {
    'SB': [((146.79, 60.5), (148.89, 60.5)), ((151.54, 60.5), (153.64, 60.5)), ((159.24, 60.5), (161.34, 60.5))],
}
# muros macizos de cada piso (polígonos en metros del marco de la planta baja) que deja corregir(): se suman rellenos
# a los muros del modelo (el contorno dibujado solo cierra muros de hasta 0,6 m)
MACIZOS = {}


def macizo(c, planos, textos):
    """Hormigón de un recinto blindado: la zona (contorno exterior) menos las caras libres que contienen uno de los
    rótulos (el recinto con su laberinto y su entrada). Las caras salen de poligonizar las líneas de las capas dadas
    recortadas a la zona, junto con el borde de la zona."""
    from shapely.geometry import LineString as LS, Point as PT
    from shapely.ops import polygonize
    import numpy as np
    z = c['zona']
    ls = [z.exterior] + [LS(q).intersection(z) for q in c.get('cierres', [])]
    for e in planos:
        if e[0] in c['capas'] and len(e[2]) >= 2:
            pts = [np.array((x / 1000, y / 1000)) for x, y in e[2]]
            for a_, b_ in zip(pts[:-1], pts[1:]):
                d = np.linalg.norm(b_ - a_)
                if d < 1e-4:
                    continue
                # cada tramo se alarga 3 cm por punta: el dibujo deja juntas de milímetros que no cierran las caras
                u = (b_ - a_) / d * 0.03
                l = LS([tuple(a_ - u), tuple(b_ + u)])
                if l.intersects(z):
                    ls.append(l.intersection(z))
    caras = list(polygonize(unary_union(ls)))
    rot = [PT(t[2] / 1000, t[3] / 1000) for t in textos
           if any(r in str(t[1]).upper() for r in c['textos'])]
    libres = [q for q in caras if any(q.contains(p) for p in rot)]
    sol = z.difference(unary_union(libres)) if libres else Polygon()
    return [q for q in getattr(sol, 'geoms', [sol]) if not q.is_empty and q.area > 0.01], len(libres)


def corregir(piso, planos, bloques, textos):
    import pdf_zonas
    from shapely.geometry import LineString as LS, Point as PT
    MACIZOS[piso] = []
    for c in CORRECCIONES.get(piso, []):
        z = c['zona']
        if c['tipo'] == 'macizo':
            sol, n = macizo(c, planos, textos)
            MACIZOS[piso] += sol
            print(piso, 'macizo', n, 'recintos', round(sum(q.area for q in sol), 1), 'm²')
            continue
        if c['tipo'] in ('pares', 'lineas_muro'):
            ls = []
            for e in planos:
                if e[0] in c['capas'] and len(e[2]) >= 2:
                    pts = [(x / 1000, y / 1000) for x, y in e[2]]
                    for a_, b_ in zip(pts[:-1], pts[1:]):
                        l = LS([a_, b_])
                        if z.contains(l) and l.length >= c.get('minimo', 0.5) \
                                and not ('excluir' in c and c['excluir'].contains(l)):
                            ls.append(l)
            nuevos = []
            if c['tipo'] == 'lineas_muro':
                nuevos = [l.buffer(0.05, cap_style=2) for l in ls]
            else:
                import numpy as np
                from shapely.strtree import STRtree
                arbol = STRtree(ls)
                usado = set()
                for i, l1 in enumerate(ls):
                    (x1, y1), (x2, y2) = l1.coords
                    u = np.array([x2 - x1, y2 - y1]) / l1.length
                    n = np.array([-u[1], u[0]])
                    mejor = None
                    for j in arbol.query(l1.buffer(c['dmax'] + 0.01)):
                        j = int(j)
                        l2 = ls[j]
                        if j == i:
                            continue
                        (a1, b1), (a2, b2) = l2.coords
                        v = np.array([a2 - a1, b2 - b1]) / l2.length
                        if abs(abs(float(u @ v)) - 1) > 0.01:
                            continue
                        dd = float((np.array([a1, b1]) - [x1, y1]) @ n)
                        if not (c['dmin'] <= abs(dd) <= c['dmax']):
                            continue
                        t = sorted([float((np.array(q) - [x1, y1]) @ u) for q in l2.coords])
                        lo, hi = max(0.0, t[0]), min(l1.length, t[1])
                        if hi - lo < 0.5:
                            continue
                        if mejor is None or abs(dd) < abs(mejor[0]):
                            mejor = (dd, lo, hi, j)
                    if mejor and (min(i, mejor[3]), max(i, mejor[3])) not in usado:
                        usado.add((min(i, mejor[3]), max(i, mejor[3])))
                        dd, lo, hi, _ = mejor
                        p0 = np.array([x1, y1])
                        nuevos.append(Polygon([tuple(p0 + u * lo), tuple(p0 + u * hi), tuple(p0 + u * hi + n * dd),
                                               tuple(p0 + u * lo + n * dd)]))
            for q in nuevos:
                planos.append(('P0 - Paredes', 'LWPOLYLINE', [(x * 1000, y * 1000) for x, y in q.exterior.coords], True))
            print(piso, c['tipo'], len(nuevos))
            continue
        if c['tipo'] == 'capa':
            n = 0
            for i, e in enumerate(planos):
                if e[0] == c['de'] and len(e[2]) >= 2 and z.contains(LS([(x / 1000, y / 1000) for x, y in e[2]])) \
                        and LS([(x / 1000, y / 1000) for x, y in e[2]]).length >= c.get('min_largo', 0):
                    planos[i] = (c['a'],) + tuple(e[1:])
                    n += 1
            print(piso, 'capa', c['de'], '->', c['a'], n)
            continue
        if c['tipo'] == 'muro':
            planos.append(('P0 - Paredes', 'LWPOLYLINE', [(x * 1000, y * 1000) for x, y in z.exterior.coords], True))
            continue
        if c['tipo'] == 'ventanas_pdf':
            vs = pdf_zonas.bandas_ventana(c['carpeta'], z, c.get('solo'), minimo=1.5, direcciones=(True,))
            for q in vs:
                planos.append(('VE', 'LWPOLYLINE', [(x * 1000, y * 1000) for x, y in q.exterior.coords], True))
            print(piso, 'ventanas_pdf', len(vs), [tuple(round(v, 1) for v in q.bounds) for q in vs][:12])
            continue
        if c['tipo'] == 'ventanal':
            # dos líneas paralelas largas a menos de 0,6 m: se cierran como una banda de ventana (capa VE)
            largas = [i for i, e in enumerate(planos) if e[0] == c['capa'] and len(e[2]) == 2
                      and z.contains(LS([(x / 1000, y / 1000) for x, y in e[2]]))
                      and LS([(x / 1000, y / 1000) for x, y in e[2]]).length >= c['min_largo']]
            usadas = set()
            for i in largas:
                for j in largas:
                    if j <= i or i in usadas or j in usadas:
                        continue
                    a_, b_ = LS(planos[i][2]), LS(planos[j][2])
                    if a_.distance(b_) < 600 and abs(a_.length - b_.length) < 2000:
                        p0, p1 = planos[i][2]
                        q0, q1 = planos[j][2]
                        if (p0[0] - p1[0]) * (q0[0] - q1[0]) + (p0[1] - p1[1]) * (q0[1] - q1[1]) < 0:
                            q0, q1 = q1, q0
                        planos.append(('VE', 'LWPOLYLINE', [p0, p1, q1, q0, p0], True))
                        usadas |= {i, j}
            planos = [e for k, e in enumerate(planos) if k not in usadas]
            print(piso, 'ventanal', len(usadas) // 2)
            continue
        if c['tipo'] == 'borrar':
            dentro = lambda pts: len(pts) >= 2 and z.intersects(LS([(x / 1000, y / 1000) for x, y in pts]))
            a = (len(planos), len(bloques), len(textos))
            planos = [e for e in planos if not dentro(e[2])]
            bloques = [b for b in bloques if not z.contains(PT(b['x'] / 1000, b['y'] / 1000))]
            textos = [t for t in textos if not z.contains(PT(t[2] / 1000, t[3] / 1000))]
            print(piso, 'borrar', a, '->', (len(planos), len(bloques), len(textos)))
            continue
        capas = c.get('capas', set())
        if capas:
            def dentro(e):
                pts = [(x / 1000, y / 1000) for x, y in e[2]]
                return len(pts) >= 2 and z.buffer(0.05).contains(LS(pts))
            antes = len(planos)
            planos = [e for e in planos if not (e[0] in capas and dentro(e))]
            print(piso, c['tipo'], 'quitados', antes - len(planos))
        if c['tipo'] == 'gris':
            g = pdf_zonas.muros_grises(c['carpeta'], z)
            for q in g:
                pts = [(x * 1000, y * 1000) for x, y in q.exterior.coords]
                planos.append(('P0 - Paredes', 'LWPOLYLINE', pts, True))
            print(piso, 'gris', len(g), 'muros del PDF')
        elif c['tipo'] == 'lineas':
            ls = pdf_zonas.lineas(c['carpeta'], z, c.get('solo'))
            for pts in ls:
                planos.append(('PA', 'LINE', [(x * 1000, y * 1000) for x, y in pts], False))
            print(piso, 'lineas', len(ls), 'trazos del PDF')
    return planos, bloques, textos


CONSTANTES = ('CIERRES', 'EXTERIOR_FORZADO', 'SEPARADORES', 'ZONAS', 'NOMBRES', 'NOMBRES_ZONA', 'EXTERIORES')
PASOS = ('_columnas', '_ventanas', '_puertas', '_gradas', '_nucleo_hall', '_franjas', '_tabiques', '_escaleras',
         '_muros', '_ambientes', '_mobiliario', '_nombres', '_ajustes_finales')


class ModeloPiso(MOD.Modelo):
    def __init__(self, piso):
        self.piso = piso
        vacios = {'CIERRES': [], 'EXTERIOR_FORZADO': [], 'SEPARADORES': [], 'ZONAS': [], 'NOMBRES': {},
                  'NOMBRES_ZONA': [], 'EXTERIORES': []}
        vacios.update(AJUSTES.get(piso, {}))
        for k in CONSTANTES:
            setattr(MOD, k, vacios[k])
        self.planos, self.bloques, self.textos = fuente.cargar(piso)
        self.planos, self.bloques, self.textos = corregir(piso, self.planos, self.bloques, self.textos)
        vistos, bl = set(), []
        for b in self.bloques:
            k = (b['nombre'], round(b['x']), round(b['y']), round(b['rot'] or 0))
            if k not in vistos:
                vistos.add(k)
                bl.append(b)
        self.bloques = bl
        self.textos = list(dict.fromkeys(self.textos))
        polis, self.lz, *_ = M.extraer(self.planos, self.bloques)
        self.x0, self.y0 = self.lz.x0, self.lz.y0
        o = (self.x0 / 1000.0, self.y0 / 1000.0)
        MOD.SEPARADORES = list(MOD.SEPARADORES) + [((a[0] - o[0], a[1] - o[1]), (b[0] - o[0], b[1] - o[1]))
                                                   for a, b in SEPARADORES_PB.get(piso, [])]
        from shapely import affinity
        polis = list(polis) + [affinity.translate(q, -self.x0 / 1000.0, -self.y0 / 1000.0)
                               for q in MACIZOS.get(piso, [])]
        self.muros_raw = unary_union(polis)
        self.fallos = []
        for paso in PASOS:
            try:
                getattr(self, paso)()
            except Exception as e:   # un paso propio de la planta baja que no aplica a este piso
                self.fallos.append((paso, repr(e)))
                traceback.print_exc()

    @property
    def origen(self):
        """Desplazamiento (m) del marco del modelo al marco de la planta baja."""
        return self.x0 / 1000.0, self.y0 / 1000.0

    # Puertas «-PDE» (hoja con arco, como P-DE): el modelo de la planta baja vieja no las conocía y quedaban sin puerta
    # (centrales de gases de la U.C.I.). Se leen como una P-DE más, sin tocar la lista de revit/modelo.py.
    def _puertas(self):
        pde = [b for b in self.bloques if b['nombre'].startswith('-PDE')]
        for b in pde:
            b['nombre'] = 'P-DE' + b['nombre']
        try:
            MOD.Modelo._puertas(self)
        finally:
            for b in pde:
                b['nombre'] = b['nombre'][4:]
        for p in self.puertas:
            if p['tipo'].startswith('P-DE-PDE'):
                p['tipo'] = p['tipo'][4:]

    # Bandas de la capa VE, como en revit/modelo.py, pero sin descartar las ventanas chicas: allí el mínimo era
    # 0,08 m², y una ventana de 1,1 m en un tabique de 7 cm (0,077 m²) se perdía y quedaba como pared. Aquí basta
    # con 0,03 m² y medio metro de largo.
    def _ventanas(self):
        import numpy as np
        from scipy import ndimage
        tr = [p for c, _, p, _ in self.planos if c == 'VE']
        lineas = self.lz.dibujar(tr, 1)
        cuad = np.ones((3, 3), bool)
        banda = ndimage.binary_opening(ndimage.binary_closing(lineas, structure=cuad, iterations=8), iterations=2)
        polis = M.contornos_a_poligonos(banda, self.lz)
        ve = unary_union([p for p in polis if p.area > 0.03])
        ve = ve.intersection(self.muros_raw.buffer(0.03))
        ve = ve.difference(unary_union(self.columnas).buffer(0.02))

        def largo(q):
            c = list(q.minimum_rotated_rectangle.exterior.coords)
            return max(MOD.math.dist(c[0], c[1]), MOD.math.dist(c[1], c[2]))
        self.ventanas = [p for p in MOD.lista_polis(ve.buffer(-0.005).buffer(0.005))
                         if p.area > 0.08 or (p.area > 0.03 and largo(p) >= 0.5)]

    # Ventanas interiores. El modelo de la planta baja vieja pasaba a muro toda banda de la capa VE que quedara entre
    # dos ambientes («las ventanas están en la fachada»). En el DWG 2025 hay ventanas entre cuartos y hacia los
    # pasillos (consultorios, laboratorios, estaciones de enfermería, quirófanos): salían como pared ciega. Aquí la
    # banda sigue siendo ventana cuando el dibujo trae el símbolo de ventana completo, es decir, las dos caras del
    # muro y al menos una línea de vidrio entre ellas (tres o más líneas paralelas a lo largo de la banda). Con solo
    # dos líneas es un muro dibujado en la capa de vidrios y se queda como muro, igual que antes.
    def _ventanas_interiores(self):
        import math
        import numpy as np
        from shapely.geometry import Point
        from shapely.strtree import STRtree
        amb = unary_union([a['poligono'] for a in self.ambientes])
        segs = [s for s in self._segmentos({'VE'}) if s.length >= 0.3]
        arbol = STRtree(segs) if segs else None
        quedan, self.ventanas_interiores, self.bandas_ve_muro = [], [], []
        for v in self.ventanas:
            r = v.minimum_rotated_rectangle
            c = list(r.exterior.coords)
            l1, l2 = math.dist(c[0], c[1]), math.dist(c[1], c[2])
            a_, b_ = (c[0], c[1]) if l1 >= l2 else (c[1], c[2])
            u = np.array(b_) - np.array(a_)
            L = np.linalg.norm(u)
            u = u / L
            n = np.array([-u[1], u[0]])
            w = min(l1, l2)
            ctr = np.array(r.centroid.coords[0])
            lados = []
            for lado in (1, -1):
                pts = [Point(*(ctr + u * L * f + n * lado * (w / 2 + 0.45))) for f in (-0.4, -0.2, 0, 0.2, 0.4)]
                lados.append(sum(amb.contains(p_) for p_ in pts) / len(pts))
            if min(lados) < 0.6:
                quedan.append(v)        # fachada: ventana, como siempre
                continue
            # líneas de la capa VE a lo largo de la banda: distancias distintas al eje (a más de 1,5 cm una de otra)
            cerca = r.buffer(0.04, join_style=2)
            dist = []
            for i in (arbol.query(cerca) if arbol is not None else []):
                s = segs[int(i)]
                (x0, y0), (x1, y1) = s.coords[0], s.coords[-1]
                d = np.array([x1 - x0, y1 - y0]) / s.length
                if abs(abs(float(d @ u)) - 1) > 0.01:
                    continue
                dentro = s.intersection(cerca).length
                if dentro < max(0.3, 0.4 * L):
                    continue
                dist.append(float((np.array(s.interpolate(0.5, normalized=True).coords[0]) - ctr) @ n))
            dist.sort()
            lineas = [d for k, d in enumerate(dist) if k == 0 or d - dist[k - 1] > 0.015]
            # (dos líneas a menos de 10 cm son un vidrio sin muro alrededor: mampara o ventana de un tabique delgado)
            if len(lineas) >= 3 or (len(lineas) == 2 and w <= 0.10):
                quedan.append(v)
                self.ventanas_interiores.append(v)
            else:
                self.muros.append(v)
                self.bandas_ve_muro.append((v, len(lineas), round(float(L), 2), round(float(w), 2)))
        self.ventanas = quedan
        print(self.piso, 'ventanas interiores', len(self.ventanas_interiores), '; bandas VE que quedan como muro',
              len(self.bandas_ve_muro))


if __name__ == '__main__':
    piso = sys.argv[1]
    from modelo_piso import ModeloPiso as MP   # así el pickle guarda la clase como modelo_piso.ModeloPiso
    m = MP(piso)
    print(piso, 'ambientes', len(getattr(m, 'ambientes', [])), 'puertas', len(getattr(m, 'puertas', [])),
          'muros', len(getattr(m, 'muros', [])), 'origen', m.origen, 'fallos', m.fallos)
    pickle.dump(m, open(f'/tmp/modelo_{piso}.pkl', 'wb'))

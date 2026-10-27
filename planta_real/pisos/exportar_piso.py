"""
Datos de un piso para la web (public/<piso>/datos.json), con el mismo formato que la planta baja
(planta_real/web/exportar_datos.py): ambientes, muros, ventanas, puertas, trazos, muebles, gradas, entradas y la
rejilla de navegación. Todo en el marco de la planta baja (mismo GEO): los pisos quedan uno sobre otro.

Diferencia con la planta baja: no hay líneas verdes dibujadas a mano. La red de pacientes se arma sola con el
eje de los espacios de circulación (pasillos, halls, salas de espera y espacios abiertos sin nombre).
Uso: python3 planta_real/pisos/exportar_piso.py P1   (lee /tmp/modelo_P1.pkl)
"""
import os
import sys
import json
import math
import base64
import pickle
import numpy as np
import cv2
from scipy import ndimage
from shapely.geometry import Polygon, Point, LineString
from shapely.ops import unary_union, polylabel

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, '..', '..'))
sys.path.insert(0, os.path.join(RAIZ, 'planta_real', 'revit'))
sys.path.insert(0, os.path.join(RAIZ, 'planta_real', 'web'))
sys.path.insert(0, AQUI)
import exportar_datos as ED   # noqa: E402
from modelo import lista_polis  # noqa: E402

from shapely.geometry import box  # noqa: E402
from shapely import affinity  # noqa: E402
# ambientes que el dibujo no cierra (marco de la planta baja): el ascensor y la escalera del Bloque A en el piso 1
# están dibujados como detalle (capas de ejes y gradas), sin muros alrededor
EXTRA = {
    'P1': [('ASCENSOR', box(47.97, 93.25, 51.07, 95.59)),
           ('ESCALERA', box(46.4, 91.7, 51.3, 97.8).difference(box(47.97, 93.25, 51.07, 95.59))),
           # bloque de servicio del ala oeste: las puertas de cada cuarto no están dibujadas como bloque, así que el
           # dibujo los junta con el pasillo angosto de su lado (orden de arriba abajo del PDF)
           ('BAÑO MUJERES', box(28.05, 84.45, 29.35, 85.9)),
           ('BAÑO HOMBRES', box(28.05, 82.85, 29.35, 84.35)),
           ('UTILERÍA SUCIA', box(28.05, 81.25, 29.35, 82.75)),
           ('LAVACHATA', box(28.05, 79.75, 29.35, 81.15)),
           ('LIMPIEZA', box(28.05, 78.3, 29.35, 79.65)),
           ('PASILLO', box(29.42, 78.45, 30.12, 86.0)),
           # baños públicos del bloque central de la torre (se entra desde los pasillos de cada lado)
           ('SS.HH.', box(72.38, 99.32, 73.62, 100.42)),
           ('SS.HH.', box(73.72, 99.32, 74.98, 100.42)),
           # terraza del extremo oeste (con baranda), al lado de la habitación 17
           ('TERRAZA', box(4.15, 76.75, 6.0, 84.95))],
    # piso 2, bloque central: la preparación médica se abre a la estación de enfermería por el mostrador (el dibujo
    # la junta con el pasillo) y el cuarto de ductos queda como hueco entre sus tres ductos
    'P2': [('PREPARACIÓN MÉDICA', box(72.16, 69.15, 74.84, 73.3)),
           ('DUCTOS', box(72.16, 76.2, 75.02, 78.54))],
}
# pisos donde los baños con inodoro que el dibujo deja sin ambiente (el inodoro de cada habitación, los dos baños
# chicos del bloque central) se suman como ambiente «BAÑO»
BANOS_HUECO = {'P2'}
# muros dobles que el dibujo deja huecos por dentro (marco de la planta baja): en el piso 2, el muro entre las
# habitaciones 207 y 205
MUROS_EXTRA = {
    'P2': [box(63.2, 67.85, 69.9, 68.37)],
}
# pasos que el dibujo tapa con un detalle (marco de la planta baja): en el piso 1, el puente vidriado entre el ala oeste
# y la torre tiene un tragaluz triangular dibujado con la capa de paredes; se camina a su alrededor
PASOS_LIBRES = {
    'P1': [LineString([(57.8, 86.25), (69.3, 86.25)])],
}
# exterior encerrado por el dibujo: en el piso 1, el rincón entre la fachada norte, el ducto diagonal y los baños del
# hall interno (en el PDF no tiene muros que lo cierren)
EXTERIOR = {
    'P1': [box(76.8, 40.9, 81.0, 45.7),
           box(2.4, 89.9, 3.95, 95.6),
           box(3.5, 75.3, 50.6, 77.0)],   # franja de jardineras y pérgola entre el ventanal sur y la fachada   # balcón con baranda entre la escalera de emergencia y la habitación 16
}
NOMBRES_PISO = {'SB': 'Subsuelo 1', 'PB': 'Planta baja', 'P1': 'Piso 1', 'P2': 'Piso 2', 'P3': 'Piso 3'}
CIRCULACION = ('PASILLO', 'HALL', 'CIRCULACION', 'CORREDOR', 'ESPERA', 'VESTIBULO', 'RECEPCION', 'ESTAR')
r2 = ED.r2


import re  # noqa: E402
# rótulos que no son nombres de ambiente: códigos de red y de cuarto (C2-L1-089, G1-11), luminarias (L8), zonas,
# rutas de evacuación y notas de nivel
RUIDO = re.compile(r'^(?:[A-Z]\d-[A-Z]\d(?:-\d+[A-Z]?)?|[A-Z]\d-\d+|[A-Z]-\d-\d+|L\d+|ZONA \d+|\(?(PRIMER|SEGUNDO|TERCER) +PISO\)?|'
                   r'PISO \d|PLANTA BAJA|PLANTA|SUBSUELO \d?|N ?[=+] ?[\d.,]+|MC-[\w-]+|\d+ ESCALO[MN]ES.*|'
                   r'GRADAS DE EMERGENCIA.*|\d+ ?(?:ER|DO|RO|TO|O)\.? PISO|PUNTO DE ENCUENTRO|PARQUEADERO \d*|HACIA PB|DE PISO|S)$', re.I)


def limpiar_nombre(n):
    if not n:
        return ''
    partes = []
    for p in n.split(' / '):
        if RUIDO.match(p.strip()):
            continue
        pal = [w for w in p.split() if not RUIDO.match(w)]
        q = ' '.join(pal).strip(' -·')
        if q and not RUIDO.match(q) and q not in partes:
            partes.append(q)
    return ' / '.join(partes[:2])


def habitaciones(m):
    """Rótulos «HAB 101» que el modelo no asignó (texto girado: su punto de inserción cae en el borde del cuarto, y el
    cuarto quedó con el código de red de un tomacorriente): cada cuarto sin nombre toma el rótulo de habitación que cae
    dentro o a menos de 0,6 m, si es uno solo y no lo tiene ya otro cuarto."""
    import re as _re
    usados = {a['nombre'].upper() for a in m.ambientes if a['nombre']}
    hab = []
    for c, t, x, y, h, ap in m.textos:
        t = ' '.join(t.split())
        if _re.fullmatch(r'HAB\.? ?\d{1,3}', t, _re.I) and t.upper() not in usados:
            hab.append((t.upper(), Point(*m.L((x, y)))))
    for a in sorted(m.ambientes, key=lambda a: a['area']):
        if a['nombre'] or not (8 <= a['area'] <= 60):
            continue
        cand = {t for t, p in hab if a['poligono'].contains(p)}
        if not cand:
            cand = {t for t, p in hab if a['poligono'].buffer(0.6).contains(p)}
        if len(cand) == 1:
            a['nombre'] = cand.pop()
            hab = [(t, p) for t, p in hab if t != a['nombre']]


def banos_hueco(m):
    """Baños que el dibujo no cierra como ambiente: espacio libre de 0,8 a 5 m², rodeado por los ambientes del piso
    (también en los bordes de la fachada) y con un inodoro adentro."""
    amb = unary_union([a['poligono'] for a in m.ambientes])
    env = amb.buffer(2.0, join_style=2).buffer(-2.0, join_style=2)
    duro = unary_union([m.muros_raw] + m.columnas + [t['poligono'] for t in m.tabiques])
    resto = env.difference(amb.buffer(0.02)).difference(duro.buffer(0.02))
    ino = [mu['poligono'] for mu in m.muebles if mu['nombre'] == 'Inodoro']
    n = 0
    for q in lista_polis(resto):
        if 0.8 <= q.area <= 5 and not q.buffer(-0.25).is_empty and any(q.intersects(i) for i in ino):
            m.ambientes.append(dict(poligono=q, nombre='BAÑO', area=q.area, extra=True))
            n += 1
    print('baños sin ambiente', n)


def barandas(m):
    """Barra entre los tramos de una escalera (dibujada como tabique): es baranda de 1 m, no muro. Se saca de los
    tabiques y queda en m.barandas (sigue siendo obstáculo para la ruta)."""
    if hasattr(m, 'barandas'):
        return m.barandas
    tramos = [unary_union(t).convex_hull for t in getattr(m, 'tramos', [])]
    esc = [a['poligono'].convex_hull.buffer(-0.15) for a in m.ambientes
           if sum(a['poligono'].intersection(h).area for h in tramos) >= 0.4 * a['area']]
    m.barandas, quedan = [], []
    for t in m.tabiques:
        g = t['poligono']
        rr = list(g.minimum_rotated_rectangle.exterior.coords)
        lados = sorted(math.dist(rr[i], rr[i + 1]) for i in range(4))
        if lados[0] <= 0.35 and lados[-1] >= 1.5 and any(g.intersection(e).area >= 0.9 * g.area for e in esc if not e.is_empty):
            m.barandas.append(g)
        else:
            quedan.append(t)
    m.tabiques = quedan
    return m.barandas


def es_circulacion(nombre, area):
    n = (nombre or '').upper()
    if not n:
        return area >= 30
    return any(c in n for c in CIRCULACION)


def unir_partes(libre, res, columnas, salto=3.0, minimo=12.0):
    """Partes del piso libre separadas por un detalle del dibujo (un vidrio, un vano mal cerrado): se unen a la
    parte principal con un paso recto de 0,75 m si quedan a menos de `salto` metros. Las partes de menos de
    `minimo` m² que no se unen se descartan (huecos de muebles, ductos)."""
    et, n = ndimage.label(libre, structure=np.ones((3, 3)))
    if n <= 1:
        return libre
    tam = ndimage.sum(np.ones_like(et), et, index=np.arange(1, n + 1))
    main = et == (1 + int(np.argmax(tam)))
    pendientes = [k + 1 for k in np.argsort(-tam) if et[et == k + 1].size and k + 1 != 1 + int(np.argmax(tam))
                  and tam[k] * res * res >= minimo]
    while pendientes:
        dist, idx = ndimage.distance_transform_edt(~main, return_indices=True)
        mejor = None
        for k in pendientes:
            msk = et == k
            dd = np.where(msk, dist, np.inf)
            j = np.unravel_index(np.argmin(dd), dd.shape)
            if mejor is None or dd[j] < mejor[0]:
                mejor = (dd[j], k, j)
        d, k, (iy, ix) = mejor
        if d * res > salto:
            break
        ty, tx = idx[0][iy, ix], idx[1][iy, ix]
        paso = np.zeros(libre.shape, np.uint8)
        cv2.line(paso, (int(ix), int(iy)), (int(tx), int(ty)), 1, 3)
        paso = (paso > 0) & ~columnas
        main |= (et == k) | paso
        pendientes.remove(k)
    return main


def huella_real(m):
    """Contorno del edificio en este piso: unión de los ambientes (no el contorno de la losa de abajo, que en
    los pisos altos viene dibujado alrededor de la torre). Se quedan las partes de 50 m² o más."""
    g = unary_union([a['poligono'].buffer(0.35, join_style=2) for a in m.ambientes]).buffer(-0.2, join_style=2)
    partes = [q for q in lista_polis(g) if q.area >= 50]
    return unary_union([Polygon(q.exterior) for q in partes])


def pasillos(m):
    """Ambientes de circulación por forma: tres puertas o más y 15 m² o más (los pasillos de la torre vienen
    sin rótulo o con el de un ducto que cae adentro)."""
    mids = [Point(*((np.array(p['a']) + np.array(p['b'])) / 2)) for p in m.puertas]
    for a in m.ambientes:
        pg = a['poligono'].buffer(0.4)
        n = sum(1 for q in mids if pg.contains(q))
        a['puertas'] = n
        rr = a['poligono'].minimum_rotated_rectangle
        lados = sorted(math.dist(*c) for c in zip(list(rr.exterior.coords)[:-1], list(rr.exterior.coords)[1:]))
        alargado = lados[0] > 0 and lados[-1] / lados[0] >= 3 and lados[-1] >= 8
        nom = (a['nombre'] or '').upper()
        servicio = any(k in nom for k in ('ACONDICIONADO', 'DUCTO', 'ABASTECIMIENTO', 'TABLERO'))
        if n >= 3 and a['area'] >= 15 and (alargado or a['area'] >= 60) and (not nom or (servicio and a['area'] >= 40)):
            a['nombre'] = 'PASILLO'
        # alargado y con varias puertas: es un espacio de paso aunque tenga nombre (el «Reloj» del subsuelo)
        a['circula'] = n >= 3 and a['area'] >= 15 and alargado
        # recepciones y vestíbulos que reparten a varios cuartos (Banco de Sangre -> Flebotomía): se pueden cruzar
        a['reparte'] = (n >= 3 and a['area'] >= 15 and 'BAÑO' not in nom and 'SS.HH' not in nom) or \
            (('FILTRO' in nom or 'ESCLUSA' in nom) and 'PERSONAL' not in nom)   # esclusa de aislamiento (piso 3)
        # antesalas y pasillos cortos sin rótulo que reparten a dos o más cuartos (oficinas del subsuelo)
        if not nom and n >= 2 and a['area'] >= 4:
            a['reparte'] = True


def exportar(m, piso, salida):
    ox, oy = m.origen
    for a in m.ambientes:
        a['nombre'] = limpiar_nombre(a['nombre'])
    habitaciones(m)
    for nombre, g in EXTRA.get(piso, []):
        g = affinity.translate(g, -ox, -oy)
        quedan = []
        for a in m.ambientes:
            if a['poligono'].intersects(g) and not a.get('extra'):
                for q in lista_polis(a['poligono'].difference(g)):
                    if q.area > 0.5 and q.buffer(-0.25).area > 0.2:   # sin las rendijas que deja el corte
                        quedan.append(dict(a, poligono=q, area=q.area))
            else:
                quedan.append(a)
        m.ambientes = quedan + [dict(poligono=g, nombre=nombre, area=g.area, extra=True)]
    if piso in BANOS_HUECO:
        banos_hueco(m)
    # escaleras: ambientes sin nombre (o con la nota del piso) que contienen tramos de gradas
    for a in m.ambientes:
        if a['nombre']:
            continue
        if any(a['poligono'].intersection(unary_union(tr).convex_hull).area > 0.5 for tr in getattr(m, 'tramos', [])):
            a['nombre'] = 'ESCALERA'
    print('barandas', len(barandas(m)))
    # un patio o parqueadero cerrado por el contorno del dibujo, con solo el rótulo de una puerta: es exterior
    m.ambientes = [a for a in m.ambientes if not (re.fullmatch(r'PUERTA \d+|PARQUEADERO.*|TERRAZA.*', (a['nombre'] or '').upper())
                                                  and a['area'] > 150)]
    # espacios que el dibujo cierra pero que en el plano revisado son exterior (marco local)
    for g in EXTERIOR.get(piso, []):
        g = affinity.translate(g, -ox, -oy)
        m.ambientes = [a for a in m.ambientes if a['poligono'].intersection(g).area < 0.5 * a['poligono'].area]
    hu = huella_real(m)
    m.ambientes = [a for a in m.ambientes if a['poligono'].intersection(hu).area > 0.5 * a['poligono'].area]
    pasillos(m)
    amb = []
    for i, a in enumerate(sorted(m.ambientes, key=lambda a: -a['area'])):
        pg = a['poligono']
        try:
            lbl = polylabel(pg, tolerance=0.05)
        except Exception:
            lbl = pg.representative_point()
        p = ED.poli(pg, 0.04)
        amb.append(dict(id=f'a{i}', nombre=ED.nombre_bonito(a['nombre']) if a['nombre'] else '',
                        original=a['nombre'] or '', cat=ED.categoria_web(a['nombre']) if a['nombre'] else 'otro',
                        icono=ED.icono(a['nombre']), area=r2(a['area']), pg=p[0] if p else [],
                        lbl=[r2(lbl.x), r2(lbl.y)]))
        if a.get('reparte') or a.get('circula'):
            amb[-1]['paso'] = True
    duro = unary_union([m.muros_raw] + m.columnas + [t['poligono'] for t in m.tabiques] +
                       list(getattr(m, 'parapetos', [])) + list(getattr(m, 'foso', [])) +
                       [affinity.translate(g, -ox, -oy) for g in MUROS_EXTRA.get(piso, [])])
    vent = unary_union(m.ventanas + list(getattr(m, 'vidrios', [])) + list(getattr(m, 'ventanillas', [])))
    puertas = unary_union([p['rect'] for p in m.puertas]) if m.puertas else Polygon()
    muros = duro.difference(vent.buffer(0.005)).difference(puertas.buffer(0.01)).intersection(hu.buffer(0.6))
    vent = vent.intersection(hu.buffer(0.6))
    trazos_p, trazos_s = [], []
    for b in m.bloques:
        n = b['nombre']
        if 'COL' in n or n.startswith('FD') or n.startswith('Ventanilla') or n.startswith('-EJ') or n.startswith('-NIVEL'):
            continue
        es_p = n.startswith(('P-IZ', 'P-DE', '_U41', '_U42', '_U43', '_U44', '_U45', '-MP', 'P-DUC', '-PDE'))
        for g in b['geo']:
            pts = m.Lp(g[1])
            if len(pts) < 2:
                continue
            if g[2] and len(pts) >= 3:
                pts = pts + [pts[0]]
            ls = LineString(pts).simplify(0.01)
            if ls.length < 0.05 or not hu.buffer(1).intersects(ls):
                continue
            (trazos_p if es_p else trazos_s).append(ED.anillo(ls.coords))
    muebles = []
    for mu in m.muebles:
        if mu['nombre'].startswith('Respaldo') or mu['nombre'] == 'Manija' or not hu.intersects(mu['poligono']):
            continue
        for q in ED.poli(mu['poligono'], 0.01):
            muebles.append(dict(t=mu['cat'] if mu['cat'] in ('sanitario', 'silla', 'camilla') else 'mueble', pg=q))
    for e in m.escritorios:
        if not hu.intersects(e):
            continue
        for q in ED.poli(e, 0.01):
            muebles.append(dict(t='mueble', pg=q))
    gradas = [ED.anillo(l.coords) for tr in getattr(m, 'tramos', []) for l in tr if hu.buffer(1).intersects(l)]

    # entradas desde la calle: solo en los pisos con puertas al exterior (subsuelo y planta baja)
    ent = []
    if piso in ('SB', 'PB'):
        textos = [(t, *m.L((x, y))) for c, t, x, y, h, ap in m.textos if t.strip().upper().startswith('PUERTA')]
        borde = hu.boundary
        cand = []
        for p in m.puertas:
            mid = (np.array(p['a']) + np.array(p['b'])) / 2
            if borde.distance(Point(*mid)) < 0.6 and p['ancho'] >= 0.85:
                nom = None
                for t, x, y in textos:
                    if math.dist((x, y), mid) < 6:
                        nom = ' '.join(t.split()).title()
                nrm = p['nrm']
                dentro = mid + nrm * 0.7 if hu.contains(Point(*(mid + nrm * 0.7))) else mid - nrm * 0.7
                fuera = mid - (dentro - mid) * 2.5
                cand.append(dict(nombre=nom, x=r2(dentro[0]), y=r2(dentro[1]), fx=r2(fuera[0]), fy=r2(fuera[1]),
                                 ancho=r2(p['ancho'])))
        for e in sorted(cand, key=lambda e: (e['nombre'] is None, -e['ancho'])):
            if all(math.dist((e['x'], e['y']), (o['x'], o['y'])) > 4 for o in ent):
                ent.append(e)
        k = 0
        for e in ent:
            if not e['nombre']:
                k += 1
                e['nombre'] = f'Acceso {piso} {k}'
        ent.sort(key=lambda e: e['nombre'])
        for e in ent:
            e['id'] = 'entrada-' + piso.lower() + '-' + e['nombre'].lower().replace(' ', '-')

    # ------------------------------------------------ rejilla de navegación (0,25 m)
    RES = 0.25
    x0, y0, x1, y1 = hu.bounds
    x0, y0 = math.floor(x0) - 2, math.floor(y0) - 2
    W, H = int((x1 - x0 + 4) / RES) + 1, int((y1 - y0 + 4) / RES) + 1

    def ras(geoms, dil=0.0):
        img = np.zeros((H, W), np.uint8)
        for g in geoms:
            for q in lista_polis(g.buffer(dil, join_style=2) if dil else g):
                cv2.fillPoly(img, [np.array([[(x - x0) / RES, (y - y0) / RES] for x, y in q.exterior.coords], np.int32)], 1)
                for h_ in q.interiors:
                    cv2.fillPoly(img, [np.array([[(x - x0) / RES, (y - y0) / RES] for x, y in h_.coords], np.int32)], 0)
        return img > 0
    interior = ras([a['poligono'] for a in m.ambientes])
    obst = ras([duro, vent] + list(m.barandas) + [mu['poligono'] for mu in m.muebles if mu['nombre'] not in ('Tope de puerta',)] +
               list(m.escritorios))
    libre = interior & ~ndimage.binary_dilation(obst, iterations=1)
    vanos = []
    for p in m.puertas:
        a, b = np.array(p['a']), np.array(p['b'])
        d, n = p['dir'], p['nrm']
        vanos.append(Polygon([tuple(a + d * 0.12 - n * 0.6), tuple(b - d * 0.12 - n * 0.6), tuple(b - d * 0.12 + n * 0.6),
                              tuple(a + d * 0.12 + n * 0.6)]))
    if vanos:
        libre |= ras(vanos) & ~ras([unary_union(m.columnas)])
    for e in ent:
        libre |= ras([LineString([(e['x'], e['y']), (e['fx'], e['fy'])]).buffer(0.6)])
    forzados = [affinity.translate(g, -ox, -oy) for g in PASOS_LIBRES.get(piso, [])]
    if forzados:
        libre |= ras([g.buffer(0.7) for g in forzados])
    libre = unir_partes(libre, RES, ras([unary_union(m.columnas)]) if m.columnas else np.zeros_like(libre))
    dist = ndimage.distance_transform_edt(libre) * RES
    costo = np.clip(np.round((0.9 - np.minimum(dist, 0.9)) / 0.9 * 6), 0, 6).astype(np.uint8)
    celdas = np.where(libre, costo + 1, 0).astype(np.uint8)
    for a, src in zip(amb, sorted(m.ambientes, key=lambda a: -a['area'])):
        pg = src['poligono']
        msk = ras([pg.buffer(-0.05)]) & libre
        if not msk.any():
            msk = ras([pg.buffer(0.6)]) & libre
        if msk.any():
            fy, fx = np.indices(dist.shape)
            lx, ly = (a['lbl'][0] - x0) / RES, (a['lbl'][1] - y0) / RES
            score = np.where(msk, np.minimum(dist, 0.8) * 4 - np.hypot(fx - lx, fy - ly) * RES * 0.15, -1e9)
            iy, ix = np.unravel_index(np.argmax(score), score.shape)
            a['dest'] = [r2(x0 + ix * RES), r2(y0 + iy * RES)]
        else:
            a['dest'] = None
    cuarto = np.zeros((H, W), np.uint16 if len(m.ambientes) > 255 else np.uint8)
    ordenados = sorted(m.ambientes, key=lambda a: -a['area'])
    for k in sorted(range(len(ordenados)), key=lambda k: -ordenados[k]['area']):
        cuarto[ras([ordenados[k]['poligono'].buffer(0.15)])] = k + 1
    # red de pacientes: eje (esqueleto) de los espacios de circulación, para que las rutas vayan por el centro
    circ = np.zeros((H, W), bool)
    for k, a in enumerate(ordenados):
        if es_circulacion(a['nombre'], a['area']) or a.get('circula'):
            circ |= cuarto == k + 1
    circ |= (cuarto == 0) & libre
    circ &= libre
    from skimage.morphology import skeletonize
    eje = skeletonize(circ & (dist >= 0.5))
    red = ndimage.binary_dilation(eje, iterations=1) & libre
    # puertas de los cuartos públicos hacia la circulación también forman parte de la red (vano de cada puerta)
    if vanos:   # el vano de las puertas entre dos espacios de circulación
        red |= ras(vanos) & circ
    if forzados:
        red |= ras([g.buffer(0.3) for g in forzados]) & libre
    red = red.astype(np.uint8)
    huella_m = ras(list(hu.geoms) if hasattr(hu, 'geoms') else [hu])
    if ent:
        vereda = ndimage.binary_dilation(huella_m, iterations=int(round(1.5 / RES))) & ~huella_m
        celdas[vereda & (celdas == 0)] = 2
    else:
        vereda = np.zeros_like(huella_m)
    print(piso, 'red', int(red.sum()), 'celdas libres', int((celdas > 0).sum()))
    nav = dict(x0=x0, y0=y0, res=RES, w=W, h=H, celdas=base64.b64encode(celdas.tobytes()).decode(),
               cuarto=base64.b64encode(cuarto.astype('<u2' if cuarto.dtype == np.uint16 else np.uint8).tobytes()).decode(),
               red=base64.b64encode(red.tobytes()).decode(),
               vereda=base64.b64encode(vereda.astype(np.uint8).tobytes()).decode())
    if cuarto.dtype == np.uint16:
        nav['cuartoBits'] = 16
    datos = dict(
        nombre=f'Hospital SOLCA Quito · {NOMBRES_PISO[piso]}',
        fuente='Planos actualizados HOSPITAL SOLCA QUITO 2025 (DWG del edificio)',
        geo=ED.GEO, altura=3.84,
        huella=ED.poli(hu, 0.05), ambientes=amb, muros=ED.poli(muros, 0.015), ventanas=ED.poli(vent, 0.015),
        barandas=ED.poli(unary_union(m.barandas), 0.015) if m.barandas else [],
        puertas=[dict(a=[r2(v) for v in p['a']], b=[r2(v) for v in p['b']], c=round(float((p['t0'] + p['t1']) / 2), 3),
                      doble=bool(p['doble']), ducto=p['tipo'].startswith('P-DUC')) for p in m.puertas
                 # puertas sueltas lejos del edificio (en el piso 2, una 50 m al este)
                 if hu.buffer(2).contains(Point(*((np.array(p['a']) + np.array(p['b'])) / 2)))],
        trazos_puertas=trazos_p, trazos=trazos_s, muebles=muebles, gradas=gradas,
        viseras=[], entradas=ent, nav=nav, parqueos=[], poi=[],
    )
    trasladar(datos, ox, oy)
    os.makedirs(os.path.dirname(salida), exist_ok=True)
    with open(salida, 'w') as f:
        json.dump(datos, f, ensure_ascii=False, separators=(',', ':'))
    print('datos', salida, round(os.path.getsize(salida) / 1e6, 2), 'MB', len(amb), 'ambientes', len(ent), 'entradas',
          'rejilla', W, 'x', H)
    return datos


def trasladar(d, ox, oy):
    """Del marco del modelo (lienzo) al marco de la planta baja."""
    def par(p):
        return [r2(p[0] + ox), r2(p[1] + oy)]

    def anillos(pg):            # [[x,y],...] o [[[x,y],...],...] o más profundo
        if pg and isinstance(pg[0], (int, float)):
            return par(pg)
        return [anillos(q) for q in pg]
    d['huella'] = anillos(d['huella'])
    for a in d['ambientes']:
        a['pg'] = anillos(a['pg'])
        a['lbl'] = par(a['lbl'])
        if a.get('dest'):
            a['dest'] = par(a['dest'])
    for k in ('muros', 'ventanas', 'barandas', 'trazos_puertas', 'trazos', 'gradas'):
        d[k] = anillos(d[k])
    for p in d['puertas']:
        p['a'], p['b'] = par(p['a']), par(p['b'])
    for mu in d['muebles']:
        mu['pg'] = anillos(mu['pg'])
    for e in d['entradas']:
        e['x'], e['y'] = r2(e['x'] + ox), r2(e['y'] + oy)
        e['fx'], e['fy'] = r2(e['fx'] + ox), r2(e['fy'] + oy)
    d['nav']['x0'] = round(d['nav']['x0'] + ox, 3)
    d['nav']['y0'] = round(d['nav']['y0'] + oy, 3)


if __name__ == '__main__':
    piso = sys.argv[1]
    import __main__
    import modelo_piso
    __main__.ModeloPiso = modelo_piso.ModeloPiso   # modelos guardados al correr modelo_piso.py como script
    m = pickle.load(open(sys.argv[2] if len(sys.argv) > 2 else f'/tmp/modelo_{piso}.pkl', 'rb'))
    exportar(m, piso, os.path.join(RAIZ, 'public', piso.lower(), 'datos.json'))

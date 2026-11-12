"""
Modelo 3D (GLB) de un piso, con el mismo proceso de la planta baja: modelo -> IFC (revit/a_ifc.py) -> GLB
(web/exportar_glb.py). Se recorta a la huella real del piso (en los pisos altos, la torre; no la losa de abajo) y
se lleva al marco de la planta baja (los pisos quedan uno sobre otro en las mismas coordenadas).

Con --fuera-de <datos.json> solo se dejan los elementos que quedan fuera de la huella de ese plano: así se arma la
parte nueva de la planta baja sin repetir la que ya estaba.
Uso: python3 planta_real/pisos/glb_piso.py P1 [salida.glb] [--fuera-de public/pb/datos.json]
"""
import os
import sys
import json
import pickle

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, '..', '..'))
sys.path.insert(0, os.path.join(RAIZ, 'planta_real', 'revit'))
sys.path.insert(0, os.path.join(RAIZ, 'planta_real', 'web'))
sys.path.insert(0, AQUI)

import math  # noqa: E402
import collections  # noqa: E402
from shapely.geometry import Polygon, Point, LineString, MultiPoint, MultiPolygon, box  # noqa: E402
from shapely.ops import unary_union  # noqa: E402
from shapely import affinity  # noqa: E402
import exportar_piso as EP  # noqa: E402


def recortar(m, zona):
    """Deja en el modelo solo lo que cae dentro de `zona` (marco del modelo)."""
    def dentro(g, frac=0.5):
        try:
            return g.intersection(zona).area >= frac * max(g.area, 1e-9) if g.area > 0 else zona.contains(g.centroid)
        except Exception:
            return False
    m.ambientes = [a for a in m.ambientes if dentro(a['poligono'])]
    m.muros = [pg.intersection(zona) for pg in m.muros if pg.intersects(zona)]
    m.muros = [g for g in m.muros if not g.is_empty and g.area > 0.005]
    m.ventanas = [pg for pg in m.ventanas if dentro(pg)]
    m.columnas = [pg for pg in m.columnas if zona.contains(pg.centroid)]
    m.puertas = [p for p in m.puertas if zona.contains(p['rect'].centroid)]
    m.muebles = [mu for mu in m.muebles if zona.contains(mu['poligono'].centroid)]
    for k in ('ventanillas', 'parapetos', 'viseras', 'vidrios', 'foso'):
        if hasattr(m, k):
            setattr(m, k, [pg for pg in getattr(m, k) if zona.contains(pg.centroid)])
    if hasattr(m, 'tabiques'):
        m.tabiques = [t for t in m.tabiques if zona.contains(t['poligono'].centroid)]
    if hasattr(m, 'escaleras'):
        m.escaleras = [e for e in m.escaleras if any(zona.contains(q.centroid) for q, _ in e['pasos'])]
    if getattr(m, 'puerta_ascensor', None) is not None and not zona.contains(m.puerta_ascensor['rect'].centroid
                                                                              if isinstance(m.puerta_ascensor, dict) else
                                                                              m.puerta_ascensor.centroid):
        m.puerta_ascensor = None
    m.huella = m.huella.intersection(zona) if not m.huella.is_empty else m.huella


# ---------------------------------------------------------------------------------------------------------------
# Cierres de fachada del 3D (no tocan el 2D ni datos.json: solo se aplican al armar el GLB). Marco de la planta baja.
#
# Gradas de emergencia del norte de la torre (junto a la Puerta 4). El DXF dibuja su muro perimetral como dos líneas
# a 20 cm: en los pisos altos en la capa TA (el modelo no empareja líneas de esa capa y las dejaba fuera) y en la
# planta baja en la capa AY (proyección: el muro arranca en el descanso, sobre el corte del plano). Sin ese muro,
# los descansos salían de la fachada como losas sueltas y los tramos quedaban a la vista.
_ANILLO_GRADAS = box(64.9, 104.2, 71.8, 108.3).difference(box(65.6, 105.3, 71.3, 107.6))
CAJAS_ESCALERA = {
    # quitar: en el piso 1 el lado oeste ya venía del PDF por zonas, corrido 15 cm; se reemplaza por el del DXF para
    # que el muro quede a plomo con los de los otros pisos. como: en el piso 1 el dibujo omite la cara de fuera del
    # lado norte (en los pisos 2 y 3 está); se completa con el muro del piso 2, que es la misma caja
    'P1': [dict(zona=_ANILLO_GRADAS, capas={'TA'}, quitar=box(64.8, 104.95, 66.27, 108.5), como='P2')],
    'P2': [dict(zona=_ANILLO_GRADAS, capas={'TA'})],
    'P3': [dict(zona=_ANILLO_GRADAS, capas={'TA'})],
}
# planta baja (va en el modelo viejo, ver recortar_vieja): solo el lado oeste, alrededor del descanso
CAJA_ESCALERA_PB = dict(zona=box(64.9, 104.7, 66.4, 108.3).difference(box(65.6, 105.3, 66.4, 107.6)), capas={'AY'})
# Pérgola de la entrada norte (delante del hall de vidrio): el plano del piso 1 la dibuja completa en la capa
# «P0 - Pergola», del muro de fachada a la columna de la torre, con su borde y cuatro costillas. El modelo viejo de
# la planta baja traía solo dos losas sueltas sacadas de la capa AY, que no llegaban a ningún apoyo.
PERGOLA_PB = box(42.3, 99.4, 63.0, 104.7)
# descanso de las gradas de emergencia a nivel del piso 1, sobre la salida de la planta baja
DESCANSO_P1 = box(70.1, 104.6, 71.8, 108.3)


def _tramos(m, zona, capas, minimo):
    """Tramos rectos del DXF (marco del modelo, sin repetir) de esas capas, dentro de `zona` (marco de la planta baja)."""
    ox, oy = m.origen
    z = affinity.translate(zona, -ox, -oy)
    vistos = set()
    for e in m.planos:
        if e[0] not in capas or len(e[2]) < 2:
            continue
        pts = [(round(x / 1000.0 - ox, 3), round(y / 1000.0 - oy, 3)) for x, y in e[2]]
        for a, b in zip(pts[:-1], pts[1:]):
            if a != b:
                vistos.add((min(a, b), max(a, b)))
    return [l for l in (LineString(s) for s in sorted(vistos)) if l.length >= minimo and z.contains(l)]


def muros_de_pares(m, zona, capas, dmin=0.12, dmax=0.25, minimo=0.25):
    """Muros dibujados como dos líneas paralelas (a entre dmin y dmax): un polígono por par, del largo del par y con
    la esquina a inglete (envolvente de las dos líneas)."""
    ls = _tramos(m, zona, capas, minimo)
    out = []
    for i, l1 in enumerate(ls):
        (x1, y1), (x2, y2) = l1.coords
        ux, uy = (x2 - x1) / l1.length, (y2 - y1) / l1.length
        for l2 in ls[i + 1:]:
            (a1, b1), (a2, b2) = l2.coords
            vx, vy = (a2 - a1) / l2.length, (b2 - b1) / l2.length
            if abs(abs(ux * vx + uy * vy) - 1) > 0.01:
                continue
            d = abs((a1 - x1) * -uy + (b1 - y1) * ux)
            if not (dmin <= d <= dmax):
                continue
            t = sorted([(a1 - x1) * ux + (b1 - y1) * uy, (a2 - x1) * ux + (b2 - y1) * uy])
            if min(l1.length, t[1]) - max(0.0, t[0]) < 0.8 * minimo:
                continue
            out.append(MultiPoint(list(l1.coords) + list(l2.coords)).convex_hull)
    return out


def _polis(g):
    if g.is_empty:
        return []
    # (también abre las colecciones con multipolígonos dentro que devuelve make_valid: antes esas piezas se perdían)
    return [g] if isinstance(g, Polygon) else [p for h in getattr(g, 'geoms', []) for p in _polis(h)]


def _macizos(m, con_muros=True):
    """Piezas que cierran la fachada, una por elemento."""
    sol = (list(m.muros) if con_muros else []) + list(m.ventanas) + list(m.columnas) + [p['rect'] for p in m.puertas]
    for k in ('ventanillas', 'vidrios', 'foso'):
        sol += list(getattr(m, k, []) or [])
    return [q for q in sol if q is not None and not q.is_empty]


def dinteles_de_vanos(m):
    """Vanos de fachada sin cerramiento (el contorno del piso pasa sin muro, ventana ni puerta) de hasta unos 3 m,
    entre dos piezas de la fachada: el dintel es la franja que une los extremos de esas dos piezas."""
    from shapely.ops import linemerge
    from shapely.strtree import STRtree
    sol = _macizos(m)
    if not sol or m.huella.is_empty:
        return []
    S = unary_union(sol)
    arbol = STRtree(sol)
    libre = m.huella.boundary.difference(S.buffer(0.32))
    if libre.geom_type == 'MultiLineString':
        libre = linemerge(libre)
    out = []
    for t in getattr(libre, 'geoms', [libre]):
        if t.is_empty or t.geom_type != 'LineString' or not (0.12 <= t.length <= 2.6):
            continue
        a, b = Point(t.coords[0]), Point(t.coords[-1])
        if a.distance(b) < 0.9 * t.length:      # el contorno dobla: no es un vano entre dos piezas alineadas
            continue
        pa, pb = sol[int(arbol.nearest(a))], sol[int(arbol.nearest(b))]
        if pa is pb or pa.distance(a) > 0.5 or pb.distance(b) > 0.5:
            continue
        def vale(g):
            if g is None or g.is_empty or g.area < 0.02:
                return False
            r = list(g.minimum_rotated_rectangle.exterior.coords)
            lados = sorted(math.dist(r[k], r[k + 1]) for k in range(2))
            return lados[0] <= 0.45 and g.area >= 0.6 * lados[0] * lados[1]
        piezas = _polis(unary_union([pa.intersection(a.buffer(0.7)), pb.intersection(b.buffer(0.7))])
                        .convex_hull.difference(S))
        g = max(piezas, key=lambda q: q.area) if piezas else None
        if not vale(g):
            # piezas que no están en línea (una ventana y un muro que llega de canto): el dintel sigue a la ventana,
            # con su mismo ancho, hasta la otra pieza
            g = None
            medio = t.interpolate(0.5, normalized=True)
            for v, otro in ((pa, pb), (pb, pa)):
                r = v.minimum_rotated_rectangle
                if not any(v is w for w in m.ventanas) or v.area < 0.97 * r.area:
                    continue
                c = list(r.exterior.coords)
                k = 0 if math.dist(c[0], c[1]) >= math.dist(c[1], c[2]) else 1
                ux, uy = c[k + 1][0] - c[k][0], c[k + 1][1] - c[k][1]
                n = math.hypot(ux, uy)
                s = 1 if (medio.x - r.centroid.x) * ux + (medio.y - r.centroid.y) * uy > 0 else -1
                d = v.distance(otro) + 0.05
                largo = unary_union([r, affinity.translate(r, s * ux / n * d, s * uy / n * d)]).convex_hull
                cand = [q for q in _polis(largo.difference(S)) if q.distance(medio) < 0.6]
                if cand and vale(max(cand, key=lambda q: q.area)):
                    g = max(cand, key=lambda q: q.area)
                    break
            if g is None:
                continue
        out.append(g)
    return out


# ---------------------------------------------------------------------------------------------------------------
# Envolvente (auditoría de fachadas, nov 2026). Vista desde fuera con el edificio completo, la planta quedaba abierta
# a la calle en tramos del contorno sin muro, ventana ni puerta: el modelo arma los muros con pares de líneas de la
# capa de paredes y en la fachada el DWG dibuja muchos tramos en otras capas (TA, NO, MU, columnas en COL), o los
# deja sin cerrar donde el muro de la fachada coincide con el borde de la losa (AY). Se recorre el contorno del piso
# (y el borde de los patios que se ven desde arriba) y cada tramo abierto se cierra según lo que trae el plano a lo
# largo de él: ventana si hay líneas de la capa VE; muro si hay líneas de muro; si el plano no trae nada, es un vano
# abierto de verdad (acceso, porche) y lleva solo el dintel a la altura de los de las ventanas.
CAPAS_VENTANA = {'VE', 'P0 - Ventanas'}
CAPAS_MURO = {'PA', 'P0 - Paredes', 'TA', 'NO', 'MU', 'COL', 'Rebars', 'P0 - Antepecho', 'AY'}
# tramos que el plano deja abiertos a propósito aunque haya líneas a lo largo (marco de la planta baja): llevan solo
# el dintel. (piso: [(zona, motivo), ...])
ABIERTOS = {}
# espacios exteriores del plano (por su nombre): su borde queda abierto (terraza del ala oeste del piso 1…)
EXTERIORES = ('TERRAZA', 'PATIO', 'PORCHE', 'PORTICO', 'PÓRTICO', 'BALC', 'PERGOLA', 'PÉRGOLA', 'JARDIN', 'JARDÍN',
              'PARQUE', 'ESTACIONA', 'VEREDA', 'PLAZA', 'ALERO')
# tramos de fachada que se cierran con muro aunque el detector de capas diga otra cosa (marco de la planta baja)
FORZAR_MURO = {}


def _segmentos_dxf(m, capas, zona):
    """Tramos rectos del DXF de esas capas que tocan `zona` (marco del modelo). Se miran las líneas del modelo y
    también las del DXF tal cual (fuente.cargar): en el ala oeste del piso 1 los muros salen de los PDF por zonas y se
    quitan las líneas de muro del DXF, entre ellas las de los machones de la fachada norte entre ventana y ventana."""
    ox, oy = m.origen
    out = []
    planos = list(m.planos)
    try:
        import fuente
        planos += fuente.cargar(m.piso)[0]
    except Exception as e:     # sin la caché del DXF: solo las líneas del modelo
        print('envolvente: sin las líneas crudas del DXF', repr(e))
    for e in planos:
        if e[0] not in capas or len(e[2]) < 2:
            continue
        pts = [(x / 1000.0 - ox, y / 1000.0 - oy) for x, y in e[2]]
        for a, b in zip(pts[:-1], pts[1:]):
            if a != b:
                out.append((e[0], LineString([a, b])))
    if zona is None:
        return out
    from shapely.strtree import STRtree
    arbol = STRtree([l for _, l in out])
    return [out[int(i)] for i in arbol.query(zona)]


def contorno_fachada(m, piso, zona):
    """Contorno del piso que da a la calle o a un patio abierto (marco del modelo): el borde de la huella (sin las
    partes del corte con la planta baja vieja, que no son fachada) y el de los patios del plano (huecos de la huella
    de datos.json que el techo deja abiertos)."""
    ox, oy = m.origen
    lineas = [q.exterior for q in _polis(m.huella)]
    try:
        d = json.load(open(os.path.join(RAIZ, 'public', piso.lower(), 'datos.json'), encoding='utf-8'))
        for pg in d['huella']:
            for h in pg[1:]:
                ph = Polygon(h)
                if ph.area >= 2.0:
                    lineas.append(affinity.translate(ph.exterior, -ox, -oy))
    except (OSError, KeyError, ValueError):
        pass
    c = unary_union(lineas)
    if zona is not None:
        c = c.intersection(zona.buffer(-0.35, join_style=2))
    return c


def cerrar_fachada(m, piso, zona=None):
    """Cierra los tramos abiertos del contorno (ver arriba). Devuelve la lista de tramos cerrados."""
    from shapely.ops import linemerge
    import numpy as np
    ox, oy = m.origen
    contorno = contorno_fachada(m, piso, zona)
    if contorno.is_empty:
        return []
    # piezas que cierran (sin los dinteles de vano: un vano con dintel también se revisa contra el plano)
    sol = _macizos(m)
    S = unary_union(sol) if sol else Polygon()
    # tramos libres: cada 0,25 m del contorno, la perpendicular de 1 m a cada lado no toca ningún cerramiento. (Así una
    # fachada retranqueada hasta 1 m, una terraza o un porche con su muro o ventanal detrás, no se toma por abierta, y
    # sí se encuentran los machones de 40 cm que faltan entre ventana y ventana)
    import shapely
    shapely.prepare(S)
    # lo que es piso (para saber de qué lado está adentro): la huella sin los patios del plano
    cubierto = m.huella
    try:
        d = json.load(open(os.path.join(RAIZ, 'public', piso.lower(), 'datos.json'), encoding='utf-8'))
        patios = [affinity.translate(Polygon(h), -ox, -oy) for pg in d['huella'] for h in pg[1:]
                  if Polygon(h).area >= 2.0]
        if patios:
            cubierto = m.huella.difference(unary_union(patios))
    except (OSError, KeyError, ValueError):
        pass
    shapely.prepare(cubierto)
    tramos = []
    for c in getattr(contorno, 'geoms', [contorno]):
        if c.geom_type not in ('LineString', 'LinearRing') or c.length < 0.3:
            continue
        Lc = c.length
        nn = max(2, int(Lc / 0.25))
        run = []
        for i in range(nn + 1):
            s_ = Lc * i / nn
            p = c.interpolate(s_)
            q1, q2 = c.interpolate(max(0.0, s_ - 0.2)), c.interpolate(min(Lc, s_ + 0.2))
            dx, dy = q2.x - q1.x, q2.y - q1.y
            ln = math.hypot(dx, dy) or 1.0
            nx, ny = -dy / ln, dx / ln
            # hacia adentro del piso: de 1 m fuera a 0,6 m dentro (lo que está más adentro no cierra la fachada; si
            # ahí no hay líneas de muro en el plano, el tramo queda como vano con dintel)
            if not cubierto.contains(Point(p.x + nx * 0.3, p.y + ny * 0.3)):
                nx, ny = -nx, -ny
            if not S.intersects(LineString([(p.x - nx, p.y - ny), (p.x + nx * 0.6, p.y + ny * 0.6)])):
                run.append((p.x, p.y))
            else:
                if len(run) >= 2:
                    tramos.append(LineString(run))
                run = []
        if len(run) >= 2:
            tramos.append(LineString(run))
    if not tramos:
        return []
    libre = unary_union(tramos)
    libre = linemerge(libre) if libre.geom_type == 'MultiLineString' else libre
    abiertos = [(affinity.translate(z, -ox, -oy), mot) for z, mot in ABIERTOS.get(piso, [])]
    forzados = [affinity.translate(z, -ox, -oy) for z in FORZAR_MURO.get(piso, [])]
    segs = _segmentos_dxf(m, CAPAS_VENTANA | CAPAS_MURO, libre.buffer(0.7))
    amb = [(a['poligono'], (a.get('nombre') or '').upper()) for a in m.ambientes]
    cerrados = []
    for t in getattr(libre, 'geoms', [libre]):
        if t.is_empty or t.geom_type != 'LineString' or t.length < 0.2:
            continue
        t = t.simplify(0.05)
        cs = list(t.coords)
        for a, b in zip(cs[:-1], cs[1:]):
            s = LineString([a, b])
            L = s.length
            if L < 0.2:
                continue
            u = np.array([b[0] - a[0], b[1] - a[1]]) / L
            n = np.array([-u[1], u[0]])
            zona_s = s.buffer(0.6, cap_style=2)
            # líneas del plano paralelas al tramo: largo cubierto y distancia al contorno, por clase
            cubre = {'ventana': 0.0, 'muro': 0.0}
            desv = {'ventana': [], 'muro': []}
            for capa, l in segs:
                if not l.intersects(zona_s):
                    continue
                (x1, y1), (x2, y2) = l.coords
                v = np.array([x2 - x1, y2 - y1]) / l.length
                if abs(float(u @ v)) < 0.97:
                    continue
                dentro = l.intersection(zona_s)
                if dentro.is_empty or dentro.length < 0.1:
                    continue
                k = 'ventana' if capa in CAPAS_VENTANA else 'muro'
                # largo proyectado sobre el tramo (sin pasar de él)
                p = [float((np.array(q) - np.array(a)) @ u) for q in dentro.coords]
                cubre[k] += max(0.0, min(L, max(p)) - max(0.0, min(p)))
                desv[k] += [float((np.array(q) - np.array(a)) @ n) for q in dentro.coords]
            centro = s.centroid
            # borde de un espacio exterior del plano (terraza, patio, porche…): abierto de verdad, no se toca
            pc = [Point(*(np.array(centro.coords[0]) + n * f)) for f in (0.4, -0.4)]
            # (no una habitación que lleva la terraza en el nombre: «HAB. 17 / TERRAZA N+3.95» es un cuarto con ventana)
            if any(q.contains(p) and any(k in nom for k in EXTERIORES) and not nom.startswith('HAB')
                   for q, nom in amb for p in pc):
                continue
            if any(z.contains(centro) for z in forzados):
                clase = 'muro'
            elif any(z.contains(centro) for z, _ in abiertos):
                clase = 'abierto'
            elif cubre['ventana'] >= 0.4 * L:
                clase = 'ventana'
            elif cubre['muro'] >= 0.3 * L or cubre['ventana'] + cubre['muro'] >= 0.5 * L:
                clase = 'muro'
            else:
                clase = 'abierto'
            # posición y grueso: entre las líneas del plano de esa clase (de 12 a 30 cm); sin líneas, sobre el contorno
            ds = desv['ventana' if clase == 'ventana' else 'muro'] if clase != 'abierto' else []
            if ds:
                d0, d1 = min(ds), max(ds)
                if d1 - d0 > 0.30:          # líneas a los dos lados del contorno que no son un mismo muro
                    d0 = d1 = sorted(ds)[len(ds) // 2]
            else:
                d0 = d1 = 0.0
            g = max(0.12, d1 - d0)
            medio = (d0 + d1) / 2
            p0 = np.array(a) - u * 0.25 + n * medio
            p1 = np.array(b) + u * 0.25 + n * medio
            franja = LineString([tuple(p0), tuple(p1)]).buffer(g / 2, cap_style=2, join_style=2)
            piezas = [q for q in _polis(franja.difference(S)) if q.area > 0.01]
            if not piezas:
                continue
            if clase == 'abierto' and (S.distance(Point(a)) > 0.3 or S.distance(Point(b)) > 0.3):
                # un dintel que no apoya en nada a los dos lados quedaría flotando: el vano queda sin él
                continue
            if clase == 'ventana':
                m.ventanas += piezas
            elif clase == 'muro':
                m.muros += piezas
            else:
                m.dinteles_extra = list(getattr(m, 'dinteles_extra', [])) + piezas
            if clase != 'abierto':
                # el dintel de vano que había en ese tramo sobra: ahora hay ventana o muro
                nuevo = unary_union(piezas).buffer(0.05)
                m.dinteles_extra = [q for q in getattr(m, 'dinteles_extra', []) if not q.intersects(nuevo)]
            S = unary_union([S] + piezas)
            cerrados.append(dict(clase=clase, largo=round(L, 2),
                                 desde=[round(a[0] + ox, 2), round(a[1] + oy, 2)],
                                 hasta=[round(b[0] + ox, 2), round(b[1] + oy, 2)]))
    tot = collections.Counter()
    for c in cerrados:
        tot[c['clase']] += c['largo']
    print(piso, 'fachada cerrada:', {k: round(v, 1) for k, v in tot.items()}, 'm en', len(cerrados), 'tramos')
    return cerrados


def arreglar(m, piso):
    """Cierra la fachada antes de extruir: caja de las gradas de emergencia, dinteles en los vanos sin cerramiento,
    rendijas entre piezas y losa hasta la cara de fuera de los muros."""
    ox, oy = m.origen
    # 1. muro perimetral de las gradas de emergencia
    for c in CAJAS_ESCALERA.get(piso, []):
        if c.get('quitar') is not None:
            q = affinity.translate(c['quitar'], -ox, -oy)
            m.muros = [g for w in m.muros for g in _polis(w.difference(q)) if g.area > 0.005]
            m.tabiques = [dict(t, poligono=g) for t in getattr(m, 'tabiques', [])
                          for g in _polis(t['poligono'].difference(q)) if g.area > 0.005]
        pares = muros_de_pares(m, c['zona'], c['capas'])
        if c.get('como'):
            # tramos que el dibujo de este piso deja a medias: se toman del piso que sí los trae (misma caja)
            import __main__
            import modelo_piso
            __main__.ModeloPiso = modelo_piso.ModeloPiso
            ref = pickle.load(open(f"/tmp/modelo_{c['como']}.pkl", 'rb'))
            rx, ry = ref.origen
            pares += [affinity.translate(g, rx - ox, ry - oy) for g in muros_de_pares(ref, c['zona'], c['capas'])]
        if pares:
            anillo = unary_union(pares).difference(unary_union(m.columnas).buffer(0.001))
            m.muros += [g for g in _polis(anillo) if g.area > 0.005]
        print(piso, 'caja de escalera: pares', len(pares))
    huella = m.huella
    # 2. dinteles de los vanos de fachada
    m.dinteles_extra = dinteles_de_vanos(m)
    # 2b. envolvente: tramos del contorno sin cerramiento, según el plano (ventana, muro o vano con dintel)
    m.cierres_fachada = cerrar_fachada(m, piso, getattr(m, 'zona_recorte', None))
    # 3. rendijas: los huecos de menos de 12 cm entre muros, columnas, ventanas y puertas (5 cm entre el antepecho de
    #    una ventana y la columna, cortes del dibujo…) pasan a ser muro
    otros = unary_union(_macizos(m, con_muros=False) + m.dinteles_extra)
    todo = unary_union(list(m.muros) + [otros])
    cerrado = todo.buffer(0.06, join_style=2).buffer(-0.06, join_style=2)
    antes = sum(w.area for w in m.muros)
    # el relleno de cada rendija se suma a la pieza que toca, sin crear piezas nuevas (el modelo no debe pesar más):
    # al muro vecino si lo hay; si no, a la ventana (su antepecho, vidrio y dintel se alargan esos centímetros)
    from shapely.strtree import STRtree
    a_muros = STRtree(list(m.muros)) if m.muros else None
    a_vent = STRtree(list(m.ventanas)) if m.ventanas else None
    al_muro, n_vent = [], 0
    for q in _polis(cerrado.difference(todo)):
        if q.area < 1e-5:
            continue
        qb = q.buffer(0.003, join_style=2)
        if a_muros is not None and any(m.muros[int(i)].intersects(qb) for i in a_muros.query(qb)):
            al_muro.append(q)
            continue
        vs = [int(i) for i in a_vent.query(qb) if m.ventanas[int(i)].intersects(qb)] if a_vent is not None else []
        if vs:
            v = m.ventanas[vs[0]]
            r = v.minimum_rotated_rectangle
            if v.area > 0.97 * r.area:      # ventana rectangular: sigue siendo un rectángulo, más largo
                m.ventanas[vs[0]] = unary_union([v, q]).minimum_rotated_rectangle
                n_vent += 1
                continue
        if q.area > 0.001:
            al_muro.append(q)
    # (cierre de 4 mm: el relleno queda al ras del muro, sin escalones que solo suman vértices)
    # (cada pieza se valida antes de unir: con un muro inválido —un hueco suelto que deja el corte de una ventana
    # interior— la unión salía mal sin avisar y en el subsuelo se perdían 9 m² de muros alrededor de Medicina Nuclear)
    from shapely import make_valid
    validos = [q for g in list(m.muros) + al_muro for q in _polis(make_valid(g) if not g.is_valid else g)]
    # (el cierre se hace pieza por pieza y nunca deja una pieza más chica que antes: hecho sobre toda la unión, el
    # buffer negativo de GEOS perdía en el subsuelo 9 m² de muros —Oficina, Mantenimiento, Medicina Nuclear,
    # x 102-150, y 32-41— que sí estaban en datos.json y no salían en el 3D)
    cerr = []
    for g in _polis(unary_union(validos)):
        h = g.buffer(0.004, join_style=2).buffer(-0.004, join_style=2)
        cerr += _polis(h) if h.is_valid and h.area >= g.area - 1e-4 else [g]
    try:
        juntos = unary_union(cerr)
    except Exception:      # (GEOS: «unable to assign free hole to a shell»): las piezas ya son disjuntas
        juntos = MultiPolygon(cerr)
    m.muros = [g for g in _polis(juntos) if g.area > 0.005 or any(g.intersects(q) for q in al_muro)]
    print(piso, 'rendijas: a muros', len(al_muro), ', a ventanas', n_vent)
    # 4. losa: la huella más el pie de la fachada (la huella sale de los ambientes y se quedaba 5 a 10 cm adentro)
    # (buffer(0): con las ventanas interiores y los vanos de arco de la auditoría de nov 2026 algún muro del subsuelo
    # quedaba con un hueco suelto y la unión fallaba con «unable to assign free hole to a shell»)
    pie = unary_union([w.buffer(0) for w in m.muros] + [otros.buffer(0)]).intersection(huella.buffer(0.5, join_style=2))
    losa = unary_union([huella, pie]).buffer(0.03, join_style=2).buffer(-0.03, join_style=2).simplify(0.01)
    m.huella = unary_union([Polygon(q.exterior, [h for h in q.interiors if Polygon(h).area >= 2.0])
                            for q in _polis(losa)])
    print(piso, 'dinteles de vano', len(m.dinteles_extra), '; rendijas cerradas (m²)',
          round(sum(w.area for w in m.muros) - antes, 3), '; muros', len(m.muros))


def _orejas(pts):
    """Triangula un polígono simple sin huecos (anillo antihorario): índices de sus triángulos."""
    idx = list(range(len(pts)))
    tris = []

    def area2(a, b, c):
        return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
    guardia = 0
    while len(idx) > 3 and guardia < 10000:
        guardia += 1
        for k in range(len(idx)):
            i, j, l = idx[k - 1], idx[k], idx[(k + 1) % len(idx)]
            a, b, c = pts[i], pts[j], pts[l]
            if area2(a, b, c) <= 1e-12:
                continue
            if any(area2(a, b, pts[n]) >= 0 and area2(b, c, pts[n]) >= 0 and area2(c, a, pts[n]) >= 0
                   for n in idx if n not in (i, j, l)):
                continue
            tris.append((i, j, l))
            idx.pop(k)
            break
        else:
            break
    if len(idx) == 3:
        tris.append(tuple(idx))
    return tris


def prisma(pg, z0, z1, tapa=True):
    """Polígono sin huecos extruido de z0 a z1, en el marco del GLB (x, alto, -y): vértices y caras hacia afuera.
    tapa=False: sin la cara de arriba (queda contra otra pieza y no se ve)."""
    import numpy as np
    from shapely.geometry.polygon import orient
    pts = [tuple(p) for p in orient(Polygon(pg.exterior), 1.0).exterior.coords[:-1]]
    n = len(pts)
    V = [(x, z0, -y) for x, y in pts] + [(x, z1, -y) for x, y in pts]
    F = []
    for a, b, c in _orejas(pts):
        if tapa:
            F.append((n + a, n + b, n + c))     # tapa de arriba
        F.append((c, b, a))                 # tapa de abajo
    for i in range(n):
        j = (i + 1) % n
        F += [(i, j, n + j), (i, n + j, n + i)]
    return np.array(V, float), np.array(F, int)


def _sumar(esc, prefijo, prismas):
    """Agrega prismas a la malla de la escena cuyo nombre empieza por `prefijo` (misma malla, mismo material)."""
    import trimesh
    import numpy as np
    nombre = next((n for n in esc.geometry if n.startswith(prefijo)), None)
    if nombre is None or not prismas:
        return 0
    g = esc.geometry[nombre]
    V, F, base = [np.asarray(g.vertices)], [np.asarray(g.faces)], len(g.vertices)
    for v, f in prismas:
        V.append(v)
        F.append(f + base)
        base += len(v)
    nueva = trimesh.Trimesh(np.vstack(V), np.vstack(F), process=False)
    nueva.visual = trimesh.visual.TextureVisuals(material=g.visual.material)
    esc.geometry[nombre] = nueva
    return sum(len(f) for _, f in prismas)


def pergola_pb():
    """Pérgola de la entrada norte según el plano del piso 1: cubierta (el contorno cerrado mayor) y costillas (pares
    de líneas a 10 cm), en el marco de la planta baja."""
    # del modelo del piso 1 ya armado (sus líneas del DXF vienen en el marco de la planta baja)
    try:
        planos = pickle.load(open('/tmp/modelo_P1.pkl', 'rb')).planos
    except OSError:
        return None, []
    cerr, ls = [], []
    for e in planos:
        if e[0] != 'P0 - Pergola' or len(e[2]) < 2:
            continue
        pts = [(round(x / 1000.0, 3), round(y / 1000.0, 3)) for x, y in e[2]]
        l = LineString(pts)
        if not PERGOLA_PB.contains(l):
            continue
        if len(pts) >= 4 and e[3]:
            q = Polygon(pts).buffer(0)
            if q.area > 20:
                cerr.append(q)
        elif len(pts) == 2 and l.length > 1.0:
            ls.append(l)
    if not cerr:
        return None, []
    cubierta = max(cerr, key=lambda q: q.area)
    cubierta = max(_polis(cubierta), key=lambda q: q.area).simplify(0.02)
    costillas = []
    ls = sorted(set((min(l.coords[0], l.coords[-1]), max(l.coords[0], l.coords[-1])) for l in ls))
    ls = [LineString(s) for s in ls]
    for i, l1 in enumerate(ls):
        for l2 in ls[i + 1:]:
            if 0.05 <= l1.distance(l2) <= 0.15 and abs(l1.length - l2.length) < 0.3:
                costillas.append(MultiPoint(list(l1.coords) + list(l2.coords)).convex_hull)
    return cubierta, costillas


def cerrar_fachada_vieja(esc, m, zona):
    """Fachada de la planta baja vieja (solca_pb.glb, modelo fijo de antes del DWG 2025): los tramos de su contorno
    sin muro, ventana ni puerta (rayo de 1 m fuera a 0,5 m dentro, a 0,5 / 1,5 / 3,0 m de alto) se cierran con las
    piezas del modelo nuevo de la planta baja (`m`, sacado del DWG 2025) que caen en ese tramo: muros enteros y
    ventanas con antepecho, vidrio y dintel. Si el plano nuevo no trae nada ahí, el tramo queda abierto (acceso).
    `zona`: lo rehecho con el modelo nuevo (no se toca: ya va en solca_pb_este.glb). Marco de la web."""
    import numpy as np
    import shapely
    import trimesh
    from modelo import ALTURA, H_ANTEPECHO, H_DINTEL_VENTANA
    ox, oy = m.origen
    dv = json.load(open(os.path.join(AQUI, 'pb_vieja.json')))
    H = unary_union([Polygon(pg[0], pg[1:]).buffer(0) for pg in dv['huella'] if len(pg[0]) > 2])
    # contorno del edificio completo (modelo nuevo): solo es fachada lo que da a él (el borde de la vieja contra la
    # parte nueva es interior)
    completo = affinity.translate(EP.huella_real(m), ox, oy)
    try:
        d = json.load(open(os.path.join(RAIZ, 'public', 'pb', 'datos.json'), encoding='utf-8'))
        patios = [Polygon(h) for pg in d['huella'] for h in pg[1:] if Polygon(h).area >= 2.0]
    except (OSError, KeyError, ValueError):
        patios = []
    borde = unary_union([completo.boundary] + [p.exterior for p in patios])
    secc = {}
    for z in (0.5, 1.5, 3.0):
        segs = []
        for nombre, g in esc.geometry.items():
            if nombre.startswith('muros') and hasattr(g, 'faces') and len(g.faces):
                s = trimesh.intersections.mesh_plane(g, [0, 1, 0], [0, z, 0])
                if len(s):
                    segs.append(np.stack([s[:, :, 0], -s[:, :, 2]], axis=2))
        ls = shapely.linestrings(np.concatenate(segs)) if segs else []
        secc[z] = shapely.STRtree(ls) if len(ls) else None
    # lo que ya es macizo en el modelo viejo (la sección a 1,5 m cerrada en polígonos): las piezas nuevas no se
    # encima con él (caras coplanares parpadean)
    macizo_viejo = Polygon()
    if secc[1.5] is not None:
        caras = [g.buffer(0) for g in shapely.polygonize(list(secc[1.5].geometries)).geoms]
        try:
            macizo_viejo = unary_union([g for g in caras if not g.is_empty]).buffer(0)
        except Exception:      # (GEOS: conflicto de topología con secciones degeneradas)
            macizo_viejo = unary_union([g.buffer(0.001) for g in caras if not g.is_empty]).buffer(-0.001)
    muros_n = [affinity.translate(q, ox, oy) for q in m.muros] + [affinity.translate(q, ox, oy) for q in m.columnas]
    vent_n = [affinity.translate(q, ox, oy) for q in m.ventanas]
    nuevos_m, nuevos_v, abiertos, dinteles_v = [], [], [], []
    anillos = [q.exterior for q in _polis(H)] + [h for q in _polis(H) for h in q.interiors if Polygon(h).area >= 2]
    from shapely.geometry.polygon import orient
    for k, an in enumerate(anillos):
        r = orient(Polygon(an), 1.0 if k < len(_polis(H)) else -1.0).exterior
        L = r.length
        n = max(1, int(L / 0.5))
        libres = []
        for i in range(n):
            s = (i + 0.5) * L / n
            p = r.interpolate(s)
            a_, b_ = r.interpolate(max(0, s - 0.25)), r.interpolate(min(L, s + 0.25))
            dx, dy = b_.x - a_.x, b_.y - a_.y
            ln = math.hypot(dx, dy) or 1
            nx, ny = -dy / ln, dx / ln
            if borde.distance(p) > 0.8 or zona.buffer(0.5).contains(p):
                libres.append(None)
                continue
            rayo = LineString([(p.x - nx, p.y - ny), (p.x + nx * 0.5, p.y + ny * 0.5)])
            libre_z = {z for z in secc if secc[z] is None or not len(secc[z].query(rayo, predicate='intersects'))}
            # 'todo': abierto a la altura de una persona; 'arriba': solo falta el dintel sobre un vano con hoja
            libres.append(None if not libre_z else (p, 'arriba' if libre_z == {3.0} else 'todo'))
        # tramos de puntos libres seguidos (del mismo tipo)
        grupos, act = [], []
        for e in libres + [None]:
            if e is not None and (not act or act[-1][1] == e[1]):
                act.append(e)
                continue
            if act:
                grupos.append(act)
            act = [e] if e is not None else []
        for gr in grupos:
            if len(gr) < 2:
                continue
            t = LineString([(p.x, p.y) for p, _ in gr])
            if gr[0][1] == 'arriba':
                # vano con su hoja pero sin dintel: la franja de 20 cm sobre el contorno, de 2,4 m a la losa
                dinteles_v.append(t.buffer(0.1, cap_style=2))
                continue
            zt = t.buffer(0.7, cap_style=2)
            pm = [q.intersection(zt) for q in muros_n if q.intersects(zt)]
            pv = [q.intersection(zt) for q in vent_n if q.intersects(zt)]
            pm = [g for q in pm for g in _polis(q.difference(macizo_viejo.buffer(0.01))) if g.area > 0.01]
            pv = [g for q in pv for g in _polis(q.difference(macizo_viejo.buffer(0.01))) if g.area > 0.01]
            if pm or pv:
                nuevos_m += pm
                nuevos_v += pv
            else:
                abiertos.append(t)
    # muros del DWG 2025 que la planta vieja no trae (los mismos que se suman al 2D en unir_pb.MUROS_VIEJA)
    import unir_pb
    nuevos_m += [g for q in unir_pb.MUROS_VIEJA for g in _polis(q.difference(macizo_viejo.buffer(0.01)))
                 if g.area > 0.01]
    sim = lambda q: Polygon(q.exterior).simplify(0.005)  # noqa: E731
    n_t = _sumar(esc, 'muros|0.902', [prisma(sim(q), 0, ALTURA) for q in nuevos_m] +
                 [prisma(sim(q), 0, H_ANTEPECHO) for q in nuevos_v] +
                 [prisma(sim(q), H_DINTEL_VENTANA, ALTURA) for q in nuevos_v + dinteles_v])
    n_t += _sumar(esc, 'muros|0.303', [prisma(sim(q), H_ANTEPECHO, H_DINTEL_VENTANA) for q in nuevos_v])
    print('planta baja vieja: fachada cerrada con el modelo nuevo:', len(nuevos_m), 'muros,', len(nuevos_v),
          'ventanas,', len(dinteles_v), 'dinteles,', n_t, 'triángulos; tramos abiertos sin nada en el plano:',
          [(round(t.coords[0][0], 1), round(t.coords[0][1], 1), round(t.length, 1)) for t in abiertos])


def recortar_vieja(zona, m=None):
    """public/pb/solca_pb.glb = el 3D de la planta baja vieja (solca_pb_vieja.glb) sin las caras dentro de `zona`
    (marco de la web; en glTF el plano (x, y) es (x, -z)). Con el modelo nuevo de la planta baja (`m`) se corrigen
    además dos piezas de fachada del modelo viejo: el muro del descanso de las gradas de emergencia y la pérgola de
    la entrada norte."""
    import trimesh
    import numpy as np
    import shapely
    esc = trimesh.load(os.path.join(AQUI, 'solca_pb_vieja.glb'), force='scene')
    z = zona.buffer(0.02)
    for nombre, g in list(esc.geometry.items()):
        if not hasattr(g, 'faces') or not len(g.faces):
            continue
        c = g.triangles_center
        dentro = shapely.contains_xy(z, c[:, 0], -c[:, 2])
        if dentro.any():
            g.update_faces(~dentro)
            g.remove_unreferenced_vertices()
    if m is not None:
        from modelo import ALTURA
        ox, oy = m.origen
        # muro del descanso de las gradas de emergencia: del descanso (su losa) al remate del piso
        c = CAJA_ESCALERA_PB
        zc = affinity.translate(c['zona'], -ox, -oy)
        niveles = [zd - 0.15 for e in getattr(m, 'escaleras', []) for q, zd in e['descansos'] if q.intersects(zc)]
        z0 = min(niveles) if niveles else ALTURA / 2
        pares = [affinity.translate(q, ox, oy) for q in muros_de_pares(m, c['zona'], c['capas'])]
        muro = unary_union(pares).simplify(0.005) if pares else Polygon()
        n_m = _sumar(esc, 'muros|0.902', [prisma(q, z0, ALTURA, tapa=False) for q in _polis(muro)])
        # pérgola: fuera las losas sueltas del modelo viejo; cubierta de 10 cm y costillas de 20 cm debajo
        cubierta, costillas = pergola_pb()
        n_p = 0
        if cubierta is not None:
            # también sale la losa suelta sobre la salida de las gradas: era la proyección del descanso del piso 1,
            # que ahora cierra por debajo la propia losa del piso 1 (habría quedado doble)
            fuera = unary_union([PERGOLA_PB, DESCANSO_P1])
            for nombre, g in list(esc.geometry.items()):
                if nombre.startswith('viseras') and len(g.faces):
                    cc = g.triangles_center
                    dentro = shapely.contains_xy(fuera, cc[:, 0], -cc[:, 2])
                    if dentro.any():
                        n_p -= int(dentro.sum())
                        g.update_faces(~dentro)
                        g.remove_unreferenced_vertices()
            n_p += _sumar(esc, 'viseras', [prisma(cubierta, ALTURA - 0.10, ALTURA)] +
                          [prisma(q, ALTURA - 0.30, ALTURA - 0.10, tapa=False) for q in costillas])
        print('planta baja vieja: muro del descanso desde', round(z0, 2), 'm,', len(pares), 'tramos,', n_m,
              'triángulos; pérgola', 0 if cubierta is None else len(costillas), 'costillas,', n_p, 'triángulos')
        # envolvente: tramos de la fachada vieja sin cerramiento, con las piezas del DWG 2025
        cerrar_fachada_vieja(esc, m, zona)
    salida = os.path.join(RAIZ, 'public', 'pb', 'solca_pb.glb')
    esc.export(salida)
    print('GLB vieja recortada', salida, round(os.path.getsize(salida) / 1e6, 2), 'MB')


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    piso = args[0]
    salida = args[1] if len(args) > 1 else os.path.join(RAIZ, 'public', piso.lower(), f'solca_{piso.lower()}.glb')
    fuera = sys.argv[sys.argv.index('--fuera-de') + 1] if '--fuera-de' in sys.argv else None
    import __main__
    import modelo_piso
    __main__.ModeloPiso = modelo_piso.ModeloPiso
    m = pickle.load(open(f'/tmp/modelo_{piso}.pkl', 'rb'))
    ox, oy = m.origen
    # las mismas correcciones del plano que el 2D (muros, puertas, ventanas, mobiliario, escaleras, ambientes)
    EP.preparar(m, piso)
    # barandas (barra entre tramos de escalera y las del plano): parapeto de 1 m
    m.parapetos = list(getattr(m, 'parapetos', [])) + list(m.barandas)
    zona = EP.huella_real(m).buffer(0.6, join_style=2)
    if fuera:
        dv = json.load(open(fuera))
        vieja = unary_union([Polygon(pg[0], pg[1:]) for pg in dv['huella']]).buffer(0.3, join_style=2)
        if piso == 'PB':
            # zonas de la planta vieja rehechas con el DWG (unir_pb.REHACER): van en este modelo y se quitan del viejo
            import unir_pb
            rehechas = unir_pb.zonas_rehechas()
            vieja = vieja.difference(rehechas.buffer(0.05, join_style=2))
            recortar_vieja(rehechas, m)
        zona = zona.difference(affinity.translate(vieja, -ox, -oy))
    m.huella = EP.huella_real(m)
    recortar(m, zona)
    # (solo en la parte nueva de la planta baja: el borde del corte con la vieja no es fachada)
    m.zona_recorte = zona if fuera else None
    # cierres de fachada (caja de escalera, dinteles de vano, rendijas, losa)
    arreglar(m, piso)
    from a_ifc import escribir
    ifc = f'/tmp/solca_{piso.lower()}.ifc'
    escribir(m, ifc, web=True)
    import exportar_glb as EG
    EG.ENTRADA, EG.SALIDA = ifc, salida
    EG.main()
    # al marco de la planta baja: plano (x, y) -> glTF (x, z, -y)
    import trimesh
    esc = trimesh.load(salida, force='scene')
    esc.apply_translation([ox, 0.0, -oy])
    esc.export(salida)
    print('GLB', salida, round(os.path.getsize(salida) / 1e6, 2), 'MB; desplazado', round(ox, 3), round(oy, 3))


if __name__ == '__main__':
    main()

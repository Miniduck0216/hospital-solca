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
from shapely.geometry import Polygon, Point, LineString, MultiPoint, box  # noqa: E402
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
    return [g] if isinstance(g, Polygon) else [p for p in getattr(g, 'geoms', []) if isinstance(p, Polygon) and not p.is_empty]


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
    juntos = unary_union(list(m.muros) + al_muro).buffer(0.004, join_style=2).buffer(-0.004, join_style=2)
    m.muros = [g for g in _polis(juntos) if g.area > 0.005 or any(g.intersects(q) for q in al_muro)]
    print(piso, 'rendijas: a muros', len(al_muro), ', a ventanas', n_vent)
    # 4. losa: la huella más el pie de la fachada (la huella sale de los ambientes y se quedaba 5 a 10 cm adentro)
    pie = unary_union(list(m.muros) + [otros]).intersection(huella.buffer(0.5, join_style=2))
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

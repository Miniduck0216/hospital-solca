"""
Alrededores de una sede nueva (exterior.json) a partir de las calles de OpenStreetMap, para cuando el edificio del DXF no
cabe en la manzana real (Imbabura: 99 × 102 m en una manzana de 65 × 140 m). Las calles conservan su nombre y su
rumbo, pero las que encierran la manzana se abren hacia afuera lo justo para que el edificio quepa con su vereda; el
corrimiento se apaga a lo largo de la calle (`transicion`) y de lado (`alcance`), así que el resto del barrio queda
donde está. El mapa base (teselas de OpenFreeMap) no se puede cambiar: «tapa» cubre las calles de OSM que quedaron en
otro lugar y el mapa dibuja encima las calles, veredas y nombres de este archivo (2D y 3D).

config.json → exterior: { calles_osm: «calles_osm.json» (ll en lon/lat, nombre, clase), vereda: 3, margen: 25,
transicion: 90 (a lo largo de la calle), alcance: 50 (de lado: a esa distancia ya no se mueve nada), rumbo_calles: 9.5
(grados, de las calles norte-sur) }
Escribe <salida>/exterior.json: { calles, veredas, tapa, nombresCalles, parqueos: [], canchas: [], arboles: [] }.
Uso: SOLCA_SEDE=imbabura/principal python3 planta_real/pisos/exterior_sede.py
"""
import json
import math
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import sede  # noqa: E402
from shapely.geometry import LineString, Polygon  # noqa: E402
from shapely.ops import unary_union  # noqa: E402

ANCHO = {'primary': 13.0, 'secondary': 11.0, 'tertiary': 9.0, 'tertiary_link': 6.0, 'residential': 7.0,
         'service': 5.0, 'footway': 2.0}
MLAT = 110574.0


def main():
    if sede.ES_QUITO or not sede.CFG.get('exterior'):
        print('exterior_sede: la sede no configura exterior')
        return
    C = sede.CFG['exterior']
    vereda = float(C.get('vereda', 3.0))
    margen = float(C.get('margen', 25.0))
    transicion = float(C.get('transicion', 90.0))
    r = math.radians(float(C.get('rumbo_calles', 0.0)))
    V = (math.sin(r), math.cos(r))                # a lo largo de las calles «norte-sur»
    U = (math.cos(r), -math.sin(r))               # a lo largo de las calles «este-oeste»
    ref = next((p for p in sede.CFG['pisos'] if p['nivel'] == 0), sede.CFG['pisos'][0])
    d = json.load(open(os.path.join(sede.SALIDA, 'pisos', ref['clave'].lower(), 'datos.json'), encoding='utf-8'))
    G = d['geo']
    mlon = 111320 * math.cos(math.radians(G['lat0']))
    g = math.radians(G['ang'])

    def en_plano(x, y):
        dx, dy = x - G['cx'], y - G['cy']
        return (math.cos(g) * dx - math.sin(g) * dy + G['ox'], math.sin(g) * dx + math.cos(g) * dy + G['oy'])

    def en_ll(lo, la):
        return ((lo - G['lon0']) * mlon, (la - G['lat0']) * MLAT)

    def a_ll(e, n):
        return [round(G['lon0'] + e / mlon, 7), round(G['lat0'] + n / MLAT, 7)]

    def uv(p):
        return (p[0] * U[0] + p[1] * U[1], p[0] * V[0] + p[1] * V[1])

    hu = unary_union([Polygon([en_plano(*q) for q in pg[0]]).buffer(0) for pg in d['huella']])
    hu_uv = [uv(p) for q in getattr(hu, 'geoms', [hu]) for p in q.exterior.coords]
    umin, umax = min(p[0] for p in hu_uv), max(p[0] for p in hu_uv)
    vmin, vmax = min(p[1] for p in hu_uv), max(p[1] for p in hu_uv)
    uc, vc = (umin + umax) / 2, (vmin + vmax) / 2
    calles = json.load(open(os.path.join(os.path.dirname(sede.CFG_RUTA), C['calles_osm']), encoding='utf-8'))['calles']
    lineas = []
    for c in calles:
        pts = [en_ll(*q) for q in c['ll']]
        if len(pts) >= 2:
            lineas.append(dict(c, linea=LineString(pts), ancho=ANCHO.get(c['clase'], 7.0)))

    # calles que encierran al edificio: la más cercana de cada lado entre las que cruzan su franja
    def lado(eje):
        """eje 'u': calles norte-sur (u casi constante) a cada lado en u; 'v': calles este-oeste."""
        menos, mas = None, None
        for l in lineas:
            pu = [uv(p) for p in l['linea'].coords]
            if eje == 'u':
                cerca = [p[0] for p in pu if vmin - 20 <= p[1] <= vmax + 20]
                rango = max(p[1] for p in pu) - min(p[1] for p in pu)
                if not cerca or rango < 30 or (max(p[0] for p in pu) - min(p[0] for p in pu)) > rango:
                    continue
                pos, c0 = sum(cerca) / len(cerca), uc
            else:
                cerca = [p[1] for p in pu if umin - 20 <= p[0] <= umax + 20]
                rango = max(p[0] for p in pu) - min(p[0] for p in pu)
                if not cerca or rango < 30 or (max(p[1] for p in pu) - min(p[1] for p in pu)) > rango:
                    continue
                pos, c0 = sum(cerca) / len(cerca), vc
            if pos < c0 and (menos is None or pos > menos[0]):
                menos = (pos, l)
            if pos > c0 and (mas is None or pos < mas[0]):
                mas = (pos, l)
        return menos, mas

    (uO, lO), (uE, lE) = lado('u')
    (vS, lS), (vN, lN) = lado('v')
    DO = min(0.0, umin - vereda - lO['ancho'] / 2 - uO)
    DE = max(0.0, umax + vereda + lE['ancho'] / 2 - uE)
    DS = min(0.0, vmin - vereda - lS['ancho'] / 2 - vS)
    DN = max(0.0, vmax + vereda + lN['ancho'] / 2 - vN)
    print('manzana: oeste', lO['nombre'], round(DO, 1), 'm; este', lE['nombre'], round(DE, 1), 'm; sur', lS['nombre'],
          round(DS, 1), 'm; norte', lN['nombre'], round(DN, 1), 'm')

    def peso(x, a, b):
        if a - margen <= x <= b + margen:
            return 1.0
        fuera = (a - margen - x) if x < a - margen else (x - b - margen)
        return max(0.0, 1.0 - fuera / transicion)

    # cada calle de la manzana se corre entera lo que haga falta (con su transición a lo largo) y el corrimiento se
    # apaga a `alcance` metros a cada lado: las calles de las manzanas vecinas no se mueven y las transversales se
    # doblan solo cerca de la esquina (pendiente < 1: el dibujo no se pliega)
    alcance = float(C.get('alcance', 50.0))

    def bulto(x, x0):
        return max(0.0, 1.0 - abs(x - x0) / alcance)

    def mover(p):
        pu, pv = uv(p)
        wu, wv = peso(pv, vmin, vmax), peso(pu, umin, umax)
        du = (DO * bulto(pu, uO) + DE * bulto(pu, uE)) * wu
        dv = (DS * bulto(pv, vS) + DN * bulto(pv, vN)) * wv
        return (p[0] + du * U[0] + dv * V[0], p[1] + du * U[1] + dv * V[1]), math.hypot(du, dv)

    nuevas, tapa, nombres = [], [], []
    for l in lineas:
        L = l['linea']
        n = max(2, int(L.length / 4) + 1)
        pts, mov = [], 0.0
        for i in range(n):
            q, m = mover(L.interpolate(i / (n - 1), normalized=True).coords[0])
            pts.append(q)
            mov = max(mov, m)
        nl = LineString(pts)
        nuevas.append((nl, l))
        if mov > 0.3:
            # la calle de OSM quedó en otro lugar: se tapa en el mapa base
            tapa.append(L.buffer(l['ancho'] / 2 + vereda + 1.0, cap_style=2))
            if l['nombre']:
                nombres.append(dict(nombre=l['nombre'], ll=[a_ll(*q) for q in pts]))
    cuerpo = unary_union([nl.buffer(l['ancho'] / 2, cap_style=1, join_style=1) for nl, l in nuevas])
    acera = unary_union([nl.buffer(l['ancho'] / 2 + vereda, cap_style=1, join_style=1) for nl, l in nuevas])
    edif = hu.buffer(1.0, join_style=2)
    calles_pg = cuerpo.difference(edif)
    veredas_pg = acera.difference(cuerpo).difference(edif)
    tapa_pg = unary_union(tapa + [hu.buffer(vereda, join_style=2)])

    def anillos(geo, minimo=2.0):
        out = []
        geo = geo.simplify(0.15, preserve_topology=True)   # (los remates redondos traen muchos vértices)
        for q in getattr(geo, 'geoms', [geo]):
            if q.is_empty or q.area < minimo:
                continue
            out.append([[a_ll(*p) for p in q.exterior.coords]] + [[a_ll(*p) for p in h.coords] for h in q.interiors])
        return out
    # holgura real entre el edificio y el borde de las calles nuevas (debe ser >= vereda)
    holgura = hu.distance(cuerpo)
    print('holgura entre el edificio y la calzada:', round(holgura, 2), 'm (vereda', vereda, 'm)')
    out = dict(fuente='Calles de OpenStreetMap (ODbL) abiertas lo justo para que el edificio del DXF quepa con su vereda',
               calles=anillos(calles_pg), veredas=anillos(veredas_pg), tapa=anillos(tapa_pg), nombresCalles=nombres,
               parqueos=[], canchas=[], arboles=[])
    json.dump(out, open(os.path.join(sede.SALIDA, 'exterior.json'), 'w'), separators=(',', ':'))
    print('exterior:', len(out['calles']), 'calles,', len(out['veredas']), 'veredas,', len(out['tapa']), 'tapas,',
          len(nombres), 'nombres de calle')


if __name__ == '__main__':
    main()

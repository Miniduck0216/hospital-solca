"""
Datos de la planta baja real para la página web (mapa 2D y rutas): ambientes con nombre y categoría,
muros, ventanas, puertas, mobiliario, escaleras, viseras, entradas, rejilla de navegación y la
georreferencia del plano sobre el mapa de Quito.
Lee /tmp/modelo.pkl (lo deja `python3 planta_real/revit/generar.py --pickle`).
Uso: python3 planta_real/web/exportar_datos.py
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
from shapely.geometry import Polygon, Point, LineString, box, mapping
from shapely.ops import unary_union, polylabel
from shapely import affinity

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, '..', '..'))
sys.path.insert(0, os.path.join(RAIZ, 'planta_real', 'revit'))
from categorias import categoria  # noqa: E402
from modelo import lista_polis, min_ancho  # noqa: E402

SALIDA = os.path.join(RAIZ, 'public', 'pb', 'datos.json')

# ---------------------------------------------------------------- georreferencia
# El contorno del plano real cabe en la huella del hospital de OpenStreetMap («Hospital Oncológico de Solca»)
# girado -21° (el mismo ángulo de la retícula del edificio en el mapa): el 98 % de la planta queda dentro.
GEO = dict(lat0=-0.1366, lon0=-78.4689, cx=54.2705, cy=64.7898, ang=-21.0, ox=-9.826, oy=-2.195)
M_LAT = 110574.0
M_LON = 111320.0 * math.cos(math.radians(GEO['lat0']))


def a_lonlat(x, y):
    t = math.radians(GEO['ang'])
    dx, dy = x - GEO['cx'], y - GEO['cy']
    e = math.cos(t) * dx - math.sin(t) * dy + GEO['ox']
    n = math.sin(t) * dx + math.cos(t) * dy + GEO['oy']
    return [round(GEO['lon0'] + e / M_LON, 7), round(GEO['lat0'] + n / M_LAT, 7)]


def de_lonlat(lon, lat):
    e, n = (lon - GEO['lon0']) * M_LON - GEO['ox'], (lat - GEO['lat0']) * M_LAT - GEO['oy']
    t = math.radians(-GEO['ang'])
    return (math.cos(t) * e - math.sin(t) * n + GEO['cx'], math.sin(t) * e + math.cos(t) * n + GEO['cy'])


# ---------------------------------------------------------------- utilidades
def r2(v):
    return round(float(v), 2)


def anillo(c):
    return [[r2(x), r2(y)] for x, y in c]


def poli(pg, simp=0.03):
    out = []
    for q in lista_polis(pg.simplify(simp, preserve_topology=True)):
        if q.area < 0.002:
            continue
        out.append([anillo(q.exterior.coords)] + [anillo(h.coords) for h in q.interiors])
    return out


def categoria_web(nombre):
    n = (nombre or '').upper()
    c = categoria(nombre)
    if 'HALL' in n or 'PASILLO' in n:
        return 'circulacion'
    if 'DUCTO' in n:
        return 'apoyo'
    if 'RECREACION' in n:
        return 'espera'
    if 'ASCENSOR' in n:
        return 'ascensores'
    if 'ESCALERA' in n:
        return 'escaleras'
    return c


def icono(nombre):
    n = (nombre or '').upper()
    for clave, pat in (('bano', ('SS.HH', 'SANITARIO', 'MINUSVALIDOS', 'BATERIA SANITARIA')), ('ascensor', ('ASCENSOR',)),
                       ('escalera', ('ESCALERA',)), ('farmacia', ('FARMACIA',)), ('caja', ('CAJAS', 'TESORER')),
                       ('informacion', ('INFORMACI', 'RPIS', 'AGENDAMIENTO')), ('espera', ('ESPERA',)),
                       ('capilla', ('CAPILLA',)), ('laboratorio', ('LABORATORIO',)), ('consulta', ('CONSULT',)),
                       ('administracion', ('DIRECCI', 'SECRETAR', 'GESTI', 'COORDINACI'))):
        if any(p in n for p in pat):
            return clave
    if categoria(nombre) == 'consulta':
        return 'consulta'
    return None


def nombre_bonito(n):
    """MAYÚSCULAS del plano -> nombre legible: 'PEDIATRIA 04 - 34' -> 'Pediatría 04 · 34'."""
    if not n:
        return n
    acentos = {'PEDIATRIA': 'PEDIATRÍA', 'GINECOLOGIA': 'GINECOLOGÍA', 'COLPOSCOPIA': 'COLPOSCOPÍA',
               'UROLOGIA': 'UROLOGÍA', 'NEUMOLOGIA': 'NEUMOLOGÍA', 'ENDOCRINOLOGIA': 'ENDOCRINOLOGÍA',
               'TRAUMATOLOGIA': 'TRAUMATOLOGÍA', 'CIRUGIA': 'CIRUGÍA', 'GASTROENTEROLOGIA': 'GASTROENTEROLOGÍA',
               'DIETETICA': 'DIETÉTICA', 'LAPAROSCOPICA': 'LAPAROSCÓPICA', 'PREPARACION': 'PREPARACIÓN',
               'RECREACION': 'RECREACIÓN', 'TESORERIA': 'TESORERÍA', 'ATENCION': 'ATENCIÓN',
               'FARMACEUTICA': 'FARMACÉUTICA', 'ECONOMICAS': 'ECONÓMICAS', 'INFORMACION': 'INFORMACIÓN',
               'DIRECCION': 'DIRECCIÓN', 'GESTION': 'GESTIÓN', 'TELEFONOS': 'TELÉFONOS', 'BATERIA': 'BATERÍA',
               'MINUSVALIDOS': 'MINUSVÁLIDOS', 'CITOLOGIA': 'CITOLOGÍA', 'SECRETARIA': 'SECRETARÍA',
               'ENFERMERIA': 'ENFERMERÍA', 'NEUROCIRUGIA': 'NEUROCIRUGÍA', 'SECRETARIA-CONTROL': 'SECRETARÍA – CONTROL',
               'ABAST.': 'ABASTECIMIENTO', 'MODULO': 'MÓDULO', 'PASILLO': 'PASILLO'}
    pal = []
    for w in n.replace(' / ', ' | ').split(' '):
        w2 = acentos.get(w, w)
        if w2 in ('SS.HH.', 'SS.HH', 'U.U.', 'U.L.', 'RPIS', '|', '-'):
            pal.append({'|': '·', '-': '·'}.get(w2, w2))
        elif w2 in ('DE', 'Y', 'LA', 'EL', 'DEL', 'LOS', 'LAS') and pal:
            pal.append(w2.lower())
        else:
            pal.append(' '.join(x.capitalize() for x in w2.split(' ')) if not w2.isdigit() else w2)
    s = ' '.join(pal).replace('Ss.hh.', 'SS.HH.').replace('Ss.hh', 'SS.HH')
    return s[0].upper() + s[1:]


# ---------------------------------------------------------------- exportar
def exportar(m):
    hu = m.huella
    # ambientes
    amb = []
    for i, a in enumerate(sorted(m.ambientes, key=lambda a: -a['area'])):
        pg = a['poligono']
        try:
            lbl = polylabel(pg, tolerance=0.05)
        except Exception:
            lbl = pg.representative_point()
        amb.append(dict(id=f'a{i}', nombre=nombre_bonito(a['nombre']) if a['nombre'] else '',
                        original=a['nombre'] or '', cat=categoria_web(a['nombre']) if a['nombre'] else 'otro',
                        icono=icono(a['nombre']), area=r2(a['area']), pg=poli(pg, 0.04)[0] if poli(pg, 0.04) else [],
                        lbl=[r2(lbl.x), r2(lbl.y)]))
    duro = unary_union([m.muros_raw] + m.columnas + [t['poligono'] for t in m.tabiques] + list(getattr(m, 'parapetos', [])) +
                       list(getattr(m, 'foso', [])))
    vent = unary_union(m.ventanas + list(getattr(m, 'vidrios', [])) + list(getattr(m, 'ventanillas', [])))
    puertas = unary_union([p['rect'] for p in m.puertas])
    muros = duro.difference(vent.buffer(0.005)).difference(puertas.buffer(0.01))
    # trazos de bloques: barrido de puertas, sanitarios y sillas tal como están en el plano
    trazos_p, trazos_s = [], []
    for b in m.bloques:
        n = b['nombre']
        if 'COL' in n or n.startswith('FD') or n.startswith('Ventanilla'):
            continue
        es_p = n.startswith(('P-IZ', 'P-DE', '_U41', '_U42', '_U43', '_U44', '_U45', '-MP', 'P-DUC'))
        for g in b['geo']:
            pts = m.Lp(g[1])
            if len(pts) < 2:
                continue
            if g[2] and len(pts) >= 3:
                pts = pts + [pts[0]]
            ls = LineString(pts).simplify(0.01)
            if ls.length < 0.05:
                continue
            (trazos_p if es_p else trazos_s).append(anillo(ls.coords))
    muebles = []
    for mu in m.muebles:
        if mu['nombre'].startswith('Respaldo') or mu['nombre'] == 'Manija':
            continue
        for q in poli(mu['poligono'], 0.01):
            muebles.append(dict(t=mu['cat'] if mu['cat'] in ('sanitario', 'silla', 'camilla') else 'mueble', pg=q))
    gradas = [anillo(l.coords) for tr in m.tramos for l in tr]
    # entradas: puertas en el borde del edificio
    entradas = []
    textos = [(t, *m.L((x, y))) for c, t, x, y, h, ap in m.textos if t.strip().upper().startswith('PUERTA')]
    borde = hu.boundary
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
            entradas.append(dict(nombre=nom, x=r2(dentro[0]), y=r2(dentro[1]), fx=r2(fuera[0]), fy=r2(fuera[1]),
                                 ancho=r2(p['ancho'])))
    # quitar entradas repetidas (puertas dobles) y nombrar las que no tienen rótulo
    ent = []
    for e in sorted(entradas, key=lambda e: (e['nombre'] is None, -e['ancho'])):
        if all(math.dist((e['x'], e['y']), (o['x'], o['y'])) > 4 for o in ent):
            ent.append(e)
    k = 0
    for e in ent:
        if not e['nombre']:
            k += 1
            e['nombre'] = f'Acceso {k}'
    ent.sort(key=lambda e: e['nombre'])
    for i, e in enumerate(ent):
        e['id'] = 'entrada-' + e['nombre'].lower().replace(' ', '-')

    # ------------------------------------------------ rejilla de navegación (0,25 m)
    RES = 0.25
    x0, y0, x1, y1 = hu.bounds
    x0, y0 = math.floor(x0) - 2, math.floor(y0) - 2
    W, H = int((x1 - x0 + 4) / RES) + 1, int((y1 - y0 + 4) / RES) + 1

    def ras(geoms, dil=0.0):
        img = np.zeros((H, W), np.uint8)
        for g in geoms:
            for q in lista_polis(g.buffer(dil, join_style=2) if dil else g):
                cv2.fillPoly(img, [np.array([[(x - x0) / RES, (y - y0) / RES] for x, y in q.exterior.coords],
                                            np.int32)], 1)
                for h in q.interiors:
                    cv2.fillPoly(img, [np.array([[(x - x0) / RES, (y - y0) / RES] for x, y in h.coords], np.int32)], 0)
        return img > 0
    interior = ras([a['poligono'] for a in m.ambientes])
    obst = ras([duro, vent] + [mu['poligono'] for mu in m.muebles if mu['nombre'] not in ('Tope de puerta',)])
    libre = interior & ~ndimage.binary_dilation(obst, iterations=1)
    # puertas: siempre pasables (vano y 0,5 m a cada lado)
    vanos = []
    for p in m.puertas:
        a, b = np.array(p['a']), np.array(p['b'])
        d, n = p['dir'], p['nrm']
        q = Polygon([tuple(a + d * 0.12 - n * 0.6), tuple(b - d * 0.12 - n * 0.6), tuple(b - d * 0.12 + n * 0.6),
                     tuple(a + d * 0.12 + n * 0.6)])
        vanos.append(q)
    libre |= ras(vanos) & ~ras([unary_union(m.columnas)])
    # entradas: un tramo exterior para llegar desde la calle
    for e in ent:
        libre |= ras([LineString([(e['x'], e['y']), (e['fx'], e['fy'])]).buffer(0.6)])
    # quedarse con la componente conectada mayor
    et, n = ndimage.label(libre)
    if n > 1:
        tam = ndimage.sum(np.ones_like(et), et, index=np.arange(1, n + 1))
        libre = et == (1 + int(np.argmax(tam)))
    # costo extra junto a muros (las rutas van por el centro de los pasillos)
    dist = ndimage.distance_transform_edt(libre) * RES
    costo = np.clip(np.round((0.9 - np.minimum(dist, 0.9)) / 0.9 * 6), 0, 6).astype(np.uint8)   # 0 lejos, 6 junto al muro
    celdas = np.where(libre, costo + 1, 0).astype(np.uint8)   # 0 = bloqueado, 1..7 costo
    # destino de cada ambiente: la celda libre más interior
    for a, src in zip(amb, sorted(m.ambientes, key=lambda a: -a['area'])):
        pg = src['poligono']
        msk = ras([pg.buffer(-0.05)]) & libre
        if not msk.any():
            msk = ras([pg.buffer(0.6)]) & libre
        if msk.any():
            d2 = np.where(msk, dist, -1)
            # cerca del rótulo pero en una celda despejada
            fy, fx = np.indices(d2.shape)
            lx, ly = (a['lbl'][0] - x0) / RES, (a['lbl'][1] - y0) / RES
            score = np.where(msk, np.minimum(dist, 0.8) * 4 - np.hypot(fx - lx, fy - ly) * RES * 0.15, -1e9)
            iy, ix = np.unravel_index(np.argmax(score), score.shape)
            a['dest'] = [r2(x0 + ix * RES), r2(y0 + iy * RES)]
        else:
            a['dest'] = None
    # ambiente de cada celda (índice + 1 en la lista de ambientes): las rutas evitan cruzar cuartos ajenos
    cuarto = np.zeros((H, W), np.uint8)
    ordenados = sorted(m.ambientes, key=lambda a: -a['area'])
    for k in sorted(range(len(ordenados)), key=lambda k: -ordenados[k]['area']):
        msk = ras([ordenados[k]['poligono'].buffer(0.15)])
        cuarto[msk] = k + 1
    # red de pasillos para pacientes: las líneas verdes trazadas sobre el PDF del plano (rutas/verde.png),
    # llevadas a la rejilla con la calibración de rutas/calibracion.json (ver ajuste ECC en rutas/README.md)
    RUTAS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'rutas')
    cal = json.load(open(os.path.join(RUTAS, 'calibracion.json')))
    verde = cv2.imread(os.path.join(RUTAS, 'verde.png'), cv2.IMREAD_GRAYSCALE) > 0
    rad = int(round(0.3 * cal['sx']))
    verde = cv2.dilate(verde.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * rad + 1, 2 * rad + 1))) > 0
    Wm = np.array(cal['W'] + [[0.0, 0.0, 1.0]])
    gx, gy = np.meshgrid(x0 + np.arange(W) * RES, y0 + np.arange(H) * RES)
    tx = (cal['ax'] + gx * cal['sx']) / cal['F']
    ty = (cal['by'] - gy * cal['sy']) / cal['F']
    rx = Wm[0, 0] * tx + Wm[0, 1] * ty + Wm[0, 2]
    ry = Wm[1, 0] * tx + Wm[1, 1] * ty + Wm[1, 2]
    px = np.clip(np.round(rx * cal['F']).astype(int), 0, verde.shape[1] - 1)
    py = np.clip(np.round(ry * cal['F']).astype(int), 0, verde.shape[0] - 1)
    red = (verde[py, px] & (celdas > 0)).astype(np.uint8)
    print('red de pacientes:', int(red.sum()), 'celdas')
    nav = dict(x0=x0, y0=y0, res=RES, w=W, h=H, celdas=base64.b64encode(celdas.tobytes()).decode(),
               cuarto=base64.b64encode(cuarto.tobytes()).decode(), red=base64.b64encode(red.tobytes()).decode())

    # ------------------------------------------------ exterior: parqueaderos (OpenStreetMap / prototipo)
    parqueos = [
        dict(nombre='Parqueadero norte', ll=[[-78.46886, -0.135792], [-78.468206, -0.13554], [-78.467826, -0.136223],
                                              [-78.468406, -0.136412]]),
        dict(nombre='Parqueadero oeste', ll=[[-78.469795, -0.136401], [-78.469602, -0.136345], [-78.469473, -0.137074],
                                              [-78.469675, -0.137048]]),
    ]
    aisle = [[-78.466925, -0.139062], [-78.466995, -0.139056], [-78.467016, -0.139035], [-78.467183, -0.138128],
             [-78.467284, -0.137672], [-78.467279, -0.137624], [-78.467242, -0.137592], [-78.467209, -0.137581],
             [-78.467172, -0.137581], [-78.467129, -0.137603], [-78.467102, -0.137645], [-78.466845, -0.138928],
             [-78.466839, -0.138987], [-78.466861, -0.13904]]
    loc = [de_lonlat(*p) for p in aisle]
    pz = LineString(loc).buffer(7, join_style=2).simplify(0.5)
    parqueos.append(dict(nombre='Parqueadero sur', ll=[a_lonlat(x, y) for x, y in pz.exterior.coords]))

    datos = dict(
        nombre='Hospital SOLCA Quito · Planta baja',
        fuente='Plano arquitectónico de la planta baja (planos_entrada.dwg)',
        geo=GEO, altura=3.84,
        huella=poli(hu, 0.05),
        ambientes=amb,
        muros=poli(muros, 0.015),
        ventanas=poli(vent, 0.015),
        puertas=[dict(a=[r2(v) for v in p['a']], b=[r2(v) for v in p['b']]) for p in m.puertas],
        trazos_puertas=trazos_p, trazos=trazos_s,
        muebles=muebles, gradas=gradas,
        viseras=[poli(v, 0.05)[0] for v in getattr(m, 'viseras', []) if poli(v, 0.05)],
        entradas=ent, nav=nav, parqueos=parqueos,
        poi=[dict(nombre='Parqueadero', ll=[-78.46697, -0.13869]), dict(nombre='Parqueadero', ll=[-78.46846, -0.13785])],
    )
    os.makedirs(os.path.dirname(SALIDA), exist_ok=True)
    with open(SALIDA, 'w') as f:
        json.dump(datos, f, ensure_ascii=False, separators=(',', ':'))
    print('datos', SALIDA, round(os.path.getsize(SALIDA) / 1e6, 2), 'MB', len(amb), 'ambientes', len(ent), 'entradas',
          'rejilla', W, 'x', H, 'libres', int((celdas > 0).sum()))
    for e in ent:
        print('  ', e['nombre'], e['x'], e['y'], a_lonlat(e['x'], e['y']))
    return datos


if __name__ == '__main__':
    m = pickle.load(open(sys.argv[1] if len(sys.argv) > 1 else '/tmp/modelo.pkl', 'rb'))
    exportar(m)

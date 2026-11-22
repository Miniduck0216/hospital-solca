"""
Fuente de los pisos: el DXF del edificio completo (Planos_actualizados_HOSPITAL_SOLCA_QUITO_2025, exportado del
DWG). Trae todos los pisos apilados en el mismo dibujo (unidades: metros), con las mismas capas y bloques que
el plano de la planta baja que ya usa la web (PA, VE, PU, MU, GR, COL, NO, TA, -COL40-, P-DE, P-IZ, -MP…).

Cada piso se recorta por su caja y se lleva al marco de la planta baja actual (public/sedes/quito/principal/pisos/pb/datos.json):
    local = dxf + T_PB + DESPLAZA[piso]
T_PB se obtuvo alineando las 131 columnas de la planta baja vieja con las de este DXF (residuo 1,6 mm);
DESPLAZA[piso], alineando las columnas de cada piso con las de la planta baja (la estructura es la misma).

Devuelve lo mismo que revit/leer_dxf.cargar(): planos, bloques y textos, en MILÍMETROS del marco local, para
reusar revit/modelo.py y revit/muros.py sin cambios.
Uso: python3 planta_real/pisos/fuente.py   (crea la caché planta_real/pisos/cache/<piso>.pkl.gz)

Otras sedes (SOLCA_SEDE=<sede>/<edificio>, ver sede.py): el DXF, las cajas, el traslado y qué capas son muros, ventanas,
columnas, tabiques, mobiliario y gradas salen de planta_real/sedes/<sede>/<edificio>/config.json. Las capas del DXF se
renombran a las de Quito (PA, VE, COL, TA, NO, MU, GR) para que modelo_piso.py las trate igual; los bloques de puerta
pasan a llamarse P-IZ… (una hoja) o -MP… (dos hojas), y todo bloque que no sea puerta, columna o mueble conservado se
explota (en los DXF de ArchiCAD los muros, puertas y ventanas vienen dentro de bloques Muro_N).
"""
import gzip
import math
import os
import pickle
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import sede  # noqa: E402
DXF = os.path.join(AQUI, '..', 'planos', 'solca-edificio-2025.dxf') if sede.ES_QUITO else sede.CFG['dxf']
CACHE = sede.CACHE

T_PB = (-49.49437, -50.29552)
# caja de cada piso en el DXF (metros) y desplazamiento de sus columnas sobre las de la planta baja
CAJAS = {
    'SB': (20, -260, 250, -5),
    'PB': (20, 10, 250, 200),   # hasta y = 10: la fila sur del bloque de bodegas (Reparaciones… Compras)
    'P1': (20, 240, 250, 430),
    'P2': (20, 450, 250, 640),
    'P3': (20, 660, 250, 850),
}
DESPLAZA = {'PB': (0.0, 0.0)}
CAPAS_RELLENO = {'P0 - Paredes', 'PA'}   # se completa con calibrar() y se guarda en cache/desplaza.json


def _puntos(e):
    t = e.dxftype()
    if t == 'LINE':
        return [(e.dxf.start.x, e.dxf.start.y), (e.dxf.end.x, e.dxf.end.y)], False
    if t == 'LWPOLYLINE':
        try:
            pts = [(v.x, v.y) for v in e.vertices_in_wcs()]
        except Exception:
            return None, False
        return pts, bool(e.closed)
    if t == 'POLYLINE':
        try:
            pts = [(v.dxf.location.x, v.dxf.location.y) for v in e.vertices]
        except Exception:
            return None, False
        return pts, bool(e.is_closed)
    if t in ('ARC', 'CIRCLE'):
        c, r = e.dxf.center, e.dxf.radius
        if t == 'CIRCLE':
            a0, a1 = 0.0, 360.0
        else:
            a0, a1 = e.dxf.start_angle, e.dxf.end_angle
            if a1 <= a0:
                a1 += 360.0
        n = max(4, int((a1 - a0) / 15))
        ocs = e.ocs()
        loc = [(c.x + r * math.cos(math.radians(a0 + (a1 - a0) * i / n)),
                c.y + r * math.sin(math.radians(a0 + (a1 - a0) * i / n)), c.z) for i in range(n + 1)]
        return [(v.x, v.y) for v in ocs.points_to_wcs(loc)], t == 'CIRCLE'
    return None, False


def _simples(e):
    """Una polilínea con tramos curvos se separa en líneas y arcos (las puertas vienen así: hoja + arco)."""
    if e.dxftype() == 'LWPOLYLINE':
        try:
            if e.has_arc:
                return list(e.virtual_entities())
        except Exception:
            pass
    return [e]


def leer_todo():
    import ezdxf
    doc = ezdxf.readfile(DXF)
    return doc, list(doc.modelspace())


def extraer(ents, caja, desplaza):
    """Entidades del modelo dentro de `caja`, en mm del marco local."""
    x0, y0, x1, y1 = caja
    dx, dy = T_PB[0] + desplaza[0], T_PB[1] + desplaza[1]

    def mm(p):
        return ((p[0] + dx) * 1000.0, (p[1] + dy) * 1000.0)

    def dentro(pts):
        return any(x0 <= x <= x1 and y0 <= y <= y1 for x, y in pts)

    planos, bloques, textos = [], [], []
    for e in ents:
        t = e.dxftype()
        if t == 'INSERT':
            p = e.dxf.insert
            if not (x0 <= p.x <= x1 and y0 <= p.y <= y1):
                continue
            geo = []
            try:
                for v in (x for ve in e.virtual_entities() for x in _simples(ve)):
                    if v.dxftype() == 'INSERT':
                        try:
                            for w in (x for ve in v.virtual_entities() for x in _simples(ve)):
                                q, c = _puntos(w)
                                if q:
                                    geo.append((w.dxf.layer, [mm(a) for a in q], c, w.dxftype()))
                        except Exception:
                            pass
                        continue
                    q, c = _puntos(v)
                    if q:
                        geo.append((v.dxf.layer, [mm(a) for a in q], c, v.dxftype()))
                    elif v.dxftype() in ('TEXT', 'MTEXT', 'ATTRIB'):
                        txt = v.plain_text() if v.dxftype() == 'MTEXT' else v.dxf.text
                        ip = v.dxf.insert
                        textos.append((v.dxf.layer, txt, *mm((ip.x, ip.y)), v.dxf.get('char_height', v.dxf.get('height', 0.2)) * 1000,
                                       v.dxf.get('attachment_point', 1)))
            except Exception:
                pass
            bx, by = mm((p.x, p.y))
            nombre = e.dxf.name
            if nombre.startswith('*U') and e.dxf.layer in ('P0 - Puertas', 'PU'):
                # puertas de las alas nuevas: bloques anónimos; se nombran como las del plano (P-IZ / -MP doble)
                arcos = sum(1 for g in geo if g[3] == 'ARC')
                if arcos:
                    nombre = ('-MP' if arcos >= 2 else 'P-IZ') + nombre[1:]
            bloques.append(dict(nombre=nombre, x=bx, y=by, rot=e.dxf.get('rotation', 0.0),
                                sx=e.dxf.get('xscale', 1.0), sy=e.dxf.get('yscale', 1.0), capa=e.dxf.layer, geo=geo))
        elif t in ('MTEXT', 'TEXT'):
            ip = e.dxf.insert
            if not (x0 <= ip.x <= x1 and y0 <= ip.y <= y1):
                continue
            if t == 'MTEXT':
                textos.append((e.dxf.layer, e.plain_text(), *mm((ip.x, ip.y)), e.dxf.char_height * 1000,
                               e.dxf.get('attachment_point', 1)))
            else:
                textos.append((e.dxf.layer, e.dxf.text, *mm((ip.x, ip.y)), e.dxf.get('height', 0.2) * 1000, 1))
        elif t == 'HATCH' and e.dxf.layer in CAPAS_RELLENO:
            # muros rellenos (las alas dibujadas con capas «P0 - …»): el contorno del relleno es el muro
            try:
                from ezdxf import path as epath
                for pa in epath.from_hatch(e):
                    q = [(v.x, v.y) for v in pa.flattening(0.02)]
                    if len(q) >= 3 and dentro(q):
                        planos.append((e.dxf.layer, 'LWPOLYLINE', [mm(a) for a in q] + [mm(q[0])], True))
            except Exception:
                pass
        elif t in ('HATCH', 'IMAGE', 'DIMENSION', 'MULTILEADER', 'SOLID', 'POINT'):
            continue
        else:
            for s_ in _simples(e):
                q, c = _puntos(s_)
                if q and dentro(q):
                    planos.append((s_.dxf.layer, s_.dxftype(), [mm(a) for a in q], c))
    return planos, bloques, textos


def calibrar(ents):
    """Desplazamiento de cada piso: el que hace coincidir sus columnas con las de la planta baja."""
    import collections
    import numpy as np
    from scipy.spatial import cKDTree
    cols = np.array([(e.dxf.insert.x, e.dxf.insert.y) for e in ents
                     if e.dxftype() == 'INSERT' and 'COL' in e.dxf.name and -50 < e.dxf.insert.x < 300])

    def de(caja):
        x0, y0, x1, y1 = caja
        return cols[(cols[:, 0] > x0) & (cols[:, 0] < x1) & (cols[:, 1] > y0) & (cols[:, 1] < y1)]
    pb = de(CAJAS['PB'])
    arbol = cKDTree(pb)
    out = {'PB': (0.0, 0.0)}
    for piso, caja in CAJAS.items():
        if piso == 'PB':
            continue
        f = de(caja)
        votos = collections.Counter()
        for p in f:
            for q in pb:
                votos[(round(q[0] - p[0], 1), round(q[1] - p[1], 1))] += 1
        t = np.array(votos.most_common(1)[0][0], float)
        for _ in range(4):
            d, i = arbol.query(f + t)
            m = d < 0.3
            t = t + np.mean(pb[i[m]] - (f[m] + t), 0)
        out[piso] = (round(float(t[0]), 4), round(float(t[1]), 4))
        print(piso, 'columnas', len(f), 'coinciden', int(m.sum()), 'desplaza', out[piso])
    return out


# ------------------------------------------------------------------ otras sedes (config.json)
def _re(lista):
    import re
    if not lista:
        return None
    return re.compile('|'.join(f'(?:{x})' for x in ([lista] if isinstance(lista, str) else lista)), re.I)


def _circulo(a, b, c):
    ax, ay = a
    bx, by = b
    cx, cy = c
    d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by))
    if abs(d) < 1e-12:
        return None
    ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d
    uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d
    return ux, uy


def _es_arco(pts_mm):
    """Polilínea que dibuja un arco de puerta (ArchiCAD exporta el barrido como tramos rectos): 4 o más puntos sobre una
    circunferencia de 0,4 a 1,6 m de radio que abarca entre 40° y 181°."""
    if len(pts_mm) < 4:
        return False
    a, b, c = pts_mm[0], pts_mm[len(pts_mm) // 2], pts_mm[-1]
    o = _circulo(a, b, c)
    if o is None:
        return False
    r = math.dist(o, a)
    if not (400 <= r <= 1600):
        return False
    if any(abs(math.dist(o, p) - r) > 0.04 * r for p in pts_mm):
        return False
    cos = ((a[0] - o[0]) * (c[0] - o[0]) + (a[1] - o[1]) * (c[1] - o[1])) / r / r
    ang = math.degrees(math.acos(max(-1.0, min(1.0, cos))))
    return 40 <= ang <= 181


def _puntos_sede(e):
    q, c = _puntos(e)
    if q is None and e.dxftype() in ('ELLIPSE', 'SPLINE'):
        try:
            from ezdxf import path as epath
            q = [(v.x, v.y) for v in epath.make_path(e).flattening(0.02 / sede.CFG['unidad'])]
            c = False
        except Exception:
            return None, False
    return q, c


def extraer_sede(ents, caja, desplaza):
    """Como extraer(), con las reglas de config.json: capas renombradas, bloques explotados, puertas y columnas."""
    C = sede.CFG
    u = C['unidad']
    tx, ty = C['traslado']
    x0, y0, x1, y1 = caja
    dx, dy = tx + desplaza[0], ty + desplaza[1]
    capas = [(k, _re(v)) for k, v in C['capas'].items()]
    rellenos = _re(C.get('rellenos'))
    textos_re = _re(C.get('textos'))
    textos_no = _re(C.get('textos_excluir'))
    p_simple = _re(C.get('puertas', {}).get('simple'))
    p_doble = _re(C.get('puertas', {}).get('doble'))
    columnas = _re(C.get('columnas'))
    conservar = _re(C.get('conservar'))
    ignorar = _re(C.get('ignorar_bloques'))
    renombrar = [(_re(pat), pref) for pat, pref in C.get('renombrar_bloques', [])]
    ign = _re(C.get('textos_ignorar'))
    reemplazos = [(_re(pat), nuevo) for pat, nuevo in C.get('textos_reemplazar', [])]
    cache_capa = {}

    def canon(capa):
        if capa not in cache_capa:
            cache_capa[capa] = next((k for k, r in capas if r and r.search(capa)), None)
        return cache_capa[capa]

    def mm(p):
        return ((p[0] * u + dx) * 1000.0, (p[1] * u + dy) * 1000.0)

    def dentro(pts):
        return any(x0 <= x <= x1 and y0 <= y <= y1 for x, y in pts)

    planos, bloques, textos = [], [], []

    def capa_de(e, heredada):
        c = e.dxf.layer
        return heredada if (c == '0' and heredada) else c

    def geo_bloque(e, heredada, nivel=0):
        geo = []
        try:
            subs = list(e.virtual_entities())
        except Exception:
            return geo
        for v in subs:
            capa = capa_de(v, heredada)
            if v.dxftype() == 'INSERT':
                if nivel < 4:
                    geo += geo_bloque(v, capa, nivel + 1)
                continue
            if v.dxftype() in ('TEXT', 'MTEXT', 'ATTRIB', 'ATTDEF', 'HATCH', 'WIPEOUT', 'DIMENSION'):
                continue
            for w in _simples(v):
                q, c = _puntos_sede(w)
                if q:
                    pm = [mm(a) for a in q]
                    t = w.dxftype()
                    if t != 'ARC' and not c and _es_arco(pm):
                        t = 'ARC'
                    geo.append((canon(capa) or capa, pm, c, t))
        return geo

    def texto(e, capa):
        if not textos_re or not textos_re.search(capa) or (textos_no and textos_no.search(capa)):
            return
        t = e.dxftype()
        ip = e.dxf.insert
        if not (x0 <= ip.x <= x1 and y0 <= ip.y <= y1):
            return
        txt = e.plain_text() if t == 'MTEXT' else e.dxf.text
        for pat, nuevo in reemplazos:
            txt = pat.sub(nuevo, txt)
        txt = txt.strip()
        if not txt or (ign and ign.search(txt)):
            return
        if t == 'MTEXT':
            textos.append((capa, txt, *mm((ip.x, ip.y)), e.dxf.char_height * u * 1000,
                           e.dxf.get('attachment_point', 1)))
        else:
            textos.append((capa, txt, *mm((ip.x, ip.y)), e.dxf.get('height', 0.2) * u * 1000, 1))

    def recorrer(e, heredada=None, nivel=0):
        t = e.dxftype()
        capa = capa_de(e, heredada)
        if t == 'INSERT':
            n = e.dxf.name
            if ignorar and ignorar.search(n):
                return
            es_doble = bool(p_doble and p_doble.search(n))
            es_puerta = es_doble or bool(p_simple and p_simple.search(n))
            es_col = bool(columnas and columnas.search(n))
            if es_puerta or es_col or (conservar and conservar.search(n)):
                p = e.dxf.insert
                if not (x0 <= p.x <= x1 and y0 <= p.y <= y1):
                    return
                geo = geo_bloque(e, capa)
                if es_puerta:
                    arcos = sum(1 for g in geo if g[3] == 'ARC')
                    if not arcos:
                        return
                    nombre = ('-MP ' if (es_doble or arcos >= 2) else 'P-IZ ') + n
                elif es_col:
                    nombre = 'COL ' + n
                else:
                    # muebles: el nombre de Quito que modelo.py reconoce (INOD, AS-03...) va delante del original
                    nombre = next((f'{pref} {n}' for pat, pref in renombrar if pat.search(n)), n)
                bx, by = mm((p.x, p.y))
                bloques.append(dict(nombre=nombre, x=bx, y=by, rot=e.dxf.get('rotation', 0.0),
                                    sx=e.dxf.get('xscale', 1.0), sy=e.dxf.get('yscale', 1.0),
                                    capa=canon(capa) or capa, geo=geo))
                return
            if nivel >= 5:
                return
            try:
                subs = list(e.virtual_entities())
            except Exception:
                return
            for v in subs:
                recorrer(v, capa, nivel + 1)
            return
        if t in ('MTEXT', 'TEXT'):
            texto(e, capa)
            return
        if t == 'HATCH':
            if rellenos and rellenos.search(capa):
                try:
                    from ezdxf import path as epath
                    for pa in epath.from_hatch(e):
                        q = [(v.x, v.y) for v in pa.flattening(0.01 / u)]
                        if len(q) >= 3 and dentro(q):
                            planos.append(('PA', 'LWPOLYLINE', [mm(a) for a in q] + [mm(q[0])], True))
                except Exception:
                    pass
            return
        if t in ('IMAGE', 'DIMENSION', 'MULTILEADER', 'LEADER', 'SOLID', 'POINT', 'WIPEOUT', 'ATTRIB', 'ATTDEF'):
            return
        k = canon(capa)
        if not k:
            return
        for s_ in _simples(e):
            q, c = _puntos_sede(s_)
            if q and dentro(q):
                planos.append((k, s_.dxftype(), [mm(a) for a in q], c))

    for e in ents:
        recorrer(e)
    return planos, bloques, textos


def columnas_de(r):
    """Centros (m) de las columnas de un piso extraído: rectángulos chicos de la capa COL y bloques de columna."""
    from shapely.geometry import Polygon
    out = []
    for c, t, p, cerrada in r[0]:
        if c == 'COL' and len(p) >= 4:
            try:
                pg = Polygon([(x / 1000, y / 1000) for x, y in p]).buffer(0)
            except Exception:
                continue
            if 0.04 < pg.area < 1.5:
                out.append((pg.centroid.x, pg.centroid.y))
    for b in r[1]:
        if b['nombre'].startswith('COL'):
            out.append((b['x'] / 1000, b['y'] / 1000))
    return sorted(set((round(x, 2), round(y, 2)) for x, y in out))


def calibrar_sede(extraidos):
    """Desplazamiento de cada piso sobre el de referencia (nivel 0) haciendo coincidir sus columnas, como calibrar().
    Solo para los pisos con «calibrar»: true en config.json."""
    import collections
    import numpy as np
    from scipy.spatial import cKDTree
    ref = next((p['clave'] for p in sede.CFG['pisos'] if p['nivel'] == 0), sede.PISOS[0])
    base = np.array(columnas_de(extraidos[ref]))
    out = {}
    if len(base) < 4:
        return out
    arbol = cKDTree(base)
    for p in sede.CFG['pisos']:
        if p['clave'] == ref or not p.get('calibrar') or p['clave'] not in extraidos:
            continue
        f = np.array(columnas_de(extraidos[p['clave']]))
        if len(f) < 4:
            print(p['clave'], 'sin columnas para calibrar')
            continue
        votos = collections.Counter()
        for a in f:
            for b in base:
                votos[(round(b[0] - a[0], 1), round(b[1] - a[1], 1))] += 1
        t = np.array(votos.most_common(1)[0][0], float)
        m = None
        for _ in range(4):
            d, i = arbol.query(f + t)
            m = d < 0.3
            if not m.any():
                break
            t = t + np.mean(base[i[m]] - (f[m] + t), 0)
        out[p['clave']] = (round(float(t[0]), 4), round(float(t[1]), 4))
        print(p['clave'], 'columnas', len(f), 'coinciden', int(m.sum()), 'desplaza (m)', out[p['clave']])
    return out


def mover(r, dx, dy):
    """Traslada (metros) lo extraído de un piso."""
    k = 1000.0

    def pm(q):
        return [(x + dx * k, y + dy * k) for x, y in q]
    planos = [(c, t, pm(p), cerr) for c, t, p, cerr in r[0]]
    bloques = [dict(b, x=b['x'] + dx * k, y=b['y'] + dy * k, geo=[(g[0], pm(g[1]), g[2], g[3]) for g in b['geo']])
               for b in r[1]]
    textos = [(t[0], t[1], t[2] + dx * k, t[3] + dy * k, *t[4:]) for t in r[2]]
    return planos, bloques, textos


def principal_sede(pedidos):
    import json
    doc, ents = leer_todo()
    extraidos = {}
    for p in sede.CFG['pisos']:
        if p['clave'] not in pedidos and not (p['nivel'] == 0 or p.get('calibrar')):
            continue
        extraidos[p['clave']] = extraer_sede(ents, p['caja'], p.get('desplaza', [0, 0]))
    des = calibrar_sede(extraidos)
    json.dump(des, open(os.path.join(CACHE, 'desplaza.json'), 'w'), indent=1)
    for piso in pedidos:
        r = extraidos[piso]
        if piso in des:
            r = mover(r, *des[piso])
        with gzip.open(os.path.join(CACHE, f'{piso}.pkl.gz'), 'wb') as f:
            pickle.dump(r, f)
        print(piso, 'planos', len(r[0]), 'bloques', len(r[1]), 'textos', len(r[2]),
              'puertas', sum(1 for b in r[1] if b['nombre'].startswith(('P-IZ', '-MP'))))


def cargar(piso):
    with gzip.open(os.path.join(CACHE, f'{piso}.pkl.gz'), 'rb') as f:
        return pickle.load(f)


if __name__ == '__main__' and not sede.ES_QUITO:
    principal_sede(sys.argv[1:] or sede.PISOS)
elif __name__ == '__main__':
    import json
    os.makedirs(CACHE, exist_ok=True)
    doc, ents = leer_todo()
    des = calibrar(ents)
    json.dump(des, open(os.path.join(CACHE, 'desplaza.json'), 'w'), indent=1)
    for piso in (sys.argv[1:] or CAJAS):
        r = extraer(ents, CAJAS[piso], des[piso])
        with gzip.open(os.path.join(CACHE, f'{piso}.pkl.gz'), 'wb') as f:
            pickle.dump(r, f)
        print(piso, 'planos', len(r[0]), 'bloques', len(r[1]), 'textos', len(r[2]))

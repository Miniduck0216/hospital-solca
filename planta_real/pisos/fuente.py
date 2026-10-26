"""
Fuente de los pisos: el DXF del edificio completo (Planos_actualizados_HOSPITAL_SOLCA_QUITO_2025, exportado del
DWG). Trae todos los pisos apilados en el mismo dibujo (unidades: metros), con las mismas capas y bloques que
el plano de la planta baja que ya usa la web (PA, VE, PU, MU, GR, COL, NO, TA, -COL40-, P-DE, P-IZ, -MP…).

Cada piso se recorta por su caja y se lleva al marco de la planta baja actual (public/pb/datos.json):
    local = dxf + T_PB + DESPLAZA[piso]
T_PB se obtuvo alineando las 131 columnas de la planta baja vieja con las de este DXF (residuo 1,6 mm);
DESPLAZA[piso], alineando las columnas de cada piso con las de la planta baja (la estructura es la misma).

Devuelve lo mismo que revit/leer_dxf.cargar(): planos, bloques y textos, en MILÍMETROS del marco local, para
reusar revit/modelo.py y revit/muros.py sin cambios.
Uso: python3 planta_real/pisos/fuente.py   (crea la caché planta_real/pisos/cache/<piso>.pkl.gz)
"""
import gzip
import math
import os
import pickle
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
DXF = os.path.join(AQUI, '..', 'planos', 'solca-edificio-2025.dxf')
CACHE = os.path.join(AQUI, 'cache')

T_PB = (-49.49437, -50.29552)
# caja de cada piso en el DXF (metros) y desplazamiento de sus columnas sobre las de la planta baja
CAJAS = {
    'SB': (20, -260, 250, -5),
    'PB': (20, 30, 250, 200),
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


def cargar(piso):
    with gzip.open(os.path.join(CACHE, f'{piso}.pkl.gz'), 'rb') as f:
        return pickle.load(f)


if __name__ == '__main__':
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

"""
Lee el DXF exportado desde Revit (Proyecto4 - Plano de planta - Nivel 1), que contiene el DWG
original como un bloque con sus capas, bloques anidados y textos. Unidades del DXF: mm.
Devuelve entidades aplanadas en metros, con coordenadas locales (origen en la esquina SO del plano).
"""
import math
import ezdxf

import os
DXF = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'planos', 'solca-PB-revit.dxf')
MM = 0.001


def nombre_bloque(n):
    return n.replace('planos entrada_dwg_', '').replace('-Nivel 1', '')


def cargar(ruta=DXF):
    doc = ezdxf.readfile(ruta)
    ins = [e for e in doc.modelspace() if e.dxftype() == 'INSERT'][0]
    blk = doc.blocks[ins.dxf.name]
    planos = []     # (capa, tipo, [(x,y),...] en mm, cerrada)
    bloques = []    # dict(nombre, x, y, rot, sx, sy, capa, geo=[(capa, pts, cerrada)])
    textos = []     # (capa, texto, x, y, altura)

    def puntos(e):
        t = e.dxftype()
        if t == 'LINE':
            return [(e.dxf.start.x, e.dxf.start.y), (e.dxf.end.x, e.dxf.end.y)], False
        if t == 'LWPOLYLINE':
            pts = [(v.x, v.y) for v in e.vertices_in_wcs()]
            return pts, bool(e.closed)
        if t in ('ARC', 'CIRCLE'):
            c, r = e.dxf.center, e.dxf.radius
            if t == 'CIRCLE':
                a0, a1 = 0.0, 360.0
            else:
                a0, a1 = e.dxf.start_angle, e.dxf.end_angle
                if a1 <= a0: a1 += 360.0
            n = max(4, int((a1 - a0) / 15))
            ocs = e.ocs()
            loc = [(c.x + r * math.cos(math.radians(a0 + (a1 - a0) * i / n)),
                    c.y + r * math.sin(math.radians(a0 + (a1 - a0) * i / n)), c.z) for i in range(n + 1)]
            pts = [(v.x, v.y) for v in ocs.points_to_wcs(loc)]
            return pts, t == 'CIRCLE'
        return None, False

    for e in blk:
        t = e.dxftype()
        if t == 'INSERT':
            geo = []
            try:
                for v in e.virtual_entities():
                    if v.dxftype() == 'INSERT':
                        for w in v.virtual_entities():
                            p, c = puntos(w)
                            if p: geo.append((w.dxf.layer, p, c, w.dxftype()))
                        continue
                    p, c = puntos(v)
                    if p: geo.append((v.dxf.layer, p, c, v.dxftype()))
            except Exception:
                pass
            bloques.append(dict(nombre=nombre_bloque(e.dxf.name), x=e.dxf.insert.x, y=e.dxf.insert.y,
                                rot=e.dxf.get('rotation', 0.0), sx=e.dxf.get('xscale', 1.0),
                                sy=e.dxf.get('yscale', 1.0), capa=e.dxf.layer, geo=geo))
        elif t == 'MTEXT':
            textos.append((e.dxf.layer, e.plain_text(), e.dxf.insert.x, e.dxf.insert.y, e.dxf.char_height))
        elif t == 'HATCH':
            continue
        else:
            p, c = puntos(e)
            if p: planos.append((e.dxf.layer, t, p, c))
    return planos, bloques, textos

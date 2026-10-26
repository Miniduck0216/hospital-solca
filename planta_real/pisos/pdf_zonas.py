"""
Planos en PDF recortados por zonas (los manda el hospital: planta_real/planos/<carpeta>/zonaN.pdf) llevados al
marco local del piso con la transformación de registro.json. Se usan para corregir el dibujo del DXF donde no
coincide con lo que el hospital revisó:
- muros rellenos en gris (sombreado de muros del ala oeste) → polígonos de muro tal cual
- líneas negras o grises (muros dibujados con dos líneas, sin sombreado) → trazos para la detección de muros
"""
import json
import math
import os

import pymupdf as fitz
from shapely.geometry import Polygon, LineString
from shapely.ops import unary_union

AQUI = os.path.dirname(os.path.abspath(__file__))
PLANOS = os.path.join(AQUI, '..', 'planos')
GRIS = (0.33, 0.33, 0.33)
NEGROS = {(0.0, 0.0, 0.0), GRIS}


def _tf(r, x, y):
    e = r['escala']
    u, v = x * e, -y * e
    if r['espejo']:
        u = -u
    th = r['rot'] * math.pi / 2
    c, s = math.cos(th), math.sin(th)
    return c * u - s * v + r['tx'], s * u + c * v + r['ty']


def _zonas(carpeta, solo=None):
    reg = json.load(open(os.path.join(PLANOS, carpeta, 'registro.json')))['zonas']
    for n, r in sorted(reg.items()):
        if solo and n not in solo:
            continue
        yield fitz.open(os.path.join(PLANOS, carpeta, f'zona{n}.pdf'))[0], r


def _puntos(it):
    if it[0] == 'l':
        return [it[1], it[2]]
    if it[0] == 'c':
        return [it[1], it[2], it[3], it[4]]
    if it[0] == 're':
        r = it[1]
        return [fitz.Point(r.x0, r.y0), fitz.Point(r.x1, r.y0), fitz.Point(r.x1, r.y1), fitz.Point(r.x0, r.y1)]
    if it[0] == 'qu':
        q = it[1]
        return [q.ul, q.ur, q.lr, q.ll]
    return []


def muros_grises(carpeta, zona, solo=None):
    """Polígonos rellenos de gris dentro de `zona` (marco local, m)."""
    out = []
    for page, r in _zonas(carpeta, solo or '1'):
        for d in page.get_drawings():
            if tuple(round(v, 2) for v in (d.get('fill') or ())) != GRIS:
                continue
            for sub in _subtrazos(d):
                pts = [_tf(r, p.x, p.y) for p in sub]
                if len(pts) < 3:
                    continue
                g = Polygon(pts).buffer(0)
                if 0.004 < g.area < 30 and zona.buffer(0.3).contains(g):
                    out.append(g)
    u = unary_union(out)
    g = [g for g in (u.geoms if hasattr(u, 'geoms') else [u]) if g.area > 0.004]
    # rótulos de nivel («N + 3.95») vienen con letras rellenas en gris: piezas chicas sueltas
    grandes = unary_union([q for q in g if q.area >= 0.08])
    return [q for q in g if q.area >= 0.08 or q.distance(grandes) < 0.03]


def _subtrazos(d):
    """Un dibujo relleno puede traer varios contornos: se separan donde el trazo salta."""
    subs, cur, ult = [], [], None
    for it in d['items']:
        pts = _puntos(it)
        if not pts:
            continue
        if it[0] in ('re', 'qu'):
            subs.append(pts)
            continue
        if ult is not None and abs(pts[0].x - ult.x) + abs(pts[0].y - ult.y) > 1e-3:
            if cur:
                subs.append(cur)
            cur = []
        cur += pts if not cur else pts[1:]
        ult = pts[-1]
    if cur:
        subs.append(cur)
    return subs


def lineas(carpeta, zona, solo=None, colores=NEGROS, minimo=0.3):
    """Trazos rectos negros o grises dentro de `zona` (marco local, m), como listas de puntos. Sin arcos (puertas)
    ni trazos cortos (las letras de los rótulos vienen dibujadas con líneas)."""
    out = []
    for page, r in _zonas(carpeta, solo):
        dibs = page.get_drawings()
        # marco de la hoja (rectángulo que encierra todo): no es un muro
        x0 = min(d['rect'].x0 for d in dibs); x1 = max(d['rect'].x1 for d in dibs)
        y0 = min(d['rect'].y0 for d in dibs); y1 = max(d['rect'].y1 for d in dibs)

        def en_marco(p, q):
            return any(abs(a - b) < 0.8 and abs(c - b) < 0.8 for a, c, b in
                       ((p.x, q.x, x0), (p.x, q.x, x1), (p.y, q.y, y0), (p.y, q.y, y1)))
        for d in dibs:
            col = tuple(round(v, 2) for v in (d.get('color') or ()))
            if col not in colores or d.get('fill'):
                continue
            for it in d['items']:
                if it[0] == 'c' or (it[0] == 'l' and en_marco(it[1], it[2])):
                    continue
                pts = [_tf(r, p.x, p.y) for p in _puntos(it)]
                if it[0] in ('re', 'qu'):
                    pts = pts + [pts[0]]
                if len(pts) < 2 or LineString(pts).length < minimo:
                    continue
                g = LineString(pts).intersection(zona)
                for q in (g.geoms if hasattr(g, 'geoms') else [g]):
                    if q.geom_type == 'LineString' and q.length >= 0.05:
                        out.append(list(q.coords))
    return out


def bandas_ventana(carpeta, zona, solo=None, sep=(0.04, 0.25), minimo=0.8, direcciones=(True, False)):
    """Ventanas dibujadas como dos líneas finas paralelas (horizontales o verticales) a 4–25 cm: rectángulos."""
    from shapely.geometry import box as _box
    ls = lineas(carpeta, zona, solo, minimo=minimo)
    out = []
    for horiz in direcciones:
        segs = []
        for p in ls:
            (x0, y0), (x1, y1) = p[0], p[-1]
            if horiz and abs(y1 - y0) < 0.02:
                segs.append((y0, min(x0, x1), max(x0, x1)))
            elif not horiz and abs(x1 - x0) < 0.02:
                segs.append((x0, min(y0, y1), max(y0, y1)))
        segs.sort()
        for i, (c1, a1, b1) in enumerate(segs):
            for c2, a2, b2 in segs[i + 1:]:
                if c2 - c1 > sep[1]:
                    break
                if c2 - c1 < sep[0]:
                    continue
                a, b = max(a1, a2), min(b1, b2)
                if b - a >= minimo:
                    out.append(_box(a, c1, b, c2) if horiz else _box(c1, a, c2, b))
    u = unary_union(out)
    return [g for g in (u.geoms if hasattr(u, 'geoms') else [u]) if g.area > 0.02]

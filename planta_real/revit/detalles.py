"""
Elementos que el plano dibuja con dos líneas paralelas: según la separación entre las líneas son tabiques
(0,03–0,22 m), mostradores o escritorios (0,35–1,0 m) o paneles divisorios. Devuelve la franja entre las
dos líneas como polígono, en metros locales.
"""
import math
import numpy as np
from shapely.geometry import LineString, Polygon
from shapely.strtree import STRtree


def segmentos(m, capas, minimo=0.08):
    out = []
    for c, t, p, _ in m.planos:
        if c not in capas:
            continue
        pts = m.Lp(p)
        for a, b in zip(pts, pts[1:]):
            if math.dist(a, b) >= minimo:
                out.append(LineString([a, b]))
    return out


def franjas(segs, dmin, dmax, solape=0.5):
    """Lista de (polígono, separación, largo) para cada par de segmentos paralelos a dmin..dmax."""
    if not segs:
        return []
    arbol = STRtree(segs)
    out = []
    vistos = set()
    for i, a in enumerate(segs):
        (ax, ay), (bx, by) = a.coords[0], a.coords[-1]
        u = np.array([bx - ax, by - ay]); la = np.linalg.norm(u)
        if la < 1e-6:
            continue
        u = u / la
        n = np.array([-u[1], u[0]])
        for j in arbol.query(a.buffer(dmax + 0.01)):
            j = int(j)
            if j <= i or (i, j) in vistos:
                continue
            b = segs[j]
            (cx, cy), (dx, dy) = b.coords[0], b.coords[-1]
            v = np.array([dx - cx, dy - cy]); lb = np.linalg.norm(v)
            if lb < 1e-6 or abs(abs(float(np.dot(u, v / lb))) - 1) > 1e-3:      # paralelos (< ~2,5°)
                continue
            dist = abs(float(np.dot(np.array([cx - ax, cy - ay]), n)))
            if not (dmin <= dist <= dmax):
                continue
            ta = sorted([0.0, la])
            tb = sorted([float(np.dot(np.array([cx - ax, cy - ay]), u)), float(np.dot(np.array([dx - ax, dy - ay]), u))])
            t0, t1 = max(ta[0], tb[0]), min(ta[1], tb[1])
            if t1 - t0 < solape * min(la, lb) or t1 - t0 < 0.05:
                continue
            lado = 1 if float(np.dot(np.array([cx - ax, cy - ay]), n)) > 0 else -1
            p0 = np.array([ax, ay]) + u * t0
            p1 = np.array([ax, ay]) + u * t1
            q = Polygon([tuple(p0), tuple(p1), tuple(p1 + n * dist * lado), tuple(p0 + n * dist * lado)])
            vistos.add((i, j))
            out.append((q, dist, t1 - t0))
    return out

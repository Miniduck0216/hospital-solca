"""Herramienta: compara los PDF por zonas con lo que tiene el mapa (python3 comparar_pdf.py 12345 [datos.json] [carpeta]).
"""
"""Superpone el PDF de cada zona (negro) sobre lo que hoy tiene el mapa del piso 1 (muros en rojo, ventanas en azul)."""
import sys, json, math, glob
import numpy as np, pymupdf as fitz
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
from matplotlib.collections import LineCollection, PatchCollection
from matplotlib.patches import Polygon as MPoly
REG = json.load(open('/home/claude/hospital-solca/planta_real/planos/p1_zonas/registro.json'))['zonas']
D = json.load(open(sys.argv[2] if len(sys.argv) > 2 else '/home/claude/hospital-solca/public/p1/datos.json'))
OUT = sys.argv[3] if len(sys.argv) > 3 else '/tmp'
def pdf_segs(f):
    p = fitz.open(f)[0]; out = []; col = []
    for d in p.get_drawings():
        c = d.get('color') or (0,0,0)
        for it in d['items']:
            if it[0] == 'l': out.append((it[1].x, it[1].y, it[2].x, it[2].y)); col.append(c)
            elif it[0] == 'c':
                pts = [it[1], it[2], it[3], it[4]]
                for a, b in zip(pts[:-1], pts[1:]): out.append((a.x, a.y, b.x, b.y)); col.append(c)
            elif it[0] == 're':
                r = it[1]; cc = [(r.x0,r.y0),(r.x1,r.y0),(r.x1,r.y1),(r.x0,r.y1),(r.x0,r.y0)]
                for a, b in zip(cc[:-1], cc[1:]): out.append((*a, *b)); col.append(c)
    return np.array(out), col
def tf(r, x, y):
    e = r['escala']; u, v = x*e, -y*e
    if r['espejo']: u = -u
    th = r['rot']*math.pi/2; c, s = math.cos(th), math.sin(th)
    return c*u - s*v + r['tx'], s*u + c*v + r['ty']
def polys(lst):
    out = []
    for pg in lst:
        for ring in pg[:1]:
            out.append(MPoly(np.array(ring), closed=True))
    return out
for f in sorted(glob.glob('/home/claude/hospital-solca/planta_real/planos/p1_zonas/zona[1-5].pdf')):
    n = f[-5]
    if n not in sys.argv[1]: continue
    r = REG[n]; P, col = pdf_segs(f)
    L = np.hypot(P[:,2]-P[:,0], P[:,3]-P[:,1]); keep = L < 400; P = P[keep]
    A = np.array([tf(r, x, y) for x, y in P[:, :2]]); B = np.array([tf(r, x, y) for x, y in P[:, 2:]])
    x0, y0 = np.minimum(A.min(0), B.min(0)); x1, y1 = np.maximum(A.max(0), B.max(0))
    # dividir zonas largas en partes de ~45 m
    lado = max(x1-x0, y1-y0); partes = max(1, int(math.ceil(lado / 40)))
    for k in range(partes):
        if x1-x0 >= y1-y0: bx = (x0 + (x1-x0)*k/partes - 1, x0 + (x1-x0)*(k+1)/partes + 1, y0, y1)
        else: bx = (x0, x1, y0 + (y1-y0)*k/partes - 1, y0 + (y1-y0)*(k+1)/partes + 1)
        w, h = bx[1]-bx[0], bx[3]-bx[2]
        fig = plt.figure(figsize=(22, 22*h/w) if w > h else (22*w/h, 22)); ax = fig.add_axes([0,0,1,1])
        ax.add_collection(PatchCollection(polys(D['muros']), facecolor=(1,0,0,0.45), edgecolor='none'))
        ax.add_collection(PatchCollection(polys(D['ventanas']), facecolor=(0,0.3,1,0.5), edgecolor='none'))
        ax.add_collection(LineCollection(np.stack([A, B], 1), colors='k', linewidths=0.35))
        for a in D['ambientes']:
            if bx[0] < a['lbl'][0] < bx[1] and bx[2] < a['lbl'][1] < bx[3]:
                ax.text(a['lbl'][0], a['lbl'][1], f"{a['id']} {a['nombre'][:14]}", fontsize=7, color='g', ha='center')
        # retícula cada 5 m con coordenadas (para nombrar los puntos)
        for gx in range(int(bx[0]//5*5), int(bx[1])+1, 5):
            ax.axvline(gx, color=(0,0.6,0,0.25), lw=0.5); ax.text(gx, bx[2]+0.3, str(gx), fontsize=7, color='g')
        for gy in range(int(bx[2]//5*5), int(bx[3])+1, 5):
            ax.axhline(gy, color=(0,0.6,0,0.25), lw=0.5); ax.text(bx[0]+0.2, gy, str(gy), fontsize=7, color='g')
        ax.set_xlim(bx[0], bx[1]); ax.set_ylim(bx[2], bx[3]); ax.set_aspect('equal'); ax.axis('off')
        fig.savefig(f'{OUT}/cmp_z{n}_{k}.png', dpi=80); plt.close(fig)
        print(n, k, [round(v,1) for v in bx])

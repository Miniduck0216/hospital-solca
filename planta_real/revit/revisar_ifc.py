"""Lee el IFC con el motor de geometría de IfcOpenShell (como lo haría Revit) y dibuja vistas 3D de control."""
import sys, collections
import numpy as np
import ifcopenshell, ifcopenshell.geom
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection

ruta = sys.argv[1]
f = ifcopenshell.open(ruta)
s = ifcopenshell.geom.settings()
s.set('use-world-coords', True)
it = ifcopenshell.geom.iterator(s, f, 4)
tris = collections.defaultdict(list)
fallos = 0
ok = collections.Counter()
if it.initialize():
    while True:
        sh = it.get()
        el = f.by_guid(sh.guid)
        g = sh.geometry
        v = np.array(g.verts).reshape(-1, 3); fa = np.array(g.faces).reshape(-1, 3)
        mats = g.materials
        col = (0.8, 0.8, 0.8, 1)
        if mats:
            d = mats[0].diffuse
            try:
                col = (d.r(), d.g(), d.b(), 1 - (mats[0].transparency or 0))
            except Exception:
                col = (d[0], d[1], d[2], 1 - (mats[0].transparency or 0))
        tris[el.is_a()].append((v[fa], col))
        ok[el.is_a()] += 1
        if not it.next():
            break
total = sum(len(f.by_type(c)) for c in ok)
print('con geometría:', dict(ok))
print('productos en archivo:', {c: len(f.by_type(c)) for c in ok})

def vista(salida, elev, azim, xlim, ylim, zmax=4.2, ocultar=('IfcSpace', 'IfcSlab'), tam=(16, 12)):
    fig = plt.figure(figsize=tam); ax = fig.add_subplot(projection='3d')
    for clase, lst in tris.items():
        if clase in ocultar:
            continue
        polys, cols = [], []
        for tri, col in lst:
            c = tri.mean(axis=1)
            sel = (c[:, 0] > xlim[0]) & (c[:, 0] < xlim[1]) & (c[:, 1] > ylim[0]) & (c[:, 1] < ylim[1])
            for t in tri[sel]:
                polys.append(t); cols.append(col)
        if polys:
            pc = Poly3DCollection(polys, facecolors=cols, edgecolors='none', linewidths=0)
            ax.add_collection3d(pc)
    ax.set_xlim(*xlim); ax.set_ylim(*ylim); ax.set_zlim(0, zmax)
    ax.set_box_aspect((xlim[1] - xlim[0], ylim[1] - ylim[0], zmax * 1.0))
    ax.view_init(elev=elev, azim=azim); ax.set_axis_off()
    fig.savefig(salida, dpi=80, bbox_inches='tight'); plt.close(fig)

for a in sys.argv[2:]:
    n, e, az, x0, x1, y0, y1 = a.split(',')
    vista('/tmp/' + n + '.png', float(e), float(az), (float(x0), float(x1)), (float(y0), float(y1)))

"""Triangula el IFC y genera capturas 3D con three.js en Chromium (Playwright). Solo para control visual."""
import sys, json, struct, subprocess, time, os, collections
import numpy as np
import ifcopenshell, ifcopenshell.geom

ruta, salida_dir = sys.argv[1], '/tmp/render'
f = ifcopenshell.open(ruta)
s = ifcopenshell.geom.settings(); s.set('use-world-coords', True)
it = ifcopenshell.geom.iterator(s, f, 4)
pos, col, clase = [], [], []
CLASES = {}
if it.initialize():
    while True:
        sh = it.get(); el = f.by_guid(sh.guid); g = sh.geometry
        v = np.array(g.verts, np.float32).reshape(-1, 3); fa = np.array(g.faces).reshape(-1, 3)
        mids = np.array(g.material_ids) if len(g.material_ids) else np.zeros(len(fa), int)
        mats = g.materials
        cols = []
        for m in mats:
            d = m.diffuse
            try: c = (d.r(), d.g(), d.b())
            except Exception: c = tuple(d)
            cols.append(c)
        if not cols: cols = [(0.8, 0.8, 0.8)]
        k = CLASES.setdefault(el.is_a(), len(CLASES))
        t = v[fa].reshape(-1, 3)
        c = np.repeat(np.array([cols[max(0, i) if i < len(cols) else 0] for i in mids], np.float32), 3, axis=0)
        pos.append(t); col.append(c); clase.append(np.full(len(t), k, np.uint8))
        if not it.next(): break
P = np.concatenate(pos); C = np.concatenate(col); K = np.concatenate(clase)
P.astype('<f4').tofile(salida_dir + '/pos.bin'); (C * 255).astype(np.uint8).tofile(salida_dir + '/col.bin')
K.tofile(salida_dir + '/cls.bin')
json.dump({'clases': CLASES, 'n': int(len(P))}, open(salida_dir + '/meta.json', 'w'))
print('triángulos', len(P) // 3, CLASES)

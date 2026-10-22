"""
Modelo 3D de la planta baja para la web: lee el IFC (el mismo que va a Revit), triangula cada elemento con
IfcOpenShell y lo agrupa por color en un GLB liviano (una malla por material).
Ejes del GLB: X = este del plano, Y = arriba, Z = -norte del plano (convención glTF).
Uso: python3 planta_real/web/exportar_glb.py [entrada.ifc] [salida.glb]
"""
import os
import sys
import json
import collections
import numpy as np
import ifcopenshell
import ifcopenshell.geom
import trimesh

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, '..', '..'))
ENTRADA = sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'planta_real/revit/salida/solca_pb.ifc')
SALIDA = sys.argv[2] if len(sys.argv) > 2 else os.path.join(RAIZ, 'public/pb/solca_pb.glb')

# grupos que la web puede mostrar u ocultar por separado
def grupo(el):
    c = el.is_a()
    n = el.Name or ''
    if c in ('IfcSlab',) and n == 'Visera':
        return 'viseras'
    if c in ('IfcSlab', 'IfcCovering'):
        return 'pisos'
    if c in ('IfcWall', 'IfcColumn', 'IfcMember', 'IfcWindow', 'IfcDoor'):
        return 'muros'
    if c == 'IfcFurnishingElement' and (n.startswith('Letrero') or n.startswith('Texto') or n.startswith('Tensor')):
        return 'letreros'
    if c == 'IfcStair':
        return 'escaleras'
    return 'muebles'


def main():
    f = ifcopenshell.open(ENTRADA)
    s = ifcopenshell.geom.settings()
    s.set('use-world-coords', True)
    it = ifcopenshell.geom.iterator(s, f, os.cpu_count() or 4)
    partes = collections.defaultdict(lambda: {'v': [], 'f': [], 'n': 0})
    alfa = {}
    if not it.initialize():
        raise SystemExit('sin geometría')
    while True:
        sh = it.get()
        el = f.by_guid(sh.guid)
        if el.is_a() != 'IfcSpace':
            g = sh.geometry
            v = np.array(g.verts, np.float64).reshape(-1, 3)
            fa = np.array(g.faces, np.int64).reshape(-1, 3)
            mids = np.array(g.material_ids) if len(g.material_ids) else np.zeros(len(fa), int)
            cols = []
            for m in g.materials:
                d = m.diffuse
                try:
                    c = (d.r(), d.g(), d.b())
                except Exception:
                    c = tuple(d)
                tr = getattr(m, 'transparency', 0.0) or 0.0
                cols.append((c, tr))
            if not cols:
                cols = [((0.8, 0.8, 0.8), 0.0)]
            gr = grupo(el)
            for k in np.unique(mids):
                (c, tr) = cols[k] if 0 <= k < len(cols) else cols[0]
                clave = (gr, tuple(round(x, 3) for x in c), round(float(tr), 2))
                sel = fa[mids == k]
                usados = np.unique(sel)
                mapa = {int(u): i for i, u in enumerate(usados)}
                p = partes[clave]
                p['v'].append(v[usados])
                p['f'].append(np.vectorize(mapa.get)(sel) + p['n'])
                p['n'] += len(usados)
        if not it.next():
            break
    escena = trimesh.Scene()
    resumen = {}
    for (gr, c, tr), p in partes.items():
        V = np.concatenate(p['v'])
        F = np.concatenate(p['f'])
        # plano (x, y, z) -> glTF (x, z, -y)
        V = np.stack([V[:, 0], V[:, 2], -V[:, 1]], axis=1)
        malla = trimesh.Trimesh(V, F, process=True)
        malla.merge_vertices()
        rgba = [int(c[0] * 255), int(c[1] * 255), int(c[2] * 255), int(round((1 - tr) * 255))]
        mat = trimesh.visual.material.PBRMaterial(baseColorFactor=rgba, metallicFactor=0.0, roughnessFactor=0.9,
                                                  alphaMode='BLEND' if tr > 0.01 else 'OPAQUE', doubleSided=True)
        malla.visual = trimesh.visual.TextureVisuals(material=mat)
        nombre = f'{gr}|{c[0]:.3f},{c[1]:.3f},{c[2]:.3f}|{tr:.2f}'
        escena.add_geometry(malla, node_name=nombre, geom_name=nombre)
        resumen[gr] = resumen.get(gr, 0) + len(F)
    os.makedirs(os.path.dirname(SALIDA), exist_ok=True)
    escena.export(SALIDA)
    print('GLB', SALIDA, round(os.path.getsize(SALIDA) / 1e6, 2), 'MB', json.dumps(resumen))


if __name__ == '__main__':
    main()

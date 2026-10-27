"""
Modelo 3D (GLB) de un piso, con el mismo proceso de la planta baja: modelo -> IFC (revit/a_ifc.py) -> GLB
(web/exportar_glb.py). Se recorta a la huella real del piso (en los pisos altos, la torre; no la losa de abajo) y
se lleva al marco de la planta baja (los pisos quedan uno sobre otro en las mismas coordenadas).

Con --fuera-de <datos.json> solo se dejan los elementos que quedan fuera de la huella de ese plano: así se arma la
parte nueva de la planta baja sin repetir la que ya estaba.
Uso: python3 planta_real/pisos/glb_piso.py P1 [salida.glb] [--fuera-de public/pb/datos.json]
"""
import os
import sys
import json
import pickle

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, '..', '..'))
sys.path.insert(0, os.path.join(RAIZ, 'planta_real', 'revit'))
sys.path.insert(0, os.path.join(RAIZ, 'planta_real', 'web'))
sys.path.insert(0, AQUI)

from shapely.geometry import Polygon, Point  # noqa: E402
from shapely.ops import unary_union  # noqa: E402
from shapely import affinity  # noqa: E402
import exportar_piso as EP  # noqa: E402


def recortar(m, zona):
    """Deja en el modelo solo lo que cae dentro de `zona` (marco del modelo)."""
    def dentro(g, frac=0.5):
        try:
            return g.intersection(zona).area >= frac * max(g.area, 1e-9) if g.area > 0 else zona.contains(g.centroid)
        except Exception:
            return False
    m.ambientes = [a for a in m.ambientes if dentro(a['poligono'])]
    m.muros = [pg.intersection(zona) for pg in m.muros if pg.intersects(zona)]
    m.muros = [g for g in m.muros if not g.is_empty and g.area > 0.005]
    m.ventanas = [pg for pg in m.ventanas if dentro(pg)]
    m.columnas = [pg for pg in m.columnas if zona.contains(pg.centroid)]
    m.puertas = [p for p in m.puertas if zona.contains(p['rect'].centroid)]
    m.muebles = [mu for mu in m.muebles if zona.contains(mu['poligono'].centroid)]
    for k in ('ventanillas', 'parapetos', 'viseras', 'vidrios', 'foso'):
        if hasattr(m, k):
            setattr(m, k, [pg for pg in getattr(m, k) if zona.contains(pg.centroid)])
    if hasattr(m, 'tabiques'):
        m.tabiques = [t for t in m.tabiques if zona.contains(t['poligono'].centroid)]
    if hasattr(m, 'escaleras'):
        m.escaleras = [e for e in m.escaleras if any(zona.contains(q.centroid) for q, _ in e['pasos'])]
    if getattr(m, 'puerta_ascensor', None) is not None and not zona.contains(m.puerta_ascensor['rect'].centroid
                                                                              if isinstance(m.puerta_ascensor, dict) else
                                                                              m.puerta_ascensor.centroid):
        m.puerta_ascensor = None
    m.huella = m.huella.intersection(zona) if not m.huella.is_empty else m.huella


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    piso = args[0]
    salida = args[1] if len(args) > 1 else os.path.join(RAIZ, 'public', piso.lower(), f'solca_{piso.lower()}.glb')
    fuera = sys.argv[sys.argv.index('--fuera-de') + 1] if '--fuera-de' in sys.argv else None
    import __main__
    import modelo_piso
    __main__.ModeloPiso = modelo_piso.ModeloPiso
    m = pickle.load(open(f'/tmp/modelo_{piso}.pkl', 'rb'))
    ox, oy = m.origen
    for a in m.ambientes:
        a['nombre'] = EP.limpiar_nombre(a['nombre'])
    # barras entre tramos de escalera: parapeto de 1 m en lugar de tabique de altura completa
    m.parapetos = list(getattr(m, 'parapetos', [])) + EP.barandas(m)
    zona = EP.huella_real(m).buffer(0.6, join_style=2)
    if fuera:
        dv = json.load(open(fuera))
        vieja = unary_union([Polygon(pg[0], pg[1:]) for pg in dv['huella']]).buffer(0.3, join_style=2)
        zona = zona.difference(affinity.translate(vieja, -ox, -oy))
    m.huella = EP.huella_real(m)
    recortar(m, zona)
    from a_ifc import escribir
    ifc = f'/tmp/solca_{piso.lower()}.ifc'
    escribir(m, ifc)
    import exportar_glb as EG
    EG.ENTRADA, EG.SALIDA = ifc, salida
    EG.main()
    # al marco de la planta baja: plano (x, y) -> glTF (x, z, -y)
    import trimesh
    esc = trimesh.load(salida, force='scene')
    esc.apply_translation([ox, 0.0, -oy])
    esc.export(salida)
    print('GLB', salida, round(os.path.getsize(salida) / 1e6, 2), 'MB; desplazado', round(ox, 3), round(oy, 3))


if __name__ == '__main__':
    main()

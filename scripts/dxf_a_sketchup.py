"""
DXF (capas WF_*) → modelo SketchUp (script Ruby) + datos JSON + vista previa.

Capas que lee (las mismas del importador del zip):
  WF_CONTORNO  polilínea cerrada: borde de la planta (muro exterior y losa)
  WF_AREAS     polilínea cerrada por ambiente
  WF_NOMBRES   TEXT dentro de cada área: «Nombre|categoria|sinónimos»
  WF_RUTAS     líneas por el eje de pasillos
  WF_PUERTAS   círculo en cada puerta (abre un vano en el muro más cercano)
  WF_VERTICAL  TEXT ASC-A / ESC-1 sobre el nodo de ascensor o escalera
  WF_INICIO    TEXT con un punto de partida (QR)
Opcional:
  WF_MUROS     líneas o polilíneas de muros reales (si existe, reemplaza a los bordes de las áreas)

Uso:  python3 scripts/dxf_a_sketchup.py planos/PB.dxf  salida/planta_pb   [--altura 3.0]
Genera  salida/planta_pb.rb  (SketchUp: Extensions › Ruby Console › load "…/planta_pb.rb")
        salida/planta_pb.json, salida/planta_pb_planta.png, salida/planta_pb_3d.png
"""
import argparse, json, math, sys
from pathlib import Path
import ezdxf

COLORES = {  # mismos tonos de la app
    'emergencia': '#F4C9C3', 'consulta': '#C9D8FB', 'diagnostico': '#DCD0F5', 'tratamiento': '#F8DFB8',
    'hospitalizacion': '#C6E8D1', 'servicios': '#DDE2E8', 'administracion': '#F1CFE0', 'circulacion': '#D2D8DF',
}
E_INT, E_EXT, ANCHO_PUERTA = 0.15, 0.25, 1.2


def leer(ruta):
    doc = ezdxf.readfile(ruta)
    msp = doc.modelspace()
    ins = doc.header.get('$INSUNITS', 6)
    pts_todos = []

    def pl(e):
        if e.dxftype() == 'LWPOLYLINE':
            return [(p[0], p[1]) for p in e.get_points('xy')], bool(e.closed)
        if e.dxftype() == 'POLYLINE':
            return [(v.dxf.location.x, v.dxf.location.y) for v in e.vertices], e.is_closed
        if e.dxftype() == 'LINE':
            return [(e.dxf.start.x, e.dxf.start.y), (e.dxf.end.x, e.dxf.end.y)], False
        return None, False

    capas = {}
    for e in msp:
        capas.setdefault(e.dxf.layer.upper(), []).append(e)
    for e in msp:
        p, _ = pl(e)
        if p: pts_todos += p
    # unidades: si el plano mide más de 1000 «metros», está en milímetros
    xs = [p[0] for p in pts_todos]; ys = [p[1] for p in pts_todos]
    ext = max(max(xs) - min(xs), max(ys) - min(ys))
    k = {4: 0.001, 5: 0.01, 6: 1.0}.get(ins, 1.0)
    if ext * k > 1000: k = 0.001
    x0, y0 = min(xs), min(ys)
    T = lambda p: (round((p[0] - x0) * k, 4), round((p[1] - y0) * k, 4))

    def textos(capa):
        out = []
        for e in capas.get(capa, []):
            if e.dxftype() in ('TEXT', 'MTEXT'):
                t = e.dxf.text if e.dxftype() == 'TEXT' else e.text
                ins_ = e.dxf.insert
                out.append((t.strip(), T((ins_.x, ins_.y))))
        return out

    def polis(capa, cerradas=None):
        out = []
        for e in capas.get(capa, []):
            p, c = pl(e)
            if p and (cerradas is None or c == cerradas):
                out.append([T(q) for q in p])
        return out

    contorno = (polis('WF_CONTORNO', True) or [None])[0]
    areas = []
    nombres = textos('WF_NOMBRES')
    for poly in polis('WF_AREAS', True):
        nom = next((t for t, q in nombres if dentro(q, poly)), 'Sin nombre')
        partes = nom.split('|')
        areas.append({'nombre': partes[0], 'cat': partes[1] if len(partes) > 1 else 'servicios',
                      'sinonimos': partes[2].split(',') if len(partes) > 2 else [], 'poligono': poly})
    puertas = []
    for e in capas.get('WF_PUERTAS', []):
        c = e.dxf.center if e.dxftype() == 'CIRCLE' else getattr(e.dxf, 'location', None) or e.dxf.insert
        puertas.append(T((c.x, c.y)))
    return {
        'escala_m': k, 'contorno': contorno, 'areas': areas, 'puertas': puertas,
        'rutas': polis('WF_RUTAS'), 'muros': polis('WF_MUROS'),
        'verticales': [{'codigo': t, 'pos': q} for t, q in textos('WF_VERTICAL')],
        'inicios': [{'nombre': t, 'pos': q} for t, q in textos('WF_INICIO')],
    }


def dentro(p, poly):
    x, y = p; c = False
    for i in range(len(poly)):
        (x1, y1), (x2, y2) = poly[i], poly[i - 1]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1: c = not c
    return c


def segmentos(D):
    """Muros: WF_MUROS si existe; si no, bordes de áreas + contorno, sin duplicados ni solapes."""
    segs = []
    if D['muros']:
        for p in D['muros']:
            segs += [(p[i], p[i + 1], E_INT) for i in range(len(p) - 1)]
        return segs
    bruto = []
    if D['contorno']:
        c = D['contorno']; bruto += [(c[i], c[(i + 1) % len(c)], E_EXT) for i in range(len(c))]
    for a in D['areas']:
        p = a['poligono']; bruto += [(p[i], p[(i + 1) % len(p)], E_INT) for i in range(len(p))]
    # fusiona solapes de segmentos colineales (ejes horizontales/verticales y oblicuos)
    grupos = {}
    for a, b, e in bruto:
        dx, dy = b[0] - a[0], b[1] - a[1]; L = math.hypot(dx, dy)
        if L < 1e-6: continue
        ux, uy = dx / L, dy / L
        if ux < -1e-9 or (abs(ux) < 1e-9 and uy < 0): ux, uy = -ux, -uy
        n = round(-uy * a[0] + ux * a[1], 3)
        clave = (round(ux, 4), round(uy, 4), n)
        t0, t1 = sorted([a[0] * ux + a[1] * uy, b[0] * ux + b[1] * uy])
        grupos.setdefault(clave, []).append([t0, t1, e])
    for (ux, uy, n), ivs in grupos.items():
        ivs.sort()
        actual = ivs[0][:]
        for t0, t1, e in ivs[1:]:
            if t0 <= actual[1] + 1e-6:
                actual[1] = max(actual[1], t1); actual[2] = max(actual[2], e)
            else:
                segs.append(_seg(ux, uy, n, actual)); actual = [t0, t1, e]
        segs.append(_seg(ux, uy, n, actual))
    return segs


def _seg(ux, uy, n, iv):
    t0, t1, e = iv
    P = lambda t: (round(t * ux - n * uy, 4), round(t * uy + n * ux, 4))
    return (P(t0), P(t1), e)


def cortar_puertas(segs, puertas):
    """Abre un vano en el muro más cercano a cada puerta: (x, y) o ((x, y), ancho)."""
    puertas = [p if isinstance(p[0], tuple) else (p, ANCHO_PUERTA) for p in puertas]
    out = []
    for a, b, e in segs:
        dx, dy = b[0] - a[0], b[1] - a[1]; L = math.hypot(dx, dy)
        vanos = []
        for p, ancho in puertas:
            t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L
            d = abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / L
            if -0.01 <= t <= L + 0.01 and d < 0.6: vanos.append((max(0, t - ancho / 2), min(L, t + ancho / 2)))
        t = 0
        for v0, v1 in sorted(vanos):
            if v0 > t + 0.05: out.append((_lerp(a, b, t / L), _lerp(a, b, v0 / L), e, 'muro'))
            out.append((_lerp(a, b, v0 / L), _lerp(a, b, v1 / L), e, 'vano'))
            t = max(t, v1)
        if L - t > 0.05: out.append((_lerp(a, b, t / L), b, e, 'muro'))
    return out


_lerp = lambda a, b, u: (round(a[0] + (b[0] - a[0]) * u, 4), round(a[1] + (b[1] - a[1]) * u, 4))


def ruby(D, muros, altura):
    pts = lambda pp: '[' + ', '.join(f'[{x:.3f}.m, {y:.3f}.m, 0]' for x, y in pp) + ']'
    L = ['# Generado por scripts/dxf_a_sketchup.py — planta baja', 'model = Sketchup.active_model',
         'model.start_operation("Planta baja SOLCA", true)', 'ents = model.active_entities',
         'mats = model.materials', 'capa = ->(n) { model.layers[n] || model.layers.add(n) }',
         'mat = ->(n, hex) { m = mats[n] || mats.add(n); m.color = Sketchup::Color.new(hex); m }',
         f'ALTO = {altura}.m', 'ALTO_DINTEL = 2.10.m', '']
    L.append('g = ents.add_group; g.name = "Losa"; g.layer = capa.("Losa")')
    if D['contorno']:
        L += [f'f = g.entities.add_face({pts(D["contorno"])})', 'f.reverse! if f.normal.z > 0', 'f.pushpull(0.20.m)',
              'g.entities.grep(Sketchup::Face).each { |x| x.material = mat.("Losa", "#C9CCCF") }']
    L.append('')
    for i, a in enumerate(D['areas']):
        L += [f'g = ents.add_group; g.name = {json.dumps(a["nombre"])}; g.layer = capa.("Ambientes")',
              f'f = g.entities.add_face({pts(a["poligono"])}); f.reverse! if f.normal.z < 0',
              f'g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))',
              f'f.material = mat.("Piso {a["cat"]}", "{COLORES.get(a["cat"], "#DDE2E8")}")',
              f'g.set_attribute("solca", "categoria", {json.dumps(a["cat"])})']
        cx = sum(p[0] for p in a['poligono']) / len(a['poligono']); cy = sum(p[1] for p in a['poligono']) / len(a['poligono'])
        L.append(f't = ents.add_text({json.dumps(a["nombre"])}, [{cx:.3f}.m, {cy:.3f}.m, 0.05.m]); t.layer = capa.("Rótulos")')
    L += ['', 'gm = ents.add_group; gm.name = "Muros"; gm.layer = capa.("Muros")', 'me = gm.entities',
          'caja = ->(a, b, e, z0, z1, m) {',
          '  v = Geom::Vector3d.new(b[0] - a[0], b[1] - a[1], 0); return if v.length < 0.01',
          '  n = Geom::Vector3d.new(-v.y, v.x, 0); n.length = e / 2.0',
          '  q = [a.offset(n), b.offset(n), b.offset(n.reverse), a.offset(n.reverse)].map { |p| [p.x, p.y, z0] }',
          '  f = me.add_face(q); f.reverse! if f.normal.z < 0; f.pushpull(z1 - z0)',
          '  me.grep(Sketchup::Face).each { |x| x.material ||= m } }',
          'm_muro = mat.("Pintura muros", "#F3F1EC"); m_ext = mat.("Fachada", "#E6E1D8")']
    for a, b, e, tipo in muros:
        A = f'Geom::Point3d.new({a[0]:.3f}.m, {a[1]:.3f}.m, 0)'; B = f'Geom::Point3d.new({b[0]:.3f}.m, {b[1]:.3f}.m, 0)'
        m = 'm_ext' if e >= E_EXT else 'm_muro'
        if tipo == 'muro': L.append(f'caja.({A}, {B}, {e}.m, 0, ALTO, {m})')
        else: L.append(f'caja.({A}, {B}, {e}.m, ALTO_DINTEL, ALTO, {m})  # dintel sobre puerta')
    L += ['', 'gr = ents.add_group; gr.name = "Rutas (guía)"; gr.layer = capa.("Rutas")']
    for r in D['rutas']:
        L.append(f'gr.entities.add_curve({pts(r)}.map {{ |p| [p[0], p[1], 0.03.m] }})')
    for v in D['verticales']:
        L.append(f't = ents.add_text({json.dumps(v["codigo"])}, [{v["pos"][0]:.3f}.m, {v["pos"][1]:.3f}.m, 1.m]); t.layer = capa.("Rótulos")')
    for v in D['inicios']:
        L.append(f't = ents.add_text({json.dumps("QR · " + v["nombre"])}, [{v["pos"][0]:.3f}.m, {v["pos"][1]:.3f}.m, 1.m]); t.layer = capa.("Rótulos")')
    L += ['', 'model.commit_operation', 'Sketchup.active_model.active_view.zoom_extents',
          f'puts "Planta baja: {len(D["areas"])} ambientes, {sum(1 for m in muros if m[3] == "muro")} tramos de muro, {len(D["puertas"])} puertas"']
    return '\n'.join(L) + '\n'


def previa(D, muros, altura, base):
    import matplotlib; matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    from mpl_toolkits.mplot3d.art3d import Poly3DCollection
    from matplotlib.patches import Polygon
    fig, ax = plt.subplots(figsize=(10, 12))
    for a in D['areas']:
        ax.add_patch(Polygon(a['poligono'], fc=COLORES.get(a['cat'], '#ddd'), ec='none'))
        cx = sum(p[0] for p in a['poligono']) / len(a['poligono']); cy = sum(p[1] for p in a['poligono']) / len(a['poligono'])
        ax.text(cx, cy, a['nombre'].replace(' - ', '\n'), ha='center', va='center', fontsize=5, color='#26303C')
    for a, b, e, t in muros:
        if t == 'muro': ax.plot([a[0], b[0]], [a[1], b[1]], color='#4A5562', lw=e * 18, solid_capstyle='butt')
    for r in D['rutas']:
        ax.plot([p[0] for p in r], [p[1] for p in r], color='#2F5BEA', lw=1.5, ls='--')
    for p in D['puertas']: ax.plot(*p, 'o', color='#E2533D', ms=5)
    for v in D['inicios']: ax.annotate('QR ' + v['nombre'], v['pos'], fontsize=8, color='#1E9E8B', weight='bold')
    ax.set_aspect('equal'); ax.autoscale(); ax.margins(0.06); ax.set_title('Planta baja · lectura del DXF (m)')
    fig.tight_layout(); fig.savefig(base + '_planta.png', dpi=130); plt.close(fig)
    fig = plt.figure(figsize=(9, 6.5)); ax = fig.add_subplot(111, projection='3d')
    caras = []; colores = []
    for a in D['areas']:
        caras.append([(x, y, 0) for x, y in a['poligono']]); colores.append(COLORES.get(a['cat'], '#ddd'))
    for a, b, e, t in muros:
        z0 = 0 if t == 'muro' else 2.1
        caras.append([(a[0], a[1], z0), (b[0], b[1], z0), (b[0], b[1], altura), (a[0], a[1], altura)])
        colores.append('#E6E1D8' if e >= E_EXT else '#F3F1EC')
    ax.add_collection3d(Poly3DCollection(caras, facecolors=colores, edgecolors='#8D98A6', linewidths=0.4))
    xs = [p[0] for c in caras for p in c]; ys = [p[1] for c in caras for p in c]
    ax.set_xlim(min(xs), max(xs)); ax.set_ylim(min(ys), max(ys)); ax.set_zlim(0, max(max(xs) - min(xs), max(ys) - min(ys)) * 0.6)
    ax.view_init(38, -60); ax.set_axis_off(); ax.set_title('Vista 3D previa (lo que generará SketchUp)')
    fig.tight_layout(); fig.savefig(base + '_3d.png', dpi=130); plt.close(fig)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('dxf'); ap.add_argument('salida'); ap.add_argument('--altura', type=float, default=3.0)
    a = ap.parse_args()
    D = leer(a.dxf)
    muros = cortar_puertas(segmentos(D), D['puertas'] + [(v['pos'], 2.4) for v in D['inicios']])
    Path(a.salida).parent.mkdir(parents=True, exist_ok=True)
    Path(a.salida + '.rb').write_text(ruby(D, muros, a.altura), encoding='utf-8')
    Path(a.salida + '.json').write_text(json.dumps({**D, 'muros_3d': muros, 'altura': a.altura}, ensure_ascii=False, indent=1), encoding='utf-8')
    previa(D, muros, a.altura, a.salida)
    print(f'escala {D["escala_m"]} m/unidad · {len(D["areas"])} áreas · {sum(1 for m in muros if m[3] == "muro")} muros · '
          f'{len(D["puertas"])} puertas · {len(D["rutas"])} rutas · {len(D["verticales"])} verticales · {len(D["inicios"])} QR')

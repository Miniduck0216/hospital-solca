"""
Planta baja completa: la planta baja que ya usaba la web (consulta externa, hall de cajas, farmacia…, ajustada a mano
y con las líneas verdes de pacientes) más lo que faltaba del DWG del edificio (laboratorio, imagen, quirófanos,
emergencia, hospitalización, morgue…).

- Lo viejo se deja tal cual, con sus ids (a0…a106): OM3 y los enlaces guardados los usan.
- De lo nuevo se toma solo lo que queda fuera de la huella vieja; sus ambientes siguen la numeración (a107…).
- La rejilla de navegación se arma en la misma cuadrícula de la vieja (x0 = 1, y0 = -1, 0,25 m): dentro de la huella
  vieja manda la vieja; afuera, la nueva. La vereda exterior se recalcula alrededor de la huella completa.
Uso: python3 planta_real/pisos/unir_pb.py   (lee planta_real/pisos/pb_vieja.json y /tmp/pb_nueva.json)
"""
import os
import sys
import json
import math
import base64
import numpy as np
import cv2
from scipy import ndimage
from shapely.geometry import Polygon, Point, LineString, MultiPolygon
from shapely.ops import unary_union

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, '..', '..'))
VIEJA = os.path.join(AQUI, 'pb_vieja.json')
NUEVA = '/tmp/pb_nueva.json'
SALIDA = os.path.join(RAIZ, 'public', 'pb', 'datos.json')

# Zonas de la planta vieja que se rehacen con el DWG 2025: el plano viejo no traía sus tabiques (la dirección era un
# solo espacio, la farmacia también). Dentro de cada zona mandan los muros, ventanas, puertas y muebles del DWG; los
# cuartos salen de esos muros (cortados en cada puerta) y se nombran con los rótulos del plano. Cada id viejo de la
# zona sigue existiendo (OM3 los usa): pasa al cuarto que contiene su punto. Los demás cuartos llevan ids nuevos.
#   zona: ids viejos cuya unión forma la zona
#   cuartos: (id viejo o None, nombre, punto del rótulo, opciones)   opciones: cat, paso
#   cortes: (polígono) divisiones que el dibujo no tiene como muro (el mesón que separa espera y secretaría)
REHACER = [
    dict(nombre='Dirección y administración', zona=['a0', 'a50', 'a59'],
         cortes=[[(52.0, 37.45), (58.5, 37.45), (58.5, 41.0), (52.0, 41.0)],        # espera / secretaría (mesón)
                 [(52.45, 33.35), (58.5, 33.35), (58.5, 37.45), (52.45, 37.45)],    # secretaría / pasillo
                 [(54.3, 13.0), (57.72, 13.0), (57.72, 18.3), (54.3, 18.3)],        # gerencia proyectos (tabique)
                 [(70.1, 13.0), (74.1, 13.0), (74.1, 15.95), (70.1, 15.95)],        # oficina del financiero
                 [(59.25, 23.75), (63.1, 23.75), (63.1, 26.3), (59.25, 26.3)],      # S.H. M. (sus cubículos)
                 [(52.45, 19.55), (54.35, 19.55), (54.35, 22.45), (52.45, 22.45)]],  # café
         cuartos=[('a0', 'Administración', (51.7, 23.2), dict(cat='circulacion', paso=True)),
                  ('a50', 'Espera Dirección', (54.3, 38.9), dict(cat='espera')),
                  ('a59', 'Secretaría', (55.0, 35.0), {}),
                  (None, 'Presidencia', (45.7, 39.25), {}),
                  (None, 'Dirección Médica', (45.8, 31.4), {}),
                  (None, 'Secretaría Dirección Administrativa Financiera', (45.9, 29.9), {}),
                  (None, 'Dirección Administrativa Financiera', (53.6, 29.8), {}),
                  (None, 'Jefatura Financiera', (45.8, 24.5), {}),
                  (None, 'Sala de Consejo', (45.8, 21.0), {}),
                  (None, 'S.H. H.', (53.4, 25.4), dict(cat='banos')),
                  (None, 'S.H. H.', (56.1, 25.4), dict(cat='banos')),
                  (None, 'Aseo', (57.9, 25.4), {}),
                  (None, 'S.H. M.', (61.0, 25.0), dict(cat='banos')),
                  (None, 'Café', (53.4, 21.0), {}),
                  (None, 'Gerencia Comercial · Comunicación RRPP', (58.5, 21.6), {}),   # un espacio, dos rótulos
                  (None, 'Asesoría Jurídica', (60.5, 15.0), {}),
                  (None, 'Sala de Comisiones', (51.6, 15.3), {}),
                  (None, 'Gerencia Proyectos', (55.0, 15.5), {}),
                  (None, 'Auditoría Médica', (66.0, 14.5), {}),
                  (None, 'Jefatura Enfermería', (67.1, 17.7), {}),
                  (None, 'Oficina', (72.0, 14.5), {}),
                  (None, 'Financiero', (72.7, 20.2), {})]),   # el tragaluz queda sin piso (exportar_piso.EXTERIOR)
    dict(nombre='Farmacia', zona=['a4', 'a18', 'a81'], modo='muros',
         cortes=[[(57.5, 63.85), (61.25, 63.85), (61.25, 65.95), (57.5, 65.95)],   # atención farmacéutica (tabique con puerta)
                 [(77.25, 67.1), (79.95, 67.1), (79.95, 69.55), (77.25, 69.55)],    # cuarto UPS
                 [(65.1, 69.65), (69.3, 69.65), (69.3, 72.3), (65.1, 72.3)]],       # quimioterápicos
         cuartos=[('a4', 'Farmacia', [(67.78, 61.23), (75.0, 70.0)], {}),
                  ('a18', 'Agendamiento', (58.94, 70.84), {}),
                  (None, 'Atención Farmacéutica', (57.98, 66.6), {}),
                  ('a81', 'Atención Farmacéutica', (58.08, 64.3), {}),
                  (None, 'Sala Reuniones', (61.86, 71.04), {}),
                  (None, 'Quimioterápicos', (66.0, 71.5), {}),
                  (None, 'Nutrición Parental', (67.8, 68.8), {}),
                  (None, 'Cuarto UPS', (78.5, 68.6), {})]),
]


def pgs(lista):
    """[[anillo, huecos…], …] -> MultiPolygon"""
    out = []
    for pg in lista:
        try:
            q = Polygon(pg[0], pg[1:]).buffer(0)
        except Exception:
            continue
        if not q.is_empty:
            out.extend(q.geoms if isinstance(q, MultiPolygon) else [q])
    return unary_union(out)


def a_lista(g, min_area=0.002):
    out = []
    for q in (g.geoms if hasattr(g, 'geoms') else [g]):
        if q.is_empty or q.geom_type != 'Polygon' or q.area < min_area:
            continue
        out.append([[[round(x, 2), round(y, 2)] for x, y in q.exterior.coords]] +
                   [[[round(x, 2), round(y, 2)] for x, y in h.coords] for h in q.interiors])
    return out


def decodificar(nav, k, dtype=np.uint8):
    b = base64.b64decode(nav[k])
    if k == 'cuarto' and nav.get('cuartoBits') == 16:
        dtype = np.uint16
    return np.frombuffer(b, dtype).reshape(nav['h'], nav['w'])


def zona_rehecha(amb, z):
    idx = {a['id']: a for a in amb}
    zona = unary_union([Polygon(idx[i]['pg'][0], idx[i]['pg'][1:]).buffer(0) for i in z['zona']])
    return zona.buffer(0.4, join_style=2).buffer(-0.2, join_style=2)   # con sus muros


def zonas_rehechas():
    """Unión de las zonas de REHACER (marco de la web), para el 3D: ahí manda el modelo nuevo."""
    v = json.load(open(VIEJA))
    return unary_union([zona_rehecha(v['ambientes'], z) for z in REHACER])


def rehacer(amb, n, geo, capas, gx0, gy0, RES):
    """Rehace las zonas de REHACER con el DWG 2025 (ver arriba). geo: listas de muros, ventanas, puertas, muebles y
    trazos de la unión (se cambian en su lugar); capas: rejilla unida (celdas, cuarto, red)."""
    from shapely.geometry import box
    from shapely.ops import polylabel
    H, W = capas['celdas'].shape
    idx = {a['id']: k for k, a in enumerate(amb)}

    def ras(geoms, dil=0.0):
        img = np.zeros((H, W), np.uint8)
        for g in geoms:
            g = g.buffer(dil, join_style=2) if dil else g
            for q in (g.geoms if hasattr(g, 'geoms') else [g]):
                if q.is_empty or q.geom_type != 'Polygon':
                    continue
                cv2.fillPoly(img, [np.array([[(x - gx0) / RES, (y - gy0) / RES] for x, y in q.exterior.coords], np.int32)], 1)
                for h_ in q.interiors:
                    cv2.fillPoly(img, [np.array([[(x - gx0) / RES, (y - gy0) / RES] for x, y in h_.coords], np.int32)], 0)
        return img > 0
    muros_n, vent_n = pgs(n['muros']), pgs(n['ventanas'])
    for z in REHACER:
        zona = zona_rehecha(amb, z)
        dentro = lambda p: zona.contains(Point(p))  # noqa: E731
        # geometría: lo viejo fuera de la zona, lo nuevo dentro
        geo['muros'][:] = a_lista(pgs(geo['muros']).difference(zona).union(muros_n.intersection(zona)).buffer(0))
        geo['ventanas'][:] = a_lista(pgs(geo['ventanas']).difference(zona).union(vent_n.intersection(zona)).buffer(0))
        mid = lambda p: ((p['a'][0] + p['b'][0]) / 2, (p['a'][1] + p['b'][1]) / 2)  # noqa: E731
        puertas_z = [p for p in n['puertas'] if dentro(mid(p))]
        geo['puertas'][:] = [p for p in geo['puertas'] if not dentro(mid(p))] + puertas_z
        cen = lambda pg: Polygon(pg[0]).centroid  # noqa: E731
        muebles_z = [mu for mu in n['muebles'] if zona.contains(cen(mu['pg']))]
        geo['muebles'][:] = [mu for mu in geo['muebles'] if not zona.contains(cen(mu['pg']))] + muebles_z
        for k in ('trazos', 'trazos_puertas'):
            geo[k][:] = [t for t in geo[k] if len(t) < 2 or not zona.contains(LineString(t).centroid)] + \
                        [t for t in n[k] if len(t) >= 2 and zona.contains(LineString(t).centroid)]
        # cuartos: los del DWG dentro de la zona (sus muros y puertas ya los separan), divididos por los cortes
        duro = unary_union([muros_n.intersection(zona), vent_n.intersection(zona)])
        piezas = []
        if z.get('modo') == 'muros':
            # el DWG no cierra estos cuartos: el piso libre entre sus muros, cerrado en cada puerta
            def hoja(p):
                a_, b_ = np.array(p['a'], float), np.array(p['b'], float)
                d_ = (b_ - a_) / (np.linalg.norm(b_ - a_) or 1)
                return LineString([tuple(a_ - d_ * 0.3), tuple(b_ + d_ * 0.3)]).buffer(0.06, cap_style=2)
            hojas = unary_union([hoja(p) for p in puertas_z]) if puertas_z else Polygon()
            libre = zona.buffer(-0.2, join_style=2).difference(duro.buffer(0.02)).difference(hojas)
            for r in (libre.geoms if hasattr(libre, 'geoms') else [libre]):
                if r.area > 0.3:
                    piezas.append((r, '', 'otro', -1 - len(piezas)))
        for ia, a in enumerate([] if z.get('modo') == 'muros' else n['ambientes']):
            if not a['pg']:
                continue
            q = Polygon(a['pg'][0], a['pg'][1:]).buffer(0).intersection(zona)
            for r in (q.geoms if hasattr(q, 'geoms') else [q]):
                if r.geom_type == 'Polygon' and r.area > 0.3:
                    piezas.append((r, a['nombre'], a.get('cat', 'otro'), ia))
        for c in z['cortes']:
            c = Polygon(c)
            nuevas = []
            for q, nom, cat, src in piezas:
                partes = [q] if q.intersection(c).area < 0.3 else [q.intersection(c), q.difference(c)]
                for p_ in partes:
                    for r in (p_.geoms if hasattr(p_, 'geoms') else [p_]):
                        if r.geom_type == 'Polygon' and r.area > 0.3:
                            nuevas.append((r, nom, cat, src))
            piezas = nuevas
        if os.environ.get('VER_ZONA') == z['nombre']:   # revisión: piezas, rótulos, muros y puertas de la zona
            import matplotlib
            matplotlib.use('Agg')
            import matplotlib.pyplot as plt
            from matplotlib.patches import Polygon as MP
            fig, ax = plt.subplots(figsize=(16, 16))
            for k, (q, nom, *_) in enumerate(piezas):
                ax.add_patch(MP(list(q.exterior.coords), fc=plt.cm.tab20(k % 20), alpha=.5))
                c = q.representative_point()
                ax.text(c.x, c.y, f'{k} {nom}', fontsize=7)
            for g in (duro.geoms if hasattr(duro, 'geoms') else [duro]):
                if g.geom_type == 'Polygon':
                    ax.add_patch(MP(list(g.exterior.coords), fc='r', alpha=.8))
            for p in puertas_z:
                ax.plot([p['a'][0], p['b'][0]], [p['a'][1], p['b'][1]], 'g-', lw=3)
            for _, nom, pto, _ in z['cuartos']:
                for pt in (pto if isinstance(pto[0], (list, tuple)) else [pto]):
                    ax.plot(*pt, 'k*')
                    ax.text(pt[0], pt[1] - 0.3, nom, fontsize=7, color='b')
            for k, (q, nom, cat, src) in enumerate(piezas):
                print('   pieza', k, nom, src, round(q.area, 1), [round(v, 1) for v in q.bounds])
            x0_, y0_, x1_, y1_ = zona.bounds
            ax.set_xlim(x0_ - 1, x1_ + 1)
            ax.set_ylim(y0_ - 1, y1_ + 1)
            ax.set_aspect('equal')
            ax.grid(alpha=.3)
            plt.savefig(os.environ.get('VER_SALIDA', '/tmp/zona.png'), dpi=70)
        usadas = set()
        nuevos = []
        for vid, nombre, pto, op in z['cuartos']:
            ks = []
            for pt in (pto if isinstance(pto[0], (list, tuple)) else [pto]):
                k = next((k for k, (q, *_) in enumerate(piezas) if q.buffer(0.05).contains(Point(pt)) and k not in usadas), None)
                if k is None:
                    print('  REHACER: sin cuarto para', nombre, pt)
                    continue
                usadas.add(k)
                ks.append(k)
            if ks:
                q = unary_union([piezas[k][0].buffer(0.25, join_style=2) for k in ks]).buffer(-0.25, join_style=2)
                nuevos.append((vid, nombre, q, op, piezas[ks[0]][3]))
        # piezas sin rótulo en la lista: si vienen del mismo cuarto del DWG que una ya nombrada (resto de un corte),
        # se le suman; si no, quedan con el nombre que les da el DWG
        for k, (q, nom, cat, src) in enumerate(piezas):
            if k in usadas:
                continue
            j = next((j for j, t in enumerate(nuevos) if t[4] == src and t[2].buffer(0.05).intersects(q)), None) \
                if q.area < 3 else None
            if j is not None:
                vid, nn_, r, op, s_ = nuevos[j]
                nuevos[j] = (vid, nn_, unary_union([r, q.buffer(0.03)]).buffer(-0.03), op, s_)
            else:
                nuevos.append((None, nom, q, {'cat': cat} if nom else {}, src))
        nuevos = [t[:4] for t in nuevos]
        # ambientes: los ids viejos de la zona toman su cuarto; los demás se agregan al final
        sobran = set(z['zona']) - {vid for vid, *_ in nuevos if vid}
        if sobran:
            raise SystemExit(f'REHACER {z["nombre"]}: ids viejos sin cuarto {sorted(sobran)}')
        for vid, nombre, q, op in nuevos:
            if hasattr(q, 'geoms'):
                q = max(q.geoms, key=lambda g: g.area)
            try:
                lb = polylabel(q, tolerance=0.05)
            except Exception:
                lb = q.representative_point()
            a = dict(nombre=nombre, original=nombre.upper(), cat=op.get('cat', 'otro' if not nombre else 'administracion'),
                     icono=None, area=round(q.area, 2), pg=a_lista(q)[0], lbl=[round(lb.x, 2), round(lb.y, 2)])
            if nombre and 'cat' not in op:
                sys.path.insert(0, os.path.join(RAIZ, 'planta_real', 'web'))
                sys.path.insert(0, os.path.join(RAIZ, 'planta_real', 'revit'))
                from exportar_datos import categoria_web, icono
                a['cat'] = categoria_web(nombre.upper())
                a['icono'] = icono(nombre.upper())
            elif op.get('cat') == 'banos':
                a['icono'] = 'bano'
            if op.get('paso'):
                a['paso'] = True
            if vid:
                viejo = amb[idx[vid]]
                a = dict(viejo, **{k: v for k, v in a.items()})
                a['id'] = vid
                amb[idx[vid]] = a
            else:
                a['id'] = f'a{len(amb)}'
                idx[a['id']] = len(amb)
                amb.append(a)
            a['_q'] = q
        # rejilla dentro de la zona: igual que exportar_piso (interior sin obstáculos, puertas pasables)
        zr = ras([zona])
        cuartos_z = [a for a in amb if '_q' in a]
        interior = ras([a['_q'] for a in cuartos_z])
        obst = ras([duro] + [Polygon(mu['pg'][0]) for mu in muebles_z])
        libre_r = interior & ~ndimage.binary_dilation(obst, iterations=1)
        vanos = []
        for p in puertas_z:
            a_, b_ = np.array(p['a']), np.array(p['b'])
            d_ = (b_ - a_) / (np.linalg.norm(b_ - a_) or 1)
            nr = np.array([-d_[1], d_[0]])
            vanos.append(Polygon([tuple(a_ + d_ * 0.12 - nr * 0.6), tuple(b_ - d_ * 0.12 - nr * 0.6),
                                  tuple(b_ - d_ * 0.12 + nr * 0.6), tuple(a_ + d_ * 0.12 + nr * 0.6)]))
        if vanos:
            libre_r |= ras(vanos) & ~ras([duro.buffer(-0.05)]) & (interior | ras(vanos))
        cel = capas['celdas']
        libre_tot = np.where(zr, libre_r, cel > 0)
        dist = ndimage.distance_transform_edt(libre_tot) * RES
        costo = np.clip(np.round((0.9 - np.minimum(dist, 0.9)) / 0.9 * 6), 0, 6).astype(np.uint8)
        cel[zr] = np.where(libre_r[zr], costo[zr] + 1, 0)
        capas['red'][zr & ~libre_r] = 0
        cu = capas['cuarto']
        cu[zr] = 0
        for a in sorted(cuartos_z, key=lambda a: -a['area']):
            msk = ras([a['_q'].buffer(0.15)]) & zr
            cu[msk] = idx[a['id']] + 1
        for a in cuartos_z:
            q = a.pop('_q')
            msk = ras([q.buffer(-0.05)]) & libre_r
            if not msk.any():
                msk = ras([q.buffer(0.6)]) & libre_r
            if msk.any():
                fy, fx = np.indices(msk.shape)
                lx, ly = (a['lbl'][0] - gx0) / RES, (a['lbl'][1] - gy0) / RES
                sc = np.where(msk, np.minimum(dist, 0.8) * 4 - np.hypot(fx - lx, fy - ly) * RES * 0.15, -1e9)
                iy, ix = np.unravel_index(np.argmax(sc), sc.shape)
                a['dest'] = [round(gx0 + ix * RES, 2), round(gy0 + iy * RES, 2)]
            else:
                a['dest'] = None
        print('rehecha', z['nombre'], len(cuartos_z), 'cuartos', len(puertas_z), 'puertas')


def main():
    v = json.load(open(VIEJA))
    n = json.load(open(NUEVA))
    hv = pgs(v['huella'])
    zona_v = hv.buffer(0.3, join_style=2)
    fuera = lambda g, frac=0.6: g.difference(zona_v).area >= frac * g.area  # noqa: E731

    # ------------------------------------------------ ambientes nuevos (fuera de la huella vieja)
    amb = [dict(a) for a in v['ambientes']]
    mapa_ids = {}   # índice de cuarto en la rejilla nueva (1…) -> índice en la unida
    for k, a in enumerate(n['ambientes']):
        if not a['pg']:
            continue
        pg = Polygon(a['pg'][0], a['pg'][1:]).buffer(0)
        if pg.is_empty or not fuera(pg):
            continue
        resto = pg.difference(zona_v)
        partes = a_lista(resto.buffer(0), 0.5)
        if not partes:
            continue
        b = dict(a)
        b['id'] = f'a{len(amb)}'
        b['pg'] = max(partes, key=lambda p: Polygon(p[0]).area)
        b['area'] = round(resto.area, 2)
        if b.get('lbl') and not resto.buffer(0.05).contains(Point(b['lbl'])):
            rp = resto.representative_point()
            b['lbl'] = [round(rp.x, 2), round(rp.y, 2)]
        if b.get('dest') and not resto.buffer(0.6).contains(Point(b['dest'])):
            b['dest'] = None
        mapa_ids[k + 1] = len(amb) + 1
        amb.append(b)
    print('ambientes: viejos', len(v['ambientes']), 'nuevos', len(amb) - len(v['ambientes']))

    # ------------------------------------------------ geometría
    hn = pgs(n['huella'])
    huella = unary_union([hv, hn]).buffer(0.05, join_style=2).buffer(-0.05, join_style=2)

    def sumar(k, simp=None):
        nuevos = pgs(n[k]).difference(zona_v) if n[k] else Polygon()
        return v[k] + a_lista(nuevos)

    def trazos(k):
        out = list(v[k])
        for t in n[k]:
            ls = LineString(t) if len(t) >= 2 else None
            if ls is not None and not zona_v.contains(ls.centroid):
                out.append(t)
        return out
    puertas = list(v['puertas']) + [p for p in n['puertas']
                                    if not zona_v.contains(Point((p['a'][0] + p['b'][0]) / 2, (p['a'][1] + p['b'][1]) / 2))]
    muebles = list(v['muebles']) + [mu for mu in n['muebles'] if not zona_v.contains(Polygon(mu['pg'][0]).centroid)]
    entradas = list(v['entradas'])
    usados = {e['nombre'] for e in entradas}
    k = len([e for e in entradas if e['nombre'].startswith('Acceso')])
    for e in n['entradas']:
        if zona_v.buffer(1.0).contains(Point(e['x'], e['y'])):
            continue
        if any(math.dist((e['x'], e['y']), (o['x'], o['y'])) < 4 for o in entradas):
            continue
        e = dict(e)
        if e['nombre'].startswith('Acceso') or e['nombre'] in usados:
            k += 1
            e['nombre'] = f'Acceso {k}'
        e['id'] = 'entrada-' + e['nombre'].lower().replace(' ', '-')
        usados.add(e['nombre'])
        entradas.append(e)

    # ------------------------------------------------ rejilla unida (cuadrícula de la vieja)
    nv, nn = v['nav'], n['nav']
    RES = nv['res']
    x0, y0 = nv['x0'], nv['y0']
    bx0, by0, bx1, by1 = huella.bounds
    gx0 = x0 - math.ceil((x0 - (bx0 - 3)) / RES) * RES if bx0 - 3 < x0 else x0
    gy0 = y0 - math.ceil((y0 - (by0 - 3)) / RES) * RES if by0 - 3 < y0 else y0
    W = int(math.ceil((bx1 + 3 - gx0) / RES)) + 1
    H = int(math.ceil((by1 + 3 - gy0) / RES)) + 1
    W = max(W, int(round((x0 - gx0) / RES)) + nv['w'])
    H = max(H, int(round((y0 - gy0) / RES)) + nv['h'])
    capas = {}
    for k_ in ('celdas', 'cuarto', 'red', 'vereda'):
        capas[k_] = np.zeros((H, W), np.uint16 if k_ == 'cuarto' else np.uint8)
    # nueva (remuestreo al vecino más cercano)
    ys, xs = np.mgrid[0:H, 0:W]
    cx, cy = gx0 + xs * RES, gy0 + ys * RES
    ix = np.round((cx - nn['x0']) / RES).astype(int)
    iy = np.round((cy - nn['y0']) / RES).astype(int)
    ok = (ix >= 0) & (iy >= 0) & (ix < nn['w']) & (iy < nn['h'])
    for k_ in capas:
        src = decodificar(nn, k_)
        val = np.zeros((H, W), src.dtype)
        val[ok] = src[iy[ok], ix[ok]]
        if k_ == 'cuarto':
            lut = np.zeros(int(src.max()) + 1, np.uint16)
            for a_, b_ in mapa_ids.items():
                if a_ < len(lut):
                    lut[a_] = b_
            val = lut[val]
        capas[k_][:] = val
    # vieja: manda dentro de su huella (rasterizada en la cuadrícula unida)
    def ras(g):
        img = np.zeros((H, W), np.uint8)
        for q in (g.geoms if hasattr(g, 'geoms') else [g]):
            cv2.fillPoly(img, [np.array([[(x - gx0) / RES, (y - gy0) / RES] for x, y in q.exterior.coords], np.int32)], 1)
        return img > 0
    dentro_v = ras(hv.buffer(0.15, join_style=2))
    ox, oy = int(round((x0 - gx0) / RES)), int(round((y0 - gy0) / RES))
    for k_ in capas:
        src = decodificar(nv, k_)
        sub = capas[k_][oy:oy + nv['h'], ox:ox + nv['w']]
        msk = dentro_v[oy:oy + nv['h'], ox:ox + nv['w']]
        sub[msk] = src[msk]
        if k_ == 'celdas':
            # afuera de las dos huellas: lo que estaba libre en la vieja (veredas y accesos exteriores) sigue libre
            hn_r = ras(hn)[oy:oy + nv['h'], ox:ox + nv['w']]
            libre_v = (src > 0) & ~msk & ~hn_r
            sub[libre_v & (sub == 0)] = src[libre_v & (sub == 0)]
    # zonas viejas rehechas con el DWG 2025
    geo = dict(muros=sumar('muros'), ventanas=sumar('ventanas'), puertas=puertas, muebles=muebles,
               trazos=trazos('trazos'), trazos_puertas=trazos('trazos_puertas'))
    rehacer(amb, n, geo, capas, gx0, gy0, RES)
    # vereda: franja de 1,5 m alrededor de la huella completa (por fuera)
    hu_r = ras(huella)
    vereda = ndimage.binary_dilation(hu_r, iterations=int(round(1.5 / RES))) & ~hu_r
    capas['celdas'][vereda & (capas['celdas'] == 0)] = 2
    capas['vereda'] = vereda.astype(np.uint8)
    # la red vieja dentro de la vieja; la nueva afuera (ya está por el remuestreo)
    libres = capas['celdas'] > 0
    et, nc = ndimage.label(libres, structure=np.ones((3, 3)))
    if nc > 1:
        tam = ndimage.sum(np.ones_like(et), et, index=np.arange(1, nc + 1))
        libres = et == 1 + int(np.argmax(tam))
        capas['celdas'][~libres] = 0
    bits = 16 if len(amb) > 255 else 8
    cuarto = capas['cuarto'].astype('<u2' if bits == 16 else np.uint8)
    nav = dict(x0=round(gx0, 3), y0=round(gy0, 3), res=RES, w=W, h=H,
               celdas=base64.b64encode(capas['celdas'].tobytes()).decode(),
               cuarto=base64.b64encode(cuarto.tobytes()).decode(),
               red=base64.b64encode((capas['red'] > 0).astype(np.uint8).tobytes()).decode(),
               vereda=base64.b64encode(capas['vereda'].tobytes()).decode())
    if bits == 16:
        nav['cuartoBits'] = 16
    d = dict(v)
    d.update(nombre='Hospital SOLCA Quito · Planta baja',
             fuente='Plano de la planta baja (planos_entrada.dwg) + planos actualizados 2025 del edificio (resto de la planta)',
             huella=a_lista(huella, 1.0), ambientes=amb,
             muros=geo['muros'], ventanas=geo['ventanas'], puertas=geo['puertas'],
             trazos_puertas=geo['trazos_puertas'], trazos=geo['trazos'], muebles=geo['muebles'],
             gradas=list(v['gradas']) + [g for g in n['gradas'] if not zona_v.contains(LineString(g).centroid)],
             entradas=entradas, nav=nav)
    with open(SALIDA, 'w') as f:
        json.dump(d, f, ensure_ascii=False, separators=(',', ':'))
    print('PB unida', SALIDA, round(os.path.getsize(SALIDA) / 1e6, 2), 'MB', len(amb), 'ambientes', len(entradas), 'entradas',
          'rejilla', W, 'x', H, 'cuarto', bits, 'bits')


if __name__ == '__main__':
    main()

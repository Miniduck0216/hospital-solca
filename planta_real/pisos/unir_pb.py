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
             muros=sumar('muros'), ventanas=sumar('ventanas'), puertas=puertas,
             trazos_puertas=trazos('trazos_puertas'), trazos=trazos('trazos'), muebles=muebles,
             gradas=list(v['gradas']) + [g for g in n['gradas'] if not zona_v.contains(LineString(g).centroid)],
             entradas=entradas, nav=nav)
    with open(SALIDA, 'w') as f:
        json.dump(d, f, ensure_ascii=False, separators=(',', ':'))
    print('PB unida', SALIDA, round(os.path.getsize(SALIDA) / 1e6, 2), 'MB', len(amb), 'ambientes', len(entradas), 'entradas',
          'rejilla', W, 'x', H, 'cuarto', bits, 'bits')


if __name__ == '__main__':
    main()

"""Techos del edificio para el 3D: la parte de cada piso que no tapa ningún piso de arriba (azotea), con sus
patios y tragaluces abiertos. Escribe public/techos.json: { piso: [[anillo, huecos...], ...] }.
Uso: python3 planta_real/pisos/techos.py"""
import os
import json
from shapely.geometry import Polygon, MultiPolygon
from shapely.ops import unary_union

AQUI = os.path.dirname(os.path.abspath(__file__))
PUB = os.path.join(AQUI, '..', '..', 'public')


def huella(piso):
    d = json.load(open(os.path.join(PUB, piso['datos'])))
    return unary_union([Polygon(pg[0], pg[1:]).buffer(0) for pg in d['huella'] if len(pg[0]) > 2])


def main():
    ed = json.load(open(os.path.join(PUB, 'edificio.json')))
    pisos = sorted([p for p in ed['pisos'] if p.get('disponible')], key=lambda p: p['nivel'])
    hs = {p['id']: huella(p) for p in pisos}
    out = {}
    for i, p in enumerate(pisos):
        arriba = unary_union([hs[q['id']] for q in pisos[i + 1:]]) if i + 1 < len(pisos) else None
        t = hs[p['id']] if arriba is None else hs[p['id']].difference(arriba.buffer(0.05, join_style=2))
        t = t.buffer(-0.02, join_style=2).buffer(0.02, join_style=2).simplify(0.03)
        partes = [t] if isinstance(t, Polygon) else list(getattr(t, 'geoms', []))
        out[p['id']] = [[[[round(x, 2), round(y, 2)] for x, y in q.exterior.coords]] +
                        [[[round(x, 2), round(y, 2)] for x, y in h.coords] for h in q.interiors]
                        for q in partes if q.area > 1.0]
        print(p['id'], 'techo', round(sum(q.area for q in partes), 1), 'm²', len(out[p['id']]), 'partes')
    json.dump(out, open(os.path.join(PUB, 'techos.json'), 'w'), separators=(',', ':'))


if __name__ == '__main__':
    main()

"""
Conectores verticales del edificio (public/edificio.json): ascensores y escaleras con su parada en cada piso.
Los pisos comparten el marco de la planta baja, así que un mismo ascensor cae en el mismo lugar en todos: se agrupan
los ambientes de categoría «ascensores» o «escaleras» de cada piso cuyo rótulo queda a menos de 1,6 m.
Se conservan el id y el nombre de los conectores que ya estaban (por su parada en la planta baja) y los datos a mano
(nombre, personal) de cada conector en NOMBRES.
Uso: python3 planta_real/pisos/conectores.py
"""
import json
import math
import os
from shapely.geometry import Polygon, Point

RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
EDIF = os.path.join(RAIZ, 'public', 'edificio.json')
PISOS = ['SB', 'PB', 'P1', 'P2', 'P3']
NIVEL = {'SB': -1, 'PB': 0, 'P1': 1, 'P2': 2, 'P3': 3}
NOMBRE_PISO = {'SB': 'Subsuelo 1', 'PB': 'Planta baja', 'P1': 'Piso 1', 'P2': 'Piso 2', 'P3': 'Piso 3'}
# nombres por posición (centro aproximado en el marco de la planta baja)
NOMBRES = [
    ((78.8, 49.1), dict(id='ascensores-hall', nombre='Ascensores del Hall')),
    ((78.8, 51.6), dict(id='ascensores-norte', nombre='Ascensores norte')),
    ((78.8, 56.1), dict(id='escalera-central', nombre='Escalera del Hall')),
    ((49.3, 94.8), dict(id='ascensor-servicio', nombre='Ascensor del Bloque A')),
    ((48.5, 92.6), dict(id='escalera-norte', nombre='Escalera del Bloque A')),
    ((70.6, 105.8), dict(id='escalera-emergencia', nombre='Gradas de emergencia')),
    ((85.8, 44.8), dict(id='ascensores-servicio-1', nombre='Ascensores de servicio', personal=True)),
    ((88.65, 44.8), dict(id='ascensores-servicio-2', nombre='Ascensores de servicio', personal=True)),
]


def main():
    edif = json.load(open(EDIF))
    grupos = []   # dict(tipo, x, y, paradas={piso: ambiente})
    for piso in PISOS:
        ruta = os.path.join(RAIZ, 'public', piso.lower(), 'datos.json')
        if not os.path.exists(ruta):
            continue
        d = json.load(open(ruta))
        for a in d['ambientes']:
            if a['cat'] not in ('ascensores', 'escaleras') or not a.get('dest'):
                continue
            tipo = 'ascensor' if a['cat'] == 'ascensores' else 'escalera'
            x, y = a['lbl']
            pg = Polygon(a['pg'][0]).buffer(0) if a['pg'] else Point(x, y).buffer(1)

            def mismo(g):
                inter = g['pg'].intersection(pg).area
                return inter > 0.3 * min(g['pg'].area, pg.area) or math.dist((g['x'], g['y']), (x, y)) < 1.6
            g = next((g for g in grupos if g['tipo'] == tipo and piso not in g['paradas'] and mismo(g)), None)
            if g is None:
                g = dict(tipo=tipo, x=x, y=y, paradas={}, pg=pg)
                grupos.append(g)
            g['paradas'][piso] = a['id']
    conectores = []
    usados = set()
    for g in sorted(grupos, key=lambda g: (g['tipo'], g['x'], g['y'])):
        if len(g['paradas']) < 2:
            continue   # no une pisos (un montacargas de un solo piso, una escalera interna)
        info = next((dict(i) for (px, py), i in NOMBRES if i['id'].startswith(g['tipo']) and i['id'] not in usados and
                     (math.dist((px, py), (g['x'], g['y'])) < 2.5 or g['pg'].buffer(0.5).contains(Point(px, py)))), None)
        if info is None or info['id'] in usados:
            k = sum(1 for c in conectores if c['tipo'] == g['tipo']) + 1
            info = dict(id=f"{g['tipo']}-{k}", nombre='Ascensor' if g['tipo'] == 'ascensor' else 'Escalera')
        usados.add(info['id'])
        c = dict(id=info['id'], tipo=g['tipo'], nombre=info['nombre'], accesible=g['tipo'] == 'ascensor',
                 paradas=[dict(piso=p, ambiente=g['paradas'][p]) for p in PISOS if p in g['paradas']])
        if info.get('personal'):
            c['personal'] = True
        conectores.append(c)
    for p in edif['pisos']:
        ruta = os.path.join(RAIZ, 'public', p['id'].lower(), 'datos.json')
        if os.path.exists(ruta):
            carpeta = p['id'].lower()
            # el 3D puede venir en partes (la planta baja: la de antes + la parte este nueva del plano 2025)
            glb = [f'{carpeta}/{f}' for f in sorted(os.listdir(os.path.join(RAIZ, 'public', carpeta))) if f.endswith('.glb')]
            p.update(disponible=True, datos=f'{carpeta}/datos.json', glb=glb[0] if len(glb) == 1 else glb,
                     nombre=NOMBRE_PISO[p['id']])
            if os.path.exists(os.path.join(RAIZ, 'public', carpeta, 'config.json')):
                p['config'] = f'{carpeta}/config.json'
    edif['conectores'] = conectores
    edif['nota'] = ('Pisos importados del DWG del edificio (planta_real/pisos). Conectores generados con '
                    'planta_real/pisos/conectores.py: un ascensor o escalera es el mismo si cae en el mismo lugar en '
                    'cada piso. «personal»: no se usa en rutas de pacientes.')
    with open(EDIF, 'w') as f:
        json.dump(edif, f, ensure_ascii=False, indent=1)
    for c in conectores:
        print(c['id'], c['tipo'], c['nombre'], [(p['piso'], p['ambiente']) for p in c['paradas']], 'personal' if c.get('personal') else '')


if __name__ == '__main__':
    main()

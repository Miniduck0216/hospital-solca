"""
Ajustes por piso que el dibujo no resuelve solo. Se escriben en public/<piso>/config.json → «ajustes»
(ver compilarConfig en src/pb/datos.js), con el id del ambiente y su nombre como control: si al volver a
importar el plano el id ya no tiene ese nombre, el ajuste no se aplica.
- ventanilla: se atiende por una ventanilla hacia la circulación (Información, Recepción): la ruta llega al
  frente y no entra.
- personal: cuartos internos de un servicio (oficinas detrás de cocina, baños del laboratorio...).
- cat: categoría corregida (los baños rotulados «Mujeres»).
Uso: python3 planta_real/pisos/ajustes.py   (después de exportar_piso.py, unir_pb.py y conectores.py)
"""
import json
import math
import os
from shapely.geometry import Polygon
from shapely.ops import nearest_points

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))

# (nombre, punto aproximado del rótulo, ajuste)
AJUSTES = {
    'SB': [
        ('Información', (133.2, 38.6), 'ventanilla'),
        ('Recepcion', (104.5, 29.0), 'ventanilla'),
        # baño de mujeres: el cuarto de inodoros se llega por la antesala (también rotulada «Mujeres»)
        ('Mujeres', (0, 0), {'cat': 'banos'}),
        ('Mujeres', (97.9, 51.3), 'por-antesala'),
        ('Oficina Nutricionista', (78.2, 29.0), 'personal'),
        ('Oficina Economo', (88.2, 5.9), 'personal'),
        ('Oficina', (104.5, 36.4), 'personal'),
        ('Aire Acondic.', (78.5, 3.5), 'personal'),
        ('SS.HH.', (117.4, 26.7), 'personal'),
        ('SS.HH.', (120.3, 26.7), 'personal'),
    ],
    'PB': [
        ('Vestíbulo de Ductos', (78.8, 46.0), 'personal'),
        ('Punciones', (95.2, 89.9), 'personal'),
        ('Seleccion Donantes', (105.7, 99.5), 'personal'),
        ('Baño', (129.6, 102.4), 'personal'),
        ('Baños', (97.5, 99.5), 'personal'),
    ],
    # bloque administrativo norte (hall interno, TICs, jefatura, sala de reuniones): no es de pacientes
    'P1': [('Hall Interno', (80.7, 32.8), 'personal'), ('Sala Reuniones', (82.5, 25.6), 'personal'),
           ('Jefatura', (79.0, 25.6), 'personal'),
           # escalera de emergencia del extremo oeste (rotulada «b» en el plano)
           ('B', (0.7, 92.0), {'nombre': 'Escalera de emergencia', 'cat': 'escaleras'}),
           # la habitación 17 se abre a la terraza sin puerta dibujada: queda un solo ambiente
           ('Hab. 17 · Terraza N + 3.95', (0, 0), {'nombre': 'Hab. 17'})],
}


def poligono(a):
    g = a['pg']
    if g and isinstance(g[0][0], list):
        g = g[0]
    return Polygon(g).buffer(0) if g and len(g) >= 3 else None


def frente(d, a):
    """Punto 0,6 m dentro de la circulación vecina, frente al cuarto."""
    pa = poligono(a)
    vec = []
    for b in d['ambientes']:
        if b is a or not (b.get('paso') or b['cat'] in ('circulacion', 'espera')):
            continue
        pb = poligono(b)
        if pb is not None and pb.distance(pa) < 0.5:
            # primero los pasillos y salas de espera; luego los vestíbulos que reparten
            vec.append((b['cat'] in ('circulacion', 'espera'), pb.intersection(pa.buffer(0.5)).area, pb))
    if not vec:
        return None
    pb = max(vec, key=lambda v: v[:2])[2]
    p_amb, p_circ = nearest_points(pa, pb)
    q = pb.buffer(-0.6)
    p = nearest_points(q, p_circ)[0] if not q.is_empty else p_circ
    return [round(p.x, 2), round(p.y, 2)]


def main():
    edificio = json.load(open(os.path.join(RAIZ, 'public', 'edificio.json')))
    personales = {}
    for c in edificio['conectores']:
        if c.get('personal'):
            for s in c['paradas']:
                personales.setdefault(s['piso'], []).append(s['ambiente'])
    for piso in [p['id'] for p in edificio['pisos']]:
        carpeta = os.path.join(RAIZ, 'public', piso.lower())
        d = json.load(open(os.path.join(carpeta, 'datos.json')))
        cfg_p = os.path.join(carpeta, 'config.json')
        cfg = json.load(open(cfg_p))
        aj = {}
        for nombre, (x, y), que in AJUSTES.get(piso, []):
            cand = [a for a in d['ambientes'] if a['nombre'] == nombre]
            if not cand:
                print(piso, 'no está:', nombre)
                continue
            a = min(cand, key=lambda a: math.dist(a['lbl'], (x, y))) if (x, y) != (0, 0) else None
            for a in ([a] if a else cand):
                if que == 'ventanilla':
                    p = frente(d, a)
                    if not p:
                        print(piso, 'sin circulación al lado:', nombre)
                        continue
                    aj[a['id']] = {'si': nombre, 'dest': p, 'ventanilla': True}
                elif que == 'por-antesala':
                    otra = next((b for b in cand if b is not a), None)
                    p = frente(d, otra) if otra else None
                    if p:   # la ruta llega a la puerta de la antesala, en el pasillo
                        aj[a['id']] = {'si': nombre, 'cat': 'banos', 'dest': p, 'ventanilla': True}
                elif que == 'personal':
                    aj[a['id']] = {'si': nombre, 'personal': True}
                else:
                    aj[a['id']] = {'si': nombre, **que}
        # ascensores de servicio: no son destino de pacientes
        for i in personales.get(piso, []):
            a = next(a for a in d['ambientes'] if a['id'] == i)
            aj[i] = {'si': a['nombre'], 'personal': True}
        cfg['ajustes'] = aj
        json.dump(cfg, open(cfg_p, 'w'), ensure_ascii=False, indent=1)
        print(piso, len(aj), 'ajustes')


if __name__ == '__main__':
    main()

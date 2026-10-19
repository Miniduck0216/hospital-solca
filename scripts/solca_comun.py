"""
Geometría común del Hospital SOLCA para el visor web (mapa 2D, rutas y modelo 3D).

Parte de datos/solca_datos.json (el mismo archivo que alimenta el script de Dynamo para Revit):
silueta real del edificio, retícula de 1,2 m, pasillos, núcleos de ascensores, ambientes,
muros, puertas y ventanas. Aquí se convierte todo a piezas de muro con vanos, ambientes en
rectángulos, núcleos con escalera en U y dos ascensores, y el grafo de navegación.
"""
import json, math, os, re, unicodedata
from collections import defaultdict, deque
import numpy as np

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
D = json.load(open(os.path.join(RAIZ, 'datos', 'solca_datos.json'), encoding='utf-8'))

C = D['modulo']                 # 1,2 m
HP = D['altura_piso']           # 4,5 m entre pisos
NP = len(D['pisos'])            # 5 pisos
NX, NY = D['pisos'][0]['nx'], D['pisos'][0]['ny']
ANCHO, LARGO = round(NX * C, 3), round(NY * C, 3)
TOP = HP - 0.3                  # muros hasta la cara inferior de la losa
CORTE = 2.6                     # corte de las vistas tipo maqueta
CIELO = 2.8                     # cielo raso
HALL = 1.6                      # fondo del hall de ascensores dentro de cada núcleo
CLAVE = ['pb', 'p1', 'p2', 'p3', 'p4'][:NP]
NOMBRE = [n['nombre'] for n in D['niveles'][:NP]]
ESP = {'ext': 0.3, 'pasillo': 0.15, 'tabique': 0.1, 'bunker': 0.5}
LETRAS = 'ABCDEFGHIJKLMNOP'


def slug(s):
    s = unicodedata.normalize('NFD', s).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')


def r3(v):
    return round(v + 0.0, 3)


def rectangulos(mask):
    """descompone una máscara booleana (ny × nx) en rectángulos de celdas (i0, j0, i1, j1) exclusivos"""
    m = mask.copy()
    out = []
    ny, nx = m.shape
    for j in range(ny):
        i = 0
        while i < nx:
            if not m[j, i]: i += 1; continue
            i1 = i
            while i1 + 1 < nx and m[j, i1 + 1]: i1 += 1
            j1 = j
            while j1 + 1 < ny and m[j1 + 1, i:i1 + 1].all(): j1 += 1
            m[j:j1 + 1, i:i1 + 1] = False
            out.append((i, j, i1 + 1, j1 + 1))
            i = i1 + 1
    return out


# ------------------------------------------------------------------ núcleos (identidad global por posición)
NUCLEOS = []
for n in D['pisos'][0]['nucleos']:
    NUCLEOS.append({'x0': n['x0'], 'y0': n['y0'], 'x1': n['x1'], 'y1': n['y1'], 'letra': LETRAS[len(NUCLEOS)], 'pisos': []})
for p, pd in enumerate(D['pisos']):
    for k, n in enumerate(pd['nucleos']):
        g = next(g for g in NUCLEOS if abs(g['x0'] - n['x0']) < 0.01 and abs(g['y0'] - n['y0']) < 0.01)
        g['pisos'].append(p)


def nucleo_global(p, k):
    n = D['pisos'][p]['nucleos'][k]
    return next(g for g in NUCLEOS if abs(g['x0'] - n['x0']) < 0.01 and abs(g['y0'] - n['y0']) < 0.01)


def geo_nucleo(g):
    """posiciones internas del núcleo: escalera en U al oeste, dos ascensores al este, hall al sur"""
    x0, y0, x1, y1 = g['x0'], g['y0'], g['x1'], g['y1']
    xm = (x0 + x1) / 2
    return {'x0': x0, 'y0': y0, 'x1': x1, 'y1': y1, 'xm': xm, 'yh': y0 + HALL,
            'puerta': (x0 + 3.0, y0), 'hall': (x0 + 3.0, y0 + 0.8),
            'cabinas': [(xm + 0.95, y0 + 3.1), (xm + 2.65, y0 + 3.1)],
            'esc_sube': (x0 + 0.95, y0 + HALL - 0.15), 'esc_llega': (x0 + 2.7, y0 + HALL - 0.15),
            'descanso': (x0 + 0.95, y0 + HALL + 13 * 0.28 + 0.35), 'descanso2': (x0 + 2.7, y0 + HALL + 13 * 0.28 + 0.35)}


# ------------------------------------------------------------------ pisos
class Piso:
    def __init__(self, p):
        pd = D['pisos'][p]
        self.p, self.c, self.base = p, CLAVE[p], p * HP
        self.g = np.array(pd['celdas'])
        self.mask = self.g != -1
        self.amb = pd['ambientes']
        self.nrooms = int(self.g.max()) + 1
        self.nucleos = [nucleo_global(p, k) for k in range(len(pd['nucleos']))]
        # ambientes
        self.rooms = []
        cuenta = defaultdict(int)
        for k in range(self.nrooms):
            a = self.amb[k]
            dep, nombre = a['dep'], a['nombre']
            tipo = 'banos_h' if nombre == 'Baños hombres' else 'banos_m' if nombre == 'Baños mujeres' else 'ambiente'
            m = re.match(r'^(.*) (\d\d)$', nombre)
            if m and m.group(1) == dep: nombre = f'{dep} · {m.group(2)}'
            cuenta[dep] += 1
            rid = f"{self.c}-{slug(dep)}-{cuenta[dep]}"
            cells = list(zip(*np.nonzero(self.g == k)))      # (j, i)
            self.rooms.append({'k': k, 'id': rid, 'nombre': nombre, 'dep': dep, 'cat': a['cat'] if dep != 'Baños' else 'servicios', 'tipo': tipo,
                               'amb': (a['x'], a['y']), 'area': a['area'], 'cells': cells})
        self.pasillo_id = f'{self.c}-pasillo'
        # muros de Revit → segmentos con tipo
        self.segs = []
        for w in pd['muros']:
            (ax, ay), (bx, by) = w['a'], w['b']
            eje = 'h' if abs(ay - by) < 1e-6 else 'v'
            if eje == 'h': self.segs.append({'t': w['t'], 'eje': 'h', 'c': r3(ay), 'u0': r3(min(ax, bx)), 'u1': r3(max(ax, bx))})
            else: self.segs.append({'t': w['t'], 'eje': 'v', 'c': r3(ax), 'u0': r3(min(ay, by)), 'u1': r3(max(ay, by))})
        self.puertas = []
        for d in pd['puertas']:
            d = dict(d)
            if d.get('nucleo'): d['ancho'] = 2.4
            d['x'], d['y'] = r3(d['x']), r3(d['y'])
            self.puertas.append(d)
        self.columnas = [(r3(x), r3(y)) for x, y in pd['columnas']]

    # etiqueta de una celda: ('X'|'P'|'N'|'R', índice)
    def et(self, i, j):
        if not (0 <= i < NX and 0 <= j < NY): return ('X', None)
        v = self.g[j, i]
        if v == -1: return ('X', None)
        if v == -2: return ('P', None)
        if v <= -3: return ('N', -3 - v)
        return ('R', int(v))

    def celda(self, x, y):
        return int(math.floor(x / C + 1e-9)), int(math.floor(y / C + 1e-9))


PISOS = [Piso(p) for p in range(NP)]


# ------------------------------------------------------------------ vanos: puertas y ventanas sobre cada segmento
def lados_puerta(P, d):
    """normal unitaria hacia el lado del ambiente (o hacia adentro del edificio) y celdas a cada lado"""
    x, y = d['x'], d['y']
    if d['eje'] == 'h':
        i, j = int(math.floor(x / C)), int(round(y / C))
        a, b = P.et(i, j - 1), P.et(i, j)          # sur, norte
        return a, b, (0, 1)
    i, j = int(round(x / C)), int(math.floor(y / C))
    a, b = P.et(i - 1, j), P.et(i, j)              # oeste, este
    return a, b, (1, 0)


def ventanas_web(P):
    """ventanas de fachada con ancho según el espacio libre (1,80 o 1,00 m)"""
    out = []
    puertas_ext = [d for d in P.puertas if d.get('exterior')]
    cols = set(P.columnas)
    for v in D['pisos'][P.p]['ventanas']:
        x, y, eje = r3(v['x']), r3(v['y']), v['eje']
        if eje == 'h':
            i, j = int(math.floor(x / C)), int(round(y / C))
            jin = j if P.et(i, j)[0] == 'R' else j - 1
            jout = j - 1 if jin == j else j
            vec = [(i - 1, jin, i - 1, jout), (i + 1, jin, i + 1, jout)]
        else:
            i, j = int(round(x / C)), int(math.floor(y / C))
            iin = i if P.et(i, j)[0] == 'R' else i - 1
            iout = i - 1 if iin == i else i
            vec = [(iin, j - 1, iout, j - 1), (iin, j + 1, iout, j + 1)]
        rin = P.et(*((i, jin) if eje == 'h' else (iin, j)))
        if rin[0] != 'R': continue
        ancho = 1.8 if all(P.et(a, b) == rin and P.et(c, e)[0] == 'X' for a, b, c, e in vec) else 1.0
        u = x if eje == 'h' else y
        cc = y if eje == 'h' else x
        # sin choques con columnas de esquina ni con accesos
        def choca(w):
            for cx, cy in cols:
                cu, ccc = (cx, cy) if eje == 'h' else (cy, cx)
                if abs(ccc - cc) < 0.4 and abs(cu - u) < w / 2 + 0.35: return True
            for d in puertas_ext:
                if d['eje'] == eje and abs((d['y'] if eje == 'h' else d['x']) - cc) < 0.01 and abs((d['x'] if eje == 'h' else d['y']) - u) < (w + d['ancho']) / 2 + 0.3: return True
            return False
        if choca(ancho):
            ancho = 1.0
            if choca(ancho): continue
        out.append({'eje': eje, 'c': cc, 'a': r3(u - ancho / 2), 'b': r3(u + ancho / 2), 'u': u})
    return out


def piezas_de(P, ventanas):
    """segmentos de muro → piezas con vanos. Cada pieza: dict(eje, c, u0, u1, t, tipo, rol: solido|puerta|ventana)"""
    out = []
    for s in P.segs:
        t = ESP[s['t']]
        ext_fin = min(t / 2, 0.15) if s['t'] != 'bunker' else 0.075
        u0, u1 = s['u0'] - ext_fin, s['u1'] + ext_fin
        vanos = []
        for d in P.puertas:
            if d['eje'] != s['eje']: continue
            cu, cc = (d['x'], d['y']) if s['eje'] == 'h' else (d['y'], d['x'])
            if abs(cc - s['c']) < 0.01 and s['u0'] - 1e-6 <= cu <= s['u1'] + 1e-6:
                vanos.append((cu - d['ancho'] / 2, cu + d['ancho'] / 2, 'puerta'))
        if s['t'] == 'ext':
            for v in ventanas:
                if v['eje'] == s['eje'] and abs(v['c'] - s['c']) < 0.01 and s['u0'] - 1e-6 <= v['u'] <= s['u1'] + 1e-6:
                    vanos.append((v['a'], v['b'], 'ventana'))
        vanos.sort()
        cur = u0
        for a, b, rol in vanos:
            if a > cur + 1e-6: out.append({'eje': s['eje'], 'c': s['c'], 'u0': r3(cur), 'u1': r3(a), 't': t, 'tipo': s['t'], 'rol': 'solido'})
            out.append({'eje': s['eje'], 'c': s['c'], 'u0': r3(a), 'u1': r3(b), 't': t, 'tipo': s['t'], 'rol': rol})
            cur = max(cur, b)
        if u1 > cur + 1e-6: out.append({'eje': s['eje'], 'c': s['c'], 'u0': r3(cur), 'u1': r3(u1), 't': t, 'tipo': s['t'], 'rol': 'solido'})
    return out


def rect_pieza(q):
    if q['eje'] == 'h': return (q['u0'], r3(q['c'] - q['t'] / 2), q['u1'], r3(q['c'] + q['t'] / 2))
    return (r3(q['c'] - q['t'] / 2), q['u0'], r3(q['c'] + q['t'] / 2), q['u1'])


def muros_nucleo(P, g):
    """muros internos del núcleo (solo visor web): frente de ascensores, divisorios y barandas"""
    n = geo_nucleo(g)
    x0, y0, x1, y1, xm, yh = n['x0'], n['y0'], n['x1'], n['y1'], n['xm'], n['yh']
    sube = P.p + 1 in g['pisos'] and P.p + 1 < NP
    out = []   # (x0, y0, x1, y1, que, alto)
    # frente de los ascensores con dos vanos de 1,10 m
    cur = xm
    for cx, _ in n['cabinas']:
        out.append((cur, yh - 0.075, cx - 0.55, yh + 0.075, 'muro', TOP)); cur = cx + 0.55
    out.append((cur, yh - 0.075, x1, yh + 0.075, 'muro', TOP))
    out.append((xm - 0.1, yh, xm + 0.1, y1, 'muro', TOP))                       # escalera | ascensores
    out.append((xm + 1.75, yh, xm + 1.85, y1, 'muro', TOP))                     # entre ascensores
    if sube:
        out.append((x0 + 1.75, yh, x0 + 1.85, yh + 13 * 0.28, 'muro', TOP))     # muro entre tramos
    else:
        out.append((x0 + 0.1, yh - 0.03, x0 + 1.8, yh + 0.03, 'baranda', 1.0))  # baranda del vacío (último piso)
        out.append((x0 + 1.77, yh, x0 + 1.83, yh + 13 * 0.28, 'baranda', 1.0))
    return out


def columnas_web(P, piezas):
    """columnas libres: se quitan las que caen en vanos de puerta, pasillos o núcleos"""
    vanos = [rect_pieza(q) for q in piezas if q['rol'] == 'puerta']
    out = []
    for x, y in P.columnas:
        i, j = round(x / C), round(y / C)
        vec = [P.et(a, b) for a in (i - 1, i) for b in (j - 1, j)]
        if any(v[0] == 'N' for v in vec) or all(v[0] == 'P' for v in vec): continue
        if any(a - 0.35 < x < c + 0.35 and b - 0.35 < y < e + 0.35 for a, b, c, e in vanos): continue
        out.append((x, y))
    return out

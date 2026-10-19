"""
Genera src/data/modelo_sk.json: el modelo 3D del Hospital SOLCA para el recorrido web
(mismo formato que el modelo de SketchUp: primitivas por parte, materiales con textura y componentes).

    python3 scripts/solca_modelo_web.py

Partes: {piso}-muros / -muros-alta (unión limpia de muros con corte a 2,60 m), {piso}-resto (losas,
acabados, puertas, ventanas, escaleras y ascensores), {piso}-cielo (cielo raso y luminarias),
exterior (lote, calles, parqueos, árboles), portal (marquesinas y letreros) y techo.
"""
import json, math, os, sys, base64, bisect, random
from collections import defaultdict
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from solca_comun import *
import texturas_sketchup as TX

TEX = TX.generar()
mats = {}


def mat(nombre, color='#CCCCCC', alpha=1.0, tex=None):
    if nombre not in mats:
        w = h = 1.0
        if tex: _, w, h = TEX[tex]
        mats[nombre] = {'color': color, 'alpha': alpha, 'w': w, 'h': h,
                        'tex': ('data:image/jpeg;base64,' + base64.b64encode(TEX[tex][0]).decode()) if tex else None}
    return nombre


CAT_NOMBRE = {'emergencia': 'Emergencia', 'consulta': 'Consulta', 'diagnostico': 'Diagnóstico', 'tratamiento': 'Tratamiento',
              'hospitalizacion': 'Hospitalización', 'servicios': 'Servicios', 'administracion': 'Administración'}
M_FACH = mat('Fachada (paneles)', '#EEF0F1', tex='fachada.jpg')
M_FRANJA = mat('Franja de fachada', '#2E7D6B')            # verde institucional
M_PINT = mat('Pintura muros', '#F4F2EE')
M_SAN = mat('Panel sanitario', '#DCE6EE')
M_BUNKER = mat('Hormigón visto', '#C9CCCF')
M_CORTE = mat('Corte de muros', '#3D434B')
M_LOSA = mat('Losa (hormigón)', '#B9BDC1')
M_CIELO = mat('Cielo raso', '#F6F7F8', tex='cielo_raso.jpg')
M_LUZ = mat('Luminaria', '#FFFDF2')
M_VID = mat('Vidrio', '#BFDDF0', 0.28)
M_VIDP = mat('Vidrio de puerta', '#CFE6F5', 0.38)
M_ALU = mat('Aluminio', '#3E4651')
M_ACERO = mat('Acero inoxidable', '#C9D1D8', tex='acero.jpg')
M_PASA = mat('Pasamanos', '#8C96A1')
M_ESC = mat('Escalera (granito)', '#C8C3BC')
M_NARIZ = mat('Nariz de grada', '#5E656D')
M_MADERA = mat('Madera', '#B98A5E', tex='madera.jpg')
M_BLANCO = mat('Blanco', '#F5F7F9')
M_OSCURO = mat('Gris oscuro', '#3A424C')
M_ROJO = mat('Rojo emergencia', '#D9483B')
M_VERDE = mat('Verde SOLCA', '#2E7D6B')
M_CESPED = mat('Césped', '#7DB25E', tex='cesped.jpg')
M_ASF = mat('Asfalto', '#50565E', tex='asfalto.jpg')
M_ACERA = mat('Vereda', '#CDCDCB', tex='acera.jpg')
M_PLAZA = mat('Adoquín de plaza', '#C9BFB2', tex='plaza.jpg')
M_ZOCALO = mat('Zócalo de piedra', '#5E636A', tex='zocalo.jpg')
M_CUBIERTA = mat('Cubierta (grava)', '#A7ADB3', tex='cubierta.jpg')
M_PINTURA_VIAL = mat('Pintura vial', '#F4F4F0')
M_TRONCO = mat('Tronco', '#6B4E37')
M_FOLLAJE = mat('Follaje', '#5E9E4A')
M_FOLLAJE2 = mat('Follaje claro', '#7DB35A')
M_NEUM = mat('Neumático', '#22262B')
M_VIDAUTO = mat('Vidrio de auto', '#2B3440', 0.85)
M_TEXTO_B = mat('Texto blanco', '#FFFFFF')
M_SENAL = mat('Letrero', '#1F3B5A')
M_HVAC = mat('Equipos de cubierta', '#9AA3AC')
AUTOS = [mat('Auto blanco', '#E9ECEF'), mat('Auto gris', '#8D96A0'), mat('Auto rojo', '#B8443A'), mat('Auto azul', '#2F5B8E'), mat('Auto negro', '#2A2E33')]


def piso_mat(tipo, cat):
    if tipo in ('pasillo', 'hall', 'escalera', 'ascensores'): return mat('Piso pasillo', '#E3E8ED', tex='piso_pasillo.jpg')
    if tipo in ('banos_h', 'banos_m'): return mat('Piso baño', '#E9F1F7', tex='piso_bano.jpg')
    cat = cat if cat in CAT_NOMBRE else 'servicios'
    return mat('Piso ' + CAT_NOMBRE[cat], '#DDDDDD', tex=f'piso_{cat}.jpg')


# ------------------------------------------------------------------ primitivas
partes = defaultdict(list)
textos = []
DEFS = {}
def r(v): return round(v + 0.0, 3)
def P3(p): return [r(p[0]), r(p[1]), r(p[2])]


def caja(g, m, x0, y0, z0, x1, y1, z1):
    if x1 - x0 < 0.004 or y1 - y0 < 0.004 or z1 - z0 < 0.004: return
    partes[g].append(['b', m, r(x0), r(y0), r(z0), r(x1), r(y1), r(z1)])


def cara(g, m, pts, n=None):
    if n is not None and abs(n[2]) > 0.99:
        # orden antihorario visto desde la normal (con DoubleSide, el orden decide la cara iluminada)
        area = sum(pts[k - 1][0] * pts[k][1] - pts[k][0] * pts[k - 1][1] for k in range(len(pts)))
        if (area < 0) == (n[2] > 0): pts = pts[::-1]
    partes[g].append(['f', m, [P3(p) for p in pts], n])


def plano(g, m, x0, y0, x1, y1, z, abajo=False):
    if x1 - x0 < 0.004 or y1 - y0 < 0.004: return
    pts = [(x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z)]
    cara(g, m, pts[::-1] if abajo else pts, [0, 0, -1] if abajo else [0, 0, 1])


def barra(g, m, a, b, w, h):
    dx, dy = b[0] - a[0], b[1] - a[1]
    L = math.hypot(dx, dy)
    px, py = (-dy / L, dx / L) if L > 1e-6 else (1.0, 0.0)
    o = lambda q, s: (q[0] + px * w / 2 * s, q[1] + py * w / 2 * s, q[2])
    a0, a1, b0, b1 = o(a, -1), o(a, 1), o(b, -1), o(b, 1)
    up = lambda q: (q[0], q[1], q[2] + h)
    partes[g].append(['h', m, [P3(p) for p in [a0, a1, b1, b0, up(a0), up(a1), up(b1), up(b0)]]])


def cilindro(g, m, c, rr, largo, eje=(0, 0, 1), n=16):
    partes[g].append(['c', m, P3(c), list(eje), r(rr), r(largo), n])


def instancia(g, nombre, x, y, z, rot=0, esc=1.0, m=None):
    partes[g].append(['i', nombre, [r(x), r(y), r(z)], rot, esc, m])


def texto(g, m, s, h, o, R, U):
    textos.append({'parte': g, 'mat': m, 's': s, 'h': h, 'o': P3(o), 'R': list(R), 'U': list(U)})


def restar(rect, huecos):
    x0, y0, x1, y1 = rect
    hs = [(max(x0, a), max(y0, b), min(x1, c), min(y1, e)) for a, b, c, e in huecos]
    hs = [h for h in hs if h[2] - h[0] > 1e-6 and h[3] - h[1] > 1e-6]
    if not hs: return [rect]
    xs = sorted(set([x0, x1] + [v for h in hs for v in (h[0], h[2])])); ys = sorted(set([y0, y1] + [v for h in hs for v in (h[1], h[3])]))
    out = []
    for a in range(len(xs) - 1):
        for b in range(len(ys) - 1):
            cx, cy = (xs[a] + xs[a + 1]) / 2, (ys[b] + ys[b + 1]) / 2
            if not any(h[0] < cx < h[2] and h[1] < cy < h[3] for h in hs): out.append((xs[a], ys[b], xs[a + 1], ys[b + 1]))
    return out


# ------------------------------------------------------------------ unión de cajas en caras limpias (con índice espacial)
def union_caras(cajas, matfn, B=4.0):
    cubo = defaultdict(list)
    for idx, (lo, hi, _) in enumerate(cajas):
        for bx in range(int(math.floor(lo[0] / B)), int(math.floor(hi[0] / B)) + 1):
            for by in range(int(math.floor(lo[1] / B)), int(math.floor(hi[1] / B)) + 1):
                cubo[(bx, by)].append(idx)
    planos = defaultdict(list)
    for idx, (lo, hi, kind) in enumerate(cajas):
        cand = set()
        for bx in range(int(math.floor((lo[0] - 0.01) / B)), int(math.floor((hi[0] + 0.01) / B)) + 1):
            for by in range(int(math.floor((lo[1] - 0.01) / B)), int(math.floor((hi[1] + 0.01) / B)) + 1):
                cand.update(cubo.get((bx, by), ()))
        cand.discard(idx)
        for k in range(3):
            i, j = [a for a in range(3) if a != k]
            for s in (-1, 1):
                c = hi[k] if s > 0 else lo[k]
                pc = c + s * 1e-4
                cov = []
                for jdx in cand:
                    lo2, hi2, _ = cajas[jdx]
                    if not (lo2[k] < pc < hi2[k]): continue
                    a0, a1 = max(lo[i], lo2[i]), min(hi[i], hi2[i]); b0, b1 = max(lo[j], lo2[j]), min(hi[j], hi2[j])
                    if a1 - a0 > 1e-6 and b1 - b0 > 1e-6: cov.append((a0, a1, b0, b1))
                us = sorted(set([lo[i], hi[i]] + [x for rr in cov for x in rr[:2]]))
                vs = sorted(set([lo[j], hi[j]] + [x for rr in cov for x in rr[2:]]))
                for a in range(len(us) - 1):
                    cu = (us[a] + us[a + 1]) / 2
                    for b in range(len(vs) - 1):
                        cv = (vs[b] + vs[b + 1]) / 2
                        if any(rr[0] < cu < rr[1] and rr[2] < cv < rr[3] for rr in cov): continue
                        p = [0, 0, 0]; p[k] = c + s * 0.01; p[i] = cu; p[j] = cv
                        planos[(k, s, round(c, 5))].append((us[a], us[a + 1], vs[b], vs[b + 1], matfn(kind, k, s, c, p)))
    salida = []
    for (k, s, c), rects in planos.items():
        i, j = [a for a in range(3) if a != k]
        us = sorted(set(x for rr in rects for x in rr[:2])); vs = sorted(set(x for rr in rects for x in rr[2:4]))
        celda = {}
        for u0, u1, v0, v1, m in rects:
            for a in range(bisect.bisect_left(us, u0 - 1e-9), bisect.bisect_left(us, u1 - 1e-9)):
                for b in range(bisect.bisect_left(vs, v0 - 1e-9), bisect.bisect_left(vs, v1 - 1e-9)):
                    celda.setdefault((a, b), m)
        activos = {}
        def emitir(a0, a1, m, b0, b1):
            q = []
            for (u, v) in ((us[a0], vs[b0]), (us[a1], vs[b0]), (us[a1], vs[b1]), (us[a0], vs[b1])):
                p = [0, 0, 0]; p[k] = c; p[i] = u; p[j] = v; q.append(p)
            n = [0, 0, 0]; n[k] = s
            if (k == 1) == (s > 0): q = q[::-1]
            salida.append((m, q, n))
        for b in range(len(vs) - 1):
            runs, a = [], 0
            while a < len(us) - 1:
                m = celda.get((a, b))
                if m is None: a += 1; continue
                a1 = a
                while a1 + 1 < len(us) - 1 and celda.get((a1 + 1, b)) == m: a1 += 1
                runs.append((a, a1 + 1, m)); a = a1 + 1
            nuevos = {}
            for rr in runs: nuevos[rr] = activos.pop(rr, b)
            for (a0, a1, m), b0 in activos.items(): emitir(a0, a1, m, b0, b)
            activos = nuevos
        for (a0, a1, m), b0 in activos.items(): emitir(a0, a1, m, b0, len(vs) - 1)
    return salida


# ------------------------------------------------------------------ componentes
def defn(nombre, prims):
    if nombre not in DEFS: DEFS[nombre] = prims
    return nombre


def ventana_def(L, t):
    nombre = f'Ventana {L:.2f} m'
    if nombre in DEFS: return nombre
    fd, H = 0.07, 1.5
    P = []
    Bx = lambda m, *a: P.append(['b', m] + [r(v) for v in a])
    Bx(M_ALU, 0, -fd / 2, 0, L, fd / 2, 0.06); Bx(M_ALU, 0, -fd / 2, H - 0.06, L, fd / 2, H)
    Bx(M_ALU, 0, -fd / 2, 0.06, 0.06, fd / 2, H - 0.06); Bx(M_ALU, L - 0.06, -fd / 2, 0.06, L, fd / 2, H - 0.06)
    np_ = max(1, round(L / 0.9))
    for k in range(1, np_):
        x = L * k / np_; Bx(M_ALU, x - 0.025, -fd / 2, 0.06, x + 0.025, fd / 2, H - 0.06)
    Bx(M_ALU, 0.06, -fd / 2 + 0.01, 1.08, L - 0.06, fd / 2 - 0.01, 1.12)
    P.append(['f', M_VID, [[0.06, 0, 0.06], [L - 0.06, 0, 0.06], [L - 0.06, 0, H - 0.06], [0.06, 0, H - 0.06]], None])
    Bx(M_BLANCO, -0.02, -t / 2 - 0.04, -0.03, L + 0.02, -fd / 2, 0.0); Bx(M_BLANCO, -0.02, fd / 2, -0.03, L + 0.02, t / 2 + 0.03, 0.0)
    return defn(nombre, P)


COLOR_CAT = {'emergencia': ('#D9483B', 'roja'), 'consulta': ('#2F6FB0', 'azul'), 'diagnostico': ('#7B5EA7', 'violeta'), 'tratamiento': ('#E09A2D', 'naranja'),
             'hospitalizacion': ('#3F9A5B', 'verde'), 'servicios': ('#9AA7B4', 'gris'), 'administracion': ('#B0507F', 'magenta')}


def puerta_def(W, t, color, cnombre, doble=False, vidrio=False, corr=False):
    nombre = f"Puerta {W:.2f}{' doble' if doble else ''}{' corrediza' if corr else ''} {cnombre}{' (vidrio)' if vidrio else ''} e{t:.2f}"
    if nombre in DEFS: return nombre
    P = []
    Bx = lambda m, *a: P.append(['b', m] + [r(v) for v in a])
    mm_ = mat('Marco blanco', '#F4F7FA')
    hoja = M_VIDP if vidrio else mat('Puerta ' + cnombre, color)
    e = t / 2 + 0.015
    Bx(mm_, -0.04, -e, 0, 0.03, e, 2.16); Bx(mm_, W - 0.03, -e, 0, W + 0.04, e, 2.16); Bx(mm_, -0.04, -e, 2.08, W + 0.04, e, 2.16)
    if corr:
        # dos hojas de vidrio corredizas, abiertas a los lados
        y0, y1 = -t / 2 - 0.07, -t / 2 - 0.03
        Bx(M_ALU, -W / 2, y0 - 0.02, 2.1, W * 1.5, y1 + 0.01, 2.25)
        for x0 in (-W / 2 + 0.05, W - 0.05):
            Bx(M_ALU, x0, y0, 0.02, x0 + W / 2, y1, 0.07); Bx(M_ALU, x0, y0, 2.03, x0 + W / 2, y1, 2.08)
            Bx(M_ALU, x0, y0, 0.07, x0 + 0.05, y1, 2.03); Bx(M_ALU, x0 + W / 2 - 0.05, y0, 0.07, x0 + W / 2, y1, 2.03)
            P.append(['f', M_VID, [[x0 + 0.05, (y0 + y1) / 2, 0.07], [x0 + W / 2 - 0.05, (y0 + y1) / 2, 0.07],
                                   [x0 + W / 2 - 0.05, (y0 + y1) / 2, 2.03], [x0 + 0.05, (y0 + y1) / 2, 2.03]], None])
        return defn(nombre, P)
    hojas = [(0.0, +1, W / 2 if doble else W)]
    if doble: hojas.append((W, -1, W / 2))
    for xb, sx, L in hojas:
        xa, xb2 = sorted((xb + sx * 0.03, xb + sx * 0.07))
        ya, yb = t / 2, t / 2 + L - 0.07
        Bx(hoja, xa, ya, 0.01, xb2, yb, 2.04)
        if not vidrio:
            Bx(M_ACERO, xa - 0.004, ya + 0.02, 0.01, xb2 + 0.004, yb - 0.02, 0.24)
            if L > 0.85: P.append(['b', M_VIDP, r(xa - 0.004), r(ya + 0.25), 1.35, r(xb2 + 0.004), r(min(yb - 0.15, ya + 0.55)), 1.75])
        hx = (xa + xb2) / 2
        Bx(M_ACERO, hx - 0.075, yb - 0.16, 0.99, hx + 0.075, yb - 0.12, 1.03)
    return defn(nombre, P)


def icosaedro(cx, cy, cz, rx, ry, rz, semilla=1, jit=0.12):
    t = (1 + 5 ** 0.5) / 2
    V = [(-1, t, 0), (1, t, 0), (-1, -t, 0), (1, -t, 0), (0, -1, t), (0, 1, t), (0, -1, -t), (0, 1, -t), (t, 0, -1), (t, 0, 1), (-t, 0, -1), (-t, 0, 1)]
    F = [(0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11), (1, 5, 9), (5, 11, 4), (11, 10, 2), (10, 7, 6), (7, 1, 8),
         (3, 9, 4), (3, 4, 2), (3, 2, 6), (3, 6, 8), (3, 8, 9), (4, 9, 5), (2, 4, 11), (6, 2, 10), (8, 6, 7), (9, 8, 1)]
    V = [tuple(c / math.sqrt(sum(q * q for q in v)) for c in v) for v in V]
    cache = {}
    def medio(a, b):
        k = tuple(sorted((a, b)))
        if k not in cache:
            p = [(V[a][i] + V[b][i]) / 2 for i in range(3)]; L = math.sqrt(sum(q * q for q in p))
            V.append(tuple(q / L for q in p)); cache[k] = len(V) - 1
        return cache[k]
    F2 = []
    for a, b, c in F:
        ab, bc, ca = medio(a, b), medio(b, c), medio(c, a)
        F2 += [(a, ab, ca), (b, bc, ab), (c, ca, bc), (ab, bc, ca)]
    rnd = random.Random(semilla)
    Vj = [(cx + v[0] * rx * (1 + rnd.uniform(-jit, jit)), cy + v[1] * ry * (1 + rnd.uniform(-jit, jit)), cz + v[2] * rz * (1 + rnd.uniform(-jit, jit))) for v in V]
    return [[P3(Vj[a]), P3(Vj[b]), P3(Vj[c])] for a, b, c in F2]


DEFS['Árbol frondoso'] = [['c', M_TRONCO, [0, 0, 0], [0, 0, 1], 0.16, 2.8, 10], ['p', M_FOLLAJE, icosaedro(0, 0, 4.2, 2.6, 2.6, 2.0, 3)],
                          ['p', M_FOLLAJE2, icosaedro(0.7, -0.5, 5.4, 1.6, 1.6, 1.3, 5)]]
DEFS['Árbol columnar'] = [['c', M_TRONCO, [0, 0, 0], [0, 0, 1], 0.12, 2.0, 10], ['p', M_FOLLAJE2, icosaedro(0, 0, 4.4, 1.3, 1.3, 3.0, 8)]]
DEFS['Poste de luz'] = [['c', M_OSCURO, [0, 0, 0], [0, 0, 1], 0.08, 6.0, 10], ['b', M_OSCURO, -0.03, 0.0, 5.85, 0.03, 1.3, 5.95],
                        ['b', M_OSCURO, -0.18, 1.0, 5.8, 0.18, 1.6, 5.95], ['b', M_LUZ, -0.15, 1.03, 5.78, 0.15, 1.57, 5.8],
                        ['c', M_ZOCALO, [0, 0, 0], [0, 0, 1], 0.18, 0.3, 10]]
DEFS['Banca exterior'] = [['b', M_ZOCALO, -0.8, -0.22, 0, -0.65, 0.22, 0.42], ['b', M_ZOCALO, 0.65, -0.22, 0, 0.8, 0.22, 0.42]] + \
                         [['b', M_MADERA, -0.95, -0.24 + k * 0.1, 0.42, 0.95, -0.17 + k * 0.1, 0.46] for k in range(5)]
DEFS['Auto'] = [['b', None, 0.0, -0.88, 0.3, 4.3, 0.88, 0.82], ['b', None, 0.1, -0.86, 0.82, 0.9, 0.86, 0.9],
                ['h', M_VIDAUTO, [[0.9, -0.82, 0.82], [3.3, -0.82, 0.82], [3.3, 0.82, 0.82], [0.9, 0.82, 0.82],
                                  [1.5, -0.72, 1.38], [2.95, -0.72, 1.38], [2.95, 0.72, 1.38], [1.5, 0.72, 1.38]]],
                ['b', None, 1.5, -0.72, 1.38, 2.95, 0.72, 1.43],
                ['b', M_LUZ, 4.29, -0.75, 0.62, 4.31, -0.45, 0.72], ['b', M_LUZ, 4.29, 0.45, 0.62, 4.31, 0.75, 0.72],
                ['b', M_ROJO, -0.01, -0.78, 0.62, 0.01, -0.5, 0.72], ['b', M_ROJO, -0.01, 0.5, 0.62, 0.01, 0.78, 0.72]] + \
               [['c', M_NEUM, [x, y, 0.32], [0, 1, 0], 0.32, 0.22, 14] for x in (0.85, 3.45) for y in (-0.9, 0.68)]
DEFS['Ambulancia'] = [['b', M_BLANCO, 0.0, -1.0, 0.35, 4.4, 1.0, 2.55], ['b', M_BLANCO, 4.4, -0.95, 0.35, 5.6, 0.95, 1.4],
                      ['h', M_VIDAUTO, [[4.4, -0.9, 1.4], [5.5, -0.9, 1.4], [5.5, 0.9, 1.4], [4.4, 0.9, 1.4], [4.4, -0.9, 2.3], [4.9, -0.9, 2.3], [4.9, 0.9, 2.3], [4.4, 0.9, 2.3]]],
                      ['b', M_ROJO, 0.0, -1.01, 1.2, 4.4, 1.01, 1.45], ['b', M_ROJO, 3.6, -0.4, 2.55, 4.2, 0.4, 2.7]] + \
                     [['c', M_NEUM, [x, y, 0.35], [0, 1, 0], 0.35, 0.24, 14] for x in (1.0, 4.6) for y in (-1.02, 0.78)]


# ------------------------------------------------------------------ máscaras por piso
MASK = [P.mask for P in PISOS]


def dentro(p, x, y):
    i, j = int(math.floor(x / C)), int(math.floor(y / C))
    return 0 <= i < NX and 0 <= j < NY and MASK[p][j, i]


def bordes(mask, menos=None):
    """bordes exteriores de una máscara (para antepechos): [(eje, c, u0, u1)] fusionados"""
    segs = defaultdict(list)
    def en(m, i, j): return 0 <= i < NX and 0 <= j < NY and m[j, i]
    for j in range(NY + 1):
        for i in range(NX):
            a, b = en(mask, i, j - 1), en(mask, i, j)
            if a != b:
                if menos is not None and en(menos, i, j - 1) == a and en(menos, i, j) == b: continue
                segs[('h', j)].append(i)
    for i in range(NX + 1):
        for j in range(NY):
            a, b = en(mask, i - 1, j), en(mask, i, j)
            if a != b:
                if menos is not None and en(menos, i - 1, j) == a and en(menos, i, j) == b: continue
                segs[('v', i)].append(j)
    out = []
    for (eje, c), lst in segs.items():
        lst.sort(); s = prev = lst[0]
        for v in lst[1:] + [None]:
            if v is not None and v == prev + 1: prev = v; continue
            out.append((eje, c * C, s * C, (prev + 1) * C))
            if v is not None: s = prev = v
    return out


def caja_borde(eje, c, u0, u1, t, z0, z1):
    if eje == 'h': return ((u0 - t / 2, c - t / 2, z0), (u1 + t / 2, c + t / 2, z1))
    return ((c - t / 2, u0 - t / 2, z0), (c + t / 2, u1 + t / 2, z1))


# ------------------------------------------------------------------ pisos
stats = defaultdict(int)
for P in PISOS:
    p, base = P.p, P.p * HP
    g_m, g_ma, g_r, g_c = f'{p}-muros', f'{p}-muros-alta', f'{p}-resto', f'{p}-cielo'
    ventanas = ventanas_web(P)
    piezas = piezas_de(P, ventanas)
    cols = columnas_web(P, piezas)
    banos = {rm['k'] for rm in P.rooms if rm['tipo'] in ('banos_h', 'banos_m')}
    bunker = {rm['k'] for rm in P.rooms if rm['dep'] == 'Radioterapia'}

    # ---------- muros (unión, con corte a 2,60 m)
    bajo, alto = [], []
    def agregar(lo, hi, kind):
        (x0, y0, z0), (x1, y1, z1) = lo, hi
        if z0 < CORTE - 1e-9: bajo.append(((x0, y0, base + z0), (x1, y1, base + min(z1, CORTE)), kind))
        if z1 > CORTE + 1e-9: alto.append(((x0, y0, base + max(z0, CORTE)), (x1, y1, base + z1), kind))
    for q in piezas:
        x0, y0, x1, y1 = rect_pieza(q)
        ext = q['tipo'] == 'ext'
        kind = 'ext' if ext else ('bunker' if q['tipo'] == 'bunker' else 'int')
        tramos = {'solido': [(0, TOP)], 'puerta': [(2.2, TOP)], 'ventana': [(0, 0.9), (2.4, TOP)]}[q['rol']]
        for z0, z1 in tramos: agregar((x0, y0, z0), (x1, y1, z1), kind)
        if ext: agregar((x0, y0, TOP), (x1, y1, HP), 'franja')
    for gnu in P.nucleos:
        for x0, y0, x1, y1, que, altura in muros_nucleo(P, gnu):
            if que == 'muro': agregar((x0, y0, 0), (x1, y1, TOP), 'int')
    for x, y in cols: agregar((x - 0.25, y - 0.25, 0), (x + 0.25, y + 0.25, TOP), 'col')

    def matfn_factory(parte):
        def matfn(kind, k, s, c, pt):
            if k == 2 and abs(c - (base + CORTE)) < 1e-6 and ((parte == 'bajo' and s > 0) or (parte == 'alto' and s < 0)): return M_CORTE
            if not dentro(p, pt[0], pt[1]):
                if kind == 'franja' or pt[2] > base + TOP + 1e-6: return M_FRANJA
                if p == 0 and pt[2] < 0.6: return M_ZOCALO
                return M_FACH
            if kind == 'bunker': return M_BUNKER
            i, j = int(math.floor(pt[0] / C)), int(math.floor(pt[1] / C))
            if 0 <= i < NX and 0 <= j < NY and P.g[j, i] in banos: return M_SAN
            return M_PINT
        return matfn
    for parte, lista, g in (('bajo', bajo, g_m), ('alto', alto, g_ma)):
        for m, q, nv in union_caras(lista, matfn_factory(parte)): cara(g, m, q, nv)
    stats['cajas de muro'] += len(bajo) + len(alto)

    # ---------- losa (y huecos de escaleras y ascensores)
    huecos = []
    if p > 0:
        for gnu in P.nucleos:
            if p - 1 in gnu['pisos']:
                n = geo_nucleo(gnu); huecos.append((n['x0'] + 0.1, n['yh'] + 0.075, n['x1'] - 0.1, n['y1'] - 0.1))
    region = MASK[0] if p == 0 else MASK[p - 1]
    z0 = -0.5 if p == 0 else base - 0.3
    losas = []
    for i0, j0, i1, j1 in rectangulos(region):
        for x0, y0, x1, y1 in restar((i0 * C, j0 * C, i1 * C, j1 * C), huecos): losas.append(((x0, y0, z0), (x1, y1, base), 'losa'))
    for m, q, nv in union_caras(losas, lambda *a: M_LOSA, B=8.0): cara(g_r, m, q, nv)

    # ---------- acabados de piso, cielo raso y luminarias
    zc = base + CIELO
    def rects_de(mask): return [(i0 * C, j0 * C, i1 * C, j1 * C) for i0, j0, i1, j1 in rectangulos(mask)]
    for rm in P.rooms:
        m_ = piso_mat(rm['tipo'], rm['cat'])
        for x0, y0, x1, y1 in rects_de(P.g == rm['k']):
            plano(g_r, m_, x0, y0, x1, y1, base + 0.004)
            plano(g_c, M_CIELO, x0, y0, x1, y1, zc, abajo=True)
            nx_, ny_ = max(1, int((x1 - x0) / 3.6)), max(1, int((y1 - y0) / 3.6))
            if rm['tipo'] in ('banos_h', 'banos_m'): nx_, ny_ = max(1, int((x1 - x0) / 2.4)), max(1, int((y1 - y0) / 2.4))
            for a in range(nx_):
                for b in range(ny_):
                    px, py = x0 + (a + 0.5) * (x1 - x0) / nx_, y0 + (b + 0.5) * (y1 - y0) / ny_
                    caja(g_c, M_LUZ, px - 0.3, py - 0.3, zc - 0.03, px + 0.3, py + 0.3, zc - 0.005)
    m_p = piso_mat('pasillo', None)
    for x0, y0, x1, y1 in rects_de(P.g == -2):
        plano(g_r, m_p, x0, y0, x1, y1, base + 0.004)
        plano(g_c, M_CIELO, x0, y0, x1, y1, zc, abajo=True)
        largo = (x1 - x0) >= (y1 - y0)
        L = (x1 - x0) if largo else (y1 - y0)
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        for k in range(int(L / 3.0)):
            t = (x0 if largo else y0) + 1.5 + k * 3.0
            if largo: caja(g_c, M_LUZ, t - 0.6, cy - 0.12, zc - 0.04, t + 0.6, cy + 0.12, zc - 0.005)
            else: caja(g_c, M_LUZ, cx - 0.12, t - 0.6, zc - 0.04, cx + 0.12, t + 0.6, zc - 0.005)
    if p > 0 and p - 1 < NP:
        terraza = MASK[p - 1] & ~MASK[p]
        for x0, y0, x1, y1 in rects_de(terraza): plano(g_r, M_CUBIERTA, x0, y0, x1, y1, base + 0.006)
        for eje, c, u0, u1 in bordes(MASK[p - 1], MASK[p]):
            lo, hi = caja_borde(eje, c, u0, u1, 0.3, base, base + 1.05)
            caja(g_r, M_FACH, *lo, *hi)
            lo, hi = caja_borde(eje, c, u0, u1, 0.36, base + 1.05, base + 1.15)
            caja(g_r, M_FRANJA, *lo, *hi)

    # ---------- núcleos: hall, escalera en U y dos ascensores
    for gnu in P.nucleos:
        n = geo_nucleo(gnu)
        x0, y0, x1, y1, xm, yh = n['x0'], n['y0'], n['x1'], n['y1'], n['xm'], n['yh']
        plano(g_r, m_p, x0, y0, x1, yh, base + 0.004)
        plano(g_c, M_CIELO, x0, y0, x1, yh, zc, abajo=True)
        caja(g_c, M_LUZ, x0 + 1.2, y0 + 0.68, zc - 0.04, x1 - 1.2, y0 + 0.92, zc - 0.005)
        if p == 0: plano(g_r, m_p, x0, yh, x1, y1, base + 0.004)
        sube = p + 1 in gnu['pisos']
        v0, hu, cr = yh, 0.28, HP / 26
        if sube:
            for k in range(13):
                caja(g_r, M_ESC, x0 + 0.2, v0 + k * hu, base, x0 + 1.75, v0 + (k + 1) * hu, base + (k + 1) * cr)
                caja(g_r, M_NARIZ, x0 + 0.2, v0 + k * hu - 0.005, base + (k + 1) * cr - 0.03, x0 + 1.75, v0 + k * hu + 0.04, base + (k + 1) * cr + 0.003)
                top = HP / 2 + (k + 1) * cr
                y_a, y_b = v0 + 13 * hu - (k + 1) * hu, v0 + 13 * hu - k * hu
                caja(g_r, M_ESC, x0 + 1.85, y_a, base + top - 0.3, xm - 0.1, y_b, base + top)
                caja(g_r, M_NARIZ, x0 + 1.85, y_b - 0.04, base + top - 0.03, xm - 0.1, y_b + 0.005, base + top + 0.003)
            caja(g_r, M_ESC, x0 + 0.2, v0 + 13 * hu, base + HP / 2 - 0.2, xm - 0.1, y1 - 0.12, base + HP / 2)
            barra(g_r, M_PASA, (x0 + 0.24, v0 - 0.3, base + 0.9), (x0 + 0.24, v0 + 13 * hu, base + HP / 2 + 0.9), 0.05, 0.05)
            barra(g_r, M_PASA, (xm - 0.14, v0 + 13 * hu, base + HP / 2 + 0.9), (xm - 0.14, v0 - 0.3, base + HP + 0.9), 0.05, 0.05)
        else:
            # último piso del núcleo: baranda de vidrio sobre el vacío de la escalera
            caja(g_r, M_PASA, x0 + 0.1, yh - 0.03, base + 0.95, x0 + 1.8, yh + 0.03, base + 1.0)
            caja(g_r, M_VID, x0 + 0.12, yh - 0.005, base + 0.1, x0 + 1.78, yh + 0.005, base + 0.9)
            caja(g_r, M_PASA, x0 + 1.77, yh, base + 0.95, x0 + 1.83, yh + 13 * hu, base + 1.0)
            caja(g_r, M_VID, x0 + 1.795, yh, base + 0.1, x0 + 1.805, yh + 13 * hu, base + 0.9)
        for cx, cy in n['cabinas']:
            caja(g_r, M_ACERO, cx - 0.72, cy - 1.25, base, cx + 0.72, cy + 1.25, base + 0.05)
            caja(g_r, M_ACERO, cx - 0.72, cy + 1.2, base + 0.05, cx + 0.72, cy + 1.25, base + 2.4)
            caja(g_r, M_ACERO, cx - 0.72, cy - 1.15, base + 0.05, cx - 0.67, cy + 1.2, base + 2.4)
            caja(g_r, M_ACERO, cx + 0.67, cy - 1.15, base + 0.05, cx + 0.72, cy + 1.2, base + 2.4)
            caja(g_r, M_ACERO, cx - 0.72, cy - 1.25, base + 2.4, cx + 0.72, cy + 1.25, base + 2.45)
            caja(g_r, M_LUZ, cx - 0.4, cy - 0.5, base + 2.38, cx + 0.4, cy + 0.5, base + 2.4)
            caja(g_r, M_PASA, cx - 0.62, cy + 1.12, base + 0.9, cx + 0.62, cy + 1.17, base + 0.95)
            ya, yb = yh - 0.105, yh - 0.075
            caja(g_r, M_ACERO, cx - 0.63, ya, base, cx - 0.55, yb, base + 2.28); caja(g_r, M_ACERO, cx + 0.55, ya, base, cx + 0.63, yb, base + 2.28)
            caja(g_r, M_ACERO, cx - 0.63, ya, base + 2.2, cx + 0.63, yb, base + 2.28)
            caja(g_r, M_OSCURO, cx + 0.66, ya - 0.01, base + 1.0, cx + 0.76, yb, base + 1.3)
        # letrero colgante con la letra del núcleo, visible desde el pasillo
        caja(g_r, M_SENAL, x0 + 2.2, y0 - 0.04, base + 2.25, x0 + 3.8, y0 + 0.04, base + 2.6)
        texto(g_r, M_TEXTO_B, f'Ascensores {gnu["letra"]}', 0.2, (x0 + 3.0, y0 - 0.045, base + 2.425), (-1, 0, 0), (0, 0, 1))

    # ---------- puertas y ventanas (componentes)
    for v in ventanas:
        nombre = ventana_def(round(v['b'] - v['a'], 2), 0.3)
        if v['eje'] == 'h': instancia(g_r, nombre, v['a'], v['c'], base + 0.9, 0)
        else: instancia(g_r, nombre, v['c'], v['a'], base + 0.9, 90)
    for d in P.puertas:
        if d.get('nucleo'): continue
        a, b, nrm = lados_puerta(P, d)
        if d.get('exterior'):
            nombre = puerta_def(d['ancho'], 0.3, '#BFE0F7', 'acceso', vidrio=True, corr=True)
            hacia = 1 if b[0] == 'R' else -1
        else:
            rm = P.rooms[d['cuarto']]
            col, cn = COLOR_CAT.get(rm['cat'], ('#9AA7B4', 'gris'))
            if rm['tipo'] in ('banos_h', 'banos_m'): col, cn = '#FFFFFF', 'blanca'
            vid = rm['dep'] in ('Cafetería', 'Hall y Admisión', 'Caja y Facturación')
            q = next((q for q in piezas if q['rol'] == 'puerta' and q['eje'] == d['eje'] and abs(q['c'] - (d['y'] if d['eje'] == 'h' else d['x'])) < 0.01
                      and q['u0'] - 0.01 <= (d['x'] if d['eje'] == 'h' else d['y']) <= q['u1'] + 0.01), None)
            t = q['t'] if q else 0.15
            nombre = puerta_def(d['ancho'], t, col, cn, doble=d['ancho'] >= 1.4, vidrio=vid)
            hacia = 1 if (b[0] == 'R' and b[1] == d['cuarto']) else -1
        W = d['ancho']
        if d['eje'] == 'h':
            if hacia > 0: instancia(g_r, nombre, d['x'] - W / 2, d['y'], base, 0)
            else: instancia(g_r, nombre, d['x'] + W / 2, d['y'], base, 180)
        else:
            if hacia > 0: instancia(g_r, nombre, d['x'], d['y'] + W / 2, base, -90)
            else: instancia(g_r, nombre, d['x'], d['y'] - W / 2, base, 90)
    print(f'piso {p}: {len(partes[g_m]) + len(partes[g_ma])} caras de muro · {len(partes[g_r])} elementos · {len(partes[g_c])} de cielo')

# ------------------------------------------------------------------ techo de la torre
TECHO = NP * HP
losas = [((i0 * C, j0 * C, TECHO - 0.3), (i1 * C, j1 * C, TECHO), 'losa') for i0, j0, i1, j1 in rectangulos(MASK[NP - 1])]
for m, q, nv in union_caras(losas, lambda *a: M_LOSA, B=8.0): cara('techo', m, q, nv)
for i0, j0, i1, j1 in rectangulos(MASK[NP - 1]): plano('techo', M_CUBIERTA, i0 * C, j0 * C, i1 * C, j1 * C, TECHO + 0.006)
for eje, c, u0, u1 in bordes(MASK[NP - 1]):
    lo, hi = caja_borde(eje, c, u0, u1, 0.3, TECHO, TECHO + 1.05); caja('techo', M_FACH, *lo, *hi)
    lo, hi = caja_borde(eje, c, u0, u1, 0.36, TECHO + 1.05, TECHO + 1.15); caja('techo', M_FRANJA, *lo, *hi)
for gnu in NUCLEOS:
    if NP - 1 in gnu['pisos']:       # sala de máquinas de los ascensores
        caja('techo', M_FACH, gnu['x0'] + 0.2, gnu['y0'] + 0.2, TECHO, gnu['x1'] - 0.2, gnu['y1'] - 0.2, TECHO + 2.8)
        caja('techo', M_FRANJA, gnu['x0'] + 0.1, gnu['y0'] + 0.1, TECHO + 2.8, gnu['x1'] - 0.1, gnu['y1'] - 0.1, TECHO + 3.0)
rnd = random.Random(7)
celdas_techo = [(i, j) for j in range(NY) for i in range(NX) if MASK[NP - 1][j, i]]
for k in range(10):          # equipos de climatización
    i, j = celdas_techo[rnd.randrange(len(celdas_techo))]
    x, y = i * C, j * C
    if all(MASK[NP - 1][jj, ii] for ii in range(i - 2, i + 4) for jj in range(j - 2, j + 3) if 0 <= ii < NX and 0 <= jj < NY) and \
       not any(g['x0'] - 3 < x < g['x1'] + 3 and g['y0'] - 3 < y < g['y1'] + 3 for g in NUCLEOS):
        caja('techo', M_HVAC, x, y, TECHO, x + 3.2, y + 1.8, TECHO + 1.6)
        cilindro('techo', M_OSCURO, (x + 0.9, y + 0.9, TECHO + 1.6), 0.55, 0.15)
        cilindro('techo', M_OSCURO, (x + 2.3, y + 0.9, TECHO + 1.6), 0.55, 0.15)

# ------------------------------------------------------------------ exterior
S = D['sitio']
G_EXT = 'exterior'


def en_poligono(x, y, pts):
    c = False
    for k in range(len(pts)):
        (x0, y0), (x1, y1) = pts[k - 1], pts[k]
        if (y0 > y) != (y1 > y) and x < x0 + (y - y0) * (x1 - x0) / (y1 - y0): c = not c
    return c


lote = S['lote']
cara(G_EXT, M_CESPED, [(x, y, -0.03) for x, y in lote], [0, 0, 1])
for nombre, cl in S['calles'].items():
    (ax, ay), (bx, by) = cl['eje']
    L = math.hypot(bx - ax, by - ay); ux, uy = (bx - ax) / L, (by - ay) / L; nx_, ny_ = -uy, ux
    w = cl['ancho'] / 2
    q = lambda s, t_, z: (ax + ux * s + nx_ * t_, ay + uy * s + ny_ * t_, z)
    cara(G_EXT, M_ASF, [q(0, -w, -0.01), q(L, -w, -0.01), q(L, w, -0.01), q(0, w, -0.01)], [0, 0, 1])
    for sgn in (-1, 1):       # veredas
        a_, b_ = sorted((sgn * w, sgn * (w + 3.0)))
        cara(G_EXT, M_ACERA, [q(0, a_, 0.0), q(L, a_, 0.0), q(L, b_, 0.0), q(0, b_, 0.0)], [0, 0, 1])
    for s in np.arange(4, L - 4, 9.0):        # línea central discontinua
        cara(G_EXT, M_PINTURA_VIAL, [q(s, -0.08, -0.005), q(s + 4.5, -0.08, -0.005), q(s + 4.5, 0.08, -0.005), q(s, 0.08, -0.005)], [0, 0, 1])
autos = 0
for nombre, pp in S['parqueos'].items():
    cara(G_EXT, M_ASF, [(x, y, -0.015) for x, y in pp], [0, 0, 1])
    # autos estacionados en filas a lo largo del lado más largo
    lados = [(pp[k - 1], pp[k]) for k in range(len(pp))]
    (ax, ay), (bx, by) = max(lados, key=lambda s: math.hypot(s[1][0] - s[0][0], s[1][1] - s[0][1]))
    L = math.hypot(bx - ax, by - ay); ux, uy = (bx - ax) / L, (by - ay) / L
    cx, cy = sum(v[0] for v in pp) / len(pp), sum(v[1] for v in pp) / len(pp)
    nx_, ny_ = -uy, ux
    if (cx - ax) * nx_ + (cy - ay) * ny_ < 0: nx_, ny_ = -nx_, -ny_
    rot = math.degrees(math.atan2(ny_, nx_))
    rr = random.Random(len(nombre))
    for fila in (3.0, 14.0, 19.5, 30.5):
        for s in np.arange(3.0, L - 3.0, 2.6):
            x, y = ax + ux * s + nx_ * fila, ay + uy * s + ny_ * fila
            if not en_poligono(x, y, pp) or not en_poligono(x + nx_ * 4.5, y + ny_ * 4.5, pp): continue
            # rayas de los puestos
            cara(G_EXT, M_PINTURA_VIAL, [(x - ux * 0.05, y - uy * 0.05, -0.005), (x + ux * 0.05, y + uy * 0.05, -0.005),
                                         (x + ux * 0.05 + nx_ * 4.8, y + uy * 0.05 + ny_ * 4.8, -0.005), (x - ux * 0.05 + nx_ * 4.8, y - uy * 0.05 + ny_ * 4.8, -0.005)], [0, 0, 1])
            if rr.random() < 0.62:
                px, py = x + ux * 1.3 + nx_ * 0.3, y + uy * 1.3 + ny_ * 0.3
                instancia(G_EXT, 'Auto', px, py, 0, rot if fila in (3.0, 19.5) else rot, 1.0, AUTOS[rr.randrange(len(AUTOS))])
                autos += 1
# veredas perimetrales y plazas de acceso
anillo = np.zeros_like(MASK[0])
m0 = MASK[0]
for dj in range(-2, 3):
    for di in range(-2, 3):
        anillo |= np.roll(np.roll(m0, dj, axis=0), di, axis=1)
anillo &= ~m0
for i0, j0, i1, j1 in rectangulos(anillo): plano(G_EXT, M_ACERA, i0 * C, j0 * C, i1 * C, j1 * C, 0.0)
plano(G_EXT, M_PLAZA, -16.0, 84.0, -2.4, 106.8, 0.01)
plano(G_EXT, M_ASF, 78.0, -16.0, 103.2, -2.4, 0.005)
for k in range(5):     # cebra del ingreso de ambulancias
    plano(G_EXT, M_PINTURA_VIAL, 80.0 + k * 1.0, -14.5, 80.5 + k * 1.0, -10.5, 0.012)
instancia(G_EXT, 'Ambulancia', 86.0, -9.5, 0, 90)
instancia(G_EXT, 'Ambulancia', 95.0, -9.5, 0, 90)
for k in range(4):
    instancia(G_EXT, 'Banca exterior', -12.0, 87.0 + k * 5.5, 0, 90)
    instancia(G_EXT, 'Poste de luz', -15.0, 88.0 + k * 5.5, 0, 0)
# árboles en el lote, lejos del edificio, calles y parqueos
rnd = random.Random(11)
xs = [v[0] for v in lote]; ys = [v[1] for v in lote]
lejos = np.zeros_like(MASK[0])
for dj in range(-4, 5):
    for di in range(-4, 5):
        lejos |= np.roll(np.roll(m0, dj, axis=0), di, axis=1)
arboles = 0
for k in range(2600):
    if arboles >= 170: break
    x, y = rnd.uniform(min(xs), max(xs)), rnd.uniform(min(ys), max(ys))
    if not en_poligono(x, y, lote): continue
    i, j = int(x // C), int(y // C)
    if 0 <= i < NX and 0 <= j < NY and lejos[j, i]: continue
    if -6 <= i < NX + 6 and -6 <= j < NY + 6 and 0 <= i < NX and 0 <= j < NY and lejos[max(0, j - 2):j + 3, max(0, i - 2):i + 3].any(): continue
    if any(en_poligono(x, y, pp) for pp in S['parqueos'].values()): continue
    if -20 < x < 0 and 80 < y < 110: continue
    if 74 < x < 106 and -20 < y < 0: continue
    lejos_calle = True
    for cl in S['calles'].values():
        (ax, ay), (bx, by) = cl['eje']
        L = math.hypot(bx - ax, by - ay); t = max(0, min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / (L * L)))
        if math.hypot(x - ax - t * (bx - ax), y - ay - t * (by - ay)) < cl['ancho'] / 2 + 6: lejos_calle = False
    if not lejos_calle: continue
    instancia(G_EXT, 'Árbol frondoso' if rnd.random() < 0.65 else 'Árbol columnar', x, y, -0.03, rnd.uniform(0, 360), rnd.uniform(0.8, 1.25))
    arboles += 1

# ------------------------------------------------------------------ portal: marquesinas y letreros de acceso
G_P = 'portal'
yp = 95.4
caja(G_P, M_BLANCO, -7.0, yp - 4.2, 3.55, 0.0, yp + 4.2, 3.85)
caja(G_P, M_VERDE, -7.05, yp - 4.25, 3.4, -6.9, yp + 4.25, 3.86)
for dy in (-3.6, 3.6): cilindro(G_P, M_ACERO, (-6.3, yp + dy, 0), 0.14, 3.55)
caja(G_P, M_VERDE, -0.2, yp - 4.0, 2.75, -0.16, yp + 4.0, 3.45)
texto(G_P, M_TEXTO_B, 'HOSPITAL SOLCA · INGRESO PRINCIPAL', 0.42, (-0.205, yp, 3.1), (0, -1, 0), (0, 0, 1))
texto(G_P, M_VERDE, 'SOLCA', 1.6, (-0.2, yp, HP * 2 + 2.4), (0, -1, 0), (0, 0, 1))
xe = 90.6
caja(G_P, M_BLANCO, xe - 5.0, -6.5, 3.75, xe + 5.0, 0.0, 4.05)
caja(G_P, M_ROJO, xe - 5.05, -6.55, 3.6, xe + 5.05, -6.4, 4.06)
for dx in (-4.4, 4.4): cilindro(G_P, M_ACERO, (xe + dx, -5.8, 0), 0.14, 3.75)
caja(G_P, M_ROJO, xe - 3.5, -0.2, 2.75, xe + 3.5, -0.16, 3.45)
texto(G_P, M_TEXTO_B, 'EMERGENCIA', 0.5, (xe, -0.205, 3.1), (1, 0, 0), (0, 0, 1))

# ------------------------------------------------------------------ salida
usados = {q[1] for ps in partes.values() for q in ps if q[0] == 'i'}
salida = {'mats': mats, 'defs': {k: v for k, v in DEFS.items() if k in usados}, 'partes': dict(partes), 'textos': textos}
destino = os.path.join(RAIZ, 'src', 'data', 'modelo_sk.json')
json.dump(salida, open(destino, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(destino, os.path.getsize(destino) // 1024, 'KB ·', {k: len(v) for k, v in sorted(partes.items())}, '· textos', len(textos), '· autos', autos, '· árboles', arboles)

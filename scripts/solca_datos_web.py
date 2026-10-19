"""
Genera src/data/hospital3d.json para el visor (mapa 2D, rutas A* y superficies del recorrido 3D).

    python3 scripts/solca_datos_web.py
"""
import json, math, os, sys
from collections import defaultdict, deque
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from solca_comun import *

RADIO = 0.27          # holgura de las rutas respecto a muros y columnas


class Grafo:
    def __init__(self):
        self.nodos, self.aristas, self.vistas = {}, [], set()

    def nodo(self, nid, x, y, piso, tipo, zona, h=None, **extra):
        if nid not in self.nodos:
            self.nodos[nid] = {'id': nid, 'x': r3(x), 'y': r3(y), 'piso': piso, 'h': r3(piso * HP if h is None else h), 'tipo': tipo, 'zona': zona, **extra}
        return nid

    def arista(self, a, b, t='caminar'):
        if a == b: return
        k = tuple(sorted((a, b)))
        if k in self.vistas: return
        self.vistas.add(k); self.aristas.append([a, b, t])


G = Grafo()
cuartos, piezas_out, ventanas_out, columnas_out, obstaculos, escaleras, destinos, banos = [], [], [], [], {}, [], [], []
contornos, info_pisos = {}, []
puertas_out = []


def fmt(v): return f'{v:.1f}'


for P in PISOS:
    p, c = P.p, P.c
    ventanas = ventanas_web(P)
    piezas = piezas_de(P, ventanas)
    cols = columnas_web(P, piezas)
    info_pisos.append({'nivel': p, 'clave': c.upper(), 'nombre': NOMBRE[p]})
    contornos[p] = D['pisos'][p]['contorno']

    # ---------------- ambientes en rectángulos
    for rm in P.rooms:
        m = P.g == rm['k']
        for i0, j0, i1, j1 in rectangulos(m):
            cuartos.append({'id': rm['id'], 'nombre': rm['nombre'], 'dep': rm['dep'], 'cat': rm['cat'], 'tipo': rm['tipo'], 'piso': p,
                            'x0': r3(i0 * C), 'y0': r3(j0 * C), 'x1': r3(i1 * C), 'y1': r3(j1 * C)})
    for i0, j0, i1, j1 in rectangulos(P.g == -2):
        cuartos.append({'id': P.pasillo_id, 'nombre': 'Pasillo', 'dep': 'Pasillo', 'cat': 'circulacion', 'tipo': 'pasillo', 'piso': p,
                        'x0': r3(i0 * C), 'y0': r3(j0 * C), 'x1': r3(i1 * C), 'y1': r3(j1 * C)})
    for g in P.nucleos:
        n = geo_nucleo(g)
        L = g['letra']
        base = {'cat': 'circulacion', 'piso': p}
        cuartos.append({**base, 'id': f'{c}-hall-{L.lower()}', 'nombre': f'Hall de ascensores {L}', 'dep': f'Ascensores {L}', 'tipo': 'hall',
                        'x0': r3(n['x0']), 'y0': r3(n['y0']), 'x1': r3(n['x1']), 'y1': r3(n['yh'])})
        cuartos.append({**base, 'id': f'{c}-escalera-{L.lower()}', 'nombre': f'Escalera {L}', 'dep': f'Ascensores {L}', 'tipo': 'escalera',
                        'x0': r3(n['x0']), 'y0': r3(n['yh']), 'x1': r3(n['xm']), 'y1': r3(n['y1'])})
        cuartos.append({**base, 'id': f'{c}-ascensores-{L.lower()}', 'nombre': f'Ascensores {L}', 'dep': f'Ascensores {L}', 'tipo': 'ascensores',
                        'x0': r3(n['xm']), 'y0': r3(n['yh']), 'x1': r3(n['x1']), 'y1': r3(n['y1'])})
        if p + 1 in g['pisos']:
            escaleras.append({'id': L.lower(), 'nombre': f'Escalera {L}', 'piso': p, 'x0': r3(n['x0']), 'x1': r3(n['xm']), 'y0': r3(n['yh']), 'y1': r3(n['y1'])})
    if p == 0:
        cuartos.append({'id': 'plaza', 'nombre': 'Plaza de ingreso', 'dep': 'Plaza de ingreso', 'cat': 'circulacion', 'tipo': 'exterior', 'piso': 0,
                        'x0': -16.0, 'y0': 84.0, 'x1': -0.15, 'y1': 106.8})
        cuartos.append({'id': 'pb-ext-emergencia', 'nombre': 'Ingreso de ambulancias', 'dep': 'Ingreso de ambulancias', 'cat': 'circulacion', 'tipo': 'exterior',
                        'piso': 0, 'x0': 80.4, 'y0': -14.0, 'x1': 100.8, 'y1': -0.15})

    # ---------------- piezas de muro (2D) y obstáculos
    obs = []
    for q in piezas:
        x0, y0, x1, y1 = rect_pieza(q)
        if q['rol'] == 'puerta':
            piezas_out.append({'piso': p, 'x0': x0, 'y0': y0, 'x1': x1, 'y1': y1, 'h0': 2.2, 'h1': TOP, 'rol': 'dintel', 'ext': q['tipo'] == 'ext'})
            continue
        rol = 'bajo' if q['rol'] == 'ventana' else 'solido'
        piezas_out.append({'piso': p, 'x0': x0, 'y0': y0, 'x1': x1, 'y1': y1, 'h0': 0, 'h1': 0.9 if rol == 'bajo' else TOP, 'rol': rol, 'ext': q['tipo'] == 'ext'})
        obs.append([x0, y0, x1, y1, 'muro'])
    for g in P.nucleos:
        for x0, y0, x1, y1, que, alto in muros_nucleo(P, g):
            piezas_out.append({'piso': p, 'x0': r3(x0), 'y0': r3(y0), 'x1': r3(x1), 'y1': r3(y1), 'h0': 0, 'h1': alto, 'rol': 'solido' if que == 'muro' else 'baranda', 'ext': False})
            obs.append([r3(x0), r3(y0), r3(x1), r3(y1), que])
    for x, y in cols:
        columnas_out.append({'piso': p, 'x': x, 'y': y, 'h': TOP})
        obs.append([r3(x - 0.25), r3(y - 0.25), r3(x + 0.25), r3(y + 0.25), 'columna'])
    for v in ventanas:
        ventanas_out.append({'piso': p, 'eje': v['eje'], 'c': v['c'], 'a': v['a'], 'b': v['b'], 't': 0.3, 'alf': 0.9, 'din': 2.4})
    obstaculos[str(p)] = obs
    OB = np.array([o[:4] for o in obs])

    def libre(a, b, r=RADIO):
        n = max(2, int(math.hypot(b[0] - a[0], b[1] - a[1]) / 0.05) + 1)
        t = np.linspace(0, 1, n)[:, None]
        pts = np.array(a)[None, :] * (1 - t) + np.array(b)[None, :] * t
        X, Y = pts[:, 0:1], pts[:, 1:2]
        hit = (X > OB[:, 0] - r) & (X < OB[:, 2] + r) & (Y > OB[:, 1] - r) & (Y < OB[:, 3] + r)
        return not hit.any()

    # ---------------- pasillos: eje central sobre la retícula de esquinas (medios módulos)
    Pm = P.g == -2
    esquinas = set()
    for j in range(1, NY):
        for i in range(1, NX):
            if Pm[j - 1, i - 1] and Pm[j - 1, i] and Pm[j, i - 1] and Pm[j, i]: esquinas.add((i, j))
    fino = defaultdict(set)      # nodos en medios módulos (2i, 2j)
    for (i, j) in esquinas:
        for di, dj in ((1, 0), (0, 1)):
            if (i + di, j + dj) in esquinas:
                a, m_, b = (2 * i, 2 * j), (2 * i + di, 2 * j + dj), (2 * i + 2 * di, 2 * j + 2 * dj)
                fino[a].add(m_); fino[m_].add(a); fino[m_].add(b); fino[b].add(m_)
    # tramos de pasillo de un solo módulo de ancho: nodos en el centro de esas celdas y de sus vecinas
    def con_esquina(i, j): return any((a, b) in esquinas for a in (i, i + 1) for b in (j, j + 1))
    solas = {(i, j) for j in range(NY) for i in range(NX) if Pm[j, i] and not con_esquina(i, j)}
    S = set(solas)
    for (i, j) in solas:
        for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            if 0 <= i + di < NX and 0 <= j + dj < NY and Pm[j + dj, i + di]: S.add((i + di, j + dj))
    protegidos = set()
    for (i, j) in S:
        q = (2 * i + 1, 2 * j + 1)
        fino.setdefault(q, set()); protegidos.add(q)
    for (i, j) in S:
        q = (2 * i + 1, 2 * j + 1)
        for di, dj in ((1, 0), (0, 1)):
            if (i + di, j + dj) in S:
                o = (2 * i + 2 * di + 1, 2 * j + 2 * dj + 1)
                if libre((q[0] * C / 2, q[1] * C / 2), (o[0] * C / 2, o[1] * C / 2)): fino[q].add(o); fino[o].add(q)
        if (i, j) in solas: continue
        # celda vecina dentro de un tramo ancho: unir a las esquinas/medios de su contorno
        for a in range(2 * i, 2 * i + 3):
            for b in range(2 * j, 2 * j + 3):
                o = (a, b)
                if o == q or o not in fino or (a % 2 and b % 2): continue
                if libre((q[0] * C / 2, q[1] * C / 2), (o[0] * C / 2, o[1] * C / 2)):
                    fino[q].add(o); fino[o].add(q); protegidos.add(o)

    def enganchar(x, y, desde):
        """nodo del eje del pasillo más cercano a (x, y) con línea libre desde el punto 'desde'"""
        q = (round(x / C * 2), round(y / C * 2))
        if q in fino and abs(q[0] * C / 2 - x) < 1e-6 and abs(q[1] * C / 2 - y) < 1e-6:
            return q
        mejor = None
        for f in fino:
            d = math.hypot(f[0] * C / 2 - desde[0], f[1] * C / 2 - desde[1])
            if d < 3.2 and (mejor is None or d < mejor[0]) and libre(desde, (f[0] * C / 2, f[1] * C / 2)): mejor = (d, f)
        return mejor[1] if mejor else None

    enganches = []     # (punto fino, id del nodo de puerta)

    # ---------------- recorridos dentro de cada ambiente
    def camino_en(rm, a, b):
        """ruta entre dos puntos dentro de un ambiente: BFS por celdas y tensado con línea libre"""
        celdas = set((i, j) for j, i in rm['cells'])
        ca, cb = P.celda(*a), P.celda(*b)
        if ca not in celdas or cb not in celdas: return [a, b]
        prev = {ca: None}; q = deque([ca])
        while q:
            u = q.popleft()
            if u == cb: break
            for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                v = (u[0] + di, u[1] + dj)
                if v in celdas and v not in prev: prev[v] = u; q.append(v)
        if cb not in prev: return None
        ruta = []
        u = cb
        while u is not None: ruta.append(((u[0] + 0.5) * C, (u[1] + 0.5) * C)); u = prev[u]
        ruta = ruta[::-1]
        ruta[0], ruta[-1] = a, b
        out = [a]; k = 0
        while k < len(ruta) - 1:
            sig = k + 1
            for t in range(len(ruta) - 1, k, -1):
                if libre(out[-1], ruta[t]): sig = t; break
            out.append(ruta[sig]); k = sig
        return out

    def enlazar_puerta(d, zona_dentro, punto_dentro, nid_amb, rm):
        """nodo de puerta + paso interior + recorrido hasta el nodo del ambiente"""
        a, b, nrm = lados_puerta(P, d)
        x, y = d['x'], d['y']
        dentro_es_b = punto_dentro(a, b)
        s = 1 if dentro_es_b else -1
        nx_, ny_ = nrm[0] * s, nrm[1] * s
        did = G.nodo(f'{c}-d-{fmt(x)}-{fmt(y)}', x, y, p, 'puerta', None)
        iid = G.nodo(f'{c}-i-{fmt(x)}-{fmt(y)}', x + nx_ * 0.6, y + ny_ * 0.6, p, 'paso', zona_dentro)
        G.arista(did, iid)
        interiores[zona_dentro].append((iid, (x + nx_ * 0.6, y + ny_ * 0.6), rm))
        if nid_amb:
            pts = camino_en(rm, (x + nx_ * 0.6, y + ny_ * 0.6), (G.nodos[nid_amb]['x'], G.nodos[nid_amb]['y']))
            if pts is None: raise SystemExit(f'sin camino interior en {rm["id"]}')
            prev = iid
            for (wx, wy) in pts[1:-1]:
                w = G.nodo(f'{c}-w-{fmt(wx)}-{fmt(wy)}', wx, wy, p, 'paso', zona_dentro)
                G.arista(prev, w); prev = w
            G.arista(prev, nid_amb)
        return did, (x - nx_ * 1.2, y - ny_ * 1.2), (x - nx_ * 0.6, y - ny_ * 0.6), (-nx_, -ny_)

    interiores = defaultdict(list)     # pasos interiores de cada puerta, por ambiente
    amb_id = {}
    for rm in P.rooms:
        ax, ay = rm['amb']
        amb_id[rm['k']] = G.nodo(f"{rm['id']}-amb", ax, ay, p, 'ambiente', rm['id'], ref=rm['id'])
    for d in P.puertas:
        if d.get('nucleo') or d.get('exterior'): continue
        rm = P.rooms[d['cuarto']]
        did, eje_pt, fuera_pt, _ = enlazar_puerta(d, rm['id'], lambda a, b: b[0] == 'R' and b[1] == rm['k'], amb_id[rm['k']], rm)
        f = enganchar(*eje_pt, desde=fuera_pt)
        if f is None: raise SystemExit(f'puerta sin pasillo {rm["id"]} {d}')
        enganches.append((f, did, fuera_pt))
    # accesos exteriores (planta baja)
    salidas = []
    for d in P.puertas:
        if not d.get('exterior'): continue
        a, b, nrm = lados_puerta(P, d)
        lado = b if b[0] == 'R' else a
        rm = P.rooms[lado[1]]
        zona_ext = 'plaza' if d['nombre'] == 'Acceso principal' else 'pb-ext-emergencia'
        did, _, fuera_pt, (ox, oy) = enlazar_puerta(d, rm['id'], lambda a, b: b[0] == 'R', amb_id[rm['k']], rm)
        oid = G.nodo(f"pb-o-{'principal' if zona_ext == 'plaza' else 'emergencia'}", d['x'] + ox * 1.2, d['y'] + oy * 1.2, 0, 'paso', zona_ext)
        G.arista(did, oid)
        lejos = (d['x'] + ox * 8, d['y'] + oy * 8)
        fid = G.nodo('pb-plaza' if zona_ext == 'plaza' else 'pb-ambulancias', lejos[0], lejos[1], 0, 'paso', zona_ext)
        G.arista(oid, fid)
        salidas.append({'nombre': 'Entrada principal' if zona_ext == 'plaza' else 'Entrada de Emergencia', 'codigo': 'entrada-principal' if zona_ext == 'plaza' else 'entrada-emergencia',
                        'nodo': oid, 'piso': 0, 'x': G.nodos[oid]['x'], 'y': G.nodos[oid]['y'], 'cat': 'salidas'})
    # ambientes con varias puertas: enlace directo entre ellas (sin desviarse al centro del ambiente)
    for zona, lst in interiores.items():
        for u in range(len(lst)):
            for w_ in range(u + 1, len(lst)):
                (ia, pa, rm), (ib, pb_, _) = lst[u], lst[w_]
                pts = camino_en(rm, pa, pb_)
                if not pts: continue
                prev = ia
                for (wx, wy) in pts[1:-1]:
                    w = G.nodo(f'{c}-w-{fmt(wx)}-{fmt(wy)}', wx, wy, p, 'paso', zona)
                    G.arista(prev, w); prev = w
                G.arista(prev, ib)
    # núcleos
    for g in P.nucleos:
        n = geo_nucleo(g); L = g['letra'].lower()
        hall_id, esc_id, asc_id = f'{c}-hall-{L}', f'{c}-escalera-{L}', f'{c}-ascensores-{L}'
        dx, dy = n['puerta']
        did = G.nodo(f'{c}-d-{fmt(dx)}-{fmt(dy)}', dx, dy, p, 'puerta', None)
        hid = G.nodo(f'{c}-n-{L}-hall', *n['hall'], p, 'ambiente', hall_id, ref=hall_id)
        G.arista(did, hid)
        f = enganchar(dx, dy - 1.2, desde=(dx, dy - 0.6))
        if f is None: raise SystemExit(f'núcleo sin pasillo {L} piso {p}')
        enganches.append((f, did, (dx, dy - 0.6)))
        for k, (cx, cy) in enumerate(n['cabinas']):
            fr = G.nodo(f'{c}-n-{L}-frente{k}', cx, n['hall'][1], p, 'paso', hall_id)
            ca = G.nodo(f'{c}-asc-{L}{k}', cx, cy, p, 'ascensor', asc_id)
            G.arista(hid, fr); G.arista(fr, ca)
            if p > 0 and p - 1 in g['pisos']: G.arista(f'{CLAVE[p - 1]}-asc-{L}{k}', ca, 'ascensor')
        if p + 1 in g['pisos']:
            a0 = G.nodo(f'{c}-esc-{L}-a0', *n['esc_sube'], p, 'escalera', hall_id)
            a1 = G.nodo(f'{c}-esc-{L}-a1', *n['descanso'], p, 'escalera', esc_id, h=p * HP + HP / 2)
            a2 = G.nodo(f'{c}-esc-{L}-a2', *n['descanso2'], p, 'escalera', esc_id, h=p * HP + HP / 2)
            G.arista(hid, a0); G.arista(a0, a1, 'escalera'); G.arista(a1, a2, 'escalera')
        if p - 1 in g['pisos']:
            ll = G.nodo(f'{c}-esc-{L}-llegada', *n['esc_llega'], p, 'escalera', hall_id)
            G.arista(hid, ll); G.arista(f'{CLAVE[p - 1]}-esc-{L}-a2', ll, 'escalera')
        destinos.append({'nombre': f'Ascensores {g["letra"]}', 'cat': 'circulacion', 'piso': p, 'nodo': hid, 'x': r3(n['x0'] + 3.6), 'y': r3(n['y0'] + 3.6),
                         'codigo': f'{c}-ascensores-{L}'})

    # ---------------- simplificar el eje del pasillo y unir las puertas
    puntos_enganche = set(f for f, _, _ in enganches)
    def colineal(f):
        vs = list(fino[f])
        if len(vs) != 2: return False
        (a, b) = vs
        return (a[0] - f[0]) * (b[1] - f[1]) - (a[1] - f[1]) * (b[0] - f[0]) == 0
    clave_f = lambda f: f'{c}-e-{fmt(f[0] * C / 2)}-{fmt(f[1] * C / 2)}'
    mantener = {f for f in fino if f in puntos_enganche or f in protegidos or not colineal(f)}
    for f in mantener:
        G.nodo(clave_f(f), f[0] * C / 2, f[1] * C / 2, p, 'pasillo', P.pasillo_id)
    hechos = set()
    for f in mantener:
        for v in fino[f]:
            prev, cur = f, v
            while cur not in mantener:
                nxt = [w for w in fino[cur] if w != prev]
                prev, cur = cur, nxt[0]
            k = tuple(sorted((f, cur)))
            if k in hechos or f == cur: continue
            hechos.add(k)
            G.arista(clave_f(f), clave_f(cur))
    for f, did, fuera_pt in enganches:
        G.arista(clave_f(f), did)

    # ---------------- destinos por departamento y baños
    por_dep = defaultdict(list)
    for rm in P.rooms:
        if rm['tipo'] in ('banos_h', 'banos_m'):
            banos.append(f"{rm['id']}-amb")
            destinos.append({'nombre': rm['nombre'], 'cat': 'servicios', 'piso': p, 'nodo': f"{rm['id']}-amb", 'x': r3(rm['amb'][0]), 'y': r3(rm['amb'][1]),
                             'codigo': rm['id']})
        else: por_dep[rm['dep']].append(rm)
    for dep, lst in por_dep.items():
        rm = max(lst, key=lambda r: r['area'])
        destinos.append({'nombre': dep, 'cat': rm['cat'], 'piso': p, 'nodo': f"{rm['id']}-amb", 'x': r3(rm['amb'][0]), 'y': r3(rm['amb'][1]),
                         'codigo': f'{c}-{slug(dep)}'})
    if p == 0: salidas_pb = salidas

    # puertas para el 3D
    for d in P.puertas:
        a, b, nrm = lados_puerta(P, d)
        puertas_out.append({'piso': p, 'x': d['x'], 'y': d['y'], 'eje': d['eje'], 'ancho': d['ancho'], 'nucleo': bool(d.get('nucleo')), 'exterior': bool(d.get('exterior')),
                            'hacia': 1 if (b[0] == 'R' and (d.get('cuarto', -1) < 0 or b[1] == d['cuarto'])) else -1,
                            'dep': P.rooms[d['cuarto']]['dep'] if d.get('cuarto', -1) >= 0 else None,
                            'cat': P.rooms[d['cuarto']]['cat'] if d.get('cuarto', -1) >= 0 else None})

# ------------------------------------------------------------------ comprobaciones
ids = G.nodos
adj = defaultdict(set)
for a, b, t in G.aristas:
    assert a in ids and b in ids, (a, b)
    adj[a].add(b); adj[b].add(a)
vis = {'pb-plaza'}; q = deque(['pb-plaza'])
while q:
    u = q.popleft()
    for v in adj[u]:
        if v not in vis: vis.add(v); q.append(v)
sueltos = [n for n in ids if n not in vis]
print('nodos', len(ids), '· aristas', len(G.aristas), '· inalcanzables', len(sueltos), sueltos[:8])
for d in destinos + salidas_pb:
    assert d['nodo'] in vis, d

codigos = defaultdict(int)
for d in destinos:
    codigos[d['codigo']] += 1
    if codigos[d['codigo']] > 1: d['codigo'] += f"-{codigos[d['codigo']]}"

sitio = D['sitio']
H = {'nombre': 'Hospital SOLCA Quito', 'nota': 'Prototipo académico: silueta, accesos y entorno del mapa real; distribución interior propuesta.',
     'alturaPiso': HP, 'altoMuroExt': TOP, 'altoMuroInt': TOP, 'ancho': ANCHO, 'largo': LARGO, 'anguloNorte': D['angulo_norte'],
     'pisos': info_pisos, 'inicio': 'pb-plaza', 'salidas': salidas_pb,
     'contornos': contornos, 'sitio': {'lote': sitio['lote'], 'calles': sitio['calles'], 'parqueos': sitio['parqueos']},
     'cuartos': cuartos, 'piezas': piezas_out, 'columnas': columnas_out, 'puertas': puertas_out, 'ventanas': ventanas_out, 'muebles': [], 'escaleras': escaleras,
     'obstaculos': obstaculos, 'nodos': list(G.nodos.values()), 'aristas': G.aristas, 'destinos': destinos, 'banos': banos}
salida = os.path.join(RAIZ, 'src', 'data', 'hospital3d.json')
json.dump(H, open(salida, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(salida, os.path.getsize(salida) // 1024, 'KB ·', len(cuartos), 'rectángulos ·', len(piezas_out), 'piezas ·', len(destinos), 'destinos ·', len(banos), 'baños')

"""
Plano 2D de presentación de la planta baja (PDF A1 a escala 1:200 y PNG), dibujado desde el modelo hecho
con el plano real: ambientes coloreados por categoría con su nombre y área, muros, tabiques, columnas,
ventanas, puertas con su barrido, mobiliario, sanitarios, escaleras y viseras.
Uso: python3 planta_real/revit/plano_2d.py   (lee /tmp/modelo.pkl que deja generar.py --pickle)
"""
import os
import sys
import math
import pickle
import datetime
import textwrap
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patheffects as pe
from matplotlib.patches import Polygon as MPoly, Rectangle, FancyArrow
from matplotlib.collections import LineCollection, PatchCollection
from matplotlib import font_manager
from shapely.ops import polylabel
from shapely.geometry import LineString

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
from categorias import CATEGORIAS, categoria  # noqa: E402
from modelo import lista_polis, min_ancho  # noqa: E402

ESCALA = 200                      # 1:200
MM = 1 / 25.4                     # pulgadas por mm
PT_POR_M = 1000 / ESCALA / 25.4 * 72   # puntos tipográficos por metro dibujado
AZUL = '#0a5ca6'
TINTA = '#1d1d1f'
OBST = None

for f in ('/usr/share/fonts/opentype/inter/Inter-Regular.otf', '/usr/share/fonts/opentype/inter/Inter-SemiBold.otf',
          '/usr/share/fonts/opentype/inter/Inter-Bold.otf'):
    if os.path.exists(f):
        font_manager.fontManager.addfont(f)
plt.rcParams['font.family'] = ['Inter', 'DejaVu Sans']


def parches(polis, **k):
    ps = []
    for g in polis:
        for q in lista_polis(g):
            ps.append(MPoly(list(q.exterior.coords), closed=True))
            for h in q.interiors:
                ps.append(MPoly(list(h.coords), closed=True))
    return PatchCollection(ps, **k)


def rellenar(ax, polis, color, z, lw=0, ec='none', alpha=1.0):
    for g in polis:
        for q in lista_polis(g):
            ax.fill(*q.exterior.xy, color=color, lw=lw, ec=ec, zorder=z, alpha=alpha)
            for h in q.interiors:
                ax.fill(*h.xy, color='white', lw=0, zorder=z)


def contorno(ax, polis, color, lw, z, ls='-'):
    for g in polis:
        for q in lista_polis(g):
            ax.plot(*q.exterior.xy, color=color, lw=lw, zorder=z, ls=ls, solid_joinstyle='miter')


def rotulo(ax, a):
    nom = a['nombre']
    if not nom:
        return
    pg = a['poligono']
    libre = pg.difference(OBST).buffer(0) if OBST is not None else pg
    piezas = lista_polis(libre)
    base = max(piezas, key=lambda q: q.area) if piezas and max(q.area for q in piezas) > 0.3 * pg.area else pg
    nom = nom.replace(' / ', ' · ').replace(' - ', '\u00a0–\u00a0')
    con_area = a['area'] >= 4

    def ajuste(c):
        def tramo(p0, p1):
            g = LineString([p0, p1]).intersection(pg)
            for q in getattr(g, 'geoms', [g]):
                if q.distance(c) < 1e-6:
                    return q.length
            return 0.6
        hx = tramo((c.x - 200, c.y), (c.x + 200, c.y)) * 0.78
        vy = tramo((c.x, c.y - 200), (c.x, c.y + 200)) * 0.85
        # tamaño de letra que entra en el ambiente (aprox. 0,68 em por carácter en mayúsculas)
        for fs in (8.5, 7.5, 6.5, 5.5, 4.8, 4.2, 3.6, 3.0, 2.6):
            cols = max(int(hx * PT_POR_M / (0.68 * fs)), 4)
            lineas = textwrap.wrap(nom, cols, break_long_words=False) or [nom]
            anch = max(len(l) for l in lineas) * 0.68 * fs / PT_POR_M
            alto = (len(lineas) + (0.9 if con_area else 0)) * fs * 1.2 / PT_POR_M
            if anch <= hx and alto <= vy:
                break
        return fs, lineas

    cands = []
    for g in (base, pg):
        try:
            cands.append(polylabel(g, tolerance=0.05))
        except Exception:
            cands.append(g.representative_point())
    mejor = None
    for k, c_ in enumerate(cands):
        fs_, lin_ = ajuste(c_)
        if mejor is None or fs_ > mejor[0] + (1.5 if k else 0):
            mejor = (fs_, lin_, c_)
    fs, lineas, c = mejor
    texto = '\n'.join(lineas)
    peso = 'semibold' if a['area'] >= 8 else 'normal'
    halo = [pe.withStroke(linewidth=1.6, foreground=(1, 1, 1, 0.85))]
    ax.text(c.x, c.y + 0.12, texto, ha='center', va='center', fontsize=fs, color=TINTA, weight=peso, zorder=30,
            linespacing=1.05, path_effects=halo)
    if con_area and fs >= 3.6:
        ax.text(c.x, c.y - (len(lineas) * fs * 0.62) / PT_POR_M - 0.18, f"{a['area']:.1f} m²", ha='center',
                va='center', fontsize=max(fs - 2.2, 3.2), color='#555', zorder=30, path_effects=halo)


def dibujar(m, salida_pdf, salida_png):
    x0, y0, x1, y1 = m.huella.bounds
    for v in getattr(m, 'viseras', []):
        bx = v.bounds
        x0, y0, x1, y1 = min(x0, bx[0]), min(y0, bx[1]), max(x1, bx[2]), max(y1, bx[3])
    marg = 3.0
    x0, y0, x1, y1 = x0 - marg, y0 - marg, x1 + marg, y1 + marg
    # hoja A1 vertical (594 x 841 mm); el dibujo a 1:200 ocupa el área útil y el cajetín va abajo
    W, H = 594, 841
    fig = plt.figure(figsize=(W * MM, H * MM))
    ancho_mm = (x1 - x0) * 1000 / ESCALA
    alto_mm = (y1 - y0) * 1000 / ESCALA
    izq = (W - ancho_mm) / 2
    abajo = 115 + max((H - 10 - 115 - alto_mm) / 2, 0)
    ax = fig.add_axes([izq / W, abajo / H, ancho_mm / W, alto_mm / H])
    ax.set_xlim(x0, x1)
    ax.set_ylim(y0, y1)
    ax.set_aspect('equal')
    ax.axis('off')

    # pisos por categoría
    for a in m.ambientes:
        col = CATEGORIAS[categoria(a['nombre'])][1]
        rellenar(ax, [a['poligono']], col, 1)
    # viseras (proyección de cubierta)
    contorno(ax, getattr(m, 'viseras', []), '#7a7a7a', 0.6, 3, ls=(0, (6, 3)))
    # muebles y sanitarios
    for mu in m.muebles:
        if mu['nombre'].startswith('Respaldo'):
            rellenar(ax, [mu['poligono']], '#9aa3ad', 6)
            continue
        if mu['cat'] == 'sanitario':
            continue
        rellenar(ax, [mu['poligono']], '#ffffff', 5, lw=0.35, ec='#6b7280')
    # bloques (sanitarios, sillas, puertas: barrido) con su dibujo original
    lin_pu, lin_san = [], []
    for b in m.bloques:
        n = b['nombre']
        if 'COL' in n or n.startswith('FD') or n.startswith('Ventanilla'):
            continue
        es_puerta = n.startswith(('P-IZ', 'P-DE', '_U41', '_U42', '_U43', '_U44', '_U45', '-MP', 'P-DUC'))
        for g in b['geo']:
            pts = m.Lp(g[1])
            if len(pts) < 2:
                continue
            if g[2] and len(pts) >= 3:
                pts = pts + [pts[0]]
            (lin_pu if es_puerta else lin_san).append(pts)
    ax.add_collection(LineCollection(lin_san, colors='#4b5563', linewidths=0.3, zorder=7))
    ax.add_collection(LineCollection(lin_pu, colors='#374151', linewidths=0.35, zorder=12))
    # escaleras
    gr = [list(l.coords) for tr in m.tramos for l in tr]
    ax.add_collection(LineCollection(gr, colors='#374151', linewidths=0.35, zorder=8))
    # vidrios, ventanas y ventanillas
    for pg in m.ventanas + getattr(m, 'vidrios', []) + getattr(m, 'ventanillas', []):
        rellenar(ax, [pg], '#cfe8f7', 10, lw=0.35, ec='#2b6f9e')
    # tabiques, parapetos, muros y columnas
    rellenar(ax, [t['poligono'] for t in m.tabiques], '#4b5563', 11)
    rellenar(ax, getattr(m, 'parapetos', []), '#6b7280', 11)
    rellenar(ax, getattr(m, 'foso', []), TINTA, 11)
    rellenar(ax, m.muros, TINTA, 12)
    rellenar(ax, m.columnas, '#000000', 13)
    # vanos de puerta en blanco sobre el muro
    for p in m.puertas:
        rellenar(ax, [p['rect']], '#ffffff', 12.5)
    # nombres (en el espacio libre de muebles y tabiques)
    global OBST
    from shapely.ops import unary_union
    OBST = unary_union([mu['poligono'].buffer(0.12) for mu in m.muebles] +
                       [t['poligono'].buffer(0.12) for t in m.tabiques])
    for a in m.ambientes:
        rotulo(ax, a)

    # --- norte y escala gráfica (en coordenadas del dibujo)
    nx, ny = x1 - 4, y1 - 7
    ax.add_patch(FancyArrow(nx, ny, 0, 4, width=0.5, head_width=1.6, head_length=1.6, color=TINTA, zorder=40))
    ax.text(nx, ny + 5.6, 'N', ha='center', va='bottom', fontsize=14, weight='bold', color=TINTA)
    sx, sy = x0 + 2, y0 + 1.5
    for i in range(5):
        ax.add_patch(Rectangle((sx + i * 2, sy), 2, 0.5, color=TINTA if i % 2 == 0 else 'white', ec=TINTA,
                               lw=0.6, zorder=40))
    for i in (0, 2, 4, 6, 8, 10):
        ax.text(sx + i, sy + 0.9, f'{i}', ha='center', va='bottom', fontsize=6, color=TINTA)
    ax.text(sx + 10.8, sy + 0.25, 'm', ha='left', va='center', fontsize=6, color=TINTA)

    # --- marco y cajetín
    fx = fig.add_axes([0, 0, 1, 1], zorder=-1)
    fx.set_xlim(0, W)
    fx.set_ylim(0, H)
    fx.axis('off')
    fx.add_patch(Rectangle((10, 10), W - 20, H - 20, fill=False, lw=1.2, ec=TINTA))
    fx.add_patch(Rectangle((10, 10), W - 20, 95, fill=False, lw=1.0, ec=TINTA))
    fx.add_patch(Rectangle((10, 10), 8, 95, color=AZUL, lw=0))
    fx.text(26, 88, 'HOSPITAL SOLCA QUITO', fontsize=20, weight='bold', color=AZUL, va='center')
    fx.text(26, 74, 'Planta baja · Plano de distribución y orientación', fontsize=12.5, color=TINTA, va='center')
    fx.text(26, 62, 'Av. Eloy Alfaro y De los Pinos, Quito', fontsize=9, color='#555', va='center')
    fx.text(26, 26, f'Escala 1:{ESCALA} (impresión A1)   ·   Cotas y áreas en metros   ·   '
                    f'{datetime.date.today():%d/%m/%Y}', fontsize=8, color='#555', va='center')
    fx.text(26, 16, 'Fuente: plano arquitectónico de la planta baja (planos_entrada.dwg). '
                    'Plano de orientación, no apto para construcción.', fontsize=7, color='#777', va='center')
    # leyenda
    lx, ly = 330, 92
    fx.text(lx, ly, 'LEYENDA', fontsize=9, weight='bold', color=TINTA, va='center')
    items = [(v[0], v[1]) for k, v in CATEGORIAS.items() if k != 'otro']
    for i, (et, colr) in enumerate(items):
        cx_ = lx + (i // 4) * 125
        cy_ = ly - 13 - (i % 4) * 11
        fx.add_patch(Rectangle((cx_, cy_ - 3.5), 9, 7, color=colr, ec='#888', lw=0.4))
        fx.text(cx_ + 12, cy_, et, fontsize=7.5, color=TINTA, va='center')
    sy_ = ly - 13 - 4 * 11
    sims = [('Muro', TINTA, None), ('Tabique', '#4b5563', None), ('Ventana / vidrio', '#cfe8f7', '#2b6f9e')]
    for i, (et, colr, ecc) in enumerate(sims):
        cx_ = lx + i * 62
        fx.add_patch(Rectangle((cx_, sy_ - 2), 9, 4, color=colr, ec=ecc or colr, lw=0.5))
        fx.text(cx_ + 12, sy_, et, fontsize=7.5, color=TINTA, va='center')
    fx.plot([lx + 190, lx + 199], [sy_, sy_], color='#7a7a7a', lw=0.8, ls=(0, (3, 1.5)))
    fx.text(lx + 202, sy_ + 0.0, 'Visera', fontsize=7.5, color=TINTA, va='center')

    fig.savefig(salida_pdf)
    fig.savefig(salida_png, dpi=110)
    plt.close(fig)


if __name__ == '__main__':
    m = pickle.load(open(sys.argv[1] if len(sys.argv) > 1 else '/tmp/modelo.pkl', 'rb'))
    sal = os.path.join(AQUI, 'salida')
    dibujar(m, os.path.join(sal, 'solca_pb_plano_2d.pdf'), os.path.join(sal, 'solca_pb_plano_2d.png'))
    print('ok')

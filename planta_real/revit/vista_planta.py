"""Vista de control de la planta: ambientes, muros, columnas, ventanas, puertas, muebles y gradas."""
import sys, pickle, random
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
from matplotlib.collections import LineCollection


def dibujar(m, salida, ventana=None, dpi=70, ancho=16):
    xa, xb, ya, yb = ventana or (0, m.lz.w * 0.02, 0, m.lz.h * 0.02)
    fig, ax = plt.subplots(figsize=(ancho, ancho * (yb - ya) / (xb - xa)))
    random.seed(3)
    for a in m.ambientes:
        pg = a['poligono']; x, y = pg.exterior.xy
        ax.fill(x, y, color=(random.uniform(.93, .98), random.uniform(.90, .95), random.uniform(.80, .88)), lw=0)
        c = pg.representative_point()
        if xa < c.x < xb and ya < c.y < yb:
            ax.text(c.x, c.y, a['nombre'].replace(' / ', '\n'), fontsize=5, ha='center', va='center')
    def poly(pg, **k):
        x, y = pg.exterior.xy; ax.fill(x, y, **k)
        for h in pg.interiors:
            x, y = h.xy; ax.fill(x, y, color='w', lw=0)
    for pg in m.muros: poly(pg, color='#222', lw=0)
    for pg in m.columnas: poly(pg, color='#b03', lw=0)
    for t in getattr(m, 'tabiques', []):
        for q in (t['poligono'].geoms if hasattr(t['poligono'], 'geoms') else [t['poligono']]): poly(q, color='#555', lw=0)
    for pg in getattr(m, 'foso', []): poly(pg, color='#70a', lw=0)
    for pg in getattr(m, 'vidrios', []): poly(pg, color='#0cc', lw=0)
    for pg in m.ventanas: poly(pg, color='#39f', lw=0)
    for p in m.puertas: poly(p['rect'], color='#f90', lw=0)
    for pg in getattr(m, 'ventanillas', []): poly(pg, color='#06c', lw=0)
    for pg in getattr(m, 'parapetos', []): poly(pg, color='#888', lw=0)
    for pg in getattr(m, 'viseras', []):
        x, y = pg.exterior.xy; ax.plot(x, y, color='#c80', lw=0.8, ls='--')
    for mu in m.muebles: poly(mu['poligono'], color='#2a2' if mu['cat'] == 'mueble' else '#a6f', lw=0)
    for tr in m.tramos:
        ax.add_collection(LineCollection([list(s.coords) for s in tr], colors='c', linewidths=0.8))
    ax.set_xlim(xa, xb); ax.set_ylim(ya, yb); ax.set_aspect('equal'); ax.grid(alpha=.2)
    fig.savefig(salida, dpi=dpi, bbox_inches='tight')


if __name__ == '__main__':
    sys.path.insert(0, '/home/claude/hospital-solca/planta_real/revit')
    m = pickle.load(open('/tmp/modelo.pkl', 'rb'))
    for a in sys.argv[1:]:
        n, *v = a.split(',')
        dibujar(m, '/tmp/' + n + '.png', tuple(map(float, v)) if v else None)

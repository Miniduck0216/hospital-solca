"""
Extrae la geometría vectorial del PDF real (planos_entrada, A1, AutoCAD) y la escribe en metros.
Escala: 1 m = S puntos del PDF. Calibrada con el módulo de consultorio de 2,4 m (≈59 pt de paso
entre muros horizontales en Bloque C) y con el ancho del ala (≈58 m ≈ 1420 pt). Es ESTIMADA: validar.
Origen: esquina superior-oeste del dibujo; y crece hacia el norte.
"""
import sys
import pymupdf as fitz
import ezdxf
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

PDF = '/root/.claude/uploads/55acfeb9-6ff9-55e3-be22-c5fb507d1628/3a83007d-planos_entrada-Model.pdf'
S = 24.5  # puntos por metro (estimada)
DXF = '/home/claude/hospital-solca/planta_real/planos/solca-PB-real.dxf'
PNG = '/home/claude/hospital-solca/planta_real/salida/solca_pb_real.png'

page = fitz.open(PDF)[0]
lines, curvas, textos = [], [], []
for d in page.get_drawings():
    for it in d['items']:
        k = it[0]
        if k == 'l':
            lines.append((it[1], it[2]))
        elif k == 'c':
            p0, p1, p2, p3 = it[1], it[2], it[3], it[4]
            pts = []
            for i in range(9):
                t = i / 8
                x = (1-t)**3*p0.x + 3*(1-t)**2*t*p1.x + 3*(1-t)*t*t*p2.x + t**3*p3.x
                y = (1-t)**3*p0.y + 3*(1-t)**2*t*p1.y + 3*(1-t)*t*t*p2.y + t**3*p3.y
                pts.append((x, y))
            curvas.append(pts)
for w in page.get_text('words'):
    textos.append((w[0], w[1], w[2], w[3], w[4]))

# límites del dibujo (sin marco exterior: se usan los segmentos)
xs = [p.x for a, b in lines for p in (a, b)]
ys = [p.y for a, b in lines for p in (a, b)]
X0, YTOP = min(xs), min(ys)

def m(x, y):
    return ((x - X0) / S, (YTOP + 0 - y) / S * -1 if False else (max(ys) - y) / S)
# y crece hacia el norte: y_m = (max_y - y)/S ... se normaliza al origen inferior
YMAX = max(ys)
def mx(x, y):
    return ((x - X0) / S, (YMAX - y) / S)

doc = ezdxf.new('R2010'); doc.header['$INSUNITS'] = 6
msp = doc.modelspace()
doc.layers.add('MURO_REAL'); doc.layers.add('PUERTA_REAL'); doc.layers.add('ROTULO_REAL')
for a, b in lines:
    msp.add_line(mx(a.x, a.y), mx(b.x, b.y), dxfattribs={'layer': 'MURO_REAL'})
for pts in curvas:
    msp.add_lwpolyline([mx(p[0], p[1]) for p in pts], dxfattribs={'layer': 'PUERTA_REAL'})
for x0, y0, x1, y1, t in textos:
    px, py = mx((x0 + x1) / 2, (y0 + y1) / 2)
    msp.add_text(t, dxfattribs={'layer': 'ROTULO_REAL', 'height': 0.2}).set_placement((px, py))
doc.saveas(DXF)

fig, ax = plt.subplots(figsize=(14, 20))
for a, b in lines:
    ax.plot([mx(a.x, a.y)[0], mx(b.x, b.y)[0]], [mx(a.x, a.y)[1], mx(b.x, b.y)[1]], color='#333', lw=0.5)
for pts in curvas:
    ax.plot([mx(p[0], p[1])[0] for p in pts], [mx(p[0], p[1])[1] for p in pts], color='#2a7', lw=0.4)
for x0, y0, x1, y1, t in textos:
    px, py = mx((x0 + x1) / 2, (y0 + y1) / 2)
    ax.text(px, py, t, fontsize=3, ha='center', va='center')
ax.set_aspect('equal'); ax.invert_yaxis() if False else None
ax.set_title(f'Planta baja · geometría real del PDF · escala estimada 1 m = {S} pt')
ax.set_xlabel('m'); ax.set_ylabel('m')
fig.savefig(PNG, dpi=110, bbox_inches='tight')
print('líneas', len(lines), 'curvas', len(curvas), 'textos', len(textos))
print('extensión m: x 0-%.1f  y 0-%.1f' % (max(mx(p.x, p.y)[0] for a, b in lines for p in (a,b)), max(mx(p.x, p.y)[1] for a, b in lines for p in (a,b))))

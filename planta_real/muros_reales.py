"""
Muros sólidos desde el PDF real. Solo líneas negras de 0,72 pt (muros). Pares de líneas paralelas
separados 0,12–0,5 m se funden en un muro; las líneas sueltas dan muros de 0,10 m.
Escala ESTIMADA 24,5 pt/m. Altura 3,0 m. Salidas: DXF (MURO_SOLIDO), .rb para SketchUp y preview 3D.
"""
import pymupdf as fitz, ezdxf, math
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection

PDF = '/root/.claude/uploads/55acfeb9-6ff9-55e3-be22-c5fb507d1628/3a83007d-planos_entrada-Model.pdf'
S = 24.5; H = 3.0
OUT = '/home/claude/hospital-solca/planta_real/'

page = fitz.open(PDF)[0]
# Rótulos: trazos vectoriales de letras. Se excluyen los que caen dentro de una palabra
# y los segmentos menores de 12 pt (≈0,5 m), que son trazos de letras o detalles, no muros.
words = [fitz.Rect(w[:4]) for w in page.get_text('words')]
def dentro(x, y, r): return r.x0 - 2 <= x <= r.x1 + 2 and r.y0 - 2 <= y <= r.y1 + 2
segs = []
for d in page.get_drawings():
    if round(d.get('width') or 0, 2) != 0.72: continue
    if tuple(round(v, 2) for v in (d.get('color') or ())) != (0.0, 0.0, 0.0): continue
    for it in d['items']:
        if it[0] != 'l': continue
        a, b = it[1], it[2]
        mx, my = (a.x + b.x) / 2, (a.y + b.y) / 2
        if any(dentro(a.x, a.y, r) or dentro(b.x, b.y, r) or dentro(mx, my, r) for r in words): continue
        if math.hypot(b.x - a.x, b.y - a.y) < 12: continue
        segs.append((a.x, a.y, b.x, b.y))
xs = [v for s in segs for v in (s[0], s[2])]; ys = [v for s in segs for v in (s[1], s[3])]
X0, YMAX = min(xs), max(ys)
def M(x, y): return ((x - X0) / S, (YMAX - y) / S)

hor = [(y0, min(x0, x1), max(x0, x1), i) for i, (x0, y0, x1, y1) in enumerate(segs) if abs(y0 - y1) < 0.05 and abs(x0 - x1) > 0.5]
ver = [(x0, min(y0, y1), max(y0, y1), i) for i, (x0, y0, x1, y1) in enumerate(segs) if abs(x0 - x1) < 0.05 and abs(y0 - y1) > 0.5]

rects = []  # (x0,y0,x1,y1) en pt
def pares(lst, horiz):
    used = set(); lst = sorted(lst)
    for i, (c1, a1, b1, id1) in enumerate(lst):
        if id1 in used: continue
        best = None
        for j in range(i + 1, len(lst)):
            c2, a2, b2, id2 = lst[j]
            if c2 - c1 > 12: break
            if id2 in used or c2 - c1 < 3: continue
            ov0, ov1 = max(a1, a2), min(b1, b2)
            if ov1 - ov0 > 10 and (best is None or c2 - c1 < best[0] - c1):
                best = (c2, a2, b2, id2)
        if best:
            used.add(id1); used.add(best[3])
            c2, a2, b2, id2 = best
            ov0, ov1 = max(a1, a2), min(b1, b2)
            if horiz: rects.append((ov0, c1, ov1, c2))
            else: rects.append((c1, ov0, c2, ov1))
        else:
            used.add(id1)
            t = 0.1 * S / 2
            if horiz: rects.append((a1, c1 - t, b1, c1 + t))
            else: rects.append((c1 - t, a1, c1 + t, b1))
    return used

pares(hor, True); pares(ver, False)
print('muros', len(rects))

doc = ezdxf.new('R2010'); doc.header['$INSUNITS'] = 6
doc.layers.add('MURO_SOLIDO'); msp = doc.modelspace()
rb = ['model = Sketchup.active_model', 'ents = model.active_entities',
      'mat = model.materials.add("Muro"); mat.color = "#D9D6CF"',
      'grupo = ents.add_group; grupo.name = "Muros reales"; ents = grupo.entities',
      'def muro(ents, pts)',
      '  return if pts.uniq.size < 4',
      '  area = 0.0',
      '  pts.each_with_index { |a, i| b = pts[(i + 1) % pts.size]; area += a[0] * b[1] - b[0] * a[1] }',
      '  return if area.abs < 0.01',
      '  begin',
      '    f = ents.add_face(pts.map { |x, y| Geom::Point3d.new(x.m, y.m, 0.m) })',
      '    return unless f',
      '    f.reverse! if f.normal.z < 0',
      f'    f.pushpull({H}.m)',
      '  rescue StandardError => e',
      '    puts "muro omitido: #{e.message}"',
      '  end',
      'end']
polys = []
lotes = []
for x0, y0, x1, y1 in rects:
    p = [M(x0, y0), M(x1, y0), M(x1, y1), M(x0, y1)]
    msp.add_lwpolyline(p, close=True, dxfattribs={'layer': 'MURO_SOLIDO'})
    lotes.append(p)
    polys.append(p)
for i in range(0, len(lotes), 200):
    rb.append(f'model.start_operation("Muros {i//200+1}", true)')
    for p in lotes[i:i+200]:
        rb.append('muro(ents, [' + ', '.join(f'[{x:.4f}, {y:.4f}]' for x, y in p) + '])')
    rb.append('model.commit_operation')
doc.saveas(OUT + 'planos/solca-PB-muros.dxf')
open(OUT + 'salida/solca_pb_muros.rb', 'w').write('\n'.join(rb) + '\n')

fig, ax = plt.subplots(figsize=(9, 12))
for p in polys:
    ax.fill([q[0] for q in p] + [p[0][0]], [q[1] for q in p] + [p[0][1]], color='#333')
ax.set_aspect('equal'); ax.set_title('Muros sólidos · 2D (m)')
fig.savefig(OUT + 'salida/solca_pb_muros_2d.png', dpi=100, bbox_inches='tight')
fig = plt.figure(figsize=(10, 13)); ax = fig.add_subplot(projection='3d')
ax.add_collection3d(Poly3DCollection([[(x, y, 0) for x, y in p] for p in polys], facecolor='#8d8a84', edgecolor='none'))
ax.add_collection3d(Poly3DCollection([[(x, y, H) for x, y in p] for p in polys], facecolor='#c9c5bd', edgecolor='none'))
ax.set_xlim(0, 61); ax.set_ylim(0, 81); ax.set_zlim(0, H); ax.set_box_aspect((61, 81, H * 1.5))
ax.view_init(elev=55, azim=-70); ax.set_title('Muros sólidos · 3D')
fig.savefig(OUT + 'salida/solca_pb_muros_3d.png', dpi=100, bbox_inches='tight')

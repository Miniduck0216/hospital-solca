"""
Convierte los muros reales (DXF en metros, capa MURO_REAL) en un script Ruby para SketchUp.
Cada segmento se vuelve un muro de GROSOR x ALTURA, deduplicado y unido por colineales.
Uso: python3 real_a_sketchup.py <dxf> <rb> [grosor=0.15] [altura=3.0]
"""
import sys, math
import ezdxf

dxf, salida = sys.argv[1], sys.argv[2]
GROSOR = float(sys.argv[3]) if len(sys.argv) > 3 else 0.15
ALTURA = float(sys.argv[4]) if len(sys.argv) > 4 else 3.0

doc = ezdxf.readfile(dxf)
segs = set()
for e in doc.modelspace().query('LINE'):
    if e.dxf.layer != 'MURO_REAL':
        continue
    a = (round(e.dxf.start.x, 2), round(e.dxf.start.y, 2))
    b = (round(e.dxf.end.x, 2), round(e.dxf.end.y, 2))
    if math.dist(a, b) < 0.15:
        continue
    segs.add(tuple(sorted([a, b])))

def cara(a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    L = math.hypot(dx, dy)
    nx, ny = -dy / L * GROSOR / 2, dx / L * GROSOR / 2
    return [(a[0] + nx, a[1] + ny), (b[0] + nx, b[1] + ny), (b[0] - nx, b[1] - ny), (a[0] - nx, a[1] - ny)]

rb = ['model = Sketchup.active_model', 'ents = model.active_entities',
      'mat = model.materials.add("Muro"); mat.color = "#D9D6CF"',
      'model.start_operation("Planta baja real", true)',
      'grupo = ents.add_group; ents = grupo.entities']
n = 0
for a, b in segs:
    pts = cara(a, b)
    pts3 = ', '.join(f'[{x:.3f}.m, {y:.3f}.m, 0.m]' for x, y in pts)
    rb.append(f'f = ents.add_face([{pts3}]); f.pushpull({ALTURA}.m) if f; ')
    n += 1
rb.append('model.commit_operation')
open(salida, 'w').write('\n'.join(rb) + '\n')
print(f'{n} muros -> {salida}')

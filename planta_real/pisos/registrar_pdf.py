"""Herramienta (una vez por juego de PDF): registra cada PDF de zona del piso 1 sobre el marco local (m) del plano P1 y guarda la transformación."""
import sys, json, math, glob
import numpy as np, cv2, pymupdf as fitz
sys.path.insert(0, '/home/claude/hospital-solca/planta_real/pisos')
import fuente
RES = 0.1
pl, bl, tx = fuente.cargar('P1')
segs = []
for c, t, pts, cl in pl:
    p = [(x/1000, y/1000) for x, y in pts]
    if cl: p = p + [p[0]]
    segs += list(zip(p[:-1], p[1:]))
for b in bl:
    for g in b['geo']:
        p = [(x/1000, y/1000) for x, y in g[1]]
        segs += list(zip(p[:-1], p[1:]))
S = np.array([[a[0], a[1], b[0], b[1]] for a, b in segs])
X0, Y0 = S[:, [0, 2]].min() - 5, S[:, [1, 3]].min() - 5
X1, Y1 = S[:, [0, 2]].max() + 5, S[:, [1, 3]].max() + 5
W, H = int((X1-X0)/RES), int((Y1-Y0)/RES)
def ras(segs_m, W, H, x0, y0):
    img = np.zeros((H, W), np.uint8)
    for x1, y1, x2, y2 in segs_m:
        cv2.line(img, (int((x1-x0)/RES), int((y1-y0)/RES)), (int((x2-x0)/RES), int((y2-y0)/RES)), 255, 1)
    return img
R = ras(S, W, H, X0, Y0)
Rb = cv2.GaussianBlur(cv2.dilate(R, np.ones((3,3))), (0,0), 2).astype(np.float32)
cv2.imwrite('/tmp/dxf_p1.png', 255-R[::-1])
print('dxf', W, H, X0, Y0, len(S))

def pdf_segs(f):
    p = fitz.open(f)[0]; out = []
    for d in p.get_drawings():
        cur = None
        for it in d['items']:
            if it[0] == 'l': out.append((it[1].x, it[1].y, it[2].x, it[2].y))
            elif it[0] == 'c':
                pts = [it[1], it[2], it[3], it[4]]; 
                for a, b in zip(pts[:-1], pts[1:]): out.append((a.x, a.y, b.x, b.y))
            elif it[0] == 're':
                r = it[1]; c = [(r.x0,r.y0),(r.x1,r.y0),(r.x1,r.y1),(r.x0,r.y1),(r.x0,r.y0)]
                for a, b in zip(c[:-1], c[1:]): out.append((*a, *b))
    return np.array(out), p.rect

# escala aproximada desde los textos de la zona 1: 1 m = 12.05 pt
ESC = 1/12.05
res = {}
ZONAS = sys.argv[1] if len(sys.argv) > 1 else '12345'
prev = json.load(open('/home/claude/hospital-solca/planta_real/planos/p1_zonas/registro.json')) if len(sys.argv) > 1 else {}
res.update(prev)
for f in sorted(glob.glob('/home/claude/hospital-solca/planta_real/planos/p1_zonas/zona[1-5].pdf')):
    n = f[-5]
    if n not in ZONAS: continue
    P, rect = pdf_segs(f)
    # quitar el marco de la hoja
    L = np.hypot(P[:,2]-P[:,0], P[:,3]-P[:,1]); P = P[L < 400]
    best = None
    for rot in range(4):
        for esp in (False, True):
            for sc in (np.linspace(0.96, 1.04, 5) if len(sys.argv) < 3 else np.linspace(float(sys.argv[2]), float(sys.argv[3]), int(sys.argv[4]))):
                th = rot*math.pi/2; c, s = math.cos(th), math.sin(th)
                def tf(x, y):
                    u, v = x*ESC*sc, -y*ESC*sc
                    if esp: u = -u
                    return c*u - s*v, s*u + c*v
                a = np.array([tf(x, y) for x, y in P[:, :2]]); b = np.array([tf(x, y) for x, y in P[:, 2:]])
                mn = np.minimum(a.min(0), b.min(0)); mx = np.maximum(a.max(0), b.max(0))
                w, h = int((mx[0]-mn[0])/RES)+2, int((mx[1]-mn[1])/RES)+2
                if w >= W or h >= H: continue
                T = ras(np.hstack([a, b]), w, h, mn[0], mn[1])
                Tb = cv2.GaussianBlur(cv2.dilate(T, np.ones((3,3))), (0,0), 2).astype(np.float32)
                m = cv2.matchTemplate(Rb, Tb, cv2.TM_CCORR_NORMED)
                _, v, _, loc = cv2.minMaxLoc(m)
                if best is None or v > best[0]:
                    best = (v, rot, esp, sc, loc, mn)
    v, rot, esp, sc, loc, mn = best
    tx_, ty_ = X0 + loc[0]*RES - mn[0], Y0 + loc[1]*RES - mn[1]
    res[n] = dict(score=round(v,3), rot=rot, espejo=esp, escala=ESC*sc, tx=tx_, ty=ty_)
    print(n, res[n])
json.dump(res, open('/home/claude/hospital-solca/planta_real/planos/p1_zonas/registro.json', 'w'), indent=1)

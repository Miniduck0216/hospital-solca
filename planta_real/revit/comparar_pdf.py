import sys,pickle; sys.path.insert(0,'/home/claude/hospital-solca/planta_real/revit')
import numpy as np, pymupdf as fitz
from PIL import Image, ImageDraw
m=pickle.load(open('/tmp/modelo.pkl','rb'))
sx,sy,tx,ty=pickle.load(open('/tmp/pdf2m.pkl','rb'))
p=fitz.open('/root/.claude/uploads/55acfeb9-6ff9-55e3-be22-c5fb507d1628/3e9f8efa-planos_entrada-Model.pdf')[0]
def capt(nombre,r,dpi=150):
    pix=p.get_pixmap(clip=fitz.Rect(*r),dpi=dpi)
    img=Image.frombytes('RGB',(pix.width,pix.height),pix.samples).convert('RGBA')
    k=dpi/72
    lay=Image.new('RGBA',img.size,(0,0,0,0)); d=ImageDraw.Draw(lay)
    def topx(X,Y): return (((X-tx)/sx-r[0])*k, ((Y-ty)/sy-r[1])*k)
    def pg(g,fill):
        for q in (g.geoms if hasattr(g,'geoms') else [g]):
            d.polygon([topx(*c) for c in q.exterior.coords],fill=fill)
    for a in m.ambientes: pg(a['poligono'],(80,160,255,40))
    for w in m.muros: pg(w,(255,0,0,110))
    for c in m.columnas: pg(c,(150,0,90,140))
    for v in m.ventanas: pg(v,(0,120,255,140))
    for pu in m.puertas: pg(pu['rect'],(255,150,0,160))
    for v in getattr(m,'vidrios',[]): pg(v,(0,220,220,200))
    for v in getattr(m,'foso',[]): pg(v,(120,0,200,180))
    for t in getattr(m,'tabiques',[]): pg(t['poligono'],(0,170,0,220))
    for tr in m.tramos:
        for l in tr:
            a,b=l.coords[0],l.coords[-1]; d.line([topx(*a),topx(*b)],fill=(0,140,140,255),width=3)
    for a in m.ambientes:
        c=a['poligono'].representative_point(); x,y=topx(c.x,c.y)
        d.text((x,y),(a['nombre'] or '?')[:28],fill=(0,0,160,255))
    Image.alpha_composite(img,lay).convert('RGB').save('/tmp/'+nombre+'.png')
for a in sys.argv[1:]:
    n,*r=a.split(','); capt(n,tuple(map(float,r)))

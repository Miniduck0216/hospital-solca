"""
Escribe la planta baja de SOLCA Quito como IFC4 para abrir en Revit (Archivo -> Abrir -> IFC).
Muros, dinteles, puertas, ventanas, columnas, losa, ambientes (IfcSpace), sanitarios, mobiliario,
gradas y letreros con el nombre del ambiente en relieve sobre cada puerta.
"""
import math
import sys
import pickle
import numpy as np
import ifcopenshell
import ifcopenshell.api
import ifcopenshell.guid
from shapely.geometry import Polygon, Point, box
from shapely.ops import unary_union
from shapely import affinity
from matplotlib.textpath import TextPath
from matplotlib.font_manager import FontProperties

sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from modelo import ALTURA, H_PUERTA, H_ANTEPECHO, H_DINTEL_VENTANA, H_PARAPETO, lista_polis  # noqa: E402

AZUL_SOLCA = (0.04, 0.36, 0.65)


TOL = 0.003   # m: Revit no acepta tramos más cortos que ~1,2 mm; se usa un margen


def limpiar(pg):
    """Polígono válido (sin autointersección); si queda en varias piezas, la mayor."""
    from shapely import make_valid
    g = make_valid(pg) if not pg.is_valid else pg
    piezas = lista_polis(g)
    if not piezas:
        return pg.convex_hull
    g = max(piezas, key=lambda q: q.area).simplify(TOL * 0.6, preserve_topology=True)
    if not g.is_valid:
        g = max(lista_polis(make_valid(g)) or [g.convex_hull], key=lambda q: q.area)
    return g


def anillo_limpio(anillo):
    """Puntos del anillo sin repetir el cierre, sin tramos < TOL y sin vértices colineales; None si no es simple."""
    from shapely.geometry import LinearRing
    pts = [(round(x, 4), round(y, 4)) for x, y in anillo.coords[:-1]]
    out = []
    for p in pts:
        if not out or math.dist(out[-1], p) >= TOL:
            out.append(p)
    while len(out) > 3 and math.dist(out[0], out[-1]) < TOL:
        out.pop()
    # quitar colineales
    cambio = True
    while cambio and len(out) > 3:
        cambio = False
        for i in range(len(out)):
            a, b, c = out[i - 1], out[i], out[(i + 1) % len(out)]
            cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])
            if abs(cr) < 1e-7:
                out.pop(i)
                cambio = True
                break
    if len(out) < 3 or not LinearRing(out).is_simple:
        return None
    return out


class Escritor:
    def __init__(self):
        f = self.f = ifcopenshell.api.run('project.create_file', version='IFC4')
        self.proy = ifcopenshell.api.run('root.create_entity', f, ifc_class='IfcProject', name='SOLCA Quito')
        ifcopenshell.api.run('unit.assign_unit', f, length={'is_metric': True, 'raw': 'METERS'})
        ctx = ifcopenshell.api.run('context.add_context', f, context_type='Model')
        self.body = ifcopenshell.api.run('context.add_context', f, context_type='Model', context_identifier='Body',
                                         target_view='MODEL_VIEW', parent=ctx)
        sitio = ifcopenshell.api.run('root.create_entity', f, ifc_class='IfcSite', name='SOLCA')
        edif = ifcopenshell.api.run('root.create_entity', f, ifc_class='IfcBuilding',
                                    name='Hospital SOLCA Quito')
        self.piso = ifcopenshell.api.run('root.create_entity', f, ifc_class='IfcBuildingStorey', name='Planta baja')
        self.piso.Elevation = 0.0
        ifcopenshell.api.run('aggregate.assign_object', f, relating_object=self.proy, products=[sitio])
        ifcopenshell.api.run('aggregate.assign_object', f, relating_object=sitio, products=[edif])
        ifcopenshell.api.run('aggregate.assign_object', f, relating_object=edif, products=[self.piso])
        for o in (sitio, edif, self.piso):
            o.ObjectPlacement = self.lugar()
        self.estilos = {}
        self.cuenta = {}

    # --- geometría
    def lugar(self):
        f = self.f
        return f.createIfcLocalPlacement(None, f.createIfcAxis2Placement3D(
            f.createIfcCartesianPoint((0.0, 0.0, 0.0)), None, None))

    def perfil(self, pg):
        """Perfil limpio para Revit: polígono válido, sin autointersecciones ni tramos menores de 3 mm."""
        f = self.f
        pg = limpiar(pg)

        def poli(pts):
            pts = list(pts) + [pts[0]]
            return f.createIfcPolyline([f.createIfcCartesianPoint(p) for p in pts])
        ext = anillo_limpio(pg.exterior) or anillo_limpio(pg.convex_hull.exterior)
        huecos = [h for h in (anillo_limpio(i) for i in pg.interiors) if h]
        if huecos:
            return f.createIfcArbitraryProfileDefWithVoids('AREA', None, poli(ext), [poli(h) for h in huecos])
        return f.createIfcArbitraryClosedProfileDef('AREA', None, poli(ext))

    def extrusion(self, pg, z0, alto, origen=(0, 0), eje=(0, 0, 1), ref=(1, 0, 0)):
        f = self.f
        pos = f.createIfcAxis2Placement3D(f.createIfcCartesianPoint((float(origen[0]), float(origen[1]), float(z0))),
                                          f.createIfcDirection(tuple(map(float, eje))),
                                          f.createIfcDirection(tuple(map(float, ref))))
        return f.createIfcExtrudedAreaSolid(self.perfil(pg), pos, f.createIfcDirection((0.0, 0.0, 1.0)), float(alto))

    def estilo(self, nombre, rgb, transp=0.0):
        if nombre not in self.estilos:
            st = ifcopenshell.api.run('style.add_style', self.f, name=nombre)
            ifcopenshell.api.run('style.add_surface_style', self.f, style=st, ifc_class='IfcSurfaceStyleShading',
                                 attributes={'SurfaceColour': {'Name': None, 'Red': rgb[0], 'Green': rgb[1],
                                                               'Blue': rgb[2]},
                                             'Transparency': transp})
            self.estilos[nombre] = st
        return self.estilos[nombre]

    def elemento(self, clase, nombre, solidos, estilo, tipo=None, props=None):
        f = self.f
        if not solidos:
            return None
        el = ifcopenshell.api.run('root.create_entity', f, ifc_class=clase, name=nombre, predefined_type=tipo)
        el.ObjectPlacement = self.lugar()
        rep = f.createIfcShapeRepresentation(self.body, 'Body', 'SweptSolid', solidos)
        el.Representation = f.createIfcProductDefinitionShape(None, None, [rep])
        ifcopenshell.api.run('style.assign_representation_styles', f, shape_representation=rep, styles=[estilo])
        if clase == 'IfcSpace':
            ifcopenshell.api.run('aggregate.assign_object', f, relating_object=self.piso, products=[el])
        else:
            ifcopenshell.api.run('spatial.assign_container', f, relating_structure=self.piso, products=[el])
        if props:
            pset = ifcopenshell.api.run('pset.add_pset', f, product=el, name='SOLCA')
            ifcopenshell.api.run('pset.edit_pset', f, pset=pset, properties=props)
        self.cuenta[clase] = self.cuenta.get(clase, 0) + 1
        return el


def trozos(pg, paso=8.0):
    """Divide un polígono grande en piezas de una retícula para que Revit las procese sin problemas."""
    x0, y0, x1, y1 = pg.bounds
    out = []
    for gx in np.arange(math.floor(x0 / paso) * paso, x1, paso):
        for gy in np.arange(math.floor(y0 / paso) * paso, y1, paso):
            c = pg.intersection(box(gx, gy, gx + paso, gy + paso))
            out += [q for q in lista_polis(c) if q.area > 0.003]
    return out


def texto_poligonos(texto, alto):
    """Letras como polígonos (con huecos) en metros, origen abajo-izquierda."""
    tp = TextPath((0, 0), texto, size=1.0, prop=FontProperties(family='DejaVu Sans', weight='bold'))
    anillos = [Polygon(a) for a in tp.to_polygons() if len(a) >= 3]
    anillos = [a.buffer(0) for a in anillos if a.is_valid or a.buffer(0).area > 0]
    # par / impar: los anillos contenidos en otro son huecos
    anillos.sort(key=lambda a: -a.area)
    letras = []
    for a in anillos:
        madre = next((l for l in letras if l.contains(a.representative_point())), None)
        if madre is not None:
            letras.remove(madre)
            letras.append(madre.difference(a))
        else:
            letras.append(a)
    g = unary_union(letras)
    minx, miny, maxx, maxy = g.bounds
    esc = alto / max(maxy - miny, 1e-6)
    g = affinity.translate(g, -minx, -miny)
    g = affinity.scale(g, esc, esc, origin=(0, 0))
    return lista_polis(g), (maxx - minx) * esc


def letreros(m):
    """Un letrero por ambiente con nombre propio, sobre la cara exterior del dintel de su puerta."""
    out = []
    for a in m.ambientes:
        nom = a['nombre']
        if not nom or ' / ' in nom or a['area'] > 45 or nom.startswith('BLOQUE'):
            continue
        pg = a['poligono']
        cands = []
        for p in m.puertas:
            mid = (np.array(p['a']) + np.array(p['b'])) / 2
            d = pg.exterior.distance(Point(tuple(mid)))
            if d < 0.45:
                cands.append((d, p, mid))
        if not cands:
            continue
        _, p, mid = min(cands, key=lambda c: c[0])
        nrm = p['nrm']
        lado_amb = 1 if pg.contains(Point(tuple(mid + nrm * 0.5))) else -1
        n_out = -lado_amb * nrm                       # hacia el pasillo
        cara = p['t1'] if lado_amb < 0 else p['t0']   # cara del dintel del lado del pasillo
        base = mid + nrm * cara + n_out * 0.001
        out.append(dict(nombre=nom, base=base, n_out=n_out))
    return out


def escribir(m, salida):
    E = Escritor()
    gris = E.estilo('Muro', (0.92, 0.91, 0.88))
    hormigon = E.estilo('Columna', (0.74, 0.74, 0.72))
    piso = E.estilo('Piso', (0.80, 0.80, 0.78))
    vidrio = E.estilo('Vidrio', (0.62, 0.80, 0.92), 0.6)
    madera = E.estilo('Puerta', (0.72, 0.55, 0.38))
    loza = E.estilo('Loza sanitaria', (0.97, 0.97, 0.97))
    mueble = E.estilo('Mueble', (0.55, 0.62, 0.70))
    meson = E.estilo('Mesón', (0.86, 0.84, 0.80))
    espacio = E.estilo('Ambiente', (0.96, 0.94, 0.88), 0.95)
    techo = E.estilo('Visera', (0.88, 0.88, 0.86))
    placa = E.estilo('Letrero', AZUL_SOLCA)
    letra = E.estilo('Letra', (1.0, 1.0, 1.0))
    grada = E.estilo('Grada', (0.82, 0.80, 0.76))

    # losa de piso
    for q in trozos(m.huella, 12.0):
        E.elemento('IfcSlab', 'Losa de piso', [E.extrusion(q, -0.20, 0.20)], piso, 'FLOOR')
    # muros
    for i, pg in enumerate(m.muros):
        for q in trozos(pg):
            E.elemento('IfcWall', 'Muro', [E.extrusion(q, 0, ALTURA)], gris, 'STANDARD')
    # dinteles y puertas
    for p in m.puertas:
        rect = p['rect']
        E.elemento('IfcWall', 'Dintel', [E.extrusion(rect, H_PUERTA, ALTURA - H_PUERTA)], gris, 'STANDARD')
        a, b = np.array(p['a']), np.array(p['b'])
        d, nrm = p['dir'], p['nrm']
        c = (p['t0'] + p['t1']) / 2
        hoja = Polygon([tuple(a + nrm * (c - 0.02)), tuple(b + nrm * (c - 0.02)),
                        tuple(b + nrm * (c + 0.02)), tuple(a + nrm * (c + 0.02))])
        if p['doble']:
            mitad = (a + b) / 2
            hojas = [Polygon([tuple(a + nrm * (c - 0.02)), tuple(mitad - d * 0.005 + nrm * (c - 0.02)),
                              tuple(mitad - d * 0.005 + nrm * (c + 0.02)), tuple(a + nrm * (c + 0.02))]),
                     Polygon([tuple(mitad + d * 0.005 + nrm * (c - 0.02)), tuple(b + nrm * (c - 0.02)),
                              tuple(b + nrm * (c + 0.02)), tuple(mitad + d * 0.005 + nrm * (c + 0.02))])]
        else:
            hojas = [hoja]
        nombre_p = 'Puerta de ducto' if p['tipo'].startswith('P-DUC') else \
            ('Puerta doble' if p['doble'] else 'Puerta')
        el = E.elemento('IfcDoor', nombre_p, [E.extrusion(h, 0, H_PUERTA) for h in hojas], madera, 'DOOR')
        if el is not None:
            el.OverallHeight = H_PUERTA
            el.OverallWidth = float(round(p['ancho'], 3))
    # ventanas: antepecho + vidrio + dintel
    for pg in m.ventanas:
        E.elemento('IfcWall', 'Antepecho', [E.extrusion(pg, 0, H_ANTEPECHO)], gris, 'STANDARD')
        E.elemento('IfcWall', 'Dintel de ventana', [E.extrusion(pg, H_DINTEL_VENTANA, ALTURA - H_DINTEL_VENTANA)],
                   gris, 'STANDARD')
        vid = pg.buffer(-0.04)
        vid = max(lista_polis(vid), key=lambda g: g.area) if not vid.is_empty else pg
        el = E.elemento('IfcWindow', 'Ventana', [E.extrusion(vid, H_ANTEPECHO, H_DINTEL_VENTANA - H_ANTEPECHO)],
                        vidrio, 'WINDOW')
    # ventanillas de atención: antepecho 1,0 m, vidrio hasta 2,1 m y dintel
    for pg in getattr(m, 'ventanillas', []):
        E.elemento('IfcWall', 'Antepecho de ventanilla', [E.extrusion(pg, 0, 1.0)], gris, 'STANDARD')
        E.elemento('IfcWall', 'Dintel de ventanilla', [E.extrusion(pg, H_PUERTA, ALTURA - H_PUERTA)], gris, 'STANDARD')
        vid = pg.buffer(-0.02, join_style=2)
        vid = max(lista_polis(vid), key=lambda g: g.area) if not vid.is_empty else pg
        E.elemento('IfcWindow', 'Ventanilla de atención', [E.extrusion(vid, 1.0, H_PUERTA - 1.0)], vidrio, 'WINDOW')
    # parapetos de la escalera exterior
    for pg in getattr(m, 'parapetos', []):
        E.elemento('IfcWall', 'Parapeto', [E.extrusion(pg, 0, H_PARAPETO)], gris, 'PARAPET')
    # viseras: losa en voladizo a la altura del techo
    for pg in getattr(m, 'viseras', []):
        for q in trozos(pg, 12.0):
            E.elemento('IfcSlab', 'Visera', [E.extrusion(q, ALTURA - 0.20, 0.20)], techo, 'ROOF')
    # vidrios del hall (fachada de vidrio con puertas corredizas): vidrio hasta 3,0 m y banda superior
    for pg in getattr(m, 'vidrios', []):
        E.elemento('IfcWindow', 'Fachada de vidrio', [E.extrusion(pg, 0, 3.0)], vidrio, 'WINDOW')
        E.elemento('IfcWall', 'Banda sobre vidrio', [E.extrusion(pg, 3.0, ALTURA - 3.0)], gris, 'STANDARD')
    # foso del ascensor y su puerta
    metal = E.estilo('Puerta de ascensor', (0.70, 0.72, 0.74))
    for pg in getattr(m, 'foso', []):
        E.elemento('IfcWall', 'Foso de ascensor', [E.extrusion(pg, 0, ALTURA)], hormigon, 'SHEAR')
    pa = getattr(m, 'puerta_ascensor', None)
    if pa:
        E.elemento('IfcWall', 'Dintel de ascensor', [E.extrusion(pa['rect'], H_PUERTA, ALTURA - H_PUERTA)],
                   hormigon, 'STANDARD')
        el = E.elemento('IfcDoor', 'Puerta de ascensor', [E.extrusion(pa['rect'].buffer(-0.05), 0, H_PUERTA)],
                        metal, 'DOOR')
    # tabiques livianos: 2,0 m en baños (cubículos), altura completa en el resto
    san = [mu['poligono'] for mu in m.muebles if mu['cat'] == 'sanitario']
    for t in getattr(m, 'tabiques', []):
        alto = 2.0 if any(t['linea'].distance(q) < 1.0 for q in san) else ALTURA
        for q in lista_polis(t['poligono']):
            E.elemento('IfcWall', 'Tabique', [E.extrusion(q, 0, alto)], gris, 'PARTITIONING')
    # columnas
    for pg in m.columnas:
        E.elemento('IfcColumn', 'Columna', [E.extrusion(pg, 0, ALTURA)], hormigon, 'COLUMN')
    # ambientes
    for i, a in enumerate(sorted(m.ambientes, key=lambda a: (-round(a['poligono'].centroid.y), a['poligono'].centroid.x))):
        el = E.elemento('IfcSpace', f'PB-{i + 1:03d}', [E.extrusion(a['poligono'], 0, 2.70)], espacio, 'SPACE',
                        props={'Area_m2': round(a['area'], 2), 'Ambiente': a['nombre'] or 'Sin nombre'})
        if el is not None:
            el.LongName = a['nombre'] or 'Sin nombre'
    # sanitarios y mobiliario
    for mu in m.muebles:
        pg = max(lista_polis(mu['poligono']), key=lambda g: g.area)
        if mu['cat'] == 'sanitario':
            E.elemento('IfcSanitaryTerminal', mu['nombre'], [E.extrusion(pg, 0, mu['altura'])], loza, 'NOTDEFINED')
        else:
            z0 = mu.get('z0', 0.0)
            est = meson if mu['nombre'] in ('Mesón', 'Mesón lateral', 'Mostrador', 'Repisa de ventanilla') else mueble
            E.elemento('IfcFurniture', mu['nombre'], [E.extrusion(pg, z0, mu['altura'] - z0)], est, 'NOTDEFINED')
    # escaleras: cada huella es un bloque macizo hasta su altura; descansos como losa de 0,15 m
    for esc in getattr(m, 'escaleras', []):
        sol = [E.extrusion(q.buffer(0), 0, z) for q, z in esc['pasos'] if q.area > 0.01]
        sol += [E.extrusion(q.buffer(0), max(z - 0.15, 0), 0.15 if z > 0.15 else z) for q, z in esc['descansos']
                if q.area > 0.05]
        if sol:
            E.elemento('IfcStair', 'Escalera', sol, grada, 'NOTDEFINED')
    # letreros
    n_let = 0
    for L in letreros(m):
        letras, ancho = texto_poligonos(L['nombre'], 0.075)
        w = max(ancho + 0.16, 0.5)
        n_out = L['n_out']
        v = -n_out
        derecha = np.array([v[1], -v[0]])             # v x z
        org = L['base'] - derecha * (w / 2)
        eje = (float(n_out[0]), float(n_out[1]), 0.0)
        ref = (float(derecha[0]), float(derecha[1]), 0.0)
        z0 = H_PUERTA + 0.12
        # el perfil vive en el plano (derecha, arriba); la extrusión sale hacia el pasillo
        sol_placa = E.extrusion(box(0, 0, w, 0.16), 0, 0.02, origen=(0, 0), eje=eje, ref=ref)
        sol_placa.Position.Location.Coordinates = (float(org[0]), float(org[1]), float(z0))
        E.elemento('IfcFurnishingElement', 'Letrero ' + L['nombre'], [sol_placa], placa, None,
                   props={'Texto': L['nombre']})
        sol_l = []
        for g in letras:
            g = affinity.translate(g, 0.08, 0.045)
            s = E.extrusion(g, 0, 0.004, eje=eje, ref=ref)
            o2 = org + n_out * 0.02
            s.Position.Location.Coordinates = (float(o2[0]), float(o2[1]), float(z0))
            sol_l.append(s)
        E.elemento('IfcFurnishingElement', 'Texto ' + L['nombre'], sol_l, letra, None)
        n_let += 1
    E.f.write(salida)
    return E.cuenta, n_let


if __name__ == '__main__':
    m = pickle.load(open('/tmp/modelo.pkl', 'rb'))
    cuenta, n_let = escribir(m, sys.argv[1] if len(sys.argv) > 1 else '/tmp/solca_pb.ifc')
    print(cuenta, 'letreros', n_let)

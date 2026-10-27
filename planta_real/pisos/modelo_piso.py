"""
Modelo de un piso cualquiera con el mismo proceso de la planta baja (revit/modelo.py): muros, columnas,
ventanas, puertas, tabiques, escaleras, ambientes con nombre, mobiliario.
Los ajustes a mano de modelo.py (CIERRES, ZONAS, NOMBRES…) son de la planta baja vieja: aquí se vacían,
y cada piso puede traer los suyos en AJUSTES.
Uso: python3 planta_real/pisos/modelo_piso.py P1   (deja /tmp/modelo_P1.pkl)
"""
import os
import sys
import pickle
import traceback

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(AQUI, '..', 'revit'))
sys.path.insert(0, AQUI)

import modelo as MOD          # noqa: E402
import muros as M             # noqa: E402
from shapely.ops import unary_union  # noqa: E402
import fuente                 # noqa: E402

# ajustes propios de cada piso (mismo formato que las constantes de modelo.py)
AJUSTES = {
    'SB': {}, 'PB': {}, 'P1': {}, 'P2': {}, 'P3': {},
}
# correcciones con los PDF por zonas que revisó el hospital (planta_real/planos/p1_zonas, ver pdf_zonas.py):
# - gris: en la zona, los muros son los sombreados en gris del PDF; se quitan las líneas de muro del DXF (capas
#   PA, P0 - Paredes, TA, NO, Rebars), que dibujan también mostradores, jardineras y bordes que no son muros
# - lineas: se suman los trazos del PDF como líneas de muro (bloques dibujados en capas que no son de muros)
# - quitar: se quitan trazos de esas capas en la zona (el tragaluz triangular dibujado con la capa de ventanas)
from shapely.geometry import box, Polygon  # noqa: E402
CORRECCIONES = {
    'P1': [
        # ventanal corrido de las habitaciones del lado sur del ala oeste: dos líneas de «P0 - Paredes» de 51 m
        # (en el PDF es vidrio, no muro sombreado): se toman como ventana antes de quitar las líneas de muro
        # ventanales del lado sur (habitaciones impares y cafetería): en el DXF son tramos del contorno de muros;
        # en el PDF, dos líneas finas paralelas → bandas de ventana
        dict(tipo='ventanas_pdf', carpeta='p1_zonas', zona=box(3, 76.8, 51, 78.9), solo='1'),
        dict(tipo='gris', carpeta='p1_zonas', zona=box(-3, 70, 61.25, 100.45),
             capas={'PA', 'P0 - Paredes', 'TA', 'NO', 'Rebars'}),
        # tragaluz triangular sobre el paso entre el ala oeste y la torre: en el PDF son líneas finas, no muros
        dict(tipo='quitar', zona=Polygon([(56.5, 84.45), (68.6, 87.15), (56.5, 89.5)]), capas={'P0 - Paredes', 'VE'}),
        dict(tipo='lineas', carpeta='p1_zonas', zona=box(76, 22, 85, 41.6), solo='5',
             capas={'NO', 'TA'}),   # hall interno, recepción, TICs, jefatura, sala de reuniones
        dict(tipo='lineas', carpeta='p1_zonas', zona=box(62.8, 104.8, 70.6, 109.6), solo='3'),   # gradas de emergencia
        # ventanas de las habitaciones del ala oeste (dibujadas en «P0 - Ventanas»): cierran cada cuarto
        dict(tipo='capa', zona=box(-3, 70, 61.25, 100.45), de='P0 - Ventanas', a='VE'),
        # bloque suelto al este de la torre: no está en el plano del piso 1 que revisó el hospital
        dict(tipo='borrar', zona=box(92, 85, 112, 106)),
        # cierre de la habitación 17 contra la terraza (el muro del PDF llega al ventanal; el dibujo deja una rendija)
        dict(tipo='muro', zona=box(6.0, 76.95, 6.25, 77.95)),
    ],
}


def corregir(piso, planos, bloques, textos):
    import pdf_zonas
    from shapely.geometry import LineString as LS, Point as PT
    for c in CORRECCIONES.get(piso, []):
        z = c['zona']
        if c['tipo'] == 'capa':
            n = 0
            for i, e in enumerate(planos):
                if e[0] == c['de'] and len(e[2]) >= 2 and z.contains(LS([(x / 1000, y / 1000) for x, y in e[2]])) \
                        and LS([(x / 1000, y / 1000) for x, y in e[2]]).length >= c.get('min_largo', 0):
                    planos[i] = (c['a'],) + tuple(e[1:])
                    n += 1
            print(piso, 'capa', c['de'], '->', c['a'], n)
            continue
        if c['tipo'] == 'muro':
            planos.append(('P0 - Paredes', 'LWPOLYLINE', [(x * 1000, y * 1000) for x, y in z.exterior.coords], True))
            continue
        if c['tipo'] == 'ventanas_pdf':
            vs = pdf_zonas.bandas_ventana(c['carpeta'], z, c.get('solo'), minimo=1.5, direcciones=(True,))
            for q in vs:
                planos.append(('VE', 'LWPOLYLINE', [(x * 1000, y * 1000) for x, y in q.exterior.coords], True))
            print(piso, 'ventanas_pdf', len(vs), [tuple(round(v, 1) for v in q.bounds) for q in vs][:12])
            continue
        if c['tipo'] == 'ventanal':
            # dos líneas paralelas largas a menos de 0,6 m: se cierran como una banda de ventana (capa VE)
            largas = [i for i, e in enumerate(planos) if e[0] == c['capa'] and len(e[2]) == 2
                      and z.contains(LS([(x / 1000, y / 1000) for x, y in e[2]]))
                      and LS([(x / 1000, y / 1000) for x, y in e[2]]).length >= c['min_largo']]
            usadas = set()
            for i in largas:
                for j in largas:
                    if j <= i or i in usadas or j in usadas:
                        continue
                    a_, b_ = LS(planos[i][2]), LS(planos[j][2])
                    if a_.distance(b_) < 600 and abs(a_.length - b_.length) < 2000:
                        p0, p1 = planos[i][2]
                        q0, q1 = planos[j][2]
                        if (p0[0] - p1[0]) * (q0[0] - q1[0]) + (p0[1] - p1[1]) * (q0[1] - q1[1]) < 0:
                            q0, q1 = q1, q0
                        planos.append(('VE', 'LWPOLYLINE', [p0, p1, q1, q0, p0], True))
                        usadas |= {i, j}
            planos = [e for k, e in enumerate(planos) if k not in usadas]
            print(piso, 'ventanal', len(usadas) // 2)
            continue
        if c['tipo'] == 'borrar':
            dentro = lambda pts: len(pts) >= 2 and z.intersects(LS([(x / 1000, y / 1000) for x, y in pts]))
            a = (len(planos), len(bloques), len(textos))
            planos = [e for e in planos if not dentro(e[2])]
            bloques = [b for b in bloques if not z.contains(PT(b['x'] / 1000, b['y'] / 1000))]
            textos = [t for t in textos if not z.contains(PT(t[2] / 1000, t[3] / 1000))]
            print(piso, 'borrar', a, '->', (len(planos), len(bloques), len(textos)))
            continue
        capas = c.get('capas', set())
        if capas:
            def dentro(e):
                pts = [(x / 1000, y / 1000) for x, y in e[2]]
                return len(pts) >= 2 and z.buffer(0.05).contains(LS(pts))
            antes = len(planos)
            planos = [e for e in planos if not (e[0] in capas and dentro(e))]
            print(piso, c['tipo'], 'quitados', antes - len(planos))
        if c['tipo'] == 'gris':
            g = pdf_zonas.muros_grises(c['carpeta'], z)
            for q in g:
                pts = [(x * 1000, y * 1000) for x, y in q.exterior.coords]
                planos.append(('P0 - Paredes', 'LWPOLYLINE', pts, True))
            print(piso, 'gris', len(g), 'muros del PDF')
        elif c['tipo'] == 'lineas':
            ls = pdf_zonas.lineas(c['carpeta'], z, c.get('solo'))
            for pts in ls:
                planos.append(('PA', 'LINE', [(x * 1000, y * 1000) for x, y in pts], False))
            print(piso, 'lineas', len(ls), 'trazos del PDF')
    return planos, bloques, textos


CONSTANTES = ('CIERRES', 'EXTERIOR_FORZADO', 'SEPARADORES', 'ZONAS', 'NOMBRES', 'NOMBRES_ZONA', 'EXTERIORES')
PASOS = ('_columnas', '_ventanas', '_puertas', '_gradas', '_nucleo_hall', '_franjas', '_tabiques', '_escaleras',
         '_muros', '_ambientes', '_mobiliario', '_nombres', '_ajustes_finales')


class ModeloPiso(MOD.Modelo):
    def __init__(self, piso):
        self.piso = piso
        vacios = {'CIERRES': [], 'EXTERIOR_FORZADO': [], 'SEPARADORES': [], 'ZONAS': [], 'NOMBRES': {},
                  'NOMBRES_ZONA': [], 'EXTERIORES': []}
        vacios.update(AJUSTES.get(piso, {}))
        for k in CONSTANTES:
            setattr(MOD, k, vacios[k])
        self.planos, self.bloques, self.textos = fuente.cargar(piso)
        self.planos, self.bloques, self.textos = corregir(piso, self.planos, self.bloques, self.textos)
        vistos, bl = set(), []
        for b in self.bloques:
            k = (b['nombre'], round(b['x']), round(b['y']), round(b['rot'] or 0))
            if k not in vistos:
                vistos.add(k)
                bl.append(b)
        self.bloques = bl
        self.textos = list(dict.fromkeys(self.textos))
        polis, self.lz, *_ = M.extraer(self.planos, self.bloques)
        self.x0, self.y0 = self.lz.x0, self.lz.y0
        self.muros_raw = unary_union(polis)
        self.fallos = []
        for paso in PASOS:
            try:
                getattr(self, paso)()
            except Exception as e:   # un paso propio de la planta baja que no aplica a este piso
                self.fallos.append((paso, repr(e)))
                traceback.print_exc()

    @property
    def origen(self):
        """Desplazamiento (m) del marco del modelo al marco de la planta baja."""
        return self.x0 / 1000.0, self.y0 / 1000.0


if __name__ == '__main__':
    piso = sys.argv[1]
    from modelo_piso import ModeloPiso as MP   # así el pickle guarda la clase como modelo_piso.ModeloPiso
    m = MP(piso)
    print(piso, 'ambientes', len(getattr(m, 'ambientes', [])), 'puertas', len(getattr(m, 'puertas', [])),
          'muros', len(getattr(m, 'muros', [])), 'origen', m.origen, 'fallos', m.fallos)
    pickle.dump(m, open(f'/tmp/modelo_{piso}.pkl', 'wb'))

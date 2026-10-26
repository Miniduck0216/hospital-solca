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

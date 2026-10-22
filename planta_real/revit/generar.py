"""
Genera el modelo IFC de la planta baja de SOLCA Quito desde el DXF real.
Uso: python3 planta_real/revit/generar.py
Salidas en planta_real/revit/salida/: solca_pb.ifc (para Revit) y solca_pb_planta.png (control).
"""
import os, sys
AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
from modelo import Modelo
from a_ifc import escribir
from vista_planta import dibujar

if __name__ == '__main__':
    m = Modelo()
    sal = os.path.join(AQUI, 'salida')
    os.makedirs(sal, exist_ok=True)
    cuenta, n_let = escribir(m, os.path.join(sal, 'solca_pb.ifc'))
    dibujar(m, os.path.join(sal, 'solca_pb_planta.png'), dpi=110, ancho=18)
    print(cuenta, 'letreros', n_let, 'ambientes', len(m.ambientes))
    if '--pickle' in sys.argv:
        import pickle
        pickle.dump(m, open('/tmp/modelo.pkl', 'wb'))

"""
Genera el modelo IFC de la planta baja de SOLCA Quito desde el DXF real.
Uso: python3 planta_real/revit/generar.py
Salidas en planta_real/revit/salida/: solca_pb.ifc (para Revit), solca_pb_plano_2d.pdf/png (plano de
presentación A1 1:200) y solca_pb_planta.png (control).
"""
import os, sys
AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
from modelo import Modelo
from a_ifc import escribir
from vista_planta import dibujar

if __name__ == '__main__':
    m = Modelo()
    from muebles_std import amoblar
    print('muebles de consultorio', amoblar(m))
    sal = os.path.join(AQUI, 'salida')
    os.makedirs(sal, exist_ok=True)
    cuenta, n_let = escribir(m, os.path.join(sal, 'solca_pb.ifc'))
    dibujar(m, os.path.join(sal, 'solca_pb_planta.png'), dpi=110, ancho=18)
    import plano_2d
    plano_2d.dibujar(m, os.path.join(sal, 'solca_pb_plano_2d.pdf'), os.path.join(sal, 'solca_pb_plano_2d.png'))
    print(cuenta, 'letreros', n_let, 'ambientes', len(m.ambientes))
    if '--pickle' in sys.argv:
        import pickle
        pickle.dump(m, open('/tmp/modelo.pkl', 'wb'))

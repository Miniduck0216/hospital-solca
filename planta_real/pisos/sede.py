"""
Sede y edificio que procesa el pipeline de pisos.

Sin nada: Quito, edificio principal, exactamente como siempre (DXF y cajas en fuente.py, salida al respaldo local
public/sedes/quito/principal, modelos en /tmp).

Con la variable SOLCA_SEDE=<sede>/<edificio> (la pone regenerar.sh --sede <s> --edificio <e>), el pipeline lee
planta_real/sedes/<sede>/<edificio>/config.json y escribe en una carpeta de trabajo fuera de public/:
planta_real/salida_sedes/<sede>/<edificio>/ (ignorada por git). De ahí la toma scripts/plano_paquete.mjs para armar
el paquete que se sube a OM3; el mapa lo lee de OM3 (/v1/administracion/mapa/geo), no de public/.

config.json (ejemplos en planta_real/sedes/santo-domingo/principal e imbabura/principal):
  nombre, dxf, unidad (metros por unidad del dibujo), traslado ([x, y] en metros: local = dibujo·unidad + traslado),
  pisos [{clave, nombre, nivel, altura, caja: [x0, y0, x1, y1] en unidades del dibujo, desplaza: [dx, dy] metros}],
  capas {PA|VE|COL|TA|NO|MU|GR: [regex de capas del DXF]}, rellenos [regex de capas de HATCH que son muro],
  textos [regex de capas con los nombres de los ambientes], puertas {simple: regex, doble: regex},
  columnas (regex de bloques), conservar (regex de bloques que se guardan como bloque y no se explotan),
  renombrar_bloques [[regex, nombre de Quito]] (muebles: INOD, AS-03…), textos_ignorar [regex del texto],
  textos_reemplazar [[regex, texto]], sueltos_max (m²: piezas sueltas que no cierran el exterior, 1,5 por defecto),
  conectores [{x, y, id, nombre, personal}] (nombres de ascensores y escaleras, marco local en metros),
  pisos[].extra [{nombre, caja}] (ambientes que el dibujo no cierra, marco local en metros),
  pisos[].correcciones [{tipo, zona, …}] (los mismos tipos que modelo_piso.CORRECCIONES de Quito: muro, vidrio,
  borrar, quitar, capa, pares, lineas_muro, macizo; zona [x0, y0, x1, y1] o polígono), pisos[].separadores
  [[[x, y], [x, y]]] (límites entre ambientes sin muro), pisos[].nombres {«x,y»: nombre} (el ambiente que contiene el
  punto se llama así), pisos[].fusionar [[x, y]] (cuarto chico que se une al vecino mayor),
  sanitarios_relleno [regex de capas de HATCH que dibujan aparatos sanitarios: el cuarto sin rótulo que los tiene
  es SS.HH., como con los bloques de inodoro de Quito] y
  geo {lat0, lon0, ang (grados, como datos.json), nota}. Con «calibrar»: true un piso se alinea con el de nivel 0 por
  sus columnas (fuente.calibrar_sede).
"""
import json
import os

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, '..', '..'))

_v = os.environ.get('SOLCA_SEDE', '').strip().strip('/').lower()
SEDE, EDIFICIO = (_v.split('/') + ['principal'])[:2] if _v else ('quito', 'principal')
ES_QUITO = (SEDE, EDIFICIO) == ('quito', 'principal')

QUITO_PISOS = ['SB', 'PB', 'P1', 'P2', 'P3']
QUITO_NIVEL = {'SB': -1, 'PB': 0, 'P1': 1, 'P2': 2, 'P3': 3}
QUITO_NOMBRE = {'SB': 'Subsuelo 1', 'PB': 'Planta baja', 'P1': 'Piso 1', 'P2': 'Piso 2', 'P3': 'Piso 3'}

if ES_QUITO:
    CFG = None
    SALIDA = os.path.join(RAIZ, 'public', 'sedes', 'quito', 'principal')
    TMP = '/tmp'
    CACHE = os.path.join(AQUI, 'cache')
    PISOS = list(QUITO_PISOS)
    NIVEL = dict(QUITO_NIVEL)
    NOMBRE = dict(QUITO_NOMBRE)
    ALTURA = {p: 3.84 for p in PISOS}
    NOMBRE_EDIFICIO = 'Hospital SOLCA Quito'
else:
    _ruta = os.path.join(RAIZ, 'planta_real', 'sedes', SEDE, EDIFICIO, 'config.json')
    if not os.path.exists(_ruta):
        raise SystemExit(f'No existe {_ruta}: cree la configuración de la sede {SEDE}, edificio {EDIFICIO}')
    CFG = json.load(open(_ruta, encoding='utf-8'))
    SALIDA = os.path.join(RAIZ, 'planta_real', 'salida_sedes', SEDE, EDIFICIO)
    TMP = os.path.join(SALIDA, '_trabajo')
    CACHE = os.path.join(TMP, 'cache')
    PISOS = [p['clave'] for p in CFG['pisos']]
    NIVEL = {p['clave']: p['nivel'] for p in CFG['pisos']}
    NOMBRE = {p['clave']: p['nombre'] for p in CFG['pisos']}
    ALTURA = {p['clave']: float(p.get('altura', 4.0)) for p in CFG['pisos']}
    NOMBRE_EDIFICIO = CFG.get('nombre', f'Hospital SOLCA {SEDE}')
    os.makedirs(CACHE, exist_ok=True)


def pkl(piso):
    """Modelo guardado de un piso (modelo_piso.py lo escribe; exportar_piso.py y glb_piso.py lo leen)."""
    return os.path.join(TMP, f'modelo_{piso}.pkl')


def ifc(piso):
    return os.path.join(TMP, f'solca_{piso.lower()}.ifc')


def piso_cfg(piso):
    return next((p for p in CFG['pisos'] if p['clave'] == piso), None) if CFG else None


def geo():
    """Georreferencia común a todos los pisos del edificio (mismo marco local): el centro (cx, cy) es el de la caja
    de referencia (la del primer piso de nivel 0, o el primero) llevado al marco local."""
    g = dict(CFG['geo'])
    ref = next((p for p in CFG['pisos'] if p['nivel'] == 0), CFG['pisos'][0])
    x0, y0, x1, y1 = ref['caja']
    u, (tx, ty) = CFG['unidad'], CFG['traslado']
    d = ref.get('desplaza', [0, 0])
    g.setdefault('cx', round((x0 + x1) / 2 * u + tx + d[0], 3))
    g.setdefault('cy', round((y0 + y1) / 2 * u + ty + d[1], 3))
    g.setdefault('ox', 0.0)
    g.setdefault('oy', 0.0)
    return {k: g[k] for k in ('lat0', 'lon0', 'cx', 'cy', 'ang', 'ox', 'oy')}

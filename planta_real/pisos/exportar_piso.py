"""
Datos de un piso para la web (public/<piso>/datos.json), con el mismo formato que la planta baja
(planta_real/web/exportar_datos.py): ambientes, muros, ventanas, puertas, trazos, muebles, gradas, entradas y la
rejilla de navegación. Todo en el marco de la planta baja (mismo GEO): los pisos quedan uno sobre otro.

Diferencia con la planta baja: no hay líneas verdes dibujadas a mano. La red de pacientes se arma sola con el
eje de los espacios de circulación (pasillos, halls, salas de espera y espacios abiertos sin nombre).
Uso: python3 planta_real/pisos/exportar_piso.py P1   (lee /tmp/modelo_P1.pkl)
"""
import os
import sys
import json
import math
import base64
import pickle
import numpy as np
import cv2
from scipy import ndimage
from shapely.geometry import Polygon, Point, LineString
from shapely.ops import unary_union, polylabel

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, '..', '..'))
sys.path.insert(0, os.path.join(RAIZ, 'planta_real', 'revit'))
sys.path.insert(0, os.path.join(RAIZ, 'planta_real', 'web'))
sys.path.insert(0, AQUI)
import exportar_datos as ED   # noqa: E402
from modelo import lista_polis, min_ancho  # noqa: E402

from shapely.geometry import box  # noqa: E402
from shapely import affinity  # noqa: E402
# ambientes que el dibujo no cierra (marco de la planta baja): el ascensor y la escalera del Bloque A en el piso 1
# están dibujados como detalle (capas de ejes y gradas), sin muros alrededor
EXTRA = {
    'PB': [
        # bloque de bodegas, fila sur: cada oficina con su puerta doble al pasillo (el dibujo las deja abiertas)
        ('REPARACIONES', box(90.95, -27.25, 93.9, -20.97)), ('INFECTOLOGIA', box(94.1, -27.25, 97.1, -20.97)),
        ('PSIOCOLOGIA LABORAL', box(97.3, -27.25, 100.35, -20.97)), ('AUDITORIA MEDICA', box(100.55, -27.25, 103.5, -20.97)),
        ('COMPRAS', box(103.7, -27.25, 106.75, -20.97)),
        # hospitalización de medicina nuclear: cuartos del lado oeste del pasillo y la habitación 8
        ('SALA REUNIONES', box(156.9, 40.5, 159.65, 44.4)), ('BODEGA', box(156.9, 44.6, 159.65, 48.2)),
        ('UTILERIA', box(156.9, 48.4, 159.65, 52.1)), ('UTILERIA', box(156.9, 52.3, 159.65, 56.05)),
        ('HAB. 8', box(164.75, 32.35, 166.7, 37.1)),
        # laboratorio de genética: los tres cubículos del lado sur (tabiques sin cierre hacia el laboratorio)
        ('SALA REUNIONES', box(109.3, 23.7, 112.4, 27.1)), ('CITOGENETICA CONVENCIONAL', box(112.65, 23.7, 115.3, 27.1)),
        ('COORDINACION GENETICA', box(115.5, 23.7, 118.25, 27.1)),
        # emergencia: biopsias (cubículos con cortina), camillas y ginecología
        ('BIOPSIAS', box(117.35, 95.9, 121.95, 97.95)), ('BIOPSIAS', box(117.35, 93.83, 121.95, 95.8)),
        ('BIOPSIAS', box(117.35, 91.75, 121.95, 93.73)), ('CAMILLAS', box(120.3, 98.1, 121.95, 101.1)),
        ('GINECOLOGIA', box(126.7, 98.1, 130.5, 101.15)),
        # hospitalización de medicina nuclear, junto a la estación de enfermería: ascensores, comedor (entre el
        # mostrador en L y el cuarto C3-L1-03) y el cuarto chico C3-L1-01 (puerta desde el comedor)
        ('ASCENSORES', box(141.32, 33.72, 144.5, 36.55)),
        ('COMEDOR', unary_union([box(144.6, 32.2, 147.2, 33.62), box(144.6, 33.6, 145.0, 36.55),
                                 box(145.5, 33.6, 146.75, 36.0), box(146.25, 35.95, 146.75, 36.55)])),
        ('', box(147.47, 32.2, 148.38, 33.52)),
        # U.C.I.: la habitación 06 es cuarto como la 04 y la 05; lavachatas, utilería sucia y cafetería separadas
        ('HAB. 06', box(137.42, 75.72, 140.88, 78.82)),
        ('LAVACHATAS', box(142.72, 83.45, 147.42, 85.05)),
        ('UTILERIA SUCIA', box(142.72, 78.32, 147.42, 83.15).difference(box(145.5, 78.0, 147.5, 79.5))),
        ('CAFETERIA', box(140.9, 75.2, 145.6, 78.12)),
        # gastroenterología: sala 03 (cortina hacia procedimientos), sala de procedimientos, lencería, U.U. y sala 01
        ('GASTROENTEROLOGIA 03', box(103.02, 49.95, 106.42, 54.95)),
        ('SALA PROCEDIMIENTOS', box(106.55, 49.95, 108.85, 54.95)), ('GASTROENTEROLOGIA 02', box(109.05, 49.95, 112.3, 54.95)),
        ('LENC.', box(103.02, 55.05, 104.25, 56.2)), ('U.U.', box(104.4, 55.05, 106.45, 56.2)),
        ('GASTROENTEROLOGIA 01', box(109.05, 56.65, 112.3, 62.55)),
        # toma de muestras: la secretaría (mostrador al pasillo) y el vestíbulo de biología molecular, aparte del pasillo
        ('SECRETARIA', box(89.9, 91.75, 93.55, 94.5)), ('BIOLOGIA MOLECULAR', box(84.6, 91.8, 88.2, 94.45)),
        ('', box(147.05, 33.72, 148.45, 36.85)),   # cuarto C3-L1-03 junto al comedor (el dibujo lo rellena como muro)
        # toma de muestras (laboratorio): utilería usada y limpia, abiertas al pasillo
        ('U. USADA', box(102.97, 16.37, 104.3, 17.6)), ('U. LIMPIA', box(102.97, 15.17, 104.3, 16.13)),
        # centro quirúrgico: utilería limpia entre la circulación blanca y recuperación
        ('U. LIMPIA', box(130.95, 63.8, 135.25, 66.45)),
        ],
    'P1': [('ASCENSOR', box(47.97, 93.25, 51.07, 95.59)),
           ('ESCALERA', box(46.4, 91.7, 51.3, 97.8).difference(box(47.97, 93.25, 51.07, 95.59))),
           # bloque de servicio del ala oeste: las puertas de cada cuarto no están dibujadas como bloque, así que el
           # dibujo los junta con el pasillo angosto de su lado (orden de arriba abajo del PDF)
           ('BAÑO MUJERES', box(28.05, 84.45, 29.35, 85.9)),
           ('BAÑO HOMBRES', box(28.05, 82.85, 29.35, 84.35)),
           ('UTILERÍA SUCIA', box(28.05, 81.25, 29.35, 82.75)),
           ('LAVACHATA', box(28.05, 79.75, 29.35, 81.15)),
           ('LIMPIEZA', box(28.05, 78.3, 29.35, 79.65)),
           ('PASILLO', box(29.42, 78.45, 30.12, 86.0)),
           # torre: igual que el piso 2 (preparación médica abierta a la estación por el mostrador; cuarto de ductos)
           ('PREPARACIÓN MÉDICA', box(72.16, 69.15, 74.84, 73.3)),
           ('DUCTOS', box(72.16, 76.2, 75.02, 78.54)),
           # terraza del extremo oeste (con baranda), al lado de la habitación 17
           ('TERRAZA', box(4.15, 76.75, 6.0, 84.95)),
           # terraza de la jardinera al sur de las habitaciones 13 y 11: se entra por la puerta de Almacén
           ('TERRAZA', box(16.6, 77.25, 26.88, 78.55)),
           # cafetería: cerrada contra el techo del este y contra su terraza (muro con puerta doble); la terraza tiene
           # su borde de ventanas
           ('CAFETERÍA', box(50.42, 77.25, 58.72, 85.15)),
           ('', box(50.42, 74.12, 58.72, 77.15))],
    # subsuelo: cuartos que se abren a la circulación sin puerta dibujada (el dibujo los junta con el pasillo)
    'SB': [('AUDITORIO', box(44.95, 40.45, 62.8, 52.95)),
           ('CAFETERÍA', box(96.95, 27.45, 99.6, 42.7)),
           ('CONTROL 1', box(144.3, 58.6, 146.7, 60.3)), ('CONTROL 2', box(153.6, 58.6, 156.1, 60.3)),
           ('BODEGA', box(156.15, 58.6, 157.1, 60.3)), ('CONTROL', box(161.45, 58.6, 163.85, 60.3)),
           ('BODEGA', box(163.9, 58.6, 164.7, 60.3)),
           ('RECUPERACIÓN', box(147.75, 34.8, 154.15, 42.9)),
           ('ABASTECIMIENTO', box(143.05, 33.6, 145.05, 35.25)), ('R. FARM.', box(145.1, 35.3, 147.55, 36.75)),
           # bloque sur: dos bodegas de Estadística y el vestidor que el dibujo junta con el pasillo de Mantenimiento
           ('BODEGA ESTADÍSTICA', box(101.3, -32.7, 104.2, -26.6)), ('BODEGA ESTADÍSTICA', box(104.5, -32.7, 107.3, -26.6)),
           ('VESTIDOR', box(94.75, -23.45, 97.9, -20.5)),
           # pasillo que une Lactancia y Call Center con la cafetería y el despacho (el dibujo lo junta con el comedor)
           ('PASILLO', unary_union([box(90.35, 42.85, 102.75, 44.25), box(99.9, 27.45, 102.75, 44.25),
                                    box(84.75, 40.15, 90.4, 42.85), Polygon([(90.4, 40.2), (92.6, 42.85), (90.4, 42.85)])]))],
    # piso 2, bloque central: la preparación médica se abre a la estación de enfermería por el mostrador (el dibujo
    # la junta con el pasillo) y el cuarto de ductos queda como hueco entre sus tres ductos
    'P2': [('PREPARACIÓN MÉDICA', box(72.16, 69.15, 74.84, 73.3)),
           ('DUCTOS', box(72.16, 76.2, 75.02, 78.54))],
    # piso 3: Apoyo se abre a la estación de enfermería por el mostrador (el dibujo lo junta con el pasillo); entre
    # Jefatura y Aseo, el paso que une los dos pasillos queda como hueco
    'P3': [('APOYO', box(72.16, 65.35, 74.84, 68.0)),
           ('PASILLO', box(72.35, 81.42, 74.63, 82.58))],
}
# espacio libre sin ambiente que es paso (marco de la planta baja): en el subsuelo, los laberintos de entrada de los
# búnkeres de los aceleradores (el dibujo los deja entre muros y sin piso)
HUECOS_PASO = {'SB': [box(141.2, 60.3, 159.4, 66.7)]}
# contornos de muebles que el dibujo cierra como ambiente (punto dentro): vuelven al ambiente vecino más grande.
# U.C.I.: el mesón rotulado «U.C.I.»
FUSIONAR = {'PB': [(127.0, 78.8), (134.0, 78.7)]}
# cuartos que reparten a otros (la ruta los cruza): la sala de procedimientos de gastroenterología da a las salas 02
# y 03
REPARTE = {'PB': [(107.7, 52.0), (86.4, 93.1)]}
# pisos donde los baños con inodoro que el dibujo deja sin ambiente (el inodoro de cada habitación, los dos baños
# chicos del bloque central) se suman como ambiente «BAÑO»
BANOS_HUECO = {'SB', 'P1', 'P2', 'P3'}
# muros dobles que el dibujo deja huecos por dentro (marco de la planta baja): en el piso 2, el muro entre las
# habitaciones 207 y 205
MUROS_EXTRA = {
    'PB': [*[box(x - 0.22, y - 0.22, x + 0.22, y + 0.22) for x, y in   # columnas del área de medicina nuclear
             ((146.1, 57.4), (150.85, 57.4), (155.65, 57.4), (165.15, 57.4), (143.05, 51.7), (146.35, 48.1),
              (151.1, 48.1), (155.6, 52.8))],
           box(156.72, 40.4, 156.87, 56.2),    # medicina nuclear: muro oeste de sala de reuniones, bodega y utilerías
           box(90.85, -20.96, 106.85, -20.82),  # bodegas: frente de las oficinas de la fila sur (puertas dobles)
           # ascensores junto a la estación de enfermería (puerta hacia la estación) y el mostrador en L del comedor
           box(144.5, 33.62, 144.62, 36.62), box(141.25, 33.6, 144.62, 33.72),
           box(141.25, 36.5, 141.95, 36.66), box(143.85, 36.5, 144.62, 36.66),
           box(145.05, 33.65, 145.45, 36.4), box(145.05, 36.0, 146.2, 36.4),
           # cuarto C3-L1-01: muro hacia el comedor (con su puerta) y hacia el cuarto C3-L1-03
           box(147.25, 33.25, 147.45, 33.62), box(147.25, 33.52, 148.4, 33.68)],
    'P1': [box(63.2, 67.84, 69.9, 68.37),   # entre las habitaciones 109 y 107
           # tabiques con puerta doble que cierran el pasillo del ala oeste (hacia las habitaciones) y el paso de la
           # recepción y la cafetería hacia el hall de las habitaciones de la torre
           box(48.15, 86.8, 48.25, 87.1), box(48.15, 89.1, 48.25, 89.8),
           box(57.55, 85.2, 57.65, 85.83), box(57.55, 87.85, 57.65, 88.97),
           # cafetería: muro con puerta doble hacia su terraza y muro contra el techo de la planta baja (lado este)
           box(50.35, 77.15, 52.18, 77.25), box(53.47, 77.15, 58.8, 77.25), box(58.72, 77.2, 58.86, 85.15),
           # el balcón se cierra contra la escalera del Bloque A (se entra solo por la oficina)
           box(51.0, 97.97, 51.12, 99.55)],
    'P2': [box(63.2, 67.85, 69.9, 68.37)],
}
# muros que el dibujo trae y el plano no tiene (marco de la planta baja): la línea entre los dos mesones de
# Abastecimiento y Preparación Médica es el respaldo de los mesones, no un muro
QUITAR_MUROS = {
    # tragaluces de la dirección y de quimioterapia: el DWG los rellena como si fueran muro; son patios de luz
    'PB': [box(58.0, 27.8, 62.6, 37.0), box(90.4, 27.85, 99.4, 32.95),
           box(141.4, 72.4, 155.3, 72.8),   # línea del borde de la losa junto a las centrales de gases: no es muro
           box(141.95, 36.45, 143.85, 36.75),   # puerta de los ascensores hacia la estación de enfermería
           box(147.05, 33.72, 148.45, 36.85),   # interior del cuarto C3-L1-03
           box(83.9, -8.65, 90.45, -6.25)],   # tramo de fachada con montantes junto a la Bodega Tics: no existe
    'P1': [box(72.17, 73.25, 74.83, 73.5)],
    'P2': [box(72.17, 73.25, 74.83, 73.5)],
}
# ventanas que no son ventanas: el borde de la jardinera y la pérgola al sur del ala oeste (piso 1)
QUITAR_VENTANAS = {
    'PB': [box(83.9, -8.65, 90.45, -6.25)],   # vidrios del tramo de fachada junto a la Bodega Tics (no existe)
    'P1': [box(3.9, 75.4, 50.7, 75.8), box(16.5, 77.55, 50.3, 77.75), box(45.3, 72.7, 45.7, 75.4)],
}
# ventanas que en el plano son muros (doble línea de la capa de vidrios): las centrales de gases de la U.C.I.
VENTANAS_A_MUROS = {'PB': [box(146.5, 76.3, 156.1, 86.5)]}
# ventanas que faltan: el borde de la terraza de la cafetería (piso 1)
VENTANAS_EXTRA = {
    'P1': [box(50.28, 74.0, 58.86, 74.12), box(58.74, 74.0, 58.86, 77.2), box(50.28, 74.0, 50.4, 77.15)],
}
# barandas de 1 m (no dejan pasar, no son muros): eje de la escalera de emergencia del ala oeste, borde de la escalera
# del Bloque A hacia la sala del balcón, borde de la terraza junto a Almacén
BARANDAS_EXTRA = {
    'P1': [box(0.65, 90.02, 0.85, 93.01), box(51.03, 95.47, 51.14, 97.97), box(16.6, 77.15, 26.9, 77.25)],
}
# puertas que el dibujo no trae como bloque: (a, b, doble)
PUERTAS_EXTRA = {
    # clínica de heridas: puertas dobles de la fachada suroeste (en el DWG solo con trazo punteado)
    'PB': [((159.15, 94.45), (160.12, 93.4), True), ((164.62, 88.16), (165.52, 87.18), True),
           # bodegas, fila sur: puerta doble de cada oficina
           ((91.6, -20.89), (93.2, -20.89), True), ((94.95, -20.89), (96.5, -20.89), True),
           ((98.15, -20.89), (99.75, -20.89), True), ((101.2, -20.89), (102.8, -20.89), True),
           ((104.5, -20.89), (106.1, -20.89), True),
           ((147.35, 32.22), (147.35, 33.22), False)],   # cuarto C3-L1-01, desde el comedor
    # subsuelo: vanos del auditorio hacia el hall
    'SB': [((62.9, 51.45), (62.9, 53.0), True), ((62.9, 46.3), (62.9, 48.0), True), ((62.9, 40.4), (62.9, 41.85), True),
           # laberinto del Acelerador Lineal 2: puerta blindada desde el pasillo y paso hacia el búnker
           ((157.35, 61.3), (158.1, 62.05), False), ((156.2, 64.15), (157.9, 64.15), True)],
    'P1': [((48.2, 87.1), (48.2, 89.1), True), ((57.6, 85.83), (57.6, 87.85), True),
           ((52.18, 77.2), (53.47, 77.2), True),
           ((54.87, 95.42), (55.84, 95.42), False),    # oficina, desde la recepción
           ((54.82, 98.65), (54.82, 99.5), False)],    # oficina, hacia el balcón
}
# partes de un ambiente que son exterior: al este de la cafetería, el techo de la planta baja (N +3.95)
RECORTES = {
    'P1': [box(58.86, 73.0, 63.0, 85.1)],
}
# mesas redondas con dos sillas (centro), en lugar del bloque que el dibujo hace con la mesa y sus sillas
MESAS = {
    'P1': [(54.85, 81.8), (56.35, 81.69), (54.85, 84.47), (56.3, 84.47),
           (51.7, 75.48), (53.81, 75.48), (55.92, 75.48), (58.03, 75.48)],
}
ZONA_MESAS = {'P1': box(50.4, 74.1, 58.72, 85.3)}
# mesón de la cafetería (barra con lavadero) que el dibujo deja como contorno
MESONES_EXTRA = {'P1': [box(57.45, 77.25, 58.7, 80.05)]}
# escaleras dibujadas como detalle (capa P0 - Gradas) que el modelo no arma: tramos en orden de subida
# (zona del tramo, eje de las gradas, sentido) y descansos entre tramos
ESCALERAS_EXTRA = {
    'P1': [
        dict(tramos=[(box(0.84, 90.0, 1.97, 93.03), 'y', 1), (box(-0.46, 90.0, 0.66, 93.03), 'y', -1)],
             descansos=[box(-0.45, 93.01, 1.95, 94.35)]),
        dict(tramos=[(box(47.7, 91.74, 50.46, 93.12), 'x', -1), (box(46.38, 93.08, 47.77, 95.82), 'y', 1)],
             descansos=[box(46.4, 91.76, 47.75, 93.1)]),
    ],
}
# pasos que el dibujo tapa con un detalle (marco de la planta baja): en el piso 1, el puente vidriado entre el ala oeste
# y la torre tiene un tragaluz triangular dibujado con la capa de paredes; se camina a su alrededor
# espacios abiertos que el dibujo no cierra como ambiente (losa con columnas, sin rótulo propio): se agregan como
# ambiente sin nombre con lo que queda libre entre los cuartos
AREAS_LIBRES = {
    # planta baja: área de hospitalización de medicina nuclear entre los quirófanos y las habitaciones (bajo la losa
    # escalonada del plano, con sus columnas)
    'PB': [Polygon([(141.45, 40.55), (156.7, 40.55), (156.7, 56.55), (172.3, 56.55), (172.3, 66.5), (165.2, 66.5),
                    (165.2, 70.1), (159.6, 70.1), (159.6, 72.55), (141.45, 72.55)]),
           # circulación técnica (pasillo de servicio entre quimioterapia, gastroenterología y genética)
           ('CIRCULACION TECNICA', box(84.4, 46.55, 109.3, 49.85).union(box(102.75, 20.4, 105.9, 46.7))),
           # pasillos entre la planta vieja y la nueva (rótulos C1-L1-084, 102, 106, 123, 124 y C1-L1-107, C1-L3-047):
           # el dibujo los juntaba con la sala de espera vieja y se perdían al unir
           box(80.25, 40.35, 84.45, 104.75), box(84.4, 85.6, 109.3, 88.65),
           ('OFICINA', box(77.3, 1.85, 83.0, 5.25))],
}
PASOS_LIBRES = {
    # patio entre el edificio y el ala de la clínica de heridas y la morgue: veredas exteriores hasta sus puertas
    'PB': [LineString([(140.2, 95.6), (150.0, 94.6), (158.6, 93.4)]),
           LineString([(144.2, 86.0), (152.0, 88.5), (164.0, 87.4)]),
           LineString([(150.0, 94.6), (152.0, 88.5)]),
           LineString([(150.0, 94.6), (144.5, 106.2), (142.9, 110.9)])],
    'P1': [LineString([(57.8, 86.25), (69.3, 86.25)])],
}
# exterior encerrado por el dibujo: en el piso 1, el rincón entre la fachada norte, el ducto diagonal y los baños del
# hall interno (en el PDF no tiene muros que lo cierren)
EXTERIOR = {
    # tragaluces (patios de luz con aspa en el plano): sin piso ni paso
    'PB': [box(58.0, 27.8, 62.6, 37.0), box(90.4, 27.85, 99.4, 32.95), box(128.35, 30.35, 134.95, 33.55),
           box(88.2, 49.8, 90.4, 53.1),   # franja entre los dos vacíos de gastroenterología
           box(141.3, 32.15, 144.55, 33.6),   # ducto con aspa bajo los ascensores de la estación de enfermería
           box(83.9, -8.65, 90.45, -6.25)],   # el cuarto de fachada junto a la Bodega Tics (no existe)
    'P1': [box(76.8, 40.9, 81.0, 45.7),
           box(2.4, 89.9, 3.95, 95.6),
           box(3.5, 75.3, 50.6, 77.0)],   # franja de jardineras y pérgola entre el ventanal sur y la fachada   # balcón con baranda entre la escalera de emergencia y la habitación 16
}
NOMBRES_PISO = {'SB': 'Subsuelo 1', 'PB': 'Planta baja', 'P1': 'Piso 1', 'P2': 'Piso 2', 'P3': 'Piso 3'}
CIRCULACION = ('PASILLO', 'HALL', 'CIRCULACION', 'CORREDOR', 'ESPERA', 'VESTIBULO', 'RECEPCION', 'ESTAR')
r2 = ED.r2


import re  # noqa: E402
# rótulos que no son nombres de ambiente: códigos de red y de cuarto (C2-L1-089, G1-11), luminarias (L8), zonas,
# rutas de evacuación y notas de nivel
RUIDO = re.compile(r'^(?:[A-Z]\d-[A-Z]\d(?:-\d+[A-Z]?)?|[A-Z]\d-\d+|[A-Z]-\d-\d+|L\d+|ZONA \d+|\(?(PRIMER|SEGUNDO|TERCER) +PISO\)?|'
                   r'PISO \d|PLANTA BAJA|PLANTA|SUBSUELO \d?|N ?[=+] ?[\d.,]+|MC-[\w-]+|\d+ ESCALO[MN]ES.*|'
                   r'GRADAS DE EMERGENCIA.*|\d+ ?(?:ER|DO|RO|TO|O)\.? PISO|PUNTO DE ENCUENTRO|PARQUEADERO \d*|HACIA PB|DE PISO|S)$', re.I)


def limpiar_nombre(n):
    if not n:
        return ''
    partes = []
    for p in n.split(' / '):
        if RUIDO.match(p.strip()):
            continue
        pal = [w for w in p.split() if not RUIDO.match(w)]
        q = ' '.join(pal).strip(' -·')
        if q and not RUIDO.match(q) and q not in partes:
            partes.append(q)
    return ' / '.join(partes[:2])


def habitaciones(m):
    """Rótulos «HAB 101» que el modelo no asignó (texto girado: su punto de inserción cae en el borde del cuarto, y el
    cuarto quedó con el código de red de un tomacorriente): cada cuarto sin nombre toma el rótulo de habitación que cae
    dentro o a menos de 0,6 m, si es uno solo y no lo tiene ya otro cuarto."""
    import re as _re
    usados = {a['nombre'].upper() for a in m.ambientes if a['nombre']}
    hab = []
    for c, t, x, y, h, ap in m.textos:
        t = ' '.join(t.split())
        if _re.fullmatch(r'HAB\.? ?\d{1,3}', t, _re.I) and t.upper() not in usados:
            hab.append((t.upper(), Point(*m.L((x, y)))))
    for a in sorted(m.ambientes, key=lambda a: a['area']):
        if a['nombre'] or not (8 <= a['area'] <= 60):
            continue
        cand = {t for t, p in hab if a['poligono'].contains(p)}
        if not cand:
            cand = {t for t, p in hab if a['poligono'].buffer(0.6).contains(p)}
        if len(cand) == 1:
            a['nombre'] = cand.pop()
            hab = [(t, p) for t, p in hab if t != a['nombre']]


def banos_hueco(m):
    """Baños que el dibujo no cierra como ambiente: espacio libre de 0,8 a 5 m², rodeado por los ambientes del piso
    (también en los bordes de la fachada) y con un inodoro adentro."""
    amb = unary_union([a['poligono'] for a in m.ambientes])
    env = amb.buffer(2.0, join_style=2).buffer(-2.0, join_style=2)
    duro = unary_union([m.muros_raw] + m.columnas + [t['poligono'] for t in m.tabiques])
    resto = env.difference(amb.buffer(0.02)).difference(duro.buffer(0.02))
    ino = [mu['poligono'] for mu in m.muebles if mu['nombre'] == 'Inodoro']
    n = 0
    def largo(q):
        rr = list(q.minimum_rotated_rectangle.exterior.coords)
        return max(math.dist(rr[i], rr[i + 1]) for i in range(4))
    for q in lista_polis(resto):
        if largo(q) > 2.5 and any(q.intersects(i) for i in ino):
            # el compartimento del inodoro unido a la franja angosta de la entrada de la habitación (Hab 108 y 115 del
            # piso 1): se quita la franja (menos de 25 cm de ancho) y queda el compartimento
            sin = [p for p in lista_polis(q.buffer(-0.12, join_style=2).buffer(0.12, join_style=2))
                   if any(p.intersects(i) for i in ino)]
            q = max(sin, key=lambda p: p.area) if sin else q
        if 0.8 <= q.area <= 5 and largo(q) <= 2.5 and not q.buffer(-0.25).is_empty and any(q.intersects(i) for i in ino):
            # cubículo dentro de un baño grande (SS.HH. con varios inodoros): es parte de ese baño
            grande = [a for a in m.ambientes if a['area'] > 3 and re.search(r'BAÑO|SS\.? ?HH|MUJERES|HOMBRES', (a['nombre'] or '').upper())
                      and a['poligono'].distance(q) < 0.2]
            if grande:
                u = unary_union([grande[0]['poligono'], q.buffer(0.12, join_style=2)]).buffer(-0.1, join_style=2)
                if u.geom_type == 'Polygon':
                    grande[0]['poligono'], grande[0]['area'] = u, u.area
                    continue
            m.ambientes.append(dict(poligono=q, nombre='BAÑO', area=q.area, extra=True))
            n += 1
    print('baños sin ambiente', n)


def barandas(m):
    """Barra entre los tramos de una escalera (dibujada como tabique): es baranda de 1 m, no muro. Se saca de los
    tabiques y queda en m.barandas (sigue siendo obstáculo para la ruta)."""
    if hasattr(m, 'barandas'):
        return m.barandas
    tramos = [unary_union(t).convex_hull for t in getattr(m, 'tramos', [])]
    esc = [a['poligono'].convex_hull.buffer(-0.15) for a in m.ambientes
           if sum(a['poligono'].intersection(h).area for h in tramos) >= 0.4 * a['area']]
    m.barandas, quedan = [], []
    for t in m.tabiques:
        g = t['poligono']
        rr = list(g.minimum_rotated_rectangle.exterior.coords)
        lados = sorted(math.dist(rr[i], rr[i + 1]) for i in range(4))
        if lados[0] <= 0.35 and lados[-1] >= 1.5 and any(g.intersection(e).area >= 0.9 * g.area for e in esc if not e.is_empty):
            m.barandas.append(g)
        else:
            quedan.append(t)
    m.tabiques = quedan
    return m.barandas


def sin_guias(m):
    """Guías del dibujo que no son objetos reales: el círculo de giro de 1,5 m de los baños para silla de ruedas (en el
    modelo salía como un mesón redondo) y los trazos delgados que lo cruzan (salían como escritorios). Se quitan."""
    if getattr(m, '_sin_guias', False):
        return
    def circulo(g):
        x0, y0, x1, y1 = g.bounds
        w, h = x1 - x0, y1 - y0
        return 1.1 < w < 1.8 and 1.1 < h < 1.8 and abs(w - h) < 0.2 and 0.7 < g.area / (w * h) < 0.86
    def delgado(g):
        rr = list(g.minimum_rotated_rectangle.exterior.coords)
        return min(math.dist(rr[i], rr[i + 1]) for i in range(4)) < 0.25
    circ = [mu['poligono'] for mu in m.muebles if circulo(mu['poligono'])] + [e for e in m.escritorios if circulo(e)]
    if circ:
        zona = unary_union(circ).buffer(0.05)
        quitar = lambda g: circulo(g) or (delgado(g) and g.intersects(zona))
        m.muebles = [mu for mu in m.muebles if not quitar(mu['poligono'])]
        m.escritorios = [e for e in m.escritorios if not quitar(e)]
    print('guías quitadas', len(circ))
    m._sin_guias = True


def marcos(m):
    """Grosor del vano de cada puerta: el modelo lo mide en la jamba y, cuando la puerta está al final de un tabique
    perpendicular (cuartos del bloque de servicio, baños de la torre), mide el largo del tabique (60 cm). El marco
    salía como un bloque grueso y el corte del vano se comía el tabique: se deja en 20 cm alrededor de su centro."""
    if getattr(m, '_marcos', False):
        return
    for p in m.puertas:
        if p['t1'] - p['t0'] > 0.3:
            c = (p['t0'] + p['t1']) / 2
            p['t0'], p['t1'] = c - 0.1, c + 0.1
            a, b, nrm = np.array(p['a']), np.array(p['b']), p['nrm']
            p['rect'] = Polygon([tuple(a + nrm * p['t0']), tuple(b + nrm * p['t0']), tuple(b + nrm * p['t1']),
                                 tuple(a + nrm * p['t1'])])
    m._marcos = True


def es_circulacion(nombre, area):
    n = (nombre or '').upper()
    if not n:
        return area >= 30
    return any(c in n for c in CIRCULACION)


def unir_partes(libre, res, columnas, salto=3.0, minimo=12.0):
    """Partes del piso libre separadas por un detalle del dibujo (un vidrio, un vano mal cerrado): se unen a la
    parte principal con un paso recto de 0,75 m si quedan a menos de `salto` metros. Las partes de menos de
    `minimo` m² que no se unen se descartan (huecos de muebles, ductos)."""
    et, n = ndimage.label(libre, structure=np.ones((3, 3)))
    if n <= 1:
        return libre
    tam = ndimage.sum(np.ones_like(et), et, index=np.arange(1, n + 1))
    main = et == (1 + int(np.argmax(tam)))
    pendientes = [k + 1 for k in np.argsort(-tam) if et[et == k + 1].size and k + 1 != 1 + int(np.argmax(tam))
                  and tam[k] * res * res >= minimo]
    while pendientes:
        dist, idx = ndimage.distance_transform_edt(~main, return_indices=True)
        mejor = None
        for k in pendientes:
            msk = et == k
            dd = np.where(msk, dist, np.inf)
            j = np.unravel_index(np.argmin(dd), dd.shape)
            if mejor is None or dd[j] < mejor[0]:
                mejor = (dd[j], k, j)
        d, k, (iy, ix) = mejor
        if d * res > salto:
            break
        ty, tx = idx[0][iy, ix], idx[1][iy, ix]
        paso = np.zeros(libre.shape, np.uint8)
        cv2.line(paso, (int(ix), int(iy)), (int(tx), int(ty)), 1, 3)
        paso = (paso > 0) & ~columnas
        main |= (et == k) | paso
        pendientes.remove(k)
    return main


def huella_real(m):
    """Contorno del edificio en este piso: unión de los ambientes (no el contorno de la losa de abajo, que en
    los pisos altos viene dibujado alrededor de la torre). Se quedan las partes de 50 m² o más."""
    g = unary_union([a['poligono'].buffer(0.35, join_style=2) for a in m.ambientes]).buffer(-0.2, join_style=2)
    partes = [q for q in lista_polis(g) if q.area >= 50]
    return unary_union([Polygon(q.exterior) for q in partes])


def pasillos(m):
    """Ambientes de circulación por forma: tres puertas o más y 15 m² o más (los pasillos de la torre vienen
    sin rótulo o con el de un ducto que cae adentro)."""
    mids = [Point(*((np.array(p['a']) + np.array(p['b'])) / 2)) for p in m.puertas]
    for a in m.ambientes:
        pg = a['poligono'].buffer(0.4)
        n = sum(1 for q in mids if pg.contains(q))
        a['puertas'] = n
        rr = a['poligono'].minimum_rotated_rectangle
        lados = sorted(math.dist(*c) for c in zip(list(rr.exterior.coords)[:-1], list(rr.exterior.coords)[1:]))
        alargado = lados[0] > 0 and lados[-1] / lados[0] >= 3 and lados[-1] >= 8
        nom = (a['nombre'] or '').upper()
        servicio = any(k in nom for k in ('ACONDICIONADO', 'DUCTO', 'ABASTECIMIENTO', 'TABLERO'))
        if n >= 3 and a['area'] >= 15 and (alargado or a['area'] >= 60) and (not nom or (servicio and a['area'] >= 40)):
            a['nombre'] = 'PASILLO'
        # alargado y con varias puertas: es un espacio de paso aunque tenga nombre (el «Reloj» del subsuelo)
        a['circula'] = n >= 3 and a['area'] >= 15 and alargado
        # recepciones y vestíbulos que reparten a varios cuartos (Banco de Sangre -> Flebotomía): se pueden cruzar
        a['reparte'] = (n >= 3 and a['area'] >= 15 and 'BAÑO' not in nom and 'SS.HH' not in nom) or \
            (('FILTRO' in nom or 'ESCLUSA' in nom) and 'PERSONAL' not in nom)   # esclusa de aislamiento (piso 3)
        # antesalas y pasillos cortos sin rótulo que reparten a dos o más cuartos (oficinas del subsuelo)
        if not nom and n >= 2 and a['area'] >= 4:
            a['reparte'] = True


def puerta_nueva(a, b, doble):
    a, b = np.array(a, float), np.array(b, float)
    d = (b - a) / np.linalg.norm(b - a)
    nrm = np.array([-d[1], d[0]])
    t0, t1 = -0.06, 0.06
    return dict(a=a, b=b, ancho=float(np.linalg.norm(b - a)), doble=doble, tipo='P-IZ', t0=t0, t1=t1, dir=d, nrm=nrm,
                rect=Polygon([tuple(a + nrm * t0), tuple(b + nrm * t0), tuple(b + nrm * t1), tuple(a + nrm * t1)]))


def gradas_extra(m, piso):
    """Escaleras de ESCALERAS_EXTRA: cada par de gradas seguidas (capa P0 - Gradas) es una huella; las alturas suben
    tramo tras tramo (contrahuella: altura del piso / número de gradas + 1)."""
    ox, oy = m.origen
    lineas = []
    for e in m.planos:
        if e[0] == 'P0 - Gradas' and len(e[2]) >= 2:
            lineas.append(LineString([(x / 1000, y / 1000) for x, y in e[2]]))
    m.gradas_extra = []
    for esc in ESCALERAS_EXTRA.get(piso, []):
        tramos = []
        for zona, eje, sentido in esc['tramos']:
            k = 1 if eje == 'y' else 0
            vals = sorted({round(l.coords[0][k], 2) for l in lineas if zona.contains(l)
                           and abs(l.coords[0][k] - l.coords[-1][k]) < 0.01 and l.length > 0.2})
            if sentido < 0:
                vals = vals[::-1]
            x0, y0, x1, y1 = zona.bounds
            pasos = []
            for v0, v1 in zip(vals[:-1], vals[1:]):
                lo, hi = min(v0, v1), max(v0, v1)
                pasos.append(box(x0 + 0.01, lo, x1 - 0.01, hi) if eje == 'y' else box(lo, y0 + 0.01, hi, y1 - 0.01))
            for v in vals:
                m.gradas_extra.append(LineString([(x0, v), (x1, v)]) if eje == 'y' else LineString([(v, y0), (v, y1)]))
            tramos.append(pasos)
        n = sum(len(t) for t in tramos)
        if not n:
            continue
        r = 3.84 / (n + 1)
        T = lambda g: affinity.translate(g, -ox, -oy)
        pasos, descansos, k = [], [], 0
        for i, t in enumerate(tramos):
            for q in t:
                k += 1
                pasos.append((T(q), k * r))
            if i < len(esc['descansos']):
                descansos.append((T(esc['descansos'][i]), k * r))
        m.escaleras = list(getattr(m, 'escaleras', [])) + [dict(pasos=pasos, descansos=descansos)]
        print('escalera agregada', n, 'gradas')
    m.gradas_extra = [affinity.translate(l, -ox, -oy) for l in m.gradas_extra]


def obra(m, piso):
    """Correcciones de muros, ventanas, barandas, puertas, mobiliario y escaleras revisadas con el plano."""
    if getattr(m, '_obra', False):
        return
    ox, oy = m.origen
    T = lambda g: affinity.translate(g, -ox, -oy)
    for g in QUITAR_MUROS.get(piso, []):
        g = T(g)
        m.muros_raw = m.muros_raw.difference(g)
        m.muros = [q for w in m.muros for q in lista_polis(w.difference(g)) if q.area > 0.005]
        m.tabiques = [dict(t, poligono=q) for t in m.tabiques for q in lista_polis(t['poligono'].difference(g))
                      if q.area > 0.005]
    for g in MUROS_EXTRA.get(piso, []):
        g = T(g)
        m.muros_raw = unary_union([m.muros_raw, g])
        m.muros = list(m.muros) + [g]
    for g in VENTANAS_A_MUROS.get(piso, []):
        g = T(g)
        dentro = [v for v in m.ventanas if g.contains(v.centroid)]
        m.ventanas = [v for v in m.ventanas if not g.contains(v.centroid)]
        m.muros_raw = unary_union([m.muros_raw] + dentro)
        m.muros = list(m.muros) + dentro
    for g in QUITAR_VENTANAS.get(piso, []):
        g = T(g)
        m.ventanas = [q for v in m.ventanas for q in lista_polis(v.difference(g)) if q.area > 0.01]
    m.ventanas = list(m.ventanas) + [T(g) for g in VENTANAS_EXTRA.get(piso, [])]
    m.barandas = list(barandas(m)) + [T(g) for g in BARANDAS_EXTRA.get(piso, [])]
    for a, b, doble in PUERTAS_EXTRA.get(piso, []):
        p = puerta_nueva(np.array(a) - (ox, oy), np.array(b) - (ox, oy), doble)
        m.puertas.append(p)
        # el vano corta el muro (cuando el dibujo lo cerró)
        hueco = p['rect'].buffer(0.12, cap_style=2, join_style=2)
        m.muros_raw = m.muros_raw.difference(hueco)
        m.muros = [q for w in m.muros for q in lista_polis(w.difference(hueco)) if q.area > 0.005]
    if piso in ZONA_MESAS:
        z = T(ZONA_MESAS[piso])
        def bloque(g):   # mesa con sus sillas dibujada como un solo bloque (alargado, ~0,7 x 2 m)
            x0, y0, x1, y1 = g.bounds
            return z.contains(g.centroid) and max(x1 - x0, y1 - y0) > 1.7 and min(x1 - x0, y1 - y0) < 2.3 \
                and not (1.4 < x1 - x0 < 1.7)   # los sillones miden 1,6 m
        quitar = lambda g: bloque(g) or (z.contains(g.centroid) and g.area < 0.2 and g.bounds[0] > 58.3 - ox)
        m.muebles = [mu for mu in m.muebles if not (mu['nombre'] in ('Escritorio', 'Panel divisorio') and quitar(mu['poligono']))
                     and not (mu['nombre'] == 'Panel divisorio' and z.contains(mu['poligono'].centroid)
                              and mu['poligono'].bounds[2] > 58.6 - ox)]
        m.escritorios = [e for e in m.escritorios if not quitar(e)]
        for x, y in MESAS[piso]:
            c = Point(x - ox, y - oy)
            m.muebles.append(dict(nombre='Mesa', cat='mueble', altura=0.75, poligono=c.buffer(0.32, 24)))
            for s in (-1, 1):
                cy = c.y + s * 0.72
                m.muebles.append(dict(nombre='Silla', cat='silla', altura=0.46, poligono=box(c.x - 0.22, cy - 0.2, c.x + 0.22, cy + 0.2)))
                ry = cy + s * 0.17
                m.muebles.append(dict(nombre='Respaldo de silla', cat='silla', altura=0.92, z0=0.46,
                                      poligono=box(c.x - 0.22, ry - 0.03, c.x + 0.22, ry + 0.03)))
    for g in MESONES_EXTRA.get(piso, []):
        m.muebles.append(dict(nombre='Mesón', cat='mueble', altura=0.9, poligono=T(g)))
    gradas_extra(m, piso)
    m._obra = True


def rellenar_banos(m):
    """Rendijas sin piso ni muro pegadas a un baño (ductos, encuentros de muros del bloque de baños de la torre): en el
    3D se veían como huecos en la pared. Se rellenan como muro."""
    banos = [a['poligono'] for a in m.ambientes if re.search(r'BAÑO|SS\.? ?HH', (a['nombre'] or '').upper())]
    if not banos:
        return
    amb = unary_union([a['poligono'] for a in m.ambientes])
    env = amb.buffer(1.0, join_style=2).buffer(-1.0, join_style=2)
    duro = unary_union([m.muros_raw] + m.columnas + [t['poligono'] for t in m.tabiques])
    resto = env.difference(amb).difference(duro)
    vanos = unary_union([p['rect'].buffer(0.15) for p in m.puertas])
    B = unary_union(banos).buffer(0.08)
    n = 0
    for q in lista_polis(resto):
        if 0.01 < q.area < 0.9 and q.intersects(B) and not q.intersects(vanos):
            m.muros_raw = unary_union([m.muros_raw, q.buffer(0.01)])
            m.muros = list(m.muros) + [q.buffer(0.01)]
            n += 1
    print('rendijas de baños rellenas', n)


PUERTAS_ARCO = {'PB'}   # pisos donde las puertas dibujadas solo con su arco (sin bloque) también cuentan


def puertas_de_arco(m):
    """Puertas dibujadas con líneas sueltas (arco de 90° y hoja), sin bloque de puerta: se agregan como puertas
    (bisagra en el centro del arco; la hoja cerrada es el extremo que queda entre dos jambas de muro)."""
    import numpy as np
    from shapely.prepared import prep
    ox, oy = m.origen
    muro = prep(unary_union([m.muros_raw] + m.columnas + [t['poligono'] for t in m.tabiques]).buffer(0.03))
    mids = [Point(*((np.array(p['a']) + np.array(p['b'])) / 2)) for p in m.puertas]
    nuevas = []
    for e in m.planos:
        if e[1] != 'ARC' or len(e[2]) < 3:
            continue
        pts = [(x / 1000 - ox, y / 1000 - oy) for x, y in e[2]]
        p0, pm, p1 = pts[0], pts[len(pts) // 2], pts[-1]
        from modelo import circulo
        cx, cy = circulo(p0, pm, p1)
        if cx is None:
            continue
        c = np.array([cx, cy])
        r = math.dist(c, p0)
        if not 0.5 <= r <= 1.3:
            continue
        v0, v1 = np.array(p0) - c, np.array(p1) - c
        ang = math.degrees(math.acos(max(-1, min(1, float(v0 @ v1) / (r * r)))))
        if not 75 <= ang <= 105:
            continue
        mejor = None
        for p in (np.array(p0), np.array(p1)):
            d = (p - c) / r
            sc = muro.contains(Point(*(c - d * 0.2))) + muro.contains(Point(*(p + d * 0.15)))
            if mejor is None or sc > mejor[0]:
                mejor = (sc, p)
        if mejor[0] < 1:
            continue
        b = mejor[1]
        mid = Point(*((c + b) / 2))
        if any(mid.distance(q) < 0.6 for q in mids):
            continue
        mids.append(mid)
        nuevas.append(puerta_nueva(tuple(c), tuple(b), False))
    m.puertas += nuevas
    return len(nuevas)


HUECOS_ROTULADOS = {'PB'}


def huecos_rotulados(m):
    """Espacios del piso que el modelo dejó sin ambiente (pasillos angostos como la circulación técnica, aseos y
    lencerías chicos) pero que en el plano tienen rótulo o código de espacio: se agregan como ambiente."""
    from modelo import unir_nombres
    ox, oy = m.origen
    duro = unary_union([m.muros_raw] + m.columnas + [t['poligono'] for t in m.tabiques])
    ocup = unary_union([a['poligono'].buffer(0.05) for a in m.ambientes])
    libre = m.huella.difference(duro).difference(ocup)
    textos = []
    for c, t, x, y, h, ap in m.textos:
        t = ' '.join(t.split())
        if c == 'ZONAS' or not t or re.fullmatch(r'L\d+|ZONA.*|N = .*|\d+|[sS]', t):
            continue
        textos.append((t, x / 1000 - ox, y / 1000 - oy))
    n = 0
    for q in lista_polis(libre):
        if q.area < 1.0 or min_ancho(q) < 0.6:
            continue
        dentro = [tt for tt in textos if q.contains(Point(tt[1], tt[2]))]
        if not dentro:
            continue
        nombres = [tt for tt in dentro if not re.match(r'^(C\d-|\{)', tt[0])]
        m.ambientes.append(dict(poligono=q, nombre=unir_nombres(nombres), area=q.area, extra=True))
        n += 1
    return n


def juntas(m):
    """Paredes que no llegan a la puerta o a la otra pared (el dibujo deja rendijas): cada extremo del marco de una
    puerta se completa con muro hasta la pared que sigue en su misma línea (si está a menos de 0,6 m), y las
    rendijas de menos de 24 cm entre muros se cierran. Devuelve (rellenos de puertas, rellenos de rendijas)."""
    import numpy as np
    from shapely.geometry import Polygon
    from shapely.prepared import prep
    duro = unary_union(list(m.muros) + list(m.columnas) + [t['poligono'] for t in getattr(m, 'tabiques', [])])
    pd = prep(duro)
    nuevos = []
    for p in m.puertas:
        a, b = np.array(p['a']), np.array(p['b'])
        d, n = p['dir'], p['nrm']
        t0, t1 = p['t0'], p['t1']
        c = (t0 + t1) / 2
        for e, s in ((a, -1), (b, 1)):
            if pd.contains(Point(*(e + d * s * 0.03 + n * c))):
                continue
            for k in np.arange(0.06, 0.62, 0.02):
                if pd.contains(Point(*(e + d * s * k + n * c))):
                    f = e + d * s * (k + 0.02)
                    nuevos.append(Polygon([tuple(e + n * t0), tuple(f + n * t0), tuple(f + n * t1), tuple(e + n * t1)]))
                    break
    # solo el hueco: si el relleno se superpone a la pared, sus caras coinciden con las de ella y en el 3D parpadean
    nuevos = [q for n in nuevos for q in lista_polis(n.difference(duro)) if q.area > 0.002]
    n_p = len(nuevos)
    vanos = unary_union([p['rect'].buffer(0.02, join_style=2) for p in m.puertas] +
                        [v.buffer(0.02, join_style=2) for v in m.ventanas])
    todo = unary_union([duro] + nuevos)
    cerrado = todo.buffer(0.12, join_style=2).buffer(-0.12, join_style=2)
    rendijas = [q for q in lista_polis(cerrado.difference(todo).difference(vanos)) if q.area > 0.003]
    relleno = nuevos + rendijas
    if relleno:
        m.muros = list(m.muros) + relleno
        m.muros_raw = unary_union([m.muros_raw] + relleno)
    return n_p, len(rendijas)


def tragaluces(m):
    """Rectángulos con sus dos diagonales dibujadas (aspa): tragaluces del plano (marco de la web). No cuentan
    los ductos chicos ni los pozos de ascensor (rótulo «ASCENSOR» cerca)."""
    from shapely.strtree import STRtree
    segs = []
    for e in m.planos:
        if e[0] in ('ZONAS', 'EJ') or len(e[2]) < 2 or e[1] in ('ARC', 'CIRCLE'):
            continue
        pts = [(x / 1000, y / 1000) for x, y in e[2]]
        for a, b in zip(pts[:-1], pts[1:]):
            if math.dist(a, b) >= 1.6:
                segs.append(LineString([a, b]))
    asc = [Point(x / 1000, y / 1000) for c, t, x, y, h, ap in m.textos if 'ASCENSOR' in t.upper()]
    arbol = STRtree(segs)
    out = []
    for i, l1 in enumerate(segs):
        for j in arbol.query(l1):
            j = int(j)
            if j <= i:
                continue
            l2 = segs[j]
            x = l1.intersection(l2)
            if x.geom_type != 'Point':
                continue
            t1, t2 = l1.project(x, normalized=True), l2.project(x, normalized=True)
            if abs(t1 - 0.5) > 0.06 or abs(t2 - 0.5) > 0.06 or abs(l1.length - l2.length) > 0.06 * l1.length:
                continue
            q = Polygon([l1.coords[0], l2.coords[0], l1.coords[1], l2.coords[1]]).buffer(0)
            if q.is_empty or q.geom_type != 'Polygon' or q.area < 3.0:
                continue
            r = q.minimum_rotated_rectangle
            c = list(r.exterior.coords)
            if min(math.dist(c[0], c[1]), math.dist(c[1], c[2])) < 1.2 or q.area < 0.95 * r.area:
                continue
            if any(q.buffer(0.6).contains(p) for p in asc):
                continue
            ox_, oy_ = m.origen
            ql = affinity.translate(q, -ox_, -oy_)
            if any(re.search(r'ASCENSOR|ESCALERA|DUCTO', a['nombre'] or '', re.I) and
                   a['poligono'].intersection(ql).area > 0.3 * min(ql.area, a['poligono'].area) for a in m.ambientes):
                continue
            if all(q.symmetric_difference(o).area > 0.2 * q.area for o in out):
                out.append(q)
    return out


def preparar(m, piso):
    """Todo lo que el plano revisado corrige del modelo; lo usan el 2D (exportar) y el 3D (glb_piso)."""
    if getattr(m, '_preparado', False):
        return
    ox, oy = m.origen
    marcos(m)
    sin_guias(m)
    for a in m.ambientes:
        a['nombre'] = limpiar_nombre(a['nombre'])
    habitaciones(m)
    for nombre, g in EXTRA.get(piso, []):
        g = affinity.translate(g, -ox, -oy)
        quedan = []
        for a in m.ambientes:
            if a['poligono'].intersects(g):
                for q in lista_polis(a['poligono'].difference(g)):
                    # sin las rendijas que deja el corte (también las tiras en L alrededor del recorte)
                    if q.area > 0.5 and q.buffer(-0.25).area > max(0.2, 0.25 * q.area):
                        quedan.append(dict(a, poligono=q, area=q.area))
            else:
                quedan.append(a)
        m.ambientes = quedan + [dict(poligono=g, nombre=nombre, area=g.area, extra=True)]
    for x, y in FUSIONAR.get(piso, []):
        p = Point(x - ox, y - oy)
        chico = [a for a in m.ambientes if a['poligono'].contains(p) and a['area'] < 8]
        for c in chico:
            vec = [a for a in m.ambientes if a is not c and a['poligono'].distance(c['poligono']) < 0.15]
            if vec:
                v = max(vec, key=lambda a: a['area'])
                v['poligono'] = unary_union([v['poligono'], c['poligono'].buffer(0.08)]).buffer(-0.04).buffer(0.04)
                v['area'] = v['poligono'].area
                m.ambientes = [a for a in m.ambientes if a is not c]
    for x, y in REPARTE.get(piso, []):
        for a in m.ambientes:
            if a['poligono'].contains(Point(x - ox, y - oy)):
                a['reparte_fijo'] = True
    for z in HUECOS_PASO.get(piso, []):
        z = affinity.translate(z, -ox, -oy)
        # piezas sin nombre del laberinto que ya eran ambientes: también son paso
        for a in m.ambientes:
            if not a['nombre'] and a['poligono'].intersection(z).area > 0.8 * a['poligono'].area:
                a['paso_forzado'] = True
        amb = unary_union([a['poligono'] for a in m.ambientes])
        duro = unary_union([m.muros_raw] + m.columnas + [t['poligono'] for t in m.tabiques])
        for q in lista_polis(z.difference(amb.buffer(0.02)).difference(duro.buffer(0.02))):
            if q.area > 0.5 and not q.buffer(-0.2).is_empty:
                m.ambientes.append(dict(poligono=q, nombre='', area=q.area, extra=True, paso_forzado=True))
    for g in RECORTES.get(piso, []):
        g = affinity.translate(g, -ox, -oy)
        m.ambientes = [dict(a, poligono=q, area=q.area) for a in m.ambientes
                       for q in lista_polis(a['poligono'].difference(g))
                       if q.area > 0.5 and q.buffer(-0.25).area > max(0.2, 0.25 * q.area)]
    if piso in BANOS_HUECO:
        banos_hueco(m)
    # escaleras: ambientes sin nombre (o con la nota del piso) que contienen tramos de gradas
    for a in m.ambientes:
        if a['nombre']:
            continue
        if any(a['poligono'].intersection(unary_union(tr).convex_hull).area > 0.5 for tr in getattr(m, 'tramos', [])):
            a['nombre'] = 'ESCALERA'
    print('barandas', len(barandas(m)))
    # un patio o parqueadero cerrado por el contorno del dibujo, con solo el rótulo de una puerta: es exterior
    m.ambientes = [a for a in m.ambientes if not (re.fullmatch(r'PUERTA \d+|PARQUEADERO.*|TERRAZA.*', (a['nombre'] or '').upper())
                                                  and a['area'] > 150)]
    # espacios que el dibujo cierra pero que en el plano revisado son exterior (marco local)
    for g in EXTERIOR.get(piso, []):
        g = affinity.translate(g, -ox, -oy)
        m.ambientes = [a for a in m.ambientes if a['poligono'].intersection(g).area < 0.5 * a['poligono'].area]
    for z in AREAS_LIBRES.get(piso, []):
        nombre_z, z = z if isinstance(z, tuple) else ('', z)
        z = affinity.translate(z, -ox, -oy)
        # los espacios enormes que el dibujo dejó abiertos (el hall que se cuela por el pasillo) ceden la zona
        m.ambientes = [dict(a, poligono=q, area=q.area, nombre=a['nombre'] if q.area > 300 else '')
                       if a['area'] > 300 else a for a in m.ambientes
                       for q in (lista_polis(a['poligono'].difference(z)) if a['area'] > 300 else [a['poligono']])
                       if q.area > 0.5]
        ocup = unary_union([a['poligono'].buffer(0.05) for a in m.ambientes] + [m.muros_raw] + m.columnas)
        for q in lista_polis(z.difference(ocup)):
            if q.area > 5:
                m.ambientes.append(dict(poligono=q, nombre=nombre_z, area=q.area, extra=True))
    if piso in HUECOS_ROTULADOS:
        print('huecos con rótulo', huecos_rotulados(m))
    # tragaluces: rectángulos con aspa en el plano (patios de luz): sin piso, sin paso y sin las diagonales como muro
    m.tragaluces = [affinity.translate(t, -ox, -oy) for t in tragaluces(m)]
    for t in m.tragaluces:
        m.ambientes = [dict(a, poligono=q, area=q.area) for a in m.ambientes
                       for q in (lista_polis(a['poligono'].difference(t)) if a['poligono'].intersection(t).area
                                 < 0.5 * a['poligono'].area else [])
                       if q.area > 0.5]
        dentro = t.buffer(-0.12, join_style=2)
        m.muros_raw = m.muros_raw.difference(dentro)
        m.muros = [q for w in m.muros for q in lista_polis(w.difference(dentro)) if q.area > 0.005]
        m.tabiques = [dict(tb, poligono=q) for tb in m.tabiques for q in lista_polis(tb['poligono'].difference(dentro))
                      if q.area > 0.005]
        m.muebles = [mu for mu in m.muebles if not dentro.contains(mu['poligono'].centroid)]
    print('tragaluces', len(m.tragaluces), [tuple(round(v, 1) for v in affinity.translate(t, ox, oy).bounds)
                                             for t in m.tragaluces])
    hu = huella_real(m)
    m.ambientes = [a for a in m.ambientes if a['poligono'].intersection(hu).area > 0.5 * a['poligono'].area]
    obra(m, piso)
    if piso in PUERTAS_ARCO:
        print('puertas de arco', puertas_de_arco(m))
    print('juntas (puertas, rendijas)', juntas(m))
    # «ambientes» que son el interior de un muro grueso (búnkeres): fuera
    duro = unary_union([m.muros_raw] + m.columnas)
    m.ambientes = [a for a in m.ambientes if a['poligono'].intersection(duro).area < 0.6 * a['poligono'].area]
    if piso in BANOS_HUECO and piso != 'SB':
        rellenar_banos(m)
    m._preparado = True


def exportar(m, piso, salida):
    ox, oy = m.origen
    preparar(m, piso)
    hu = huella_real(m)
    pasillos(m)
    amb = []
    for i, a in enumerate(sorted(m.ambientes, key=lambda a: -a['area'])):
        pg = a['poligono']
        try:
            lbl = polylabel(pg, tolerance=0.05)
        except Exception:
            lbl = pg.representative_point()
        p = ED.poli(pg, 0.04)
        amb.append(dict(id=f'a{i}', nombre=ED.nombre_bonito(a['nombre']) if a['nombre'] else '',
                        original=a['nombre'] or '', cat=ED.categoria_web(a['nombre']) if a['nombre'] else 'otro',
                        icono=ED.icono(a['nombre']), area=r2(a['area']), pg=p[0] if p else [],
                        lbl=[r2(lbl.x), r2(lbl.y)]))
        if a.get('reparte') or a.get('reparte_fijo') or a.get('circula') or a.get('paso_forzado'):
            amb[-1]['paso'] = True
        if a.get('paso_forzado'):
            amb[-1]['cat'] = 'circulacion'
    duro = unary_union([m.muros_raw] + m.columnas + [t['poligono'] for t in m.tabiques] +
                       list(getattr(m, 'parapetos', [])) + list(getattr(m, 'foso', [])) +
                       [affinity.translate(g, -ox, -oy) for g in MUROS_EXTRA.get(piso, [])])
    vent = unary_union(m.ventanas + list(getattr(m, 'vidrios', [])) + list(getattr(m, 'ventanillas', [])))
    puertas = unary_union([p['rect'] for p in m.puertas]) if m.puertas else Polygon()
    muros = duro.difference(vent.buffer(0.005)).difference(puertas.buffer(0.01)).intersection(hu.buffer(0.6))
    vent = vent.intersection(hu.buffer(0.6))
    trazos_p, trazos_s = [], []
    for b in m.bloques:
        n = b['nombre']
        if 'COL' in n or n.startswith('FD') or n.startswith('Ventanilla') or n.startswith('-EJ') or n.startswith('-NIVEL'):
            continue
        es_p = n.startswith(('P-IZ', 'P-DE', '_U41', '_U42', '_U43', '_U44', '_U45', '-MP', 'P-DUC', '-PDE'))
        for g in b['geo']:
            pts = m.Lp(g[1])
            if len(pts) < 2:
                continue
            if g[2] and len(pts) >= 3:
                pts = pts + [pts[0]]
            ls = LineString(pts).simplify(0.01)
            if ls.length < 0.05 or not hu.buffer(1).intersects(ls):
                continue
            (trazos_p if es_p else trazos_s).append(ED.anillo(ls.coords))
    muebles = []
    for mu in m.muebles:
        if mu['nombre'].startswith('Respaldo') or mu['nombre'] == 'Manija' or not hu.intersects(mu['poligono']):
            continue
        for q in ED.poli(mu['poligono'], 0.01):
            muebles.append(dict(t=mu['cat'] if mu['cat'] in ('sanitario', 'silla', 'camilla') else 'mueble', pg=q))
    for e in m.escritorios:
        if not hu.intersects(e):
            continue
        for q in ED.poli(e, 0.01):
            muebles.append(dict(t='mueble', pg=q))
    gradas = [ED.anillo(l.coords) for tr in getattr(m, 'tramos', []) for l in tr if hu.buffer(1).intersects(l)]
    gradas += [ED.anillo(l.coords) for l in getattr(m, 'gradas_extra', [])]

    # entradas desde la calle: solo en los pisos con puertas al exterior (subsuelo y planta baja)
    ent = []
    if piso in ('SB', 'PB'):
        textos = [(t, *m.L((x, y))) for c, t, x, y, h, ap in m.textos if t.strip().upper().startswith('PUERTA')]
        borde = hu.boundary
        cand = []
        for p in m.puertas:
            mid = (np.array(p['a']) + np.array(p['b'])) / 2
            if borde.distance(Point(*mid)) < 0.6 and p['ancho'] >= 0.85:
                nom = None
                for t, x, y in textos:
                    if math.dist((x, y), mid) < 6:
                        nom = ' '.join(t.split()).title()
                nrm = p['nrm']
                dentro = mid + nrm * 0.7 if hu.contains(Point(*(mid + nrm * 0.7))) else mid - nrm * 0.7
                fuera = mid - (dentro - mid) * 2.5
                cand.append(dict(nombre=nom, x=r2(dentro[0]), y=r2(dentro[1]), fx=r2(fuera[0]), fy=r2(fuera[1]),
                                 ancho=r2(p['ancho'])))
        for e in sorted(cand, key=lambda e: (e['nombre'] is None, -e['ancho'])):
            if all(math.dist((e['x'], e['y']), (o['x'], o['y'])) > 4 for o in ent):
                ent.append(e)
        k = 0
        for e in ent:
            if not e['nombre']:
                k += 1
                e['nombre'] = f'Acceso {piso} {k}'
        ent.sort(key=lambda e: e['nombre'])
        for e in ent:
            e['id'] = 'entrada-' + piso.lower() + '-' + e['nombre'].lower().replace(' ', '-')

    # ------------------------------------------------ rejilla de navegación (0,25 m)
    RES = 0.25
    x0, y0, x1, y1 = hu.bounds
    x0, y0 = math.floor(x0) - 2, math.floor(y0) - 2
    if piso == 'PB':
        # en el marco de la web la rejilla cae sobre la de la planta baja vieja (múltiplos de 0,25 m): unir_pb la
        # copia celda por celda, sin remuestrear
        x0 = math.floor((x0 + ox) / RES) * RES - ox
        y0 = math.floor((y0 + oy) / RES) * RES - oy
    W, H = int((x1 - x0 + 4) / RES) + 1, int((y1 - y0 + 4) / RES) + 1

    def ras(geoms, dil=0.0):
        img = np.zeros((H, W), np.uint8)
        for g in geoms:
            for q in lista_polis(g.buffer(dil, join_style=2) if dil else g):
                cv2.fillPoly(img, [np.array([[(x - x0) / RES, (y - y0) / RES] for x, y in q.exterior.coords], np.int32)], 1)
                for h_ in q.interiors:
                    cv2.fillPoly(img, [np.array([[(x - x0) / RES, (y - y0) / RES] for x, y in h_.coords], np.int32)], 0)
        return img > 0
    interior = ras([a['poligono'] for a in m.ambientes])
    obst = ras([duro, vent] + list(m.barandas) + [mu['poligono'] for mu in m.muebles if mu['nombre'] not in ('Tope de puerta',)] +
               list(m.escritorios))
    libre = interior & ~ndimage.binary_dilation(obst, iterations=1)
    vanos = []
    for p in m.puertas:
        a, b = np.array(p['a']), np.array(p['b'])
        d, n = p['dir'], p['nrm']
        vanos.append(Polygon([tuple(a + d * 0.12 - n * 0.6), tuple(b - d * 0.12 - n * 0.6), tuple(b - d * 0.12 + n * 0.6),
                              tuple(a + d * 0.12 + n * 0.6)]))
    if vanos:
        libre |= ras(vanos) & ~ras([unary_union(m.columnas)])
    for e in ent:
        libre |= ras([LineString([(e['x'], e['y']), (e['fx'], e['fy'])]).buffer(0.6)])
    forzados = [affinity.translate(g, -ox, -oy) for g in PASOS_LIBRES.get(piso, [])]
    if forzados:
        libre |= ras([g.buffer(0.7) for g in forzados])
    cols_r = ras([unary_union(m.columnas)]) if m.columnas else np.zeros_like(libre)
    if piso == 'PB' and ent:
        # alas que solo se comunican por afuera (clínica de heridas, morgue): la vereda las une al resto
        hu_r = ras(list(hu.geoms) if hasattr(hu, 'geoms') else [hu])
        ver = ndimage.binary_dilation(hu_r, iterations=int(round(1.5 / RES))) & ~hu_r
        libre = unir_partes(libre | ver, RES, cols_r) & (libre | ~ver)
    else:
        libre = unir_partes(libre, RES, cols_r)
    dist = ndimage.distance_transform_edt(libre) * RES
    costo = np.clip(np.round((0.9 - np.minimum(dist, 0.9)) / 0.9 * 6), 0, 6).astype(np.uint8)
    celdas = np.where(libre, costo + 1, 0).astype(np.uint8)
    for a, src in zip(amb, sorted(m.ambientes, key=lambda a: -a['area'])):
        pg = src['poligono']
        msk = ras([pg.buffer(-0.05)]) & libre
        if not msk.any():
            msk = ras([pg.buffer(0.6)]) & libre
        if msk.any():
            fy, fx = np.indices(dist.shape)
            lx, ly = (a['lbl'][0] - x0) / RES, (a['lbl'][1] - y0) / RES
            score = np.where(msk, np.minimum(dist, 0.8) * 4 - np.hypot(fx - lx, fy - ly) * RES * 0.15, -1e9)
            iy, ix = np.unravel_index(np.argmax(score), score.shape)
            a['dest'] = [r2(x0 + ix * RES), r2(y0 + iy * RES)]
        else:
            a['dest'] = None
    cuarto = np.zeros((H, W), np.uint16 if len(m.ambientes) > 255 else np.uint8)
    ordenados = sorted(m.ambientes, key=lambda a: -a['area'])
    for k in sorted(range(len(ordenados)), key=lambda k: -ordenados[k]['area']):
        cuarto[ras([ordenados[k]['poligono'].buffer(0.15)])] = k + 1
    # red de pacientes: eje (esqueleto) de los espacios de circulación, para que las rutas vayan por el centro
    circ = np.zeros((H, W), bool)
    for k, a in enumerate(ordenados):
        if es_circulacion(a['nombre'], a['area']) or a.get('circula'):
            circ |= cuarto == k + 1
    circ |= (cuarto == 0) & libre
    circ &= libre
    from skimage.morphology import skeletonize
    eje = skeletonize(circ & (dist >= 0.5))
    red = ndimage.binary_dilation(eje, iterations=1) & libre
    # puertas de los cuartos públicos hacia la circulación también forman parte de la red (vano de cada puerta)
    if vanos:   # el vano de las puertas entre dos espacios de circulación
        red |= ras(vanos) & circ
    if forzados:
        red |= ras([g.buffer(0.3) for g in forzados]) & libre
    red = red.astype(np.uint8)
    huella_m = ras(list(hu.geoms) if hasattr(hu, 'geoms') else [hu])
    if ent:
        vereda = ndimage.binary_dilation(huella_m, iterations=int(round(1.5 / RES))) & ~huella_m
        celdas[vereda & (celdas == 0)] = 2
    else:
        vereda = np.zeros_like(huella_m)
    print(piso, 'red', int(red.sum()), 'celdas libres', int((celdas > 0).sum()))
    nav = dict(x0=x0, y0=y0, res=RES, w=W, h=H, celdas=base64.b64encode(celdas.tobytes()).decode(),
               cuarto=base64.b64encode(cuarto.astype('<u2' if cuarto.dtype == np.uint16 else np.uint8).tobytes()).decode(),
               red=base64.b64encode(red.tobytes()).decode(),
               vereda=base64.b64encode(vereda.astype(np.uint8).tobytes()).decode())
    if cuarto.dtype == np.uint16:
        nav['cuartoBits'] = 16
    datos = dict(
        nombre=f'Hospital SOLCA Quito · {NOMBRES_PISO[piso]}',
        fuente='Planos actualizados HOSPITAL SOLCA QUITO 2025 (DWG del edificio)',
        geo=ED.GEO, altura=3.84,
        huella=ED.poli(hu, 0.05), ambientes=amb, muros=ED.poli(muros, 0.015), ventanas=ED.poli(vent, 0.015),
        barandas=ED.poli(unary_union(m.barandas), 0.015) if m.barandas else [],
        puertas=[dict(a=[r2(v) for v in p['a']], b=[r2(v) for v in p['b']], c=round(float((p['t0'] + p['t1']) / 2), 3),
                      doble=bool(p['doble']), ducto=p['tipo'].startswith('P-DUC')) for p in m.puertas
                 # puertas sueltas lejos del edificio (en el piso 2, una 50 m al este)
                 if hu.buffer(2).contains(Point(*((np.array(p['a']) + np.array(p['b'])) / 2)))],
        trazos_puertas=trazos_p, trazos=trazos_s, muebles=muebles, gradas=gradas,
        viseras=[], entradas=ent, nav=nav, parqueos=[], poi=[],
    )
    trasladar(datos, ox, oy)
    os.makedirs(os.path.dirname(salida), exist_ok=True)
    with open(salida, 'w') as f:
        json.dump(datos, f, ensure_ascii=False, separators=(',', ':'))
    print('datos', salida, round(os.path.getsize(salida) / 1e6, 2), 'MB', len(amb), 'ambientes', len(ent), 'entradas',
          'rejilla', W, 'x', H)
    return datos


def trasladar(d, ox, oy):
    """Del marco del modelo (lienzo) al marco de la planta baja."""
    def par(p):
        return [r2(p[0] + ox), r2(p[1] + oy)]

    def anillos(pg):            # [[x,y],...] o [[[x,y],...],...] o más profundo
        if pg and isinstance(pg[0], (int, float)):
            return par(pg)
        return [anillos(q) for q in pg]
    d['huella'] = anillos(d['huella'])
    for a in d['ambientes']:
        a['pg'] = anillos(a['pg'])
        a['lbl'] = par(a['lbl'])
        if a.get('dest'):
            a['dest'] = par(a['dest'])
    for k in ('muros', 'ventanas', 'barandas', 'trazos_puertas', 'trazos', 'gradas'):
        d[k] = anillos(d[k])
    for p in d['puertas']:
        p['a'], p['b'] = par(p['a']), par(p['b'])
    for mu in d['muebles']:
        mu['pg'] = anillos(mu['pg'])
    for e in d['entradas']:
        e['x'], e['y'] = r2(e['x'] + ox), r2(e['y'] + oy)
        e['fx'], e['fy'] = r2(e['fx'] + ox), r2(e['fy'] + oy)
    d['nav']['x0'] = round(d['nav']['x0'] + ox, 3)
    d['nav']['y0'] = round(d['nav']['y0'] + oy, 3)


if __name__ == '__main__':
    piso = sys.argv[1]
    import __main__
    import modelo_piso
    __main__.ModeloPiso = modelo_piso.ModeloPiso   # modelos guardados al correr modelo_piso.py como script
    m = pickle.load(open(sys.argv[2] if len(sys.argv) > 2 else f'/tmp/modelo_{piso}.pkl', 'rb'))
    exportar(m, piso, os.path.join(RAIZ, 'public', piso.lower(), 'datos.json'))

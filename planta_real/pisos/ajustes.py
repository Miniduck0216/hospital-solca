"""
Ajustes por piso que el dibujo no resuelve solo. Se escriben en public/<piso>/config.json → «ajustes»
(ver compilarConfig en src/pb/datos.js), con el id del ambiente y su nombre como control: si al volver a
importar el plano el id ya no tiene ese nombre, el ajuste no se aplica.
- ventanilla: se atiende por una ventanilla hacia la circulación (Información, Recepción): la ruta llega al
  frente y no entra.
- personal: cuartos internos de un servicio (oficinas detrás de cocina, baños del laboratorio...).
- cat: categoría corregida (los baños rotulados «Mujeres»).
Uso: python3 planta_real/pisos/ajustes.py   (después de exportar_piso.py, unir_pb.py y conectores.py)
"""
import json
import re
import math
import os
from shapely.geometry import Polygon
from shapely.ops import nearest_points

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))

# (nombre, punto aproximado del rótulo, ajuste)
AJUSTES = {
    'SB': [
        # nombres del plano: un espacio con varios rótulos los lleva juntos; las zonas de servicio que el dibujo junta
        # en un solo espacio llevan el nombre de la zona
        ('Dietas · Estacion Carros Thermo', (0, 0), {'nombre': 'Alimentación y Dietética'}),
        ('Reloj', (0, 0), {'nombre': 'Despacho'}),
        ('Vestidor', (93.26, -24.66), {'nombre': 'Mantenimiento'}),
        ('Registro Nacional Tumores', (0, 0), {'nombre': 'Estadística · Registro Nacional Tumores'}),
        ('Despacho', (99.6, 15.13), {'nombre': 'Bodega Central'}),
        ('Despacho', (125.91, 43.15), {'nombre': 'Depósito Ropa Limpia'}),
        ('Aula 1', (0, 0), {'nombre': 'Aula 1 · Aula 2'}),
        ('Nuclear', (0, 0), {'nombre': 'Medicina Nuclear'}),
        ('Comando', (150.92, 52.97), {'nombre': 'Comando · Simulador'}),
        ('Talento', (0, 0), {'nombre': 'Talento Humano'}),   # si el dibujo no lo nombra solo
        ('Pasillo', (70.79, 17.85), {'nombre': 'Talento Humano'}),   # el rótulo del plano está en esta área abierta
        ('Comedor', (77.49, 36.89), {'nombre': 'Comedor Especial'}),
        ('Cafetería', (92.38, 36.69), {'nombre': 'Comedor Personal'}),
        ('Bodega · Control 2', (0, 0), {'nombre': 'Radioterapia'}),
        ('Abastecim. · Costura', (0, 0), {'nombre': 'Lavandería', 'personal': True}),
        ('Area Equipos', (113.72, 38.05), {'nombre': 'Esterilización', 'personal': True}),
        # antesala de las salas de Inserciones (se entra por ella desde el pasillo de radioterapia)
        ('Comando · Lavabo Quirurgico', (0, 0), {'personal': False, 'cat': 'circulacion'}),
        # baños dentro de los vestidores de la unidad de inserciones
        ('Baño', (161.15, 53.83), 'personal'), ('Baño', (160.92, 54.99), 'personal'),
        ('Información', (133.2, 38.6), 'ventanilla'),
        ('Recepcion', (104.5, 29.0), 'ventanilla'),
        # baño de mujeres: el cuarto de inodoros se llega por la antesala (también rotulada «Mujeres»)
        ('Mujeres', (0, 0), {'cat': 'banos'}),
        ('Mujeres', (97.9, 51.3), 'por-antesala'),
        ('Oficina Nutricionista', (78.2, 29.0), 'personal'),
        ('Oficina Economo', (88.2, 5.9), 'personal'),
        ('Oficina', (104.5, 36.4), 'personal'),
        ('Aire Acondic.', (78.5, 3.5), 'personal'),
        ('SS.HH.', (117.4, 26.7), 'personal'),
        ('SS.HH.', (120.3, 26.7), 'personal'),
    ],
    'PB': [
        ('Vestíbulo de Ductos', (78.8, 46.0), 'personal'),
        ('Punciones', (95.2, 89.9), 'personal'),
        ('Seleccion Donantes', (105.7, 99.5), 'personal'),
        ('Baño', (129.6, 102.4), 'personal'),
        ('Baños', (97.5, 99.5), 'personal'),
        # dirección y farmacia rehechas con el DWG 2025 (unir_pb.REHACER): cuartos internos del personal
        ('Gerencia Proyectos', (55.95, 16.6), 'personal'),   # se entra por Gerencia Comercial
        ('Oficina', (72.0, 14.6), 'personal'),               # dentro del Financiero
        ('Sala Reuniones', (63.2, 70.0), 'personal'),        # farmacia: cuartos internos
        ('Quimioterápicos', (65.9, 71.3), 'personal'),
        ('Nutrición Parental', (68.2, 69.6), 'personal'),
        ('S.H. M.', (60.54, 24.97), {'publico': True}),       # se entra desde el pasillo de administración
        # bloque del hall de ascensores (planta vieja sin rótulos): nombres del plano
        ('', (59.4, 57.88), {'nombre': 'Oficina', 'personal': True}),
        ('', (59.33, 54.67), {'nombre': 'Central Telefónica', 'personal': True}),
        ('', (62.2, 56.5), {'nombre': 'Datacenter', 'personal': True}),
        ('', (66.72, 56.37), {'nombre': 'Administración', 'personal': True}),
        ('', (71.52, 58.13), {'nombre': 'Cuarto Frío', 'personal': True}),
        ('', (75.58, 58.02), {'nombre': 'Almacenamiento', 'personal': True}),
        ('', (73.49, 55.8), {'nombre': 'Cuarto UPS', 'personal': True}),
        ('', (66.45, 49.29), {'nombre': 'Tragaluz', 'personal': True}),
        ('Oficina', (101.6, 31.55), 'personal'),       # se entra por la secretaría (histología / genética)
        # nombres como en el plano (un espacio con varios rótulos los lleva juntos)
        ('Hab. 02 · Hab. 03', (124.45, 78.58), {'nombre': 'U.C.I.'}),          # habitaciones abiertas: ver LUGARES
        ('Módulo 07 · Apoyo', (100.23, 35.66), {'nombre': 'Quimioterapia · Estación · Apoyo', 'cat': 'otro'}),
        ('Laboratorio · Módulo 01', (95.55, 23.26), {'nombre': 'Histología · Laboratorio', 'cat': 'apoyo'}),
        ('Laboratorio · Coagulacion', (100.77, 3.39), {'nombre': 'Laboratorio Clínico'}),   # secciones: LUGARES
        ('', (145.12, 38.49), {'nombre': 'Estación Enfermería', 'cat': 'circulacion'}),   # se cruza a las habitaciones
        ('Hombres · Vestidor', (118.71, 70.89), {'nombre': 'Vestidor Hombres'}),
        ('Quirofano', (138.22, 62.65), {'nombre': 'Quirófano 04'}),
        ('Quirofano', (138.22, 56.19), {'nombre': 'Quirófano 03'}),
        ('Quirofano', (138.22, 43.45), {'nombre': 'Quirófano 01'}),
        ('Elect. Módulo 01 · Elect. Módulo 02', (110.77, 90.59), {'nombre': 'Masoterapia · Elect. 01 · Elect. 02'}),
        ('', (116.4, 94.76), {'nombre': 'Acceso Familiares', 'cat': 'circulacion'}),
        ('Apoyo', (100.35, 52.29), {'nombre': 'Gastroenterología'}),          # salas 01 y 03, recuperación…: LUGARES
        ('Lenc.', (103.6, 55.6), 'personal'), ('U.U.', (105.4, 55.6), 'personal'),
        ('Toma de Muestras · Módulo 01', (86.8, 90.23), {'nombre': 'Toma de Muestras 01', 'cat': 'otro'}),
        ('Módulo 02 · Toma de Muestras', (86.82, 94.92), {'nombre': 'Toma de Muestras 02', 'cat': 'otro'}),
        ('Módulo 03 · Toma de Muestras', (86.82, 98.08), {'nombre': 'Toma de Muestras 03', 'cat': 'otro'}),
        ('Módulo 04 · Toma de Muestras', (86.82, 101.22), {'nombre': 'Toma de Muestras 04', 'cat': 'otro'}),
        ('Módulo 05 · Toma de Muestras', (86.82, 104.38), {'nombre': 'Toma de Muestras 05', 'cat': 'otro'}),
        # U.C.I.: cuartos de servicio junto a las centrales de gases; el pasillo que los une con la puerta 6
        ('Lavachatas', (144.7, 84.3), 'personal'), ('Utileria Sucia', (144.7, 81.5), {'nombre': 'Utilería Sucia', 'personal': True}),
        ('Cafeteria', (143.3, 77.3), {'nombre': 'Cafetería', 'personal': True}),
        ('Secretaría', (88.6, 107.4), {'nombre': 'Pasillo', 'cat': 'circulacion'}),   # toma de muestras (C1-L1-085)
        ('Secretaría', (91.28, 93.13), 'ventanilla'),   # se atiende sobre el mostrador del pasillo
        ('', (112.5, 96.5), {'nombre': 'SS.HH.', 'cat': 'banos'}), ('', (112.5, 93.5), {'nombre': 'SS.HH.', 'cat': 'banos'}),
        ('', (147.75, 35.3), 'personal'),
        ('', (120.0, 26.6), {'cat': 'circulacion'}),   # antesala del biobanco (laboratorio de genética)   # cuarto C3-L1-03 (medicina nuclear), sin puerta en el plano
        ('Lavachatas · Utileria Sucia', (141.6, 82.0), {'nombre': 'Pasillo', 'cat': 'circulacion'}),
        # laboratorio: utilerías de la toma de muestras y el apoyo de microbiología
        ('U. Usada', (103.6, 17.0), 'personal'), ('U. Limpia', (103.6, 15.6), 'personal'),
        ('', (105.0, 6.5), {'nombre': 'Apoyo', 'personal': True}),
        # vestíbulo de los ascensores de quimioterapia y el paso entre quimioterapia y U.U.
        ('', (86.9, 41.9), {'cat': 'circulacion'}), ('', (92.5, 38.7), {'cat': 'circulacion'}),
        # rótulos del plano que el dibujo deja en cuartos sin nombre o con otro nombre
        ('', (78.3, 4.5), {'nombre': 'Oficina'}),                          # junto a Secretaría Información
        ('', (100.4, 22.8), {'nombre': 'Archivo', 'personal': True}),        # histología
        ('', (123.1, 42.3), {'nombre': 'Recepción Limpia', 'personal': True}),   # esterilización
        ('', (106.2, 80.6), {'nombre': 'Vestidor'}), ('', (110.9, 80.6), {'nombre': 'Vestidor'}),   # de los S.H. de imagen
        ('Recepcion', (98.8, 90.5), {'nombre': 'Recepción · Banco de Sangre'}),
        ('Pasillo', (93.7, 69.6), {'nombre': 'Imagen', 'cat': 'circulacion'}),            # el pasillo lleva el rótulo de la zona
        ('Pasillo', (123.8, 60.6), {'nombre': 'Circulación Gris', 'cat': 'circulacion'}),  # centro quirúrgico
        ('', (150.59, 63.4), {'nombre': 'Hospitalización de Medicina Nuclear', 'cat': 'circulacion'}),   # el área abierta
        ('Microbiología Bacteriologia', (109.1, 3.4), {'nombre': 'Microbiología · Bacteriología · Micología'}),
        ('Toma Muestras', (106.2, 22.7), {'nombre': 'Toma Muestras · Cultivos'}),          # laboratorio de genética
        ('Espera · Secretaría', (89.2, 59.9), {'nombre': 'Espera · Secretaría · Información'}),
        ('U. Limpia', (133.1, 65.1), 'personal'),                           # centro quirúrgico
        ('Estacion', (129.64, 66.92), 'personal'),                          # estación de recuperación
        ('Clinica de Heridas', (155.38, 107.87), {'cat': 'espera'}),   # sala de entrada de la clínica: se cruza
        ('Hab. 1', (169.12, 89.33), {'nombre': 'Hab. 1 – 6', 'cat': 'circulacion'}),   # clínica de heridas: el pasillo
        # y sus habitaciones abiertas (cada una en LUGARES)
        ('Mamografia 2 · V', (86.29, 83.62), {'nombre': 'Mamografía 2'}),
        ('Sala · Rauniones', (85.37, 17.05), {'nombre': 'Sala Rauniones'}),   # así está en el plano
        # cuartos internos del laboratorio (se entra por Preparación) y de la clínica de heridas
        ('Coordinación', (110.15, 15.47), 'personal'), ('Tuberculosis', (111.6, 10.69), 'personal'),
        ('Baño', (110.75, 17.05), 'personal'), ('Medicos', (159.97, 104.17), 'personal'),
        # pasillo junto a la fachada de la clínica de heridas (entre la sala de entrada y las habitaciones)
        ('', (163.2, 103.3), {'cat': 'circulacion'}), ('', (166.2, 100.0), {'cat': 'circulacion'}),
        ('', (168.8, 97.0), {'cat': 'circulacion'}),
        ('', (157.6, 99.3), {'cat': 'circulacion'}),   # vestíbulo central de la clínica (entre la entrada y la sala)
        ('', (108.6, 81.8), {'cat': 'circulacion'}),   # imagen: vestíbulo de los S.H.
        # medicina física: el pasillo entre masoterapia y mecanoterapia lleva el rótulo de la zona
        ('Aseo', (108.04, 100.28), {'nombre': 'Medicina Física', 'cat': 'circulacion', 'personal': False}),
    ],
    # bloque administrativo norte (hall interno, TICs, jefatura, sala de reuniones): no es de pacientes
    'P1': [('Hall Interno', (80.7, 32.8), {'nombre': 'Recepción · Hall Interno · TICs', 'personal': True}),   # un espacio, tres rótulos
           ('U.l', (0, 0), {'nombre': 'U.L'}),   # así está en el plano
           ('Baño', (79.48, 39.78), 'personal'),
           ('Terraza', (17.25, 77.9), 'personal'),   # se entra por Almacén
           ('Preparación Médica', (73.5, 70.5), 'personal'),   # baño del hall interno (el otro sale solo por la regla)
           # el segundo baño chico del bloque central de la torre se abre al pasillo (el dibujo deja su puerta dentro del muro)
           ('Baño', (74.21, 99.38), {'publico': True}),

           ('Jefatura', (79.0, 25.6), 'personal'),
           # escalera de emergencia del extremo oeste (rotulada «b» en el plano)
           ('B', (0.7, 92.0), {'nombre': 'Escalera de emergencia', 'cat': 'escaleras'}),
           # la habitación 17 se abre a la terraza sin puerta dibujada: queda un solo ambiente
           ('Hab. 17 · Terraza N + 3.95', (0, 0), {'nombre': 'Hab. 17'}),
           # «Sala Rauniones» (torre) y «Sala Reuniones» (bloque administrativo): como en el plano, para diferenciarlas
           ('Sala Reuniones', (82.5, 25.6), 'personal'),
           # el gran espacio de circulación (pasillos, recepción, hall de la torre) es «HALL» en el plano; la sala de espera
           # es solo la del ala oeste (lugar)
           ('Sala de Espera · Hall', (0, 0), {'nombre': 'Hall'}),
           # baños públicos junto a la escalera del ala oeste (en el PDF, con los íconos de hombre y mujer)
           ('', (47.0, 90.8), {'nombre': 'Baño Hombres', 'cat': 'banos', 'personal': False}),
           ('', (50.3, 90.7), {'nombre': 'Baño Mujeres', 'cat': 'banos', 'personal': False}),
           # franja junto a la fachada norte, frente a la residencia: es paso (se abre al hall)
           ('', (26.9, 98.84), {'cat': 'circulacion'}),
           # baños de los dormitorios de residentes (se entra por su vestíbulo): son del personal
           ('SS.HH.', (78.36, 61.69), 'personal'), ('SS.HH.', (78.38, 63.03), 'personal')],
    'P2': [('', (78.36, 61.7), 'personal'), ('SS.HH.', (78.38, 63.04), 'personal'),   # baños de los residentes
           # cuartos que el dibujo deja sin rótulo: el nombre es el texto del plano
           ('', (65.82, 47.0), {'nombre': 'Quimioterapia Ambulatoria'}),
           ('', (66.4, 93.2), {'nombre': 'Hab 221'}),
           ('', (66.4, 77.3), {'nombre': 'Hab 211'}),
           ('', (73.5, 83.8), {'nombre': 'Examen Tratamiento'}),   # se entra por dos puertas, una de cada pasillo
           ('', (82.3, 61.9), {'nombre': 'Dormitorio Residente', 'personal': True}),
           ('Preparación Médica', (73.5, 70.5), 'personal'),
           # Usados y Camillas son un solo espacio (el plano tiene los dos rótulos)
           ('Usados', (82.6, 48.0), {'nombre': 'Usados · Camillas'})],
    'P3': [('SS.HH.', (78.36, 61.7), 'personal'), ('SS.HH.', (78.38, 63.04), 'personal'),   # baños de los residentes
           # un solo espacio con los dos rótulos del plano
           ('Usados', (82.6, 48.0), {'nombre': 'Usados · Camillas'}),
           ('Oficina', (73.48, 83.96), {'nombre': 'Oficina · Jefatura'}),
           ('Apoyo', (73.49, 66.67), 'personal')],
}


# lugares sin cuarto propio (puntos con nombre): mostradores y zonas dentro de un hall, cuartos que el dibujo no cierra
# pasos abiertos (puertas que el dibujo no tiene): [punto, punto] a través del muro
PASOS = {
    'PB': [[[139.95, 91.3], [139.95, 92.5]],     # emergencia: vestíbulo del baño (la rejilla lo deja cerrado en la esquina)
           [[163.4, 102.8], [165.1, 101.0]],     # clínica de heridas: puerta del pasillo junto a la fachada (frente a Triaje)
           [[146.5, 37.0], [146.5, 35.5]]],      # comedor de medicina nuclear: entrada desde la estación (vano de 0,6 m)
    'P1': [[[28.95, 83.6], [29.85, 83.6]]],   # puerta del baño de hombres del bloque de servicio
    'P3': [[[74.3, 87.33], [75.5, 87.33]]],      # vano entre el filtro de pacientes y los baños de Trasplantes
}

LUGARES = {
    # subsuelo, zonas de servicio: las secciones de cada una (sin muros entre ellas en el plano), solo del personal
    'SB': [
        *[(f'L-sb-cocina-{k}', n, 'apoyo', p, True) for k, (n, p) in enumerate([
            ('Recepción', (88.1, 3.0)), ('Lavado de Ollas', (81.5, 3.05)), ('Comedor', (78.9, 6.4)),
            ('Cocción', (79.9, 9.0)), ('Carnes · Pescados', (86.5, 9.85)), ('Verduras · Frutas', (86.8, 13.15)),
            ('Lavado de Vajilla', (74.9, 18.85)), ('Depósito de Vajillas', (77.8, 19.75)), ('Lavado', (74.8, 21.9)),
            ('Descarga', (79.0, 21.9)), ('Distribución', (82.6, 22.2)), ('Repostería', (86.5, 22.5)),
            ('Estación Carros Thermo', (74.8, 24.8)), ('Dietas', (86.5, 26.0))], 1)],
        *[(f'L-sb-lavanderia-{k}', n, 'apoyo', p, True) for k, (n, p) in enumerate([
            ('Contaminado', (108.6, 31.5)), ('Clasificación', (110.5, 29.2)), ('Lavado · Carga', (116.2, 30.75)),
            ('Lavado · Descarga', (119.6, 31.35)), ('Secado', (123.2, 35.6)), ('Entrega a Esterilización', (116.7, 37.4)),
            ('Plancha', (117.0, 40.9)), ('Costura', (121.9, 41.4)), ('Abastecimiento', (120.4, 43.6))], 1)],
        *[(f'L-sb-esterilizacion-{k}', n, 'apoyo', p, True) for k, (n, p) in enumerate([
            ('Mantenimiento · Lubricado de Instrumental', (103.3, 34.2)), ('Preparación · Carga', (113.9, 36.95)),
            ('Autoclaves', (112.2, 39.4)), ('Área Equipos', (106.3, 41.6))], 1)],
    ],
    'PB': [
        # U.C.I.: habitaciones abiertas al área común
        *[(f'L-pb-uci-{k:02d}', f'Hab. {k:02d} · U.C.I.', 'otro', p) for k, p in enumerate(
            [(124.28, 84.43), (127.65, 84.57), (131.35, 84.54), None, None, None,
             (135.42, 73.16), (131.97, 72.98), (128.79, 73.05), (125.61, 73.12)], 1) if p],   # 04, 05 y 06 son cuartos
        # clínica de heridas: habitaciones abiertas al pasillo y el cuarto de médicos
        *[(f'L-pb-heridas-{k}', f'Hab. {k} · Clínica de Heridas', 'otro', p) for k, p in enumerate(
            [(164.67, 98.87), (166.38, 97.2), (167.8, 95.47), (169.31, 93.82), (170.9, 91.96), (172.55, 90.14)], 1)],
        ('L-pb-heridas-medicos', 'Médicos', 'otro', (158.8, 102.98), True),
        # emergencia: cubículos y procedimientos (con cortina) y la estación de enfermería, en el área común
        ('L-pb-emergencia-cubiculos', 'Cubículos', 'otro', (129.0, 91.0)),
        ('L-pb-emergencia-procedimientos', 'Procedimientos', 'otro', (128.1, 87.0)),
        ('L-pb-emergencia-enfermeria', 'Enfermería', 'otro', (130.5, 95.0), True),
        # imagen: el comando entre las salas 1 y 2; quimioterapia: el mostrador de información
        ('L-pb-imagen-comando', 'Comando', 'apoyo', (98.0, 78.4), True),
        ('L-pb-quimio-informacion', 'Información · Secretaría', 'otro', (84.9, 24.8)),
        # laboratorio clínico: secciones y tomas de muestras
        ('L-pb-lab-rutina', 'Análisis Rutina', 'apoyo', (87.9, 6.6), True),
        ('L-pb-lab-hematologia', 'Hematología', 'apoyo', (90.7, 6.96), True),
        ('L-pb-lab-coagulacion', 'Coagulación', 'apoyo', (94.05, 7.11), True),
        ('L-pb-lab-urgentes', 'Análisis Urgentes', 'apoyo', (97.4, 6.6), True),
        ('L-pb-toma-1', 'Toma 1', 'otro', (83.84, 8.91)),
        ('L-pb-toma-2', 'Toma 2', 'otro', (83.84, 7.41)),
        ('L-pb-toma-3', 'Toma 3', 'otro', (83.84, 5.89)),
        ('L-pb-toma-4', 'Toma 4', 'otro', (83.84, 4.0)),
        # gastroenterología
        ('L-pb-gastro-recuperacion', 'Recuperación · Preparación', 'otro', (100.48, 55.7)),
        ('L-pb-espera-citologia', 'Espera Citología', 'espera', (80.0, 100.5)),
        ('L-pb-gastro-estacion', 'Estación', 'otro', (105.19, 58.96), True),
    ],
    'P1': [
        ('L-p1-recepcion', 'Recepción', 'administracion', (54.1, 91.0)),
        ('L-p1-estacion-oeste', 'Estación de Enfermería', 'otro', (29.8, 90.1)),
        ('L-p1-preparacion-oeste', 'Preparación de Medicinas', 'otro', (30.9, 91.9)),
        ('L-p1-cuarto-electrico', 'Cuarto Eléctrico', 'apoyo', (52.2, 85.4), True),
        ('L-p1-estacion-torre', 'Estación de Enfermería', 'otro', (74.8, 64.5)),
        ('L-p1-trabajo-social', 'Trabajo Social', 'administracion', (71.4, 46.4)),
        ('L-p1-sala-espera-oeste', 'Sala de Espera', 'espera', (27.6, 95.3)),
        ('L-p1-balcon', 'Balcón', 'otro', (53.2, 98.9)),
    ],
    'P2': [
        ('L-p2-estacion', 'Estación Enfermería', 'otro', (73.5, 65.0)),
    ],
    'P3': [
        ('L-p3-estacion', 'Estación Enfermería', 'otro', (73.5, 63.0)),
        ('L-p3-estacion-trasplantes', 'Estación Enfermería Trasplantes', 'otro', (73.4, 92.2)),
        ('L-p3-trabajo-social', 'Trabajo Social', 'administracion', (71.2, 46.6)),
    ],
}
# pisos donde todos los baños son para pacientes (también el de cada habitación y el de quimioterapia), salvo los que
# AJUSTES marca como del personal
BANOS_PACIENTES = {'SB', 'PB', 'P1', 'P2', 'P3'}


def nombres_pdf(piso, d):
    """Rótulos de texto de los PDF por zonas (los del ala oeste del piso 1 vienen como texto): cada cuarto sin nombre
    toma el rótulo que cae dentro, o el más cercano a menos de 1 m."""
    carpeta = {'P1': 'p1_zonas'}.get(piso)
    if not carpeta:
        return {}
    import sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    sys.path.insert(0, os.path.join(RAIZ, 'planta_real', 'web'))
    import pymupdf as fitz
    import pdf_zonas as Z
    from exportar_datos import nombre_bonito
    from shapely.geometry import Point
    reg = json.load(open(os.path.join(Z.PLANOS, carpeta, 'registro.json')))['zonas']
    polis = [(a, poligono(a)) for a in d['ambientes'] if a['pg']]
    out = {}
    for n, r in reg.items():
        page = fitz.open(os.path.join(Z.PLANOS, carpeta, f'zona{n}.pdf'))[0]
        for b in page.get_text('blocks'):
            t = ' '.join(b[4].split())
            if not t or len(t) < 3 or t.upper().startswith(('HAB', 'N ')):
                continue
            q = Point(*Z._tf(r, (b[0] + b[2]) / 2, (b[1] + b[3]) / 2))
            libres = [(g.distance(q), a) for a, g in polis
                      if not a['nombre'] and a['area'] < 20 and a['id'] not in out and g.distance(q) < 1.0]
            if libres:
                a = min(libres, key=lambda v: v[0])[1]
                out[a['id']] = {'si': '', 'nombre': nombre_bonito(t)}
                if re.match(r'(BAÑO|SS\.? ?HH)', t.upper()):
                    out[a['id']]['cat'] = 'banos'
    return out


def banos_y_huecos(d, aj, todos_publicos=False, solo_personal=()):
    """Reglas generales para todos los pisos:
    - cuarto sin nombre con un inodoro adentro: es un baño
    - un baño es para pacientes si una puerta lo une a un pasillo, hall o sala de espera (directo o pasando por la
      antesala de otro baño); si sus puertas solo dan a una habitación o un consultorio, es el baño de ese cuarto
      (no aparece como destino)
    - espacio sin nombre que encierran muebles (sillas, maceteros) y no muros: es parte del hall, se camina"""
    from shapely.geometry import Point, LineString
    from shapely.ops import unary_union
    polis = {a['id']: poligono(a) for a in d['ambientes'] if a['pg']}
    amb = {a['id']: a for a in d['ambientes']}
    muros = unary_union([Polygon(m[0]).buffer(0) for m in d['muros'] + d.get('ventanas', [])]).buffer(0.2)
    san = [Point(Polygon(m['pg'][0] if isinstance(m['pg'][0][0], list) else m['pg']).centroid)
           for m in d.get('muebles', []) if m.get('t') == 'sanitario']
    nombre = lambda a: aj.get(a['id'], {}).get('nombre', a['nombre'])
    cat = lambda a: aj.get(a['id'], {}).get('cat', a['cat'])
    for a in d['ambientes']:
        g = polis.get(a['id'])
        if g is None or nombre(a) or a['area'] >= 30:
            continue
        if a['area'] <= 12 and any(g.contains(p) for p in san):
            aj.setdefault(a['id'], {'si': ''}).update(nombre='Baño', cat='banos')
            continue
        borde = g.exterior
        if a['area'] <= 8 and borde.length and borde.intersection(muros).length / borde.length < 0.35:
            aj.setdefault(a['id'], {'si': ''}).update(cat='circulacion')
    # a qué ambientes da cada puerta
    def en(p):
        for i, g in polis.items():
            if g.contains(p):
                return i
        return None
    vecinos = {}
    for pu in d.get('puertas', []):
        (ax, ay), (bx, by) = pu['a'], pu['b']
        L = math.hypot(bx - ax, by - ay) or 1
        nx, ny = -(by - ay) / L, (bx - ax) / L
        mx, my = (ax + bx) / 2, (ay + by) / 2
        i, j = en(Point(mx + nx * 0.45, my + ny * 0.45)), en(Point(mx - nx * 0.45, my - ny * 0.45))
        if i and j and i != j:
            vecinos.setdefault(i, set()).add(j)
            vecinos.setdefault(j, set()).add(i)
    def abierto(a):
        if aj.get(a['id'], {}).get('personal'):
            return False
        return cat(a) in ('circulacion', 'espera') or (not nombre(a) and (a.get('paso') or a['area'] >= 30))
    # cuarto con baño propio: habitación, consultorio, dormitorio, oficina… (nombre, no es pasillo ni otro baño)
    cuarto = lambda a: bool(nombre(a)) and cat(a) not in ('circulacion', 'espera', 'banos') and a['area'] > 6
    banos = [a for a in d['ambientes'] if cat(a) == 'banos']
    for a in banos:
        vistos, cola, publico, puertas = {a['id']}, [a['id']], False, False
        while cola and not publico:
            for j in vecinos.get(cola.pop(), ()):
                puertas = True
                if j in vistos:
                    continue
                vistos.add(j)
                b = amb[j]
                if abierto(b):
                    publico = True
                    break
                if cat(b) == 'banos':
                    cola.append(j)
        contacto = [amb[j] for j in vistos if j != a['id'] and cat(amb[j]) != 'banos']
        if aj.get(a['id'], {}).pop('publico', False):
            publico = True   # su puerta da al pasillo aunque el dibujo no la deje medir
        elif not puertas:
            # sin puerta dibujada: se mira con qué colinda (más de 0,6 m de borde común con un pasillo o hall)
            g = polis.get(a['id'])
            junto = [amb[i] for i, h in polis.items() if i != a['id'] and g is not None and g.buffer(0.3).intersection(h).area > 0.15]
            publico = any(abierto(b) for b in junto) and not any(cuarto(b) for b in junto)
            contacto = [b for b in junto if cat(b) != 'banos']
        aj.setdefault(a['id'], {'si': a['nombre']})
        aj[a['id']].setdefault('personal', False if todos_publicos else not publico)
        if todos_publicos and not publico and not aj[a['id']]['personal']:
            # baño dentro de un cuarto (habitación, quimioterapia, procedimientos): la ruta de pacientes no cruza
            # cuartos, así que llega a la puerta del cuarto que lo contiene
            g = polis.get(a['id'])
            dentro = [amb[j] for j in vistos if j != a['id'] and cuarto(amb[j])]
            if not dentro and g is not None:
                dentro = sorted((b for i, b in amb.items() if i in polis and i != a['id'] and cuarto(b)
                                 and g.buffer(0.3).intersection(polis[i]).area > 0.15),
                                key=lambda b: -g.buffer(0.3).intersection(polis[b['id']]).area)
            del_personal = lambda b: aj.get(b['id'], {}).get('personal') or \
                any(re.search(r, nombre(b), re.I) for r in solo_personal)
            p = frente(d, dentro[0]) if dentro else None
            p = p or frente(d, a)   # el cuarto no toca el pasillo (lo tapa su propio baño): frente al baño
            if contacto and all(del_personal(b) for b in contacto):
                # solo se llega desde un área del personal (hall interno, residencia): es del personal
                aj[a['id']]['personal'] = True
            elif p:
                aj[a['id']].update(dest=p, ventanilla=True)
            else:
                print('baño sin cuarto ni pasillo:', a['id'], a['nombre'])


def poligono(a):
    g = a['pg']
    if g and isinstance(g[0][0], list):
        g = g[0]
    return Polygon(g).buffer(0) if g and len(g) >= 3 else None


def frente(d, a):
    """Punto 0,6 m dentro de la circulación vecina, frente al cuarto."""
    pa = poligono(a)
    vec = []
    for b in d['ambientes']:
        if b is a or not (b.get('paso') or b['cat'] in ('circulacion', 'espera')):
            continue
        pb = poligono(b)
        if pb is not None and pb.distance(pa) < 0.5:
            # primero los pasillos y salas de espera; luego los vestíbulos que reparten
            vec.append((b['cat'] in ('circulacion', 'espera'), pb.intersection(pa.buffer(0.5)).area, pb))
    if not vec:
        return None
    pb = max(vec, key=lambda v: v[:2])[2]
    p_amb, p_circ = nearest_points(pa, pb)
    q = pb.buffer(-0.6)
    p = nearest_points(q, p_circ)[0] if not q.is_empty else p_circ
    return [round(p.x, 2), round(p.y, 2)]


def main():
    edificio = json.load(open(os.path.join(RAIZ, 'public', 'edificio.json')))
    # perfil del hospital: contorno de la planta baja, que los planos de los pisos altos traen como referencia
    pb = json.load(open(os.path.join(RAIZ, 'public', 'pb', 'datos.json')))
    json.dump({'huella': pb['huella']}, open(os.path.join(RAIZ, 'public', 'perfil.json'), 'w'), separators=(',', ':'))
    personales = {}
    for c in edificio['conectores']:
        if c.get('personal'):
            for s in c['paradas']:
                personales.setdefault(s['piso'], []).append(s['ambiente'])
    for piso in [p['id'] for p in edificio['pisos']]:
        carpeta = os.path.join(RAIZ, 'public', piso.lower())
        d = json.load(open(os.path.join(carpeta, 'datos.json')))
        cfg_p = os.path.join(carpeta, 'config.json')
        cfg = json.load(open(cfg_p))
        aj = {}
        for nombre, (x, y), que in AJUSTES.get(piso, []):
            cand = [a for a in d['ambientes'] if a['nombre'] == nombre]
            if not cand:
                print(piso, 'no está:', nombre)
                continue
            a = min(cand, key=lambda a: math.dist(a['lbl'], (x, y))) if (x, y) != (0, 0) else None
            for a in ([a] if a else cand):
                if que == 'ventanilla':
                    p = frente(d, a)
                    if not p:
                        print(piso, 'sin circulación al lado:', nombre)
                        continue
                    aj[a['id']] = {'si': nombre, 'dest': p, 'ventanilla': True}
                elif que == 'por-antesala':
                    otra = next((b for b in cand if b is not a), None)
                    p = frente(d, otra) if otra else None
                    if p:   # la ruta llega a la puerta de la antesala, en el pasillo
                        aj[a['id']] = {'si': nombre, 'cat': 'banos', 'dest': p, 'ventanilla': True}
                elif que == 'personal':
                    aj[a['id']] = {'si': nombre, 'personal': True}
                else:
                    aj[a['id']] = {'si': nombre, **que}
        # ascensores de servicio: no son destino de pacientes
        for i in personales.get(piso, []):
            a = next(a for a in d['ambientes'] if a['id'] == i)
            aj[i] = {'si': a['nombre'], 'personal': True}
        for i, c in nombres_pdf(piso, d).items():
            aj.setdefault(i, c)
        banos_y_huecos(d, aj, piso in BANOS_PACIENTES, cfg.get('soloPersonal', []))
        lug = []
        for l in LUGARES.get(piso, []):
            lid, nombre, cat, (x, y) = l[:4]
            lug.append({'id': lid, 'nombre': nombre, 'cat': cat, 'x': x, 'y': y, 'personal': bool(l[4]) if len(l) > 4 else False})
        cfg['lugares'] = lug
        cfg['pasos'] = [{'tipo': 'abrir', 'puntos': pp} for pp in PASOS.get(piso, [])]
        cfg['ajustes'] = aj
        json.dump(cfg, open(cfg_p, 'w'), ensure_ascii=False, indent=1)
        print(piso, len(aj), 'ajustes')


if __name__ == '__main__':
    main()

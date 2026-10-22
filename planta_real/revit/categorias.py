"""
Categorías de ambientes de la planta baja (por su nombre) con el color que usan el modelo 3D (piso de cada
ambiente) y el plano 2D de presentación.
"""
import re

# clave: (etiqueta de la leyenda, color RGB 0-1)
CATEGORIAS = {
    'consulta': ('Consultorios y atención médica', (0.72, 0.84, 0.95)),
    'espera': ('Salas de espera', (0.78, 0.90, 0.74)),
    'circulacion': ('Halls y pasillos', (0.96, 0.93, 0.84)),
    'banos': ('Baños', (0.70, 0.90, 0.92)),
    'administracion': ('Administración y atención', (0.99, 0.87, 0.62)),
    'farmacia': ('Farmacia', (0.85, 0.78, 0.94)),
    'apoyo': ('Apoyo y servicios', (0.86, 0.86, 0.86)),
    'vertical': ('Escaleras y ascensores', (0.74, 0.74, 0.78)),
    'otro': ('Otros', (0.93, 0.93, 0.93)),
}

_REGLAS = [
    ('vertical', r'ESCALERA|ASCENSOR'),
    ('banos', r'SS\.?\s*HH|SANITARIO|BATERIA SANITARIA|BAÑO|MINUSVALIDOS'),
    ('farmacia', r'FARMACIA|ATENCION FARMACEUTICA'),
    ('espera', r'ESPERA'),
    ('circulacion', r'HALL|PASILLO|PUERTA|CIRCULACI|VESTÍBULO|VESTIBULO'),
    ('administracion', r'DIRECCI|SECRETAR|CAJAS|TESORER|GESTI|M[ÓO]DULO|INFORMACI|AGENDAMIENTO|RPIS|'
                       r'COORDINACI|ADMISI|ESTAD[ÍI]STICA|TRABAJO SOCIAL'),
    ('apoyo', r'DUCTO|ASEO|ABAST|BODEGA|UTILER|CUARTO|LIMPIEZA|TELEFONOS|CAPILLA|DIET|PREPARACI|DEPÓSITO|'
              r'DEPOSITO|ARCHIVO|LABORATORIO'),
    ('consulta', r'CONSULT|PRECONSULTA|PEDIATR|GINECOLOG|COLPOSCOP|UROLOG|MEDICINA|CIRUG|NEUMOLOG|'
                 r'ENDOCRINOLOG|TRAUMATOLOG|NEUROCIRUG|TUMORES|GASTROENTEROLOG|ENFERMER|ATENCIÓN|ATENCION|'
                 r'CITOLOG|RECREACION'),
]


def categoria(nombre):
    n = (nombre or '').upper()
    for clave, patron in _REGLAS:
        if re.search(patron, n):
            return clave
    return 'otro'


def color(nombre):
    return CATEGORIAS[categoria(nombre)][1]


def es_consultorio(nombre):
    """Ambiente de atención médica individual (lleva escritorio, sillas y camilla)."""
    n = (nombre or '').upper()
    if categoria(n) != 'consulta' or ' / ' in n or 'ESPERA' in n or 'PASILLO' in n:
        return False
    return bool(re.search(r'CONSULT|PRECONSULTA|PEDIATR|GINECOLOG|COLPOSCOP|UROLOG|MEDICINA|CIRUG|NEUMOLOG|'
                          r'ENDOCRINOLOG|TRAUMATOLOG|NEUROCIRUG|TUMORES|GASTROENTEROLOG', n))

"""Exterior del 3D (y del 2D) tomado de la foto satelital de la zona, registrada contra la huella de la planta baja:
parqueaderos, canchas y zonas de árboles. Los polígonos están en píxeles de la foto (1193 x 893, norte arriba);
la foto se ajustó a la huella (giro, escala y desplazamiento) y aquí se pasan a lon/lat.
Escribe public/exterior.json. Uso: python3 planta_real/pisos/exterior.py"""
import os
import json
import math

AQUI = os.path.dirname(os.path.abspath(__file__))
PUB = os.path.join(AQUI, '..', '..', 'public')

PARQUEOS = {
    'Parqueadero norte': [(612, 150), (738, 100), (808, 190), (872, 408), (740, 432), (705, 345), (650, 255)],
    'Parqueadero junto a las canchas': [(852, 425), (955, 400), (990, 525), (882, 550)],
    'Parqueadero Parada SOLCA': [(135, 303), (208, 298), (214, 393), (140, 398)],
    'Parqueadero de visitas': [(150, 447), (232, 447), (266, 500), (262, 560), (205, 575), (162, 545)],
    'Parqueadero sur': [(212, 625), (300, 615), (350, 650), (345, 700), (232, 705)],
}
CANCHAS = [
    ('tenis', [(795, 452), (850, 440), (866, 535), (812, 548)]),
    ('basquet', [(905, 545), (958, 535), (972, 595), (918, 605)]),
    ('basquet', [(925, 612), (978, 602), (990, 660), (937, 670)]),
]
# zonas de árboles: (densidad: separación en metros, polígono)
ARBOLES = [
    (4.5, [(300, 268), (420, 218), (560, 170), (620, 175), (660, 260), (705, 330), (650, 345), (600, 330), (500, 330), (420, 300), (330, 280)]),   # bosque norte (De los Pinos)
    (5.0, [(705, 580), (800, 570), (850, 620), (830, 690), (740, 700), (700, 650)]),   # bosque sureste
    (6.0, [(705, 330), (740, 330), (800, 430), (800, 560), (760, 600), (740, 560)]),   # entre el edificio y el parqueadero norte
    (7.0, [(808, 190), (830, 190), (905, 410), (880, 415)]),   # junto a la calle de servicio
    (7.0, [(110, 290), (140, 290), (205, 720), (170, 730)]),   # a lo largo de la Av. Eloy Alfaro
    (6.5, [(190, 700), (300, 690), (320, 800), (200, 810)]),   # jardín de la rotonda (suroeste)
    (5.5, [(200, 385), (255, 372), (268, 420), (215, 440)]),   # jardín de palmeras entre los parqueaderos de visitas
    (8.0, [(620, 95), (735, 92), (735, 140), (630, 150)]),   # pasto al norte del parqueadero
]


def main():
    d = json.load(open(os.path.join(PUB, 'pb', 'datos.json')))
    G = d['geo']
    reg = json.load(open(os.path.join(AQUI, 'exterior_registro.json')))
    a, s = math.radians(reg['ang']), reg['s']
    mlon = 111320 * math.cos(math.radians(G['lat0']))
    mlat = 110574

    def ll(u, v):
        X, Y = (u - reg['ox']) / s, -(v - reg['oy']) / s
        e = math.cos(a) * X + math.sin(a) * Y
        n = -math.sin(a) * X + math.cos(a) * Y
        return [round(G['lon0'] + e / mlon, 7), round(G['lat0'] + n / mlat, 7)]

    out = dict(
        parqueos=[dict(nombre=k, ll=[ll(*p) for p in v]) for k, v in PARQUEOS.items()],
        canchas=[dict(tipo=t, ll=[ll(*p) for p in v]) for t, v in CANCHAS],
        arboles=[dict(sep=sep, ll=[ll(*p) for p in v]) for sep, v in ARBOLES],
    )
    json.dump(out, open(os.path.join(PUB, 'exterior.json'), 'w'), separators=(',', ':'))
    print('exterior:', len(out['parqueos']), 'parqueaderos,', len(out['canchas']), 'canchas,', len(out['arboles']), 'zonas de árboles')


if __name__ == '__main__':
    main()

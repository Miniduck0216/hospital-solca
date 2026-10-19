"""
Texturas procedurales (JPG pequeños) para el modelo de SketchUp: pisos por servicio, fachada,
cielo raso, césped, asfalto, veredas, madera, cubierta y acero. Se incrustan en el .rb en base64.
"""
import io, base64
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

N = 256
rng = np.random.default_rng(7)


def hexrgb(h):
    return np.array([int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)], dtype=float)


def ruido(escala=1.0, octavas=4):
    """ruido de valor multi-escala en [−1, 1]"""
    acc = np.zeros((N, N))
    amp, tot = 1.0, 0.0
    for o in range(octavas):
        n = max(2, int(4 * 2 ** o * escala))
        base = rng.standard_normal((n, n))
        img = Image.fromarray(((base - base.min()) / (np.ptp(base) + 1e-9) * 255).astype(np.uint8)).resize((N, N), Image.BICUBIC)
        acc += amp * (np.asarray(img, dtype=float) / 127.5 - 1)
        tot += amp
        amp *= 0.5
    return acc / tot


def a_jpg(arr):
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
    b = io.BytesIO()
    img.save(b, 'JPEG', quality=82, optimize=True)
    return b.getvalue()


def baldosa(color, n=4, junta='#00000018', var=6, aj=2):
    c = hexrgb(color)
    arr = np.tile(c, (N, N, 1)) + ruido(2, 3)[..., None] * var
    paso = N // n
    for i in range(n):
        for j in range(n):
            arr[j * paso:(j + 1) * paso, i * paso:(i + 1) * paso] += rng.uniform(-3, 3)
    oscuro = c * 0.82
    for k in range(n + 1):
        p = min(N - 1, k * paso)
        arr[:, max(0, p - aj // 2):p + aj // 2 + 1] = oscuro
        arr[max(0, p - aj // 2):p + aj // 2 + 1, :] = oscuro
    return arr


def textura_paneles(color, cols=2, filas=4):
    c = hexrgb(color)
    arr = np.tile(c, (N, N, 1)) + ruido(3, 3)[..., None] * 3
    pw, ph = N // cols, N // filas
    for i in range(cols):
        for j in range(filas):
            arr[j * ph:(j + 1) * ph, i * pw:(i + 1) * pw] += rng.uniform(-4, 4)
    j_ = c * 0.70
    for i in range(cols + 1):
        p = min(N - 1, i * pw); arr[:, max(0, p - 1):p + 2] = j_
    for j in range(filas + 1):
        p = min(N - 1, j * ph); arr[max(0, p - 1):p + 2, :] = j_
    return arr


def adoquin(color, filas=8, cols=4):
    c = hexrgb(color)
    arr = np.tile(c, (N, N, 1)) + ruido(4, 4)[..., None] * 7
    ph, pw = N // filas, N // cols
    j_ = c * 0.72
    for j in range(filas):
        off = (pw // 2) if j % 2 else 0
        arr[j * ph:(j + 1) * ph] += rng.uniform(-6, 6)
        arr[j * ph:j * ph + 2, :] = j_
        for i in range(cols + 1):
            x = (i * pw + off) % N
            arr[j * ph:(j + 1) * ph, max(0, x - 1):x + 1] = j_
    return arr


def cesped():
    c = hexrgb('#7DB25E')
    n1, n2 = ruido(2, 5), ruido(16, 2)
    arr = np.tile(c, (N, N, 1))
    arr += n1[..., None] * np.array([18, 22, 10]) + n2[..., None] * np.array([10, 14, 6])
    return arr


def asfalto():
    c = hexrgb('#50565E')
    arr = np.tile(c, (N, N, 1)) + ruido(12, 3)[..., None] * 16 + rng.standard_normal((N, N, 1)) * 6
    return arr


def madera():
    c = hexrgb('#B98A5E')
    y = np.linspace(0, 1, N)[:, None]
    vetas = np.sin((y * 46 + ruido(1.0, 3) * 0.45) * np.pi) * 0.5 + 0.5
    arr = np.tile(c, (N, N, 1)) + (vetas[..., None] - 0.5) * np.array([22, 17, 12]) + ruido(6, 2)[..., None] * 5
    return arr


def grava():
    c = hexrgb('#A7ADB3')
    arr = np.tile(c, (N, N, 1)) + rng.standard_normal((N, N, 1)) * 14 + ruido(20, 2)[..., None] * 10
    return np.asarray(Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6)), dtype=float)


def acero():
    c = hexrgb('#C9D1D8')
    filas = rng.standard_normal((N, 1)) * 7
    arr = np.tile(c, (N, N, 1)) + filas[..., None] + rng.standard_normal((N, N, 1)) * 2
    return arr


def piedra(color):
    c = hexrgb(color)
    return np.tile(c, (N, N, 1)) + ruido(5, 4)[..., None] * 14


def vinilico(color):
    c = hexrgb(color)
    arr = np.tile(c, (N, N, 1)) + ruido(3, 3)[..., None] * 4
    motas = rng.random((N, N)) < 0.03
    arr[motas] -= 22
    return arr


def generar():
    """devuelve {archivo: (bytes, ancho_m, alto_m)}"""
    T = {}
    pisos = {'emergencia': '#F1CFCB', 'consulta': '#D3E3F3', 'diagnostico': '#DFD5F1', 'tratamiento': '#F4E2C6',
             'hospitalizacion': '#D5EADC', 'servicios': '#E6E9EC', 'administracion': '#EFDCE6'}
    for cat, col in pisos.items():
        T[f'piso_{cat}.jpg'] = (a_jpg(baldosa(col)), 2.4, 2.4)
    T['piso_pasillo.jpg'] = (a_jpg(vinilico('#E3E8ED')), 2.0, 2.0)
    T['piso_bano.jpg'] = (a_jpg(baldosa('#E9F1F7', n=8, aj=2, var=3)), 2.4, 2.4)
    T['cielo_raso.jpg'] = (a_jpg(baldosa('#F6F7F8', n=4, var=2, aj=3)), 2.4, 2.4)
    T['fachada.jpg'] = (a_jpg(textura_paneles('#EEF0F1')), 2.4, 2.4)
    T['zocalo.jpg'] = (a_jpg(piedra('#5E636A')), 1.2, 1.2)
    T['cesped.jpg'] = (a_jpg(cesped()), 4.0, 4.0)
    T['asfalto.jpg'] = (a_jpg(asfalto()), 3.0, 3.0)
    T['acera.jpg'] = (a_jpg(baldosa('#CDCDCB', n=4, var=7, aj=2)), 2.0, 2.0)
    T['plaza.jpg'] = (a_jpg(adoquin('#C9BFB2')), 2.4, 2.4)
    T['madera.jpg'] = (a_jpg(madera()), 1.0, 1.0)
    T['cubierta.jpg'] = (a_jpg(grava()), 2.0, 2.0)
    T['acero.jpg'] = (a_jpg(acero()), 0.6, 0.6)
    return T


if __name__ == '__main__':
    t = generar()
    for k, (b, w, h) in t.items():
        open('/tmp/' + k, 'wb').write(b)
    print({k: len(v[0]) for k, v in t.items()}, sum(len(v[0]) for v in t.values()))

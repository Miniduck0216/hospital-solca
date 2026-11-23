# Hospital SOLCA · orientación interior

Mapa de orientación de la **planta baja real** del Hospital SOLCA Quito, al estilo de los kioscos de "cómo llegar":
mapa 2D sobre las calles y parqueaderos reales, buscador, rutas paso a paso y vista 3D del modelo.

**Sitio:** https://miniduck0216.github.io/hospital-solca/  ·  Prototipo anterior (5 pisos, distribución propuesta): https://miniduck0216.github.io/hospital-solca/prototipo/

## Planta baja real

- Fuente: plano arquitectónico de la planta baja (`planos_entrada.dwg`), procesado en `planta_real/revit/` (modelo e IFC para Revit) y `planta_real/web/` (datos de la página).
- Mapa 2D: calles, manzanas y parqueaderos de OpenStreetMap (OpenFreeMap) con el plano encima; ambientes coloreados por tipo, nombres, íconos y entradas.
- Rutas: A* sobre una rejilla de 25 cm del espacio libre (muros, tabiques y muebles bloquean), suavizadas, con indicaciones paso a paso.
- 3D: el mismo modelo que va a Revit (IFC → GLB), sobre el mapa, con altura de muros ajustable, letreros y recorrido animado de la ruta.
- Enlaces: `?origen=entrada-puerta-1&destino=…` y código QR del punto de partida.
- Para regenerar todo: `sh planta_real/web/actualizar_web.sh`.

## Datos del mapa: geometría aquí, información en OM3

El plano del repositorio solo trae geometría e ids. Toda la información de los ambientes sale de la base Oracle de OM3
(`OMN_DBA.OMN_ADM_PLANO_PISO`, `_AMBIENTE`, `_AMBIENTE_HIST`) a través de `GET /api/v1/administracion/mapa/publicado`.

| Archivo | Qué queda |
|---|---|
| `public/sedes/<sede>/<edificio>/pisos/<piso>/datos.json` | `fuente`, `geo`, `altura`, `huella`, `muros`, `ventanas`, `barandas`, `puertas`, `trazos_puertas`, `trazos`, `muebles`, `gradas`, `viseras`, `nav`, `parqueos`, `poi`. Por ambiente: `id`, `cat` (solo el tipo estructural: `circulacion`, `espera`, `escaleras`, `ascensores` o `banos`; el resto, `otro`), `area`, `pg`, `lbl`, `dest` (puerta según el plano) y `paso`. Por entrada: `id`, `x`, `y`, `fx`, `fy`, `ancho`. |
| `public/sedes/<sede>/<edificio>/pisos/<piso>/config.json` | `piso`, `nota`, `pasos` (muros y pasos trazados) y `puertasAuto` (ids de cuartos cuya puerta el plano no dibuja). |
| OM3 (`/mapa/publicado`) | Por ambiente: `nombre`, `cat`, `icono`, `personal`, `oculto`, `ventanilla`, `dest`. Además `lugares`, el nombre de cada entrada (`entradas`), los `letreros` y los pasos del editor. |

### Respaldo local (solo Quito)

El dibujo de cada sede (una sede de OM3 = un hospital por ciudad) lo publica OM3 (`/geo`). Solo Quito trae además un
respaldo que viaja con el sitio y se usa si OM3 no responde:

```
public/
  index.html, sw.js, marca/          la aplicación
  sedes/quito/principal/             edificio.json, exterior.json, perfil.json, techos.json
    pisos/sb|pb|p1|p2|p3/            datos.json, config.json y los .glb de cada piso
```

- La carpeta sale de `?sede=&edificio=` o de los mismos parámetros dentro de `?geo=` o `?config=`. La sede puede ser
  el número de OM3 o el nombre: 1 quito, 2 imbabura, 3 santo-domingo, 4 tungurahua, 5 chimborazo, 6 manabi,
  7 machala, 8 cuenca, 21 loja (`src/pb/sedes.js`). El edificio por defecto es `principal`.
- Las demás sedes no tienen respaldo: si OM3 no responde o no tiene un plano publicado, el mapa muestra «Esta sede
  todavía no tiene plano publicado en OM3» sobre el mapa base, en el centro de la ciudad (`SEDES_INFO` en
  `src/pb/sedes.js`). Nunca cae al plano de Quito. Sin `?geo=` ni `?config=`, el plano se pide al `/geo` del OM3 por
  defecto (`VITE_CONFIG_OM3_URL` con `/geo`, `?sede=<n>&edificio=<E>`).
- Cada sede va por separado. Solo la página base, sin `?sede=`, `?geo=` ni `?config=`, es Quito. Una `?sede=` que no
  es una sede de OM3 (`9`, `abc`), o un `?geo=`/`?config=` sin `sede` o sin `edificio`, no cargan ningún plano: el
  mapa muestra el aviso. Un edificio sin carpeta propia tampoco cae a `quito/principal`.
- Los archivos de OM3 se piden con `/geo/:id/archivo?ruta=…&sede=<n>&edificio=<CÓDIGO>` (OM3 comprueba que la
  versión sea de ese edificio).
- Los cambios del administrador guardados en el navegador van por sede y edificio
  (`solca-admin-cambios:<sede>:<edificio>`); la clave vieja `solca-admin-cambios` solo pasa a `quito:principal`.
- Las rutas de `edificio.json` son relativas a la carpeta del edificio (`pisos/pb/datos.json`).
- `npm run build` (GitHub Pages) y `npm run build:portal` (portal de OM3, `dist-portal/`) usan la misma carpeta.
  El prototipo anterior (`/prototipo/`) solo va en Pages.
- `npm run plano:paquete -- --sede 1 --edificio PRINCIPAL` lee la carpeta de esa sede y edificio (Quito: `public/`;
  las demás: `planta_real/salida_sedes/<sede>/<edificio>/`, o la que se pase con `--carpeta`).

### Plano de una sede nueva

1. Configuración: `planta_real/sedes/<sede>/<edificio>/config.json` (ruta del DXF, unidad, traslado, caja, clave,
   nombre, nivel y altura de cada piso, capas de muros, ventanas, columnas y gradas, capa de los nombres, bloques de
   puerta y georreferencia). Ejemplos: `santo-domingo/principal` e `imbabura/principal`; detalle en
   `planta_real/pisos/sede.py`.
2. `bash planta_real/pisos/regenerar.sh --sede santo-domingo --edificio principal` (Python 3.12 con el venv, ver
   CLAUDE.md). Escribe en `planta_real/salida_sedes/santo-domingo/principal/` (ignorada por git): `edificio.json` y,
   por piso, `datos.json` sin nombres, `config.json`, `nombres.json` (los nombres del DXF) y el `.glb`; además
   `techos.json` y `perfil.json` (techos del 3D y contorno de la planta baja bajo los pisos altos) y, si la sede lo
   configura, `exterior.json` (`planta_real/pisos/exterior_sede.py`: calles de OSM abiertas lo justo para que el
   edificio quepa con su vereda; el mapa tapa las calles del mapa base que ya no calzan y dibuja las propias).
3. `npm run plano:paquete -- --sede 3 --edificio PRINCIPAL --salida plano.zip` y subirlo en OM3 (lleva también
   `exterior.json`, `techos.json` y `perfil.json` si están; el mapa los lee del paquete y, si faltan, del respaldo de
   Quito o de ninguno). Al publicar, OM3 crea
   con `nombres.json` los ambientes que todavía no existen.

- De dónde se lee: `?config=<url>` (tótem, celular y editor de OM3) o, sin parámetro, `VITE_CONFIG_OM3_URL` al compilar
  (por defecto `https://dev-omniumportal.solcaquito.org.ec/api/v1/administracion/mapa/publicado`).
- Si no llega o viene vacía, el mapa dibuja el plano y traza rutas igual, sin nombres, con el aviso «No se pudo cargar la
  información del hospital». En el navegador queda guardada la última que llegó (service worker).
- `npm run vaciar` deja el plano solo con geometría (`scripts/vaciar_datos.mjs`). `npm run comparar-om3` compara el mapa
  vaciado + `tests/fixtures/config-om3.json` con el mapa de antes del vaciado (commit `2c6eb6e`).
- La semilla de la base y `tests/fixtures/config-om3.json` se generan en `OMNIUM_MS_ADMINISTRACION`:
  `npm run plano:semilla -- <carpeta de hospital-solca> --ref 2c6eb6e --json <carpeta>/tests/fixtures/config-om3.json`.

## Prototipo anterior (/prototipo/)

### Qué incluye

- 5 pisos (Planta Baja a Piso 4) sobre una retícula de 1,20 m; 9 núcleos con escalera en U y dos ascensores camilleros.
- Rutas con A* sobre el grafo de pasillos, puertas, escaleras y ascensores; opción de **ruta accesible** (solo ascensores).
- «Baño más cercano», búsqueda por nombre o categoría, indicaciones paso a paso y cambio de piso en la ruta.
- Recorrido 3D con muros recortables, ciclo de día y noche, techo, fachada, árboles, parqueaderos y calles.
- **Códigos QR por punto de partida**: el botón QR del mapa genera el código del punto «Desde», listo para imprimir.

## Enlaces de punto de partida (`?origen=`)

Cada enlace abre el mapa con ese lugar como punto de partida (también se acepta `?origin=`).

| Lugar | Piso | Enlace |
|---|---|---|
| Entrada principal | Planta Baja | [`entrada-principal`](https://miniduck0216.github.io/hospital-solca/prototipo/?origen=entrada-principal) |
| Entrada de Emergencia | Planta Baja | [`entrada-emergencia`](https://miniduck0216.github.io/hospital-solca/prototipo/?origen=entrada-emergencia) |
| Emergencia | Planta Baja | [`pb-emergencia`](https://miniduck0216.github.io/hospital-solca/prototipo/?origen=pb-emergencia) |
| Imagenología | Planta Baja | [`pb-imagenologia`](https://miniduck0216.github.io/hospital-solca/prototipo/?origen=pb-imagenologia) |
| Servicios Generales | Planta Baja | [`pb-servicios-generales`](https://miniduck0216.github.io/hospital-solca/prototipo/?origen=pb-servicios-generales) |
| Radioterapia | Planta Baja | [`pb-radioterapia`](https://miniduck0216.github.io/hospital-solca/prototipo/?origen=pb-radioterapia) |
| Farmacia | Planta Baja | [`pb-farmacia`](https://miniduck0216.github.io/hospital-solca/prototipo/?origen=pb-farmacia) |
| Laboratorio Clínico | Planta Baja | [`pb-laboratorio-clinico`](https://miniduck0216.github.io/hospital-solca/prototipo/?origen=pb-laboratorio-clinico) |
| Caja y Facturación | Planta Baja | [`pb-caja-y-facturacion`](https://miniduck0216.github.io/hospital-solca/prototipo/?origen=pb-caja-y-facturacion) |
| Hall y Admisión | Planta Baja | [`pb-hall-y-admision`](https://miniduck0216.github.io/hospital-solca/prototipo/?origen=pb-hall-y-admision) |
| Consulta Externa | Planta Baja | [`pb-consulta-externa`](https://miniduck0216.github.io/hospital-solca/prototipo/?origen=pb-consulta-externa) |
| Cafetería | Planta Baja | [`pb-cafeteria`](https://miniduck0216.github.io/hospital-solca/prototipo/?origen=pb-cafeteria) |
| Rehabilitación | Piso 1 | [`p1-rehabilitacion`](https://miniduck0216.github.io/hospital-solca/prototipo/?origen=p1-rehabilitacion) |
| Banco de Sangre | Piso 1 | [`p1-banco-de-sangre`](https://miniduck0216.github.io/hospital-solca/prototipo/?origen=p1-banco-de-sangre) |
| Medicina Nuclear | Piso 1 | [`p1-medicina-nuclear`](https://miniduck0216.github.io/hospital-solca/prototipo/?origen=p1-medicina-nuclear) |
| Quimioterapia Ambulatoria | Piso 1 | [`p1-quimioterapia-ambulatoria`](https://miniduck0216.github.io/hospital-solca/prototipo/?origen=p1-quimioterapia-ambulatoria) |
| Endoscopía | Piso 1 | [`p1-endoscopia`](https://miniduck0216.github.io/hospital-solca/prototipo/?origen=p1-endoscopia) |
| Docencia | Piso 1 | [`p1-docencia`](https://miniduck0216.github.io/hospital-solca/prototipo/?origen=p1-docencia) |
| Administración | Piso 1 | [`p1-administracion`](https://miniduck0216.github.io/hospital-solca/prototipo/?origen=p1-administracion) |
| Oncología Clínica | Piso 1 | [`p1-oncologia-clinica`](https://miniduck0216.github.io/hospital-solca/prototipo/?origen=p1-oncologia-clinica) |
| Central de Esterilización | Piso 2 | [`p2-central-de-esterilizacion`](https://miniduck0216.github.io/hospital-solca/prototipo/?origen=p2-central-de-esterilizacion) |
| Centro Quirúrgico | Piso 2 | [`p2-centro-quirurgico`](https://miniduck0216.github.io/hospital-solca/prototipo/?origen=p2-centro-quirurgico) |
| Recuperación | Piso 2 | [`p2-recuperacion`](https://miniduck0216.github.io/hospital-solca/prototipo/?origen=p2-recuperacion) |
| Patología | Piso 2 | [`p2-patologia`](https://miniduck0216.github.io/hospital-solca/prototipo/?origen=p2-patologia) |
| Servicios Generales | Piso 2 | [`p2-servicios-generales`](https://miniduck0216.github.io/hospital-solca/prototipo/?origen=p2-servicios-generales) |
| UCI | Piso 2 | [`p2-uci`](https://miniduck0216.github.io/hospital-solca/prototipo/?origen=p2-uci) |
| Hospitalización Adultos | Piso 3 | [`p3-hospitalizacion-adultos`](https://miniduck0216.github.io/hospital-solca/prototipo/?origen=p3-hospitalizacion-adultos) |
| Trasplante de Médula | Piso 3 | [`p3-trasplante-de-medula`](https://miniduck0216.github.io/hospital-solca/prototipo/?origen=p3-trasplante-de-medula) |
| Estación de Enfermería | Piso 3 | [`p3-estacion-de-enfermeria`](https://miniduck0216.github.io/hospital-solca/prototipo/?origen=p3-estacion-de-enfermeria) |
| Oncopediatría | Piso 4 | [`p4-oncopediatria`](https://miniduck0216.github.io/hospital-solca/prototipo/?origen=p4-oncopediatria) |
| Cuidados Paliativos | Piso 4 | [`p4-cuidados-paliativos`](https://miniduck0216.github.io/hospital-solca/prototipo/?origen=p4-cuidados-paliativos) |
| Estación de Enfermería | Piso 4 | [`p4-estacion-de-enfermeria`](https://miniduck0216.github.io/hospital-solca/prototipo/?origen=p4-estacion-de-enfermeria) |

## Cómo se genera

| Paso | Archivo |
|---|---|
| Datos del edificio (los mismos del script de Dynamo para Revit 2027) | `datos/solca_datos.json` |
| Ambientes, muros con vanos, núcleos y grafo de navegación | `scripts/solca_datos_web.py` → `src/data/hospital3d.json` |
| Modelo 3D (muros unidos con corte a 2,60 m, losas, acabados, puertas, ventanas, entorno) | `scripts/solca_modelo_web.py` → `src/data/modelo_sk.json` |
| Prueba de colisiones del grafo y de 1 500 rutas al azar | `npm run validar` |

```bash
pip install numpy
python3 scripts/solca_datos_web.py
python3 scripts/solca_modelo_web.py
npm install
npm run validar
npm run dev
```

Cada `push` a `main` construye el sitio y lo publica en GitHub Pages (`.github/workflows/pages.yml`).

Autor: Andrés Méndez · Ingeniería en Software · UDLA

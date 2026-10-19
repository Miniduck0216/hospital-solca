# Hospital SOLCA · orientación interior

Prototipo académico de orientación dentro de un hospital, al estilo de los kioscos con código QR:
mapa 2D con buscador y rutas paso a paso, y recorrido 3D con un personaje que camina por el edificio.

> La silueta del edificio, los accesos y el entorno (lote, calles y parqueaderos) se tomaron del mapa real de SOLCA Quito
> (Av. Eloy Alfaro y De los Pinos). **La distribución interior es una propuesta** y no corresponde a los planos reales del hospital.

**Sitio:** https://miniduck0216.github.io/hospital-solca/

## Qué incluye

- 5 pisos (Planta Baja a Piso 4) sobre una retícula de 1,20 m; 9 núcleos con escalera en U y dos ascensores camilleros.
- Rutas con A* sobre el grafo de pasillos, puertas, escaleras y ascensores; opción de **ruta accesible** (solo ascensores).
- «Baño más cercano», búsqueda por nombre o categoría, indicaciones paso a paso y cambio de piso en la ruta.
- Recorrido 3D con muros recortables, ciclo de día y noche, techo, fachada, árboles, parqueaderos y calles.
- **Códigos QR por punto de partida**: el botón QR del mapa genera el código del punto «Desde», listo para imprimir.

## Enlaces de punto de partida (`?origen=`)

Cada enlace abre el mapa con ese lugar como punto de partida (también se acepta `?origin=`).

| Lugar | Piso | Enlace |
|---|---|---|
| Entrada principal | Planta Baja | [`entrada-principal`](https://miniduck0216.github.io/hospital-solca/?origen=entrada-principal) |
| Entrada de Emergencia | Planta Baja | [`entrada-emergencia`](https://miniduck0216.github.io/hospital-solca/?origen=entrada-emergencia) |
| Emergencia | Planta Baja | [`pb-emergencia`](https://miniduck0216.github.io/hospital-solca/?origen=pb-emergencia) |
| Imagenología | Planta Baja | [`pb-imagenologia`](https://miniduck0216.github.io/hospital-solca/?origen=pb-imagenologia) |
| Servicios Generales | Planta Baja | [`pb-servicios-generales`](https://miniduck0216.github.io/hospital-solca/?origen=pb-servicios-generales) |
| Radioterapia | Planta Baja | [`pb-radioterapia`](https://miniduck0216.github.io/hospital-solca/?origen=pb-radioterapia) |
| Farmacia | Planta Baja | [`pb-farmacia`](https://miniduck0216.github.io/hospital-solca/?origen=pb-farmacia) |
| Laboratorio Clínico | Planta Baja | [`pb-laboratorio-clinico`](https://miniduck0216.github.io/hospital-solca/?origen=pb-laboratorio-clinico) |
| Caja y Facturación | Planta Baja | [`pb-caja-y-facturacion`](https://miniduck0216.github.io/hospital-solca/?origen=pb-caja-y-facturacion) |
| Hall y Admisión | Planta Baja | [`pb-hall-y-admision`](https://miniduck0216.github.io/hospital-solca/?origen=pb-hall-y-admision) |
| Consulta Externa | Planta Baja | [`pb-consulta-externa`](https://miniduck0216.github.io/hospital-solca/?origen=pb-consulta-externa) |
| Cafetería | Planta Baja | [`pb-cafeteria`](https://miniduck0216.github.io/hospital-solca/?origen=pb-cafeteria) |
| Rehabilitación | Piso 1 | [`p1-rehabilitacion`](https://miniduck0216.github.io/hospital-solca/?origen=p1-rehabilitacion) |
| Banco de Sangre | Piso 1 | [`p1-banco-de-sangre`](https://miniduck0216.github.io/hospital-solca/?origen=p1-banco-de-sangre) |
| Medicina Nuclear | Piso 1 | [`p1-medicina-nuclear`](https://miniduck0216.github.io/hospital-solca/?origen=p1-medicina-nuclear) |
| Quimioterapia Ambulatoria | Piso 1 | [`p1-quimioterapia-ambulatoria`](https://miniduck0216.github.io/hospital-solca/?origen=p1-quimioterapia-ambulatoria) |
| Endoscopía | Piso 1 | [`p1-endoscopia`](https://miniduck0216.github.io/hospital-solca/?origen=p1-endoscopia) |
| Docencia | Piso 1 | [`p1-docencia`](https://miniduck0216.github.io/hospital-solca/?origen=p1-docencia) |
| Administración | Piso 1 | [`p1-administracion`](https://miniduck0216.github.io/hospital-solca/?origen=p1-administracion) |
| Oncología Clínica | Piso 1 | [`p1-oncologia-clinica`](https://miniduck0216.github.io/hospital-solca/?origen=p1-oncologia-clinica) |
| Central de Esterilización | Piso 2 | [`p2-central-de-esterilizacion`](https://miniduck0216.github.io/hospital-solca/?origen=p2-central-de-esterilizacion) |
| Centro Quirúrgico | Piso 2 | [`p2-centro-quirurgico`](https://miniduck0216.github.io/hospital-solca/?origen=p2-centro-quirurgico) |
| Recuperación | Piso 2 | [`p2-recuperacion`](https://miniduck0216.github.io/hospital-solca/?origen=p2-recuperacion) |
| Patología | Piso 2 | [`p2-patologia`](https://miniduck0216.github.io/hospital-solca/?origen=p2-patologia) |
| Servicios Generales | Piso 2 | [`p2-servicios-generales`](https://miniduck0216.github.io/hospital-solca/?origen=p2-servicios-generales) |
| UCI | Piso 2 | [`p2-uci`](https://miniduck0216.github.io/hospital-solca/?origen=p2-uci) |
| Hospitalización Adultos | Piso 3 | [`p3-hospitalizacion-adultos`](https://miniduck0216.github.io/hospital-solca/?origen=p3-hospitalizacion-adultos) |
| Trasplante de Médula | Piso 3 | [`p3-trasplante-de-medula`](https://miniduck0216.github.io/hospital-solca/?origen=p3-trasplante-de-medula) |
| Estación de Enfermería | Piso 3 | [`p3-estacion-de-enfermeria`](https://miniduck0216.github.io/hospital-solca/?origen=p3-estacion-de-enfermeria) |
| Oncopediatría | Piso 4 | [`p4-oncopediatria`](https://miniduck0216.github.io/hospital-solca/?origen=p4-oncopediatria) |
| Cuidados Paliativos | Piso 4 | [`p4-cuidados-paliativos`](https://miniduck0216.github.io/hospital-solca/?origen=p4-cuidados-paliativos) |
| Estación de Enfermería | Piso 4 | [`p4-estacion-de-enfermeria`](https://miniduck0216.github.io/hospital-solca/?origen=p4-estacion-de-enfermeria) |

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

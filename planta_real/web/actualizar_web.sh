#!/bin/sh
# Regenera el modelo, el IFC y los archivos de la página web de la planta baja real.
set -e
cd "$(dirname "$0")/../.."
python3 planta_real/revit/generar.py --pickle      # modelo, IFC para Revit y plano 2D
python3 planta_real/web/exportar_datos.py          # public/pb/datos.json (mapa, rutas)
python3 planta_real/web/exportar_glb.py            # public/pb/solca_pb.glb (vista 3D)

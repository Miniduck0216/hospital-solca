#!/usr/bin/env bash
# Regenera los pisos del mapa desde planta_real/planos/solca-edificio-2025.dxf (DWG del edificio exportado a DXF).
# Orden: fuente (lee el DXF por piso) -> modelo_piso (modelo, varios minutos por piso) -> exportar_piso (datos.json)
#        -> unir_pb (suma la parte nueva de la planta baja sin cambiar los ids de antes) -> conectores (edificio.json)
#        -> ajustes (config.json de cada piso) -> glb_piso (modelos 3D).
# Uso: bash planta_real/pisos/regenerar.sh [--sin-modelos] [--sin-3d]
set -e
cd "$(dirname "$0")/../.."
P=planta_real/pisos
if [[ " $* " != *" --sin-modelos "* ]]; then
  python3 -I $P/fuente.py SB PB P1 P2 P3
  for p in SB PB P1 P2 P3; do python3 -I $P/modelo_piso.py $p; done
fi
for p in SB P1 P2 P3; do python3 -I $P/exportar_piso.py $p; done
python3 -I -c "
import sys; sys.path.insert(0, '$P')
import __main__, modelo_piso, pickle, exportar_piso as EP
__main__.ModeloPiso = modelo_piso.ModeloPiso
EP.exportar(pickle.load(open('/tmp/modelo_PB.pkl', 'rb')), 'PB', '/tmp/pb_nueva.json')"
python3 -I $P/unir_pb.py
python3 -I $P/conectores.py
python3 -I $P/ajustes.py
python3 -I $P/techos.py
if [[ " $* " != *" --sin-3d "* ]]; then
  for p in SB P1 P2 P3; do python3 -I $P/glb_piso.py $p; done
  python3 -I $P/glb_piso.py PB public/pb/solca_pb_este.glb --fuera-de $P/pb_vieja.json
  python3 -I $P/conectores.py
fi
npm test

#!/usr/bin/env bash
# Regenera los pisos del mapa desde planta_real/planos/solca-edificio-2025.dxf (DWG del edificio exportado a DXF).
# Orden: fuente (lee el DXF por piso) -> modelo_piso (modelo, varios minutos por piso) -> exportar_piso (datos.json)
#        -> unir_pb (suma la parte nueva de la planta baja sin cambiar los ids de antes) -> conectores (edificio.json)
#        -> ajustes (config.json de cada piso) -> glb_piso (modelos 3D) -> vaciado (scripts/vaciar_datos.mjs).
# Uso: bash planta_real/pisos/regenerar.sh [--sin-modelos] [--sin-3d] [--sin-vaciar]
# El plano publicado va solo con geometría: los nombres y demás información de los ambientes salen de OM3
# (OMN_DBA.OMN_ADM_PLANO_*). Si la regeneración cambió ambientes o ids, use --sin-vaciar, genere la semilla de OM3 desde
# esta carpeta (OMNIUM_MS_GESTION_HOSPITALARIA: npm run plano:semilla -- <carpeta> --json tests/fixtures/config-om3.json)
# y después vacíe con npm run vaciar. Ojo: soloPersonal, ventanillas, renombres y ajustes ya no están en config.json
# (quedaron en el commit 2c6eb6e y en la base); lo nuevo se nombra desde el editor del mapa en OM3.
#
# Otra sede (un hospital por ciudad): bash planta_real/pisos/regenerar.sh --sede santo-domingo --edificio principal
#   Lee planta_real/sedes/<sede>/<edificio>/config.json (DXF, cajas de los pisos, capas, georreferencia; ver sede.py) y
#   escribe en planta_real/salida_sedes/<sede>/<edificio>/ (fuera de public/, ignorada por git): edificio.json y, por
#   piso, datos.json (sin nombres), config.json, nombres.json (los nombres que trae el DXF) y el .glb. De ahí sale el
#   paquete para OM3: npm run plano:paquete -- --sede <número de OM3> --edificio PRINCIPAL --salida plano.zip
#   (unir_pb.py, ajustes.py y exterior.py son solo de Quito).
set -e
cd "$(dirname "$0")/../.."
P=planta_real/pisos
SEDE=""
EDIFICIO="principal"
args=("$@")
for ((i = 0; i < ${#args[@]}; i++)); do
  case "${args[$i]}" in
    --sede) SEDE="${args[$((i + 1))]}" ;;
    --edificio) EDIFICIO="${args[$((i + 1))]}" ;;
  esac
done

if [[ -n "$SEDE" && "$SEDE" != "quito" ]]; then
  export SOLCA_SEDE="$SEDE/$EDIFICIO"
  OUT="planta_real/salida_sedes/$SEDE/$EDIFICIO"
  PISOS=$(python3 -I -c "import sys; sys.path.insert(0, '$P'); import sede; print(' '.join(sede.PISOS))")
  echo "Sede $SOLCA_SEDE · pisos: $PISOS · salida: $OUT"
  if [[ " $* " != *" --sin-modelos "* ]]; then
    python3 -I $P/fuente.py $PISOS
    for p in $PISOS; do python3 -I $P/modelo_piso.py $p; done
  fi
  for p in $PISOS; do python3 -I $P/exportar_piso.py $p; done
  python3 -I $P/conectores.py
  if [[ " $* " != *" --sin-3d "* ]]; then
    for p in $PISOS; do python3 -I $P/glb_piso.py $p; done
    python3 -I $P/conectores.py
  fi
  if [[ " $* " != *" --sin-vaciar "* ]]; then
    node scripts/vaciar_datos.mjs "$OUT" --nombres
  fi
  exit 0
fi

unset SOLCA_SEDE   # Quito: el respaldo local de siempre (sede.py sin variable)
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
python3 -I $P/exterior.py
if [[ " $* " != *" --sin-3d "* ]]; then
  for p in SB P1 P2 P3; do python3 -I $P/glb_piso.py $p; done
  python3 -I $P/glb_piso.py PB public/sedes/quito/principal/pisos/pb/solca_pb_este.glb --fuera-de $P/pb_vieja.json
  python3 -I $P/conectores.py
fi
if [[ " $* " != *" --sin-vaciar "* ]]; then
  node scripts/vaciar_datos.mjs
fi
npm test

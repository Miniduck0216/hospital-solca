# Red de pasillos para pacientes

`verde.png` es la máscara de las líneas verdes trazadas sobre el PDF del plano
(`planos_entrada-Model_rutas.pdf`). `exportar_datos.py` las lleva a la cuadrícula de navegación
con la calibración de `calibracion.json`.

La calibración se obtuvo así:
1. El PDF se rasteriza a 2,5x (4210 × 5960 px). Las paredes del modelo (`muros`) se dibujan con
   una transformación inicial: 47,2 px/m en X, 46,2 px/m en Y, con el eje Y invertido.
2. `cv2.findTransformECC` (MOTION_AFFINE, a 1/4 de escala) afina esa transformación contra las
   líneas oscuras del PDF. Correlación 0,64; el resultado es `W` en `calibracion.json`.
3. La transformación final es `raster = F · W · ((ax + x·sx)/F, (by − y·sy)/F)`.

Para cambiar la red: se redibuja la línea verde sobre el PDF, se regenera `verde.png` con la
misma calibración y se corre `planta_real/web/actualizar_web.sh`.

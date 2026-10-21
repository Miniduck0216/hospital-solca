# Generado por scripts/dxf_a_sketchup.py — planta baja
model = Sketchup.active_model
model.start_operation("Planta baja SOLCA", true)
ents = model.active_entities
mats = model.materials
capa = ->(n) { model.layers[n] || model.layers.add(n) }
mat = ->(n, hex) { m = mats[n] || mats.add(n); m.color = Sketchup::Color.new(hex); m }
ALTO = 3.0.m
ALTO_DINTEL = 2.10.m

g = ents.add_group; g.name = "Losa"; g.layer = capa.("Losa")
f = g.entities.add_face([[0.000.m, 71.300.m, 0], [31.910.m, 71.970.m, 0], [44.110.m, 75.840.m, 0], [58.170.m, 75.260.m, 0], [58.030.m, 0.080.m, 0], [53.780.m, 0.000.m, 0], [53.700.m, 9.180.m, 0], [30.850.m, 8.840.m, 0], [31.110.m, 27.450.m, 0], [31.200.m, 54.180.m, 0], [0.000.m, 54.540.m, 0]])
f.reverse! if f.normal.z > 0
f.pushpull(0.20.m)
g.entities.grep(Sketchup::Face).each { |x| x.material = mat.("Losa", "#C9CCCF") }

g = ents.add_group; g.name = "Ba\u00f1os hombres"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[0.190.m, 71.100.m, 0], [3.910.m, 71.140.m, 0], [3.880.m, 67.730.m, 0], [0.170.m, 67.680.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso banos", "#DDE2E8")
g.set_attribute("solca", "categoria", "banos")
t = ents.add_text("Ba\u00f1os hombres", [2.038.m, 69.413.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Consultorio 35"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[8.610.m, 71.540.m, 0], [17.850.m, 71.560.m, 0], [17.730.m, 68.260.m, 0], [8.490.m, 68.330.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso consulta", "#C9D8FB")
g.set_attribute("solca", "categoria", "consulta")
t = ents.add_text("Consultorio 35", [13.170.m, 69.922.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Pediatr\u00eda 03 - 33"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[4.580.m, 68.000.m, 0], [9.650.m, 67.990.m, 0], [9.610.m, 59.050.m, 0], [4.650.m, 59.040.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso consulta", "#C9D8FB")
g.set_attribute("solca", "categoria", "consulta")
t = ents.add_text("Pediatr\u00eda 03 - 33", [7.123.m, 63.520.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Medicina 04 - 26"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[12.370.m, 67.890.m, 0], [18.000.m, 67.860.m, 0], [17.850.m, 58.740.m, 0], [12.320.m, 58.750.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso consulta", "#C9D8FB")
g.set_attribute("solca", "categoria", "consulta")
t = ents.add_text("Medicina 04 - 26", [15.135.m, 63.310.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Secretar\u00eda - Control (Pediatr\u00eda y Medicina)"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[4.640.m, 58.840.m, 0], [17.850.m, 58.550.m, 0], [17.770.m, 56.610.m, 0], [4.670.m, 56.900.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso administracion", "#F1CFE0")
g.set_attribute("solca", "categoria", "administracion")
t = ents.add_text("Secretar\u00eda - Control (Pediatr\u00eda y Medicina)", [11.233.m, 57.725.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Endocrinolog\u00eda - 22"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[21.240.m, 71.230.m, 0], [31.410.m, 71.600.m, 0], [31.440.m, 67.430.m, 0], [21.090.m, 67.350.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso consulta", "#C9D8FB")
g.set_attribute("solca", "categoria", "consulta")
t = ents.add_text("Endocrinolog\u00eda - 22", [26.295.m, 69.403.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Ascensores norte"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[32.040.m, 70.320.m, 0], [35.890.m, 70.360.m, 0], [35.840.m, 66.580.m, 0], [31.890.m, 66.540.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso circulacion", "#D2D8DF")
g.set_attribute("solca", "categoria", "circulacion")
t = ents.add_text("Ascensores norte", [33.915.m, 68.450.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Traumatolog\u00eda - 20"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[22.810.m, 66.700.m, 0], [35.340.m, 66.210.m, 0], [35.240.m, 58.770.m, 0], [22.710.m, 59.240.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso consulta", "#C9D8FB")
g.set_attribute("solca", "categoria", "consulta")
t = ents.add_text("Traumatolog\u00eda - 20", [29.025.m, 62.730.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Secretar\u00eda - Control (Endocrinolog\u00eda y Traumatolog\u00eda)"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[22.700.m, 58.950.m, 0], [35.230.m, 58.480.m, 0], [35.140.m, 56.360.m, 0], [22.610.m, 56.630.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso administracion", "#F1CFE0")
g.set_attribute("solca", "categoria", "administracion")
t = ents.add_text("Secretar\u00eda - Control (Endocrinolog\u00eda y Traumatolog\u00eda)", [28.920.m, 57.605.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Ba\u00f1os mujeres"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[44.290.m, 75.540.m, 0], [49.170.m, 75.340.m, 0], [49.090.m, 73.410.m, 0], [44.210.m, 73.610.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso banos", "#DDE2E8")
g.set_attribute("solca", "categoria", "banos")
t = ents.add_text("Ba\u00f1os mujeres", [46.690.m, 74.475.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Consultorio 2"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[40.410.m, 72.410.m, 0], [54.490.m, 72.030.m, 0], [54.330.m, 68.170.m, 0], [40.250.m, 68.540.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso consulta", "#C9D8FB")
g.set_attribute("solca", "categoria", "consulta")
t = ents.add_text("Consultorio 2", [47.370.m, 70.288.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Gastroenterolog\u00eda - 12"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[40.240.m, 68.340.m, 0], [54.320.m, 67.980.m, 0], [53.930.m, 58.840.m, 0], [39.870.m, 59.170.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso consulta", "#C9D8FB")
g.set_attribute("solca", "categoria", "consulta")
t = ents.add_text("Gastroenterolog\u00eda - 12", [47.090.m, 63.582.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Secretar\u00eda - Control (Gastroenterolog\u00eda)"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[40.050.m, 58.980.m, 0], [53.920.m, 58.650.m, 0], [53.820.m, 56.250.m, 0], [39.950.m, 56.470.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso administracion", "#F1CFE0")
g.set_attribute("solca", "categoria", "administracion")
t = ents.add_text("Secretar\u00eda - Control (Gastroenterolog\u00eda)", [46.935.m, 57.587.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Ba\u00f1o accesible"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[31.100.m, 54.000.m, 0], [35.240.m, 54.040.m, 0], [35.070.m, 47.490.m, 0], [30.940.m, 47.440.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso banos", "#DDE2E8")
g.set_attribute("solca", "categoria", "banos")
t = ents.add_text("Ba\u00f1o accesible", [33.087.m, 50.742.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Capilla"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[30.930.m, 47.150.m, 0], [35.250.m, 47.100.m, 0], [35.130.m, 41.720.m, 0], [30.810.m, 41.670.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso servicios", "#DDE2E8")
g.set_attribute("solca", "categoria", "servicios")
t = ents.add_text("Capilla", [33.030.m, 44.410.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "RPIS"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[30.790.m, 41.380.m, 0], [35.110.m, 41.330.m, 0], [35.070.m, 37.880.m, 0], [30.750.m, 37.830.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso administracion", "#F1CFE0")
g.set_attribute("solca", "categoria", "administracion")
t = ents.add_text("RPIS", [32.930.m, 39.605.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Farmacia"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[40.060.m, 52.130.m, 0], [56.770.m, 51.720.m, 0], [56.540.m, 41.950.m, 0], [39.850.m, 42.330.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso servicios", "#DDE2E8")
g.set_attribute("solca", "categoria", "servicios")
t = ents.add_text("Farmacia", [48.305.m, 47.032.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Ascensores sur"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[53.980.m, 37.730.m, 0], [56.820.m, 37.640.m, 0], [56.750.m, 33.820.m, 0], [53.910.m, 33.910.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso circulacion", "#D2D8DF")
g.set_attribute("solca", "categoria", "circulacion")
t = ents.add_text("Ascensores sur", [55.365.m, 35.775.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Farmacias Econ\u00f3micas"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[30.910.m, 32.060.m, 0], [39.900.m, 31.780.m, 0], [39.900.m, 27.180.m, 0], [30.910.m, 27.270.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso servicios", "#DDE2E8")
g.set_attribute("solca", "categoria", "servicios")
t = ents.add_text("Farmacias Econ\u00f3micas", [35.405.m, 29.573.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Cajas"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[53.570.m, 28.200.m, 0], [56.700.m, 28.100.m, 0], [56.600.m, 21.440.m, 0], [53.380.m, 21.540.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso administracion", "#F1CFE0")
g.set_attribute("solca", "categoria", "administracion")
t = ents.add_text("Cajas", [55.062.m, 24.820.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Direcci\u00f3n"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[31.570.m, 26.960.m, 0], [39.880.m, 26.710.m, 0], [43.760.m, 21.150.m, 0], [56.580.m, 20.970.m, 0], [56.080.m, 9.590.m, 0], [30.870.m, 9.310.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso administracion", "#F1CFE0")
g.set_attribute("solca", "categoria", "administracion")
t = ents.add_text("Direcci\u00f3n", [43.123.m, 19.115.m, 0.05.m]); t.layer = capa.("Rótulos")

gm = ents.add_group; gm.name = "Muros"; gm.layer = capa.("Muros")
me = gm.entities
caja = ->(a, b, e, z0, z1, m) {
  v = Geom::Vector3d.new(b[0] - a[0], b[1] - a[1], 0); return if v.length < 0.01
  n = Geom::Vector3d.new(-v.y, v.x, 0); n.length = e / 2.0
  q = [a.offset(n), b.offset(n), b.offset(n.reverse), a.offset(n.reverse)].map { |p| [p.x, p.y, z0] }
  f = me.add_face(q); f.reverse! if f.normal.z < 0; f.pushpull(z1 - z0)
  me.grep(Sketchup::Face).each { |x| x.material ||= m } }
m_muro = mat.("Pintura muros", "#F3F1EC"); m_ext = mat.("Fachada", "#E6E1D8")
caja.(Geom::Point3d.new(-0.001.m, 71.301.m, 0), Geom::Point3d.new(31.910.m, 71.971.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(31.908.m, 71.972.m, 0), Geom::Point3d.new(44.108.m, 75.843.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(44.111.m, 75.845.m, 0), Geom::Point3d.new(58.172.m, 75.265.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(58.030.m, 0.078.m, 0), Geom::Point3d.new(58.173.m, 75.258.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(53.779.m, -0.001.m, 0), Geom::Point3d.new(58.029.m, 0.079.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(53.702.m, 9.180.m, 0), Geom::Point3d.new(53.782.m, -0.001.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(30.850.m, 8.841.m, 0), Geom::Point3d.new(53.700.m, 9.181.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(30.850.m, 8.839.m, 0), Geom::Point3d.new(31.110.m, 27.449.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(31.111.m, 27.449.m, 0), Geom::Point3d.new(31.202.m, 54.179.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(-0.002.m, 54.538.m, 0), Geom::Point3d.new(31.197.m, 54.179.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(0.000.m, 54.540.m, 0), Geom::Point3d.new(0.000.m, 71.300.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(0.187.m, 71.097.m, 0), Geom::Point3d.new(3.906.m, 71.137.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(3.880.m, 67.733.m, 0), Geom::Point3d.new(3.890.m, 68.835.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(3.890.m, 68.835.m, 0), Geom::Point3d.new(3.901.m, 70.035.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(3.901.m, 70.035.m, 0), Geom::Point3d.new(3.910.m, 71.143.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(0.168.m, 67.680.m, 0), Geom::Point3d.new(3.878.m, 67.730.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(0.167.m, 67.681.m, 0), Geom::Point3d.new(0.186.m, 71.101.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(8.607.m, 71.540.m, 0), Geom::Point3d.new(17.848.m, 71.561.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(17.727.m, 68.258.m, 0), Geom::Point3d.new(17.847.m, 71.558.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(8.492.m, 68.331.m, 0), Geom::Point3d.new(12.510.m, 68.301.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(12.510.m, 68.301.m, 0), Geom::Point3d.new(13.710.m, 68.292.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(13.710.m, 68.292.m, 0), Geom::Point3d.new(14.588.m, 68.285.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(14.588.m, 68.285.m, 0), Geom::Point3d.new(15.788.m, 68.276.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(15.788.m, 68.276.m, 0), Geom::Point3d.new(17.732.m, 68.261.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(8.492.m, 68.330.m, 0), Geom::Point3d.new(8.613.m, 71.540.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(4.582.m, 68.000.m, 0), Geom::Point3d.new(6.515.m, 67.996.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(6.515.m, 67.996.m, 0), Geom::Point3d.new(7.715.m, 67.994.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(7.715.m, 67.994.m, 0), Geom::Point3d.new(9.652.m, 67.990.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(9.612.m, 59.050.m, 0), Geom::Point3d.new(9.652.m, 67.990.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(4.651.m, 59.041.m, 0), Geom::Point3d.new(9.611.m, 59.050.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(4.581.m, 68.002.m, 0), Geom::Point3d.new(4.651.m, 59.042.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(12.368.m, 67.891.m, 0), Geom::Point3d.new(12.508.m, 67.891.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(12.508.m, 67.891.m, 0), Geom::Point3d.new(13.708.m, 67.884.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(13.708.m, 67.884.m, 0), Geom::Point3d.new(14.585.m, 67.880.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(14.585.m, 67.880.m, 0), Geom::Point3d.new(15.785.m, 67.873.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(15.785.m, 67.873.m, 0), Geom::Point3d.new(17.998.m, 67.862.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(17.848.m, 58.743.m, 0), Geom::Point3d.new(17.998.m, 67.863.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(12.319.m, 58.750.m, 0), Geom::Point3d.new(17.849.m, 58.740.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(12.322.m, 58.751.m, 0), Geom::Point3d.new(12.372.m, 67.891.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(4.637.m, 58.843.m, 0), Geom::Point3d.new(10.645.m, 58.711.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(10.645.m, 58.711.m, 0), Geom::Point3d.new(11.845.m, 58.685.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(11.845.m, 58.685.m, 0), Geom::Point3d.new(17.848.m, 58.553.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(17.770.m, 56.613.m, 0), Geom::Point3d.new(17.850.m, 58.553.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(4.668.m, 56.902.m, 0), Geom::Point3d.new(17.769.m, 56.613.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(4.638.m, 58.841.m, 0), Geom::Point3d.new(4.668.m, 56.901.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(21.236.m, 71.229.m, 0), Geom::Point3d.new(31.406.m, 71.599.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(31.410.m, 71.602.m, 0), Geom::Point3d.new(31.440.m, 67.432.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(21.093.m, 67.351.m, 0), Geom::Point3d.new(31.443.m, 67.431.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(21.088.m, 67.354.m, 0), Geom::Point3d.new(21.140.m, 68.691.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(21.140.m, 68.691.m, 0), Geom::Point3d.new(21.186.m, 69.890.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(21.186.m, 69.890.m, 0), Geom::Point3d.new(21.238.m, 71.234.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(32.038.m, 70.317.m, 0), Geom::Point3d.new(35.888.m, 70.357.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(35.837.m, 66.580.m, 0), Geom::Point3d.new(35.855.m, 67.870.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(35.855.m, 67.870.m, 0), Geom::Point3d.new(35.870.m, 69.070.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(35.870.m, 69.070.m, 0), Geom::Point3d.new(35.887.m, 70.360.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(31.890.m, 66.536.m, 0), Geom::Point3d.new(35.840.m, 66.576.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(31.893.m, 66.538.m, 0), Geom::Point3d.new(32.044.m, 70.318.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(22.811.m, 66.697.m, 0), Geom::Point3d.new(35.340.m, 66.206.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(35.237.m, 58.771.m, 0), Geom::Point3d.new(35.279.m, 61.890.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(35.279.m, 61.890.m, 0), Geom::Point3d.new(35.295.m, 63.090.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(35.295.m, 63.090.m, 0), Geom::Point3d.new(35.337.m, 66.211.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(22.711.m, 59.240.m, 0), Geom::Point3d.new(35.241.m, 58.770.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(22.710.m, 59.239.m, 0), Geom::Point3d.new(22.810.m, 66.699.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(22.701.m, 58.949.m, 0), Geom::Point3d.new(35.231.m, 58.479.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(35.139.m, 56.361.m, 0), Geom::Point3d.new(35.229.m, 58.480.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(22.608.m, 56.633.m, 0), Geom::Point3d.new(28.275.m, 56.511.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(28.275.m, 56.511.m, 0), Geom::Point3d.new(29.475.m, 56.485.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(29.475.m, 56.485.m, 0), Geom::Point3d.new(35.139.m, 56.363.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(22.611.m, 56.627.m, 0), Geom::Point3d.new(22.701.m, 58.946.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(44.288.m, 75.545.m, 0), Geom::Point3d.new(49.168.m, 75.345.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(49.087.m, 73.407.m, 0), Geom::Point3d.new(49.167.m, 75.337.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(44.208.m, 73.615.m, 0), Geom::Point3d.new(46.051.m, 73.540.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(46.051.m, 73.540.m, 0), Geom::Point3d.new(47.250.m, 73.491.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(47.250.m, 73.491.m, 0), Geom::Point3d.new(49.088.m, 73.416.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(44.207.m, 73.608.m, 0), Geom::Point3d.new(44.287.m, 75.537.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(40.410.m, 72.407.m, 0), Geom::Point3d.new(54.490.m, 72.026.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(54.327.m, 68.168.m, 0), Geom::Point3d.new(54.487.m, 72.028.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(40.254.m, 68.542.m, 0), Geom::Point3d.new(46.685.m, 68.373.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(46.685.m, 68.373.m, 0), Geom::Point3d.new(47.885.m, 68.341.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(46.690.m, 68.373.m, 0), Geom::Point3d.new(47.890.m, 68.341.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(47.890.m, 68.341.m, 0), Geom::Point3d.new(54.334.m, 68.172.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(40.247.m, 68.537.m, 0), Geom::Point3d.new(40.407.m, 72.407.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(40.244.m, 68.340.m, 0), Geom::Point3d.new(46.680.m, 68.175.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(46.680.m, 68.175.m, 0), Geom::Point3d.new(47.880.m, 68.144.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(46.685.m, 68.175.m, 0), Geom::Point3d.new(47.885.m, 68.144.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(47.885.m, 68.144.m, 0), Geom::Point3d.new(54.324.m, 67.980.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(53.929.m, 58.842.m, 0), Geom::Point3d.new(54.319.m, 67.982.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(39.871.m, 59.167.m, 0), Geom::Point3d.new(53.931.m, 58.836.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(39.869.m, 59.171.m, 0), Geom::Point3d.new(40.239.m, 68.341.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(40.050.m, 58.978.m, 0), Geom::Point3d.new(53.920.m, 58.648.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(53.817.m, 56.250.m, 0), Geom::Point3d.new(53.917.m, 58.650.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(39.953.m, 56.469.m, 0), Geom::Point3d.new(46.285.m, 56.369.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(46.285.m, 56.369.m, 0), Geom::Point3d.new(47.485.m, 56.350.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(47.485.m, 56.350.m, 0), Geom::Point3d.new(53.824.m, 56.249.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(39.949.m, 56.470.m, 0), Geom::Point3d.new(40.049.m, 58.980.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(31.099.m, 54.004.m, 0), Geom::Point3d.new(32.570.m, 54.018.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(32.570.m, 54.018.m, 0), Geom::Point3d.new(33.770.m, 54.030.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(33.770.m, 54.030.m, 0), Geom::Point3d.new(35.240.m, 54.044.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(35.069.m, 47.493.m, 0), Geom::Point3d.new(35.239.m, 54.044.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(30.939.m, 47.439.m, 0), Geom::Point3d.new(35.069.m, 47.489.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(30.941.m, 47.439.m, 0), Geom::Point3d.new(31.101.m, 53.999.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(30.930.m, 47.148.m, 0), Geom::Point3d.new(35.250.m, 47.098.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(35.132.m, 41.722.m, 0), Geom::Point3d.new(35.178.m, 43.810.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(35.178.m, 43.810.m, 0), Geom::Point3d.new(35.205.m, 45.010.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(35.205.m, 45.010.m, 0), Geom::Point3d.new(35.252.m, 47.102.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(30.808.m, 41.670.m, 0), Geom::Point3d.new(35.128.m, 41.720.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(30.811.m, 41.672.m, 0), Geom::Point3d.new(30.931.m, 47.152.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(30.790.m, 41.378.m, 0), Geom::Point3d.new(35.110.m, 41.328.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(35.069.m, 37.879.m, 0), Geom::Point3d.new(35.082.m, 39.005.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(35.082.m, 39.005.m, 0), Geom::Point3d.new(35.096.m, 40.205.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(35.096.m, 40.205.m, 0), Geom::Point3d.new(35.109.m, 41.328.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(30.748.m, 37.830.m, 0), Geom::Point3d.new(35.068.m, 37.880.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(30.750.m, 37.828.m, 0), Geom::Point3d.new(30.791.m, 41.377.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(40.059.m, 52.131.m, 0), Geom::Point3d.new(56.769.m, 51.722.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(56.537.m, 41.951.m, 0), Geom::Point3d.new(56.638.m, 46.235.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(56.638.m, 46.235.m, 0), Geom::Point3d.new(56.666.m, 47.435.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(56.666.m, 47.435.m, 0), Geom::Point3d.new(56.767.m, 51.721.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(39.850.m, 42.327.m, 0), Geom::Point3d.new(56.539.m, 41.946.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(39.850.m, 42.332.m, 0), Geom::Point3d.new(40.060.m, 52.133.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(53.981.m, 37.729.m, 0), Geom::Point3d.new(56.821.m, 37.639.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(56.748.m, 33.820.m, 0), Geom::Point3d.new(56.818.m, 37.640.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(53.911.m, 33.909.m, 0), Geom::Point3d.new(56.751.m, 33.819.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(53.908.m, 33.910.m, 0), Geom::Point3d.new(53.932.m, 35.220.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(53.932.m, 35.220.m, 0), Geom::Point3d.new(53.954.m, 36.420.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(53.954.m, 36.420.m, 0), Geom::Point3d.new(53.978.m, 37.730.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(30.909.m, 32.061.m, 0), Geom::Point3d.new(34.805.m, 31.939.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(34.805.m, 31.939.m, 0), Geom::Point3d.new(36.005.m, 31.902.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(36.005.m, 31.902.m, 0), Geom::Point3d.new(39.898.m, 31.781.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(39.900.m, 27.180.m, 0), Geom::Point3d.new(39.900.m, 31.780.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(30.908.m, 27.269.m, 0), Geom::Point3d.new(39.898.m, 27.179.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(30.910.m, 27.270.m, 0), Geom::Point3d.new(30.910.m, 32.060.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(53.569.m, 28.202.m, 0), Geom::Point3d.new(56.700.m, 28.102.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(56.601.m, 21.441.m, 0), Geom::Point3d.new(56.701.m, 28.101.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(53.378.m, 21.542.m, 0), Geom::Point3d.new(56.598.m, 21.442.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(53.380.m, 21.541.m, 0), Geom::Point3d.new(53.458.m, 24.270.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(53.458.m, 24.270.m, 0), Geom::Point3d.new(53.492.m, 25.470.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(53.492.m, 25.470.m, 0), Geom::Point3d.new(53.570.m, 28.201.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(31.569.m, 26.958.m, 0), Geom::Point3d.new(39.879.m, 26.707.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(39.882.m, 26.712.m, 0), Geom::Point3d.new(43.762.m, 21.151.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(43.759.m, 21.151.m, 0), Geom::Point3d.new(56.579.m, 20.972.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(56.078.m, 9.589.m, 0), Geom::Point3d.new(56.302.m, 14.681.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(56.302.m, 14.681.m, 0), Geom::Point3d.new(56.355.m, 15.880.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(56.355.m, 15.880.m, 0), Geom::Point3d.new(56.578.m, 20.969.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(30.869.m, 9.310.m, 0), Geom::Point3d.new(56.078.m, 9.590.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(30.869.m, 9.311.m, 0), Geom::Point3d.new(31.569.m, 26.960.m, 0), 0.15.m, 0, ALTO, m_muro)

gr = ents.add_group; gr.name = "Rutas (guía)"; gr.layer = capa.("Rutas")
gr.entities.add_curve([[3.895.m, 69.435.m, 0], [4.390.m, 68.300.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[13.110.m, 68.295.m, 0], [13.092.m, 67.904.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[7.115.m, 67.995.m, 0], [7.123.m, 68.176.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[15.185.m, 67.875.m, 0], [15.182.m, 67.809.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[11.245.m, 58.695.m, 0], [10.865.m, 58.709.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[21.165.m, 69.290.m, 0], [21.085.m, 67.541.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[35.865.m, 68.470.m, 0], [37.745.m, 68.394.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[35.290.m, 62.490.m, 0], [37.503.m, 62.401.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[28.875.m, 56.495.m, 0], [28.855.m, 55.293.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[46.650.m, 73.510.m, 0], [47.630.m, 68.250.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[47.290.m, 68.355.m, 0], [47.630.m, 68.250.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[47.280.m, 68.160.m, 0], [47.626.m, 68.146.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[46.885.m, 56.360.m, 0], [47.136.m, 56.350.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[33.170.m, 54.020.m, 0], [33.190.m, 55.220.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[35.190.m, 44.410.m, 0], [37.538.m, 44.316.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[35.090.m, 39.605.m, 0], [37.345.m, 39.515.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[56.655.m, 46.835.m, 0], [58.169.m, 46.769.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[53.945.m, 35.820.m, 0], [53.929.m, 35.343.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[35.405.m, 31.920.m, 0], [34.636.m, 35.308.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[53.475.m, 24.870.m, 0], [52.950.m, 24.880.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[56.330.m, 15.280.m, 0], [56.798.m, 15.260.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[1.220.m, 55.760.m, 0], [35.570.m, 55.180.m, 0], [58.520.m, 54.820.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[4.390.m, 68.300.m, 0], [21.100.m, 67.540.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[11.210.m, 68.030.m, 0], [10.750.m, 55.610.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[20.610.m, 67.560.m, 0], [20.140.m, 55.260.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[37.900.m, 72.220.m, 0], [37.190.m, 54.640.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[47.630.m, 68.250.m, 0], [47.090.m, 55.240.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[37.950.m, 54.610.m, 0], [37.200.m, 35.890.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[32.750.m, 34.880.m, 0], [37.200.m, 35.890.m, 0], [53.400.m, 35.360.m, 0], [57.670.m, 35.220.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[58.520.m, 54.820.m, 0], [56.180.m, 1.070.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[44.830.m, 35.640.m, 0], [48.240.m, 25.980.m, 0], [52.950.m, 24.880.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
t = ents.add_text("ASC-A", [33.890.m, 68.400.m, 1.m]); t.layer = capa.("Rótulos")
t = ents.add_text("ASC-B", [55.130.m, 35.780.m, 1.m]); t.layer = capa.("Rótulos")
t = ents.add_text("QR \u00b7 Entrada principal", [32.750.m, 34.880.m, 1.m]); t.layer = capa.("Rótulos")
t = ents.add_text("QR \u00b7 Entrada norte", [37.900.m, 72.220.m, 1.m]); t.layer = capa.("Rótulos")

model.commit_operation
Sketchup.active_model.active_view.zoom_extents
puts "Planta baja: 21 ambientes, 120 tramos de muro, 21 puertas"

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
f = g.entities.add_face([[0.000.m, 76.060.m, 0], [58.000.m, 76.060.m, 0], [58.000.m, 0.060.m, 0], [53.180.m, 0.000.m, 0], [52.810.m, 10.390.m, 0], [27.620.m, 12.420.m, 0], [27.880.m, 32.680.m, 0], [29.810.m, 41.010.m, 0], [30.010.m, 57.840.m, 0], [0.020.m, 59.030.m, 0]])
f.reverse! if f.normal.z > 0
f.pushpull(0.20.m)
g.entities.grep(Sketchup::Face).each { |x| x.material = mat.("Losa", "#C9CCCF") }

g = ents.add_group; g.name = "Consultorios 1 - 35"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[4.490.m, 74.840.m, 0], [18.570.m, 74.510.m, 0], [18.600.m, 61.330.m, 0], [4.910.m, 61.450.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso consulta", "#C9D8FB")
g.set_attribute("solca", "categoria", "consulta")
t = ents.add_text("Consultorios 1 - 35", [11.643.m, 68.032.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Neumolog\u00eda - 21"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[20.480.m, 73.270.m, 0], [31.220.m, 72.710.m, 0], [32.140.m, 60.530.m, 0], [22.060.m, 60.880.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso consulta", "#C9D8FB")
g.set_attribute("solca", "categoria", "consulta")
t = ents.add_text("Neumolog\u00eda - 21", [26.475.m, 66.847.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Ginecolog\u00eda - 4"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[39.770.m, 73.210.m, 0], [44.860.m, 73.290.m, 0], [49.730.m, 73.370.m, 0], [53.950.m, 73.070.m, 0], [54.220.m, 59.200.m, 0], [40.120.m, 59.310.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso consulta", "#C9D8FB")
g.set_attribute("solca", "categoria", "consulta")
t = ents.add_text("Ginecolog\u00eda - 4", [47.108.m, 68.575.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Ba\u00f1os hombres"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[0.120.m, 75.510.m, 0], [4.150.m, 75.390.m, 0], [4.850.m, 70.490.m, 0], [0.880.m, 70.610.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso banos", "#DDE2E8")
g.set_attribute("solca", "categoria", "banos")
t = ents.add_text("Ba\u00f1os hombres", [2.500.m, 73.000.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Ba\u00f1os mujeres"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[45.020.m, 75.480.m, 0], [49.580.m, 75.560.m, 0], [49.700.m, 72.280.m, 0], [45.070.m, 72.210.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso banos", "#DDE2E8")
g.set_attribute("solca", "categoria", "banos")
t = ents.add_text("Ba\u00f1os mujeres", [47.343.m, 73.883.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Ba\u00f1o accesible"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[30.770.m, 57.850.m, 0], [34.650.m, 57.910.m, 0], [34.500.m, 54.000.m, 0], [30.670.m, 53.940.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso banos", "#DDE2E8")
g.set_attribute("solca", "categoria", "banos")
t = ents.add_text("Ba\u00f1o accesible", [32.648.m, 55.925.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Ascensores norte"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[32.390.m, 72.370.m, 0], [35.800.m, 72.240.m, 0], [36.050.m, 68.150.m, 0], [32.580.m, 68.270.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso circulacion", "#D2D8DF")
g.set_attribute("solca", "categoria", "circulacion")
t = ents.add_text("Ascensores norte", [34.205.m, 70.258.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Capilla"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[30.050.m, 53.770.m, 0], [34.520.m, 53.840.m, 0], [34.330.m, 46.320.m, 0], [29.950.m, 46.410.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso servicios", "#DDE2E8")
g.set_attribute("solca", "categoria", "servicios")
t = ents.add_text("Capilla", [32.212.m, 50.085.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "RPIS"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[29.990.m, 46.110.m, 0], [34.370.m, 46.020.m, 0], [34.180.m, 41.960.m, 0], [29.740.m, 42.190.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso administracion", "#F1CFE0")
g.set_attribute("solca", "categoria", "administracion")
t = ents.add_text("RPIS", [32.070.m, 44.070.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Farmacia"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[38.930.m, 55.360.m, 0], [56.620.m, 54.980.m, 0], [56.690.m, 45.890.m, 0], [39.450.m, 46.090.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso servicios", "#DDE2E8")
g.set_attribute("solca", "categoria", "servicios")
t = ents.add_text("Farmacia", [47.922.m, 50.580.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Ascensores sur"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[53.270.m, 41.350.m, 0], [56.640.m, 41.250.m, 0], [56.660.m, 37.330.m, 0], [53.330.m, 37.430.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso circulacion", "#D2D8DF")
g.set_attribute("solca", "categoria", "circulacion")
t = ents.add_text("Ascensores sur", [54.975.m, 39.340.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Farmacias Econ\u00f3micas"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[25.900.m, 36.890.m, 0], [34.780.m, 36.730.m, 0], [34.770.m, 33.060.m, 0], [26.030.m, 33.070.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso servicios", "#DDE2E8")
g.set_attribute("solca", "categoria", "servicios")
t = ents.add_text("Farmacias Econ\u00f3micas", [30.370.m, 34.938.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Cajas"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[51.480.m, 31.360.m, 0], [55.940.m, 31.010.m, 0], [55.920.m, 24.980.m, 0], [51.660.m, 25.180.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso administracion", "#F1CFE0")
g.set_attribute("solca", "categoria", "administracion")
t = ents.add_text("Cajas", [53.750.m, 28.133.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Direcci\u00f3n"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[27.920.m, 32.410.m, 0], [38.260.m, 32.140.m, 0], [42.660.m, 24.530.m, 0], [51.520.m, 24.520.m, 0], [55.160.m, 23.400.m, 0], [55.970.m, 11.020.m, 0], [27.560.m, 12.780.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso administracion", "#F1CFE0")
g.set_attribute("solca", "categoria", "administracion")
t = ents.add_text("Direcci\u00f3n", [42.721.m, 22.971.m, 0.05.m]); t.layer = capa.("Rótulos")

gm = ents.add_group; gm.name = "Muros"; gm.layer = capa.("Muros")
me = gm.entities
caja = ->(a, b, e, z0, z1, m) {
  v = Geom::Vector3d.new(b[0] - a[0], b[1] - a[1], 0); return if v.length < 0.01
  n = Geom::Vector3d.new(-v.y, v.x, 0); n.length = e / 2.0
  q = [a.offset(n), b.offset(n), b.offset(n.reverse), a.offset(n.reverse)].map { |p| [p.x, p.y, z0] }
  f = me.add_face(q); f.reverse! if f.normal.z < 0; f.pushpull(z1 - z0)
  me.grep(Sketchup::Face).each { |x| x.material ||= m } }
m_muro = mat.("Pintura muros", "#F3F1EC"); m_ext = mat.("Fachada", "#E6E1D8")
caja.(Geom::Point3d.new(0.000.m, 76.060.m, 0), Geom::Point3d.new(58.000.m, 76.060.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(58.000.m, 0.060.m, 0), Geom::Point3d.new(58.000.m, 76.060.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(53.179.m, -0.003.m, 0), Geom::Point3d.new(57.999.m, 0.057.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(52.811.m, 10.391.m, 0), Geom::Point3d.new(53.181.m, 0.001.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(27.620.m, 12.422.m, 0), Geom::Point3d.new(52.811.m, 10.392.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(27.619.m, 12.421.m, 0), Geom::Point3d.new(27.878.m, 32.680.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(27.879.m, 32.681.m, 0), Geom::Point3d.new(29.809.m, 41.011.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(29.810.m, 41.008.m, 0), Geom::Point3d.new(30.011.m, 57.838.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(0.017.m, 59.029.m, 0), Geom::Point3d.new(30.007.m, 57.840.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(-0.002.m, 76.060.m, 0), Geom::Point3d.new(0.018.m, 59.030.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(4.488.m, 74.838.m, 0), Geom::Point3d.new(18.567.m, 74.509.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(18.569.m, 74.511.m, 0), Geom::Point3d.new(18.599.m, 61.331.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(4.912.m, 61.453.m, 0), Geom::Point3d.new(11.155.m, 61.398.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(11.155.m, 61.398.m, 0), Geom::Point3d.new(12.355.m, 61.387.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(12.355.m, 61.387.m, 0), Geom::Point3d.new(18.603.m, 61.332.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(4.486.m, 74.840.m, 0), Geom::Point3d.new(4.907.m, 61.450.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(20.481.m, 73.266.m, 0), Geom::Point3d.new(31.221.m, 72.706.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(31.223.m, 72.712.m, 0), Geom::Point3d.new(32.143.m, 60.532.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(22.060.m, 60.880.m, 0), Geom::Point3d.new(26.500.m, 60.726.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(26.500.m, 60.726.m, 0), Geom::Point3d.new(27.700.m, 60.684.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(27.700.m, 60.684.m, 0), Geom::Point3d.new(32.140.m, 60.530.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(20.481.m, 73.272.m, 0), Geom::Point3d.new(22.061.m, 60.882.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(39.772.m, 73.211.m, 0), Geom::Point3d.new(44.862.m, 73.291.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(44.863.m, 73.291.m, 0), Geom::Point3d.new(45.654.m, 73.304.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(45.654.m, 73.304.m, 0), Geom::Point3d.new(49.734.m, 73.371.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(49.730.m, 73.372.m, 0), Geom::Point3d.new(53.950.m, 73.072.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(53.947.m, 73.071.m, 0), Geom::Point3d.new(54.217.m, 59.201.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(40.121.m, 59.312.m, 0), Geom::Point3d.new(54.222.m, 59.202.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(39.768.m, 73.212.m, 0), Geom::Point3d.new(39.928.m, 66.860.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(39.928.m, 66.860.m, 0), Geom::Point3d.new(39.959.m, 65.660.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(39.959.m, 65.660.m, 0), Geom::Point3d.new(40.119.m, 59.312.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(0.123.m, 75.513.m, 0), Geom::Point3d.new(4.153.m, 75.393.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(4.151.m, 75.386.m, 0), Geom::Point3d.new(4.851.m, 70.486.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(0.879.m, 70.607.m, 0), Geom::Point3d.new(2.265.m, 70.565.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(2.265.m, 70.565.m, 0), Geom::Point3d.new(3.465.m, 70.528.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(3.465.m, 70.528.m, 0), Geom::Point3d.new(4.849.m, 70.487.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(0.118.m, 75.511.m, 0), Geom::Point3d.new(0.878.m, 70.611.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(45.021.m, 75.475.m, 0), Geom::Point3d.new(49.581.m, 75.555.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(49.575.m, 75.560.m, 0), Geom::Point3d.new(49.695.m, 72.280.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(45.072.m, 72.210.m, 0), Geom::Point3d.new(49.702.m, 72.280.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(45.020.m, 75.482.m, 0), Geom::Point3d.new(45.036.m, 74.445.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(45.036.m, 74.445.m, 0), Geom::Point3d.new(45.054.m, 73.245.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(45.054.m, 73.245.m, 0), Geom::Point3d.new(45.070.m, 72.212.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(30.768.m, 57.852.m, 0), Geom::Point3d.new(32.110.m, 57.873.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(32.110.m, 57.873.m, 0), Geom::Point3d.new(33.310.m, 57.891.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(33.310.m, 57.891.m, 0), Geom::Point3d.new(34.648.m, 57.912.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(34.500.m, 54.003.m, 0), Geom::Point3d.new(34.650.m, 57.913.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(30.669.m, 53.942.m, 0), Geom::Point3d.new(34.499.m, 54.002.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(30.673.m, 53.941.m, 0), Geom::Point3d.new(30.773.m, 57.851.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(32.391.m, 72.371.m, 0), Geom::Point3d.new(35.801.m, 72.241.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(35.800.m, 72.237.m, 0), Geom::Point3d.new(35.888.m, 70.794.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(35.888.m, 70.794.m, 0), Geom::Point3d.new(35.961.m, 69.596.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(35.961.m, 69.596.m, 0), Geom::Point3d.new(36.050.m, 68.147.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(32.583.m, 68.268.m, 0), Geom::Point3d.new(36.053.m, 68.148.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(32.388.m, 72.368.m, 0), Geom::Point3d.new(32.578.m, 68.268.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(30.049.m, 53.773.m, 0), Geom::Point3d.new(34.519.m, 53.843.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(34.333.m, 46.319.m, 0), Geom::Point3d.new(34.413.m, 49.480.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(34.413.m, 49.480.m, 0), Geom::Point3d.new(34.443.m, 50.680.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(34.443.m, 50.680.m, 0), Geom::Point3d.new(34.523.m, 53.840.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(29.948.m, 46.411.m, 0), Geom::Point3d.new(34.328.m, 46.322.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(29.951.m, 46.409.m, 0), Geom::Point3d.new(30.051.m, 53.769.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(29.988.m, 46.111.m, 0), Geom::Point3d.new(34.368.m, 46.022.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(34.178.m, 41.961.m, 0), Geom::Point3d.new(34.367.m, 46.021.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(29.740.m, 42.193.m, 0), Geom::Point3d.new(31.361.m, 42.109.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(31.361.m, 42.109.m, 0), Geom::Point3d.new(32.559.m, 42.047.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(32.559.m, 42.047.m, 0), Geom::Point3d.new(34.180.m, 41.963.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(29.738.m, 42.193.m, 0), Geom::Point3d.new(29.988.m, 46.113.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(38.932.m, 55.361.m, 0), Geom::Point3d.new(56.623.m, 54.980.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(56.622.m, 54.982.m, 0), Geom::Point3d.new(56.652.m, 51.035.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(56.652.m, 51.035.m, 0), Geom::Point3d.new(56.662.m, 49.835.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(56.662.m, 49.835.m, 0), Geom::Point3d.new(56.692.m, 45.891.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(39.449.m, 46.089.m, 0), Geom::Point3d.new(56.688.m, 45.889.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(38.929.m, 55.358.m, 0), Geom::Point3d.new(39.449.m, 46.088.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(53.274.m, 41.350.m, 0), Geom::Point3d.new(56.644.m, 41.250.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(56.641.m, 41.250.m, 0), Geom::Point3d.new(56.648.m, 39.890.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(56.648.m, 39.890.m, 0), Geom::Point3d.new(56.654.m, 38.690.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(56.654.m, 38.690.m, 0), Geom::Point3d.new(56.661.m, 37.330.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(53.327.m, 37.429.m, 0), Geom::Point3d.new(56.657.m, 37.329.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(53.272.m, 41.350.m, 0), Geom::Point3d.new(53.331.m, 37.430.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(25.898.m, 36.889.m, 0), Geom::Point3d.new(29.740.m, 36.820.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(29.740.m, 36.820.m, 0), Geom::Point3d.new(30.940.m, 36.799.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(30.940.m, 36.799.m, 0), Geom::Point3d.new(34.778.m, 36.730.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(34.770.m, 33.061.m, 0), Geom::Point3d.new(34.779.m, 36.731.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(26.029.m, 33.071.m, 0), Geom::Point3d.new(34.769.m, 33.062.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(25.900.m, 36.889.m, 0), Geom::Point3d.new(26.030.m, 33.069.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(51.477.m, 31.360.m, 0), Geom::Point3d.new(55.937.m, 31.010.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(55.920.m, 24.981.m, 0), Geom::Point3d.new(55.928.m, 27.395.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(55.928.m, 27.395.m, 0), Geom::Point3d.new(55.932.m, 28.595.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(55.932.m, 28.595.m, 0), Geom::Point3d.new(55.940.m, 31.011.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(51.660.m, 25.180.m, 0), Geom::Point3d.new(55.920.m, 24.980.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(51.481.m, 31.360.m, 0), Geom::Point3d.new(51.661.m, 25.180.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(27.921.m, 32.412.m, 0), Geom::Point3d.new(38.261.m, 32.142.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(38.260.m, 32.138.m, 0), Geom::Point3d.new(42.660.m, 24.528.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(42.659.m, 24.531.m, 0), Geom::Point3d.new(51.519.m, 24.521.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(51.521.m, 24.520.m, 0), Geom::Point3d.new(55.161.m, 23.400.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(55.162.m, 23.401.m, 0), Geom::Point3d.new(55.528.m, 17.809.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(55.528.m, 17.809.m, 0), Geom::Point3d.new(55.606.m, 16.611.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(55.606.m, 16.611.m, 0), Geom::Point3d.new(55.972.m, 11.021.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(27.560.m, 12.781.m, 0), Geom::Point3d.new(55.970.m, 11.022.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(27.559.m, 12.781.m, 0), Geom::Point3d.new(27.918.m, 32.410.m, 0), 0.15.m, 0, ALTO, m_muro)

gr = ents.add_group; gr.name = "Rutas (guía)"; gr.layer = capa.("Rutas")
gr.entities.add_curve([[11.755.m, 61.390.m, 0], [11.671.m, 59.191.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[27.100.m, 60.705.m, 0], [27.019.m, 58.601.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[39.945.m, 66.260.m, 0], [38.675.m, 66.149.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[2.865.m, 70.550.m, 0], [2.442.m, 59.546.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[45.045.m, 73.845.m, 0], [38.057.m, 73.235.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[32.710.m, 57.880.m, 0], [32.728.m, 58.391.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[35.925.m, 70.195.m, 0], [38.304.m, 70.403.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[34.425.m, 50.080.m, 0], [37.371.m, 50.430.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[31.960.m, 42.075.m, 0], [32.244.m, 39.066.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[56.655.m, 50.435.m, 0], [57.617.m, 50.371.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[56.650.m, 39.290.m, 0], [56.951.m, 39.305.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[30.340.m, 36.810.m, 0], [31.330.m, 38.980.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[55.930.m, 27.995.m, 0], [57.500.m, 28.072.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[55.565.m, 17.210.m, 0], [58.024.m, 17.330.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[2.070.m, 59.560.m, 0], [29.920.m, 58.490.m, 0], [36.440.m, 58.260.m, 0], [58.100.m, 57.610.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[36.440.m, 58.260.m, 0], [38.650.m, 39.670.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[31.330.m, 38.980.m, 0], [38.650.m, 39.670.m, 0], [56.920.m, 39.940.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[58.100.m, 57.610.m, 0], [56.920.m, 39.940.m, 0], [58.830.m, 0.830.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[38.030.m, 73.540.m, 0], [39.360.m, 58.310.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
t = ents.add_text("ASC-A", [34.270.m, 68.120.m, 1.m]); t.layer = capa.("Rótulos")
t = ents.add_text("ASC-B", [54.890.m, 39.910.m, 1.m]); t.layer = capa.("Rótulos")
t = ents.add_text("QR \u00b7 Entrada principal", [31.330.m, 38.980.m, 1.m]); t.layer = capa.("Rótulos")
t = ents.add_text("QR \u00b7 Entrada norte", [38.030.m, 73.540.m, 1.m]); t.layer = capa.("Rótulos")

model.commit_operation
Sketchup.active_model.active_view.zoom_extents
puts "Planta baja: 14 ambientes, 85 tramos de muro, 14 puertas"

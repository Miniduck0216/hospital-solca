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
f = g.entities.add_face([[0.000.m, 54.600.m, 0], [30.600.m, 54.600.m, 0], [30.600.m, 9.600.m, 0], [55.200.m, 9.600.m, 0], [55.200.m, 0.000.m, 0], [58.200.m, 0.000.m, 0], [58.200.m, 76.200.m, 0], [40.200.m, 76.200.m, 0], [40.200.m, 73.200.m, 0], [0.000.m, 73.200.m, 0]])
f.reverse! if f.normal.z > 0
f.pushpull(0.20.m)
g.entities.grep(Sketchup::Face).each { |x| x.material = mat.("Losa", "#C9CCCF") }

g = ents.add_group; g.name = "Ba\u00f1os hombres"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[0.000.m, 70.200.m, 0], [4.200.m, 70.200.m, 0], [4.200.m, 73.200.m, 0], [0.000.m, 73.200.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso banos", "#DDE2E8")
g.set_attribute("solca", "categoria", "banos")
t = ents.add_text("Ba\u00f1os hombres", [2.100.m, 71.700.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Consultorio 35"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[4.800.m, 70.200.m, 0], [18.000.m, 70.200.m, 0], [18.000.m, 73.200.m, 0], [4.800.m, 73.200.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso consulta", "#C9D8FB")
g.set_attribute("solca", "categoria", "consulta")
t = ents.add_text("Consultorio 35", [11.400.m, 71.700.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Pediatr\u00eda 03 - 33"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[4.800.m, 60.000.m, 0], [10.800.m, 60.000.m, 0], [10.800.m, 68.400.m, 0], [4.800.m, 68.400.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso consulta", "#C9D8FB")
g.set_attribute("solca", "categoria", "consulta")
t = ents.add_text("Pediatr\u00eda 03 - 33", [7.800.m, 64.200.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Medicina 04 - 26"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[12.600.m, 60.000.m, 0], [18.000.m, 60.000.m, 0], [18.000.m, 68.400.m, 0], [12.600.m, 68.400.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso consulta", "#C9D8FB")
g.set_attribute("solca", "categoria", "consulta")
t = ents.add_text("Medicina 04 - 26", [15.300.m, 64.200.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Secretar\u00eda - Control (Pediatr\u00eda y Medicina)"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[4.800.m, 57.000.m, 0], [18.000.m, 57.000.m, 0], [18.000.m, 60.000.m, 0], [4.800.m, 60.000.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso administracion", "#F1CFE0")
g.set_attribute("solca", "categoria", "administracion")
t = ents.add_text("Secretar\u00eda - Control (Pediatr\u00eda y Medicina)", [11.400.m, 58.500.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Endocrinolog\u00eda - 22"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[22.200.m, 69.600.m, 0], [31.200.m, 69.600.m, 0], [31.200.m, 73.200.m, 0], [22.200.m, 73.200.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso consulta", "#C9D8FB")
g.set_attribute("solca", "categoria", "consulta")
t = ents.add_text("Endocrinolog\u00eda - 22", [26.700.m, 71.400.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Ascensores norte"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[31.800.m, 69.600.m, 0], [34.800.m, 69.600.m, 0], [34.800.m, 73.200.m, 0], [31.800.m, 73.200.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso circulacion", "#D2D8DF")
g.set_attribute("solca", "categoria", "circulacion")
t = ents.add_text("Ascensores norte", [33.300.m, 71.400.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Traumatolog\u00eda - 20"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[22.200.m, 60.000.m, 0], [34.800.m, 60.000.m, 0], [34.800.m, 67.800.m, 0], [22.200.m, 67.800.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso consulta", "#C9D8FB")
g.set_attribute("solca", "categoria", "consulta")
t = ents.add_text("Traumatolog\u00eda - 20", [28.500.m, 63.900.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Secretar\u00eda - Control (Endocrinolog\u00eda y Traumatolog\u00eda)"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[22.200.m, 57.000.m, 0], [34.800.m, 57.000.m, 0], [34.800.m, 60.000.m, 0], [22.200.m, 60.000.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso administracion", "#F1CFE0")
g.set_attribute("solca", "categoria", "administracion")
t = ents.add_text("Secretar\u00eda - Control (Endocrinolog\u00eda y Traumatolog\u00eda)", [28.500.m, 58.500.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Ba\u00f1os mujeres"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[43.200.m, 73.500.m, 0], [47.400.m, 73.500.m, 0], [47.400.m, 76.200.m, 0], [43.200.m, 76.200.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso banos", "#DDE2E8")
g.set_attribute("solca", "categoria", "banos")
t = ents.add_text("Ba\u00f1os mujeres", [45.300.m, 74.850.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Consultorio 2"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[40.200.m, 70.200.m, 0], [55.200.m, 70.200.m, 0], [55.200.m, 73.200.m, 0], [40.200.m, 73.200.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso consulta", "#C9D8FB")
g.set_attribute("solca", "categoria", "consulta")
t = ents.add_text("Consultorio 2", [47.700.m, 71.700.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Gastroenterolog\u00eda - 12"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[40.200.m, 60.000.m, 0], [55.200.m, 60.000.m, 0], [55.200.m, 68.400.m, 0], [40.200.m, 68.400.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso consulta", "#C9D8FB")
g.set_attribute("solca", "categoria", "consulta")
t = ents.add_text("Gastroenterolog\u00eda - 12", [47.700.m, 64.200.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Secretar\u00eda - Control (Gastroenterolog\u00eda)"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[40.200.m, 57.000.m, 0], [55.200.m, 57.000.m, 0], [55.200.m, 60.000.m, 0], [40.200.m, 60.000.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso administracion", "#F1CFE0")
g.set_attribute("solca", "categoria", "administracion")
t = ents.add_text("Secretar\u00eda - Control (Gastroenterolog\u00eda)", [47.700.m, 58.500.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Ba\u00f1o accesible"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[30.600.m, 48.000.m, 0], [35.400.m, 48.000.m, 0], [35.400.m, 54.000.m, 0], [30.600.m, 54.000.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso banos", "#DDE2E8")
g.set_attribute("solca", "categoria", "banos")
t = ents.add_text("Ba\u00f1o accesible", [33.000.m, 51.000.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Capilla"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[30.600.m, 42.600.m, 0], [35.400.m, 42.600.m, 0], [35.400.m, 47.400.m, 0], [30.600.m, 47.400.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso servicios", "#DDE2E8")
g.set_attribute("solca", "categoria", "servicios")
t = ents.add_text("Capilla", [33.000.m, 45.000.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "RPIS"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[30.600.m, 37.800.m, 0], [35.400.m, 37.800.m, 0], [35.400.m, 42.000.m, 0], [30.600.m, 42.000.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso administracion", "#F1CFE0")
g.set_attribute("solca", "categoria", "administracion")
t = ents.add_text("RPIS", [33.000.m, 39.900.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Farmacia"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[39.600.m, 42.600.m, 0], [55.200.m, 42.600.m, 0], [55.200.m, 52.200.m, 0], [39.600.m, 52.200.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso servicios", "#DDE2E8")
g.set_attribute("solca", "categoria", "servicios")
t = ents.add_text("Farmacia", [47.400.m, 47.400.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Ascensores sur"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[52.200.m, 32.400.m, 0], [55.200.m, 32.400.m, 0], [55.200.m, 37.200.m, 0], [52.200.m, 37.200.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso circulacion", "#D2D8DF")
g.set_attribute("solca", "categoria", "circulacion")
t = ents.add_text("Ascensores sur", [53.700.m, 34.800.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Farmacias Econ\u00f3micas"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[30.600.m, 28.800.m, 0], [39.600.m, 28.800.m, 0], [39.600.m, 33.600.m, 0], [30.600.m, 33.600.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso servicios", "#DDE2E8")
g.set_attribute("solca", "categoria", "servicios")
t = ents.add_text("Farmacias Econ\u00f3micas", [35.100.m, 31.200.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Cajas"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[52.200.m, 22.800.m, 0], [55.200.m, 22.800.m, 0], [55.200.m, 28.800.m, 0], [52.200.m, 28.800.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso administracion", "#F1CFE0")
g.set_attribute("solca", "categoria", "administracion")
t = ents.add_text("Cajas", [53.700.m, 25.800.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Direcci\u00f3n"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[30.600.m, 9.600.m, 0], [55.200.m, 9.600.m, 0], [55.200.m, 22.200.m, 0], [42.000.m, 22.200.m, 0], [42.000.m, 28.200.m, 0], [30.600.m, 28.200.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso administracion", "#F1CFE0")
g.set_attribute("solca", "categoria", "administracion")
t = ents.add_text("Direcci\u00f3n", [42.600.m, 20.000.m, 0.05.m]); t.layer = capa.("Rótulos")

gm = ents.add_group; gm.name = "Muros"; gm.layer = capa.("Muros")
me = gm.entities
caja = ->(a, b, e, z0, z1, m) {
  v = Geom::Vector3d.new(b[0] - a[0], b[1] - a[1], 0); return if v.length < 0.01
  n = Geom::Vector3d.new(-v.y, v.x, 0); n.length = e / 2.0
  q = [a.offset(n), b.offset(n), b.offset(n.reverse), a.offset(n.reverse)].map { |p| [p.x, p.y, z0] }
  f = me.add_face(q); f.reverse! if f.normal.z < 0; f.pushpull(z1 - z0)
  me.grep(Sketchup::Face).each { |x| x.material ||= m } }
m_muro = mat.("Pintura muros", "#F3F1EC"); m_ext = mat.("Fachada", "#E6E1D8")
caja.(Geom::Point3d.new(0.000.m, 54.600.m, 0), Geom::Point3d.new(30.600.m, 54.600.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(30.600.m, 9.600.m, 0), Geom::Point3d.new(30.600.m, 34.200.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(30.600.m, 34.200.m, 0), Geom::Point3d.new(30.600.m, 36.600.m, 0), 0.25.m, ALTO_DINTEL, ALTO, m_ext)  # dintel sobre puerta
caja.(Geom::Point3d.new(30.600.m, 36.600.m, 0), Geom::Point3d.new(30.600.m, 54.600.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(30.600.m, 9.600.m, 0), Geom::Point3d.new(55.200.m, 9.600.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(55.200.m, 0.000.m, 0), Geom::Point3d.new(55.200.m, 15.300.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(55.200.m, 15.300.m, 0), Geom::Point3d.new(55.200.m, 16.500.m, 0), 0.25.m, ALTO_DINTEL, ALTO, m_ext)  # dintel sobre puerta
caja.(Geom::Point3d.new(55.200.m, 16.500.m, 0), Geom::Point3d.new(55.200.m, 22.200.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(55.200.m, 22.800.m, 0), Geom::Point3d.new(55.200.m, 28.800.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(55.200.m, 32.400.m, 0), Geom::Point3d.new(55.200.m, 34.200.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(55.200.m, 34.200.m, 0), Geom::Point3d.new(55.200.m, 35.400.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(55.200.m, 35.400.m, 0), Geom::Point3d.new(55.200.m, 37.200.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(55.200.m, 42.600.m, 0), Geom::Point3d.new(55.200.m, 46.800.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(55.200.m, 46.800.m, 0), Geom::Point3d.new(55.200.m, 48.000.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(55.200.m, 48.000.m, 0), Geom::Point3d.new(55.200.m, 52.200.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(55.200.m, 57.000.m, 0), Geom::Point3d.new(55.200.m, 68.400.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(55.200.m, 70.200.m, 0), Geom::Point3d.new(55.200.m, 73.200.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(55.200.m, 0.000.m, 0), Geom::Point3d.new(58.200.m, 0.000.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(58.200.m, 0.000.m, 0), Geom::Point3d.new(58.200.m, 76.200.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(40.200.m, 76.200.m, 0), Geom::Point3d.new(58.200.m, 76.200.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(40.200.m, 57.000.m, 0), Geom::Point3d.new(40.200.m, 68.400.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(40.200.m, 70.200.m, 0), Geom::Point3d.new(40.200.m, 76.200.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(0.000.m, 73.200.m, 0), Geom::Point3d.new(36.600.m, 73.200.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(36.600.m, 73.200.m, 0), Geom::Point3d.new(39.000.m, 73.200.m, 0), 0.25.m, ALTO_DINTEL, ALTO, m_ext)  # dintel sobre puerta
caja.(Geom::Point3d.new(39.000.m, 73.200.m, 0), Geom::Point3d.new(44.700.m, 73.200.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(44.700.m, 73.200.m, 0), Geom::Point3d.new(45.900.m, 73.200.m, 0), 0.25.m, ALTO_DINTEL, ALTO, m_ext)  # dintel sobre puerta
caja.(Geom::Point3d.new(45.900.m, 73.200.m, 0), Geom::Point3d.new(55.200.m, 73.200.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(0.000.m, 54.600.m, 0), Geom::Point3d.new(0.000.m, 73.200.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(0.000.m, 70.200.m, 0), Geom::Point3d.new(1.500.m, 70.200.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(1.500.m, 70.200.m, 0), Geom::Point3d.new(2.700.m, 70.200.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(2.700.m, 70.200.m, 0), Geom::Point3d.new(4.200.m, 70.200.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(4.800.m, 70.200.m, 0), Geom::Point3d.new(10.800.m, 70.200.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(10.800.m, 70.200.m, 0), Geom::Point3d.new(12.000.m, 70.200.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(12.000.m, 70.200.m, 0), Geom::Point3d.new(18.000.m, 70.200.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(40.200.m, 70.200.m, 0), Geom::Point3d.new(47.100.m, 70.200.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(47.100.m, 70.200.m, 0), Geom::Point3d.new(48.300.m, 70.200.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(48.300.m, 70.200.m, 0), Geom::Point3d.new(55.200.m, 70.200.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(4.200.m, 70.200.m, 0), Geom::Point3d.new(4.200.m, 73.200.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(18.000.m, 57.000.m, 0), Geom::Point3d.new(18.000.m, 68.400.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(18.000.m, 70.200.m, 0), Geom::Point3d.new(18.000.m, 73.200.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(4.800.m, 57.000.m, 0), Geom::Point3d.new(4.800.m, 68.400.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(4.800.m, 70.200.m, 0), Geom::Point3d.new(4.800.m, 73.200.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(4.800.m, 60.000.m, 0), Geom::Point3d.new(18.000.m, 60.000.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(22.200.m, 60.000.m, 0), Geom::Point3d.new(34.800.m, 60.000.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(40.200.m, 60.000.m, 0), Geom::Point3d.new(55.200.m, 60.000.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(10.800.m, 60.000.m, 0), Geom::Point3d.new(10.800.m, 68.400.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(4.800.m, 68.400.m, 0), Geom::Point3d.new(7.200.m, 68.400.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(7.200.m, 68.400.m, 0), Geom::Point3d.new(8.400.m, 68.400.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(8.400.m, 68.400.m, 0), Geom::Point3d.new(10.800.m, 68.400.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(12.600.m, 68.400.m, 0), Geom::Point3d.new(14.700.m, 68.400.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(14.700.m, 68.400.m, 0), Geom::Point3d.new(15.900.m, 68.400.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(15.900.m, 68.400.m, 0), Geom::Point3d.new(18.000.m, 68.400.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(40.200.m, 68.400.m, 0), Geom::Point3d.new(47.100.m, 68.400.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(47.100.m, 68.400.m, 0), Geom::Point3d.new(48.300.m, 68.400.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(48.300.m, 68.400.m, 0), Geom::Point3d.new(55.200.m, 68.400.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(12.600.m, 60.000.m, 0), Geom::Point3d.new(12.600.m, 68.400.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(4.800.m, 57.000.m, 0), Geom::Point3d.new(10.800.m, 57.000.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(10.800.m, 57.000.m, 0), Geom::Point3d.new(12.000.m, 57.000.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(12.000.m, 57.000.m, 0), Geom::Point3d.new(18.000.m, 57.000.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(22.200.m, 57.000.m, 0), Geom::Point3d.new(27.900.m, 57.000.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(27.900.m, 57.000.m, 0), Geom::Point3d.new(29.100.m, 57.000.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(29.100.m, 57.000.m, 0), Geom::Point3d.new(34.800.m, 57.000.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(40.200.m, 57.000.m, 0), Geom::Point3d.new(47.100.m, 57.000.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(47.100.m, 57.000.m, 0), Geom::Point3d.new(48.300.m, 57.000.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(48.300.m, 57.000.m, 0), Geom::Point3d.new(55.200.m, 57.000.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(22.200.m, 69.600.m, 0), Geom::Point3d.new(26.100.m, 69.600.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(26.100.m, 69.600.m, 0), Geom::Point3d.new(27.300.m, 69.600.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(27.300.m, 69.600.m, 0), Geom::Point3d.new(31.200.m, 69.600.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(31.800.m, 69.600.m, 0), Geom::Point3d.new(32.700.m, 69.600.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(32.700.m, 69.600.m, 0), Geom::Point3d.new(33.900.m, 69.600.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(33.900.m, 69.600.m, 0), Geom::Point3d.new(34.800.m, 69.600.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(31.200.m, 69.600.m, 0), Geom::Point3d.new(31.200.m, 73.200.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(22.200.m, 57.000.m, 0), Geom::Point3d.new(22.200.m, 67.800.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(22.200.m, 69.600.m, 0), Geom::Point3d.new(22.200.m, 73.200.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(34.800.m, 57.000.m, 0), Geom::Point3d.new(34.800.m, 67.800.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(34.800.m, 69.600.m, 0), Geom::Point3d.new(34.800.m, 73.200.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(31.800.m, 69.600.m, 0), Geom::Point3d.new(31.800.m, 73.200.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(22.200.m, 67.800.m, 0), Geom::Point3d.new(27.900.m, 67.800.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(27.900.m, 67.800.m, 0), Geom::Point3d.new(29.100.m, 67.800.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(29.100.m, 67.800.m, 0), Geom::Point3d.new(34.800.m, 67.800.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(43.200.m, 73.500.m, 0), Geom::Point3d.new(44.700.m, 73.500.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(44.700.m, 73.500.m, 0), Geom::Point3d.new(45.900.m, 73.500.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(45.900.m, 73.500.m, 0), Geom::Point3d.new(47.400.m, 73.500.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(47.400.m, 73.500.m, 0), Geom::Point3d.new(47.400.m, 76.200.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(43.200.m, 73.500.m, 0), Geom::Point3d.new(43.200.m, 76.200.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(30.600.m, 48.000.m, 0), Geom::Point3d.new(35.400.m, 48.000.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(35.400.m, 37.800.m, 0), Geom::Point3d.new(35.400.m, 39.300.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(35.400.m, 39.300.m, 0), Geom::Point3d.new(35.400.m, 40.500.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(35.400.m, 40.500.m, 0), Geom::Point3d.new(35.400.m, 42.000.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(35.400.m, 42.600.m, 0), Geom::Point3d.new(35.400.m, 44.400.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(35.400.m, 44.400.m, 0), Geom::Point3d.new(35.400.m, 45.600.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(35.400.m, 45.600.m, 0), Geom::Point3d.new(35.400.m, 47.400.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(35.400.m, 48.000.m, 0), Geom::Point3d.new(35.400.m, 54.000.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(30.600.m, 54.000.m, 0), Geom::Point3d.new(32.400.m, 54.000.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(32.400.m, 54.000.m, 0), Geom::Point3d.new(33.600.m, 54.000.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(33.600.m, 54.000.m, 0), Geom::Point3d.new(35.400.m, 54.000.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(30.600.m, 42.600.m, 0), Geom::Point3d.new(35.400.m, 42.600.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(39.600.m, 42.600.m, 0), Geom::Point3d.new(55.200.m, 42.600.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(30.600.m, 47.400.m, 0), Geom::Point3d.new(35.400.m, 47.400.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(30.600.m, 37.800.m, 0), Geom::Point3d.new(35.400.m, 37.800.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(30.600.m, 42.000.m, 0), Geom::Point3d.new(35.400.m, 42.000.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(39.600.m, 52.200.m, 0), Geom::Point3d.new(55.200.m, 52.200.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(39.600.m, 28.800.m, 0), Geom::Point3d.new(39.600.m, 33.600.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(39.600.m, 42.600.m, 0), Geom::Point3d.new(39.600.m, 52.200.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(52.200.m, 32.400.m, 0), Geom::Point3d.new(55.200.m, 32.400.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(52.200.m, 37.200.m, 0), Geom::Point3d.new(55.200.m, 37.200.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(52.200.m, 22.800.m, 0), Geom::Point3d.new(52.200.m, 25.200.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(52.200.m, 25.200.m, 0), Geom::Point3d.new(52.200.m, 26.400.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(52.200.m, 26.400.m, 0), Geom::Point3d.new(52.200.m, 28.800.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(52.200.m, 32.400.m, 0), Geom::Point3d.new(52.200.m, 37.200.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(30.600.m, 28.800.m, 0), Geom::Point3d.new(39.600.m, 28.800.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(52.200.m, 28.800.m, 0), Geom::Point3d.new(55.200.m, 28.800.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(30.600.m, 33.600.m, 0), Geom::Point3d.new(34.500.m, 33.600.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(34.500.m, 33.600.m, 0), Geom::Point3d.new(35.700.m, 33.600.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(35.700.m, 33.600.m, 0), Geom::Point3d.new(39.600.m, 33.600.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(52.200.m, 22.800.m, 0), Geom::Point3d.new(55.200.m, 22.800.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(42.000.m, 22.200.m, 0), Geom::Point3d.new(55.200.m, 22.200.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(42.000.m, 22.200.m, 0), Geom::Point3d.new(42.000.m, 28.200.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(30.600.m, 28.200.m, 0), Geom::Point3d.new(42.000.m, 28.200.m, 0), 0.15.m, 0, ALTO, m_muro)

gr = ents.add_group; gr.name = "Rutas (guía)"; gr.layer = capa.("Rutas")
gr.entities.add_curve([[2.100.m, 70.200.m, 0], [2.200.m, 69.300.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[11.400.m, 70.200.m, 0], [11.400.m, 69.300.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[7.800.m, 68.400.m, 0], [7.800.m, 69.300.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[15.300.m, 68.400.m, 0], [15.300.m, 69.300.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[11.400.m, 57.000.m, 0], [11.700.m, 57.000.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[26.700.m, 69.600.m, 0], [26.700.m, 68.700.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[33.300.m, 69.600.m, 0], [33.300.m, 68.700.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[28.500.m, 67.800.m, 0], [28.500.m, 68.700.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[28.500.m, 57.000.m, 0], [28.500.m, 55.800.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[45.300.m, 73.500.m, 0], [45.300.m, 69.300.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[47.700.m, 70.200.m, 0], [47.700.m, 69.300.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[47.700.m, 68.400.m, 0], [47.700.m, 69.300.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[47.700.m, 57.000.m, 0], [47.700.m, 55.800.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[33.000.m, 54.000.m, 0], [33.000.m, 55.800.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[35.400.m, 45.000.m, 0], [37.500.m, 45.000.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[35.400.m, 39.900.m, 0], [37.500.m, 39.900.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[55.200.m, 47.400.m, 0], [56.700.m, 47.400.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[55.200.m, 34.800.m, 0], [55.200.m, 35.400.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[35.100.m, 33.600.m, 0], [35.100.m, 35.400.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[52.200.m, 25.800.m, 0], [52.200.m, 25.500.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[55.200.m, 15.900.m, 0], [56.700.m, 15.900.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[1.000.m, 55.800.m, 0], [56.700.m, 55.800.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[56.700.m, 0.600.m, 0], [56.700.m, 75.000.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[2.200.m, 69.300.m, 0], [20.100.m, 69.300.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[11.700.m, 55.800.m, 0], [11.700.m, 69.300.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[20.100.m, 55.800.m, 0], [20.100.m, 69.300.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[20.100.m, 68.700.m, 0], [37.800.m, 68.700.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[37.800.m, 55.800.m, 0], [37.800.m, 73.200.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[37.800.m, 69.300.m, 0], [56.700.m, 69.300.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[37.500.m, 55.800.m, 0], [37.500.m, 35.400.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[30.600.m, 35.400.m, 0], [56.700.m, 35.400.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[47.400.m, 35.400.m, 0], [47.400.m, 25.500.m, 0], [52.200.m, 25.500.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
t = ents.add_text("ASC-A", [33.300.m, 69.300.m, 1.m]); t.layer = capa.("Rótulos")
t = ents.add_text("ASC-B", [55.200.m, 35.400.m, 1.m]); t.layer = capa.("Rótulos")
t = ents.add_text("QR \u00b7 Entrada principal", [30.600.m, 35.400.m, 1.m]); t.layer = capa.("Rótulos")
t = ents.add_text("QR \u00b7 Entrada norte", [37.800.m, 73.200.m, 1.m]); t.layer = capa.("Rótulos")

model.commit_operation
Sketchup.active_model.active_view.zoom_extents
puts "Planta baja: 21 ambientes, 95 tramos de muro, 21 puertas"

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
f = g.entities.add_face([[0.000.m, 54.600.m, 0], [30.600.m, 54.600.m, 0], [30.600.m, 9.600.m, 0], [37.200.m, 9.600.m, 0], [37.200.m, 8.400.m, 0], [51.600.m, 8.400.m, 0], [51.600.m, 9.600.m, 0], [54.000.m, 9.600.m, 0], [54.000.m, 0.000.m, 0], [58.200.m, 0.000.m, 0], [58.200.m, 76.200.m, 0], [43.800.m, 76.200.m, 0], [43.800.m, 72.600.m, 0], [10.200.m, 72.600.m, 0], [10.200.m, 71.400.m, 0], [0.000.m, 71.400.m, 0]])
f.reverse! if f.normal.z > 0
f.pushpull(0.20.m)
g.entities.grep(Sketchup::Face).each { |x| x.material = mat.("Losa", "#C9CCCF") }

g = ents.add_group; g.name = "Ba\u00f1os hombres"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[0.000.m, 67.800.m, 0], [4.200.m, 67.800.m, 0], [4.200.m, 71.400.m, 0], [0.000.m, 71.400.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso banos", "#DDE2E8")
g.set_attribute("solca", "categoria", "banos")
t = ents.add_text("Ba\u00f1os hombres", [2.100.m, 69.600.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Recreaci\u00f3n Infantil"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[4.200.m, 69.000.m, 0], [8.400.m, 69.000.m, 0], [8.400.m, 71.400.m, 0], [4.200.m, 71.400.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso servicios", "#DDE2E8")
g.set_attribute("solca", "categoria", "servicios")
t = ents.add_text("Recreaci\u00f3n Infantil", [6.300.m, 70.200.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Consultorio 35"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[11.400.m, 69.000.m, 0], [14.400.m, 69.000.m, 0], [14.400.m, 71.400.m, 0], [11.400.m, 71.400.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso consulta", "#C9D8FB")
g.set_attribute("solca", "categoria", "consulta")
t = ents.add_text("Consultorio 35", [12.900.m, 70.200.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Pediatr\u00eda 04 - 34"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[4.800.m, 66.600.m, 0], [9.000.m, 66.600.m, 0], [9.000.m, 69.000.m, 0], [4.800.m, 69.000.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso consulta", "#C9D8FB")
g.set_attribute("solca", "categoria", "consulta")
t = ents.add_text("Pediatr\u00eda 04 - 34", [6.900.m, 67.800.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Pediatr\u00eda 03 - 33"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[4.800.m, 64.200.m, 0], [9.000.m, 64.200.m, 0], [9.000.m, 66.600.m, 0], [4.800.m, 66.600.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso consulta", "#C9D8FB")
g.set_attribute("solca", "categoria", "consulta")
t = ents.add_text("Pediatr\u00eda 03 - 33", [6.900.m, 65.400.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Preparaci\u00f3n - 32"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[4.800.m, 61.800.m, 0], [9.000.m, 61.800.m, 0], [9.000.m, 64.200.m, 0], [4.800.m, 64.200.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso tratamiento", "#F8DFB8")
g.set_attribute("solca", "categoria", "tratamiento")
t = ents.add_text("Preparaci\u00f3n - 32", [6.900.m, 63.000.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Pediatr\u00eda 02 - 31"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[4.800.m, 59.400.m, 0], [9.000.m, 59.400.m, 0], [9.000.m, 61.800.m, 0], [4.800.m, 61.800.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso consulta", "#C9D8FB")
g.set_attribute("solca", "categoria", "consulta")
t = ents.add_text("Pediatr\u00eda 02 - 31", [6.900.m, 60.600.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Pediatr\u00eda 01 - 30"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[4.800.m, 57.000.m, 0], [9.000.m, 57.000.m, 0], [9.000.m, 59.400.m, 0], [4.800.m, 59.400.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso consulta", "#C9D8FB")
g.set_attribute("solca", "categoria", "consulta")
t = ents.add_text("Pediatr\u00eda 01 - 30", [6.900.m, 58.200.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Diet\u00e9tica - 25"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[12.600.m, 66.600.m, 0], [17.400.m, 66.600.m, 0], [17.400.m, 69.000.m, 0], [12.600.m, 69.000.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso consulta", "#C9D8FB")
g.set_attribute("solca", "categoria", "consulta")
t = ents.add_text("Diet\u00e9tica - 25", [15.000.m, 67.800.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Medicina 04 - 26"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[12.600.m, 64.200.m, 0], [17.400.m, 64.200.m, 0], [17.400.m, 66.600.m, 0], [12.600.m, 66.600.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso consulta", "#C9D8FB")
g.set_attribute("solca", "categoria", "consulta")
t = ents.add_text("Medicina 04 - 26", [15.000.m, 65.400.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Medicina 03 - 27"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[12.600.m, 61.800.m, 0], [17.400.m, 61.800.m, 0], [17.400.m, 64.200.m, 0], [12.600.m, 64.200.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso consulta", "#C9D8FB")
g.set_attribute("solca", "categoria", "consulta")
t = ents.add_text("Medicina 03 - 27", [15.000.m, 63.000.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Medicina 02 - 28"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[12.600.m, 59.400.m, 0], [17.400.m, 59.400.m, 0], [17.400.m, 61.800.m, 0], [12.600.m, 61.800.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso consulta", "#C9D8FB")
g.set_attribute("solca", "categoria", "consulta")
t = ents.add_text("Medicina 02 - 28", [15.000.m, 60.600.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Medicina 01 - 29"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[12.600.m, 57.000.m, 0], [17.400.m, 57.000.m, 0], [17.400.m, 59.400.m, 0], [12.600.m, 59.400.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso consulta", "#C9D8FB")
g.set_attribute("solca", "categoria", "consulta")
t = ents.add_text("Medicina 01 - 29", [15.000.m, 58.200.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Endocrinolog\u00eda - 22"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[22.200.m, 66.600.m, 0], [27.000.m, 66.600.m, 0], [27.000.m, 69.000.m, 0], [22.200.m, 69.000.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso consulta", "#C9D8FB")
g.set_attribute("solca", "categoria", "consulta")
t = ents.add_text("Endocrinolog\u00eda - 22", [24.600.m, 67.800.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Neumolog\u00eda - 21"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[22.200.m, 64.200.m, 0], [27.000.m, 64.200.m, 0], [27.000.m, 66.600.m, 0], [22.200.m, 66.600.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso consulta", "#C9D8FB")
g.set_attribute("solca", "categoria", "consulta")
t = ents.add_text("Neumolog\u00eda - 21", [24.600.m, 65.400.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Traumatolog\u00eda - 20"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[22.200.m, 61.800.m, 0], [27.000.m, 61.800.m, 0], [27.000.m, 64.200.m, 0], [22.200.m, 64.200.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso consulta", "#C9D8FB")
g.set_attribute("solca", "categoria", "consulta")
t = ents.add_text("Traumatolog\u00eda - 20", [24.600.m, 63.000.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Neurocirug\u00eda - 19"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[22.200.m, 59.400.m, 0], [27.000.m, 59.400.m, 0], [27.000.m, 61.800.m, 0], [22.200.m, 61.800.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso consulta", "#C9D8FB")
g.set_attribute("solca", "categoria", "consulta")
t = ents.add_text("Neurocirug\u00eda - 19", [24.600.m, 60.600.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Consultorio (sin r\u00f3tulo)"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[22.200.m, 57.000.m, 0], [27.000.m, 57.000.m, 0], [27.000.m, 59.400.m, 0], [22.200.m, 59.400.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso consulta", "#C9D8FB")
g.set_attribute("solca", "categoria", "consulta")
t = ents.add_text("Consultorio (sin r\u00f3tulo)", [24.600.m, 58.200.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Ascensores y escaleras norte"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[30.600.m, 66.600.m, 0], [35.400.m, 66.600.m, 0], [35.400.m, 71.400.m, 0], [30.600.m, 71.400.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso circulacion", "#D2D8DF")
g.set_attribute("solca", "categoria", "circulacion")
t = ents.add_text("Ascensores y escaleras norte", [33.000.m, 69.000.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Tumores Mamarios - 14"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[30.600.m, 64.200.m, 0], [35.400.m, 64.200.m, 0], [35.400.m, 66.600.m, 0], [30.600.m, 66.600.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso consulta", "#C9D8FB")
g.set_attribute("solca", "categoria", "consulta")
t = ents.add_text("Tumores Mamarios - 14", [33.000.m, 65.400.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Tumores Mixtos - 15"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[30.600.m, 61.800.m, 0], [35.400.m, 61.800.m, 0], [35.400.m, 64.200.m, 0], [30.600.m, 64.200.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso consulta", "#C9D8FB")
g.set_attribute("solca", "categoria", "consulta")
t = ents.add_text("Tumores Mixtos - 15", [33.000.m, 63.000.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Tumores de Cabeza y Cuello - 16"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[30.600.m, 59.400.m, 0], [35.400.m, 59.400.m, 0], [35.400.m, 61.800.m, 0], [30.600.m, 61.800.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso consulta", "#C9D8FB")
g.set_attribute("solca", "categoria", "consulta")
t = ents.add_text("Tumores de Cabeza y Cuello - 16", [33.000.m, 60.600.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Consultorio (sin r\u00f3tulo)"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[30.600.m, 57.000.m, 0], [35.400.m, 57.000.m, 0], [35.400.m, 59.400.m, 0], [30.600.m, 59.400.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso consulta", "#C9D8FB")
g.set_attribute("solca", "categoria", "consulta")
t = ents.add_text("Consultorio (sin r\u00f3tulo)", [33.000.m, 58.200.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Consultorio 1"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[39.600.m, 69.000.m, 0], [43.200.m, 69.000.m, 0], [43.200.m, 72.600.m, 0], [39.600.m, 72.600.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso consulta", "#C9D8FB")
g.set_attribute("solca", "categoria", "consulta")
t = ents.add_text("Consultorio 1", [41.400.m, 70.800.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Consultorio (sin r\u00f3tulo)"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[43.200.m, 69.000.m, 0], [46.800.m, 69.000.m, 0], [46.800.m, 72.600.m, 0], [43.200.m, 72.600.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso consulta", "#C9D8FB")
g.set_attribute("solca", "categoria", "consulta")
t = ents.add_text("Consultorio (sin r\u00f3tulo)", [45.000.m, 70.800.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Ba\u00f1os mujeres"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[43.800.m, 72.600.m, 0], [49.200.m, 72.600.m, 0], [49.200.m, 76.200.m, 0], [43.800.m, 76.200.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso banos", "#DDE2E8")
g.set_attribute("solca", "categoria", "banos")
t = ents.add_text("Ba\u00f1os mujeres", [46.500.m, 74.400.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Coordinaci\u00f3n Enfermer\u00eda - 1"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[39.600.m, 66.600.m, 0], [45.000.m, 66.600.m, 0], [45.000.m, 69.000.m, 0], [39.600.m, 69.000.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso administracion", "#F1CFE0")
g.set_attribute("solca", "categoria", "administracion")
t = ents.add_text("Coordinaci\u00f3n Enfermer\u00eda - 1", [42.300.m, 67.800.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Gastroenterolog\u00eda - 12"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[39.600.m, 64.200.m, 0], [45.000.m, 64.200.m, 0], [45.000.m, 66.600.m, 0], [39.600.m, 66.600.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso consulta", "#C9D8FB")
g.set_attribute("solca", "categoria", "consulta")
t = ents.add_text("Gastroenterolog\u00eda - 12", [42.300.m, 65.400.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Preconsulta - 11"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[39.600.m, 61.800.m, 0], [45.000.m, 61.800.m, 0], [45.000.m, 64.200.m, 0], [39.600.m, 64.200.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso consulta", "#C9D8FB")
g.set_attribute("solca", "categoria", "consulta")
t = ents.add_text("Preconsulta - 11", [42.300.m, 63.000.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Preconsulta - 10"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[39.600.m, 59.400.m, 0], [45.000.m, 59.400.m, 0], [45.000.m, 61.800.m, 0], [39.600.m, 61.800.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso consulta", "#C9D8FB")
g.set_attribute("solca", "categoria", "consulta")
t = ents.add_text("Preconsulta - 10", [42.300.m, 60.600.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Preconsulta - 9"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[39.600.m, 57.000.m, 0], [45.000.m, 57.000.m, 0], [45.000.m, 59.400.m, 0], [39.600.m, 59.400.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso consulta", "#C9D8FB")
g.set_attribute("solca", "categoria", "consulta")
t = ents.add_text("Preconsulta - 9", [42.300.m, 58.200.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Consultorio (sin r\u00f3tulo)"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[48.600.m, 69.000.m, 0], [54.000.m, 69.000.m, 0], [54.000.m, 72.600.m, 0], [48.600.m, 72.600.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso consulta", "#C9D8FB")
g.set_attribute("solca", "categoria", "consulta")
t = ents.add_text("Consultorio (sin r\u00f3tulo)", [51.300.m, 70.800.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Ginecolog\u00eda - 4"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[48.600.m, 66.600.m, 0], [54.000.m, 66.600.m, 0], [54.000.m, 69.000.m, 0], [48.600.m, 69.000.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso consulta", "#C9D8FB")
g.set_attribute("solca", "categoria", "consulta")
t = ents.add_text("Ginecolog\u00eda - 4", [51.300.m, 67.800.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Ginecolog\u00eda - 5"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[48.600.m, 64.200.m, 0], [54.000.m, 64.200.m, 0], [54.000.m, 66.600.m, 0], [48.600.m, 66.600.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso consulta", "#C9D8FB")
g.set_attribute("solca", "categoria", "consulta")
t = ents.add_text("Ginecolog\u00eda - 5", [51.300.m, 65.400.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Colposcopia - 6"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[48.600.m, 61.800.m, 0], [54.000.m, 61.800.m, 0], [54.000.m, 64.200.m, 0], [48.600.m, 64.200.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso consulta", "#C9D8FB")
g.set_attribute("solca", "categoria", "consulta")
t = ents.add_text("Colposcopia - 6", [51.300.m, 63.000.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Colposcopia - 7"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[48.600.m, 59.400.m, 0], [54.000.m, 59.400.m, 0], [54.000.m, 61.800.m, 0], [48.600.m, 61.800.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso consulta", "#C9D8FB")
g.set_attribute("solca", "categoria", "consulta")
t = ents.add_text("Colposcopia - 7", [51.300.m, 60.600.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Urolog\u00eda"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[48.600.m, 57.000.m, 0], [54.000.m, 57.000.m, 0], [54.000.m, 59.400.m, 0], [48.600.m, 59.400.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso consulta", "#C9D8FB")
g.set_attribute("solca", "categoria", "consulta")
t = ents.add_text("Urolog\u00eda", [51.300.m, 58.200.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Secretar\u00eda - Control (Pediatr\u00eda y Medicina)"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[9.000.m, 57.000.m, 0], [11.400.m, 57.000.m, 0], [11.400.m, 58.800.m, 0], [9.000.m, 58.800.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso administracion", "#F1CFE0")
g.set_attribute("solca", "categoria", "administracion")
t = ents.add_text("Secretar\u00eda - Control (Pediatr\u00eda y Medicina)", [10.200.m, 57.900.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Secretar\u00eda - Control (Especialidades)"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[27.000.m, 57.000.m, 0], [29.400.m, 57.000.m, 0], [29.400.m, 58.800.m, 0], [27.000.m, 58.800.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso administracion", "#F1CFE0")
g.set_attribute("solca", "categoria", "administracion")
t = ents.add_text("Secretar\u00eda - Control (Especialidades)", [28.200.m, 57.900.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Secretar\u00eda - Control (Ginecolog\u00eda)"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[45.000.m, 57.000.m, 0], [47.400.m, 57.000.m, 0], [47.400.m, 58.800.m, 0], [45.000.m, 58.800.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso administracion", "#F1CFE0")
g.set_attribute("solca", "categoria", "administracion")
t = ents.add_text("Secretar\u00eda - Control (Ginecolog\u00eda)", [46.200.m, 57.900.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Ba\u00f1o accesible"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[30.600.m, 47.400.m, 0], [34.800.m, 47.400.m, 0], [34.800.m, 54.600.m, 0], [30.600.m, 54.600.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso banos", "#DDE2E8")
g.set_attribute("solca", "categoria", "banos")
t = ents.add_text("Ba\u00f1o accesible", [32.700.m, 51.000.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Capilla"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[30.600.m, 42.600.m, 0], [34.800.m, 42.600.m, 0], [34.800.m, 47.400.m, 0], [30.600.m, 47.400.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso servicios", "#DDE2E8")
g.set_attribute("solca", "categoria", "servicios")
t = ents.add_text("Capilla", [32.700.m, 45.000.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "RPIS"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[30.600.m, 38.400.m, 0], [34.800.m, 38.400.m, 0], [34.800.m, 42.600.m, 0], [30.600.m, 42.600.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso administracion", "#F1CFE0")
g.set_attribute("solca", "categoria", "administracion")
t = ents.add_text("RPIS", [32.700.m, 40.500.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Farmacia"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[39.600.m, 43.200.m, 0], [55.800.m, 43.200.m, 0], [55.800.m, 52.200.m, 0], [39.600.m, 52.200.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso servicios", "#DDE2E8")
g.set_attribute("solca", "categoria", "servicios")
t = ents.add_text("Farmacia", [47.700.m, 47.700.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Ascensores sur"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[53.400.m, 34.200.m, 0], [55.800.m, 34.200.m, 0], [55.800.m, 38.400.m, 0], [53.400.m, 38.400.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso circulacion", "#D2D8DF")
g.set_attribute("solca", "categoria", "circulacion")
t = ents.add_text("Ascensores sur", [54.600.m, 36.300.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Farmacias Econ\u00f3micas"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[30.600.m, 28.200.m, 0], [34.200.m, 28.200.m, 0], [34.200.m, 31.800.m, 0], [30.600.m, 31.800.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso servicios", "#DDE2E8")
g.set_attribute("solca", "categoria", "servicios")
t = ents.add_text("Farmacias Econ\u00f3micas", [32.400.m, 30.000.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Cajas"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[53.400.m, 21.600.m, 0], [55.800.m, 21.600.m, 0], [55.800.m, 28.200.m, 0], [53.400.m, 28.200.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso administracion", "#F1CFE0")
g.set_attribute("solca", "categoria", "administracion")
t = ents.add_text("Cajas", [54.600.m, 24.900.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Direcci\u00f3n"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[30.600.m, 9.600.m, 0], [37.200.m, 9.600.m, 0], [37.200.m, 8.400.m, 0], [51.600.m, 8.400.m, 0], [51.600.m, 9.600.m, 0], [55.800.m, 9.600.m, 0], [55.800.m, 21.600.m, 0], [43.200.m, 21.600.m, 0], [43.200.m, 24.000.m, 0], [39.600.m, 24.000.m, 0], [39.600.m, 28.200.m, 0], [30.600.m, 28.200.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso administracion", "#F1CFE0")
g.set_attribute("solca", "categoria", "administracion")
t = ents.add_text("Direcci\u00f3n", [43.000.m, 16.900.m, 0.05.m]); t.layer = capa.("Rótulos")

gm = ents.add_group; gm.name = "Muros"; gm.layer = capa.("Muros")
me = gm.entities
caja = ->(a, b, e, z0, z1, m) {
  v = Geom::Vector3d.new(b[0] - a[0], b[1] - a[1], 0); return if v.length < 0.01
  n = Geom::Vector3d.new(-v.y, v.x, 0); n.length = e / 2.0
  q = [a.offset(n), b.offset(n), b.offset(n.reverse), a.offset(n.reverse)].map { |p| [p.x, p.y, z0] }
  f = me.add_face(q); f.reverse! if f.normal.z < 0; f.pushpull(z1 - z0)
  me.grep(Sketchup::Face).each { |x| x.material ||= m } }
m_muro = mat.("Pintura muros", "#F3F1EC"); m_ext = mat.("Fachada", "#E6E1D8")
caja.(Geom::Point3d.new(0.000.m, 54.600.m, 0), Geom::Point3d.new(32.100.m, 54.600.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(32.100.m, 54.600.m, 0), Geom::Point3d.new(33.300.m, 54.600.m, 0), 0.25.m, ALTO_DINTEL, ALTO, m_ext)  # dintel sobre puerta
caja.(Geom::Point3d.new(33.300.m, 54.600.m, 0), Geom::Point3d.new(34.800.m, 54.600.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(30.600.m, 9.600.m, 0), Geom::Point3d.new(30.600.m, 34.200.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(30.600.m, 34.200.m, 0), Geom::Point3d.new(30.600.m, 36.600.m, 0), 0.25.m, ALTO_DINTEL, ALTO, m_ext)  # dintel sobre puerta
caja.(Geom::Point3d.new(30.600.m, 36.600.m, 0), Geom::Point3d.new(30.600.m, 54.600.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(30.600.m, 57.000.m, 0), Geom::Point3d.new(30.600.m, 60.000.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(30.600.m, 60.000.m, 0), Geom::Point3d.new(30.600.m, 61.200.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(30.600.m, 61.200.m, 0), Geom::Point3d.new(30.600.m, 62.400.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(30.600.m, 62.400.m, 0), Geom::Point3d.new(30.600.m, 63.600.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(30.600.m, 63.600.m, 0), Geom::Point3d.new(30.600.m, 64.800.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(30.600.m, 64.800.m, 0), Geom::Point3d.new(30.600.m, 66.000.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(30.600.m, 66.000.m, 0), Geom::Point3d.new(30.600.m, 71.400.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(30.600.m, 9.600.m, 0), Geom::Point3d.new(37.200.m, 9.600.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(51.600.m, 9.600.m, 0), Geom::Point3d.new(55.800.m, 9.600.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(37.200.m, 8.400.m, 0), Geom::Point3d.new(37.200.m, 9.600.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(37.200.m, 8.400.m, 0), Geom::Point3d.new(51.600.m, 8.400.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(51.600.m, 8.400.m, 0), Geom::Point3d.new(51.600.m, 9.600.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(54.000.m, 0.000.m, 0), Geom::Point3d.new(54.000.m, 9.600.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(54.000.m, 57.000.m, 0), Geom::Point3d.new(54.000.m, 72.600.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(54.000.m, 0.000.m, 0), Geom::Point3d.new(58.200.m, 0.000.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(58.200.m, 0.000.m, 0), Geom::Point3d.new(58.200.m, 76.200.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(43.800.m, 76.200.m, 0), Geom::Point3d.new(58.200.m, 76.200.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(43.800.m, 72.600.m, 0), Geom::Point3d.new(43.800.m, 76.200.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(10.200.m, 72.600.m, 0), Geom::Point3d.new(36.300.m, 72.600.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(36.300.m, 72.600.m, 0), Geom::Point3d.new(38.700.m, 72.600.m, 0), 0.25.m, ALTO_DINTEL, ALTO, m_ext)  # dintel sobre puerta
caja.(Geom::Point3d.new(38.700.m, 72.600.m, 0), Geom::Point3d.new(40.800.m, 72.600.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(40.800.m, 72.600.m, 0), Geom::Point3d.new(42.000.m, 72.600.m, 0), 0.25.m, ALTO_DINTEL, ALTO, m_ext)  # dintel sobre puerta
caja.(Geom::Point3d.new(42.000.m, 72.600.m, 0), Geom::Point3d.new(44.400.m, 72.600.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(44.400.m, 72.600.m, 0), Geom::Point3d.new(45.600.m, 72.600.m, 0), 0.25.m, ALTO_DINTEL, ALTO, m_ext)  # dintel sobre puerta
caja.(Geom::Point3d.new(45.600.m, 72.600.m, 0), Geom::Point3d.new(50.700.m, 72.600.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(50.700.m, 72.600.m, 0), Geom::Point3d.new(51.900.m, 72.600.m, 0), 0.25.m, ALTO_DINTEL, ALTO, m_ext)  # dintel sobre puerta
caja.(Geom::Point3d.new(51.900.m, 72.600.m, 0), Geom::Point3d.new(54.000.m, 72.600.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(10.200.m, 71.400.m, 0), Geom::Point3d.new(10.200.m, 72.600.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(0.000.m, 71.400.m, 0), Geom::Point3d.new(10.200.m, 71.400.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(11.400.m, 71.400.m, 0), Geom::Point3d.new(12.300.m, 71.400.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(12.300.m, 71.400.m, 0), Geom::Point3d.new(13.500.m, 71.400.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(13.500.m, 71.400.m, 0), Geom::Point3d.new(14.400.m, 71.400.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(30.600.m, 71.400.m, 0), Geom::Point3d.new(32.400.m, 71.400.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(32.400.m, 71.400.m, 0), Geom::Point3d.new(33.600.m, 71.400.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(33.600.m, 71.400.m, 0), Geom::Point3d.new(35.400.m, 71.400.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(0.000.m, 54.600.m, 0), Geom::Point3d.new(0.000.m, 71.400.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(0.000.m, 67.800.m, 0), Geom::Point3d.new(1.500.m, 67.800.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(1.500.m, 67.800.m, 0), Geom::Point3d.new(2.700.m, 67.800.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(2.700.m, 67.800.m, 0), Geom::Point3d.new(4.200.m, 67.800.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(4.200.m, 67.800.m, 0), Geom::Point3d.new(4.200.m, 71.400.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(4.200.m, 69.000.m, 0), Geom::Point3d.new(9.000.m, 69.000.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(11.400.m, 69.000.m, 0), Geom::Point3d.new(17.400.m, 69.000.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(22.200.m, 69.000.m, 0), Geom::Point3d.new(27.000.m, 69.000.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(39.600.m, 69.000.m, 0), Geom::Point3d.new(46.800.m, 69.000.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(48.600.m, 69.000.m, 0), Geom::Point3d.new(54.000.m, 69.000.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(8.400.m, 69.000.m, 0), Geom::Point3d.new(8.400.m, 69.600.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(8.400.m, 69.600.m, 0), Geom::Point3d.new(8.400.m, 70.800.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(8.400.m, 70.800.m, 0), Geom::Point3d.new(8.400.m, 71.400.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(14.400.m, 69.000.m, 0), Geom::Point3d.new(14.400.m, 71.400.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(11.400.m, 57.000.m, 0), Geom::Point3d.new(11.400.m, 57.300.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(11.400.m, 57.300.m, 0), Geom::Point3d.new(11.400.m, 58.500.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(11.400.m, 58.500.m, 0), Geom::Point3d.new(11.400.m, 58.800.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(11.400.m, 69.000.m, 0), Geom::Point3d.new(11.400.m, 71.400.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(4.800.m, 66.600.m, 0), Geom::Point3d.new(9.000.m, 66.600.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(12.600.m, 66.600.m, 0), Geom::Point3d.new(17.400.m, 66.600.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(22.200.m, 66.600.m, 0), Geom::Point3d.new(27.000.m, 66.600.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(30.600.m, 66.600.m, 0), Geom::Point3d.new(35.400.m, 66.600.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(39.600.m, 66.600.m, 0), Geom::Point3d.new(45.000.m, 66.600.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(48.600.m, 66.600.m, 0), Geom::Point3d.new(54.000.m, 66.600.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(9.000.m, 57.000.m, 0), Geom::Point3d.new(9.000.m, 60.000.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(9.000.m, 60.000.m, 0), Geom::Point3d.new(9.000.m, 61.200.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(9.000.m, 61.200.m, 0), Geom::Point3d.new(9.000.m, 62.400.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(9.000.m, 62.400.m, 0), Geom::Point3d.new(9.000.m, 63.600.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(9.000.m, 63.600.m, 0), Geom::Point3d.new(9.000.m, 64.800.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(9.000.m, 64.800.m, 0), Geom::Point3d.new(9.000.m, 66.000.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(9.000.m, 66.000.m, 0), Geom::Point3d.new(9.000.m, 67.200.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(9.000.m, 67.200.m, 0), Geom::Point3d.new(9.000.m, 68.400.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(9.000.m, 68.400.m, 0), Geom::Point3d.new(9.000.m, 69.000.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(4.800.m, 57.000.m, 0), Geom::Point3d.new(4.800.m, 69.000.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(4.800.m, 64.200.m, 0), Geom::Point3d.new(9.000.m, 64.200.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(12.600.m, 64.200.m, 0), Geom::Point3d.new(17.400.m, 64.200.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(22.200.m, 64.200.m, 0), Geom::Point3d.new(27.000.m, 64.200.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(30.600.m, 64.200.m, 0), Geom::Point3d.new(35.400.m, 64.200.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(39.600.m, 64.200.m, 0), Geom::Point3d.new(45.000.m, 64.200.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(48.600.m, 64.200.m, 0), Geom::Point3d.new(54.000.m, 64.200.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(4.800.m, 61.800.m, 0), Geom::Point3d.new(9.000.m, 61.800.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(12.600.m, 61.800.m, 0), Geom::Point3d.new(17.400.m, 61.800.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(22.200.m, 61.800.m, 0), Geom::Point3d.new(27.000.m, 61.800.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(30.600.m, 61.800.m, 0), Geom::Point3d.new(35.400.m, 61.800.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(39.600.m, 61.800.m, 0), Geom::Point3d.new(45.000.m, 61.800.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(48.600.m, 61.800.m, 0), Geom::Point3d.new(54.000.m, 61.800.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(4.800.m, 59.400.m, 0), Geom::Point3d.new(9.000.m, 59.400.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(12.600.m, 59.400.m, 0), Geom::Point3d.new(17.400.m, 59.400.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(22.200.m, 59.400.m, 0), Geom::Point3d.new(27.000.m, 59.400.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(30.600.m, 59.400.m, 0), Geom::Point3d.new(35.400.m, 59.400.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(39.600.m, 59.400.m, 0), Geom::Point3d.new(45.000.m, 59.400.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(48.600.m, 59.400.m, 0), Geom::Point3d.new(54.000.m, 59.400.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(4.800.m, 57.000.m, 0), Geom::Point3d.new(6.300.m, 57.000.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(6.300.m, 57.000.m, 0), Geom::Point3d.new(7.500.m, 57.000.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(7.500.m, 57.000.m, 0), Geom::Point3d.new(11.400.m, 57.000.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(12.600.m, 57.000.m, 0), Geom::Point3d.new(14.400.m, 57.000.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(14.400.m, 57.000.m, 0), Geom::Point3d.new(15.600.m, 57.000.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(15.600.m, 57.000.m, 0), Geom::Point3d.new(17.400.m, 57.000.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(22.200.m, 57.000.m, 0), Geom::Point3d.new(24.000.m, 57.000.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(24.000.m, 57.000.m, 0), Geom::Point3d.new(25.200.m, 57.000.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(25.200.m, 57.000.m, 0), Geom::Point3d.new(29.400.m, 57.000.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(30.600.m, 57.000.m, 0), Geom::Point3d.new(32.400.m, 57.000.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(32.400.m, 57.000.m, 0), Geom::Point3d.new(33.600.m, 57.000.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(33.600.m, 57.000.m, 0), Geom::Point3d.new(35.400.m, 57.000.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(39.600.m, 57.000.m, 0), Geom::Point3d.new(41.700.m, 57.000.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(41.700.m, 57.000.m, 0), Geom::Point3d.new(42.900.m, 57.000.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(42.900.m, 57.000.m, 0), Geom::Point3d.new(45.600.m, 57.000.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(45.600.m, 57.000.m, 0), Geom::Point3d.new(46.800.m, 57.000.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(46.800.m, 57.000.m, 0), Geom::Point3d.new(47.400.m, 57.000.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(48.600.m, 57.000.m, 0), Geom::Point3d.new(50.700.m, 57.000.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(50.700.m, 57.000.m, 0), Geom::Point3d.new(51.900.m, 57.000.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(51.900.m, 57.000.m, 0), Geom::Point3d.new(54.000.m, 57.000.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(17.400.m, 57.000.m, 0), Geom::Point3d.new(17.400.m, 69.000.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(12.600.m, 57.000.m, 0), Geom::Point3d.new(12.600.m, 60.000.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(12.600.m, 60.000.m, 0), Geom::Point3d.new(12.600.m, 61.200.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(12.600.m, 61.200.m, 0), Geom::Point3d.new(12.600.m, 62.400.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(12.600.m, 62.400.m, 0), Geom::Point3d.new(12.600.m, 63.600.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(12.600.m, 63.600.m, 0), Geom::Point3d.new(12.600.m, 64.800.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(12.600.m, 64.800.m, 0), Geom::Point3d.new(12.600.m, 66.000.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(12.600.m, 66.000.m, 0), Geom::Point3d.new(12.600.m, 67.200.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(12.600.m, 67.200.m, 0), Geom::Point3d.new(12.600.m, 68.400.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(12.600.m, 68.400.m, 0), Geom::Point3d.new(12.600.m, 69.000.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(27.000.m, 57.000.m, 0), Geom::Point3d.new(27.000.m, 60.000.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(27.000.m, 60.000.m, 0), Geom::Point3d.new(27.000.m, 61.200.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(27.000.m, 61.200.m, 0), Geom::Point3d.new(27.000.m, 62.400.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(27.000.m, 62.400.m, 0), Geom::Point3d.new(27.000.m, 63.600.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(27.000.m, 63.600.m, 0), Geom::Point3d.new(27.000.m, 64.800.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(27.000.m, 64.800.m, 0), Geom::Point3d.new(27.000.m, 66.000.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(27.000.m, 66.000.m, 0), Geom::Point3d.new(27.000.m, 67.200.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(27.000.m, 67.200.m, 0), Geom::Point3d.new(27.000.m, 68.400.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(27.000.m, 68.400.m, 0), Geom::Point3d.new(27.000.m, 69.000.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(22.200.m, 57.000.m, 0), Geom::Point3d.new(22.200.m, 69.000.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(35.400.m, 57.000.m, 0), Geom::Point3d.new(35.400.m, 71.400.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(43.200.m, 21.600.m, 0), Geom::Point3d.new(43.200.m, 24.000.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(43.200.m, 69.000.m, 0), Geom::Point3d.new(43.200.m, 72.600.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(39.600.m, 24.000.m, 0), Geom::Point3d.new(39.600.m, 28.200.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(39.600.m, 43.200.m, 0), Geom::Point3d.new(39.600.m, 52.200.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(39.600.m, 57.000.m, 0), Geom::Point3d.new(39.600.m, 72.600.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(46.800.m, 69.000.m, 0), Geom::Point3d.new(46.800.m, 72.600.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(49.200.m, 72.600.m, 0), Geom::Point3d.new(49.200.m, 73.800.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(49.200.m, 73.800.m, 0), Geom::Point3d.new(49.200.m, 75.000.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(49.200.m, 75.000.m, 0), Geom::Point3d.new(49.200.m, 76.200.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(45.000.m, 57.000.m, 0), Geom::Point3d.new(45.000.m, 60.000.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(45.000.m, 60.000.m, 0), Geom::Point3d.new(45.000.m, 61.200.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(45.000.m, 61.200.m, 0), Geom::Point3d.new(45.000.m, 62.400.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(45.000.m, 62.400.m, 0), Geom::Point3d.new(45.000.m, 63.600.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(45.000.m, 63.600.m, 0), Geom::Point3d.new(45.000.m, 64.800.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(45.000.m, 64.800.m, 0), Geom::Point3d.new(45.000.m, 66.000.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(45.000.m, 66.000.m, 0), Geom::Point3d.new(45.000.m, 67.200.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(45.000.m, 67.200.m, 0), Geom::Point3d.new(45.000.m, 68.400.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(45.000.m, 68.400.m, 0), Geom::Point3d.new(45.000.m, 69.000.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(48.600.m, 57.000.m, 0), Geom::Point3d.new(48.600.m, 60.000.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(48.600.m, 60.000.m, 0), Geom::Point3d.new(48.600.m, 61.200.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(48.600.m, 61.200.m, 0), Geom::Point3d.new(48.600.m, 62.400.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(48.600.m, 62.400.m, 0), Geom::Point3d.new(48.600.m, 63.600.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(48.600.m, 63.600.m, 0), Geom::Point3d.new(48.600.m, 64.800.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(48.600.m, 64.800.m, 0), Geom::Point3d.new(48.600.m, 66.000.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(48.600.m, 66.000.m, 0), Geom::Point3d.new(48.600.m, 67.200.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(48.600.m, 67.200.m, 0), Geom::Point3d.new(48.600.m, 68.400.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(48.600.m, 68.400.m, 0), Geom::Point3d.new(48.600.m, 72.600.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(9.000.m, 58.800.m, 0), Geom::Point3d.new(11.400.m, 58.800.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(27.000.m, 58.800.m, 0), Geom::Point3d.new(29.400.m, 58.800.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(45.000.m, 58.800.m, 0), Geom::Point3d.new(47.400.m, 58.800.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(29.400.m, 57.000.m, 0), Geom::Point3d.new(29.400.m, 57.300.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(29.400.m, 57.300.m, 0), Geom::Point3d.new(29.400.m, 58.500.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(29.400.m, 58.500.m, 0), Geom::Point3d.new(29.400.m, 58.800.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(47.400.m, 57.000.m, 0), Geom::Point3d.new(47.400.m, 58.800.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(30.600.m, 47.400.m, 0), Geom::Point3d.new(34.800.m, 47.400.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(34.800.m, 38.400.m, 0), Geom::Point3d.new(34.800.m, 39.900.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(34.800.m, 39.900.m, 0), Geom::Point3d.new(34.800.m, 41.100.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(34.800.m, 41.100.m, 0), Geom::Point3d.new(34.800.m, 44.400.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(34.800.m, 44.400.m, 0), Geom::Point3d.new(34.800.m, 45.600.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(34.800.m, 45.600.m, 0), Geom::Point3d.new(34.800.m, 54.600.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(30.600.m, 42.600.m, 0), Geom::Point3d.new(34.800.m, 42.600.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(30.600.m, 38.400.m, 0), Geom::Point3d.new(34.800.m, 38.400.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(53.400.m, 38.400.m, 0), Geom::Point3d.new(55.800.m, 38.400.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(39.600.m, 43.200.m, 0), Geom::Point3d.new(55.800.m, 43.200.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(55.800.m, 9.600.m, 0), Geom::Point3d.new(55.800.m, 15.000.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(55.800.m, 15.000.m, 0), Geom::Point3d.new(55.800.m, 16.200.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(55.800.m, 16.200.m, 0), Geom::Point3d.new(55.800.m, 24.300.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(55.800.m, 24.300.m, 0), Geom::Point3d.new(55.800.m, 25.500.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(55.800.m, 25.500.m, 0), Geom::Point3d.new(55.800.m, 28.200.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(55.800.m, 34.200.m, 0), Geom::Point3d.new(55.800.m, 35.700.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(55.800.m, 35.700.m, 0), Geom::Point3d.new(55.800.m, 36.900.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(55.800.m, 36.900.m, 0), Geom::Point3d.new(55.800.m, 38.400.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(55.800.m, 43.200.m, 0), Geom::Point3d.new(55.800.m, 47.100.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(55.800.m, 47.100.m, 0), Geom::Point3d.new(55.800.m, 48.300.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(55.800.m, 48.300.m, 0), Geom::Point3d.new(55.800.m, 52.200.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(39.600.m, 52.200.m, 0), Geom::Point3d.new(55.800.m, 52.200.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(53.400.m, 34.200.m, 0), Geom::Point3d.new(55.800.m, 34.200.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(53.400.m, 21.600.m, 0), Geom::Point3d.new(53.400.m, 28.200.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(53.400.m, 34.200.m, 0), Geom::Point3d.new(53.400.m, 38.400.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(30.600.m, 28.200.m, 0), Geom::Point3d.new(39.600.m, 28.200.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(53.400.m, 28.200.m, 0), Geom::Point3d.new(55.800.m, 28.200.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(34.200.m, 28.200.m, 0), Geom::Point3d.new(34.200.m, 31.800.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(30.600.m, 31.800.m, 0), Geom::Point3d.new(31.800.m, 31.800.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(31.800.m, 31.800.m, 0), Geom::Point3d.new(33.000.m, 31.800.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(33.000.m, 31.800.m, 0), Geom::Point3d.new(34.200.m, 31.800.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(43.200.m, 21.600.m, 0), Geom::Point3d.new(55.800.m, 21.600.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(39.600.m, 24.000.m, 0), Geom::Point3d.new(43.200.m, 24.000.m, 0), 0.15.m, 0, ALTO, m_muro)

gr = ents.add_group; gr.name = "Rutas (guía)"; gr.layer = capa.("Rutas")
gr.entities.add_curve([[2.100.m, 67.800.m, 0], [2.400.m, 67.800.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[8.400.m, 70.200.m, 0], [10.800.m, 70.200.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[12.900.m, 71.400.m, 0], [12.900.m, 72.000.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[9.000.m, 67.800.m, 0], [10.800.m, 67.800.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[9.000.m, 65.400.m, 0], [10.800.m, 65.400.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[9.000.m, 63.000.m, 0], [10.800.m, 63.000.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[9.000.m, 60.600.m, 0], [10.800.m, 60.600.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[6.900.m, 57.000.m, 0], [6.900.m, 55.800.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[12.600.m, 67.800.m, 0], [10.800.m, 67.800.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[12.600.m, 65.400.m, 0], [10.800.m, 65.400.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[12.600.m, 63.000.m, 0], [10.800.m, 63.000.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[12.600.m, 60.600.m, 0], [10.800.m, 60.600.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[15.000.m, 57.000.m, 0], [15.000.m, 55.800.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[27.000.m, 67.800.m, 0], [28.800.m, 67.800.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[27.000.m, 65.400.m, 0], [28.800.m, 65.400.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[27.000.m, 63.000.m, 0], [28.800.m, 63.000.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[27.000.m, 60.600.m, 0], [28.800.m, 60.600.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[24.600.m, 57.000.m, 0], [24.600.m, 55.800.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[33.000.m, 71.400.m, 0], [33.000.m, 72.000.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[30.600.m, 65.400.m, 0], [28.800.m, 65.400.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[30.600.m, 63.000.m, 0], [28.800.m, 63.000.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[30.600.m, 60.600.m, 0], [28.800.m, 60.600.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[33.000.m, 57.000.m, 0], [33.000.m, 55.800.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[41.400.m, 72.600.m, 0], [41.259.m, 73.328.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[45.000.m, 72.600.m, 0], [44.729.m, 73.999.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[45.000.m, 67.800.m, 0], [46.800.m, 67.800.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[45.000.m, 65.400.m, 0], [46.800.m, 65.400.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[45.000.m, 63.000.m, 0], [46.800.m, 63.000.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[45.000.m, 60.600.m, 0], [46.800.m, 60.600.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[42.300.m, 57.000.m, 0], [42.300.m, 55.800.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[51.300.m, 72.600.m, 0], [51.300.m, 74.400.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[48.600.m, 67.800.m, 0], [46.800.m, 67.800.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[48.600.m, 65.400.m, 0], [46.800.m, 65.400.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[48.600.m, 63.000.m, 0], [46.800.m, 63.000.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[48.600.m, 60.600.m, 0], [46.800.m, 60.600.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[51.300.m, 57.000.m, 0], [51.300.m, 55.800.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[11.400.m, 57.900.m, 0], [10.800.m, 57.900.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[29.400.m, 57.900.m, 0], [28.800.m, 57.900.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[46.200.m, 57.000.m, 0], [46.800.m, 57.000.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[32.700.m, 54.600.m, 0], [32.700.m, 55.800.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[34.800.m, 45.000.m, 0], [37.200.m, 45.000.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[34.800.m, 40.500.m, 0], [37.200.m, 40.500.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[55.800.m, 47.700.m, 0], [56.900.m, 47.700.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[55.800.m, 36.300.m, 0], [55.800.m, 35.400.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[32.400.m, 31.800.m, 0], [32.400.m, 35.400.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[55.800.m, 24.900.m, 0], [56.900.m, 24.900.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[55.800.m, 15.600.m, 0], [56.900.m, 15.600.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[1.000.m, 55.800.m, 0], [56.900.m, 55.800.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[56.900.m, 0.600.m, 0], [56.900.m, 75.000.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[2.400.m, 55.800.m, 0], [2.400.m, 67.800.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[10.800.m, 55.800.m, 0], [10.800.m, 72.000.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[19.800.m, 55.800.m, 0], [19.800.m, 72.000.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[28.800.m, 55.800.m, 0], [28.800.m, 72.000.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[37.500.m, 55.800.m, 0], [37.500.m, 72.600.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[46.800.m, 55.800.m, 0], [46.800.m, 69.000.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[10.800.m, 72.000.m, 0], [37.500.m, 72.000.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[37.500.m, 72.600.m, 0], [46.800.m, 74.400.m, 0], [56.900.m, 74.400.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[37.200.m, 55.800.m, 0], [37.200.m, 35.400.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[30.600.m, 35.400.m, 0], [56.900.m, 35.400.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[50.400.m, 35.400.m, 0], [50.400.m, 22.800.m, 0], [53.400.m, 22.800.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
t = ents.add_text("ASC-A", [33.000.m, 69.000.m, 1.m]); t.layer = capa.("Rótulos")
t = ents.add_text("ASC-B", [54.600.m, 36.300.m, 1.m]); t.layer = capa.("Rótulos")
t = ents.add_text("QR \u00b7 Entrada principal", [30.600.m, 35.400.m, 1.m]); t.layer = capa.("Rótulos")
t = ents.add_text("QR \u00b7 Entrada norte", [37.500.m, 72.600.m, 1.m]); t.layer = capa.("Rótulos")

model.commit_operation
Sketchup.active_model.active_view.zoom_extents
puts "Planta baja: 48 ambientes, 151 tramos de muro, 48 puertas"

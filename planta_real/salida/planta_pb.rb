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
f = g.entities.add_face([[0.000.m, 0.000.m, 0], [30.000.m, 0.000.m, 0], [30.000.m, 20.000.m, 0], [0.000.m, 20.000.m, 0]])
f.reverse! if f.normal.z > 0
f.pushpull(0.20.m)
g.entities.grep(Sketchup::Face).each { |x| x.material = mat.("Losa", "#C9CCCF") }

g = ents.add_group; g.name = "Laboratorio Cl\u00ednico"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[0.000.m, 12.000.m, 0], [10.000.m, 12.000.m, 0], [10.000.m, 20.000.m, 0], [0.000.m, 20.000.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso diagnostico", "#DCD0F5")
g.set_attribute("solca", "categoria", "diagnostico")
t = ents.add_text("Laboratorio Cl\u00ednico", [5.000.m, 16.000.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Caja"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[20.000.m, 12.000.m, 0], [30.000.m, 12.000.m, 0], [30.000.m, 20.000.m, 0], [20.000.m, 20.000.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso administracion", "#F1CFE0")
g.set_attribute("solca", "categoria", "administracion")
t = ents.add_text("Caja", [25.000.m, 16.000.m, 0.05.m]); t.layer = capa.("Rótulos")
g = ents.add_group; g.name = "Ascensores"; g.layer = capa.("Ambientes")
f = g.entities.add_face([[12.000.m, 12.000.m, 0], [16.000.m, 12.000.m, 0], [16.000.m, 20.000.m, 0], [12.000.m, 20.000.m, 0]]); f.reverse! if f.normal.z < 0
g.transform!(Geom::Transformation.translation([0, 0, 0.01.m]))
f.material = mat.("Piso circulacion", "#D2D8DF")
g.set_attribute("solca", "categoria", "circulacion")
t = ents.add_text("Ascensores", [14.000.m, 16.000.m, 0.05.m]); t.layer = capa.("Rótulos")

gm = ents.add_group; gm.name = "Muros"; gm.layer = capa.("Muros")
me = gm.entities
caja = ->(a, b, e, z0, z1, m) {
  v = Geom::Vector3d.new(b[0] - a[0], b[1] - a[1], 0); return if v.length < 0.01
  n = Geom::Vector3d.new(-v.y, v.x, 0); n.length = e / 2.0
  q = [a.offset(n), b.offset(n), b.offset(n.reverse), a.offset(n.reverse)].map { |p| [p.x, p.y, z0] }
  f = me.add_face(q); f.reverse! if f.normal.z < 0; f.pushpull(z1 - z0)
  me.grep(Sketchup::Face).each { |x| x.material ||= m } }
m_muro = mat.("Pintura muros", "#F3F1EC"); m_ext = mat.("Fachada", "#E6E1D8")
caja.(Geom::Point3d.new(0.000.m, 0.000.m, 0), Geom::Point3d.new(13.800.m, 0.000.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(13.800.m, 0.000.m, 0), Geom::Point3d.new(16.200.m, 0.000.m, 0), 0.25.m, ALTO_DINTEL, ALTO, m_ext)  # dintel sobre puerta
caja.(Geom::Point3d.new(16.200.m, 0.000.m, 0), Geom::Point3d.new(30.000.m, 0.000.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(30.000.m, 0.000.m, 0), Geom::Point3d.new(30.000.m, 20.000.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(0.000.m, 20.000.m, 0), Geom::Point3d.new(30.000.m, 20.000.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(0.000.m, 0.000.m, 0), Geom::Point3d.new(0.000.m, 20.000.m, 0), 0.25.m, 0, ALTO, m_ext)
caja.(Geom::Point3d.new(0.000.m, 12.000.m, 0), Geom::Point3d.new(4.400.m, 12.000.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(4.400.m, 12.000.m, 0), Geom::Point3d.new(5.600.m, 12.000.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(5.600.m, 12.000.m, 0), Geom::Point3d.new(10.000.m, 12.000.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(12.000.m, 12.000.m, 0), Geom::Point3d.new(13.400.m, 12.000.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(13.400.m, 12.000.m, 0), Geom::Point3d.new(14.600.m, 12.000.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(14.600.m, 12.000.m, 0), Geom::Point3d.new(16.000.m, 12.000.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(20.000.m, 12.000.m, 0), Geom::Point3d.new(24.400.m, 12.000.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(24.400.m, 12.000.m, 0), Geom::Point3d.new(25.600.m, 12.000.m, 0), 0.15.m, ALTO_DINTEL, ALTO, m_muro)  # dintel sobre puerta
caja.(Geom::Point3d.new(25.600.m, 12.000.m, 0), Geom::Point3d.new(30.000.m, 12.000.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(10.000.m, 12.000.m, 0), Geom::Point3d.new(10.000.m, 20.000.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(20.000.m, 12.000.m, 0), Geom::Point3d.new(20.000.m, 20.000.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(16.000.m, 12.000.m, 0), Geom::Point3d.new(16.000.m, 20.000.m, 0), 0.15.m, 0, ALTO, m_muro)
caja.(Geom::Point3d.new(12.000.m, 12.000.m, 0), Geom::Point3d.new(12.000.m, 20.000.m, 0), 0.15.m, 0, ALTO, m_muro)

gr = ents.add_group; gr.name = "Rutas (guía)"; gr.layer = capa.("Rutas")
gr.entities.add_curve([[1.000.m, 10.000.m, 0], [29.000.m, 10.000.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[5.000.m, 10.000.m, 0], [5.000.m, 12.000.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[25.000.m, 10.000.m, 0], [25.000.m, 12.000.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[14.000.m, 10.000.m, 0], [14.000.m, 12.000.m, 0], [14.000.m, 15.000.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
gr.entities.add_curve([[15.000.m, 0.000.m, 0], [15.000.m, 10.000.m, 0]].map { |p| [p[0], p[1], 0.03.m] })
t = ents.add_text("ASC-A", [14.000.m, 15.000.m, 1.m]); t.layer = capa.("Rótulos")
t = ents.add_text("QR \u00b7 Entrada principal", [15.000.m, 0.000.m, 1.m]); t.layer = capa.("Rótulos")

model.commit_operation
Sketchup.active_model.active_view.zoom_extents
puts "Planta baja: 3 ambientes, 15 tramos de muro, 3 puertas"

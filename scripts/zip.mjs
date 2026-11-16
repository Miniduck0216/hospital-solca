// Zip mínimo (sin dependencias): escribe y lee archivos .zip con «deflate» de node:zlib.
// Lo usan el script del paquete del plano (plano_paquete.mjs) y sus pruebas.
import zlib from 'node:zlib'

const TABLA = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
export function crc32(buf) {
  if (zlib.crc32) return zlib.crc32(buf) >>> 0
  let c = 0xFFFFFFFF
  for (const b of buf) c = TABLA[(c ^ b) & 0xFF] ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}

// fecha DOS fija: el mismo contenido da el mismo zip (y el mismo hash)
const FECHA = ((2026 - 1980) << 9) | (1 << 5) | 1

/** @param archivos [[ruta, Buffer], …] en el orden en que van al zip */
export function escribirZip(archivos) {
  const partes = []
  const central = []
  let pos = 0
  for (const [ruta, datos] of archivos) {
    const nombre = Buffer.from(ruta, 'utf8')
    const comp = zlib.deflateRawSync(datos, { level: 9 })
    const usar = comp.length < datos.length ? comp : datos
    const metodo = usar === comp ? 8 : 0
    const crc = crc32(datos)
    const loc = Buffer.alloc(30)
    loc.writeUInt32LE(0x04034b50, 0); loc.writeUInt16LE(20, 4); loc.writeUInt16LE(0x0800, 6); loc.writeUInt16LE(metodo, 8)
    loc.writeUInt16LE(0, 10); loc.writeUInt16LE(FECHA, 12); loc.writeUInt32LE(crc, 14)
    loc.writeUInt32LE(usar.length, 18); loc.writeUInt32LE(datos.length, 22); loc.writeUInt16LE(nombre.length, 26); loc.writeUInt16LE(0, 28)
    const cen = Buffer.alloc(46)
    cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0x0800, 8)
    cen.writeUInt16LE(metodo, 10); cen.writeUInt16LE(0, 12); cen.writeUInt16LE(FECHA, 14); cen.writeUInt32LE(crc, 16)
    cen.writeUInt32LE(usar.length, 20); cen.writeUInt32LE(datos.length, 24); cen.writeUInt16LE(nombre.length, 28)
    cen.writeUInt32LE(pos, 42)
    partes.push(loc, nombre, usar)
    central.push(cen, nombre)
    pos += loc.length + nombre.length + usar.length
  }
  const tamCentral = central.reduce((s, b) => s + b.length, 0)
  const fin = Buffer.alloc(22)
  fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(archivos.length, 8); fin.writeUInt16LE(archivos.length, 10)
  fin.writeUInt32LE(tamCentral, 12); fin.writeUInt32LE(pos, 16)
  return Buffer.concat([...partes, ...central, fin])
}

/** @returns Map<ruta, { datos: Buffer, comprimido: number }> */
export function leerZip(zip) {
  let f = zip.length - 22
  while (f >= 0 && zip.readUInt32LE(f) !== 0x06054b50) f--
  if (f < 0) throw new Error('No es un archivo zip')
  const n = zip.readUInt16LE(f + 10)
  let p = zip.readUInt32LE(f + 16)
  const salida = new Map()
  for (let i = 0; i < n; i++) {
    if (zip.readUInt32LE(p) !== 0x02014b50) throw new Error('Zip dañado')
    const metodo = zip.readUInt16LE(p + 10)
    const comp = zip.readUInt32LE(p + 20)
    const lnom = zip.readUInt16LE(p + 28), lext = zip.readUInt16LE(p + 30), lcom = zip.readUInt16LE(p + 32)
    const loc = zip.readUInt32LE(p + 42)
    const ruta = zip.toString('utf8', p + 46, p + 46 + lnom)
    const ini = loc + 30 + zip.readUInt16LE(loc + 26) + zip.readUInt16LE(loc + 28)
    const crudo = zip.subarray(ini, ini + comp)
    salida.set(ruta, { datos: metodo === 8 ? zlib.inflateRawSync(crudo) : Buffer.from(crudo), comprimido: comp })
    p += 46 + lnom + lext + lcom
  }
  return salida
}

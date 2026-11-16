// Para las pruebas con node: fetch que sirve los archivos de public/ y la constante __VERSION__ de Vite.
// La configuración de OM3 (…/mapa/publicado, ver CONFIG_OM3_URL en datos.js) se sirve desde tests/fixtures/config-om3.json:
// es la que entrega OM3 con la semilla del plano cargada (la genera OMNIUM_MS_GESTION_HOSPITALARIA:
// npm run plano:semilla -- <carpeta de hospital-solca> --ref 2c6eb6e --json <esta carpeta>/fixtures/config-om3.json).
// Cualquier otra dirección externa responde como caída (sirve para probar el mapa sin OM3).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const PUB = path.join(AQUI, '..', 'public')
export const CONFIG_OM3_PRUEBA = path.join(AQUI, 'fixtures', 'config-om3.json')
globalThis.__VERSION__ = 'test'
globalThis.fetch = async (url) => {
  const u = String(url)
  if (/^https?:/.test(u)) {
    if (new URL(u).pathname.endsWith('/mapa/publicado')) return { ok: true, json: async () => JSON.parse(fs.readFileSync(CONFIG_OM3_PRUEBA, 'utf8')) }
    return { ok: false, json: async () => null }
  }
  const f = path.join(PUB, u.replace(/^\/+/, '').split('?')[0])
  if (!fs.existsSync(f)) return { ok: false, json: async () => null }
  return { ok: true, json: async () => JSON.parse(fs.readFileSync(f, 'utf8')) }
}

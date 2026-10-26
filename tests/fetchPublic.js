// Para las pruebas con node: fetch que sirve los archivos de public/ y la constante __VERSION__ de Vite.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PUB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public')
globalThis.__VERSION__ = 'test'
globalThis.fetch = async (url) => {
  const f = path.join(PUB, String(url).replace(/^\/+/, '').split('?')[0])
  if (!fs.existsSync(f)) return { ok: false, json: async () => null }
  return { ok: true, json: async () => JSON.parse(fs.readFileSync(f, 'utf8')) }
}

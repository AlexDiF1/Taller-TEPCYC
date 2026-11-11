/**
 * Carga `.env.local` (ignorado por git) antes que cualquier otro módulo del
 * servidor: auth.mjs lee sus variables en el momento de importarse.
 */
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectDir = join(dirname(fileURLToPath(import.meta.url)), '..')

try {
  process.loadEnvFile(join(projectDir, '.env.local'))
} catch {
  /* sin .env.local: se usan las variables del entorno */
}

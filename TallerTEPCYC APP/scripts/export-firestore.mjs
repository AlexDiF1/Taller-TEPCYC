/**
 * Descarga completa de la base de datos de Firebase (Firestore, proyecto
 * `todoenpcyconsolasapp`) a JSON dentro de `firestore-backup/`.
 *
 * Uso:  node scripts/export-firestore.mjs
 * Requiere la service account (GOOGLE_APPLICATION_CREDENTIALS o ../firebase-key.json).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const here = dirname(fileURLToPath(import.meta.url))
const projectDir = join(here, '..')
const outDir = join(projectDir, '..', 'firestore-backup')

const account = JSON.parse(
  readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS ?? join(projectDir, '..', 'firebase-key.json'), 'utf8'),
)

initializeApp({
  credential: cert(account),
  projectId: process.env.FIREBASE_PROJECT_ID || account.project_id,
})

const db = getFirestore()
const collections = [process.argv[2] ?? 'repairs', 'sales', 'inventory', 'products']
const stamp = new Date().toISOString().slice(0, 10)

mkdirSync(outDir, { recursive: true })

const summary = []
for (const name of collections) {
  const snap = await db.collection(name).get()
  if (snap.empty) {
    summary.push(`${name}: sin documentos (omito)`)
    continue
  }
  const docs = snap.docs.map((doc) => ({ _id: doc.id, ...doc.data() }))
  writeFileSync(join(outDir, `${name}-${stamp}.json`), JSON.stringify(docs, null, 2))
  summary.push(`${name}: ${docs.length} documentos`)
}

writeFileSync(
  join(outDir, `export-${stamp}.txt`),
  `Export Firestore ${account.project_id} — ${new Date().toISOString()}\n${summary.join('\n')}\n`,
)

console.log(summary.join('\n'))

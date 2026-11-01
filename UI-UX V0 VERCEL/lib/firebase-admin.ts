/**
 * firebase-admin (solo servidor). La credencial se resuelve en este orden:
 *   1. FIREBASE_SERVICE_ACCOUNT_JSON  -> JSON completo en una sola línea
 *   2. GOOGLE_APPLICATION_CREDENTIALS -> ruta al JSON de la cuenta de servicio
 *   3. FIREBASE_SERVICE_ACCOUNT_PATH  -> alternativa a la anterior
 *   4. ./firebase-key.json relativo a la raíz del proyecto
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cert, getApps, initializeApp, type App, type ServiceAccount } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'

/** JSON tal cual lo entrega la consola de Firebase (snake_case). */
type ServiceAccountJson = {
  project_id: string
  client_email: string
  private_key: string
}

function loadServiceAccount(): ServiceAccountJson {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (inline) return JSON.parse(inline) as ServiceAccountJson

  const path =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ??
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ??
    join(process.cwd(), '..', 'firebase-key.json')

  return JSON.parse(readFileSync(path, 'utf8')) as ServiceAccountJson
}

let app: App | null = null

export function firebaseApp(): App {
  const existing = getApps()
  if (existing.length > 0) return existing[0]
  if (app) return app
  const account = loadServiceAccount()
  app = initializeApp({
    credential: cert(account as unknown as ServiceAccount),
    projectId: process.env.FIREBASE_PROJECT_ID || account.project_id,
  })
  return app
}

export function firestore(): Firestore {
  return getFirestore(firebaseApp())
}

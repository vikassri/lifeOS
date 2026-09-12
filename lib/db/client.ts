import { Firestore } from '@google-cloud/firestore'

let _db: Firestore | null = null

export function getFirestoreDb(): Firestore {
  if (!_db) {
    _db = new Firestore({
      projectId: process.env['GCP_PROJECT_ID'],
      // In Cloud Run: uses Application Default Credentials automatically
      // Locally: set GOOGLE_APPLICATION_CREDENTIALS env var
    })
  }
  return _db
}

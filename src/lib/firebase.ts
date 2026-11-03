/**
 * Firebase is optional. When the VITE_FIREBASE_* variables are missing the app runs as guest
 * only, saves stay in localStorage, and the sign-in sheet explains that sign-in is not set up.
 *
 * TODO(jovian): create the Firebase project, enable Google and Email link sign-in, create a
 * Firestore database, paste firebase/firestore.rules, add jovian.wang to the authorized
 * domains, then put the web app config in .env.local (see .env.example) and in the GitHub
 * repository secrets read by .github/workflows/deploy.yml.
 */
import type { FirebaseApp } from 'firebase/app'
import type { Auth } from 'firebase/auth'
import type { Firestore } from 'firebase/firestore'

export interface FirebaseConfig {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket?: string
  messagingSenderId?: string
  appId: string
}

export function readConfig(): FirebaseConfig | null {
  const env = import.meta.env
  const apiKey = env.VITE_FIREBASE_API_KEY as string | undefined
  const authDomain = env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined
  const projectId = env.VITE_FIREBASE_PROJECT_ID as string | undefined
  const appId = env.VITE_FIREBASE_APP_ID as string | undefined
  if (!apiKey || !authDomain || !projectId || !appId) return null
  return {
    apiKey,
    authDomain,
    projectId,
    appId,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  }
}

export const firebaseConfigured = readConfig() !== null

export interface FirebaseServices {
  app: FirebaseApp
  auth: Auth
  db: Firestore
}

let servicesPromise: Promise<FirebaseServices | null> | null = null

/** Lazily load the Firebase SDK so guests never download it. Returns null when unconfigured. */
export function getFirebase(): Promise<FirebaseServices | null> {
  if (servicesPromise) return servicesPromise
  const config = readConfig()
  if (!config) return (servicesPromise = Promise.resolve(null))
  servicesPromise = (async () => {
    try {
      const [{ initializeApp, getApps }, { getAuth, browserLocalPersistence, setPersistence }, { getFirestore }] =
        await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore')])
      const app = getApps()[0] ?? initializeApp(config)
      const auth = getAuth(app)
      await setPersistence(auth, browserLocalPersistence).catch(() => undefined)
      const db = getFirestore(app)
      return { app, auth, db }
    } catch (err) {
      console.warn('Firebase failed to start; continuing as guest', err)
      return null
    }
  })()
  return servicesPromise
}

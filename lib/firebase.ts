"use client"

import { initializeApp, getApps } from "firebase/app"
import { getAuth, onAuthStateChanged, signInAnonymously, type User } from "firebase/auth"
import { getFirestore } from "firebase/firestore"

const envFirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
}

const envConfigValues = Object.values(envFirebaseConfig)
const hasCompleteEnvFirebaseConfig = envConfigValues.every((value) => Boolean(value))

if (!hasCompleteEnvFirebaseConfig) {
  console.warn(
    "Firebase env vars are missing. Set all NEXT_PUBLIC_FIREBASE_* keys."
  )
}

const app = getApps().length ? getApps()[0] : initializeApp(envFirebaseConfig)

export const db = getFirestore(app)
export const auth = getAuth(app)

let authUidPromise: Promise<string> | null = null
const LOCAL_CLIENT_ID_KEY = "trav-client-id"

function persistClientId(value: string) {
  if (typeof window === "undefined") return
  localStorage.setItem(LOCAL_CLIENT_ID_KEY, value)
}

function readOrCreateLocalClientId() {
  if (typeof window === "undefined") {
    return `local-${Math.random().toString(36).slice(2, 10)}`
  }
  const existing = localStorage.getItem(LOCAL_CLIENT_ID_KEY)
  if (existing?.startsWith("local-")) return existing
  const next = `local-${Math.random().toString(36).slice(2, 10)}`
  persistClientId(next)
  return next
}

export async function ensureAuthUid() {
  if (auth.currentUser?.uid) {
    persistClientId(auth.currentUser.uid)
    return auth.currentUser.uid
  }
  if (!authUidPromise) {
    authUidPromise = (async () => {
      try {
        const user = await new Promise<User | null>((resolve) => {
          let settled = false
          let unsubscribe: () => void = () => undefined
          const finish = (currentUser: User | null) => {
            if (settled) return
            settled = true
            unsubscribe()
            resolve(currentUser)
          }
          unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            finish(currentUser)
          })
          window.setTimeout(() => {
            finish(auth.currentUser)
          }, 1200)
        })
        if (user?.uid) {
          persistClientId(user.uid)
          return user.uid
        }

        const credential = await signInAnonymously(auth)
        persistClientId(credential.user.uid)
        return credential.user.uid
      } catch (error) {
        console.warn("Anonymous auth unavailable, falling back to local client id", error)
        return readOrCreateLocalClientId()
      }
    })().finally(() => {
      authUidPromise = null
    })
  }
  return authUidPromise
}

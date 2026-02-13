"use client"

import { initializeApp, getApps } from "firebase/app"
import { getAuth, onAuthStateChanged, signInAnonymously, type User } from "firebase/auth"
import { getFirestore } from "firebase/firestore"

const firebaseConfig = {
  apiKey: "AIzaSyAN9ORHaui8p1QqeWikBdrd1wQGRQsWcGc",
  authDomain: "travelplanner-dd3b5.firebaseapp.com",
  projectId: "travelplanner-dd3b5",
  storageBucket: "travelplanner-dd3b5.firebasestorage.app",
  messagingSenderId: "470892635372",
  appId: "1:470892635372:web:2d91e700b802c427c4f1c9",
}

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)

export const db = getFirestore(app)
export const auth = getAuth(app)

let authUidPromise: Promise<string> | null = null
const LOCAL_CLIENT_ID_KEY = "trav-client-id"

function readOrCreateLocalClientId() {
  if (typeof window === "undefined") {
    return `local-${Math.random().toString(36).slice(2, 10)}`
  }
  const existing = localStorage.getItem(LOCAL_CLIENT_ID_KEY)
  if (existing?.startsWith("local-")) return existing
  const next = `local-${Math.random().toString(36).slice(2, 10)}`
  localStorage.setItem(LOCAL_CLIENT_ID_KEY, next)
  return next
}

export async function ensureAuthUid() {
  if (auth.currentUser?.uid) return auth.currentUser.uid
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
        if (user?.uid) return user.uid

        const credential = await signInAnonymously(auth)
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

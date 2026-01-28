"use client"

import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Trip, Schedule, DayInfo, ChecklistCategory, ChecklistItem, ExchangeRate } from "@/lib/types"

export type ShareLog = {
  id: string
  user: string
  action: string
  clientTs?: number
  createdAt?: unknown
}

export type SharePayload = {
  version: number
  trip: Trip
  schedules: Schedule[]
  dayInfos: DayInfo[]
  checklistCategories: ChecklistCategory[]
  checklistItems: ChecklistItem[]
  exchangeRates: ExchangeRate[]
}

export async function createShare(payload: SharePayload, passwordHash?: string | null) {
  const ref = await addDoc(collection(db, "shares"), {
    payload,
    tripId: payload.trip.id,
    enabled: true,
    passwordHash: passwordHash || null,
    logs: [],
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateShare(shareId: string, payload: SharePayload) {
  await setDoc(
    doc(db, "shares", shareId),
    {
      payload,
      tripId: payload.trip.id,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  )
}

export async function addShareLog(shareId: string, log: ShareLog) {
  await updateDoc(doc(db, "shares", shareId), {
    logs: arrayUnion({ ...log, createdAt: serverTimestamp() }),
    updatedAt: serverTimestamp(),
  })
}

export async function setShareEnabled(shareId: string, enabled: boolean) {
  await setDoc(
    doc(db, "shares", shareId),
    {
      enabled,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  )
}

export function subscribeShare(
  shareId: string,
  onData: (data: {
    payload?: SharePayload
    enabled: boolean
    passwordHash?: string | null
    logs?: ShareLog[]
  }) => void
) {
  return onSnapshot(doc(db, "shares", shareId), (snapshot) => {
    const data = snapshot.data()
    const enabled = data?.enabled !== false
    onData({
      payload: data?.payload as SharePayload | undefined,
      enabled,
      passwordHash: data?.passwordHash ?? null,
      logs: (data?.logs as ShareLog[]) ?? [],
    })
  })
}

export async function hashPassword(value: string) {
  const encoded = new TextEncoder().encode(value)
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

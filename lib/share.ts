"use client"

import { addDoc, collection, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Trip, Schedule, DayInfo, ChecklistCategory, ChecklistItem, ExchangeRate } from "@/lib/types"

export type SharePayload = {
  version: number
  trip: Trip
  schedules: Schedule[]
  dayInfos: DayInfo[]
  checklistCategories: ChecklistCategory[]
  checklistItems: ChecklistItem[]
  exchangeRates: ExchangeRate[]
}

export async function createShare(payload: SharePayload) {
  const ref = await addDoc(collection(db, "shares"), {
    payload,
    tripId: payload.trip.id,
    enabled: true,
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
  onData: (data: { payload?: SharePayload; enabled: boolean }) => void
) {
  return onSnapshot(doc(db, "shares", shareId), (snapshot) => {
    const data = snapshot.data()
    const enabled = data?.enabled !== false
    onData({ payload: data?.payload as SharePayload | undefined, enabled })
  })
}

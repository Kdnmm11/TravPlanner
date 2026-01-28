"use client"

import {
  addDoc,
  arrayUnion,
  collection,
  deleteField,
  doc,
  onSnapshot,
  orderBy,
  query,
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

export type ShareMember = {
  id: string
  name: string
  role: "admin" | "member"
  lastSeen?: unknown
}

export type ShareMessage = {
  id: string
  user: string
  text: string
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

export async function createShare(
  payload: SharePayload,
  passwordHash?: string | null,
  ownerId?: string,
  ownerName?: string
) {
  const ref = await addDoc(collection(db, "shares"), {
    payload,
    tripId: payload.trip.id,
    enabled: true,
    passwordHash: passwordHash || null,
    logs: [],
    ownerId: ownerId || null,
    members: ownerId
      ? {
          [ownerId]: {
            id: ownerId,
            name: ownerName || "admin",
            role: "admin",
            lastSeen: serverTimestamp(),
          },
        }
      : {},
    bans: [],
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

export async function upsertShareMember(shareId: string, member: ShareMember) {
  await setDoc(
    doc(db, "shares", shareId),
    {
      members: {
        [member.id]: {
          ...member,
          lastSeen: serverTimestamp(),
        },
      },
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  )
}

export async function removeShareMember(shareId: string, memberId: string) {
  await updateDoc(doc(db, "shares", shareId), {
    [`members.${memberId}`]: deleteField(),
    updatedAt: serverTimestamp(),
  })
}

export async function banShareMember(shareId: string, memberId: string) {
  await updateDoc(doc(db, "shares", shareId), {
    bans: arrayUnion(memberId),
    [`members.${memberId}`]: deleteField(),
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
    members?: Record<string, ShareMember>
    bans?: string[]
    ownerId?: string | null
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
      members: (data?.members as Record<string, ShareMember>) ?? {},
      bans: (data?.bans as string[]) ?? [],
      ownerId: data?.ownerId ?? null,
    })
  })
}

export async function hashPassword(value: string) {
  const encoded = new TextEncoder().encode(value)
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

export async function sendShareMessage(shareId: string, message: Omit<ShareMessage, "id">) {
  await addDoc(collection(db, "shares", shareId, "messages"), {
    ...message,
    createdAt: serverTimestamp(),
  })
}

export function subscribeShareMessages(
  shareId: string,
  onData: (messages: ShareMessage[]) => void
) {
  const q = query(collection(db, "shares", shareId, "messages"), orderBy("createdAt", "asc"))
  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<ShareMessage, "id">),
    }))
    onData(messages)
  })
}

"use client"

import {
  addDoc,
  arrayUnion,
  collection,
  deleteField,
  doc,
  type FirestoreError,
  limit,
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
  uid?: string
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
  uid: string
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
  if (!ownerId) {
    throw new Error("owner id is required")
  }
  const ref = await addDoc(collection(db, "shares"), {
    payload,
    tripId: payload.trip.id,
    enabled: true,
    passwordHash: passwordHash || null,
    ownerId,
    members: {
      [ownerId]: {
        id: ownerId,
        name: ownerName || "admin",
        role: "admin",
        lastSeen: serverTimestamp(),
      },
    },
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
  await addDoc(collection(db, "shares", shareId, "logs"), {
    ...log,
    createdAt: serverTimestamp(),
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

export async function setSharePassword(shareId: string, passwordHash: string | null) {
  await setDoc(
    doc(db, "shares", shareId),
    {
      passwordHash: passwordHash || null,
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
    members?: Record<string, ShareMember>
    bans?: string[]
    ownerId?: string | null
  }) => void,
  onError?: (error: FirestoreError) => void
) {
  return onSnapshot(
    doc(db, "shares", shareId),
    (snapshot) => {
      if (!snapshot.exists()) {
        onData({
          enabled: false,
          passwordHash: null,
          members: {},
          bans: [],
          ownerId: null,
        })
        return
      }
      const data = snapshot.data()
      const enabled = data?.enabled !== false
      onData({
        payload: data?.payload as SharePayload | undefined,
        enabled,
        passwordHash: data?.passwordHash ?? null,
        members: (data?.members as Record<string, ShareMember>) ?? {},
        bans: (data?.bans as string[]) ?? [],
        ownerId: data?.ownerId ?? null,
      })
    },
    (error) => {
      onError?.(error)
    }
  )
}

export function subscribeShareLogs(
  shareId: string,
  onData: (logs: ShareLog[]) => void,
  maxLogs = 100,
  onError?: (error: FirestoreError) => void
) {
  const logsQuery = query(
    collection(db, "shares", shareId, "logs"),
    orderBy("createdAt", "desc"),
    limit(maxLogs)
  )
  return onSnapshot(
    logsQuery,
    (snapshot) => {
      const logs = snapshot.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<ShareLog, "id">),
        }))
        .reverse()
      onData(logs)
    },
    (error) => {
      onError?.(error)
    }
  )
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
  onData: (messages: ShareMessage[]) => void,
  maxMessages = 200,
  onError?: (error: FirestoreError) => void
) {
  const q = query(
    collection(db, "shares", shareId, "messages"),
    orderBy("createdAt", "desc"),
    limit(maxMessages)
  )
  return onSnapshot(
    q,
    (snapshot) => {
      const messages = snapshot.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<ShareMessage, "id">),
        }))
        .reverse()
      onData(messages)
    },
    (error) => {
      onError?.(error)
    }
  )
}

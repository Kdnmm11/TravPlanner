"use client"

import {
  addDoc,
  arrayUnion,
  collection,
  deleteField,
  doc,
  type FirestoreError,
  getDocFromServer,
  getDocsFromServer,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import {
  SELF_HOSTED_SHARE_PREFIX,
  type ShareLog,
  type ShareMember,
  type ShareMessage,
  type SharePayload,
  type ShareSnapshotData,
} from "@/lib/share-types"

export type { ShareLog, ShareMember, ShareMessage, SharePayload, ShareSnapshotData } from "@/lib/share-types"

const requestedShareBackend = (
  process.env.NEXT_PUBLIC_SHARE_BACKEND ??
  (process.env.NODE_ENV === "development" ? "selfhost" : "firebase")
).toLowerCase()
const useSelfHostedShareBackend =
  requestedShareBackend === "selfhost" && process.env.NODE_ENV !== "production"

export function isSelfHostedShareId(shareId?: string | null) {
  return Boolean(shareId && shareId.startsWith(SELF_HOSTED_SHARE_PREFIX))
}

function shouldCreateSelfHostedShare() {
  return useSelfHostedShareBackend
}

function createShareError(code: string, message: string) {
  return {
    name: "ShareServiceError",
    code,
    message,
  } as FirestoreError
}

async function readJsonResponse<T>(response: Response) {
  if (!response.ok) {
    let message = response.statusText || "Request failed"
    try {
      const payload = (await response.json()) as { error?: string }
      if (payload.error) {
        message = payload.error
      }
    } catch {
      // ignore non-json error payloads
    }
    throw createShareError(
      response.status === 404 ? "not-found" : response.status === 403 ? "permission-denied" : "unavailable",
      message
    )
  }
  return (await response.json()) as T
}

function subscribeToSelfHostedEvents<T>(
  shareId: string,
  eventName: "snapshot" | "logs" | "messages",
  onData: (data: T) => void,
  onError?: (error: FirestoreError) => void
) {
  const source = new EventSource(`/api/self-host-shares/${encodeURIComponent(shareId)}/events`)
  const handleMessage = (event: MessageEvent<string>) => {
    try {
      onData(JSON.parse(event.data) as T)
    } catch {
      onError?.(createShareError("data-loss", "Invalid self-hosted share event payload"))
    }
  }
  const handleError = () => {
    onError?.(createShareError("unavailable", "Self-hosted share stream disconnected"))
  }

  source.addEventListener(eventName, handleMessage as EventListener)
  source.addEventListener("error", handleError)

  return () => {
    source.removeEventListener(eventName, handleMessage as EventListener)
    source.removeEventListener("error", handleError)
    source.close()
  }
}

function toShareSnapshotData(data?: Record<string, unknown>) {
  const enabled = data?.enabled !== false
  return {
    payload: data?.payload as SharePayload | undefined,
    enabled,
    passwordHash: (data?.passwordHash as string | null | undefined) ?? null,
    members: (data?.members as Record<string, ShareMember>) ?? {},
    bans: (data?.bans as string[]) ?? [],
    ownerId: (data?.ownerId as string | null | undefined) ?? null,
  } satisfies ShareSnapshotData
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

  if (shouldCreateSelfHostedShare()) {
    const response = await fetch("/api/self-host-shares", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        payload,
        passwordHash: passwordHash || null,
        ownerId,
        ownerName,
      }),
    })
    const data = await readJsonResponse<{ shareId: string }>(response)
    return data.shareId
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
  if (isSelfHostedShareId(shareId)) {
    await readJsonResponse(
      await fetch(`/api/self-host-shares/${encodeURIComponent(shareId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ payload }),
      })
    )
    return
  }

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
  if (isSelfHostedShareId(shareId)) {
    await readJsonResponse(
      await fetch(`/api/self-host-shares/${encodeURIComponent(shareId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ log }),
      })
    )
    return
  }

  await addDoc(collection(db, "shares", shareId, "logs"), {
    ...log,
    createdAt: serverTimestamp(),
  })
}

export async function upsertShareMember(shareId: string, member: ShareMember) {
  if (isSelfHostedShareId(shareId)) {
    await readJsonResponse(
      await fetch(`/api/self-host-shares/${encodeURIComponent(shareId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ member }),
      })
    )
    return
  }

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
  if (isSelfHostedShareId(shareId)) {
    await readJsonResponse(
      await fetch(`/api/self-host-shares/${encodeURIComponent(shareId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ removeMemberId: memberId }),
      })
    )
    return
  }

  await updateDoc(doc(db, "shares", shareId), {
    [`members.${memberId}`]: deleteField(),
    updatedAt: serverTimestamp(),
  })
}

export async function banShareMember(shareId: string, memberId: string) {
  if (isSelfHostedShareId(shareId)) {
    await readJsonResponse(
      await fetch(`/api/self-host-shares/${encodeURIComponent(shareId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ banMemberId: memberId }),
      })
    )
    return
  }

  await updateDoc(doc(db, "shares", shareId), {
    bans: arrayUnion(memberId),
    [`members.${memberId}`]: deleteField(),
    updatedAt: serverTimestamp(),
  })
}

export async function setShareEnabled(shareId: string, enabled: boolean) {
  if (isSelfHostedShareId(shareId)) {
    await readJsonResponse(
      await fetch(`/api/self-host-shares/${encodeURIComponent(shareId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ enabled }),
      })
    )
    return
  }

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
  if (isSelfHostedShareId(shareId)) {
    await readJsonResponse(
      await fetch(`/api/self-host-shares/${encodeURIComponent(shareId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ passwordHash: passwordHash || null }),
      })
    )
    return
  }

  await setDoc(
    doc(db, "shares", shareId),
    {
      passwordHash: passwordHash || null,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  )
}

export async function readShareFromServer(shareId: string) {
  if (isSelfHostedShareId(shareId)) {
    return readJsonResponse<ShareSnapshotData>(
      await fetch(`/api/self-host-shares/${encodeURIComponent(shareId)}`, {
        cache: "no-store",
      })
    )
  }

  const snapshot = await getDocFromServer(doc(db, "shares", shareId))
  if (!snapshot.exists()) {
    return {
      enabled: false,
      passwordHash: null,
      members: {},
      bans: [],
      ownerId: null,
    } satisfies ShareSnapshotData
  }
  return toShareSnapshotData(snapshot.data() as Record<string, unknown> | undefined)
}

function getUpdatedAtMillis(value: unknown) {
  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") {
    return value.toMillis()
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? 0 : parsed
  }
  return 0
}

export async function findShareByTripId(tripId: string) {
  if (shouldCreateSelfHostedShare()) {
    try {
      return await readJsonResponse<{ shareId: string; snapshot: ShareSnapshotData }>(
        await fetch(`/api/self-host-shares/by-trip/${encodeURIComponent(tripId)}`, {
          cache: "no-store",
        })
      )
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "not-found"
      ) {
        return null
      }
      throw error
    }
  }

  const snapshot = await getDocsFromServer(query(collection(db, "shares"), where("tripId", "==", tripId), limit(10)))
  if (snapshot.empty) return null

  const bestMatch = snapshot.docs
    .map((docSnapshot) => {
      const data = docSnapshot.data() as Record<string, unknown> | undefined
      return {
        shareId: docSnapshot.id,
        snapshot: toShareSnapshotData(data),
        updatedAt: getUpdatedAtMillis(data?.updatedAt),
      }
    })
    .sort((left, right) => {
      if (left.snapshot.enabled !== right.snapshot.enabled) {
        return left.snapshot.enabled ? -1 : 1
      }
      return right.updatedAt - left.updatedAt
    })[0]

  return bestMatch
    ? {
        shareId: bestMatch.shareId,
        snapshot: bestMatch.snapshot,
      }
    : null
}

export function subscribeShare(
  shareId: string,
  onData: (data: ShareSnapshotData) => void,
  onError?: (error: FirestoreError) => void
) {
  if (isSelfHostedShareId(shareId)) {
    return subscribeToSelfHostedEvents<ShareSnapshotData>(shareId, "snapshot", onData, onError)
  }

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
      onData(toShareSnapshotData(snapshot.data() as Record<string, unknown> | undefined))
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
  if (isSelfHostedShareId(shareId)) {
    return subscribeToSelfHostedEvents<ShareLog[]>(
      shareId,
      "logs",
      (logs) => onData(logs.slice(-maxLogs)),
      onError
    )
  }

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
  if (isSelfHostedShareId(shareId)) {
    await readJsonResponse(
      await fetch(`/api/self-host-shares/${encodeURIComponent(shareId)}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message }),
      })
    )
    return
  }

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
  if (isSelfHostedShareId(shareId)) {
    return subscribeToSelfHostedEvents<ShareMessage[]>(
      shareId,
      "messages",
      (messages) => onData(messages.slice(-maxMessages)),
      onError
    )
  }

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

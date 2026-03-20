import { randomUUID } from "node:crypto"
import { EventEmitter } from "node:events"
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import path from "node:path"
import {
  SELF_HOSTED_SHARE_PREFIX,
  type ShareLog,
  type ShareMember,
  type ShareMessage,
  type SharePayload,
  type ShareSnapshotData,
} from "@/lib/share-types"

type SelfHostedShareRecord = {
  id: string
  payload: SharePayload
  tripId: string
  enabled: boolean
  passwordHash: string | null
  ownerId: string
  members: Record<string, ShareMember>
  bans: string[]
  logs: ShareLog[]
  messages: ShareMessage[]
  updatedAt: string
}

type ShareEvent =
  | { type: "snapshot"; data: ShareSnapshotData }
  | { type: "logs"; data: ShareLog[] }
  | { type: "messages"; data: ShareMessage[] }

const SHARE_ID_PATTERN = new RegExp(`^${SELF_HOSTED_SHARE_PREFIX}[a-z0-9]+$`, "i")
const LOG_LIMIT = 200
const MESSAGE_LIMIT = 500

type StoreState = {
  emitters: Map<string, EventEmitter>
  queues: Map<string, Promise<unknown>>
}

const globalStoreState = globalThis as typeof globalThis & {
  __travSelfHostedShareStore?: StoreState
}

function getStoreState() {
  if (!globalStoreState.__travSelfHostedShareStore) {
    globalStoreState.__travSelfHostedShareStore = {
      emitters: new Map(),
      queues: new Map(),
    }
  }
  return globalStoreState.__travSelfHostedShareStore
}

function getShareDirectory() {
  return path.join(process.cwd(), ".data", "self-host-shares")
}

function getShareFilePath(shareId: string) {
  if (!SHARE_ID_PATTERN.test(shareId)) {
    throw new Error("invalid share id")
  }
  return path.join(getShareDirectory(), `${shareId}.json`)
}

async function ensureShareDirectory() {
  await mkdir(getShareDirectory(), { recursive: true })
}

async function readShareRecord(shareId: string) {
  try {
    const raw = await readFile(getShareFilePath(shareId), "utf8")
    return JSON.parse(raw) as SelfHostedShareRecord
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "ENOENT"
    ) {
      return null
    }
    throw error
  }
}

async function writeShareRecord(record: SelfHostedShareRecord) {
  await ensureShareDirectory()
  await writeFile(getShareFilePath(record.id), JSON.stringify(record, null, 2), "utf8")
}

function getEmitter(shareId: string) {
  const state = getStoreState()
  let emitter = state.emitters.get(shareId)
  if (!emitter) {
    emitter = new EventEmitter()
    emitter.setMaxListeners(50)
    state.emitters.set(shareId, emitter)
  }
  return emitter
}

function toSnapshot(record: SelfHostedShareRecord): ShareSnapshotData {
  return {
    payload: record.payload,
    enabled: record.enabled,
    passwordHash: record.passwordHash,
    members: record.members,
    bans: record.bans,
    ownerId: record.ownerId,
  }
}

function publishShareState(record: SelfHostedShareRecord) {
  const emitter = getEmitter(record.id)
  emitter.emit("event", { type: "snapshot", data: toSnapshot(record) } satisfies ShareEvent)
  emitter.emit("event", { type: "logs", data: record.logs } satisfies ShareEvent)
  emitter.emit("event", { type: "messages", data: record.messages } satisfies ShareEvent)
}

function queueShareMutation<T>(shareId: string, task: () => Promise<T>) {
  const state = getStoreState()
  const prev = state.queues.get(shareId) ?? Promise.resolve()
  const next = prev.catch(() => undefined).then(task)
  state.queues.set(
    shareId,
    next.finally(() => {
      if (state.queues.get(shareId) === next) {
        state.queues.delete(shareId)
      }
    })
  )
  return next
}

async function mutateShareRecord(
  shareId: string,
  updater: (record: SelfHostedShareRecord) => void | Promise<void>
) {
  return queueShareMutation(shareId, async () => {
    const record = await readShareRecord(shareId)
    if (!record) {
      throw new Error("share not found")
    }
    await updater(record)
    record.updatedAt = new Date().toISOString()
    await writeShareRecord(record)
    publishShareState(record)
    return record
  })
}

export function isSelfHostedShareId(shareId?: string | null) {
  return Boolean(shareId && SHARE_ID_PATTERN.test(shareId))
}

export async function createSelfHostedShare(input: {
  payload: SharePayload
  passwordHash?: string | null
  ownerId: string
  ownerName?: string
}) {
  const shareId = `${SELF_HOSTED_SHARE_PREFIX}${randomUUID().replace(/-/g, "").slice(0, 16)}`
  const createdAt = new Date().toISOString()
  const record: SelfHostedShareRecord = {
    id: shareId,
    payload: input.payload,
    tripId: input.payload.trip.id,
    enabled: true,
    passwordHash: input.passwordHash || null,
    ownerId: input.ownerId,
    members: {
      [input.ownerId]: {
        id: input.ownerId,
        name: input.ownerName || "admin",
        role: "admin",
        lastSeen: createdAt,
      },
    },
    bans: [],
    logs: [],
    messages: [],
    updatedAt: createdAt,
  }
  await writeShareRecord(record)
  return shareId
}

export async function getSelfHostedShareSnapshot(shareId: string) {
  const record = await readShareRecord(shareId)
  if (!record) {
    return {
      enabled: false,
      passwordHash: null,
      members: {},
      bans: [],
      ownerId: null,
    } satisfies ShareSnapshotData
  }
  return toSnapshot(record)
}

export async function findSelfHostedShareByTripId(tripId: string) {
  try {
    await ensureShareDirectory()
  } catch {
    return null
  }

  const files = await readdir(getShareDirectory())
  let matchedRecord: SelfHostedShareRecord | null = null

  for (const fileName of files) {
    if (!fileName.endsWith(".json")) continue
    const shareId = fileName.slice(0, -5)
    const record = await readShareRecord(shareId)
    if (!record || record.tripId !== tripId) continue
    if (!matchedRecord) {
      matchedRecord = record
      continue
    }
    if (record.enabled && !matchedRecord.enabled) {
      matchedRecord = record
      continue
    }
    if (record.enabled === matchedRecord.enabled && record.updatedAt > matchedRecord.updatedAt) {
      matchedRecord = record
    }
  }

  if (!matchedRecord) return null

  return {
    shareId: matchedRecord.id,
    snapshot: toSnapshot(matchedRecord),
  }
}

export async function updateSelfHostedSharePayload(shareId: string, payload: SharePayload) {
  await mutateShareRecord(shareId, (record) => {
    record.payload = payload
    record.tripId = payload.trip.id
  })
}

export async function addSelfHostedShareLog(shareId: string, log: ShareLog) {
  await mutateShareRecord(shareId, (record) => {
    record.logs = [
      ...record.logs,
      {
        ...log,
        createdAt: new Date().toISOString(),
      },
    ].slice(-LOG_LIMIT)
  })
}

export async function upsertSelfHostedShareMember(shareId: string, member: ShareMember) {
  await mutateShareRecord(shareId, (record) => {
    record.members = {
      ...record.members,
      [member.id]: {
        ...member,
        lastSeen: new Date().toISOString(),
      },
    }
  })
}

export async function removeSelfHostedShareMember(shareId: string, memberId: string) {
  await mutateShareRecord(shareId, (record) => {
    const nextMembers = { ...record.members }
    delete nextMembers[memberId]
    record.members = nextMembers
  })
}

export async function banSelfHostedShareMember(shareId: string, memberId: string) {
  await mutateShareRecord(shareId, (record) => {
    const nextMembers = { ...record.members }
    delete nextMembers[memberId]
    record.members = nextMembers
    if (!record.bans.includes(memberId)) {
      record.bans = [...record.bans, memberId]
    }
  })
}

export async function setSelfHostedShareEnabled(shareId: string, enabled: boolean) {
  await mutateShareRecord(shareId, (record) => {
    record.enabled = enabled
  })
}

export async function setSelfHostedSharePassword(shareId: string, passwordHash: string | null) {
  await mutateShareRecord(shareId, (record) => {
    record.passwordHash = passwordHash || null
  })
}

export async function addSelfHostedShareMessage(
  shareId: string,
  message: Omit<ShareMessage, "id">
) {
  await mutateShareRecord(shareId, (record) => {
    record.messages = [
      ...record.messages,
      {
        id: randomUUID().replace(/-/g, "").slice(0, 12),
        ...message,
        createdAt: new Date().toISOString(),
      },
    ].slice(-MESSAGE_LIMIT)
  })
}

export async function getSelfHostedShareEvents(shareId: string) {
  const record = await readShareRecord(shareId)
  if (!record) {
    return {
      snapshot: {
        enabled: false,
        passwordHash: null,
        members: {},
        bans: [],
        ownerId: null,
      } satisfies ShareSnapshotData,
      logs: [] as ShareLog[],
      messages: [] as ShareMessage[],
    }
  }
  return {
    snapshot: toSnapshot(record),
    logs: record.logs,
    messages: record.messages,
  }
}

export function subscribeToSelfHostedShareEvents(
  shareId: string,
  listener: (event: ShareEvent) => void
) {
  const emitter = getEmitter(shareId)
  emitter.on("event", listener)
  return () => {
    emitter.off("event", listener)
  }
}

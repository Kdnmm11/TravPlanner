"use client"

export type DebugLogLevel = "info" | "warn" | "error"

export type DebugLogEntry = {
  id: string
  ts: number
  scope: string
  event: string
  level: DebugLogLevel
  detail?: string
  data?: unknown
}

type DebugLogStore = {
  entries: DebugLogEntry[]
  listeners: Set<(entries: DebugLogEntry[]) => void>
}

const MAX_LOGS = 1200
const DEBUG_STORE_KEY = "__trav_debug_log_store__"

function getStore(): DebugLogStore {
  const scoped = globalThis as typeof globalThis & {
    [DEBUG_STORE_KEY]?: DebugLogStore
  }
  if (!scoped[DEBUG_STORE_KEY]) {
    scoped[DEBUG_STORE_KEY] = {
      entries: [],
      listeners: new Set(),
    }
  }
  return scoped[DEBUG_STORE_KEY]
}

export function getDebugLogs() {
  return getStore().entries
}

export function subscribeDebugLogs(listener: (entries: DebugLogEntry[]) => void) {
  const store = getStore()
  store.listeners.add(listener)
  listener(store.entries)
  return () => {
    store.listeners.delete(listener)
  }
}

export function clearDebugLogs() {
  const store = getStore()
  store.entries = []
  notify(store)
}

export function addDebugLog(input: {
  scope: string
  event: string
  level?: DebugLogLevel
  detail?: string
  data?: unknown
}) {
  const store = getStore()
  const entry: DebugLogEntry = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(),
    scope: input.scope,
    event: input.event,
    level: input.level ?? "info",
    detail: input.detail,
    data: sanitizeData(input.data),
  }
  const next = [...store.entries, entry]
  store.entries = next.slice(Math.max(0, next.length - MAX_LOGS))
  notify(store)
}

function notify(store: DebugLogStore) {
  for (const listener of store.listeners) {
    listener(store.entries)
  }
}

function sanitizeData(data: unknown) {
  if (data === undefined) return undefined
  try {
    return JSON.parse(
      JSON.stringify(data, (_key, value: unknown) => {
        if (value instanceof Error) {
          return {
            name: value.name,
            message: value.message,
            stack: value.stack,
          }
        }
        return value
      })
    )
  } catch {
    return String(data)
  }
}

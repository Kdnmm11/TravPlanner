import type { Trip, Schedule, DayInfo, ChecklistCategory, ChecklistItem, ExchangeRate } from "@/lib/types"

export const SELF_HOSTED_SHARE_PREFIX = "self_"

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

export type ShareSnapshotData = {
  payload?: SharePayload
  enabled: boolean
  passwordHash?: string | null
  members?: Record<string, ShareMember>
  bans?: string[]
  ownerId?: string | null
}

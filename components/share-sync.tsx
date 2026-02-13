"use client"

import { useEffect, useRef } from "react"
import { useTravelStore } from "@/lib/store"
import { addShareLog, subscribeShare, subscribeShareLogs, updateShare, upsertShareMember } from "@/lib/share"
import type { ShareLog, ShareMember, SharePayload } from "@/lib/share"

export function ShareSync({
  shareId,
  tripId,
  onStatusChange,
  onSync,
  onError,
  localPasswordHash,
  onAuthRequired,
  onLogsChange,
  actorName,
  clientId,
  actorRole = "member",
  onMembersChange,
  onAccessDenied,
  onShareDisabled,
}: {
  shareId: string
  tripId: string
  onStatusChange?: (enabled: boolean) => void
  onSync?: (direction: "push" | "pull") => void
  onError?: (message: string) => void
  localPasswordHash?: string | null
  onAuthRequired?: (required: boolean) => void
  onLogsChange?: (logs: ShareLog[]) => void
  actorName?: string
  clientId?: string | null
  actorRole?: "admin" | "member"
  onMembersChange?: (members: ShareMember[], ownerId?: string | null) => void
  onAccessDenied?: (denied: boolean) => void
  onShareDisabled?: (disabled: boolean, ownerId?: string | null) => void
}) {
  const exportTripData = useTravelStore((state) => state.exportTripData)
  const replaceTripData = useTravelStore((state) => state.replaceTripData)
  const applyRemoteRef = useRef(false)
  const debounceRef = useRef<number | null>(null)
  const shareEnabledRef = useRef(true)
  const passwordRequiredRef = useRef(false)
  const lastPayloadRef = useRef<SharePayload | null>(null)
  const lastLogRef = useRef<{ action: string; time: number } | null>(null)
  const accessDeniedRef = useRef(false)

  useEffect(() => {
    if (!shareId) return
    const unsubscribe = subscribeShare(shareId, ({ payload, enabled, passwordHash, members, bans, ownerId }) => {
      shareEnabledRef.current = enabled
      onStatusChange?.(enabled)
      onMembersChange?.(Object.values(members ?? {}), ownerId)
      const requiresPassword = Boolean(passwordHash)
      passwordRequiredRef.current = requiresPassword
      const isAdmin = actorRole === "admin"
      const authed =
        !requiresPassword ||
        (localPasswordHash && localPasswordHash === passwordHash) ||
        isAdmin
      onAuthRequired?.(!authed && requiresPassword)
      const denied = clientId ? (bans ?? []).includes(clientId) : false
      accessDeniedRef.current = denied
      onAccessDenied?.(denied)
      if (!enabled) {
        onShareDisabled?.(true, ownerId)
      } else {
        onShareDisabled?.(false, ownerId)
      }
      if (denied || !authed || !enabled || !payload) return
      if (!isValidSharePayload(payload)) {
        onError?.("공유 데이터 형식 오류")
        return
      }
      applyRemoteRef.current = true
      replaceTripData(payload)
      onSync?.("pull")
      lastPayloadRef.current = payload
      window.setTimeout(() => {
        applyRemoteRef.current = false
      }, 0)
    })
    return () => unsubscribe()
  }, [
    shareId,
    replaceTripData,
    onStatusChange,
    onSync,
    localPasswordHash,
    onAuthRequired,
    onMembersChange,
    clientId,
    onAccessDenied,
    onShareDisabled,
    onError,
  ])

  useEffect(() => {
    if (!shareId || !onLogsChange) return
    const unsubscribe = subscribeShareLogs(shareId, onLogsChange, 100)
    return () => unsubscribe()
  }, [shareId, onLogsChange])

  useEffect(() => {
    if (!shareId || !tripId) return
    const unsubscribe = useTravelStore.subscribe(() => {
      if (applyRemoteRef.current) return
      if (!shareEnabledRef.current) return
      if (passwordRequiredRef.current && !localPasswordHash && actorRole !== "admin") return
      if (accessDeniedRef.current) return
      const payload = exportTripData(tripId)
      if (!payload) return
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
      debounceRef.current = window.setTimeout(() => {
        updateShare(shareId, payload)
          .then(() => {
            onSync?.("push")
            const action = describeChange(lastPayloadRef.current, payload)
            if (action) {
              const now = Date.now()
              const last = lastLogRef.current
              if (!last || last.action !== action || now - last.time > 2000) {
                if (clientId) {
                  addShareLog(shareId, {
                    id: Math.random().toString(36).slice(2, 9),
                    uid: clientId,
                    user: actorName?.trim() || "익명",
                    action,
                    clientTs: Date.now(),
                  }).catch(() => undefined)
                }
                lastLogRef.current = { action, time: now }
              }
            }
            lastPayloadRef.current = payload
          })
          .catch((error) => {
            console.error("Share update failed", error)
            onError?.("업로드 실패")
          })
      }, 100)
    })
    return () => {
      unsubscribe()
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current)
      }
    }
  }, [shareId, tripId, exportTripData])

  useEffect(() => {
    if (actorRole !== "admin") return
    if (!shareId || !clientId || !actorName) return
    const member: ShareMember = {
      id: clientId,
      name: actorName,
      role: actorRole,
    }
    upsertShareMember(shareId, member).catch(() => undefined)
    const interval = window.setInterval(() => {
      upsertShareMember(shareId, member).catch(() => undefined)
    }, 15000)
    return () => window.clearInterval(interval)
  }, [shareId, clientId, actorName, actorRole])

  return null
}

function describeChange(prev: SharePayload | null, next: SharePayload) {
  if (!prev) return "공유 시작"
  if (next.schedules.length > prev.schedules.length) return "일정 추가"
  if (next.schedules.length < prev.schedules.length) return "일정 삭제"
  if (next.dayInfos.length !== prev.dayInfos.length) return "도시/숙소 변경"
  if (next.checklistItems.length > prev.checklistItems.length) return "체크리스트 추가"
  if (next.checklistItems.length < prev.checklistItems.length) return "체크리스트 삭제"
  if (next.exchangeRates.length !== prev.exchangeRates.length) return "환율 변경"
  if (next.schedules !== prev.schedules) return "일정 수정"
  return "내용 수정"
}

function isValidSharePayload(payload: unknown): payload is SharePayload {
  if (!payload || typeof payload !== "object") return false
  const candidate = payload as Record<string, unknown>
  const trip = candidate.trip
  if (!trip || typeof trip !== "object") return false
  const tripCandidate = trip as Record<string, unknown>
  if (
    typeof tripCandidate.id !== "string" ||
    typeof tripCandidate.title !== "string" ||
    typeof tripCandidate.destination !== "string" ||
    typeof tripCandidate.startDate !== "string" ||
    typeof tripCandidate.endDate !== "string"
  ) {
    return false
  }

  return (
    (candidate.version === undefined || typeof candidate.version === "number") &&
    Array.isArray(candidate.schedules) &&
    Array.isArray(candidate.dayInfos) &&
    Array.isArray(candidate.checklistCategories) &&
    Array.isArray(candidate.checklistItems) &&
    Array.isArray(candidate.exchangeRates)
  )
}

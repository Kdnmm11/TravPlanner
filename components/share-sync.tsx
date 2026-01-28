"use client"

import { useEffect, useRef } from "react"
import { useTravelStore } from "@/lib/store"
import { addShareLog, subscribeShare, updateShare } from "@/lib/share"
import type { ShareLog, SharePayload } from "@/lib/share"

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
}) {
  const exportTripData = useTravelStore((state) => state.exportTripData)
  const replaceTripData = useTravelStore((state) => state.replaceTripData)
  const applyRemoteRef = useRef(false)
  const debounceRef = useRef<number | null>(null)
  const shareEnabledRef = useRef(true)
  const passwordRequiredRef = useRef(false)
  const lastPayloadRef = useRef<SharePayload | null>(null)
  const lastLogRef = useRef<{ action: string; time: number } | null>(null)

  useEffect(() => {
    if (!shareId) return
    const unsubscribe = subscribeShare(shareId, ({ payload, enabled, passwordHash, logs }) => {
      shareEnabledRef.current = enabled
      onStatusChange?.(enabled)
      onLogsChange?.(logs ?? [])
      const requiresPassword = Boolean(passwordHash)
      passwordRequiredRef.current = requiresPassword
      const authed = !requiresPassword || (localPasswordHash && localPasswordHash === passwordHash)
      onAuthRequired?.(!authed && requiresPassword)
      if (!authed || !enabled || !payload) return
      applyRemoteRef.current = true
      replaceTripData(payload)
      onSync?.("pull")
      lastPayloadRef.current = payload
      window.setTimeout(() => {
        applyRemoteRef.current = false
      }, 0)
    })
    return () => unsubscribe()
  }, [shareId, replaceTripData, onStatusChange, onSync, localPasswordHash, onAuthRequired, onLogsChange])

  useEffect(() => {
    if (!shareId || !tripId) return
    const unsubscribe = useTravelStore.subscribe(() => {
      if (applyRemoteRef.current) return
      if (!shareEnabledRef.current) return
      if (passwordRequiredRef.current && !localPasswordHash) return
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
                addShareLog(shareId, {
                  id: Math.random().toString(36).slice(2, 9),
                  user: actorName?.trim() || "익명",
                  action,
                  clientTs: Date.now(),
                }).catch(() => undefined)
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

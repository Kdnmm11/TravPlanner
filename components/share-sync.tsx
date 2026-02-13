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
  const pushInFlightRef = useRef(false)
  const pendingPayloadSignatureRef = useRef<string | null>(null)
  const shareEnabledRef = useRef(true)
  const passwordRequiredRef = useRef(false)
  const lastPayloadRef = useRef<SharePayload | null>(null)
  const lastLogRef = useRef<{ action: string; time: number } | null>(null)
  const accessDeniedRef = useRef(false)
  const syncBlockedRef = useRef(false)
  const lastStatusRef = useRef<string | null>(null)
  const isLocalFallbackClient = Boolean(clientId && clientId.startsWith("local-"))

  const emitStatus = (message: string | null) => {
    if (lastStatusRef.current === message) return
    lastStatusRef.current = message
    onError?.(message ?? "")
  }

  useEffect(() => {
    if (!shareId) return
    if (!clientId || isLocalFallbackClient) {
      shareEnabledRef.current = false
      if (!clientId) {
        emitStatus("인증 초기화 중입니다. 잠시 후 다시 시도해 주세요.")
      } else {
        emitStatus("Firebase 인증 설정 문제로 실시간 동기화를 사용할 수 없습니다.")
      }
      return
    }
    syncBlockedRef.current = false
    const unsubscribe = subscribeShare(
      shareId,
      ({ payload, enabled, passwordHash, members, bans, ownerId }) => {
        syncBlockedRef.current = false
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
        if (denied) {
          emitStatus("공유 접근이 차단되어 실시간 동기화가 중단되었습니다.")
          return
        }
        if (!enabled) {
          emitStatus("공유가 꺼져 있어 실시간 동기화가 중단되었습니다.")
          return
        }
        if (!authed && requiresPassword) {
          emitStatus("공유 비밀번호 인증이 필요합니다.")
          return
        }
        if (!payload) {
          emitStatus("공유 데이터를 불러오는 중입니다.")
          return
        }
        if (!isValidSharePayload(payload)) {
          emitStatus("공유 데이터 형식 오류")
          return
        }
        const incomingSignature = createPayloadSignature(payload)
        const pendingSignature = pendingPayloadSignatureRef.current
        if (pendingSignature) {
          if (incomingSignature === pendingSignature) {
            pendingPayloadSignatureRef.current = null
          } else if (debounceRef.current !== null || pushInFlightRef.current) {
            return
          }
        }
        emitStatus(null)
        applyRemoteRef.current = true
        replaceTripData(payload)
        onSync?.("pull")
        lastPayloadRef.current = payload
        window.setTimeout(() => {
          applyRemoteRef.current = false
        }, 0)
      },
      (error) => {
        console.error("Share subscription failed", error)
        syncBlockedRef.current = true
        shareEnabledRef.current = false
        if (isAuthErrorCode(error.code) || error.code === "not-found") {
          onShareDisabled?.(true, null)
        }
        emitStatus(toShareErrorMessage(error.code))
      }
    )
    return () => unsubscribe()
  }, [
    shareId,
    clientId,
    isLocalFallbackClient,
    actorRole,
    replaceTripData,
    onStatusChange,
    onSync,
    localPasswordHash,
    onAuthRequired,
    onMembersChange,
    onAccessDenied,
    onShareDisabled,
    onError,
  ])

  useEffect(() => {
    if (!shareId || !onLogsChange) return
    if (!clientId || isLocalFallbackClient) return
    const unsubscribe = subscribeShareLogs(
      shareId,
      onLogsChange,
      100,
      (error) => {
        console.error("Share logs subscription failed", error)
      }
    )
    return () => unsubscribe()
  }, [shareId, onLogsChange, clientId, isLocalFallbackClient])

  useEffect(() => {
    if (!shareId || !tripId) return
    if (!clientId || isLocalFallbackClient) return
    const unsubscribe = useTravelStore.subscribe(() => {
      if (applyRemoteRef.current) return
      if (syncBlockedRef.current) return
      if (!shareEnabledRef.current) return
      if (passwordRequiredRef.current && !localPasswordHash && actorRole !== "admin") return
      if (accessDeniedRef.current) return
      const payload = exportTripData(tripId)
      if (!payload) return
      pendingPayloadSignatureRef.current = createPayloadSignature(payload)
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
      debounceRef.current = window.setTimeout(() => {
        debounceRef.current = null
        pushInFlightRef.current = true
        updateShare(shareId, payload)
          .then(() => {
            pushInFlightRef.current = false
            pendingPayloadSignatureRef.current = null
            emitStatus(null)
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
            pushInFlightRef.current = false
            pendingPayloadSignatureRef.current = null
            console.error("Share update failed", error)
            const code =
              typeof error === "object" &&
              error !== null &&
              "code" in error &&
              typeof (error as { code?: unknown }).code === "string"
                ? (error as { code: string }).code
                : undefined
            if (isAuthErrorCode(code)) {
              syncBlockedRef.current = true
            }
            if (isAuthErrorCode(code) || code === "not-found") {
              onShareDisabled?.(true, null)
            }
            emitStatus(toShareErrorMessage(code))
          })
      }, 100)
    })
    return () => {
      unsubscribe()
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current)
      }
      debounceRef.current = null
      pushInFlightRef.current = false
      pendingPayloadSignatureRef.current = null
    }
  }, [shareId, tripId, exportTripData, localPasswordHash, actorRole, clientId, actorName, onSync, onError, onShareDisabled, isLocalFallbackClient])

  useEffect(() => {
    if (actorRole !== "admin") return
    if (!shareId || !clientId || !actorName || isLocalFallbackClient) return
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
  }, [shareId, clientId, actorName, actorRole, isLocalFallbackClient])

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

function createPayloadSignature(payload: SharePayload) {
  return JSON.stringify(payload)
}

function isAuthErrorCode(code?: string) {
  return code === "permission-denied" || code === "unauthenticated"
}

function toShareErrorMessage(code?: string) {
  if (isAuthErrorCode(code)) {
    return "인증/권한 문제로 실시간 동기화가 중단되었습니다."
  }
  if (code === "not-found") {
    return "공유 문서를 찾을 수 없습니다. 링크가 만료되었거나 삭제되었습니다."
  }
  if (code === "unavailable" || code === "deadline-exceeded") {
    return "네트워크 문제로 실시간 동기화가 지연되고 있습니다."
  }
  return "실시간 동기화 중 오류가 발생했습니다."
}

"use client"

import { useEffect, useRef } from "react"
import { useTravelStore } from "@/lib/store"
import { subscribeShare, updateShare } from "@/lib/share"

export function ShareSync({
  shareId,
  tripId,
  onStatusChange,
  onSync,
  onError,
}: {
  shareId: string
  tripId: string
  onStatusChange?: (enabled: boolean) => void
  onSync?: (direction: "push" | "pull") => void
  onError?: (message: string) => void
}) {
  const exportTripData = useTravelStore((state) => state.exportTripData)
  const replaceTripData = useTravelStore((state) => state.replaceTripData)
  const applyRemoteRef = useRef(false)
  const debounceRef = useRef<number | null>(null)
  const shareEnabledRef = useRef(true)

  useEffect(() => {
    if (!shareId) return
    const unsubscribe = subscribeShare(shareId, ({ payload, enabled }) => {
      shareEnabledRef.current = enabled
      onStatusChange?.(enabled)
      if (!enabled || !payload) return
      applyRemoteRef.current = true
      replaceTripData(payload)
      onSync?.("pull")
      window.setTimeout(() => {
        applyRemoteRef.current = false
      }, 0)
    })
    return () => unsubscribe()
  }, [shareId, replaceTripData, onStatusChange])

  useEffect(() => {
    if (!shareId || !tripId) return
    const unsubscribe = useTravelStore.subscribe(() => {
      if (applyRemoteRef.current) return
      if (!shareEnabledRef.current) return
      const payload = exportTripData(tripId)
      if (!payload) return
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
      debounceRef.current = window.setTimeout(() => {
        updateShare(shareId, payload)
          .then(() => {
            onSync?.("push")
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

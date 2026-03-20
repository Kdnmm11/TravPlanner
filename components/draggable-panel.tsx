"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

type Offset = {
  x: number
  y: number
}

interface DraggablePanelProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultOffset?: Offset
  handleLabel?: string
}

const viewportMargin = 16

export function DraggablePanel({
  children,
  className,
  defaultOffset = { x: 0, y: 0 },
  handleLabel = "팝업 이동",
  style,
  ...props
}: DraggablePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const dragStateRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    origin: Offset
  } | null>(null)
  const [offset, setOffset] = useState(defaultOffset)

  const clampOffset = (next: Offset) => {
    if (typeof window === "undefined") return next
    const width = panelRef.current?.offsetWidth ?? 0
    const height = panelRef.current?.offsetHeight ?? 0
    const maxX = Math.max(0, window.innerWidth / 2 - width / 2 - viewportMargin)
    const maxY = Math.max(0, window.innerHeight / 2 - height / 2 - viewportMargin)

    return {
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y)),
    }
  }

  useEffect(() => {
    setOffset(clampOffset(defaultOffset))
    // Only reset when the requested default position changes.
    // Remount-on-open patterns in this app handle the common case.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultOffset.x, defaultOffset.y])

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current
      if (!dragState || dragState.pointerId !== event.pointerId) return

      setOffset(
        clampOffset({
          x: dragState.origin.x + event.clientX - dragState.startX,
          y: dragState.origin.y + event.clientY - dragState.startY,
        })
      )
    }

    const handlePointerEnd = (event: PointerEvent) => {
      const dragState = dragStateRef.current
      if (!dragState || dragState.pointerId !== event.pointerId) return
      dragStateRef.current = null
    }

    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", handlePointerEnd)
    window.addEventListener("pointercancel", handlePointerEnd)

    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerEnd)
      window.removeEventListener("pointercancel", handlePointerEnd)
    }
  }, [])

  return (
    <div
      ref={panelRef}
      className={cn("fixed left-1/2 top-1/2 z-[60] w-full", className)}
      style={{
        ...style,
        transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
      }}
      {...props}
    >
      <div className="flex justify-center pb-3">
        <button
          type="button"
          aria-label={handleLabel}
          onPointerDown={(event) => {
            if (event.button !== 0) return
            event.preventDefault()
            const origin = clampOffset(offset)
            dragStateRef.current = {
              pointerId: event.pointerId,
              startX: event.clientX,
              startY: event.clientY,
              origin,
            }
            setOffset(origin)
          }}
          className="cursor-grab touch-none rounded-full px-4 py-1 active:cursor-grabbing"
        >
          <span className="block h-1.5 w-14 rounded-full bg-slate-300" />
        </button>
      </div>
      {children}
    </div>
  )
}

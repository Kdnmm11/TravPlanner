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
  anchorOffset?: Offset
  handleOffset?: Offset
  floatingHandle?: boolean
  frameClassName?: string
  frameStyle?: React.CSSProperties
}

const viewportMargin = 16

export function DraggablePanel({
  children,
  className,
  defaultOffset = { x: 0, y: 0 },
  handleLabel = "팝업 이동",
  anchorOffset = { x: 0, y: 0 },
  handleOffset = { x: 0, y: 0 },
  floatingHandle = false,
  frameClassName,
  frameStyle,
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
    const minX =
      viewportMargin + width / 2 - window.innerWidth / 2 - anchorOffset.x
    const maxX =
      window.innerWidth / 2 - width / 2 - viewportMargin - anchorOffset.x
    const minY =
      viewportMargin + height / 2 - window.innerHeight / 2 - anchorOffset.y
    const maxY =
      window.innerHeight / 2 - height / 2 - viewportMargin - anchorOffset.y

    return {
      x: Math.min(maxX, Math.max(minX, next.x)),
      y: Math.min(maxY, Math.max(minY, next.y)),
    }
  }

  useEffect(() => {
    setOffset(clampOffset(defaultOffset))
    // Only reset when the requested default position changes.
    // Remount-on-open patterns in this app handle the common case.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultOffset.x, defaultOffset.y])

  useEffect(() => {
    setOffset((current) => clampOffset(current))
    // Keep the current drag position when the anchor changes; only re-clamp bounds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorOffset.x, anchorOffset.y])

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
        transform: `translate(-50%, -50%) translate(${anchorOffset.x + offset.x}px, ${anchorOffset.y + offset.y}px)`,
      }}
      {...props}
    >
      <div className={cn("relative w-full", frameClassName)} style={frameStyle}>
        <div
          className={cn(
            "flex justify-center",
            floatingHandle ? "pointer-events-none absolute left-0 right-0 top-0 z-20" : "pb-3"
          )}
          style={{
            transform: `translate(${handleOffset.x}px, ${handleOffset.y}px)`,
          }}
        >
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
            className={cn(
              "cursor-grab touch-none rounded-full px-4 py-1 active:cursor-grabbing",
              floatingHandle && "pointer-events-auto"
            )}
          >
            <span className="block h-1.5 w-14 rounded-full bg-slate-300" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

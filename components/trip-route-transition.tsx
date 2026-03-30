"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"

import { cn } from "@/lib/utils"

interface TripRouteTransitionProps {
  children: ReactNode
  className?: string
}

export function TripRouteTransition({
  children,
  className,
}: TripRouteTransitionProps) {
  const [visible, setVisible] = useState(false)
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = window.requestAnimationFrame(() => {
        setVisible(true)
        frameRef.current = null
      })
    })

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
    }
  }, [])

  return (
    <main
      className={cn(
        "transition-opacity duration-200 ease-out motion-reduce:transition-none",
        visible ? "opacity-100" : "opacity-0",
        className,
      )}
      style={{ willChange: "opacity" }}
    >
      {children}
    </main>
  )
}

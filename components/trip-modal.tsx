"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { DateRangePicker } from "@/components/date-range-picker"
import type { Trip, TripFormData } from "@/lib/types"

interface TripModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: TripFormData) => void
  mode: "add" | "edit"
  initialData?: Trip | null
}

export function TripModal({ isOpen, onClose, onSubmit, mode, initialData }: TripModalProps) {
  const [name, setName] = useState("")
  const [destination, setDestination] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const dragOffsetRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    if (initialData && mode === "edit") {
      setName(initialData.title)
      setDestination(initialData.destination)
      setStartDate(initialData.startDate)
      setEndDate(initialData.endDate)
    } else {
      setName("")
      setDestination("")
      setStartDate("")
      setEndDate("")
    }
  }, [initialData, mode, isOpen])

  useEffect(() => {
    if (!isOpen) return
    setPosition({ x: 508, y: 124 })
  }, [isOpen])

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !destination || !startDate || !endDate) return
    onSubmit({ title: name, destination, startDate, endDate })
    onClose()
  }

  const handleDateChange = (start: string, end: string) => {
    setStartDate(start)
    setEndDate(end)
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.currentTarget
    const modal = target.closest("[data-trip-modal]") as HTMLElement | null
    const rect = modal?.getBoundingClientRect() ?? target.getBoundingClientRect()
    dragOffsetRef.current = { x: event.clientX - rect.left, y: event.clientY - rect.top }
    target.setPointerCapture(event.pointerId)

    const handleMove = (moveEvent: PointerEvent) => {
      const nextX = Math.max(12, moveEvent.clientX - dragOffsetRef.current.x)
      const nextY = Math.max(12, moveEvent.clientY - dragOffsetRef.current.y)
      setPosition({ x: nextX, y: nextY })
    }

    const handleUp = () => {
      target.releasePointerCapture(event.pointerId)
      window.removeEventListener("pointermove", handleMove)
      window.removeEventListener("pointerup", handleUp)
    }

    window.addEventListener("pointermove", handleMove)
    window.addEventListener("pointerup", handleUp, { once: true })
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        data-trip-modal
        className="fixed bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100"
        style={{ left: `${position.x}px`, top: `${position.y}px` }}
      >
        <div
          className="sticky top-0 bg-white px-6 pt-6 pb-4 border-b border-slate-100 z-10 cursor-move select-none"
          onPointerDown={handlePointerDown}
        >
          <h2 className="text-xl font-bold text-slate-900">
            {mode === "add" ? "새 여행 만들기" : "여행 수정하기"}
          </h2>
          <p className="text-xs text-slate-400 mt-1">x: {Math.round(position.x)} / y: {Math.round(position.y)}</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              여행 이름
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="도쿄 여행"
              className="w-full rounded-lg bg-slate-100 px-3 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              목적지
            </label>
            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="일본 도쿄"
              className="w-full rounded-lg bg-slate-100 px-3 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              여행 날짜
            </label>
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onDateChange={handleDateChange}
            />
          </div>
          
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 bg-transparent"
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={!name || !destination || !startDate || !endDate}
              className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              {mode === "add" ? "만들기" : "수정하기"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

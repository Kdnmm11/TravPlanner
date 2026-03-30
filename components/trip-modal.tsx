"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { DateRangePicker } from "@/components/date-range-picker"
import { DraggablePanel } from "@/components/draggable-panel"
import type { Trip, TripFormData } from "@/lib/types"

interface TripModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: TripFormData) => void
  mode: "add" | "edit"
  initialData?: Trip | null
}

export function TripModal({ isOpen, onClose, onSubmit, mode, initialData }: TripModalProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const modalContentRef = useRef<HTMLDivElement>(null)
  const datePanelHostRef = useRef<HTMLDivElement>(null)
  const [name, setName] = useState("")
  const [destination, setDestination] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

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
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return
      if (event.key === "Escape") {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== "Enter" || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      const target = event.target
      if (
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLButtonElement ||
        (target instanceof HTMLElement && target.closest("[data-keyboard-ignore='true']"))
      ) {
        return
      }
      event.preventDefault()
      formRef.current?.requestSubmit()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

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

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <DraggablePanel
        data-trip-modal
        className="w-[min(28rem,calc(100vw-2rem))] max-w-none"
        handleOffset={{ x: 0, y: 10 }}
        floatingHandle
      >
        <div ref={datePanelHostRef} className="relative overflow-visible">
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl">
            <div
              ref={modalContentRef}
              className="sticky top-0 z-10 border-b border-slate-100 bg-white px-6 pt-8 pb-4"
            >
              <h2 className="text-xl font-bold text-slate-900">
                {mode === "add" ? "새 여행 만들기" : "여행 수정하기"}
              </h2>
            </div>

            <form ref={formRef} onSubmit={handleSubmit} className="space-y-5 p-6">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
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
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
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
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  여행 날짜
                </label>
                <DateRangePicker
                  startDate={startDate}
                  endDate={endDate}
                  onDateChange={handleDateChange}
                  anchorRef={modalContentRef}
                  portalHostRef={datePanelHostRef}
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
                  className="flex-1 bg-emerald-500 text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {mode === "add" ? "만들기" : "수정하기"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </DraggablePanel>
    </div>
  )
}

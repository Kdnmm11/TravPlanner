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
      <div
        data-trip-modal
        className="fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100"
      >
        <div
          className="sticky top-0 bg-white px-6 pt-6 pb-4 border-b border-slate-100 z-10"
        >
          <h2 className="text-xl font-bold text-slate-900">
            {mode === "add" ? "새 여행 만들기" : "여행 수정하기"}
          </h2>
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

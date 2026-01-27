"use client"

import { useEffect, useState } from "react"
import { ChevronDown } from "lucide-react"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface DayInfoModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (values: {
    city: string
    accommodation: string
    checkInDay: string
    checkInTime: string
    checkOutDay: string
    checkOutTime: string
  }) => void
  dayNumber: number
  tripDuration: number
  initialCity?: string
  initialAccommodation?: string
  initialCheckInDay?: string
  initialCheckInTime?: string
  initialCheckOutDay?: string
  initialCheckOutTime?: string
}

export function DayInfoModal({
  isOpen,
  onClose,
  onSave,
  dayNumber,
  tripDuration,
  initialCity = "",
  initialAccommodation = "",
  initialCheckInDay = "",
  initialCheckInTime = "15:00",
  initialCheckOutDay = "",
  initialCheckOutTime = "11:00",
}: DayInfoModalProps) {
  const makeCityKey = () => Math.random().toString(36).slice(2, 9)
  const buildCityEntries = (value: string) => {
    const parts = value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
    const fallback = parts.length === 0 ? [""] : parts
    return fallback.map((part) => ({ id: makeCityKey(), value: part }))
  }

  const [cityEntries, setCityEntries] = useState(() => buildCityEntries(initialCity))
  const [accommodation, setAccommodation] = useState(initialAccommodation)
  const [checkInDay, setCheckInDay] = useState(initialCheckInDay || `Day ${dayNumber}`)
  const [checkInTime, setCheckInTime] = useState(initialCheckInTime || "15:00")
  const [checkOutDay, setCheckOutDay] = useState(
    initialCheckOutDay || `Day ${Math.min(tripDuration, dayNumber + 1)}`
  )
  const [checkOutTime, setCheckOutTime] = useState(initialCheckOutTime || "11:00")
  const [dayDropdownOpen, setDayDropdownOpen] = useState<"checkInDay" | "checkOutDay" | null>(null)
  const [timeEditOpen, setTimeEditOpen] = useState<"checkInTime" | "checkOutTime" | null>(null)
  const [timeDraft, setTimeDraft] = useState({ hour: "", minute: "" })
  const timePopupOffset = { x: 9, y: -42 }

  const openTimeEditor = (field: "checkInTime" | "checkOutTime") => {
    if (timeEditOpen === field) {
      setTimeEditOpen(null)
      return
    }
    const value = field === "checkInTime" ? checkInTime : checkOutTime
    const [hour = "", minute = ""] = value.split(":")
    setTimeDraft({ hour, minute })
    setTimeEditOpen(field)
  }

  const applyTimeEditor = () => {
    const normalizedHour = Math.min(23, Math.max(0, Number(timeDraft.hour) || 0))
    const normalizedMinute = Math.min(59, Math.max(0, Number(timeDraft.minute) || 0))
    const minuteRounded = Math.round(normalizedMinute / 5) * 5
    const minuteValue = String(minuteRounded === 60 ? 55 : minuteRounded).padStart(2, "0")
    const hourValue = String(minuteRounded === 60 ? Math.min(23, normalizedHour + 1) : normalizedHour).padStart(2, "0")
    const timeValue = `${hourValue}:${minuteValue}`
    if (timeEditOpen === "checkInTime") {
      setCheckInTime(timeValue)
    } else if (timeEditOpen === "checkOutTime") {
      setCheckOutTime(timeValue)
    }
    setTimeEditOpen(null)
  }

  useEffect(() => {
    if (isOpen) {
      setCityEntries(buildCityEntries(initialCity))
      setAccommodation(initialAccommodation)
      setCheckInDay(initialCheckInDay || `Day ${dayNumber}`)
      setCheckInTime(initialCheckInTime || "15:00")
      setCheckOutDay(initialCheckOutDay || `Day ${Math.min(tripDuration, dayNumber + 1)}`)
      setCheckOutTime(initialCheckOutTime || "11:00")
    }
  }, [isOpen, dayNumber, tripDuration, initialCity, initialAccommodation, initialCheckInDay, initialCheckInTime, initialCheckOutDay, initialCheckOutTime])

  const dayOptions = Array.from({ length: Math.max(1, tripDuration) }, (_, index) => `Day ${index + 1}`)

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md" data-dayinfo-dialog>
        <DialogHeader>
          <DialogTitle>Day {dayNumber} 도시/숙소</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">도시</label>
              <button
                type="button"
                onClick={() =>
                  setCityEntries((prev) => [...prev, { id: makeCityKey(), value: "" }])
                }
                className="rounded-full border border-emerald-200 bg-emerald-500 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-600"
              >
                + 추가
              </button>
            </div>
            <div className="space-y-2">
              {cityEntries.map((entry, index) => (
                <div key={entry.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={entry.value}
                    onChange={(event) => {
                      const value = event.target.value
                      setCityEntries((prev) =>
                        prev.map((item) => (item.id === entry.id ? { ...item, value } : item))
                      )
                    }}
                    placeholder={`도시 ${index + 1}`}
                    className="flex-1 rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                  {cityEntries.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setCityEntries((prev) => prev.filter((item) => item.id !== entry.id))}
                      className="rounded-full border border-red-200 bg-white px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                    >
                      제거
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">숙소</label>
            <input
              type="text"
              value={accommodation}
              onChange={(event) => setAccommodation(event.target.value)}
              placeholder="숙소를 입력하세요"
              className="w-full rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">체크인 Day</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setDayDropdownOpen(dayDropdownOpen === "checkInDay" ? null : "checkInDay")}
                  className="w-full rounded-md bg-slate-100 px-3 py-2 pr-8 text-left text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                >
                  {checkInDay || "Day 선택"}
                </button>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                {dayDropdownOpen === "checkInDay" && (
                  <div className="absolute z-10 mt-2 max-h-40 w-full overflow-y-auto rounded-md border border-slate-200 bg-white p-1 shadow-md">
                    {dayOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => {
                          setCheckInDay(option)
                          setDayDropdownOpen(null)
                        }}
                        className="flex w-full items-center justify-between rounded-md px-2 py-2 text-xs text-slate-600 hover:bg-slate-50"
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">체크인 시간</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => openTimeEditor("checkInTime")}
                  className="w-full rounded-md bg-slate-100 px-3 py-2 pr-8 text-left text-base font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                >
                  {checkInTime || "시간 선택"}
                </button>
                {timeEditOpen === "checkInTime" && (
                  <div
                    className="absolute left-full top-0 z-10"
                    style={{ marginLeft: timePopupOffset.x, marginTop: timePopupOffset.y }}
                  >
                    <div className="relative">
                      <div className="w-[240px] rounded-2xl border border-slate-200 bg-white p-4 shadow-md">
                        <div className="flex items-center justify-center gap-3 text-lg font-semibold text-slate-700">
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={23}
                            step={1}
                            value={timeDraft.hour}
                            onChange={(event) => setTimeDraft((prev) => ({ ...prev, hour: event.target.value }))}
                            placeholder="00"
                            className="w-20 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-2 text-center text-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                          />
                          :
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={59}
                            step={5}
                            value={timeDraft.minute}
                            onChange={(event) => setTimeDraft((prev) => ({ ...prev, minute: event.target.value }))}
                            placeholder="00"
                            className="w-20 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-2 text-center text-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                          />
                        </div>
                        <div className="mt-4 flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setTimeEditOpen(null)}
                            className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600"
                          >
                            취소
                          </button>
                          <button
                            type="button"
                            onClick={applyTimeEditor}
                            className="rounded-full bg-emerald-500 px-3 py-1 text-xs text-white"
                          >
                            확인
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">체크아웃 Day</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setDayDropdownOpen(dayDropdownOpen === "checkOutDay" ? null : "checkOutDay")}
                  className="w-full rounded-md bg-slate-100 px-3 py-2 pr-8 text-left text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                >
                  {checkOutDay || "Day 선택"}
                </button>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                {dayDropdownOpen === "checkOutDay" && (
                  <div className="absolute z-10 mt-2 max-h-40 w-full overflow-y-auto rounded-md border border-slate-200 bg-white p-1 shadow-md">
                    {dayOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => {
                          setCheckOutDay(option)
                          setDayDropdownOpen(null)
                        }}
                        className="flex w-full items-center justify-between rounded-md px-2 py-2 text-xs text-slate-600 hover:bg-slate-50"
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">체크아웃 시간</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => openTimeEditor("checkOutTime")}
                  className="w-full rounded-md bg-slate-100 px-3 py-2 pr-8 text-left text-base font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                >
                  {checkOutTime || "시간 선택"}
                </button>
                {timeEditOpen === "checkOutTime" && (
                  <div
                    className="absolute left-full top-0 z-10"
                    style={{ marginLeft: timePopupOffset.x, marginTop: timePopupOffset.y }}
                  >
                    <div className="relative">
                      <div className="w-[240px] rounded-2xl border border-slate-200 bg-white p-4 shadow-md">
                        <div className="flex items-center justify-center gap-3 text-lg font-semibold text-slate-700">
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={23}
                            step={1}
                            value={timeDraft.hour}
                            onChange={(event) => setTimeDraft((prev) => ({ ...prev, hour: event.target.value }))}
                            placeholder="00"
                            className="w-20 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-2 text-center text-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                          />
                          :
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={59}
                            step={5}
                            value={timeDraft.minute}
                            onChange={(event) => setTimeDraft((prev) => ({ ...prev, minute: event.target.value }))}
                            placeholder="00"
                            className="w-20 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-2 text-center text-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                          />
                        </div>
                        <div className="mt-4 flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setTimeEditOpen(null)}
                            className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600"
                          >
                            취소
                          </button>
                          <button
                            type="button"
                            onClick={applyTimeEditor}
                            className="rounded-full bg-emerald-500 px-3 py-1 text-xs text-white"
                          >
                            확인
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 bg-transparent"
          >
            취소
          </Button>
          <Button
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white"
            onClick={() => {
              const cityValue = cityEntries
                .map((entry) => entry.value.trim())
                .filter(Boolean)
                .join(", ")
              onSave({
                city: cityValue,
                accommodation: accommodation.trim(),
                checkInDay: checkInDay.trim(),
                checkInTime: checkInTime.trim(),
                checkOutDay: checkOutDay.trim(),
                checkOutTime: checkOutTime.trim(),
              })
              onClose()
            }}
          >
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

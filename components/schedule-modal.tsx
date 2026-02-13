"use client"

import React from "react"

import { useRef, useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import type { ScheduleFormData, ScheduleCategory } from "@/lib/types"

interface ScheduleModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: ScheduleFormData) => void
  onDelete?: () => void
  mode: "add" | "edit"
  initialData?: ScheduleFormData | null
  tripDuration: number
  currentDayNumber: number
}

const categories = [
  { value: "other", label: "기타" },
  { value: "transport", label: "교통" },
  { value: "activity", label: "관광" },
  { value: "food", label: "식사" },
] as const

const subCategories: Record<ScheduleCategory, string[]> = {
  accommodation: [],
  activity: ["명소", "투어", "쇼핑", "액티비티", "휴식"],
  food: ["식당", "카페", "주점", "편의점/간식"],
  other: [],
  transport: ["항공", "기차", "버스", "지하철", "택시", "렌터카"],
}

const dayOptions = (duration: number) =>
  Array.from({ length: duration }, (_, index) => `Day ${index + 1}`)

function PickerPopover({
  label,
  showLabel = true,
  value,
  placeholder,
  options,
  onChange,
  onManualInput,
  className = "",
}: {
  label: string
  showLabel?: boolean
  value: string
  placeholder: string
  options: string[]
  onChange: (value: string) => void
  onManualInput?: (currentValue: string) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node
      if (containerRef.current && !containerRef.current.contains(target)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full rounded-lg bg-slate-100 px-3 py-2 text-left text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
      >
        {showLabel && <div className="text-[11px] text-slate-400">{label}</div>}
        <div className={`font-semibold ${value ? "text-slate-900" : "text-slate-400"}`}>
          {value || placeholder}
        </div>
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-2 rounded-xl border border-slate-200 bg-white">
          <div className="relative max-h-56 overflow-y-auto py-2">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-white to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-white to-transparent" />
            <div className="space-y-1 px-2">
              {onManualInput && (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    onManualInput(value)
                  }}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  직접 입력
                </button>
              )}
              {options.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    onChange(option)
                    setOpen(false)
                  }}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                    option === value
                      ? "bg-emerald-50 text-emerald-700 font-semibold"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TimeInputPopover({
  value,
  placeholder,
  onChange,
  placement = "right",
  offsetX = 21,
  offsetY = -50,
}: {
  value: string
  placeholder: string
  onChange: (value: string) => void
  placement?: "left" | "right"
  offsetX?: number
  offsetY?: number
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState({ hour: "", minute: "" })
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node
      if (containerRef.current && !containerRef.current.contains(target)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  const openEditor = () => {
    if (open) {
      setOpen(false)
      return
    }
    const [hour = "", minute = ""] = value.split(":")
    setDraft({ hour, minute })
    setOpen(true)
  }

  const applyEditor = () => {
    const hourValue = Math.min(23, Math.max(0, Number(draft.hour) || 0))
    const minuteValue = Math.min(59, Math.max(0, Number(draft.minute) || 0))
    onChange(`${String(hourValue).padStart(2, "0")}:${String(minuteValue).padStart(2, "0")}`)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={openEditor}
        className="w-full rounded-lg bg-slate-100 px-3 py-2 text-left text-base font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
      >
        <div className={`font-semibold ${value ? "text-slate-900" : "text-slate-400"}`}>
          {value || placeholder}
        </div>
      </button>
      {open && (
        <div
          className={`absolute top-0 z-20 w-[220px] rounded-2xl border border-slate-200 bg-white p-4 shadow-md ${
            placement === "left" ? "right-full" : "left-full"
          }`}
          style={{
            transform: `translate(${placement === "left" ? -offsetX : offsetX}px, ${offsetY}px)`,
          }}
        >
          <div className="flex items-center justify-center gap-3 text-lg font-semibold text-slate-700">
            <input
              type="number"
              inputMode="numeric"
              value={draft.hour}
              onChange={(event) => setDraft((prev) => ({ ...prev, hour: event.target.value }))}
              placeholder="00"
              className="w-16 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-2 text-center text-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            />
            :
            <input
              type="number"
              inputMode="numeric"
              value={draft.minute}
              onChange={(event) => setDraft((prev) => ({ ...prev, minute: event.target.value }))}
              placeholder="00"
              className="w-16 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-2 text-center text-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            />
          </div>
          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600"
            >
              취소
            </button>
            <button
              type="button"
              onClick={applyEditor}
              className="rounded-full bg-emerald-500 px-3 py-1 text-xs text-white"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function ScheduleModal({
  isOpen,
  onClose,
  onSubmit,
  onDelete,
  mode,
  initialData,
  tripDuration,
  currentDayNumber,
}: ScheduleModalProps) {
  const [time, setTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [endDay, setEndDay] = useState(`Day ${currentDayNumber}`)
  const [title, setTitle] = useState("")
  const [location, setLocation] = useState("")
  const [arrivalPlace, setArrivalPlace] = useState("")
  const [memo, setMemo] = useState("")
  const [category, setCategory] = useState<ScheduleCategory>("other")
  const [subCategory, setSubCategory] = useState("")
  const [showEndTime, setShowEndTime] = useState(false)

  const [transDepDay, setTransDepDay] = useState(`Day ${currentDayNumber}`)
  const [transDepTime, setTransDepTime] = useState("")
  const [transArrDay, setTransArrDay] = useState(`Day ${currentDayNumber}`)
  const [transArrTime, setTransArrTime] = useState("")

  const parseTimeWithDay = (value: string) => {
    if (!value) return { time: "", day: `Day ${currentDayNumber}` }
    const match = value.match(/^(.+?)\s*\(Day\s+(\d+)\)$/)
    if (!match) return { time: value, day: `Day ${currentDayNumber}` }
    return { time: match[1], day: `Day ${match[2]}` }
  }

  useEffect(() => {
    if (initialData && mode === "edit") {
      setTime(initialData.time)
      const parsedEnd = parseTimeWithDay(initialData.endTime || "")
      setEndTime(parsedEnd.time)
      setEndDay(parsedEnd.day)
      setShowEndTime(Boolean(initialData.endTime))
      setTitle(initialData.title)
      setLocation(initialData.location)
      setCategory(initialData.category)
      setSubCategory(initialData.subCategory)
      setArrivalPlace(initialData.arrivalPlace)
      setMemo(initialData.memo)

      if (initialData.category === "transport") {
        const parsedDep = parseTimeWithDay(initialData.time || "")
        const parsedArr = parseTimeWithDay(initialData.endTime || "")
        setTransDepDay(parsedDep.day)
        setTransDepTime(parsedDep.time)
        setTransArrDay(parsedArr.day)
        setTransArrTime(parsedArr.time)
      }
    } else {
      setTime("")
      setEndTime("")
      setEndDay(`Day ${currentDayNumber}`)
      setTitle("")
      setLocation("")
      setCategory("other")
      setSubCategory("")
      setArrivalPlace("")
      setMemo("")
      setShowEndTime(false)
      setTransDepDay(`Day ${currentDayNumber}`)
      setTransDepTime("")
      setTransArrDay(`Day ${currentDayNumber}`)
      setTransArrTime("")
    }
  }, [initialData, mode, isOpen])

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    if (category === "transport") {
      const depTime = transDepTime
      const arrTime = transArrTime
      const depTimeDisplay =
        depTime && transDepDay !== `Day ${currentDayNumber}` ? `${depTime} (${transDepDay})` : depTime
      const arrTimeDisplay =
        arrTime && transArrDay !== `Day ${currentDayNumber}` ? `${arrTime} (${transArrDay})` : arrTime

      onSubmit({
        time: depTimeDisplay,
        endTime: arrTimeDisplay,
        title,
        location,
        memo,
        category,
        subCategory: subCategory || "교통",
        arrivalPlace,
        reservationNum: "",
        bookingSource: "",
      })
    } else {
      const endTimeDisplay =
        showEndTime && endTime
          ? endDay !== `Day ${currentDayNumber}`
            ? `${endTime} (${endDay})`
            : endTime
          : ""

      onSubmit({
        time,
        endTime: endTimeDisplay,
        title,
        location,
        memo,
        category,
        subCategory,
        arrivalPlace: "",
        reservationNum: "",
        bookingSource: "",
      })
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl w-full max-w-md mx-4 p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">
            {mode === "add" ? "일정 추가" : "일정 수정"}
          </h2>
          {mode === "edit" && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="rounded-full bg-red-500 px-3 py-1 text-xs font-semibold text-white hover:bg-red-600"
            >
              삭제
            </button>
          )}
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              일정 제목
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="센소지 관람"
              className="w-full rounded-lg bg-slate-100 px-3 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">
              카테고리
            </label>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => {
                    setCategory(cat.value)
                    setSubCategory("")
                  }}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    category === cat.value
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {subCategories[category].length > 0 && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-350">
              <label className="block text-sm font-medium text-slate-700 mb-3">
                세부 카테고리
              </label>
              <div className="flex flex-wrap gap-2">
                {subCategories[category].map((sub) => (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => setSubCategory(subCategory === sub ? "" : sub)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      subCategory === sub
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div key={category} className="animate-in fade-in slide-in-from-bottom-2 duration-350">
            {category === "transport" ? (
              <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-500">출발</div>
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-medium text-slate-500">날짜</div>
                    <PickerPopover
                    label="날짜"
                    showLabel={false}
                    value={transDepDay}
                    placeholder="Day 선택"
                    options={dayOptions(tripDuration)}
                    onChange={setTransDepDay}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-medium text-slate-500">시간</div>
                    <TimeInputPopover
                      value={transDepTime}
                      placeholder="시간 선택"
                      onChange={setTransDepTime}
                      placement="left"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-medium text-slate-500">출발지</div>
                  <input
                    type="text"
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                    placeholder="출발지"
                    className="w-full rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-500">도착</div>
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-medium text-slate-500">날짜</div>
                    <PickerPopover
                    label="날짜"
                    showLabel={false}
                    value={transArrDay}
                    placeholder="Day 선택"
                    options={dayOptions(tripDuration)}
                    onChange={setTransArrDay}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-medium text-slate-500">시간</div>
                    <TimeInputPopover
                      value={transArrTime}
                      placeholder="시간 선택"
                      onChange={setTransArrTime}
                      placement="right"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-medium text-slate-500">도착지</div>
                  <input
                    type="text"
                    value={arrivalPlace}
                    onChange={(event) => setArrivalPlace(event.target.value)}
                    placeholder="도착지"
                    className="w-full rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    시간
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowEndTime((prev) => !prev)}
                    aria-label={showEndTime ? "종료시간 제거" : "종료시간 추가"}
                    className="flex h-6 w-6 -translate-y-[2px] items-center justify-center rounded-full bg-emerald-500 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
                  >
                    {showEndTime ? "–" : "+"}
                  </button>
                </div>
                <div className="space-y-3">
                  {!showEndTime && (
                    <div className="flex-1 min-w-[140px]">
                      <TimeInputPopover
                        value={time}
                        placeholder="시간 선택"
                        onChange={setTime}
                        placement="right"
                      />
                    </div>
                  )}
                  <div
                    className={`space-y-3 transition-all duration-400 ease-out ${
                      showEndTime
                        ? "max-h-60 opacity-100 translate-y-0"
                        : "max-h-0 opacity-0 -translate-y-1 overflow-hidden pointer-events-none"
                    }`}
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-medium text-slate-500">시작 날짜</div>
                        <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
                          Day {currentDayNumber}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-medium text-slate-500">시작 시간</div>
                        <TimeInputPopover
                          value={time}
                          placeholder="시간 선택"
                          onChange={setTime}
                          placement="left"
                        />
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-medium text-slate-500">완료 날짜</div>
                        <PickerPopover
                          label="날짜"
                          showLabel={false}
                          value={endDay}
                          placeholder="Day 선택"
                          options={dayOptions(tripDuration)}
                          onChange={setEndDay}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-medium text-slate-500">완료 시간</div>
                        <TimeInputPopover
                          value={endTime}
                          placeholder="시간 선택"
                          onChange={setEndTime}
                          placement="left"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {category !== "accommodation" && category !== "other" ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    장소
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder={category === "food" ? "식당 위치" : "지도 위치"}
                    className="w-full rounded-lg bg-slate-100 px-3 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
              ) : null}
            </>
          )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              메모
            </label>
            <textarea
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
              placeholder="Details..."
              rows={3}
              className="w-full rounded-lg bg-slate-100 px-3 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200 resize-none"
            />
          </div>
          
          <div className="flex gap-3 pt-4">
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
              className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              {mode === "add" ? "추가" : "수정"}
            </Button>
          </div>
        </form>

      </div>
    </div>
  )
}

"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import type { BudgetFormData, Schedule, ScheduleCategory } from "@/lib/types"

interface BudgetAddModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: BudgetFormData) => void
  tripDuration: number
  currencyOptions: string[]
  exchangeRates: Record<string, number>
  currencyLabels: Record<string, string>
  currencyUnits: Record<string, number>
  mode?: "add" | "edit"
  initialData?: Schedule | null
}

const categories: { value: ScheduleCategory; label: string }[] = [
  { value: "other", label: "기타" },
  { value: "transport", label: "이동" },
  { value: "activity", label: "관광" },
  { value: "food", label: "식사" },
  { value: "accommodation", label: "숙소" },
]

const subCategories: Record<ScheduleCategory, string[]> = {
  accommodation: [],
  activity: ["명소", "투어", "쇼핑", "액티비티", "휴식"],
  food: ["식당", "카페", "주점", "편의점/간식"],
  other: [],
  transport: ["항공", "기차", "버스", "지하철", "택시", "렌터카"],
}

function PickerPopover({
  label,
  value,
  placeholder,
  options,
  onChange,
  showLabel = true,
}: {
  label: string
  value: string
  placeholder: string
  options: string[]
  onChange: (value: string) => void
  showLabel?: boolean
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
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="mt-2 w-full rounded-lg bg-slate-100 px-3 py-2 text-left text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
      >
        {showLabel && <div className="text-[11px] text-slate-400">{label}</div>}
        <div className={`font-semibold ${value ? "text-slate-900" : "text-slate-400"}`}>
          {value || placeholder}
        </div>
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-2 rounded-xl border border-slate-200 bg-white">
          <div className="max-h-56 overflow-y-auto py-2">
            <div className="space-y-1 px-2">
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
}: {
  value: string
  placeholder: string
  onChange: (value: string) => void
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
        className="mt-2 w-full rounded-lg bg-slate-100 px-3 py-2 text-left text-base font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
      >
        <div className={`font-semibold ${value ? "text-slate-900" : "text-slate-400"}`}>
          {value || placeholder}
        </div>
      </button>
      {open && (
        <div
          className="absolute left-full top-0 z-20 ml-3 w-[220px] rounded-2xl border border-slate-200 bg-white p-4 shadow-md"
          style={{ marginTop: "-30px" }}
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

function CurrencyPopover({
  value,
  options,
  onChange,
  exchangeRates,
  currencyLabels,
  currencyUnits,
}: {
  value: string
  options: string[]
  onChange: (value: string) => void
  exchangeRates: Record<string, number>
  currencyLabels: Record<string, string>
  currencyUnits: Record<string, number>
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)

  const formatCurrency = (amount: number) => {
    return Number.isFinite(amount)
      ? new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(Math.round(amount))
      : "0"
  }

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

  const query = search.trim().toLowerCase()
  const filteredOptions = options.filter((option) => {
    if (!query) return true
    const codeMatch = option.toLowerCase().includes(query)
    const labelMatch = (currencyLabels[option] || "").toLowerCase().includes(query)
    return codeMatch || labelMatch
  })
  const formatRateLabel = (rate: number, unit: number) => {
    if (!Number.isFinite(rate) || rate <= 0) return "-"
    const value = rate * unit
    if (value === 1) return "1"
    return formatCurrency(Math.floor(value / 10) * 10)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-emerald-200"
      >
        {value}
      </button>
      {open && (
        <div
          className="absolute left-full top-0 z-20 ml-3 w-52 rounded-xl border border-slate-200 bg-white p-2 shadow-md"
          style={{ marginTop: "-140px" }}
        >
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="통화 검색"
            className="mb-2 w-full rounded-lg bg-slate-100 px-2 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          />
          <div className="max-h-56 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {filteredOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  onChange(option)
                  setOpen(false)
                }}
                className={`w-full rounded-lg px-2 py-1.5 text-left text-sm font-semibold transition ${
                  option === value ? "bg-emerald-50 text-emerald-700" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate text-sm font-semibold text-slate-900">
                    {currencyLabels[option] || option}
                    <span className="ml-1 text-[12px] font-semibold text-emerald-600">{option}</span>
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400">
                    {currencyUnits[option] ?? 1}:{formatRateLabel(exchangeRates[option] ?? 0, currencyUnits[option] ?? 1)} KRW
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function BudgetAddModal({
  isOpen,
  onClose,
  onSubmit,
  tripDuration,
  currencyOptions,
  exchangeRates,
  currencyLabels,
  currencyUnits,
  mode = "add",
  initialData = null,
}: BudgetAddModalProps) {
  const dayOptions = useMemo(
    () => Array.from({ length: Math.max(1, tripDuration) }, (_, index) => `Day ${index + 1}`),
    [tripDuration]
  )

  const [title, setTitle] = useState("")
  const [amount, setAmount] = useState("")
  const [currency, setCurrency] = useState("KRW")
  const [category, setCategory] = useState<ScheduleCategory>("other")
  const [subCategory, setSubCategory] = useState("")
  const [dayNumber, setDayNumber] = useState("Day 1")
  const [time, setTime] = useState("09:00")
  const [endEnabled, setEndEnabled] = useState(false)
  const [endDay, setEndDay] = useState("Day 1")
  const [endTime, setEndTime] = useState("09:00")
  const [transportDepDay, setTransportDepDay] = useState("Day 1")
  const [transportDepTime, setTransportDepTime] = useState("09:00")
  const [transportArrDay, setTransportArrDay] = useState("Day 1")
  const [transportArrTime, setTransportArrTime] = useState("09:00")
  const [stayCheckInDay, setStayCheckInDay] = useState("Day 1")
  const [stayCheckInTime, setStayCheckInTime] = useState("15:00")
  const [stayCheckOutDay, setStayCheckOutDay] = useState("Day 2")
  const [stayCheckOutTime, setStayCheckOutTime] = useState("11:00")

  const parseTimeWithDay = (value: string, fallbackDay: number) => {
    if (!value) return { time: "", day: `Day ${fallbackDay}` }
    const match = value.match(/^(.+?)\s*\(Day\s+(\d+)\)$/)
    if (!match) return { time: value, day: `Day ${fallbackDay}` }
    return { time: match[1].trim(), day: `Day ${match[2]}` }
  }

  useEffect(() => {
    if (!isOpen) return
    if (mode === "edit" && initialData) {
      setTitle(initialData.title || "")
      setAmount(Number.isFinite(initialData.amount) ? String(initialData.amount) : "")
      setCurrency(initialData.currency || "KRW")
      setMemo(initialData.memo || "")
      setCategory(initialData.category || "other")
      setSubCategory(initialData.subCategory || "")

      const startDayLabel = `Day ${initialData.dayNumber}`
      const parsedStart = parseTimeWithDay(initialData.time || "", initialData.dayNumber)
      const parsedEnd = parseTimeWithDay(initialData.endTime || "", initialData.dayNumber)

      setDayNumber(startDayLabel)
      setTime(parsedStart.time)
      setEndEnabled(Boolean(initialData.endTime))
      setEndDay(parsedEnd.day)
      setEndTime(parsedEnd.time)

      setTransportDepDay(parsedStart.day || startDayLabel)
      setTransportDepTime(parsedStart.time)
      setTransportArrDay(parsedEnd.day || startDayLabel)
      setTransportArrTime(parsedEnd.time)

      setStayCheckInDay(parsedStart.day || startDayLabel)
      setStayCheckInTime(parsedStart.time || "15:00")

      const staySub = initialData.subCategory || ""
      const [stayOutDayRaw, stayOutTimeRaw] = staySub.includes("|") ? staySub.split("|") : ["", ""]
      setStayCheckOutDay(
        stayOutDayRaw && stayOutDayRaw.startsWith("Day")
          ? stayOutDayRaw
          : `Day ${Math.min(tripDuration, initialData.dayNumber + 1)}`
      )
      setStayCheckOutTime(stayOutTimeRaw || parsedEnd.time || "11:00")
    } else {
      setTitle("")
      setAmount("")
      setCurrency("KRW")
      setCategory("other")
      setSubCategory("")
      setMemo("")
      setDayNumber("Day 1")
      setTime("09:00")
      setEndEnabled(false)
      setEndDay("Day 1")
      setEndTime("09:00")
      setTransportDepDay("Day 1")
      setTransportDepTime("09:00")
      setTransportArrDay("Day 1")
      setTransportArrTime("09:00")
      setStayCheckInDay("Day 1")
      setStayCheckInTime("15:00")
      setStayCheckOutDay("Day 2")
      setStayCheckOutTime("11:00")
    }
  }, [isOpen, mode, initialData, tripDuration])
  const [memo, setMemo] = useState("")

  useEffect(() => {
    if (!isOpen) return
    setTitle("")
    setAmount("")
    setCurrency("KRW")
    setCategory("other")
    setSubCategory("")
    setDayNumber("Day 1")
    setTime("09:00")
    setEndEnabled(false)
    setEndDay("Day 1")
    setEndTime("09:00")
    setTransportDepDay("Day 1")
    setTransportDepTime("09:00")
    setTransportArrDay("Day 1")
    setTransportArrTime("09:00")
    setStayCheckInDay("Day 1")
    setStayCheckInTime("15:00")
    setStayCheckOutDay("Day 2")
    setStayCheckOutTime("11:00")
    setMemo("")
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
        <div className="mb-6 flex items-center justify-between gap-4">
              <div className="text-xl font-bold text-slate-900">
                {mode === "edit" ? "예산 수정" : "예산 추가"}
              </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              취소
            </Button>
            <Button
              type="button"
              onClick={() => {
                const parsedAmount = Number.parseFloat(amount.replace(/,/g, ""))
                if (!title.trim()) return
                let startDayNumber = Number(dayNumber.replace("Day ", "")) || 1
                let startTimeValue = time
                let endTimeValue = ""
                let finalSubCategory = subCategory

                if (category === "transport") {
                  startDayNumber = Number(transportDepDay.replace("Day ", "")) || 1
                  startTimeValue = transportDepTime
                  endTimeValue =
                    transportArrDay !== transportDepDay && transportArrTime
                      ? `${transportArrTime} (${transportArrDay})`
                      : transportArrTime
                } else if (category === "accommodation") {
                  startDayNumber = Number(stayCheckInDay.replace("Day ", "")) || 1
                  startTimeValue = stayCheckInTime
                  endTimeValue =
                    stayCheckOutDay !== stayCheckInDay && stayCheckOutTime
                      ? `${stayCheckOutTime} (${stayCheckOutDay})`
                      : stayCheckOutTime
                  finalSubCategory = `${stayCheckOutDay}|${stayCheckOutTime}`
                } else if (endEnabled) {
                  const endDayLabel = endDay || dayNumber
                  endTimeValue =
                    endDayLabel !== dayNumber && endTime
                      ? `${endTime} (${endDayLabel})`
                      : endTime
                }
                onSubmit({
                  dayNumber: startDayNumber,
                  time: startTimeValue,
                  endTime: endTimeValue,
                  title: title.trim(),
                  memo: memo.trim(),
                  category,
                  subCategory: finalSubCategory,
                  amount: Number.isFinite(parsedAmount) ? parsedAmount : 0,
                  currency,
                })
                onClose()
              }}
              className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-600"
            >
              저장
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-bold text-slate-900">항목명</label>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="지출 항목"
              className="mt-2 w-full rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            />
          </div>

          <div>
            <label className="text-sm font-bold text-slate-900">카테고리</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => {
                    setCategory(cat.value)
                    setSubCategory("")
                  }}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    category === cat.value
                      ? "bg-emerald-500 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {subCategories[category].length > 0 && (
            <div>
              <label className="text-sm font-bold text-slate-900">세부 카테고리</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {subCategories[category].map((sub) => (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => setSubCategory(subCategory === sub ? "" : sub)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      subCategory === sub
                        ? "bg-emerald-500 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            </div>
          )}

          {category === "transport" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-bold text-slate-900">출발 Day</label>
                  <div className="mt-2">
                    <PickerPopover
                      label="출발 Day"
                      showLabel={false}
                      value={transportDepDay}
                      placeholder="Day 선택"
                      options={dayOptions}
                      onChange={(value) => {
                        setTransportDepDay(value)
                        if (transportArrDay === transportDepDay) {
                          setTransportArrDay(value)
                        }
                      }}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-bold text-slate-900">출발 시간</label>
                  <div className="mt-2">
                    <TimeInputPopover
                      value={transportDepTime}
                      placeholder="시간 선택"
                      onChange={setTransportDepTime}
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-bold text-slate-900">도착 Day</label>
                  <div className="mt-2">
                    <PickerPopover
                      label="도착 Day"
                      showLabel={false}
                      value={transportArrDay}
                      placeholder="Day 선택"
                      options={dayOptions}
                      onChange={setTransportArrDay}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-bold text-slate-900">도착 시간</label>
                  <div className="mt-2">
                    <TimeInputPopover
                      value={transportArrTime}
                      placeholder="시간 선택"
                      onChange={setTransportArrTime}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {category === "accommodation" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-bold text-slate-900">체크인 Day</label>
                  <div className="mt-2">
                    <PickerPopover
                      label="체크인 Day"
                      showLabel={false}
                      value={stayCheckInDay}
                      placeholder="Day 선택"
                      options={dayOptions}
                      onChange={(value) => {
                        setStayCheckInDay(value)
                        if (stayCheckOutDay === stayCheckInDay) {
                          setStayCheckOutDay(value)
                        }
                      }}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-bold text-slate-900">체크인 시간</label>
                  <div className="mt-2">
                    <TimeInputPopover
                      value={stayCheckInTime}
                      placeholder="시간 선택"
                      onChange={setStayCheckInTime}
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-bold text-slate-900">체크아웃 Day</label>
                  <div className="mt-2">
                    <PickerPopover
                      label="체크아웃 Day"
                      showLabel={false}
                      value={stayCheckOutDay}
                      placeholder="Day 선택"
                      options={dayOptions}
                      onChange={setStayCheckOutDay}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-bold text-slate-900">체크아웃 시간</label>
                  <div className="mt-2">
                    <TimeInputPopover
                      value={stayCheckOutTime}
                      placeholder="시간 선택"
                      onChange={setStayCheckOutTime}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {category !== "transport" && category !== "accommodation" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-bold text-slate-900">Day</label>
                  <div className="mt-2">
                    <PickerPopover
                      label="Day"
                      showLabel={false}
                      value={dayNumber}
                      placeholder="Day 선택"
                      options={dayOptions}
                      onChange={(value) => {
                        setDayNumber(value)
                        if (!endEnabled) {
                          setEndDay(value)
                        }
                      }}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-bold text-slate-900">시간</label>
                  <div className="mt-2">
                    <TimeInputPopover
                      value={time}
                      placeholder="시간 선택"
                      onChange={setTime}
                    />
                  </div>
                </div>
              </div>
              {!endEnabled && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setEndEnabled(true)}
                    aria-label="종료 추가"
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
                  >
                    +
                  </button>
                </div>
              )}
              <div
                className={`grid grid-cols-2 gap-3 overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out ${
                  endEnabled ? "max-h-40 opacity-100" : "max-h-0 opacity-0 pointer-events-none"
                }`}
              >
                  <div>
                    <label className="text-sm font-bold text-slate-900">종료 Day</label>
                    <div className="mt-2">
                      <PickerPopover
                        label="종료 Day"
                        showLabel={false}
                        value={endDay}
                        placeholder="Day 선택"
                        options={dayOptions}
                        onChange={setEndDay}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-bold text-slate-900">종료 시간</label>
                    <div className="mt-2">
                      <TimeInputPopover
                        value={endTime}
                        placeholder="시간 선택"
                        onChange={setEndTime}
                      />
                    </div>
                  </div>
                </div>
              {endEnabled && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setEndEnabled(false)}
                    aria-label="종료 제거"
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
                  >
                    –
                  </button>
                </div>
              )}
            </>
          )}

          <div>
            <label className="text-sm font-bold text-slate-900">메모</label>
            <textarea
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
              rows={2}
              className="mt-2 w-full rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              placeholder="내용을 입력하세요"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-slate-900">금액</label>
              <div className="flex items-center justify-end gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0"
                  className="w-28 rounded-lg bg-slate-100 px-3 py-2 text-right text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />
                <CurrencyPopover
                  value={currency}
                  options={currencyOptions}
                  onChange={setCurrency}
                  exchangeRates={exchangeRates}
                  currencyLabels={currencyLabels}
                  currencyUnits={currencyUnits}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

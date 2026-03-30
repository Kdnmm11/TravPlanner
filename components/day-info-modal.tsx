"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DraggablePanel } from "@/components/draggable-panel"

const DAY_INFO_OPEN_TRANSITION_MS = 200
const DAY_INFO_CLOSE_TRANSITION_MS = 240
const accommodationCurrencyOptions = [
  { code: "KRW", label: "원화" },
  { code: "USD", label: "달러" },
  { code: "JPY", label: "엔화" },
  { code: "EUR", label: "유로" },
  { code: "CNY", label: "위안" },
  { code: "GBP", label: "파운드" },
] as const

function splitPackedTimeDigits(rawValue: string) {
  const digits = rawValue.replace(/\D/g, "").slice(0, 4)
  if (digits.length <= 2) {
    return { hour: digits, minute: "" }
  }
  if (digits.length === 3) {
    const firstTwo = Number(digits.slice(0, 2))
    if (Number.isFinite(firstTwo) && firstTwo <= 23) {
      return { hour: digits.slice(0, 2), minute: digits.slice(2) }
    }
    return { hour: digits.slice(0, 1), minute: digits.slice(1) }
  }
  return { hour: digits.slice(0, 2), minute: digits.slice(2) }
}

interface DayInfoModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (values: {
    city: string
    accommodation: string
    accommodationAmount: number
    accommodationCurrency: string
    checkInDay: string
    checkInTime: string
    checkOutDay: string
    checkOutTime: string
  }) => void
  dayNumber: number
  tripDuration: number
  dayLabel: string
  dayOptions: string[]
  initialCity?: string
  initialAccommodation?: string
  initialAccommodationAmount?: number
  initialAccommodationCurrency?: string
  initialCheckInDay?: string
  initialCheckInTime?: string
  initialCheckOutDay?: string
  initialCheckOutTime?: string
}

function AccommodationCurrencyPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const selectedOption =
    accommodationCurrencyOptions.find((option) => option.code === value) ?? accommodationCurrencyOptions[0]

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
        className="flex w-full items-center justify-between rounded-lg bg-slate-100 px-3 py-2.5 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-200/70 focus:outline-none focus:ring-2 focus:ring-emerald-200"
      >
        <div className="min-w-0 truncate text-sm font-semibold text-slate-900">
          <span>{selectedOption.code}</span>
          <span className="ml-1 text-xs font-medium text-slate-500">{selectedOption.label}</span>
        </div>
        <ChevronDown
          className={`h-4 w-4 flex-shrink-0 text-slate-500 transition ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 w-44 rounded-xl border border-slate-200 bg-white p-2 shadow-md">
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {accommodationCurrencyOptions.map((option) => {
              const selected = option.code === value
              return (
                <button
                  key={option.code}
                  type="button"
                  onClick={() => {
                    onChange(option.code)
                    setOpen(false)
                  }}
                  className={`w-full rounded-lg px-3 py-2 text-left transition ${
                    selected
                      ? "bg-emerald-50 text-emerald-700"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <div className="text-sm font-semibold">{option.code}</div>
                  <div className="text-[11px] text-slate-500">{option.label}</div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export function DayInfoModal({
  isOpen,
  onClose,
  onSave,
  dayNumber,
  tripDuration,
  dayLabel,
  dayOptions,
  initialCity = "",
  initialAccommodation = "",
  initialAccommodationAmount = 0,
  initialAccommodationCurrency = "KRW",
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
  const [newCityEntryId, setNewCityEntryId] = useState<string | null>(null)
  const [removingCityEntryIds, setRemovingCityEntryIds] = useState<string[]>([])
  const [cityListHeight, setCityListHeight] = useState<string | undefined>(undefined)
  const [accommodation, setAccommodation] = useState(initialAccommodation)
  const [budgetEnabled, setBudgetEnabled] = useState(initialAccommodationAmount > 0)
  const [accommodationAmount, setAccommodationAmount] = useState(
    initialAccommodationAmount > 0 ? String(initialAccommodationAmount) : ""
  )
  const [accommodationCurrency, setAccommodationCurrency] = useState(initialAccommodationCurrency || "KRW")
  const defaultNextDayLabel =
    dayOptions[Math.min(dayOptions.length - 1, Math.max(0, dayOptions.indexOf(dayLabel) + 1))] || dayLabel
  const [checkInDay, setCheckInDay] = useState(initialCheckInDay || dayLabel)
  const [checkInTime, setCheckInTime] = useState(initialCheckInTime || "15:00")
  const [checkOutDay, setCheckOutDay] = useState(initialCheckOutDay || defaultNextDayLabel)
  const [checkOutTime, setCheckOutTime] = useState(initialCheckOutTime || "11:00")
  const [dayDropdownOpen, setDayDropdownOpen] = useState<"checkInDay" | "checkOutDay" | null>(null)
  const [timeEditOpen, setTimeEditOpen] = useState<"checkInTime" | "checkOutTime" | null>(null)
  const [timeDraft, setTimeDraft] = useState({ hour: "", minute: "" })
  const timePopupOffset = { x: 9, y: -42 }
  const [shouldRender, setShouldRender] = useState(isOpen)
  const [isVisible, setIsVisible] = useState(false)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const frameRef = useRef<number | null>(null)
  const cityRemovalTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const cityListRef = useRef<HTMLDivElement>(null)
  const timeHourInputRef = useRef<HTMLInputElement>(null)
  const timeMinuteInputRef = useRef<HTMLInputElement>(null)

  const clearModalTimers = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
  }

  const clearCityRemovalTimers = () => {
    cityRemovalTimersRef.current.forEach((timer) => clearTimeout(timer))
    cityRemovalTimersRef.current = []
  }

  const getNormalizedAccommodationAmount = () => {
    if (!budgetEnabled) return 0
    const numeric = Number.parseFloat(accommodationAmount.replaceAll(",", ""))
    return Number.isFinite(numeric) ? Math.max(0, numeric) : 0
  }

  const removeCityEntry = (entryId: string) => {
    setRemovingCityEntryIds((prev) => (prev.includes(entryId) ? prev : [...prev, entryId]))
    const timer = setTimeout(() => {
      setCityEntries((prev) => prev.filter((item) => item.id !== entryId))
      setRemovingCityEntryIds((prev) => prev.filter((id) => id !== entryId))
      cityRemovalTimersRef.current = cityRemovalTimersRef.current.filter((item) => item !== timer)
    }, 180)
    cityRemovalTimersRef.current.push(timer)
  }

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

  useEffect(() => {
    if (!timeEditOpen) return
    const timer = window.requestAnimationFrame(() => {
      timeHourInputRef.current?.focus()
      timeHourInputRef.current?.select()
    })
    return () => window.cancelAnimationFrame(timer)
  }, [timeEditOpen])

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

  const handleHourDraftChange = (rawValue: string) => {
    const digits = rawValue.replace(/\D/g, "").slice(0, 4)
    if (digits.length > 2) {
      const nextDraft = splitPackedTimeDigits(digits)
      setTimeDraft(nextDraft)
      requestAnimationFrame(() => {
        timeMinuteInputRef.current?.focus()
        const length = nextDraft.minute.length
        timeMinuteInputRef.current?.setSelectionRange(length, length)
      })
      return
    }
    setTimeDraft((prev) => ({ ...prev, hour: digits }))
  }

  const handleMinuteDraftChange = (rawValue: string) => {
    const digits = rawValue.replace(/\D/g, "").slice(0, 2)
    setTimeDraft((prev) => ({ ...prev, minute: digits }))
  }

  useEffect(() => {
    if (isOpen) {
      clearCityRemovalTimers()
      setCityEntries(buildCityEntries(initialCity))
      setNewCityEntryId(null)
      setRemovingCityEntryIds([])
      setAccommodation(initialAccommodation)
      setBudgetEnabled(initialAccommodationAmount > 0)
      setAccommodationAmount(initialAccommodationAmount > 0 ? String(initialAccommodationAmount) : "")
      setAccommodationCurrency(initialAccommodationCurrency || "KRW")
      setCheckInDay(initialCheckInDay || dayLabel)
      setCheckInTime(initialCheckInTime || "15:00")
      setCheckOutDay(initialCheckOutDay || defaultNextDayLabel)
      setCheckOutTime(initialCheckOutTime || "11:00")
    }
  }, [isOpen, dayNumber, tripDuration, dayLabel, defaultNextDayLabel, initialCity, initialAccommodation, initialAccommodationAmount, initialAccommodationCurrency, initialCheckInDay, initialCheckInTime, initialCheckOutDay, initialCheckOutTime])

  useLayoutEffect(() => {
    if (!cityListRef.current) return
    setCityListHeight(`${cityListRef.current.scrollHeight}px`)
  }, [cityEntries.length, isOpen])

  useEffect(() => {
    if (!newCityEntryId) return
    const timer = window.setTimeout(() => {
      setNewCityEntryId((current) => (current === newCityEntryId ? null : current))
    }, 220)
    return () => window.clearTimeout(timer)
  }, [newCityEntryId])

  useEffect(() => {
    clearModalTimers()

    if (isOpen) {
      setShouldRender(true)
      setIsVisible(false)
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = requestAnimationFrame(() => {
          setIsVisible(true)
          frameRef.current = null
        })
      })
      return clearModalTimers
    }

    if (shouldRender) {
      setIsVisible(false)
      closeTimerRef.current = setTimeout(() => {
        setShouldRender(false)
        closeTimerRef.current = null
      }, DAY_INFO_CLOSE_TRANSITION_MS)
    }

    return clearModalTimers
  }, [isOpen])

  useEffect(() => {
    return () => {
      clearModalTimers()
      clearCityRemovalTimers()
    }
  }, [])

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
        target instanceof HTMLButtonElement ||
        (target instanceof HTMLElement && target.closest("[data-keyboard-ignore='true']"))
      ) {
        return
      }
      event.preventDefault()
      const cityValue = cityEntries
        .map((entry) => entry.value.trim())
        .filter(Boolean)
        .join(", ")
      onSave({
        city: cityValue,
        accommodation: accommodation.trim(),
        accommodationAmount: getNormalizedAccommodationAmount(),
        accommodationCurrency: accommodationCurrency.trim() || "KRW",
        checkInDay: checkInDay.trim(),
        checkInTime: checkInTime.trim(),
        checkOutDay: checkOutDay.trim(),
        checkOutTime: checkOutTime.trim(),
      })
      onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose, onSave, cityEntries, accommodation, accommodationAmount, accommodationCurrency, budgetEnabled, checkInDay, checkInTime, checkOutDay, checkOutTime])

  const handleSave = () => {
    const cityValue = cityEntries
      .map((entry) => entry.value.trim())
      .filter(Boolean)
      .join(", ")
    onSave({
      city: cityValue,
      accommodation: accommodation.trim(),
      accommodationAmount: getNormalizedAccommodationAmount(),
      accommodationCurrency: accommodationCurrency.trim() || "KRW",
      checkInDay: checkInDay.trim(),
      checkInTime: checkInTime.trim(),
      checkOutDay: checkOutDay.trim(),
      checkOutTime: checkOutTime.trim(),
    })
    onClose()
  }

  if (!shouldRender) return null

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/50 transition-opacity ease-out"
        style={{
          opacity: isVisible ? 1 : 0,
          transitionDuration: `${isVisible ? DAY_INFO_OPEN_TRANSITION_MS : DAY_INFO_CLOSE_TRANSITION_MS}ms`,
        }}
        onClick={onClose}
      />
      <DraggablePanel
        className="mx-4 w-[min(28rem,calc(100vw-2rem))] max-w-none"
        handleOffset={{ x: 0, y: 10 }}
        floatingHandle
        data-dayinfo-dialog
        frameClassName="transition-[opacity,transform] ease-out"
        frameStyle={{
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? "translateY(0px) scale(1)" : "translateY(14px) scale(0.98)",
          transitionDuration: `${isVisible ? DAY_INFO_OPEN_TRANSITION_MS : DAY_INFO_CLOSE_TRANSITION_MS}ms`,
        }}
      >
        <div className="relative overflow-visible">
        <div className="rounded-lg border bg-background px-6 pb-6 pt-5 shadow-lg">
          <div className="mb-4">
            <div className="text-lg font-semibold text-slate-900">{dayLabel} 도시/숙소</div>
          </div>
          <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">도시</label>
              <button
                type="button"
                onClick={() => {
                  const nextEntry = { id: makeCityKey(), value: "" }
                  setCityEntries((prev) => [...prev, nextEntry])
                  setNewCityEntryId(nextEntry.id)
                }}
                className="rounded-full border border-emerald-200 bg-emerald-500 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-600"
              >
                + 추가
              </button>
            </div>
            <div
              className="overflow-hidden transition-[max-height] duration-250 ease-out"
              style={{ maxHeight: cityListHeight }}
            >
              <div ref={cityListRef}>
              {cityEntries.map((entry, index) => (
                <div
                  key={entry.id}
                  className="overflow-hidden transition-[max-height,opacity,transform,margin] duration-180 ease-out"
                  style={{
                    maxHeight: removingCityEntryIds.includes(entry.id) ? "0px" : "56px",
                    opacity: removingCityEntryIds.includes(entry.id) ? 0 : 1,
                    transform: removingCityEntryIds.includes(entry.id) ? "translateY(-8px)" : "translateY(0px)",
                    marginTop: index === 0 ? "0px" : removingCityEntryIds.includes(entry.id) ? "0px" : "8px",
                  }}
                >
                  <div
                    className={`flex items-center gap-2 ${
                      newCityEntryId === entry.id
                        ? "animate-in fade-in slide-in-from-top-2 duration-200"
                        : ""
                    }`}
                  >
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
                      className="flex-1 rounded-md border-2 border-transparent bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 transition focus:border-emerald-200 focus:outline-none"
                    />
                    {cityEntries.length > 1 && index > 0 && (
                      <button
                        type="button"
                        onClick={() => removeCityEntry(entry.id)}
                        className="rounded-full border border-red-200 bg-white px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                      >
                        제거
                      </button>
                    )}
                  </div>
                </div>
              ))}
              </div>
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
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <label className="block text-sm font-medium text-slate-700">예산</label>
                <button
                  type="button"
                  onClick={() => setBudgetEnabled((prev) => !prev)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    budgetEnabled
                      ? "bg-emerald-500 text-white hover:bg-emerald-600"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {budgetEnabled ? "입력 켜짐" : "입력 꺼짐"}
                </button>
              </div>
              <div className="relative min-h-[46px]">
                <div
                  className={`absolute inset-x-0 top-0 transition-all duration-250 ease-out ${
                    budgetEnabled
                      ? "translate-y-0 opacity-100"
                      : "pointer-events-none translate-y-1 opacity-0"
                  }`}
                >
                  <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-3">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={accommodationAmount}
                      onChange={(event) => setAccommodationAmount(event.target.value)}
                      placeholder="0"
                      className="w-full rounded-lg bg-slate-100 px-3 py-2.5 text-right text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                    />
                    <AccommodationCurrencyPicker
                      value={accommodationCurrency}
                      onChange={setAccommodationCurrency}
                    />
                  </div>
                </div>
                <div
                  className={`absolute inset-x-0 top-0 transition-all duration-250 ease-out ${
                    budgetEnabled
                      ? "pointer-events-none -translate-y-1 opacity-0"
                      : "translate-y-0 opacity-100"
                  }`}
                >
                  <div className="rounded-lg bg-slate-100 px-3 py-2.5 text-sm font-semibold text-slate-400">
                    필요할 때만 금액을 추가하세요.
                  </div>
                </div>
              </div>
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
                              ref={timeHourInputRef}
                              type="text"
                              inputMode="numeric"
                              autoComplete="off"
                              value={timeDraft.hour}
                              onChange={(event) => handleHourDraftChange(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault()
                                  event.stopPropagation()
                                  applyTimeEditor()
                                }
                              }}
                              onFocus={(event) => event.currentTarget.select()}
                              placeholder="00"
                              className="w-20 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-2 text-center text-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                            />
                            :
                            <input
                              ref={timeMinuteInputRef}
                              type="text"
                              inputMode="numeric"
                              autoComplete="off"
                              value={timeDraft.minute}
                              onChange={(event) => handleMinuteDraftChange(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault()
                                  event.stopPropagation()
                                  applyTimeEditor()
                                }
                              }}
                              onFocus={(event) => event.currentTarget.select()}
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
                              ref={timeHourInputRef}
                              type="text"
                              inputMode="numeric"
                              autoComplete="off"
                              value={timeDraft.hour}
                              onChange={(event) => handleHourDraftChange(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault()
                                  event.stopPropagation()
                                  applyTimeEditor()
                                }
                              }}
                              onFocus={(event) => event.currentTarget.select()}
                              placeholder="00"
                              className="w-20 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-2 text-center text-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                            />
                            :
                            <input
                              ref={timeMinuteInputRef}
                              type="text"
                              inputMode="numeric"
                              autoComplete="off"
                              value={timeDraft.minute}
                              onChange={(event) => handleMinuteDraftChange(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault()
                                  event.stopPropagation()
                                  applyTimeEditor()
                                }
                              }}
                              onFocus={(event) => event.currentTarget.select()}
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
          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 bg-transparent"
            >
              취소
            </Button>
            <Button
              className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white"
              onClick={handleSave}
            >
              저장
            </Button>
          </div>
        </div>
        </div>
      </DraggablePanel>
    </div>
  )
}

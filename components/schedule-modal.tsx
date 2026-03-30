"use client"

import React from "react"

import { useRef, useState, useEffect } from "react"
import { ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DraggablePanel } from "@/components/draggable-panel"
import { ATTACHED_RIGHT_PANEL_GAP } from "@/lib/attached-panel"
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
  currentDayLabel: string
  tripDayOptions: string[]
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

const currencyOptions = [
  { code: "KRW", label: "원화" },
  { code: "USD", label: "달러" },
  { code: "JPY", label: "엔화" },
  { code: "EUR", label: "유로" },
  { code: "CNY", label: "위안" },
  { code: "GBP", label: "파운드" },
  { code: "CHF", label: "프랑" },
  { code: "CAD", label: "캐나다달러" },
  { code: "AUD", label: "호주달러" },
  { code: "HKD", label: "홍콩달러" },
  { code: "TWD", label: "대만달러" },
  { code: "THB", label: "바트" },
  { code: "VND", label: "동" },
  { code: "PHP", label: "페소" },
] as const

type CurrencyOption = (typeof currencyOptions)[number]
const MODAL_OPEN_TRANSITION_MS = 200
const MODAL_CLOSE_TRANSITION_MS = 320
const DETAIL_SLOT_HEIGHT_PX = 72
const COMPACT_DETAIL_SLOT_HEIGHT_PX = 48
const PLACEHOLDER_COPY_FADE_MS = 90
const TIME_POPOVER_TRANSITION_MS = 150

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
  placement?: "left" | "right" | "top-left" | "top-right" | "top-center"
  offsetX?: number
  offsetY?: number
}) {
  const [open, setOpen] = useState(false)
  const [shouldRenderPopover, setShouldRenderPopover] = useState(false)
  const [isPopoverVisible, setIsPopoverVisible] = useState(false)
  const [draft, setDraft] = useState({ hour: "", minute: "" })
  const containerRef = useRef<HTMLDivElement>(null)
  const hourInputRef = useRef<HTMLInputElement>(null)
  const minuteInputRef = useRef<HTMLInputElement>(null)
  const closeTimerRef = useRef<number | null>(null)
  const frameRef = useRef<number | null>(null)

  const clearPopoverTimers = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
  }

  const applyEditor = () => {
    const hourValue = Math.min(23, Math.max(0, Number(draft.hour) || 0))
    const minuteValue = Math.min(59, Math.max(0, Number(draft.minute) || 0))
    onChange(`${String(hourValue).padStart(2, "0")}:${String(minuteValue).padStart(2, "0")}`)
    setOpen(false)
  }

  const closeEditor = (mode: "cancel" | "apply" = "cancel") => {
    if (mode === "apply" && (draft.hour.trim() || draft.minute.trim())) {
      applyEditor()
      return
    }
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node
      if (containerRef.current && !containerRef.current.contains(target)) {
        closeEditor("apply")
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open, draft.hour, draft.minute])

  useEffect(() => {
    clearPopoverTimers()

    if (open) {
      setShouldRenderPopover(true)
      setIsPopoverVisible(false)
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = window.requestAnimationFrame(() => {
          setIsPopoverVisible(true)
          hourInputRef.current?.focus()
          hourInputRef.current?.select()
          frameRef.current = null
        })
      })
      return clearPopoverTimers
    }

    if (shouldRenderPopover) {
      setIsPopoverVisible(false)
      closeTimerRef.current = window.setTimeout(() => {
        setShouldRenderPopover(false)
        closeTimerRef.current = null
      }, TIME_POPOVER_TRANSITION_MS)
    }

    return clearPopoverTimers
  }, [open])

  const openEditor = () => {
    if (open) {
      closeEditor("apply")
      return
    }
    const [hour = "", minute = ""] = value.split(":")
    setDraft({ hour, minute })
    setOpen(true)
  }

  const handleHourChange = (rawValue: string) => {
    const digits = rawValue.replace(/\D/g, "").slice(0, 4)
    if (digits.length > 2) {
      const nextDraft = splitPackedTimeDigits(digits)
      setDraft(nextDraft)
      requestAnimationFrame(() => {
        minuteInputRef.current?.focus()
        const length = nextDraft.minute.length
        minuteInputRef.current?.setSelectionRange(length, length)
      })
      return
    }
    setDraft((prev) => ({ ...prev, hour: digits }))
  }

  const handleMinuteChange = (rawValue: string) => {
    const digits = rawValue.replace(/\D/g, "").slice(0, 2)
    setDraft((prev) => ({ ...prev, minute: digits }))
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
      {shouldRenderPopover && (
        <div
          className={`absolute z-20 w-[208px] ${
            placement === "left"
              ? "right-full top-0"
              : placement === "right"
                ? "left-full top-0"
                : placement === "top-center"
                  ? "bottom-full left-1/2"
                : placement === "top-right"
                  ? "bottom-full right-0"
                  : "bottom-full left-0"
          }`}
          style={{
            transform:
              placement === "left"
                ? `translate(${-offsetX}px, ${offsetY}px)`
                : placement === "right"
                  ? `translate(${offsetX}px, ${offsetY}px)`
                  : placement === "top-center"
                    ? `translate(-50%, ${offsetY}px)`
                  : `translate(0px, ${offsetY}px)`,
          }}
        >
          <div
            className={`rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-md transition-all ease-out ${
              isPopoverVisible
                ? "translate-y-0 scale-100 opacity-100"
                : "translate-y-2 scale-[0.97] opacity-0"
            }`}
            style={{ transitionDuration: `${TIME_POPOVER_TRANSITION_MS}ms` }}
          >
            <div className="flex items-center justify-center gap-3 text-lg font-semibold text-slate-700">
              <input
                ref={hourInputRef}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={draft.hour}
                onChange={(event) => handleHourChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    event.stopPropagation()
                    applyEditor()
                  }
                }}
                onFocus={(event) => event.currentTarget.select()}
                placeholder="00"
                className="w-[4.8rem] rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2.5 text-center text-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              />
              :
              <input
                ref={minuteInputRef}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={draft.minute}
                onChange={(event) => handleMinuteChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    event.stopPropagation()
                    applyEditor()
                  }
                }}
                onFocus={(event) => event.currentTarget.select()}
                placeholder="00"
                className="w-[4.8rem] rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2.5 text-center text-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              />
            </div>
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => closeEditor("cancel")}
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
        </div>
      )}
    </div>
  )
}

function CurrencyPickerPopover({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const selectedOption =
    currencyOptions.find((option) => option.code === value) ?? currencyOptions[0]

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
          <span className="ml-1 text-xs font-medium text-slate-500">
            {selectedOption.label}
          </span>
        </div>
        <ChevronDown
          className={`h-4 w-4 flex-shrink-0 text-slate-500 transition ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 w-44 rounded-xl border border-slate-200 bg-white p-2 shadow-md">
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {currencyOptions.map((option) => {
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

function FadingPlaceholderCopy({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  const [displayedCopy, setDisplayedCopy] = useState({ title, description })
  const [visible, setVisible] = useState(true)
  const timerRef = useRef<number | null>(null)
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    if (
      displayedCopy.title === title &&
      displayedCopy.description === description
    ) {
      return
    }

    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }

    timerRef.current = window.setTimeout(() => {
      setDisplayedCopy({ title, description })
      frameRef.current = window.requestAnimationFrame(() => {
        setVisible(true)
        frameRef.current = null
      })
      timerRef.current = null
    }, PLACEHOLDER_COPY_FADE_MS)

    setVisible(false)

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
    }
  }, [title, description])

  return (
    <div
      className={`transition-opacity ease-out ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      style={{ transitionDuration: `${PLACEHOLDER_COPY_FADE_MS}ms` }}
    >
      <div className="text-[13px] font-semibold leading-4 text-slate-700">
        {displayedCopy.title}
      </div>
      {displayedCopy.description ? (
        <div className="mt-0.5 text-[11px] leading-4 text-slate-500">
          {displayedCopy.description}
        </div>
      ) : null}
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
  currentDayLabel,
  tripDayOptions,
}: ScheduleModalProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const frameRef = useRef<number | null>(null)
  const [time, setTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [endDay, setEndDay] = useState(currentDayLabel)
  const [title, setTitle] = useState("")
  const [location, setLocation] = useState("")
  const [arrivalPlace, setArrivalPlace] = useState("")
  const [memo, setMemo] = useState("")
  const [amount, setAmount] = useState("")
  const [currency, setCurrency] = useState("KRW")
  const [budgetEnabled, setBudgetEnabled] = useState(false)
  const [category, setCategory] = useState<ScheduleCategory>("other")
  const [subCategory, setSubCategory] = useState("")
  const [showEndTime, setShowEndTime] = useState(false)
  const [titleError, setTitleError] = useState("")
  const [canDetachTransportPanel, setCanDetachTransportPanel] = useState(false)
  const [shouldAnimateDetailSection, setShouldAnimateDetailSection] = useState(false)
  const [shouldRender, setShouldRender] = useState(isOpen)
  const [isModalVisible, setIsModalVisible] = useState(false)

  const [transDepDay, setTransDepDay] = useState(currentDayLabel)
  const [transDepTime, setTransDepTime] = useState("")
  const [transArrDay, setTransArrDay] = useState(currentDayLabel)
  const [transArrTime, setTransArrTime] = useState("")

  const parseTimeWithDay = (value: string) => {
    if (!value) return { time: "", day: currentDayLabel }
    const match = value.match(/^(.+?)\s*\((Day\s+[+-]?\d+)\)$/)
    if (!match) return { time: value, day: currentDayLabel }
    return { time: match[1].trim(), day: match[2].trim() }
  }

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

  const finishClose = (afterClose?: () => void) => {
    clearModalTimers()
    closeTimerRef.current = setTimeout(() => {
      setShouldRender(false)
      afterClose?.()
    }, MODAL_CLOSE_TRANSITION_MS)
  }

  const beginClose = (afterClose?: () => void) => {
    if (!shouldRender) {
      afterClose?.()
      return
    }
    setIsModalVisible(false)
    finishClose(afterClose)
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
      setAmount(Number.isFinite(initialData.amount) ? String(initialData.amount) : "")
      setCurrency(initialData.currency || "KRW")
      setBudgetEnabled((initialData.amount ?? 0) > 0)

      if (initialData.category === "transport") {
        const parsedDep = parseTimeWithDay(initialData.time || "")
        const parsedArr = parseTimeWithDay(initialData.endTime || "")
        setTransDepDay(parsedDep.day)
        setTransDepTime(parsedDep.time)
        setTransArrDay(parsedArr.day)
        setTransArrTime(parsedArr.time)
      }
      setTitleError("")
    } else {
      setTime("")
      setEndTime("")
      setEndDay(currentDayLabel)
      setTitle("")
      setLocation("")
      setCategory("other")
      setSubCategory("")
      setArrivalPlace("")
      setMemo("")
      setAmount("")
      setCurrency("KRW")
      setBudgetEnabled(false)
      setShowEndTime(false)
      setTransDepDay(currentDayLabel)
      setTransDepTime("")
      setTransArrDay(currentDayLabel)
      setTransArrTime("")
      setTitleError("")
    }
    setShouldAnimateDetailSection(false)
  }, [initialData, mode, isOpen])

  useEffect(() => {
    clearModalTimers()
    if (isOpen) {
      setShouldRender(true)
      setIsModalVisible(false)
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = requestAnimationFrame(() => {
          setIsModalVisible(true)
          frameRef.current = null
        })
      })
      return clearModalTimers
    }
    if (shouldRender) {
      setIsModalVisible(false)
      finishClose()
    }
    return clearModalTimers
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return
      if (event.key === "Escape") {
        event.preventDefault()
        beginClose(onClose)
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
  }, [isOpen, onClose, shouldRender])

  useEffect(() => {
    if (!isOpen) return

    const mainPanelWidth = 448
    const detailPanelWidth = 416
    const panelGap = ATTACHED_RIGHT_PANEL_GAP
    const viewportPadding = 32
    const requiredWidth = mainPanelWidth + detailPanelWidth + panelGap + viewportPadding

    const updateLayout = () => {
      if (typeof window === "undefined") return
      setCanDetachTransportPanel(window.innerWidth >= requiredWidth)
    }

    updateLayout()
    window.addEventListener("resize", updateLayout)
    return () => window.removeEventListener("resize", updateLayout)
  }, [isOpen])

  useEffect(() => clearModalTimers, [])

  if (!shouldRender) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setTitleError("일정 제목을 입력해 주세요.")
      return
    }
    setTitleError("")
    const parsedAmount = Number.parseFloat(amount.replace(/,/g, ""))
    const normalizedAmount = budgetEnabled && Number.isFinite(parsedAmount) ? parsedAmount : 0

    if (category === "transport") {
      const depTime = transDepTime
      const arrTime = transArrTime
      const depTimeDisplay =
        depTime && transDepDay !== currentDayLabel ? `${depTime} (${transDepDay})` : depTime
      const arrTimeDisplay =
        arrTime && transArrDay !== currentDayLabel ? `${arrTime} (${transArrDay})` : arrTime

      onSubmit({
        time: depTimeDisplay,
        endTime: arrTimeDisplay,
        title,
        location,
        memo,
        category,
        subCategory: subCategory || "교통",
        amount: normalizedAmount,
        currency,
        arrivalPlace,
        reservationNum: "",
        bookingSource: "",
      })
    } else {
      const endTimeDisplay =
        showEndTime && endTime
          ? endDay !== currentDayLabel
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
        amount: normalizedAmount,
        currency,
        arrivalPlace: "",
        reservationNum: "",
        bookingSource: "",
      })
    }
    beginClose(onClose)
  }

  const detailPanelCategories: ScheduleCategory[] = ["transport", "activity", "food"]
  const hasDetachedCategoryPanel =
    detailPanelCategories.includes(category) && canDetachTransportPanel
  const hasDetachedOtherTimePanel =
    category === "other" && showEndTime && canDetachTransportPanel
  const hasDetachedDetailPanel = hasDetachedCategoryPanel || hasDetachedOtherTimePanel
  const transportDayOptions = tripDayOptions.length > 0 ? tripDayOptions : dayOptions(tripDuration)
  const detachedPanelGap = ATTACHED_RIGHT_PANEL_GAP
  const detailPanelTitle =
    category === "transport"
      ? "교통 상세"
      : category === "activity"
        ? "관광 상세"
        : category === "food"
          ? "식사 상세"
          : "시간 상세"
  const detailSectionKey = hasDetachedCategoryPanel ? "detached-category" : category
  const renderDetachedDetailPlaceholder = (
    title: string,
    description?: string,
    height = DETAIL_SLOT_HEIGHT_PX,
  ) => (
    <div
      className="flex flex-col justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2"
      style={{ height }}
    >
      <FadingPlaceholderCopy title={title} description={description} />
    </div>
  )

  const renderTransportDetails = (detached = false) => (
    <div
      className={
        detached
          ? "space-y-4"
          : "space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4"
      }
    >
      <div>
        <label className="mb-3 block text-sm font-medium text-slate-700">
          세부 카테고리
        </label>
        <div className="flex flex-wrap gap-2">
          {subCategories.transport.map((sub) => (
            <button
              key={sub}
              type="button"
              onClick={() => setSubCategory(subCategory === sub ? "" : sub)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
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
              options={transportDayOptions}
              onChange={setTransDepDay}
            />
          </div>
          <div className="space-y-1.5">
            <div className="text-[11px] font-medium text-slate-500">시간</div>
            <TimeInputPopover
              value={transDepTime}
              placeholder="시간 선택"
              onChange={setTransDepTime}
              placement="top-center"
              offsetY={-10}
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
              options={transportDayOptions}
              onChange={setTransArrDay}
            />
          </div>
          <div className="space-y-1.5">
            <div className="text-[11px] font-medium text-slate-500">시간</div>
            <TimeInputPopover
              value={transArrTime}
              placeholder="시간 선택"
              onChange={setTransArrTime}
              placement="top-center"
              offsetY={-10}
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
  )

  const renderExpandedTimeDetails = () => (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <div className="text-[11px] font-medium text-slate-500">시작 날짜</div>
          <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
            {currentDayLabel}
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="text-[11px] font-medium text-slate-500">시작 시간</div>
          <TimeInputPopover
            value={time}
            placeholder="시간 선택"
            onChange={setTime}
            placement="top-center"
            offsetY={-10}
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
            options={transportDayOptions}
            onChange={setEndDay}
          />
        </div>
        <div className="space-y-1.5">
          <div className="text-[11px] font-medium text-slate-500">완료 시간</div>
          <TimeInputPopover
            value={endTime}
            placeholder="시간 선택"
            onChange={setEndTime}
            placement="top-center"
            offsetY={-10}
          />
        </div>
      </div>
    </div>
  )

  const renderOtherDetachedTimeSlot = () => (
    <div className="relative" style={{ height: COMPACT_DETAIL_SLOT_HEIGHT_PX }}>
      <div
        className={`absolute inset-0 transition-all duration-250 ease-out ${
          hasDetachedOtherTimePanel
            ? "pointer-events-none translate-y-1 scale-[0.98] opacity-0"
            : "translate-y-0 scale-100 opacity-100"
        }`}
      >
        <TimeInputPopover
          value={time}
          placeholder="시간 선택"
          onChange={setTime}
          placement="top-center"
          offsetY={-10}
        />
      </div>
      <div
        className={`absolute inset-0 transition-all duration-250 ease-out ${
          hasDetachedOtherTimePanel
            ? "translate-y-0 scale-100 opacity-100"
            : "pointer-events-none -translate-y-1 scale-[0.98] opacity-0"
        }`}
      >
        {renderDetachedDetailPlaceholder(
          "시간 상세는 옆 패널에서 입력",
          undefined,
          COMPACT_DETAIL_SLOT_HEIGHT_PX,
        )}
      </div>
    </div>
  )

  const renderStandardDetails = (detached = false) => (
    <div
      className={
        detached
          ? "space-y-4"
          : category === "other" || category === "accommodation"
            ? "space-y-4"
            : "space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4"
      }
    >
      {subCategories[category].length > 0 && (
        <div>
          <label className="mb-3 block text-sm font-medium text-slate-700">
            세부 카테고리
          </label>
          <div className="flex flex-wrap gap-2">
            {subCategories[category].map((sub) => (
              <button
                key={sub}
                type="button"
                onClick={() => setSubCategory(subCategory === sub ? "" : sub)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
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

      <div>
        <div className="flex items-center justify-between">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            시간
          </label>
          {!(detached && category === "other") && (
            <button
              type="button"
              onClick={() => setShowEndTime((prev) => !prev)}
              aria-label={showEndTime ? "종료시간 제거" : "종료시간 추가"}
              className="flex h-6 w-6 -translate-y-[2px] items-center justify-center rounded-full bg-emerald-500 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
            >
              {showEndTime ? "–" : "+"}
            </button>
          )}
        </div>
        <div className="space-y-3">
          {category === "other" ? (
            canDetachTransportPanel ? (
              detached ? (
                renderExpandedTimeDetails()
              ) : (
                renderOtherDetachedTimeSlot()
              )
            ) : (
              <>
                {!showEndTime && (
                  <div className="min-w-[140px] flex-1">
                    <TimeInputPopover
                      value={time}
                      placeholder="시간 선택"
                      onChange={setTime}
                      placement="top-center"
                      offsetY={-10}
                    />
                  </div>
                )}
                <div
                  className={`space-y-3 transition-all duration-400 ease-out ${
                    showEndTime
                      ? "max-h-60 translate-y-0 opacity-100"
                      : "pointer-events-none max-h-0 -translate-y-1 overflow-hidden opacity-0"
                  }`}
                >
                  {renderExpandedTimeDetails()}
                </div>
              </>
            )
          ) : (
            <>
              {!showEndTime && (
                <div className="min-w-[140px] flex-1">
                  <TimeInputPopover
                    value={time}
                    placeholder="시간 선택"
                    onChange={setTime}
                    placement="top-center"
                    offsetY={-10}
                  />
                </div>
              )}
              <div
                className={`space-y-3 transition-all duration-400 ease-out ${
                  showEndTime
                    ? "max-h-60 translate-y-0 opacity-100"
                    : "pointer-events-none max-h-0 -translate-y-1 overflow-hidden opacity-0"
                }`}
              >
                {renderExpandedTimeDetails()}
              </div>
            </>
          )}
        </div>
      </div>

      {category !== "accommodation" && category !== "other" ? (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
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
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className={`absolute inset-0 bg-black/50 transition-opacity ${
          isModalVisible ? "opacity-100" : "opacity-0"
        }`}
        style={{
          transitionDuration: `${isModalVisible ? MODAL_OPEN_TRANSITION_MS : MODAL_CLOSE_TRANSITION_MS}ms`,
        }}
        onClick={() => beginClose(onClose)}
      />
      <DraggablePanel
        className="mx-4 w-[min(28rem,calc(100vw-2rem))] max-w-none"
        handleOffset={{ x: 0, y: 10 }}
        floatingHandle
        frameClassName={`transition-all ease-out ${
          isModalVisible
            ? "translate-y-0 scale-100 opacity-100"
            : "translate-y-3 scale-[0.97] opacity-0"
        }`}
        frameStyle={{
          transitionDuration: `${isModalVisible ? MODAL_OPEN_TRANSITION_MS : MODAL_CLOSE_TRANSITION_MS}ms`,
        }}
      >
        <div className="relative overflow-visible">
          <div className="rounded-xl bg-white px-6 pb-6 pt-5 shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
          <div className="mb-5 flex items-center justify-between">
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

          <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                일정 제목
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value)
                  if (titleError) setTitleError("")
                }}
                placeholder="센소지 관람"
                className="w-full rounded-lg bg-slate-100 px-3 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              />
              {titleError && (
                <div className="mt-1 text-xs font-semibold text-red-500">{titleError}</div>
              )}
            </div>

            <div>
              <label className="mb-3 block text-sm font-medium text-slate-700">
                카테고리
              </label>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => {
                      if (category !== cat.value) setShouldAnimateDetailSection(true)
                      setCategory(cat.value)
                      setSubCategory("")
                    }}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
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

            <div
              key={detailSectionKey}
              className={
                shouldAnimateDetailSection
                  ? "animate-in fade-in slide-in-from-bottom-2 duration-350"
                  : ""
              }
              style={{ minHeight: DETAIL_SLOT_HEIGHT_PX }}
            >
              {category === "transport" ? (
                hasDetachedCategoryPanel ? (
                  renderDetachedDetailPlaceholder(
                    `${detailPanelTitle}는 옆 패널에서 입력`,
                    "세부 카테고리와 출발/도착 시간, 장소를 오른쪽 detail 패널에서 입력하세요.",
                  )
                ) : (
                  renderTransportDetails()
                )
              ) : category === "other" ? (
                renderStandardDetails()
              ) : (
                hasDetachedCategoryPanel ? (
                  renderDetachedDetailPlaceholder(
                    `${detailPanelTitle}는 옆 패널에서 입력`,
                    "세부 카테고리와 시간, 장소를 오른쪽 detail 패널에서 입력하세요.",
                  )
                ) : (
                  renderStandardDetails()
                )
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                메모
              </label>
              <textarea
                value={memo}
                onChange={(event) => setMemo(event.target.value)}
                placeholder="Details..."
                rows={3}
                className="w-full resize-none rounded-lg bg-slate-100 px-3 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <label className="block text-sm font-medium text-slate-700">
                  예산
                </label>
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
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      placeholder="0"
                      className="w-full rounded-lg bg-slate-100 px-3 py-2.5 text-right text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                    />
                    <CurrencyPickerPopover
                      value={currency}
                      onChange={setCurrency}
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

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => beginClose(onClose)}
                className="flex-1 bg-transparent"
              >
                취소
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-emerald-500 text-white hover:bg-emerald-600"
              >
                {mode === "add" ? "추가" : "수정"}
              </Button>
            </div>
          </form>
        </div>
          {hasDetachedDetailPanel && (
            <div
              key={detailPanelTitle}
              className="absolute top-1/2 w-[26rem] -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.14)] animate-in fade-in zoom-in-95 slide-in-from-left-8 duration-200"
              style={{
                left: `calc(100% + ${detachedPanelGap}px)`,
              }}
            >
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-500/80">
                Detail
              </div>
              <div className="mb-5">
                <div className="text-xl font-bold text-slate-900">{detailPanelTitle}</div>
              </div>
              {category === "transport" ? renderTransportDetails(true) : renderStandardDetails(true)}
            </div>
          )}
        </div>
      </DraggablePanel>
    </div>
  )
}

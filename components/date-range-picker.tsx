"use client"

import { useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import { ChevronLeft, ChevronRight, Calendar, X } from "lucide-react"

interface DateRangePickerProps {
  startDate: string
  endDate: string
  onDateChange: (startDate: string, endDate: string) => void
  onOpenChange?: (isOpen: boolean) => void
}

export function DateRangePicker({ startDate, endDate, onDateChange, onOpenChange }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(() => new Date())
  const [selectingStart, setSelectingStart] = useState(true)
  const [hoverDate, setHoverDate] = useState<Date | null>(null)
  const [isPopupDragged, setIsPopupDragged] = useState(false)
  const fixedPopupPosition = { left: 959, top: 390, width: 520 }
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const popupDragRef = useRef({ x: 0, y: 0 })
  const [popupStyle, setPopupStyle] = useState<{ top: number; left: number; width: number }>(() => ({
    top: fixedPopupPosition.top,
    left: fixedPopupPosition.left,
    width: fixedPopupPosition.width,
  }))

  const daysOfWeek = ["일", "월", "화", "수", "목", "금", "토"]
  const months = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"]

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        popupRef.current &&
        !popupRef.current.contains(target)
      ) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  useEffect(() => {
    onOpenChange?.(isOpen)
  }, [isOpen, onOpenChange])

  useEffect(() => {
    if (isOpen) {
      setIsPopupDragged(false)
      setPopupStyle({
        top: fixedPopupPosition.top,
        left: fixedPopupPosition.left,
        width: fixedPopupPosition.width,
      })
    }
  }, [isOpen])

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDay = firstDay.getDay()

    const days: (Date | null)[] = []

    for (let i = 0; i < startingDay; i++) {
      days.push(null)
    }

    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i))
    }

    return days
  }

  const formatDateString = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  }

  const isDateInRange = (date: Date) => {
    if (!startDate) return false
    const start = new Date(startDate)
    
    if (endDate) {
      const end = new Date(endDate)
      return date > start && date < end
    }
    
    if (hoverDate && !selectingStart) {
      if (hoverDate > start) {
        return date > start && date < hoverDate
      } else {
        return date > hoverDate && date < start
      }
    }
    
    return false
  }

  const isStartDate = (date: Date) => {
    if (!startDate) return false
    return formatDateString(date) === startDate
  }

  const isEndDate = (date: Date) => {
    if (!endDate) return false
    return formatDateString(date) === endDate
  }

  const isToday = (date: Date) => {
    const today = new Date()
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    )
  }

  const isPastDate = (date: Date) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return date < today
  }

  const handleDateClick = (date: Date) => {
    if (isPastDate(date)) return

    const dateStr = formatDateString(date)

    if (selectingStart) {
      onDateChange(dateStr, "")
      setSelectingStart(false)
    } else {
      const start = new Date(startDate)
      if (date < start) {
        onDateChange(dateStr, startDate)
      } else {
        onDateChange(startDate, dateStr)
      }
      setSelectingStart(true)
    }
  }

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
  }

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))
  }

  const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1)
  const daysCurrentMonth = getDaysInMonth(currentMonth)
  const daysNextMonth = getDaysInMonth(nextMonth)

  const getDayCount = () => {
    if (!startDate || !endDate) return 0
    const start = new Date(startDate)
    const end = new Date(endDate)
    const diffTime = Math.abs(end.getTime() - start.getTime())
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
  }

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return "날짜 선택"
    const date = new Date(dateStr)
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"]
    return `${date.getMonth() + 1}월 ${date.getDate()}일 (${weekdays[date.getDay()]})`
  }

  const renderCalendarMonth = (monthDate: Date, days: (Date | null)[]) => (
    <div className="flex-1 min-w-0">
      <div className="text-center font-semibold text-slate-800 mb-2 text-sm">
        {monthDate.getFullYear()}년 {months[monthDate.getMonth()]}
      </div>
      
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {daysOfWeek.map((day, index) => (
          <div
            key={day}
            className={`text-center text-xs font-medium py-1 ${
              index === 0 ? "text-red-400" : index === 6 ? "text-blue-400" : "text-slate-400"
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {days.map((date, index) => {
          if (!date) {
            return <div key={`empty-${index}`} className="aspect-square" />
          }

          const isStart = isStartDate(date)
          const isEnd = isEndDate(date)
          const inRange = isDateInRange(date)
          const today = isToday(date)
          const past = isPastDate(date)
          const dayOfWeek = date.getDay()

          return (
            <button
              key={date.toISOString()}
              type="button"
              onClick={() => handleDateClick(date)}
              onMouseEnter={() => setHoverDate(date)}
              onMouseLeave={() => setHoverDate(null)}
              disabled={past}
              className={`
                h-9 w-9 mx-auto flex items-center justify-center text-xs font-medium relative transition-all
                ${past ? "text-slate-300 cursor-not-allowed" : "cursor-pointer"}
                ${isStart ? "bg-emerald-500 text-white rounded-l-full" : ""}
                ${isEnd ? "bg-emerald-500 text-white rounded-r-full" : ""}
                ${isStart && isEnd ? "rounded-full" : ""}
                ${inRange ? "bg-emerald-100" : ""}
                ${!inRange && !isStart && !isEnd && !past ? "hover:bg-slate-100 rounded-full" : ""}
                ${!inRange && !isStart && !isEnd && !past ? (
                  dayOfWeek === 0 ? "text-red-500" : dayOfWeek === 6 ? "text-blue-500" : "text-slate-700"
                ) : ""}
                ${today && !isStart && !isEnd ? "font-bold underline underline-offset-2" : ""}
              `}
            >
              {date.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )

  useEffect(() => {
    if (!isOpen) return

    const updatePosition = () => {
      if (isPopupDragged) return
      setPopupStyle({
        top: fixedPopupPosition.top,
        left: fixedPopupPosition.left,
        width: fixedPopupPosition.width,
      })
      return
      const trigger = triggerRef.current
      if (!trigger) return

      const triggerRect = trigger.getBoundingClientRect()
      const modal = containerRef.current?.closest("[data-trip-modal]") as HTMLElement | null
      const modalRect = modal ? modal.getBoundingClientRect() : triggerRect
      const desiredWidth = 520
      const gap = 16
      const padding = 12
      const viewportWidth = window.innerWidth
      const rightSpace = viewportWidth - modalRect.right - gap - padding
      const width = Math.min(desiredWidth, Math.max(320, rightSpace))
      const left = Math.max(padding, Math.min(modalRect.right + gap, viewportWidth - width - padding))
      const top = modalRect.top + modalRect.height / 2

      setPopupStyle({ top, left, width })
    }

    updatePosition()
    window.addEventListener("resize", updatePosition)
    window.addEventListener("scroll", updatePosition, true)

    return () => {
      window.removeEventListener("resize", updatePosition)
      window.removeEventListener("scroll", updatePosition, true)
    }
  }, [isOpen, isPopupDragged])

  return (
    <div ref={containerRef} className="relative">
      {/* Date Input Trigger */}
      <button
        type="button"
        ref={triggerRef}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`
          w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left bg-slate-100
          ${isOpen 
            ? "ring-2 ring-emerald-200" 
            : "hover:bg-slate-200/60"
          }
        `}
      >
        <Calendar className="w-5 h-5 text-emerald-500 flex-shrink-0" />
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <div className="flex-1 min-w-0">
            <span className="text-xs text-slate-500 block">출발</span>
            <span className={`text-sm font-semibold block truncate ${startDate ? "text-slate-700" : "text-slate-400"}`}>
              {formatDisplayDate(startDate)}
            </span>
          </div>
          <div className="flex items-center gap-1 text-slate-300">
            <div className="w-4 h-px bg-slate-300" />
            {startDate && endDate && (
              <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                {getDayCount() - 1}박
              </span>
            )}
            <div className="w-4 h-px bg-slate-300" />
          </div>
          <div className="flex-1 min-w-0 text-right">
            <span className="text-xs text-slate-500 block">도착</span>
            <span className={`text-sm font-semibold block truncate ${endDate ? "text-slate-700" : "text-slate-400"}`}>
              {formatDisplayDate(endDate)}
            </span>
          </div>
        </div>
      </button>

      {/* Calendar Popup */}
      {isOpen && (
        createPortal(
          <div
            ref={popupRef}
            className="fixed z-[80] -translate-y-1/2 bg-white shadow-2xl border border-slate-200 overflow-hidden rounded-xl"
            style={{ top: popupStyle.top, left: popupStyle.left, width: popupStyle.width }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-slate-50 cursor-move select-none"
              onPointerDown={(event) => {
                if (!popupRef.current) return
                event.preventDefault()
                const rect = popupRef.current.getBoundingClientRect()
                popupDragRef.current = { x: event.clientX - rect.left, y: event.clientY - rect.top }
                setIsPopupDragged(true)
                event.currentTarget.setPointerCapture(event.pointerId)

                const handleMove = (moveEvent: PointerEvent) => {
                  const currentRect = popupRef.current?.getBoundingClientRect()
                  const height = currentRect?.height ?? rect.height
                  const padding = 12
                  const width = popupStyle.width
                  const nextLeft = Math.max(padding, Math.min(moveEvent.clientX - popupDragRef.current.x, window.innerWidth - width - padding))
                  const nextTop = Math.max(padding, Math.min(moveEvent.clientY - popupDragRef.current.y, window.innerHeight - height - padding))
                  setPopupStyle((prev) => ({ ...prev, left: nextLeft, top: nextTop }))
                }

                const handleUp = () => {
                  if (popupRef.current) {
                    popupRef.current.releasePointerCapture(event.pointerId)
                  }
                  window.removeEventListener("pointermove", handleMove)
                }

                window.addEventListener("pointermove", handleMove)
                window.addEventListener("pointerup", handleUp, { once: true })
              }}
            >
              <div className="text-xs font-medium text-slate-600">
                출발일 선택 후 도착일을 선택하세요
              </div>
              <div className="text-[11px] text-slate-400">
                x: {Math.round(popupStyle.left)} / y: {Math.round(popupStyle.top)}
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                onPointerDown={(event) => event.stopPropagation()}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
              <button
                type="button"
                onClick={goToPreviousMonth}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-600 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="text-sm font-medium text-slate-700 text-center">
                {currentMonth.getFullYear()}년 {months[currentMonth.getMonth()]} - {nextMonth.getFullYear()}년 {months[nextMonth.getMonth()]}
              </div>
              <button
                type="button"
                onClick={goToNextMonth}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-600 transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Calendars */}
            <div className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                {renderCalendarMonth(currentMonth, daysCurrentMonth)}
                {renderCalendarMonth(nextMonth, daysNextMonth)}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-3 py-2 border-t border-slate-100 bg-slate-50">
              <button
                type="button"
                onClick={() => {
                  onDateChange("", "")
                  setSelectingStart(true)
                }}
                className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
              >
                초기화
              </button>
              <div className="flex items-center gap-2">
                {startDate && endDate && (
                  <span className="text-xs text-emerald-600 font-medium">
                    {getDayCount() - 1}박 {getDayCount()}일
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  disabled={!startDate || !endDate}
                  className="px-3 py-1.5 bg-emerald-500 text-white text-xs font-medium rounded-lg hover:bg-emerald-600 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                >
                  확인
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      )}
    </div>
  )
}

"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface DateRangeCalendarProps {
  startDate: string
  endDate: string
  onDateChange: (startDate: string, endDate: string) => void
}

export function DateRangeCalendar({ startDate, endDate, onDateChange }: DateRangeCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (startDate) {
      return new Date(startDate)
    }
    return new Date()
  })

  const [selectingStart, setSelectingStart] = useState(true)

  const daysOfWeek = ["일", "월", "화", "수", "목", "금", "토"]
  const months = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"]

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDay = firstDay.getDay()

    const days: (Date | null)[] = []

    // Add empty slots for days before the first day of the month
    for (let i = 0; i < startingDay; i++) {
      days.push(null)
    }

    // Add all days of the month
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
    if (!startDate || !endDate) return false
    const start = new Date(startDate)
    const end = new Date(endDate)
    return date >= start && date <= end
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
      // Selecting start date
      onDateChange(dateStr, "")
      setSelectingStart(false)
    } else {
      // Selecting end date
      const start = new Date(startDate)
      if (date < start) {
        // If selected date is before start, swap them
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

  const days = getDaysInMonth(currentMonth)

  const getDayCount = () => {
    if (!startDate || !endDate) return 0
    const start = new Date(startDate)
    const end = new Date(endDate)
    const diffTime = Math.abs(end.getTime() - start.getTime())
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
  }

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return "-"
    const date = new Date(dateStr)
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`
  }

  return (
    <div className="bg-slate-50 rounded-xl p-4">
      {/* Selection Info */}
      <div className="mb-4 p-3 bg-white rounded-lg border border-slate-200">
        <div className="flex items-center justify-between text-sm">
          <div className="flex-1">
            <span className={`text-xs font-medium ${selectingStart && !startDate ? "text-emerald-600" : "text-slate-500"}`}>
              출발일
            </span>
            <p className={`font-semibold ${startDate ? "text-slate-900" : "text-slate-400"}`}>
              {formatDisplayDate(startDate)}
            </p>
          </div>
          <div className="px-3">
            <div className="w-8 h-[2px] bg-slate-300 relative">
              {startDate && endDate && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-xs font-medium text-emerald-600 bg-slate-50 px-1">
                  {getDayCount()}일
                </span>
              )}
            </div>
          </div>
          <div className="flex-1 text-right">
            <span className={`text-xs font-medium ${!selectingStart && startDate ? "text-emerald-600" : "text-slate-500"}`}>
              도착일
            </span>
            <p className={`font-semibold ${endDate ? "text-slate-900" : "text-slate-400"}`}>
              {formatDisplayDate(endDate)}
            </p>
          </div>
        </div>
      </div>

      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={goToPreviousMonth}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-200 text-slate-600 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-base font-semibold text-slate-900">
          {currentMonth.getFullYear()}년 {months[currentMonth.getMonth()]}
        </span>
        <button
          type="button"
          onClick={goToNextMonth}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-200 text-slate-600 transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Days of Week */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {daysOfWeek.map((day, index) => (
          <div
            key={day}
            className={`text-center text-xs font-medium py-2 ${
              index === 0 ? "text-red-400" : index === 6 ? "text-blue-400" : "text-slate-500"
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
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
              disabled={past}
              className={`
                aspect-square flex items-center justify-center text-sm font-medium rounded-lg relative transition-all
                ${past ? "text-slate-300 cursor-not-allowed" : "hover:bg-emerald-100 cursor-pointer"}
                ${isStart || isEnd ? "bg-emerald-500 text-white hover:bg-emerald-600" : ""}
                ${inRange && !isStart && !isEnd ? "bg-emerald-100 text-emerald-700" : ""}
                ${!inRange && !isStart && !isEnd && !past ? (
                  dayOfWeek === 0 ? "text-red-500" : dayOfWeek === 6 ? "text-blue-500" : "text-slate-700"
                ) : ""}
                ${today && !isStart && !isEnd ? "ring-2 ring-emerald-500 ring-inset" : ""}
              `}
            >
              {date.getDate()}
            </button>
          )
        })}
      </div>

      {/* Reset Button */}
      {(startDate || endDate) && (
        <button
          type="button"
          onClick={() => {
            onDateChange("", "")
            setSelectingStart(true)
          }}
          className="mt-4 w-full py-2 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
        >
          날짜 다시 선택
        </button>
      )}
    </div>
  )
}

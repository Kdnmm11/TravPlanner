"use client"

import { Home, MapPin, Plus } from "lucide-react"
import { ScheduleCard } from "./schedule-card"
import type { Schedule } from "@/lib/types"

interface DayColumnProps {
  dayNumber: number
  dayLabel?: string
  date: string
  weekday: string
  schedules: Schedule[]
  isWrapped?: boolean
  isExtraDay?: boolean
  city?: string
  accommodation?: string
  cardWidthOffset?: number
  cardHeightOffset?: number
  cardGap?: number
  textScale?: number
  categoryScale?: number
  columnWidth?: number
  onEditDayInfo?: () => void
  onAddSchedule?: () => void
  onEditSchedule?: (schedule: Schedule) => void
  onDeleteSchedule?: (scheduleId: string) => void
}

const formatCityText = (value?: string) => {
  if (!value) return "-"
  const cities = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
  return cities.length === 0 ? "-" : cities.join(" > ")
}

export function DayColumn({ 
  dayNumber, 
  dayLabel,
  date, 
  weekday, 
  schedules,
  isWrapped = false,
  isExtraDay = false,
  city,
  accommodation,
  cardWidthOffset = 0,
  cardHeightOffset = 0,
  cardGap = 8,
  textScale = 1,
  categoryScale = 1,
  columnWidth = 320,
  onEditDayInfo,
  onAddSchedule,
  onEditSchedule,
  onDeleteSchedule,
}: DayColumnProps) {
  const cityText = formatCityText(city)
  const stayText = accommodation?.trim() || "-"
  const resolvedColumnWidth = Math.max(272, Math.round(columnWidth))
  const plusPosition = { top: -55, right: 16 }
  const plusSize = 50


  return (
    <div
      className={`flex h-full min-h-[720px] flex-col flex-shrink-0 ${
        isWrapped ? "opacity-[0.74]" : "opacity-100"
      }`}
      style={{
        flex: `0 0 ${resolvedColumnWidth}px`,
        width: `${resolvedColumnWidth}px`,
        minWidth: `${resolvedColumnWidth}px`,
        maxWidth: `${resolvedColumnWidth}px`,
        height: "100%",
        filter: isWrapped ? "saturate(0.78) brightness(0.92)" : "none",
      }}
    >
      {/* Day Header */}
      <div className="bg-white rounded-t-xl p-4 border border-slate-200 border-b-0">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900 mt-0.5">{date}</h3>
            <span className="text-sm text-slate-500">{weekday}</span>
          </div>
          <div className="text-emerald-500 text-xl font-bold">
            {dayLabel ?? `Day ${dayNumber}`}
          </div>
        </div>
      </div>

      {/* Schedules */}
      <div className="flex-1 min-h-0 bg-slate-50/70 p-4 overflow-y-auto border-x border-slate-200">
        {schedules.map((schedule) => (
          <div
            key={schedule.id}
            style={{
              marginLeft: `${-cardWidthOffset / 2}px`,
              marginRight: `${-cardWidthOffset / 2}px`,
              marginBottom: `${cardGap}px`,
            }}
          >
            <ScheduleCard
              time={schedule.time}
              endTime={schedule.endTime}
              title={schedule.title}
              location={schedule.location}
              memo={schedule.memo}
              category={schedule.category}
              subCategory={schedule.subCategory}
              arrivalPlace={schedule.arrivalPlace}
              heightOffset={cardHeightOffset}
              textScale={textScale}
              categoryScale={categoryScale}
              onEdit={() => onEditSchedule?.(schedule)}
              onDelete={() => onDeleteSchedule?.(schedule.id)}
            />
          </div>
        ))}
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={onEditDayInfo}
          className="w-full bg-white rounded-b-xl p-4 border border-slate-200 border-t-0 text-left hover:bg-slate-50 transition"
        >
          <div className="space-y-1 text-[14.5px] leading-[1.35] text-slate-500">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-500" />
              <span className="truncate text-slate-900">{cityText}</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-500">
              <Home className="w-3.5 h-3.5 text-slate-500" />
              <span className="truncate text-slate-900">{stayText}</span>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={onAddSchedule}
          className="absolute rounded-full bg-emerald-500 text-white shadow-sm hover:bg-emerald-600 transition"
          style={{
            right: `${plusPosition.right}px`,
            top: `${plusPosition.top}px`,
            width: plusSize,
            height: plusSize,
          }}
        >
          <Plus className="mx-auto" style={{ width: 22, height: 22 }} />
        </button>
      </div>
    </div>
  )
}

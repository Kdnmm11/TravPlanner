"use client"

import { useEffect, useRef, useState } from "react"
import { MapPin } from "lucide-react"

interface ScheduleCardProps {
  time: string
  endTime?: string
  title: string
  location: string
  memo?: string
  category?: "food" | "activity" | "transport" | "accommodation" | "other"
  subCategory?: string
  arrivalPlace?: string
  heightOffset?: number
  textScale?: number
  categoryScale?: number
  onEdit?: () => void
  onDelete?: () => void
}

const categoryPalettes: Record<string, string[]> = {
  food: ["border-l-orange-300", "border-l-orange-400", "border-l-orange-500"],
  activity: ["border-l-blue-300", "border-l-blue-400", "border-l-blue-500"],
  transport: ["border-l-emerald-300", "border-l-emerald-400", "border-l-emerald-500"],
  accommodation: ["border-l-teal-300", "border-l-teal-400", "border-l-teal-500"],
  other: ["border-l-slate-300", "border-l-slate-400", "border-l-slate-500"],
}

const categoryLabels = {
  food: "식사",
  activity: "관광",
  transport: "교통",
  accommodation: "숙소",
  other: "기타",
}

const getAccentClass = (category: keyof typeof categoryLabels, seed: string) => {
  const palette = categoryPalettes[category] || categoryPalettes.other
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 1000
  }
  return palette[hash % palette.length]
}

const TITLE_INDENT_PX = 2

export function ScheduleCard({
  time,
  endTime,
  title,
  location,
  memo,
  category = "activity",
  subCategory,
  arrivalPlace,
  heightOffset = 0,
  textScale = 1,
  categoryScale = 1,
  onEdit,
  onDelete,
}: ScheduleCardProps) {
  const displayTime = time.trim().split(" ")[0]
  const displayEndTime = endTime?.trim().split(" ")[0] ?? ""
  const hasEndTime = Boolean(displayEndTime)
  const normalizedSubCategory = subCategory?.trim() ?? ""
  const hasSubCategory = normalizedSubCategory.length > 0
  const normalizedLocation = (location ?? "").trim()
  const normalizedArrivalPlace = arrivalPlace?.trim() ?? ""
  const normalizedMemo = memo?.trim() ?? ""
  const locationText =
    category === "transport" && normalizedArrivalPlace
      ? `${normalizedLocation} > ${normalizedArrivalPlace}`
      : normalizedLocation

  const accentClass = getAccentClass(category, `${time}-${title}`)
  const [expanded, setExpanded] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const basePaddingTop = 8
  const basePaddingBottom = 8
  const timeFont = 16 * textScale
  const titleFont = 15.4 * textScale
  const categoryFont = 12 * categoryScale
  const detailFont = 14 * textScale
  const expandedMaxHeight = 96 + heightOffset
  const baseMinHeight = 82 + heightOffset

  useEffect(() => {
    if (!expanded || !cardRef.current) return
    cardRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [expanded])

  return (
    <div
      ref={cardRef}
      onClick={() => setExpanded((prev) => !prev)}
      className={`group overflow-hidden rounded-lg border-l-4 border border-slate-200 bg-white px-3 transition-shadow ${accentClass}`}
      style={{
        paddingTop: basePaddingTop + heightOffset / 2,
        paddingBottom: basePaddingBottom + heightOffset / 2,
        minHeight: baseMinHeight,
      }}
    >
      {hasEndTime ? (
        <div>
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1 font-bold text-emerald-600" style={{ fontSize: timeFont }}>
              {displayTime} - {displayEndTime}
            </div>
            <div className="ml-auto flex items-center gap-1">
              <span
                className="font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700"
                style={{ fontSize: categoryFont }}
              >
                {categoryLabels[category]}
              </span>
              {hasSubCategory ? (
                <span
                  className="font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600"
                  style={{ fontSize: categoryFont }}
                >
                  {normalizedSubCategory}
                </span>
              ) : null}
            </div>
          </div>
          <div
            className="mt-1 truncate font-bold text-slate-900"
            style={{ fontSize: titleFont, paddingLeft: TITLE_INDENT_PX }}
          >
            {title}
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-emerald-600" style={{ fontSize: timeFont }}>
                {displayTime}
              </span>
              <span className="min-w-0 flex-1 truncate font-bold text-slate-900" style={{ fontSize: titleFont }}>
                {title}
              </span>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <span
              className="font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700"
              style={{ fontSize: categoryFont }}
            >
              {categoryLabels[category]}
            </span>
            {hasSubCategory ? (
              <span
                className="font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600"
                style={{ fontSize: categoryFont }}
              >
                {normalizedSubCategory}
              </span>
            ) : null}
          </div>
        </div>
      )}
      <div className="mt-1 font-semibold text-slate-600" style={{ fontSize: detailFont }}>
        {locationText ? (
          <div className="ml-[-3px] flex items-center gap-1.5 truncate">
            <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
            <span className="truncate">{locationText}</span>
          </div>
        ) : (
          <div className="ml-[-3px] flex items-center gap-1.5 text-slate-400">
            <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-slate-300" />
            <span>장소 미정</span>
          </div>
        )}
      </div>
      <div
        className="overflow-hidden"
        style={{
          maxHeight: expanded ? expandedMaxHeight : 0,
          marginTop: expanded ? 8 : 0,
          opacity: expanded ? 1 : 0,
          transition:
            "max-height 240ms ease, margin-top 240ms ease, opacity 336ms ease",
        }}
      >
        <div className="mt-1 font-semibold text-slate-500" style={{ fontSize: detailFont }}>
          {normalizedMemo || "메모 없음"}
        </div>
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onEdit?.()
            }}
            className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-600"
          >
            수정
          </button>
        </div>
      </div>
    </div>
  )
}

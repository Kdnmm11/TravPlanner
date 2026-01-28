"use client"

import { useEffect, useRef, useState } from "react"

interface ScheduleCardProps {
  time: string
  title: string
  location: string
  memo?: string
  category?: "food" | "activity" | "transport" | "accommodation" | "other"
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

export function ScheduleCard({
  time,
  title,
  location,
  memo,
  category = "activity",
  arrivalPlace,
  heightOffset = 0,
  textScale = 1,
  categoryScale = 1,
  onEdit,
  onDelete,
}: ScheduleCardProps) {
  const locationText =
    category === "transport" && arrivalPlace
      ? `${location} > ${arrivalPlace}`
      : location

  const accentClass = getAccentClass(category, `${time}-${title}`)
  const [expanded, setExpanded] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const basePaddingY = 14
  const timeFont = 16 * textScale
  const titleFont = 14 * textScale
  const categoryFont = 12 * categoryScale
  const detailFont = 14 * textScale
  const expandedMaxHeight = 128 + heightOffset
  const baseMinHeight = 68 + heightOffset

  useEffect(() => {
    if (!expanded || !cardRef.current) return
    cardRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [expanded])

  return (
    <div
      ref={cardRef}
      onClick={() => setExpanded((prev) => !prev)}
      className={`rounded-lg border-l-4 border border-slate-200 bg-white px-3 transition-shadow group ${accentClass}`}
      style={{
        paddingTop: basePaddingY + heightOffset / 2,
        paddingBottom: basePaddingY + heightOffset / 2,
        minHeight: baseMinHeight,
        height: expanded ? "auto" : baseMinHeight,
      }}
    >
      <div className="flex items-center gap-2">
        <span className="font-bold text-emerald-600" style={{ fontSize: timeFont }}>
          {time}
        </span>
        <span className="min-w-0 flex-1 font-bold text-slate-900 truncate" style={{ fontSize: titleFont }}>
          {title}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <span
            className="font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600"
            style={{ fontSize: categoryFont }}
          >
            {categoryLabels[category]}
          </span>
        </div>
      </div>
      <div
        className={`overflow-hidden transition-all duration-300 ${expanded ? "opacity-100 mt-2" : "opacity-0"}`}
        style={{ maxHeight: expanded ? expandedMaxHeight : 0 }}
      >
        <div className="font-semibold text-slate-600" style={{ fontSize: detailFont }}>
          {locationText ? (
            <div className="truncate">{locationText}</div>
          ) : (
            <div className="text-slate-400">장소 미정</div>
          )}
        </div>
        <div className="mt-1 font-semibold text-slate-500" style={{ fontSize: detailFont }}>
          {memo ? memo : "메모 없음"}
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

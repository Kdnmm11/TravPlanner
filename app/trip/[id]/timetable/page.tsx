"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import { ArrowRight, Home, MapPin, Plane } from "lucide-react"
import { useTravelStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { ensureAuthUid } from "@/lib/firebase"
import type { Schedule, ScheduleFormData, Trip } from "@/lib/types"
import { ScheduleModal } from "@/components/schedule-modal"
import { ShareSync } from "@/components/share-sync"
import { ShareChatModal } from "@/components/share-chat-modal"
import { DraggablePanel } from "@/components/draggable-panel"
import { PasswordInput } from "@/components/password-input"
import { TripRouteTransition } from "@/components/trip-route-transition"
import {
  banShareMember,
  hashPassword,
  setShareEnabled as setShareEnabledRemote,
  setSharePassword as setSharePasswordRemote,
  updateShare,
} from "@/lib/share"
import type { ShareLog, ShareMember } from "@/lib/share"
import {
  clearStoredSharePasswordHash,
  getStoredShareName,
  getStoredSharePasswordHash,
  setStoredShareName,
  setStoredSharePasswordHash,
} from "@/lib/share-local"
import { formatTripDayLabel, getTripDayOptions, parseTripDayLabel } from "@/lib/trip-day"

const hourHeightDefault = 56
const timeLabelWidth = 56
const dayHeaderHeight = 40
const infoHeaderHeight = 36
const gridTopGapMinutes = 10
const TIMETABLE_POPUP_TRANSITION_MS = 220

const categoryLabels: Record<string, string> = {
  food: "식사",
  activity: "관광",
  transport: "교통",
  accommodation: "숙소",
  other: "기타",
}

const parseTime = (value: string) => {
  const time = value.trim().split(" ")[0]
  const [hour = "0", minute = "0"] = time.split(":")
  return {
    hour: Number.parseInt(hour, 10) || 0,
    minute: Number.parseInt(minute, 10) || 0,
  }
}

const toMinutes = (value: string) => {
  const { hour, minute } = parseTime(value || "00:00")
  return hour * 60 + minute
}

const fromMinutes = (minutes: number) => {
  const safeMinutes = Math.max(0, Math.min(minutes, 23 * 60 + 59))
  const hours = Math.floor(safeMinutes / 60)
  const mins = safeMinutes % 60
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`
}

const parseEndDay = (endTime: string, startDay: number, trip: Pick<Trip, "startDate" | "endDate">) => {
  const match = endTime.match(/\((Day\s+[+-]?\d+)\)/)
  if (!match) return startDay
  return parseTripDayLabel(match[1], trip) ?? startDay
}

const getScheduleRange = (schedule: Schedule, trip: Pick<Trip, "startDate" | "endDate">) => {
  const startDay = schedule.dayNumber
  const endDay = schedule.endTime ? parseEndDay(schedule.endTime, startDay, trip) : startDay
  return { startDay, endDay }
}

const formatCityText = (value?: string) => {
  if (!value) return "-"
  const cities = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
  return cities.length === 0 ? "-" : cities.join(" > ")
}

const getScheduleTimesForDay = (
  schedule: Schedule,
  dayNumber: number,
  trip: Pick<Trip, "startDate" | "endDate">
) => {
  const { startDay, endDay } = getScheduleRange(schedule, trip)
  const startMinutes = dayNumber > startDay ? 0 : toMinutes(schedule.time || "00:00")
  let endMinutes = startMinutes + 60

  if (dayNumber < endDay) {
    endMinutes = 24 * 60
  } else if (schedule.endTime) {
    endMinutes = toMinutes(schedule.endTime)
  }

  endMinutes = Math.max(startMinutes + 30, Math.min(endMinutes, 24 * 60))

  return { startMinutes, endMinutes }
}

const toLocalDate = (value: string) => {
  const [year, month, day] = value.split("-").map((part) => Number.parseInt(part, 10))
  return new Date(year || 0, Math.max(0, (month || 1) - 1), day || 1)
}

const formatDateRange = (startDate: string, endDate: string) => {
  const start = toLocalDate(startDate)
  const end = toLocalDate(endDate)
  return `${start.getFullYear()}.${String(start.getMonth() + 1).padStart(2, "0")}.${String(
    start.getDate()
  ).padStart(2, "0")} - ${end.getFullYear()}.${String(end.getMonth() + 1).padStart(2, "0")}.${String(
    end.getDate()
  ).padStart(2, "0")}`
}

export default function TripTimeTablePage() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const shareId = searchParams.get("share")
  const { trips, schedules, dayInfos, addSchedule, updateSchedule, deleteTrip, exportTripData, activeShares, setActiveShare } = useTravelStore()
  const router = useRouter()
  const trip = trips.find((item) => item.id === id)

  const scrollRef = useRef<HTMLDivElement>(null)
  const columnsRef = useRef<HTMLDivElement>(null)
  const timeLabelRef = useRef<HTMLDivElement>(null)
  const timetableFrameRef = useRef<HTMLDivElement>(null)

  const [scheduleModalOpen, setScheduleModalOpen] = useState(false)
  const [initialSchedule, setInitialSchedule] = useState<ScheduleFormData | null>(null)
  const [selectedDayNumber, setSelectedDayNumber] = useState(1)
  const [selectedScheduleCard, setSelectedScheduleCard] = useState<{ id: string; dayNumber: number } | null>(null)
  const [renderedSchedulePopupCard, setRenderedSchedulePopupCard] = useState<{ id: string; dayNumber: number } | null>(null)
  const [isSchedulePopupVisible, setIsSchedulePopupVisible] = useState(false)
  const [selectedSchedulePopupLayout, setSelectedSchedulePopupLayout] = useState<{
    left: number
    top: number
    width: number
  } | null>(null)
  const [selectedDayInfoNumber, setSelectedDayInfoNumber] = useState<number | null>(null)
  const [dragState, setDragState] = useState<{
    id: string
    originDay: number
    originStart: number
    duration: number
    offsetY: number
  } | null>(null)
  const [dragPreview, setDragPreview] = useState<{ id: string; dayNumber: number; startMinutes: number } | null>(null)
  const [resizeState, setResizeState] = useState<{
    id: string
    originDay: number
    startMinutes: number
    endMinutes: number
    offsetY: number
  } | null>(null)
  const activeShare = activeShares[id]
  const effectiveShareId = shareId ?? activeShare?.shareId ?? null
  const isJoinedShare = Boolean(shareId) || activeShare?.role === "member"
  const [shareEnabled, setShareEnabledState] = useState(activeShare?.enabled ?? true)
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null)
  const [lastSyncDirection, setLastSyncDirection] = useState<"push" | "pull" | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [shareLogs, setShareLogs] = useState<ShareLog[]>([])
  const [shareMembers, setShareMembers] = useState<ShareMember[]>([])
  const [shareOwnerId, setShareOwnerId] = useState<string | null>(null)
  const [accessDenied, setAccessDenied] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [clientId, setClientId] = useState<string | null>(null)
  const [shareName, setShareName] = useState("")
  const [shareNameOpen, setShareNameOpen] = useState(false)
  const [sharePassword, setSharePassword] = useState("")
  const [sharePasswordOpen, setSharePasswordOpen] = useState(false)
  const [sharePasswordHash, setSharePasswordHash] = useState<string | null>(null)
  const [sharePasswordReady, setSharePasswordReady] = useState(() => !effectiveShareId)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [shareSettingsOpen, setShareSettingsOpen] = useState(false)
  const [sharePasswordNext, setSharePasswordNext] = useState("")
  const [sharePasswordEnabled, setSharePasswordEnabled] = useState(false)
  const [shareSettingsError, setShareSettingsError] = useState<string | null>(null)
  const [shareLinkCopied, setShareLinkCopied] = useState(false)
  const [isLocalAdmin, setIsLocalAdmin] = useState(false)
  const schedulePopupCloseTimerRef = useRef<number | null>(null)
  const schedulePopupFrameRef = useRef<number | null>(null)
  const isAdmin = isLocalAdmin || Boolean(clientId && shareOwnerId && clientId === shareOwnerId)
  const tripDayLabels = useMemo(() => (trip ? getTripDayOptions(trip).map((option) => option.label) : []), [trip])

  useEffect(() => {
    if (!activeShare) return
    setShareEnabledState(activeShare.enabled)
  }, [activeShare?.enabled])

  useEffect(() => {
    if (!shareId || !trip || !effectiveShareId) return
    const nextRole = isAdmin ? "admin" : "member"
    if (
      activeShare?.shareId === effectiveShareId &&
      activeShare.enabled === shareEnabled &&
      activeShare.role === nextRole
    ) {
      return
    }
    setActiveShare(trip.id, effectiveShareId, shareEnabled, nextRole)
  }, [shareId, trip, effectiveShareId, shareEnabled, isAdmin, activeShare, setActiveShare])

  useEffect(() => {
    if (!effectiveShareId) {
      setSharePasswordHash(null)
      setSharePasswordReady(true)
      return
    }
    setSharePasswordReady(false)
    setSharePasswordHash(getStoredSharePasswordHash(effectiveShareId))
    setSharePasswordReady(true)
  }, [effectiveShareId])

  useEffect(() => {
    if (!effectiveShareId || !clientId) return
    if (!shareId && activeShare?.role !== "member") {
      setShareName("admin")
      setShareNameOpen(false)
      setIsLocalAdmin(true)
      return
    }
    const storedName = getStoredShareName(effectiveShareId)
    const storedPass = getStoredSharePasswordHash(effectiveShareId)
    const isOwnerByDoc = Boolean(shareOwnerId && shareOwnerId === clientId)
    if (isOwnerByDoc) {
      setShareName("admin")
      setShareNameOpen(false)
      setIsLocalAdmin(true)
    } else if (storedName) {
      setShareName(storedName)
      setShareNameOpen(false)
      setIsLocalAdmin(false)
    } else {
      setShareNameOpen(true)
      setIsLocalAdmin(false)
    }
    if (storedPass) {
      setSharePasswordHash(storedPass)
    }
  }, [effectiveShareId, clientId, shareId, shareOwnerId, activeShare?.role])

  useEffect(() => {
    let cancelled = false
    ensureAuthUid()
      .then((uid) => {
        if (cancelled) return
        setClientId(uid)
        localStorage.setItem("trav-client-id", uid)
      })
      .catch((error) => {
        console.error("Auth init failed", error)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!accessDenied) return
    if (isAdmin) return
    if (isJoinedShare) {
      deleteTrip(id)
    }
    router.replace("/")
  }, [accessDenied, isAdmin, isJoinedShare, router, deleteTrip, id])

  const handleSync = (direction: "push" | "pull") => {
    setLastSyncAt(new Date())
    setLastSyncDirection(direction)
    setSyncError(null)
  }

  const formatSyncTime = (value: Date | null) =>
    value
      ? value.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      : ""

  const handleManualSync = async () => {
    if (!effectiveShareId) return
    const payload = exportTripData(id)
    if (!payload) return
    setSyncError(null)
    try {
      await updateShare(effectiveShareId, payload)
      handleSync("push")
    } catch (error) {
      console.error("Manual share update failed", error)
      setSyncError("업로드 실패")
    }
  }

  const handleSubmitShareName = () => {
    if (!effectiveShareId || !shareName.trim()) return
    setStoredShareName(effectiveShareId, shareName.trim())
    setShareNameOpen(false)
  }

  const handleSubmitPassword = async () => {
    if (!effectiveShareId || !sharePassword.trim()) return
    const hash = await hashPassword(sharePassword.trim())
    setSharePasswordHash(hash)
    setStoredSharePasswordHash(effectiveShareId, hash)
    setPasswordError(null)
    setSharePasswordOpen(false)
  }

  const getShareBaseUrl = () => {
    const envUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_VERCEL_URL
    if (envUrl) {
      return envUrl.startsWith("http") ? envUrl : `https://${envUrl}`
    }
    return window.location.origin
  }

  const handleCopyShareLink = async () => {
    if (!effectiveShareId) return
    const link = `${getShareBaseUrl()}/trip/${id}?share=${effectiveShareId}`
    try {
      await navigator.clipboard.writeText(link)
      setShareLinkCopied(true)
      window.setTimeout(() => setShareLinkCopied(false), 1500)
    } catch {
      setShareSettingsError("복사에 실패했습니다")
    }
  }

  const handleSaveShareSettings = async () => {
    if (!effectiveShareId || !isAdmin) return
    setShareSettingsError(null)
    if (!sharePasswordEnabled) {
      await setSharePasswordRemote(effectiveShareId, null)
      clearStoredSharePasswordHash(effectiveShareId)
      setSharePasswordHash(null)
      setShareSettingsOpen(false)
      return
    }
    if (!sharePasswordNext.trim()) {
      setShareSettingsError("비밀번호를 입력해 주세요.")
      return
    }
    const hash = await hashPassword(sharePasswordNext.trim())
    await setSharePasswordRemote(effectiveShareId, hash)
    setStoredSharePasswordHash(effectiveShareId, hash)
    setSharePasswordHash(hash)
    setShareSettingsOpen(false)
  }

  const handleToggleShareEnabled = async () => {
    if (!effectiveShareId || !isAdmin) return
    const next = !shareEnabled
    setShareEnabledState(next)
    try {
      await setShareEnabledRemote(effectiveShareId, next)
    } catch (error) {
      console.error("Share enabled update failed", error)
      setShareEnabledState(!next)
      setShareSettingsError("공유 상태를 변경하지 못했습니다.")
    }
  }

  useEffect(() => {
    if (!shareSettingsOpen) return
    setSharePasswordNext("")
    setSharePasswordEnabled(Boolean(sharePasswordHash))
    setShareSettingsError(null)
    setShareLinkCopied(false)
  }, [shareSettingsOpen, sharePasswordHash])

  const handleBanMember = async (memberId: string) => {
    if (!effectiveShareId) return
    await banShareMember(effectiveShareId, memberId)
  }

  const handleShareDisabled = (disabled: boolean, ownerId?: string | null) => {
    if (!disabled) return
    if (clientId && ownerId && clientId === ownerId) return
    if (isJoinedShare) {
      deleteTrip(id)
    }
    router.replace("/")
  }
  const tableHeight = 740
  const dragMovedRef = useRef(false)
  const [showRightFade, setShowRightFade] = useState(false)
  const hourHeight = hourHeightDefault
  const gridTopOffset = (gridTopGapMinutes / 60) * hourHeight

  const weekMeta = useMemo(() => {
    if (!trip) return []
    const tripStart = toLocalDate(trip.startDate)
    const tripEnd = toLocalDate(trip.endDate)
    const baseStart = new Date(tripStart)
    baseStart.setDate(baseStart.getDate() - trip.preDays)
    const totalDays =
      Math.floor((tripEnd.getTime() - tripStart.getTime()) / (1000 * 60 * 60 * 24)) +
      1 +
      trip.preDays +
      trip.postDays

    return Array.from({ length: totalDays }, (_, index) => {
      const date = new Date(baseStart)
      date.setDate(baseStart.getDate() + index)
      const dayNumber = 1 - trip.preDays + index
      return { date, dayNumber }
    })
  }, [trip])

  const { startHour, endHour } = useMemo(() => {
    if (!trip) return { startHour: 8, endHour: 24 }
    const weekDays = new Set(weekMeta.map((day) => day.dayNumber))
    const visibleSchedules = schedules.filter((schedule) => schedule.tripId === trip.id).filter((schedule) => {
      const range = getScheduleRange(schedule, trip)
      for (let day = range.startDay; day <= range.endDay; day += 1) {
        if (weekDays.has(day)) return true
      }
      return false
    })

    if (visibleSchedules.length === 0) {
      return { startHour: 8, endHour: 24 }
    }

    let minHour = 24
    visibleSchedules.forEach((schedule) => {
      const startMinutes = toMinutes(schedule.time || "08:00")
      minHour = Math.min(minHour, Math.floor(startMinutes / 60))
    })

    const finalStart = minHour < 8 ? Math.max(0, minHour) : 8
    return { startHour: finalStart, endHour: 24 }
  }, [trip, schedules, weekMeta])

  const selectedSchedule = useMemo(
    () => schedules.find((schedule) => schedule.id === renderedSchedulePopupCard?.id) ?? null,
    [schedules, renderedSchedulePopupCard]
  )

  useEffect(() => {
    if (schedulePopupCloseTimerRef.current !== null) {
      window.clearTimeout(schedulePopupCloseTimerRef.current)
      schedulePopupCloseTimerRef.current = null
    }
    if (schedulePopupFrameRef.current !== null) {
      window.cancelAnimationFrame(schedulePopupFrameRef.current)
      schedulePopupFrameRef.current = null
    }

    if (selectedScheduleCard) {
      setRenderedSchedulePopupCard(selectedScheduleCard)
      setIsSchedulePopupVisible(false)
      schedulePopupFrameRef.current = window.requestAnimationFrame(() => {
        schedulePopupFrameRef.current = window.requestAnimationFrame(() => {
          setIsSchedulePopupVisible(true)
          schedulePopupFrameRef.current = null
        })
      })
      return () => {
        if (schedulePopupCloseTimerRef.current !== null) {
          window.clearTimeout(schedulePopupCloseTimerRef.current)
          schedulePopupCloseTimerRef.current = null
        }
        if (schedulePopupFrameRef.current !== null) {
          window.cancelAnimationFrame(schedulePopupFrameRef.current)
          schedulePopupFrameRef.current = null
        }
      }
    }

    if (renderedSchedulePopupCard) {
      setIsSchedulePopupVisible(false)
      schedulePopupCloseTimerRef.current = window.setTimeout(() => {
        setRenderedSchedulePopupCard(null)
        setSelectedSchedulePopupLayout(null)
        schedulePopupCloseTimerRef.current = null
      }, TIMETABLE_POPUP_TRANSITION_MS)
    }

    return () => {
      if (schedulePopupCloseTimerRef.current !== null) {
        window.clearTimeout(schedulePopupCloseTimerRef.current)
        schedulePopupCloseTimerRef.current = null
      }
      if (schedulePopupFrameRef.current !== null) {
        window.cancelAnimationFrame(schedulePopupFrameRef.current)
        schedulePopupFrameRef.current = null
      }
    }
  }, [selectedScheduleCard, renderedSchedulePopupCard])

  useEffect(() => {
    if (!selectedScheduleCard || !columnsRef.current || !timetableFrameRef.current) {
      return
    }

    const updatePopupLayout = () => {
      if (!columnsRef.current || !timetableFrameRef.current) return

      const cardNode = Array.from(
        columnsRef.current.querySelectorAll<HTMLElement>("[data-schedule-card-id][data-schedule-card-day]")
      ).find(
        (node) =>
          node.dataset.scheduleCardId === selectedScheduleCard.id &&
          Number(node.dataset.scheduleCardDay) === selectedScheduleCard.dayNumber
      )

      if (!cardNode) {
        setSelectedSchedulePopupLayout(null)
        return
      }

      const frameRect = timetableFrameRef.current.getBoundingClientRect()
      const cardRect = cardNode.getBoundingClientRect()
      const estimatedPopupHeight = 252
      const cardTop = cardRect.top - frameRect.top
      const cardBottom = cardRect.bottom - frameRect.top
      const cardMid = cardTop + cardRect.height / 2
      const cardCenterX = cardRect.left - frameRect.left + cardRect.width / 2
      const placeBelow = cardMid < frameRect.height / 2
      const availableWidth = frameRect.width - 16
      const preferredWidth = Math.min(348, Math.max(cardRect.width + 40, 280))
      const width = availableWidth > 0 ? Math.min(preferredWidth, availableWidth) : preferredWidth
      const left = Math.max(8, Math.min(cardCenterX - width / 2, frameRect.width - width - 8))
      const top = placeBelow
        ? Math.min(cardBottom + 2, frameRect.height - estimatedPopupHeight - 8)
        : Math.max(8, cardTop - estimatedPopupHeight - 2)

      setSelectedSchedulePopupLayout({ left, top, width })
    }

    updatePopupLayout()

    const scrollNode = scrollRef.current
    const handleReposition = () => updatePopupLayout()
    scrollNode?.addEventListener("scroll", handleReposition)
    window.addEventListener("resize", handleReposition)

    return () => {
      scrollNode?.removeEventListener("scroll", handleReposition)
      window.removeEventListener("resize", handleReposition)
    }
  }, [selectedScheduleCard, schedules, weekMeta])

  const selectedScheduleTimeRange = selectedSchedule
    ? selectedSchedule.endTime
      ? `${selectedSchedule.time} - ${selectedSchedule.endTime.split(" ")[0]}`
      : selectedSchedule.time
    : ""
  const selectedScheduleDetailLabel = selectedSchedule?.category === "transport" ? "이동" : "장소"
  const selectedScheduleLocationSummary =
    selectedSchedule?.category === "transport" && selectedSchedule.arrivalPlace?.trim()
      ? `${(selectedSchedule.location ?? "").trim()} > ${selectedSchedule.arrivalPlace.trim()}`
      : (selectedSchedule?.location ?? "").trim() || "장소 미정"

  const openAddModal = (slot: { dayNumber: number; minutes: number }) => {
    setSelectedDayNumber(slot.dayNumber)
    setInitialSchedule({
      time: fromMinutes(slot.minutes + startHour * 60),
      endTime: "",
      title: "",
      location: "",
      memo: "",
      category: "other",
      subCategory: "",
      amount: 0,
      currency: "KRW",
      arrivalPlace: "",
      reservationNum: "",
      bookingSource: "",
    })
    setScheduleModalOpen(true)
  }

  const handleScheduleSubmit = (data: ScheduleFormData) => {
    if (!trip) return
    addSchedule(trip.id, selectedDayNumber, data)
  }

  const getColumnWidth = () => {
    const firstColumn = columnsRef.current?.querySelector("[data-day-column]") as HTMLElement | null
    return firstColumn?.offsetWidth || 140
  }

  const startDrag = (
    event: React.PointerEvent<HTMLDivElement>,
    schedule: Schedule,
    dayNumber: number,
    startMinutes: number,
    endMinutes: number
  ) => {
    event.stopPropagation()
    const rect = event.currentTarget.getBoundingClientRect()
    const offsetY = event.clientY - rect.top
    dragMovedRef.current = false
    setDragState({
      id: schedule.id,
      originDay: dayNumber,
      originStart: startMinutes,
      duration: Math.max(30, endMinutes - startMinutes),
      offsetY,
    })
    setDragPreview({ id: schedule.id, dayNumber, startMinutes })
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleDragMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState || !scrollRef.current || !columnsRef.current) return
    const scrollRect = scrollRef.current.getBoundingClientRect()
    const columnWidth = getColumnWidth()
    const x = event.clientX - scrollRect.left + scrollRef.current.scrollLeft
    const y = event.clientY - scrollRect.top - (dayHeaderHeight + infoHeaderHeight) - dragState.offsetY
    const colIndex = Math.min(6, Math.max(0, Math.floor(x / columnWidth)))
    const dayNumber = weekMeta[colIndex]?.dayNumber ?? dragState.originDay
    const minuteOffset = Math.max(0, Math.min((endHour - startHour) * 60 - dragState.duration, Math.round((y / hourHeight) * 60)))
    const snapped = Math.round(minuteOffset / 30) * 30
    if (dayNumber !== dragState.originDay || snapped + startHour * 60 !== dragState.originStart) {
      dragMovedRef.current = true
    }
    setDragPreview({ id: dragState.id, dayNumber, startMinutes: snapped + startHour * 60 })
  }

  const endDrag = () => {
    if (!trip) return
    if (!dragState || !dragPreview) {
      setDragState(null)
      setDragPreview(null)
      return
    }

    if (!dragMovedRef.current) {
      setSelectedScheduleCard((prev) =>
        prev?.id === dragState.id && prev?.dayNumber === dragState.originDay
          ? null
          : { id: dragState.id, dayNumber: dragState.originDay }
      )
      setDragState(null)
      setDragPreview(null)
      return
    }

    const newStart = dragPreview.startMinutes
    const newEnd = newStart + dragState.duration
    updateSchedule(trip.id, dragState.originDay, dragState.id, {
      dayNumber: dragPreview.dayNumber,
      time: fromMinutes(newStart),
      endTime: fromMinutes(Math.min(newEnd, 24 * 60)),
    })
    setDragState(null)
    setDragPreview(null)
  }

  const startResize = (
    event: React.PointerEvent<HTMLButtonElement>,
    schedule: Schedule,
    dayNumber: number,
    startMinutes: number,
    endMinutes: number
  ) => {
    event.stopPropagation()
    setResizeState({
      id: schedule.id,
      originDay: dayNumber,
      startMinutes,
      endMinutes,
      offsetY: event.clientY,
    })
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleResizeMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!resizeState || !scrollRef.current) return
    const delta = event.clientY - resizeState.offsetY
    const minutesDelta = Math.round((delta / hourHeight) * 60 / 30) * 30
    const nextEnd = Math.max(resizeState.startMinutes + 30, Math.min(24 * 60, resizeState.endMinutes + minutesDelta))
    setDragPreview({
      id: resizeState.id,
      dayNumber: resizeState.originDay,
      startMinutes: resizeState.startMinutes,
    })
    setResizeState({ ...resizeState, endMinutes: nextEnd, offsetY: event.clientY })
  }

  const endResize = () => {
    if (!trip) return
    if (!resizeState) return
    updateSchedule(trip.id, resizeState.originDay, resizeState.id, {
      endTime: fromMinutes(resizeState.endMinutes),
    })
    setResizeState(null)
    setDragPreview(null)
  }

  const todayKey = new Date().toDateString()

  useEffect(() => {
    const node = scrollRef.current
    if (!node) return undefined
    const updateFade = () => {
      const maxScroll = node.scrollWidth - node.clientWidth
      setShowRightFade(maxScroll > 8 && node.scrollLeft < maxScroll - 8)
      if (timeLabelRef.current) {
        timeLabelRef.current.scrollTop = node.scrollTop
      }
    }
    updateFade()
    node.addEventListener("scroll", updateFade, { passive: true })
    window.addEventListener("resize", updateFade)
    return () => {
      node.removeEventListener("scroll", updateFade)
      window.removeEventListener("resize", updateFade)
    }
  }, [weekMeta])

  useEffect(() => {
    if (selectedDayInfoNumber === null) return undefined
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (target.closest("[data-dayinfo-toggle]") || target.closest("[data-dayinfo-popup]")) return
      setSelectedDayInfoNumber(null)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [selectedDayInfoNumber])

  useEffect(() => {
    if (!selectedScheduleCard) return undefined
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (target.closest("[data-schedule-popup]") || target.closest("[data-schedule-card-id]")) return
      setSelectedScheduleCard(null)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [selectedScheduleCard])

  const handleScrollRight = () => {
    if (!scrollRef.current) return
    const columnWidth = getColumnWidth()
    scrollRef.current.scrollBy({ left: columnWidth, behavior: "smooth" })
  }

  if (!trip && effectiveShareId) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            {shareEnabled ? "공유된 여행 불러오는 중..." : "공유가 꺼져 있습니다"}
          </h2>
          <p className="text-sm text-slate-500">
            {shareEnabled ? "잠시만 기다려 주세요" : "공유를 켜면 내용을 확인할 수 있어요"}
          </p>
          {sharePasswordReady && (
            <ShareSync
              shareId={effectiveShareId}
              tripId={id}
              onStatusChange={setShareEnabledState}
              onSync={handleSync}
              onError={setSyncError}
              onLogsChange={setShareLogs}
              onAuthRequired={(required) => {
                if (!required) {
                  setSharePasswordOpen(false)
                  setPasswordError(null)
                  return
                }
                setSharePasswordOpen(true)
                setPasswordError(sharePasswordHash ? "비밀번호가 올바르지 않습니다" : "비밀번호가 필요합니다")
              }}
              localPasswordHash={sharePasswordHash}
              actorName={shareName || "익명"}
              clientId={clientId}
              actorRole={isAdmin ? "admin" : "member"}
              onMembersChange={(members, ownerId) => {
                setShareMembers(members)
                setShareOwnerId(ownerId ?? null)
              }}
              onAccessDenied={(denied) => setAccessDenied(denied)}
              onShareDisabled={handleShareDisabled}
            />
          )}
        </div>

        {shareNameOpen && (
          <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/40" />
            <DraggablePanel className="max-w-sm rounded-2xl bg-white p-6 shadow-lg">
              <div className="text-lg font-bold text-slate-900">이름 입력</div>
              <p className="mt-2 text-sm text-slate-500">공유 로그에 표시될 이름을 입력해 주세요.</p>
              <input
                type="text"
                value={shareName}
                onChange={(event) => setShareName(event.target.value)}
                placeholder="이름"
                className="mt-4 w-full rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              />
              <button
                type="button"
                onClick={handleSubmitShareName}
                className="mt-5 w-full rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
              >
                저장
              </button>
            </DraggablePanel>
          </div>
        )}

        {sharePasswordOpen && (
          <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/40" />
            <DraggablePanel className="max-w-sm rounded-2xl bg-white p-6 shadow-lg">
              <div className="text-lg font-bold text-slate-900">비밀번호 입력</div>
              <p className="mt-2 text-sm text-slate-500">공유 링크에 설정된 비밀번호를 입력해 주세요.</p>
              <PasswordInput
                value={sharePassword}
                onChange={(event) => setSharePassword(event.target.value)}
                placeholder="비밀번호"
                className="mt-4 w-full rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              />
              {passwordError && <div className="mt-2 text-xs font-semibold text-red-500">{passwordError}</div>}
              <button
                type="button"
                onClick={handleSubmitPassword}
                className="mt-5 w-full rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
              >
                확인
              </button>
            </DraggablePanel>
          </div>
        )}
      </div>
    )
  }

  if (!trip) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-900 mb-2">여행을 찾을 수 없습니다</h2>
          <Link href="/" className="text-emerald-600 hover:underline">
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    )
  }

  const tripDuration = (() => {
    const start = toLocalDate(trip.startDate)
    const end = toLocalDate(trip.endDate)
    const diff = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    return diff + trip.preDays + trip.postDays
  })()

  return (
    <div data-app-shell className="min-h-screen bg-white" style={{ "--sidebar-width": "260px" } as Record<string, string>}>
      <div className="grid grid-cols-[var(--sidebar-width)_minmax(0,1fr)]">
        <aside className="sticky top-0 h-screen border-r border-slate-200 bg-white px-4 py-6">
          <Link href="/" className="mb-8 flex items-center gap-3 rounded-lg px-2 py-1 hover:bg-slate-50">
            <div className="w-9 h-9 bg-emerald-500 rounded-lg flex items-center justify-center">
              <Plane className="w-5 h-5 text-slate-900" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">여행 플래너</div>
              <div className="text-xs text-slate-400">Planner</div>
            </div>
          </Link>
          <nav className="space-y-4 text-sm">
            <div className="space-y-1">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-2">전체 홈</div>
              <Link
                href="/"
                className="block w-full text-left px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                전체 홈
              </Link>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-2">
                {trip.title}
              </div>
              <Link
                href={`/trip/${trip.id}${shareId ? `?share=${shareId}` : ""}`}
                className="block w-full text-left px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                여행 일정
              </Link>
              <Link
                href={`/trip/${trip.id}/timetable${shareId ? `?share=${shareId}` : ""}`}
                className="block w-full text-left px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 font-medium"
              >
                타임테이블
              </Link>
              <Link
                href={`/trip/${trip.id}/budget${shareId ? `?share=${shareId}` : ""}`}
                className="block w-full text-left px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                예산 관리
              </Link>
              <Link
                href={`/trip/${trip.id}/checklist${shareId ? `?share=${shareId}` : ""}`}
                className="block w-full text-left px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                체크리스트
              </Link>
            </div>
          </nav>
          {effectiveShareId && (
            <div className="mt-6 rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-emerald-700">공유 상태</span>
                <span className={shareEnabled ? "text-emerald-600" : "text-slate-400"}>
                  {shareEnabled ? "켜짐" : "꺼짐"}
                </span>
              </div>
              <div className="mt-2 text-[11px] text-slate-500">
                {lastSyncAt
                  ? `마지막 동기화 ${formatSyncTime(lastSyncAt)} (${lastSyncDirection === "push" ? "보냄" : "받음"})`
                  : "동기화 대기 중"}
              </div>
              <div className="mt-1 text-[11px] text-slate-400 break-all">
                ID: {effectiveShareId}
              </div>
              {syncError && <div className="mt-2 text-[11px] font-semibold text-red-500">{syncError}</div>}
              <button
                type="button"
                onClick={handleManualSync}
                className="mt-2 w-full rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-emerald-700"
              >
                지금 동기화
              </button>
              <button
                type="button"
                onClick={() => setShareSettingsOpen(true)}
                className="mt-2 w-full rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600"
              >
                공유 설정
              </button>
            </div>
          )}
          {effectiveShareId && (
            <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs">
              <div className="text-xs font-semibold text-slate-600 mb-2">접속자</div>
              <div className="space-y-2">
                {shareMembers.length === 0 ? (
                  <div className="text-[11px] text-slate-400">접속자 없음</div>
                ) : (
                  shareMembers.map((member) => (
                    <div key={member.id} className="flex items-center justify-between text-[11px] text-slate-600">
                      <span>
                        {member.name}
                        {member.role === "admin" ? " (admin)" : ""}
                      </span>
                      {isAdmin && member.id !== clientId && (
                        <button
                          type="button"
                          onClick={() => handleBanMember(member.id)}
                          className="rounded-full border border-red-200 px-2 py-0.5 text-[10px] font-semibold text-red-500"
                        >
                          차단
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
          {effectiveShareId && (
            <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs">
              <div className="text-xs font-semibold text-slate-600 mb-2">공유 로그</div>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {shareLogs.length === 0 ? (
                  <div className="text-[11px] text-slate-400">아직 기록이 없습니다</div>
                ) : (
                  shareLogs
                    .slice()
                    .sort((a, b) => (b.clientTs ?? 0) - (a.clientTs ?? 0))
                    .slice(0, 8)
                    .map((log) => (
                      <div key={log.id} className="text-[11px] text-slate-600">
                        <span className="font-semibold text-slate-800">{log.user}</span>{" "}
                        <span>{log.action}</span>
                      </div>
                    ))
                )}
              </div>
            </div>
          )}
          {effectiveShareId && (
            <button
              type="button"
              onClick={() => setChatOpen(true)}
              className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              채팅 열기
            </button>
          )}
        </aside>

        <TripRouteTransition className="flex flex-col">
          <header
            className="bg-white border-b border-slate-200 px-6 py-4"
            data-timetable-header
          >
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Time Table</h1>
              <p className="text-sm text-slate-500 mt-1">
                {trip.title} · {formatDateRange(trip.startDate, trip.endDate)}
              </p>
            </div>
          </header>

          <div className="flex-1 px-4 py-4 bg-white">
            <div className="relative">
              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
              <div ref={timetableFrameRef} className="relative flex">
                {showRightFade && (
                  <button
                    type="button"
                    className="absolute right-4 top-3 z-30 rounded-full border border-emerald-200 bg-white p-2 text-emerald-600 shadow-md transition hover:scale-105"
                    onClick={handleScrollRight}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </button>
                )}
                <div
                  ref={timeLabelRef}
                  className="timetable-scroll bg-white border-r border-slate-200 overflow-y-auto px-2"
                  style={{
                    width: `${timeLabelWidth}px`,
                    height: `${tableHeight}px`,
                    scrollbarWidth: "none",
                    msOverflowStyle: "none",
                  }}
                >
                  <div className="sticky top-0 z-20 bg-white" style={{ height: `${dayHeaderHeight + infoHeaderHeight}px` }} />
                  <div style={{ height: `${gridTopOffset}px` }} />
                  {Array.from({ length: endHour - startHour + 1 }, (_, index) => {
                    const hour = startHour + index
                    return (
                      <div
                        key={hour}
                        className="relative z-10 flex items-start justify-end text-xs font-semibold text-slate-600"
                        style={{ height: `${hourHeight}px` }}
                      >
                        {String(hour).padStart(2, "0")}:00
                      </div>
                    )
                  })}
                </div>

                <div
                  ref={scrollRef}
                  className="timetable-scroll relative flex-1 overflow-auto"
                  style={{ scrollbarWidth: "none", msOverflowStyle: "none", height: `${tableHeight}px` }}
                >
                  <style jsx>{`
                    .timetable-scroll::-webkit-scrollbar {
                      display: none;
                    }
                  `}</style>
                  <div ref={columnsRef} className="flex min-w-full">
                    {weekMeta.map((day, index) => {
                      const isToday = day.date.toDateString() === todayKey
                      const daySchedules = schedules
                        .filter((schedule) => schedule.tripId === trip.id)
                        .filter((schedule) => {
                          const range = getScheduleRange(schedule, trip)
                          return day.dayNumber >= range.startDay && day.dayNumber <= range.endDay
                        })
                        .sort((a, b) => toMinutes(a.time || "00:00") - toMinutes(b.time || "00:00"))

                      const dayInfo = dayInfos.find((info) => info.tripId === trip.id && info.dayNumber === day.dayNumber)
                      const cityText = formatCityText(dayInfo?.city)
                      const stayText = dayInfo?.accommodation?.trim() || "-"

                      const currentMinutes = (() => {
                        if (!isToday) return null
                        const now = new Date()
                        return now.getHours() * 60 + now.getMinutes()
                      })()

                      return (
                        <div
                          key={day.dayNumber}
                          data-day-column
                          className="flex-shrink-0 border-r border-slate-200 bg-white"
                          style={{ width: `calc((100vw - var(--sidebar-width) - ${timeLabelWidth}px - 64px) / 5)` }}
                        >
                          <div className="sticky top-0 z-20">
                            <div
                              className={`flex flex-col items-center justify-center text-center ${
                                isToday ? "bg-emerald-600 text-white" : "bg-emerald-500 text-white"
                              }`}
                              style={{ height: `${dayHeaderHeight}px` }}
                            >
                              <div className="text-xs font-semibold text-emerald-100">
                                {day.date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}
                              </div>
                              <div className="text-sm font-bold">
                                {String(day.date.getMonth() + 1).padStart(2, "0")}.{String(day.date.getDate()).padStart(2, "0")}
                              </div>
                            </div>
                            <div
                              data-dayinfo-toggle
                              className="relative cursor-pointer border-b border-slate-200 flex flex-col items-center justify-center text-[11px] bg-white"
                              style={{ height: `${infoHeaderHeight}px` }}
                              onClick={() =>
                                setSelectedDayInfoNumber((prev) => (prev === day.dayNumber ? null : day.dayNumber))
                              }
                            >
                              <div className="flex items-center gap-1 text-slate-700">
                                <MapPin className="w-3 h-3 text-slate-500" />
                                <span className="truncate max-w-[96px] text-slate-900">{cityText}</span>
                              </div>
                              <div className="flex items-center gap-1 text-slate-700">
                                <Home className="w-3 h-3 text-slate-500" />
                                <span className="truncate max-w-[96px] text-slate-900">{stayText}</span>
                              </div>
                              {selectedDayInfoNumber === day.dayNumber && (
                                <div
                                  data-dayinfo-popup
                                  className="absolute left-1/2 top-full z-30 mt-1 w-[190px] -translate-x-1/2 rounded-lg border border-emerald-200 bg-emerald-100 px-3 py-2 text-[11px] text-slate-900 shadow-lg transition-all duration-200"
                                >
                                  <div className="flex items-center gap-2">
                                    <MapPin className="h-3 w-3 text-emerald-700" />
                                    <span className="truncate">{cityText}</span>
                                  </div>
                                  <div className="mt-2 flex items-center gap-2 text-emerald-700">
                                    <Home className="h-3 w-3 text-emerald-700" />
                                    <span className="truncate">{stayText}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                          <div
                            className="relative"
                            style={{ height: `${(endHour - startHour + 1) * hourHeight + gridTopOffset}px` }}
                          >
                            {Array.from({ length: endHour - startHour + 1 }, (_, lineIndex) => (
                              <div
                                key={`line-${lineIndex}`}
                                className="absolute left-0 right-0 border-t border-slate-100"
                                style={{ top: `${gridTopOffset + lineIndex * hourHeight}px` }}
                              />
                            ))}

                            {currentMinutes !== null && currentMinutes >= startHour * 60 && currentMinutes <= endHour * 60 && (
                              <div
                                className="absolute left-0 right-0 flex items-center"
                                style={{
                                  top: `${gridTopOffset + ((currentMinutes - startHour * 60) / 60) * hourHeight}px`,
                                }}
                              >
                                <div className="h-2 w-2 rounded-full bg-red-500 ml-2" />
                                <div className="h-[2px] flex-1 bg-red-500" />
                              </div>
                            )}

                            {daySchedules.map((schedule) => {
                              const { startMinutes, endMinutes } = getScheduleTimesForDay(schedule, day.dayNumber, trip)
                              const start = (dragPreview?.id === schedule.id ? dragPreview.startMinutes : startMinutes)
                              const duration = resizeState?.id === schedule.id ? resizeState.endMinutes - startMinutes : endMinutes - startMinutes
                              const topOffset = gridTopOffset + ((start - startHour * 60) / 60) * hourHeight
                              const height = Math.max(32, (duration / 60) * hourHeight - 2)
                              const timeRange = schedule.endTime
                                ? `${schedule.time} - ${schedule.endTime.split(" ")[0]}`
                                : schedule.time
                              const isSelected =
                                selectedScheduleCard?.id === schedule.id && selectedScheduleCard?.dayNumber === day.dayNumber
                              const transportRoute =
                                schedule.category === "transport" && schedule.arrivalPlace?.trim()
                                  ? `${(schedule.location ?? "").trim()} > ${schedule.arrivalPlace.trim()}`
                                  : ""
                              const isUltraCompactCard = height < 44
                              const isCompactCard = height < 58
                              const canShowTransportRouteOnSecondLine = Boolean(transportRoute) && height >= 68
                              const canShowTransportRouteInline = Boolean(transportRoute) && !isCompactCard
                              const compactBottomPaddingPx = isCompactCard
                                ? Math.max(5, Math.min(10, Math.round((height - 32) * 0.2) + 6))
                                : 4
                              const compactTopPaddingPx = isCompactCard ? Math.max(2, Math.round(compactBottomPaddingPx * 0.45)) : 4
                              const cardInnerStyle = isCompactCard
                                ? {
                                    paddingTop: `${compactTopPaddingPx}px`,
                                    paddingBottom: `${compactBottomPaddingPx}px`,
                                  }
                                : undefined
                              const titleFontSize = isUltraCompactCard ? 12 : 13
                              const timeFontSize = isUltraCompactCard ? 10 : 11
                              const categoryFontSize = isUltraCompactCard ? 9 : 10
                              const routeFontSize = isUltraCompactCard ? 10 : 11

                              return (
                                <div key={schedule.id}>
                                  <div
                                    data-schedule-card-id={schedule.id}
                                    data-schedule-card-day={day.dayNumber}
                                    className={`absolute left-2 right-2 rounded-lg border bg-white text-[11px] leading-tight transition-transform hover:scale-[1.02] hover:shadow-lg ${
                                      isSelected ? "border-emerald-500 shadow-md" : "border-emerald-400 text-slate-900"
                                    }`}
                                    style={{ top: `${topOffset}px`, height: `${height}px` }}
                                    onClick={() =>
                                      setSelectedScheduleCard((prev) =>
                                        prev?.id === schedule.id && prev?.dayNumber === day.dayNumber
                                          ? null
                                          : { id: schedule.id, dayNumber: day.dayNumber }
                                      )
                                    }
                                  >
                                    <div
                                      className={`flex h-full flex-col overflow-hidden px-2 ${
                                        isCompactCard ? "justify-between" : "gap-1 py-1"
                                      }`}
                                      style={cardInnerStyle}
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <span
                                          className="min-w-0 truncate font-semibold leading-none text-emerald-700"
                                          style={{ fontSize: `${timeFontSize}px` }}
                                        >
                                          {timeRange}
                                        </span>
                                        <span
                                          className="ml-auto inline-flex shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 leading-none text-emerald-700"
                                          style={{ fontSize: `${categoryFontSize}px` }}
                                        >
                                          {categoryLabels[schedule.category] ?? schedule.category}
                                        </span>
                                      </div>
                                      {transportRoute ? (
                                        canShowTransportRouteOnSecondLine ? (
                                          <div className="min-w-0">
                                            <div
                                              className="truncate font-semibold leading-[1.1] text-slate-900"
                                              style={{ fontSize: `${titleFontSize}px` }}
                                            >
                                              {schedule.title}
                                            </div>
                                            <div
                                              className="mt-0.5 truncate font-medium leading-none text-slate-400"
                                              style={{ fontSize: `${routeFontSize}px` }}
                                            >
                                              {transportRoute}
                                            </div>
                                          </div>
                                        ) : canShowTransportRouteInline ? (
                                          <div className="truncate leading-[1.1]" style={{ fontSize: `${titleFontSize}px` }}>
                                            <span className="font-semibold text-slate-900">{schedule.title}</span>
                                            <span className="ml-2 font-medium text-slate-400">{transportRoute}</span>
                                          </div>
                                        ) : (
                                          <div
                                            className="truncate font-semibold leading-[1.1] text-slate-900"
                                            style={{ fontSize: `${titleFontSize}px` }}
                                          >
                                            {schedule.title}
                                          </div>
                                        )
                                      ) : (
                                        <div
                                          className="truncate font-semibold leading-[1.1] text-slate-900"
                                          style={{ fontSize: `${titleFontSize}px` }}
                                        >
                                          {schedule.title}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                </div>
                              )
                            })}

                            
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
                {selectedSchedule && selectedSchedulePopupLayout && (
                  <div
                    data-schedule-popup
                    className={`absolute z-30 rounded-[20px] border border-slate-200/90 bg-white/98 px-[18px] py-4 text-sm text-slate-700 shadow-[0_20px_48px_rgba(15,23,42,0.16)] backdrop-blur-[2px] transition-[opacity,transform] ${
                      isSchedulePopupVisible ? "opacity-100 translate-y-0 scale-100" : "pointer-events-none opacity-0 translate-y-2 scale-[0.985]"
                    }`}
                    style={{
                      left: `${selectedSchedulePopupLayout.left}px`,
                      top: `${selectedSchedulePopupLayout.top}px`,
                      width: `${selectedSchedulePopupLayout.width}px`,
                      transitionDuration: `${TIMETABLE_POPUP_TRANSITION_MS}ms`,
                    }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-[19px] font-semibold tracking-[-0.02em] text-slate-900">
                          {selectedSchedule.title}
                        </div>
                        <div className="mt-2 whitespace-nowrap text-[16px] font-semibold tracking-[-0.02em] text-slate-900">
                          {selectedScheduleTimeRange}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                          {categoryLabels[selectedSchedule.category] ?? selectedSchedule.category}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 space-y-3">
                      <div>
                        <div className="mb-1.5 text-[9px] font-semibold tracking-[0.08em] text-slate-900">
                          {selectedScheduleDetailLabel}
                        </div>
                        <div className="flex min-h-[42px] items-center rounded-lg bg-slate-100 px-3 py-2">
                          <div className="text-[13px] font-medium leading-5 text-slate-900">
                            {selectedScheduleLocationSummary}
                          </div>
                        </div>
                      </div>
                      <div>
                        <div className="mb-1.5 text-[9px] font-semibold tracking-[0.08em] text-slate-900">메모</div>
                        <div className="min-h-[42px] rounded-lg bg-slate-100 px-3 py-2">
                          <div className="text-[13px] leading-5 text-slate-900">
                            {(selectedSchedule.memo ?? "").trim() || "메모 없음"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          </div>
        </TripRouteTransition>
      </div>

      <ScheduleModal
        isOpen={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        onSubmit={handleScheduleSubmit}
        mode="add"
        tripDuration={tripDuration}
        currentDayNumber={selectedDayNumber}
        currentDayLabel={trip ? formatTripDayLabel(selectedDayNumber, trip) : "Day 1"}
        tripDayOptions={tripDayLabels}
        initialData={initialSchedule}
      />

      {effectiveShareId && sharePasswordReady && (
        <ShareSync
          shareId={effectiveShareId}
          tripId={trip.id}
          onStatusChange={setShareEnabledState}
          onSync={handleSync}
          onError={setSyncError}
          onLogsChange={setShareLogs}
          onAuthRequired={(required) => {
            if (!required) {
              setSharePasswordOpen(false)
              setPasswordError(null)
              return
            }
            setSharePasswordOpen(true)
            setPasswordError(sharePasswordHash ? "비밀번호가 올바르지 않습니다" : "비밀번호가 필요합니다")
          }}
          localPasswordHash={sharePasswordHash}
          actorName={shareName || "익명"}
          clientId={clientId}
          actorRole={isAdmin ? "admin" : "member"}
          onMembersChange={(members, ownerId) => {
            setShareMembers(members)
            setShareOwnerId(ownerId ?? null)
          }}
          onAccessDenied={(denied) => setAccessDenied(denied)}
          onShareDisabled={handleShareDisabled}
        />
      )}

        <ShareChatModal
          isOpen={chatOpen}
          shareId={effectiveShareId}
          clientId={clientId}
          userName={shareName || (isAdmin ? "admin" : "익명")}
          onClose={() => setChatOpen(false)}
        />

        {shareSettingsOpen && effectiveShareId && (
          <div className="fixed inset-0 z-50 bg-black/40 px-4">
            <DraggablePanel className="max-w-md rounded-2xl bg-white p-5 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="text-lg font-bold text-slate-900">공유 설정</div>
                <button
                  type="button"
                  onClick={() => setShareSettingsOpen(false)}
                  className="text-xs font-semibold text-slate-400 hover:text-slate-600"
                >
                  닫기
                </button>
              </div>
              <div className="mt-4">
                <div className="text-xs font-semibold text-slate-600">공유 링크</div>
                <div className="mt-2 rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-600 break-all">
                  {`${getShareBaseUrl()}/trip/${id}?share=${effectiveShareId}`}
                </div>
                <button
                  type="button"
                  onClick={handleCopyShareLink}
                  className="mt-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600"
                >
                  {shareLinkCopied ? "복사되었습니다" : "링크 복사"}
                </button>
              </div>
              <div className="mt-4">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                  <input
                    type="checkbox"
                    className="accent-emerald-500"
                    checked={sharePasswordEnabled}
                    onChange={(event) => setSharePasswordEnabled(event.target.checked)}
                    disabled={!isAdmin}
                  />
                  비밀번호 사용
                </label>
                {sharePasswordEnabled && (
                  <PasswordInput
                    value={sharePasswordNext}
                    onChange={(event) => setSharePasswordNext(event.target.value)}
                    placeholder="새 비밀번호 입력"
                    className="mt-2 w-full rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                    disabled={!isAdmin}
                  />
                )}
                {shareSettingsError && (
                  <div className="mt-2 text-xs font-semibold text-red-500">{shareSettingsError}</div>
                )}
              </div>
              <div className="mt-4">
                <div className="text-xs font-semibold text-slate-600">공유 상태</div>
                <button
                  type="button"
                  onClick={handleToggleShareEnabled}
                  disabled={!isAdmin}
                  className={`mt-2 rounded-full px-3 py-1 text-xs font-semibold ${
                    shareEnabled
                      ? "bg-emerald-500 text-white"
                      : "border border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  {shareEnabled ? "공유 끄기" : "공유 켜기"}
                </button>
              </div>
              <div className="mt-5 flex items-center justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setShareSettingsOpen(false)}>
                  닫기
                </Button>
                <Button size="sm" onClick={handleSaveShareSettings} disabled={!isAdmin}>
                  저장
                </Button>
              </div>
              {!isAdmin && (
                <div className="mt-2 text-[11px] text-slate-400">
                  관리자는 공유 링크와 비밀번호를 수정할 수 있어요.
                </div>
              )}
            </DraggablePanel>
          </div>
        )}

      {accessDenied && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" />
          <DraggablePanel className="max-w-sm rounded-2xl bg-white p-6 shadow-lg">
            <div className="text-lg font-bold text-slate-900">접속이 차단되었습니다</div>
            <p className="mt-2 text-sm text-slate-500">호스트가 접근을 차단했습니다.</p>
          </DraggablePanel>
        </div>
      )}

      {shareNameOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" />
          <DraggablePanel className="max-w-sm rounded-2xl bg-white p-6 shadow-lg">
            <div className="text-lg font-bold text-slate-900">이름 입력</div>
            <p className="mt-2 text-sm text-slate-500">공유 로그에 표시될 이름을 입력해 주세요.</p>
            <input
              type="text"
              value={shareName}
              onChange={(event) => setShareName(event.target.value)}
              placeholder="이름"
              className="mt-4 w-full rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            />
            <button
              type="button"
              onClick={handleSubmitShareName}
              className="mt-5 w-full rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
            >
              저장
            </button>
          </DraggablePanel>
        </div>
      )}

      {sharePasswordOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" />
          <DraggablePanel className="max-w-sm rounded-2xl bg-white p-6 shadow-lg">
            <div className="text-lg font-bold text-slate-900">비밀번호 입력</div>
            <p className="mt-2 text-sm text-slate-500">공유 링크에 설정된 비밀번호를 입력해 주세요.</p>
            <PasswordInput
              value={sharePassword}
              onChange={(event) => setSharePassword(event.target.value)}
              placeholder="비밀번호"
              className="mt-4 w-full rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            />
            {passwordError && <div className="mt-2 text-xs font-semibold text-red-500">{passwordError}</div>}
            <button
              type="button"
              onClick={handleSubmitPassword}
              className="mt-5 w-full rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
            >
              확인
            </button>
          </DraggablePanel>
        </div>
      )}
    </div>
  )
}

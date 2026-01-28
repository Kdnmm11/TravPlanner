"use client"

import { useEffect, useState } from "react"
import { Search, MoreHorizontal, Edit2, Trash2, Plane } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTravelStore } from "@/lib/store"
import { DayColumn } from "@/components/day-column"
import { ScheduleModal } from "@/components/schedule-modal"
import { ConfirmModal } from "@/components/confirm-modal"
import { TripModal } from "@/components/trip-modal"
import { DayInfoModal } from "@/components/day-info-modal"
import { ShareSync } from "@/components/share-sync"
import { ShareChatModal } from "@/components/share-chat-modal"
import { banShareMember, hashPassword } from "@/lib/share"
import type { ShareLog, ShareMember } from "@/lib/share"
import { updateShare } from "@/lib/share"
import Link from "next/link"
import { useRouter, useParams, useSearchParams } from "next/navigation"
import type { Schedule, ScheduleFormData, TripFormData } from "@/lib/types"

export default function TripDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const shareId = searchParams.get("share")
  const {
    trips,
    dayInfos,
    addSchedule,
    updateSchedule,
    deleteSchedule,
    updateTrip,
    deleteTrip,
    getTripDays,
    updateDayInfo,
    exportTripData,
    activeShares,
  } = useTravelStore()
  
  const trip = trips.find((t) => t.id === id)
  
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false)
  const [scheduleModalMode, setScheduleModalMode] = useState<"add" | "edit">("add")
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null)
  const [selectedDayNumber, setSelectedDayNumber] = useState<number | null>(null)
  const [dayInfoModalOpen, setDayInfoModalOpen] = useState(false)
  const [cardWidthOffset] = useState(7)
  const [cardHeightOffset] = useState(3)
  const [cardGap] = useState(5)
  const [textScale] = useState(1)
  const [categoryScale] = useState(1.05)
  const [dayInfoDayNumber, setDayInfoDayNumber] = useState<number | null>(null)
  
  const [deleteScheduleModalOpen, setDeleteScheduleModalOpen] = useState(false)
  const [scheduleToDelete, setScheduleToDelete] = useState<{ dayNumber: number; scheduleId: string } | null>(null)
  
  const [tripMenuOpen, setTripMenuOpen] = useState(false)
  const [tripModalOpen, setTripModalOpen] = useState(false)
  const [deleteTripModalOpen, setDeleteTripModalOpen] = useState(false)
  const activeShare = activeShares[id]
  const effectiveShareId = shareId ?? activeShare?.shareId ?? null
  const [shareEnabled, setShareEnabled] = useState(activeShare?.enabled ?? true)
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
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const isAdmin = Boolean(clientId && shareOwnerId && clientId === shareOwnerId)

  useEffect(() => {
    if (!activeShare) return
    setShareEnabled(activeShare.enabled)
  }, [activeShare?.enabled])

  useEffect(() => {
    if (!effectiveShareId || !clientId) return
    const nameKey = `trav-share-name:${effectiveShareId}`
    const passKey = `trav-share-pass:${effectiveShareId}`
    const ownerKey = `trav-share-owner:${effectiveShareId}`
    const storedName = localStorage.getItem(nameKey)
    const storedPass = localStorage.getItem(passKey)
    const storedOwner = localStorage.getItem(ownerKey)
    const isOwnerByKey = Boolean(storedOwner && storedOwner === clientId)
    const isOwnerByDoc = Boolean(shareOwnerId && shareOwnerId === clientId)
    if (isOwnerByDoc) {
      localStorage.setItem(ownerKey, clientId)
    }
    if (isOwnerByKey || isOwnerByDoc) {
      setShareName("admin")
      setShareNameOpen(false)
    } else if (storedName) {
      setShareName(storedName)
      setShareNameOpen(false)
    } else {
      setShareNameOpen(true)
    }
    if (storedPass) {
      setSharePasswordHash(storedPass)
    }
  }, [effectiveShareId, clientId, shareOwnerId])

  useEffect(() => {
    const existing = localStorage.getItem("trav-client-id")
    if (existing) {
      setClientId(existing)
      return
    }
    const next = Math.random().toString(36).slice(2, 10)
    localStorage.setItem("trav-client-id", next)
    setClientId(next)
  }, [])

  useEffect(() => {
    if (!accessDenied) return
    if (isAdmin) return
    deleteTrip(id)
    router.replace("/")
  }, [accessDenied, isAdmin, deleteTrip, id, router])

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
    localStorage.setItem(`trav-share-name:${effectiveShareId}`, shareName.trim())
    setShareNameOpen(false)
  }

  const handleSubmitPassword = async () => {
    if (!effectiveShareId || !sharePassword.trim()) return
    const hash = await hashPassword(sharePassword.trim())
    setSharePasswordHash(hash)
    localStorage.setItem(`trav-share-pass:${effectiveShareId}`, hash)
    setPasswordError(null)
    setSharePasswordOpen(false)
  }

  const handleBanMember = async (memberId: string) => {
    if (!effectiveShareId) return
    await banShareMember(effectiveShareId, memberId)
  }

  const handleShareDisabled = (disabled: boolean, ownerId?: string | null) => {
    if (!disabled) return
    if (clientId && ownerId && clientId === ownerId) return
    deleteTrip(id)
    router.replace("/")
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
          <ShareSync
            shareId={effectiveShareId}
            tripId={id}
            onStatusChange={setShareEnabled}
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
          />
        </div>

        {shareNameOpen && (
          <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/40" />
            <div className="fixed left-1/2 top-1/2 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-lg">
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
            </div>
          </div>
        )}

        {sharePasswordOpen && (
          <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/40" />
            <div className="fixed left-1/2 top-1/2 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-lg">
              <div className="text-lg font-bold text-slate-900">비밀번호 입력</div>
              <p className="mt-2 text-sm text-slate-500">공유 링크에 설정된 비밀번호를 입력해 주세요.</p>
              <input
                type="password"
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
            </div>
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

  const handleAddSchedule = (dayNumber: number) => {
    setScheduleModalMode("add")
    setEditingSchedule(null)
    setSelectedDayNumber(dayNumber)
    setScheduleModalOpen(true)
  }

  const handleEditSchedule = (dayNumber: number, schedule: Schedule) => {
    setScheduleModalMode("edit")
    setEditingSchedule(schedule)
    setSelectedDayNumber(dayNumber)
    setScheduleModalOpen(true)
  }

  const handleDeleteSchedule = (dayNumber: number, scheduleId: string) => {
    setScheduleToDelete({ dayNumber, scheduleId })
    setDeleteScheduleModalOpen(true)
  }

  const handleEditDayInfo = (dayNumber: number) => {
    setDayInfoDayNumber(dayNumber)
    setDayInfoModalOpen(true)
  }



  const handleScheduleSubmit = (data: ScheduleFormData) => {
    if (selectedDayNumber === null) return
    
    if (scheduleModalMode === "add") {
      addSchedule(trip.id, selectedDayNumber, data)
    } else if (editingSchedule) {
      updateSchedule(trip.id, selectedDayNumber, editingSchedule.id, data)
    }
  }

  const getTripDuration = () => {
    const start = new Date(trip.startDate)
    const end = new Date(trip.endDate)
    const diffTime = end.getTime() - start.getTime()
    const baseDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1
    return baseDays + trip.preDays + trip.postDays
  }

  const handleTripUpdate = (data: TripFormData) => {
    updateTrip(trip.id, data)
  }

  const handleTripDelete = () => {
    deleteTrip(trip.id)
    router.push("/")
  }

  const formatDateRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    return `${start.getFullYear()}년 ${start.getMonth() + 1}월 ${start.getDate()}일 - ${end.getMonth() + 1}월 ${end.getDate()}일`
  }

  return (
    <div
      data-app-shell
      className="min-h-screen bg-slate-100"
      style={{ "--sidebar-width": "260px" } as Record<string, string>}
    >
      <div className="grid grid-cols-[var(--sidebar-width)_minmax(0,1fr)]">
        <aside className="sticky top-0 h-screen border-r border-slate-200 bg-white px-4 py-6">
          <div className="flex items-center gap-3 px-2 mb-8">
            <div className="w-9 h-9 bg-emerald-500 rounded-lg flex items-center justify-center">
              <Plane className="w-5 h-5 text-slate-900" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">여행 플래너</div>
              <div className="text-xs text-slate-400">Planner</div>
            </div>
          </div>
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
                className="block w-full text-left px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 font-medium"
              >
                여행 일정
              </Link>
              <Link
                href={`/trip/${trip.id}/timetable${shareId ? `?share=${shareId}` : ""}`}
                className="block w-full text-left px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-50"
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

        {/* Main Content */}
        <main className="flex flex-col min-h-screen">
          {/* Header */}
          <header className="bg-white border-b border-slate-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{trip.title}</h1>
                <p className="text-sm text-slate-500 mt-1">{formatDateRange(trip.startDate, trip.endDate)}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="일정 검색..."
                    className="pl-9 pr-4 py-2 bg-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 w-64"
                  />
                </div>
                <div className="relative">
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => setTripMenuOpen(!tripMenuOpen)}
                    className="bg-transparent"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                  
                  {tripMenuOpen && (
                    <div className="absolute top-12 right-0 bg-white rounded-lg shadow-lg border border-slate-200 py-1 min-w-[120px] z-10">
                      <button
                        onClick={() => {
                          setTripMenuOpen(false)
                          setTripModalOpen(true)
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                      >
                        <Edit2 className="w-4 h-4" />
                        여행 수정
                      </button>
                      <button
                        onClick={() => {
                          setTripMenuOpen(false)
                          setDeleteTripModalOpen(true)
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        여행 삭제
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </header>

          {/* Day Columns */}
          <div className="flex-1 overflow-x-auto py-6 pl-4">
            <div className="flex gap-4 h-full">
              {getTripDays(trip.id).length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-slate-500 mb-2">아직 일정이 없습니다</p>
                    <p className="text-sm text-slate-400">여행 날짜를 설정하면 일정이 자동으로 생성됩니다</p>
                  </div>
                </div>
              ) : (
                getTripDays(trip.id).map((day) => (
                  <DayColumn
                    key={day.dayNumber}
                    dayNumber={day.dayNumber}
                    date={day.date}
                    weekday={day.weekday}
                    schedules={day.schedules}
                    city={dayInfos.find((info) => info.tripId === trip.id && info.dayNumber === day.dayNumber)?.city}
                    accommodation={
                      dayInfos.find((info) => info.tripId === trip.id && info.dayNumber === day.dayNumber)?.accommodation
                    }
                    cardWidthOffset={cardWidthOffset}
                    cardHeightOffset={cardHeightOffset}
                    cardGap={cardGap}
                    textScale={textScale}
                    categoryScale={categoryScale}
                    onEditDayInfo={() => handleEditDayInfo(day.dayNumber)}
                    onAddSchedule={() => handleAddSchedule(day.dayNumber)}
                    onEditSchedule={(schedule) => handleEditSchedule(day.dayNumber, schedule)}
                    onDeleteSchedule={(scheduleId) => handleDeleteSchedule(day.dayNumber, scheduleId)}
                  />
                ))
              )}
            </div>
          </div>
        </main>
      </div>

        {/* Modals */}
        <ScheduleModal
          isOpen={scheduleModalOpen}
          onClose={() => setScheduleModalOpen(false)}
          onSubmit={handleScheduleSubmit}
          onDelete={() => {
            if (editingSchedule && selectedDayNumber !== null) {
              setScheduleModalOpen(false)
              handleDeleteSchedule(selectedDayNumber, editingSchedule.id)
            }
          }}
          mode={scheduleModalMode}
          tripDuration={getTripDuration()}
          currentDayNumber={selectedDayNumber ?? 1}
          initialData={
            editingSchedule
              ? {
                  time: editingSchedule.time,
                  endTime: editingSchedule.endTime,
                  title: editingSchedule.title,
                  location: editingSchedule.location,
                  category: editingSchedule.category,
                  memo: editingSchedule.memo,
                  subCategory: editingSchedule.subCategory,
                  arrivalPlace: editingSchedule.arrivalPlace,
                  reservationNum: editingSchedule.reservationNum,
                  bookingSource: editingSchedule.bookingSource,
                }
              : null
          }
        />

        <DayInfoModal
          isOpen={dayInfoModalOpen}
          onClose={() => setDayInfoModalOpen(false)}
          dayNumber={dayInfoDayNumber ?? 1}
          tripDuration={getTripDuration()}
          initialCity={
            dayInfoDayNumber
              ? dayInfos.find((info) => info.tripId === trip.id && info.dayNumber === dayInfoDayNumber)?.city
              : ""
          }
          initialAccommodation={
            dayInfoDayNumber
              ? dayInfos.find((info) => info.tripId === trip.id && info.dayNumber === dayInfoDayNumber)?.accommodation
              : ""
          }
          initialCheckInDay={
            dayInfoDayNumber
              ? dayInfos.find((info) => info.tripId === trip.id && info.dayNumber === dayInfoDayNumber)?.checkInDay
              : ""
          }
          initialCheckInTime={
            dayInfoDayNumber
              ? dayInfos.find((info) => info.tripId === trip.id && info.dayNumber === dayInfoDayNumber)?.checkInTime
              : ""
          }
          initialCheckOutDay={
            dayInfoDayNumber
              ? dayInfos.find((info) => info.tripId === trip.id && info.dayNumber === dayInfoDayNumber)?.checkOutDay
              : ""
          }
          initialCheckOutTime={
            dayInfoDayNumber
              ? dayInfos.find((info) => info.tripId === trip.id && info.dayNumber === dayInfoDayNumber)?.checkOutTime
              : ""
          }
          onSave={({ city, accommodation, checkInDay, checkInTime, checkOutDay, checkOutTime }) => {
            if (dayInfoDayNumber === null) return
            updateDayInfo(trip.id, dayInfoDayNumber, {
              city,
              accommodation,
              checkInDay,
              checkInTime,
              checkOutDay,
              checkOutTime,
            })
          }}
        />

        <ConfirmModal
          isOpen={deleteScheduleModalOpen}
          onClose={() => setDeleteScheduleModalOpen(false)}
          onConfirm={() => {
            if (scheduleToDelete) {
              deleteSchedule(trip.id, scheduleToDelete.dayNumber, scheduleToDelete.scheduleId)
            }
          }}
          title="일정 삭제"
          message="이 일정을 삭제하시겠습니까?"
        />

        <TripModal
          isOpen={tripModalOpen}
          onClose={() => setTripModalOpen(false)}
          onSubmit={handleTripUpdate}
          mode="edit"
          initialData={trip}
        />

        <ConfirmModal
          isOpen={deleteTripModalOpen}
          onClose={() => setDeleteTripModalOpen(false)}
          onConfirm={handleTripDelete}
          title="여행 삭제"
          message="이 여행을 삭제하시겠습니까? 모든 일정이 함께 삭제됩니다."
        />

        {effectiveShareId && (
          <ShareSync
            shareId={effectiveShareId}
            tripId={trip.id}
            onStatusChange={setShareEnabled}
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
          userName={shareName || (isAdmin ? "admin" : "익명")}
          onClose={() => setChatOpen(false)}
        />

        {accessDenied && (
          <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/60" />
            <div className="fixed left-1/2 top-1/2 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-lg">
              <div className="text-lg font-bold text-slate-900">접속이 차단되었습니다</div>
              <p className="mt-2 text-sm text-slate-500">호스트가 접근을 차단했습니다.</p>
            </div>
          </div>
        )}

        {shareNameOpen && (
          <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/40" />
            <div className="fixed left-1/2 top-1/2 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-lg">
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
            </div>
          </div>
        )}

        {sharePasswordOpen && (
          <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/40" />
            <div className="fixed left-1/2 top-1/2 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-lg">
              <div className="text-lg font-bold text-slate-900">비밀번호 입력</div>
              <p className="mt-2 text-sm text-slate-500">공유 링크에 설정된 비밀번호를 입력해 주세요.</p>
              <input
                type="password"
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
            </div>
          </div>
        )}
      </div>
  )
}

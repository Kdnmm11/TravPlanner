"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import { Plane, Search, Plus } from "lucide-react"
import { useTravelStore } from "@/lib/store"
import { BudgetAddModal } from "@/components/budget-add-modal"
import { ShareSync } from "@/components/share-sync"
import { ShareChatModal } from "@/components/share-chat-modal"
import { banShareMember, hashPassword, updateShare } from "@/lib/share"
import type { ShareLog, ShareMember } from "@/lib/share"
import type { Schedule } from "@/lib/types"

const currencyCatalog = [
  { code: "USD", label: "미국", unit: 1 },
  { code: "JPY", label: "일본", unit: 100 },
  { code: "EUR", label: "유럽연합", unit: 1 },
  { code: "CNY", label: "중국", unit: 1 },
  { code: "GBP", label: "영국", unit: 1 },
  { code: "CHF", label: "스위스", unit: 1 },
  { code: "CAD", label: "캐나다", unit: 1 },
  { code: "AUD", label: "호주", unit: 1 },
  { code: "HKD", label: "홍콩", unit: 1 },
  { code: "TWD", label: "대만", unit: 1 },
  { code: "THB", label: "태국", unit: 1 },
  { code: "VND", label: "베트남", unit: 100 },
  { code: "PHP", label: "필리핀", unit: 1 },
] as const

const currencyList = ["KRW", ...currencyCatalog.map((currency) => currency.code)]
const currencyLabelMap = {
  KRW: "한국",
  ...Object.fromEntries(currencyCatalog.map((currency) => [currency.code, currency.label])),
} as Record<string, string>
const currencyUnitMap = {
  KRW: 1,
  ...Object.fromEntries(currencyCatalog.map((currency) => [currency.code, currency.unit])),
} as Record<string, number>

const categoryLabels: Record<string, string> = {
  food: "식사",
  activity: "관광",
  transport: "이동",
  accommodation: "숙소",
  other: "기타",
}

const categoryOrder = ["food", "activity", "transport", "accommodation", "other"]

const toLocalDate = (value: string) => {
  const [year, month, day] = value.split("-").map((part) => Number.parseInt(part, 10))
  return new Date(year || 0, Math.max(0, (month || 1) - 1), day || 1)
}

const formatCurrency = (value: number) => {
  return Number.isFinite(value)
    ? new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(Math.round(value))
    : "0"
}

const formatRateValue = (value: number) => {
  if (!Number.isFinite(value) || value === 0) return ""
  const floored = Math.floor(value / 10) * 10
  return floored.toFixed(0)
}

export default function TripBudgetPage() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const shareId = searchParams.get("share")
  const {
    trips,
    schedules,
    exchangeRates,
    setExchangeRate,
    updateSchedule,
    addBudgetItem,
    exportTripData,
    deleteTrip,
    activeShares,
  } = useTravelStore()
  const router = useRouter()

  const trip = trips.find((item) => item.id === id)
  const tripSchedules = schedules
    .filter((schedule) => schedule.tripId === id)
    .sort((a, b) => (a.dayNumber - b.dayNumber) || a.time.localeCompare(b.time))

  const rateMap = useMemo(() => {
    const map: Record<string, number> = {
      KRW: 1,
      USD: 1460,
      EUR: 1700,
      JPY: 9.3,
      CNY: 209,
      GBP: 1960,
      CHF: 1820,
      CAD: 1050,
      AUD: 980,
      HKD: 187,
      TWD: 46,
      THB: 46.5,
      VND: 0.056,
      PHP: 24.6,
    }
    exchangeRates.forEach((rate) => {
      map[rate.currency] = rate.rateToKRW
    })
    return map
  }, [exchangeRates])

  const [showRates, setShowRates] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>(categoryOrder[0])
  const [rateSearch, setRateSearch] = useState("")
  const [rateDrafts, setRateDrafts] = useState<Record<string, string>>({})
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null)
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
    if (!effectiveShareId) return
    const nameKey = `trav-share-name:${effectiveShareId}`
    const passKey = `trav-share-pass:${effectiveShareId}`
    const ownerKey = `trav-share-owner:${effectiveShareId}`
    const storedName = localStorage.getItem(nameKey)
    const storedPass = localStorage.getItem(passKey)
    const ownerId = localStorage.getItem(ownerKey)
    const localClient = localStorage.getItem("trav-client-id")
    if (ownerId && localClient && ownerId === localClient) {
      setShareName("admin")
      setShareNameOpen(false)
      return
    }
    if (!storedName) {
      setShareNameOpen(true)
    } else {
      setShareName(storedName)
    }
    if (storedPass) {
      setSharePasswordHash(storedPass)
    }
  }, [effectiveShareId])

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
    if (!clientId || !shareOwnerId) return
    if (clientId === shareOwnerId) {
      setShareName("admin")
      setShareNameOpen(false)
    }
  }, [clientId, shareOwnerId])

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

  const totalExpense = tripSchedules.reduce((sum, schedule) => {
    const rate = rateMap[schedule.currency] ?? 1
    return sum + schedule.amount * rate
  }, 0)

  const tripDuration = useMemo(() => {
    if (!trip) return 0
    const start = toLocalDate(trip.startDate)
    const end = toLocalDate(trip.endDate)
    const diff = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    return diff + trip.preDays + trip.postDays
  }, [trip])

  const filteredCurrencies = useMemo(() => {
    const query = rateSearch.trim().toLowerCase()
    if (!query) return currencyCatalog
    return currencyCatalog.filter(
      (currency) =>
        currency.code.toLowerCase().includes(query) ||
        currency.label.toLowerCase().includes(query)
    )
  }, [rateSearch])

  const formatDateRange = (startDate: string, endDate: string) => {
    const start = toLocalDate(startDate)
    const end = toLocalDate(endDate)
    return `${start.getFullYear()}년 ${start.getMonth() + 1}월 ${start.getDate()}일 - ${end.getMonth() + 1}월 ${end.getDate()}일`
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
            clientId={clientId}
            actorRole={isAdmin ? "admin" : "member"}
            onMembersChange={(members, ownerId) => {
              setShareMembers(members)
              setShareOwnerId(ownerId ?? null)
            }}
            onAccessDenied={(denied) => setAccessDenied(denied)}
            onShareDisabled={handleShareDisabled}
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

  return (
    <div data-app-shell className="min-h-screen bg-slate-100" style={{ "--sidebar-width": "260px" } as Record<string, string>}>
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
                className="block w-full text-left px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-50"
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
                className="block w-full text-left px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 font-medium"
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

        <main className="flex flex-col min-h-screen bg-white">
          <header className="px-8 pt-6 pb-4 border-b border-slate-200">
            <div className="flex items-center justify-between gap-6">
              <div>
                <h1 className="text-3xl font-bold text-slate-900">Budget</h1>
                <p className="text-sm text-slate-500 mt-1">{trip.title}</p>
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold text-slate-500">기간</div>
                <div className="text-sm font-semibold text-slate-800">{formatDateRange(trip.startDate, trip.endDate)}</div>
              </div>
            </div>
          </header>

          <div className="flex-1 px-8 pb-10 pt-6">
            <div className="max-w-5xl">
              <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
                <div className="space-y-4">
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-5 text-slate-900">
                    <div className="text-xs text-emerald-700/80">Total Expense</div>
                    <div className="mt-1 text-3xl font-bold text-emerald-700">
                      {formatCurrency(totalExpense)} KRW
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-slate-500">카테고리별 예산</div>
                      <button
                        type="button"
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:text-slate-800"
                        onClick={() => setShowRates((prev) => !prev)}
                      >
                        환율 {showRates ? "닫기" : "열기"}
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                    <div className="text-xs font-semibold text-slate-500">카테고리</div>
                    <div className="mt-3 space-y-3">
                      {categoryOrder.map((category) => {
                        const isOther = category === "other"
                        const categoryItems = isOther
                          ? tripSchedules.filter(
                              (schedule) =>
                                schedule.category === "other" ||
                                schedule.category === "" ||
                                !categoryOrder.includes(schedule.category)
                            )
                          : tripSchedules.filter((schedule) => schedule.category === category)
                        const categorySum = categoryItems.reduce((sum, schedule) => {
                          const rate = rateMap[schedule.currency] ?? 1
                          return sum + schedule.amount * rate
                        }, 0)
                        const label = categoryLabels[category] ?? category
                        const isActive = selectedCategory === category

                        return (
                          <button
                            key={category}
                            type="button"
                            className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                              isActive
                                ? "border-slate-300 bg-slate-100"
                                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                            }`}
                            onClick={() => setSelectedCategory(category)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="text-base font-semibold text-slate-900">{label}</div>
                              <div className="text-base font-semibold text-slate-900">
                                {formatCurrency(categorySum)} KRW
                              </div>
                            </div>
                            <div className="mt-1 text-sm text-slate-400">{categoryItems.length}개 항목</div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>

                <div className="relative">
                  <section
                    className={`absolute inset-0 rounded-2xl border border-slate-200 bg-white transition-opacity duration-[400ms] ${
                      showRates ? "z-10 opacity-100" : "z-0 pointer-events-none opacity-0"
                    }`}
                    style={{ transition: "opacity 400ms ease" }}
                  >
                      <div className="border-b border-slate-100 px-5 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-lg font-bold text-slate-900">환율 설정</div>
                            <div className="text-xs text-slate-400 mt-1">필요한 통화의 환율을 입력하세요.</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowRates(false)}
                            className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-600"
                          >
                            저장
                          </button>
                        </div>
                      </div>
                      <div className="px-5 py-4">
                        <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-500">
                          <Search className="h-4 w-4" />
                          <input
                            type="text"
                            value={rateSearch}
                            onChange={(event) => setRateSearch(event.target.value)}
                            placeholder="통화 검색..."
                            className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
                          />
                        </div>
                        <div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                          {filteredCurrencies.map((currency) => {
                            const rate = rateMap[currency.code] ?? 0
                            const displayRate = rate * currency.unit
                            const draft = rateDrafts[currency.code]
                            return (
                              <div key={currency.code}>
                                <div className="flex items-center justify-between gap-4">
                                  <div className="flex-1">
                                    <div className="flex items-center justify-between gap-3 text-[15px] font-bold text-slate-900">
                                      <span>{currency.label}</span>
                                      <span className="text-[13px] font-bold text-emerald-700">
                                        {currency.code} {currency.unit}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-slate-400">:</span>
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      value={draft ?? formatRateValue(displayRate)}
                                      onChange={(event) => {
                                        const value = event.target.value
                                        setRateDrafts((prev) => ({ ...prev, [currency.code]: value }))
                                        const parsed = Number.parseFloat(value)
                                        if (Number.isFinite(parsed)) {
                                          setExchangeRate(currency.code, parsed / currency.unit)
                                        }
                                      }}
                                      onBlur={() =>
                                        setRateDrafts((prev) => {
                                          if (!(currency.code in prev)) return prev
                                          const next = { ...prev }
                                          delete next[currency.code]
                                          return next
                                        })
                                      }
                                      className="w-28 rounded-lg bg-slate-100 px-3 py-2 text-right text-[15px] font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                                    />
                                    <span className="text-[13px] font-bold text-emerald-500">KRW</span>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </section>
                  <section
                    className={`relative flex min-h-[700px] flex-col rounded-2xl border border-slate-200 bg-white ${
                      showRates ? "z-0 pointer-events-none" : "z-10"
                    }`}
                  >
                    <div key={selectedCategory}>
                      <div className="px-4 py-3">
                        {(() => {
                          const isOther = selectedCategory === "other"
                          const items = isOther
                            ? tripSchedules.filter(
                                (schedule) =>
                                  schedule.category === "other" ||
                                  schedule.category === "" ||
                                  !categoryOrder.includes(schedule.category)
                              )
                            : tripSchedules.filter((schedule) => schedule.category === selectedCategory)
                          const categorySum = items.reduce((sum, schedule) => {
                            const rate = rateMap[schedule.currency] ?? 1
                            return sum + schedule.amount * rate
                          }, 0)
                          return (
                            <>
                              <div className="flex items-center justify-between gap-4">
                                <div className="flex items-end gap-2 pl-1">
                                  <div className="text-xl font-bold text-slate-900 pt-2 pb-1">
                                    {categoryLabels[selectedCategory] ?? selectedCategory}
                                  </div>
                                  <div className="text-xs font-semibold text-slate-400 pb-[8px]">
                                    {items.length}개 항목
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="text-base font-bold text-emerald-600">
                                    {formatCurrency(categorySum)} KRW
                                  </div>
                                </div>
                              </div>
                            </>
                          )
                        })()}
                      </div>
                      <div className="flex-1 space-y-2 px-3 pb-20">
                      {(() => {
                        const isOther = selectedCategory === "other"
                        const items = isOther
                            ? tripSchedules.filter(
                                (schedule) =>
                                  schedule.category === "other" ||
                                  schedule.category === "" ||
                                  !categoryOrder.includes(schedule.category)
                              )
                            : tripSchedules.filter((schedule) => schedule.category === selectedCategory)

                          if (items.length === 0) {
                            return (
                              <div className="py-8 pl-2 text-sm font-semibold text-slate-400">
                                No items
                              </div>
                            )
                          }

                          return items.map((schedule) => {
                            const converted = schedule.amount * (rateMap[schedule.currency] ?? 1)
                            const isNonKrw = schedule.currency !== "KRW" && schedule.amount > 0

                            return (
                              <div key={schedule.id}>
                                <div
                                  className="rounded-xl border border-slate-200 bg-white px-3 py-3 transition hover:border-emerald-200 hover:bg-emerald-50/30 cursor-pointer"
                                  onClick={() => {
                                    setEditingSchedule(schedule)
                                    setEditModalOpen(true)
                                  }}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="text-xs font-semibold text-emerald-600">
                                        Day {schedule.dayNumber} · {schedule.time || "미정"}
                                      </div>
                                      <div className="text-base font-bold text-slate-900 truncate">
                                        {schedule.title}
                                      </div>
                                      {schedule.memo && (
                                        <div className="text-xs text-slate-400 truncate">{schedule.memo}</div>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <div className="w-24 rounded-lg bg-slate-100 px-3 py-2 text-right text-sm font-semibold text-slate-900">
                                        {formatCurrency(schedule.amount)}
                                      </div>
                                      <div className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-white">
                                        {schedule.currency}
                                      </div>
                                    </div>
                                  </div>
                                  {isNonKrw && (
                                    <div className="mt-2 text-xs text-slate-400 text-right">
                                      {formatCurrency(converted)} KRW
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })
                      })()}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAddModalOpen(true)}
                      className="absolute bottom-4 right-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg hover:bg-emerald-600"
                      aria-label="예산 추가"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  </section>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      <BudgetAddModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        tripDuration={tripDuration}
        currencyOptions={currencyList}
        exchangeRates={rateMap}
        currencyLabels={currencyLabelMap}
        currencyUnits={currencyUnitMap}
        onSubmit={(data) => {
          addBudgetItem(trip.id, data)
        }}
      />

      <BudgetAddModal
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false)
          setEditingSchedule(null)
        }}
        tripDuration={tripDuration}
        currencyOptions={currencyList}
        exchangeRates={rateMap}
        currencyLabels={currencyLabelMap}
        currencyUnits={currencyUnitMap}
        mode="edit"
        initialData={editingSchedule}
        onSubmit={(data) => {
          if (!editingSchedule) return
          updateSchedule(trip.id, editingSchedule.dayNumber, editingSchedule.id, {
            dayNumber: data.dayNumber,
            time: data.time,
            endTime: data.endTime,
            title: data.title,
            memo: data.memo,
            category: data.category,
            subCategory: data.subCategory,
            amount: data.amount,
            currency: data.currency,
          })
          setEditModalOpen(false)
          setEditingSchedule(null)
        }}
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

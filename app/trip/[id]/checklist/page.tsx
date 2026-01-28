"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import { Plane, Plus, MoreHorizontal } from "lucide-react"
import { useTravelStore } from "@/lib/store"
import { ShareSync } from "@/components/share-sync"
import { ShareChatModal } from "@/components/share-chat-modal"
import { banShareMember, hashPassword, updateShare } from "@/lib/share"
import type { ShareLog, ShareMember } from "@/lib/share"

export default function TripChecklistPage() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const shareId = searchParams.get("share")
  const {
    trips,
    checklistCategories,
    checklistItems,
    addChecklistCategory,
    deleteChecklistCategory,
    addChecklistItem,
    deleteChecklistItem,
    toggleChecklistItem,
    updateChecklistItemCount,
    updateChecklistItem,
    addChecklistPreset,
    exportTripData,
    deleteTrip,
    activeShares,
  } = useTravelStore()
  const router = useRouter()

  const [itemAddOpen, setItemAddOpen] = useState(false)
  const [categoryAddOpen, setCategoryAddOpen] = useState(false)
  const [addCategoryName, setAddCategoryName] = useState("")
  const [addItemName, setAddItemName] = useState("")
  const [addItemCategoryId, setAddItemCategoryId] = useState<string | null>(null)
  const [addItemCountable, setAddItemCountable] = useState(false)
  const [addItemTarget, setAddItemTarget] = useState(1)
  const [editItem, setEditItem] = useState<(typeof checklistItems)[number] | null>(null)
  const [forceItemCategoryId, setForceItemCategoryId] = useState<string | null>(null)
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false)
  const [editCategoryPickerOpen, setEditCategoryPickerOpen] = useState(false)
  const [openCategoryMenuId, setOpenCategoryMenuId] = useState<string | null>(null)
  const [renameCategoryId, setRenameCategoryId] = useState<string | null>(null)
  const [renameCategoryName, setRenameCategoryName] = useState("")
  const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null)
  const [scrollHints, setScrollHints] = useState<Record<string, { top: boolean; bottom: boolean }>>({})
  const scrollNodesRef = useRef(new Map<string, HTMLDivElement>())
  const [editName, setEditName] = useState("")
  const [editCategoryId, setEditCategoryId] = useState<string>("")
  const [editCountable, setEditCountable] = useState(false)
  const [editTarget, setEditTarget] = useState(1)
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

  useEffect(() => {
    if (!activeShare) return
    setShareEnabled(activeShare.enabled)
  }, [activeShare?.enabled])

  useEffect(() => {
    if (!effectiveShareId) return
    const nameKey = `trav-share-name:${effectiveShareId}`
    const passKey = `trav-share-pass:${effectiveShareId}`
    const storedName = localStorage.getItem(nameKey)
    const storedPass = localStorage.getItem(passKey)
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

  const isAdmin = Boolean(clientId && shareOwnerId && clientId === shareOwnerId)

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

  const trip = trips.find((item) => item.id === id)
  const categories = useMemo(
    () =>
      checklistCategories
        .filter((category) => category.tripId === id)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [checklistCategories, id]
  )

  const itemsByCategory = useMemo(() => {
    const map: Record<string, typeof checklistItems> = {}
    checklistItems.forEach((item) => {
      map[item.categoryId] = map[item.categoryId] ? [...map[item.categoryId], item] : [item]
    })
    Object.keys(map).forEach((key) => {
      map[key] = map[key].sort((a, b) => a.sortOrder - b.sortOrder)
    })
    return map
  }, [checklistItems])

  useEffect(() => {
    if (!trip) return
    if (categories.length === 0) {
      addChecklistPreset(trip.id)
    }
  }, [trip, categories.length, addChecklistPreset])

  useEffect(() => {
    const next: Record<string, { top: boolean; bottom: boolean }> = {}
    categories.forEach((category) => {
      const node = scrollNodesRef.current.get(category.id)
      if (!node) return
      const hasOverflow = node.scrollHeight > node.clientHeight + 1
      next[category.id] = {
        top: hasOverflow && node.scrollTop > 0,
        bottom: hasOverflow && node.scrollTop + node.clientHeight < node.scrollHeight - 1,
      }
    })
    if (Object.keys(next).length > 0) {
      setScrollHints((prev) => ({ ...prev, ...next }))
    }
  }, [categories, checklistItems])

  const setScrollNode = (id: string) => (node: HTMLDivElement | null) => {
    if (node) {
      scrollNodesRef.current.set(id, node)
    } else {
      scrollNodesRef.current.delete(id)
    }
  }

  const handleScroll = (id: string) => (event: React.UIEvent<HTMLDivElement>) => {
    const node = event.currentTarget
    const hasOverflow = node.scrollHeight > node.clientHeight + 1
    setScrollHints((prev) => ({
      ...prev,
      [id]: {
        top: hasOverflow && node.scrollTop > 0,
        bottom: hasOverflow && node.scrollTop + node.clientHeight < node.scrollHeight - 1,
      },
    }))
  }


  const formatDateRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    return `${start.getFullYear()}년 ${start.getMonth() + 1}월 ${start.getDate()}일 - ${end.getMonth() + 1}월 ${end.getDate()}일`
  }


  const openItemAddModal = (categoryId?: string) => {
    setAddItemName("")
    setAddItemCategoryId(categoryId ?? categories[0]?.id ?? null)
    setAddItemCountable(false)
    setAddItemTarget(1)
    setForceItemCategoryId(categoryId ?? null)
    setCategoryPickerOpen(false)
    setItemAddOpen(true)
  }

  const openCategoryAddModal = () => {
    setAddCategoryName("")
    setCategoryAddOpen(true)
  }

  const openEditModal = (item: (typeof checklistItems)[number]) => {
    setEditItem(item)
    setEditName(item.name)
    setEditCategoryId(item.categoryId)
    setEditCountable(item.isCountable)
    setEditTarget(item.targetCount)
    setEditCategoryPickerOpen(false)
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
                className="block w-full text-left px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                예산 관리
              </Link>
              <Link
                href={`/trip/${trip.id}/checklist${shareId ? `?share=${shareId}` : ""}`}
                className="block w-full text-left px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 font-medium"
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

        <main className="flex flex-col min-h-screen">
          <header className="bg-white border-b border-slate-200 px-6 py-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">체크리스트</h1>
              <p className="text-sm text-slate-500 mt-1">{trip.title} · {formatDateRange(trip.startDate, trip.endDate)}</p>
            </div>
          </header>

          <div className="flex-1 overflow-x-auto py-6 pl-4 pr-6">
            <div className="flex gap-4 h-full">
              {categories.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-sm text-slate-500">체크리스트 카테고리를 추가해 주세요.</div>
                </div>
              ) : (
                categories.map((category) => {
                  const items = itemsByCategory[category.id] ?? []
                  const completedCount = items.filter(
                    (item) => item.isChecked || (item.isCountable && item.currentCount >= item.targetCount)
                  ).length
                  return (
                    <section
                      key={category.id}
                      className="relative flex-shrink-0 w-[360px] min-h-[560px] flex flex-col rounded-2xl border border-slate-200 bg-white"
                    >
                      <div className="flex w-full items-center justify-between px-5 pt-5 pb-3 border-b border-slate-200">
                        <div className="text-lg font-bold text-slate-900">{category.title}</div>
                        <div className="flex items-center gap-3 text-sm font-semibold text-emerald-500">
                          {items.length > 0 && (
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                completedCount === items.length
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-emerald-50 text-emerald-500"
                              }`}
                            >
                              {completedCount}/{items.length}
                            </span>
                          )}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                setOpenCategoryMenuId((prev) => (prev === category.id ? null : category.id))
                              }}
                              className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 hover:text-slate-600"
                              aria-label="카테고리 메뉴"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                            {openCategoryMenuId === category.id && (
                              <div
                                className="absolute right-0 top-9 z-10 w-36 rounded-xl border border-slate-200 bg-white p-2 shadow-lg"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRenameCategoryId(category.id)
                                    setRenameCategoryName(category.title)
                                    setOpenCategoryMenuId(null)
                                  }}
                                  className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                  이름 변경
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDeleteCategoryId(category.id)
                                    setOpenCategoryMenuId(null)
                                  }}
                                  className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-red-500 hover:bg-red-50"
                                >
                                  삭제
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="relative flex-1">
                        <div
                          ref={setScrollNode(category.id)}
                          onScroll={handleScroll(category.id)}
                          className="h-full space-y-3 overflow-y-auto px-5 pb-16 pt-3"
                        >
                          {items.length === 0 ? (
                            <div className="text-sm text-slate-400">No items</div>
                          ) : (
                            items.map((item) => (
                              <div
                                key={item.id}
                                onClick={() => openEditModal(item)}
                                className={`flex items-center justify-between rounded-xl border px-4 py-3 cursor-pointer ${
                                  item.isChecked || (item.isCountable && item.currentCount >= item.targetCount)
                                    ? "border-emerald-100 bg-emerald-50/60"
                                    : "border-slate-200 bg-white"
                                }`}
                              >
                                <span
                                  className={`text-sm font-medium ${
                                    item.isChecked || (item.isCountable && item.currentCount >= item.targetCount)
                                      ? "text-slate-400"
                                      : "text-slate-800"
                                  }`}
                                >
                                  {item.name}
                                </span>
                                {!item.isCountable ? (
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      toggleChecklistItem(item.id)
                                    }}
                                    className={`h-5 w-5 rounded-full border ${
                                      item.isChecked
                                        ? "border-emerald-500 bg-emerald-500"
                                        : "border-slate-300 bg-white"
                                    }`}
                                  />
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation()
                                        updateChecklistItemCount(item.id, -1)
                                      }}
                                      className="h-6 w-6 rounded-full border border-slate-200 text-slate-500 hover:border-emerald-500 hover:text-emerald-600"
                                    >
                                      -
                                    </button>
                                    <span
                                      className={`text-sm ${
                                        item.currentCount >= item.targetCount ? "text-emerald-600" : "text-slate-700"
                                      }`}
                                    >
                                      {item.currentCount}/{item.targetCount}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation()
                                        updateChecklistItemCount(item.id, 1)
                                      }}
                                      className="h-6 w-6 rounded-full border border-slate-200 text-slate-500 hover:border-emerald-500 hover:text-emerald-600"
                                    >
                                      +
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                        <div
                          className={`pointer-events-none absolute left-5 right-5 top-3 h-6 rounded-b-xl bg-gradient-to-b from-white/90 to-transparent transition-opacity ${
                            scrollHints[category.id]?.top ? "opacity-100" : "opacity-0"
                          }`}
                        />
                        <div
                          className={`pointer-events-none absolute left-5 right-5 bottom-16 h-6 rounded-t-xl bg-gradient-to-t from-white/90 to-transparent transition-opacity ${
                            scrollHints[category.id]?.bottom ? "opacity-100" : "opacity-0"
                          }`}
                        />
                      </div>
                      <div className="absolute bottom-4 right-4 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            openItemAddModal(category.id)
                          }}
                          className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md hover:bg-emerald-600"
                          aria-label="아이템 추가"
                        >
                          <Plus className="h-5 w-5" />
                        </button>
                      </div>
                    </section>
                  )
                })
              )}
              <button
                type="button"
                onClick={() => {
                  openCategoryAddModal()
                }}
                className="flex-shrink-0 w-[140px] min-h-[560px] rounded-2xl border border-dashed border-emerald-300 bg-white text-emerald-600 mr-3 transition-transform duration-200 hover:-translate-y-1 hover:scale-[1.01] hover:bg-emerald-50"
              >
                <div className="flex h-full flex-col items-center justify-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white">
                    <Plus className="h-6 w-6" />
                  </div>
                  <div className="text-sm font-semibold">
                    카테고리
                    <br />
                    추가
                  </div>
                </div>
              </button>
            </div>
          </div>
        </main>
      </div>

      {itemAddOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setItemAddOpen(false)} />
          <div className="fixed left-1/2 top-1/2 w-full max-w-xs -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-lg">
            <div className="mb-4">
              <div className="text-lg font-bold text-slate-900">아이템 추가</div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-semibold text-slate-700">카테고리</label>
              {forceItemCategoryId ? (
                <div className="w-full rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
                  {categories.find((category) => category.id === forceItemCategoryId)?.title ?? ""}
                </div>
              ) : (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setCategoryPickerOpen((prev) => !prev)}
                    className="w-full rounded-lg bg-slate-100 px-3 py-2 text-left text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  >
                    {categories.find((category) => category.id === addItemCategoryId)?.title ?? "카테고리 선택"}
                  </button>
                  {categoryPickerOpen && (
                    <div className="absolute left-0 right-0 z-10 mt-2 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                      {categories.map((category) => (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() => {
                            setAddItemCategoryId(category.id)
                            setCategoryPickerOpen(false)
                          }}
                          className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          {category.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <label className="text-sm font-semibold text-slate-700">아이템</label>
              <input
                value={addItemName}
                onChange={(event) => setAddItemName(event.target.value)}
                placeholder="아이템 이름"
                onKeyDown={(event) => {
                  if (event.key === "Escape") setItemAddOpen(false)
                  if (event.key === "Enter") {
                    event.preventDefault()
                    if (!addItemName.trim() || !addItemCategoryId) return
                    addChecklistItem(addItemCategoryId, addItemName.trim(), addItemCountable, addItemTarget)
                    setAddItemName("")
                    setAddItemCountable(false)
                    setAddItemTarget(1)
                    setItemAddOpen(false)
                  }
                }}
                className="w-full rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              />
              <label className="flex items-center gap-2 text-xs text-slate-500">
                <input
                  type="checkbox"
                  checked={addItemCountable}
                  onChange={(event) => setAddItemCountable(event.target.checked)}
                />
                수량 체크
              </label>
              {addItemCountable && (
                <div>
                  <label className="text-sm font-semibold text-slate-700">목표 수량</label>
                  <input
                    type="number"
                    min={1}
                    value={addItemTarget}
                    onChange={(event) => setAddItemTarget(Number(event.target.value) || 1)}
                    className="mt-2 w-full rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setItemAddOpen(false)}
                className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!addItemName.trim() || !addItemCategoryId) return
                  addChecklistItem(addItemCategoryId, addItemName.trim(), addItemCountable, addItemTarget)
                  setAddItemName("")
                  setAddItemCountable(false)
                  setAddItemTarget(1)
                  setItemAddOpen(false)
                }}
                className="flex-1 rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-600"
              >
                추가
              </button>
            </div>
          </div>
        </div>
      )}

      {categoryAddOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setCategoryAddOpen(false)} />
          <div className="fixed left-1/2 top-1/2 w-full max-w-xs -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-lg">
            <div className="mb-4">
              <div className="text-lg font-bold text-slate-900">카테고리 추가</div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-semibold text-slate-700">카테고리 이름</label>
              <input
                value={addCategoryName}
                onChange={(event) => setAddCategoryName(event.target.value)}
                placeholder="예: 의류, 세면도구"
                onKeyDown={(event) => {
                  if (event.key === "Escape") setCategoryAddOpen(false)
                  if (event.key === "Enter") {
                    event.preventDefault()
                    if (!addCategoryName.trim()) return
                    addChecklistCategory(trip.id, addCategoryName.trim())
                    setAddCategoryName("")
                    setCategoryAddOpen(false)
                  }
                }}
                className="w-full rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              />
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setCategoryAddOpen(false)}
                className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!addCategoryName.trim()) return
                  addChecklistCategory(trip.id, addCategoryName.trim())
                  setAddCategoryName("")
                  setCategoryAddOpen(false)
                }}
                className="flex-1 rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-600"
              >
                추가
              </button>
            </div>
          </div>
        </div>
      )}

      {editItem && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditItem(null)} />
          <div className="fixed left-1/2 top-1/2 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-lg">
            <div className="mb-4">
              <div className="text-lg font-bold text-slate-900">아이템 수정</div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-semibold text-slate-700">카테고리</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setEditCategoryPickerOpen((prev) => !prev)}
                  className="w-full rounded-lg bg-slate-100 px-3 py-2 text-left text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                >
                  {categories.find((category) => category.id === editCategoryId)?.title ?? "카테고리 선택"}
                </button>
                {editCategoryPickerOpen && (
                  <div className="absolute left-0 right-0 z-10 mt-2 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                    {categories.map((category) => (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => {
                          setEditCategoryId(category.id)
                          setEditCategoryPickerOpen(false)
                        }}
                        className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        {category.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <label className="text-sm font-semibold text-slate-700">아이템</label>
              <input
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                className="w-full rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              />
              <label className="flex items-center gap-2 text-xs text-slate-500">
                <input
                  type="checkbox"
                  checked={editCountable}
                  onChange={(event) => setEditCountable(event.target.checked)}
                />
                수량 체크
              </label>
              {editCountable && (
                <div>
                  <label className="text-sm font-semibold text-slate-700">목표 수량</label>
                  <input
                    type="number"
                    min={1}
                    value={editTarget}
                    onChange={(event) => setEditTarget(Number(event.target.value) || 1)}
                    className="mt-2 w-full rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  deleteChecklistItem(editItem.id)
                  setEditItem(null)
                }}
                className="flex-1 rounded-full bg-red-500 px-4 py-2 text-xs font-semibold text-white hover:bg-red-600"
              >
                삭제
              </button>
              <button
                type="button"
                onClick={() => setEditItem(null)}
                className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={() => {
                  updateChecklistItem(editItem.id, {
                    name: editName.trim() || editItem.name,
                    categoryId: editCategoryId,
                    isCountable: editCountable,
                    targetCount: editCountable ? Math.max(1, editTarget) : 1,
                  })
                  setEditItem(null)
                }}
                className="flex-1 rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-600"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {renameCategoryId && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setRenameCategoryId(null)} />
          <div className="fixed left-1/2 top-1/2 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-lg">
            <div className="mb-4">
              <div className="text-lg font-bold text-slate-900">카테고리 이름 변경</div>
            </div>
            <input
              value={renameCategoryName}
              onChange={(event) => setRenameCategoryName(event.target.value)}
              className="w-full rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            />
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setRenameCategoryId(null)}
                className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!renameCategoryId) return
                  const title = renameCategoryName.trim()
                  if (!title) return
                  updateChecklistCategory(renameCategoryId, { title })
                  setRenameCategoryId(null)
                }}
                className="flex-1 rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-600"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteCategoryId && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteCategoryId(null)} />
          <div className="fixed left-1/2 top-1/2 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-lg">
            <div className="mb-4">
              <div className="text-lg font-bold text-slate-900">카테고리 삭제</div>
            </div>
            <p className="text-sm text-slate-600">정말 삭제하시겠습니까?</p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteCategoryId(null)}
                className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteChecklistCategory(deleteCategoryId)
                  setDeleteCategoryId(null)
                }}
                className="flex-1 rounded-full bg-red-500 px-4 py-2 text-xs font-semibold text-white hover:bg-red-600"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

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

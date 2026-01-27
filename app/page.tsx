"use client"

import { useEffect, useRef, useState } from "react"
import { Plane, Plus, Calendar, MapPin, MoreHorizontal, Edit2, Trash2, Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTravelStore } from "@/lib/store"
import { TripModal } from "@/components/trip-modal"
import { ConfirmModal } from "@/components/confirm-modal"
import Link from "next/link"
import type { Trip, TripFormData } from "@/lib/types"

export default function HomePage() {
  const { trips, addTrip, updateTrip, deleteTrip, importTripData, exportTripData } = useTravelStore()
  
  const [tripModalOpen, setTripModalOpen] = useState(false)
  const [tripModalMode, setTripModalMode] = useState<"add" | "edit">("add")
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null)
  
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [tripToDelete, setTripToDelete] = useState<string | null>(null)
  
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!openMenuId) return
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (target.closest("[data-trip-menu]")) return
      setOpenMenuId(null)
    }
    window.addEventListener("click", handleClick)
    return () => window.removeEventListener("click", handleClick)
  }, [openMenuId])

  const handleAddTrip = () => {
    setTripModalMode("add")
    setEditingTrip(null)
    setTripModalOpen(true)
  }

  const handleEditTrip = (trip: Trip) => {
    setTripModalMode("edit")
    setEditingTrip(trip)
    setTripModalOpen(true)
    setOpenMenuId(null)
  }

  const handleDeleteTrip = (tripId: string) => {
    setTripToDelete(tripId)
    setDeleteModalOpen(true)
    setOpenMenuId(null)
  }

  const handleTripSubmit = (data: TripFormData) => {
    if (tripModalMode === "add") {
      addTrip(data)
    } else if (editingTrip) {
      updateTrip(editingTrip.id, data)
    }
  }

  const formatDateRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const startStr = `${start.getFullYear()}.${String(start.getMonth() + 1).padStart(2, "0")}.${String(start.getDate()).padStart(2, "0")}`
    const endStr = `${String(end.getMonth() + 1).padStart(2, "0")}.${String(end.getDate()).padStart(2, "0")}`
    return `${startStr} - ${endStr}`
  }

  const getDayCount = (startDate: string, endDate: string) => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const diffTime = Math.abs(end.getTime() - start.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
    return diffDays
  }

  const handleImport = async (file: File) => {
    try {
      const text = await file.text()
      const payload = JSON.parse(text)
      importTripData(payload)
    } catch (error) {
      console.error("Import failed", error)
    }
  }

  const handleExportTrip = (trip: Trip) => {
    const payload = exportTripData(trip.id)
    if (!payload) return
    const safeTitle = trip.title.replace(/[^\w\d-_]+/g, "_")
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${safeTitle || "trip"}-share.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
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
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 px-2">
            카테고리
          </div>
          <nav className="space-y-1 text-sm">
            <button className="w-full text-left px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 font-medium">
              홈
            </button>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="bg-slate-100">
          <section className="flex-1">
            {/* Page Title */}
            <div className="border-b border-slate-200 bg-white px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">내 여행</h1>
                  <p className="text-slate-500 mt-1">총 {trips.length}개의 여행</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      className="bg-white"
                      onClick={() => {
                        const firstTrip = trips[0]
                        if (!firstTrip) return
                        handleExportTrip(firstTrip)
                      }}
                    >
                      <Share2 className="w-4 h-4 mr-2" />
                      공유하기
                    </Button>
                  <Button
                    variant="outline"
                    className="bg-white"
                    onClick={() => importInputRef.current?.click()}
                  >
                    가져오기
                  </Button>
                  <Button
                    onClick={handleAddTrip}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    새 여행 만들기
                  </Button>
                </div>
              </div>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (!file) return
                  handleImport(file)
                  event.target.value = ""
                }}
              />
            </div>

        {/* Trip Cards Grid */}
            <div className="px-6 py-6">
              <div className="max-w-5xl">
            {trips.length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Plane className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">아직 여행이 없습니다</h3>
            <p className="text-slate-500 mb-6">새로운 여행을 만들어 일정을 계획해보세요</p>
            <Button 
              onClick={handleAddTrip}
              className="bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              첫 여행 만들기
            </Button>
          </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {trips.map((trip) => (
                  <Link
                    key={trip.id}
                    href={`/trip/${trip.id}`}
                    className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow group block"
                  >
                {/* Trip Image */}
                <div className="relative h-40 bg-slate-200">
                  {trip.imageUrl ? (
                    <img 
                      src={trip.imageUrl || "/placeholder.svg"} 
                      alt={trip.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-400 to-emerald-600">
                      <Plane className="w-12 h-12 text-white/50" />
                    </div>
                  )}
                  
                  {/* Menu Button */}
                  <div className="absolute top-3 right-3">
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
                        setMenuPosition({ top: rect.bottom + 6, left: rect.right - 120 })
                        setOpenMenuId(openMenuId === trip.id ? null : trip.id)
                      }}
                      className="w-8 h-8 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-sm"
                      data-trip-menu
                    >
                      <MoreHorizontal className="w-4 h-4 text-slate-600" />
                    </button>
                    
                    {/* Dropdown Menu */}
                    {openMenuId === trip.id && (
                      <div
                        className="fixed bg-white rounded-lg shadow-lg border border-slate-200 py-1 min-w-[120px] z-10"
                        style={menuPosition ? { top: menuPosition.top, left: menuPosition.left } : undefined}
                        data-trip-menu
                      >
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            handleEditTrip(trip)
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                        >
                          <Edit2 className="w-4 h-4" />
                          수정
                        </button>
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            handleExportTrip(trip)
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                        >
                          <Share2 className="w-4 h-4" />
                          공유하기
                        </button>
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            handleDeleteTrip(trip.id)
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          삭제
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Day Badge */}
                  <div className="absolute bottom-3 left-3">
                    <span className="px-2.5 py-1 bg-slate-900/80 text-white text-xs font-medium rounded-full">
                      {getDayCount(trip.startDate, trip.endDate)}일
                    </span>
                  </div>
                </div>

                {/* Trip Info */}
                <div className="p-4">
                  <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-emerald-600 transition-colors">
                    {trip.title}
                  </h3>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-slate-500 text-sm">
                      <MapPin className="w-4 h-4" />
                      <span>{trip.destination}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-500 text-sm">
                      <Calendar className="w-4 h-4" />
                      <span>{formatDateRange(trip.startDate, trip.endDate)}</span>
                    </div>
                  </div>
                </div>
                  </Link>
                ))}
              </div>
            )}
              </div>
            </div>
          </section>
        </main>
      </div>

      {/* Modals */}
      <TripModal
        isOpen={tripModalOpen}
        onClose={() => setTripModalOpen(false)}
        onSubmit={handleTripSubmit}
        mode={tripModalMode}
        initialData={editingTrip}
      />
      
      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={() => tripToDelete && deleteTrip(tripToDelete)}
        title="여행 삭제"
        message="이 여행을 삭제하시겠습니까? 모든 일정이 함께 삭제됩니다."
      />
    </div>
  )
}

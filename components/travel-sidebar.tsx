"use client"

import Link from "next/link"
import { Plane, Calendar, Map, Settings, Plus, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Trip {
  id: string
  name: string
  dates: string
  isActive?: boolean
}

const trips: Trip[] = [
  { id: "1", name: "도쿄 여행", dates: "2026.02.15 - 02.20", isActive: true },
  { id: "2", name: "파리 여행", dates: "2026.04.10 - 04.18" },
  { id: "3", name: "뉴욕 여행", dates: "2026.06.01 - 06.07" },
]

export function TravelSidebar() {
  return (
    <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col h-screen">
      {/* Logo */}
      <div className="p-6 border-b border-slate-700">
        <Link href="/" className="flex items-center gap-3 rounded-lg hover:bg-slate-800 px-1 py-1">
          <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center">
            <Plane className="w-5 h-5 text-slate-900" />
          </div>
          <span className="text-xl font-semibold">여행 플래너</span>
        </Link>
      </div>

      {/* New Trip Button */}
      <div className="p-4">
        <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-medium">
          <Plus className="w-4 h-4 mr-2" />
          새 여행 만들기
        </Button>
      </div>

      {/* Navigation */}
      <nav className="px-3 py-2">
        <ul className="space-y-1">
          <li>
            <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-800 text-emerald-400">
              <Calendar className="w-5 h-5" />
              <span>일정</span>
            </a>
          </li>
          <li>
            <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors">
              <Map className="w-5 h-5" />
              <span>지도</span>
            </a>
          </li>
          <li>
            <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors">
              <Settings className="w-5 h-5" />
              <span>설정</span>
            </a>
          </li>
        </ul>
      </nav>

      {/* Trip List */}
      <div className="flex-1 px-3 py-4 overflow-y-auto">
        <div className="flex items-center justify-between px-3 mb-3">
          <span className="text-sm font-medium text-slate-400">내 여행</span>
          <ChevronDown className="w-4 h-4 text-slate-400" />
        </div>
        <ul className="space-y-1">
          {trips.map((trip) => (
            <li key={trip.id}>
              <a
                href="#"
                className={`block px-3 py-3 rounded-lg transition-colors ${
                  trip.isActive
                    ? "bg-slate-800 border-l-2 border-emerald-500"
                    : "hover:bg-slate-800"
                }`}
              >
                <div className="font-medium text-sm">{trip.name}</div>
                <div className="text-xs text-slate-400 mt-1">{trip.dates}</div>
              </a>
            </li>
          ))}
        </ul>
      </div>

      {/* User Profile */}
      <div className="p-4 border-t border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-slate-700 rounded-full flex items-center justify-center text-sm font-medium">
            JK
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">김지현</div>
            <div className="text-xs text-slate-400 truncate">jihyun@email.com</div>
          </div>
        </div>
      </div>
    </aside>
  )
}

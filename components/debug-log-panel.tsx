"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import { useTravelStore } from "@/lib/store"
import { addDebugLog, clearDebugLogs, getDebugLogs, subscribeDebugLogs, type DebugLogEntry } from "@/lib/debug-log"

const UI_EVENT_TYPES = [
  "touchstart",
  "touchend",
  "pointerdown",
  "pointerup",
  "click",
  "dblclick",
  "input",
  "change",
  "focusin",
  "focusout",
  "keydown",
  "submit",
]

type StoreSummary = {
  trips: number
  schedules: number
  dayInfos: number
  checklistCategories: number
  checklistItems: number
  exchangeRates: number
  activeShares: number
  selectedTripId: string | null
}

export function DebugLogPanel() {
  const pathname = usePathname()
  const [open, setOpen] = useState(true)
  const [paused, setPaused] = useState(false)
  const [entries, setEntries] = useState<DebugLogEntry[]>(() => getDebugLogs())

  useEffect(() => {
    addDebugLog({
      scope: "system",
      event: "debug-panel-mounted",
      detail: "global logger active",
    })
  }, [])

  useEffect(() => {
    if (!pathname) return
    addDebugLog({
      scope: "system",
      event: "route",
      detail: pathname,
    })
  }, [pathname])

  useEffect(() => {
    return subscribeDebugLogs((nextEntries) => {
      if (paused) return
      setEntries(nextEntries)
    })
  }, [paused])

  useEffect(() => {
    const handleUiEvent = (event: Event) => {
      const target = event.target as HTMLElement | null
      if (target?.closest("[data-debug-panel-root]")) return
      addDebugLog({
        scope: "ui",
        event: event.type,
        detail: describeEventTarget(target),
        data: extractEventData(event),
      })
    }

    for (const type of UI_EVENT_TYPES) {
      document.addEventListener(type, handleUiEvent, true)
    }

    const handleError = (event: ErrorEvent) => {
      addDebugLog({
        scope: "system",
        event: "window-error",
        level: "error",
        detail: event.message || "unknown error",
        data: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      })
    }

    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason =
        typeof event.reason === "string"
          ? event.reason
          : event.reason && typeof event.reason === "object" && "message" in event.reason
            ? String((event.reason as { message?: unknown }).message)
            : "unhandled rejection"
      addDebugLog({
        scope: "system",
        event: "promise-rejection",
        level: "error",
        detail: reason,
      })
    }

    window.addEventListener("error", handleError)
    window.addEventListener("unhandledrejection", handleRejection)
    return () => {
      for (const type of UI_EVENT_TYPES) {
        document.removeEventListener(type, handleUiEvent, true)
      }
      window.removeEventListener("error", handleError)
      window.removeEventListener("unhandledrejection", handleRejection)
    }
  }, [])

  useEffect(() => {
    let previous = summarizeStore(useTravelStore.getState())
    addDebugLog({
      scope: "store",
      event: "snapshot-init",
      data: previous,
    })
    const unsubscribe = useTravelStore.subscribe((state) => {
      const next = summarizeStore(state)
      const diff = summarizeDiff(previous, next)
      if (diff.length > 0) {
        addDebugLog({
          scope: "store",
          event: "snapshot-update",
          detail: diff.join(", "),
          data: next,
        })
      }
      previous = next
    })
    return () => {
      unsubscribe()
    }
  }, [])

  const visibleEntries = useMemo(() => [...entries].reverse(), [entries])

  const handleCopyLogs = async () => {
    const text = entries.map(formatLogLine).join("\n")
    try {
      await navigator.clipboard.writeText(text)
      addDebugLog({
        scope: "system",
        event: "copy-logs",
        detail: `${entries.length} lines copied`,
      })
    } catch {
      addDebugLog({
        scope: "system",
        event: "copy-logs-failed",
        level: "error",
      })
    }
  }

  const handlePauseToggle = () => {
    const next = !paused
    setPaused(next)
    if (!next) {
      setEntries(getDebugLogs())
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-debug-panel-root
        className="fixed bottom-4 right-4 z-[9999] rounded-full border border-slate-400 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-lg"
      >
        로그 열기 ({entries.length})
      </button>
    )
  }

  return (
    <div
      data-debug-panel-root
      className="fixed bottom-4 right-4 z-[9999] w-[min(640px,95vw)] rounded-2xl border border-slate-300 bg-white shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
        <div>
          <div className="text-xs font-bold text-slate-900">실시간 디버그 로그</div>
          <div className="text-[11px] text-slate-500">{entries.length} entries</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePauseToggle}
            className="rounded-full border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700"
          >
            {paused ? "재개" : "일시정지"}
          </button>
          <button
            type="button"
            onClick={handleCopyLogs}
            className="rounded-full border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700"
          >
            복사
          </button>
          <button
            type="button"
            onClick={() => clearDebugLogs()}
            className="rounded-full border border-red-200 px-2 py-1 text-[11px] font-semibold text-red-600"
          >
            비우기
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-full border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700"
          >
            닫기
          </button>
        </div>
      </div>

      <div className="max-h-[48vh] overflow-auto px-2 py-2 font-mono text-[11px] leading-4">
        {visibleEntries.length === 0 ? (
          <div className="px-2 py-1 text-slate-400">로그 없음</div>
        ) : (
          visibleEntries.map((entry) => (
            <div
              key={entry.id}
              className={`mb-1 rounded border px-2 py-1 ${
                entry.level === "error"
                  ? "border-red-200 bg-red-50"
                  : entry.level === "warn"
                    ? "border-amber-200 bg-amber-50"
                    : "border-slate-200 bg-slate-50"
              }`}
            >
              <div className="flex gap-2 text-[10px] text-slate-600">
                <span>{formatTime(entry.ts)}</span>
                <span>[{entry.scope}]</span>
                <span>{entry.event}</span>
              </div>
              {entry.detail ? <div className="mt-0.5 whitespace-pre-wrap text-slate-800">{entry.detail}</div> : null}
              {entry.data !== undefined ? (
                <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-[10px] text-slate-600">
                  {JSON.stringify(entry.data)}
                </pre>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function summarizeStore(state: ReturnType<typeof useTravelStore.getState>): StoreSummary {
  return {
    trips: state.trips.length,
    schedules: state.schedules.length,
    dayInfos: state.dayInfos.length,
    checklistCategories: state.checklistCategories.length,
    checklistItems: state.checklistItems.length,
    exchangeRates: state.exchangeRates.length,
    activeShares: Object.keys(state.activeShares).length,
    selectedTripId: state.selectedTripId,
  }
}

function summarizeDiff(previous: StoreSummary, next: StoreSummary) {
  const diff: string[] = []
  const numericKeys: Array<keyof Omit<StoreSummary, "selectedTripId">> = [
    "trips",
    "schedules",
    "dayInfos",
    "checklistCategories",
    "checklistItems",
    "exchangeRates",
    "activeShares",
  ]
  for (const key of numericKeys) {
    if (previous[key] !== next[key]) {
      diff.push(`${key}:${previous[key]}→${next[key]}`)
    }
  }
  if (previous.selectedTripId !== next.selectedTripId) {
    diff.push(`selectedTripId:${previous.selectedTripId ?? "null"}→${next.selectedTripId ?? "null"}`)
  }
  return diff
}

function describeEventTarget(target: HTMLElement | null) {
  if (!target) return "(no target)"
  const tag = target.tagName.toLowerCase()
  const id = target.id ? `#${target.id}` : ""
  const className =
    typeof target.className === "string" && target.className.trim()
      ? `.${target.className.trim().split(/\s+/).slice(0, 2).join(".")}`
      : ""
  const name = target.getAttribute("name")
  const dataDay = target.getAttribute("data-day")
  const attrs = [name ? `name=${name}` : "", dataDay ? `data-day=${dataDay}` : ""].filter(Boolean).join(" ")
  return `${tag}${id}${className}${attrs ? ` ${attrs}` : ""}`
}

function extractEventData(event: Event) {
  const base: Record<string, unknown> = {
    path: window.location.pathname,
  }
  if (event instanceof MouseEvent) {
    base.clientX = event.clientX
    base.clientY = event.clientY
    base.button = event.button
  }
  if (event instanceof KeyboardEvent) {
    base.key = event.key
    base.code = event.code
    base.ctrl = event.ctrlKey
    base.meta = event.metaKey
    base.shift = event.shiftKey
  }
  if (event instanceof TouchEvent) {
    base.touches = event.touches.length
    base.changedTouches = event.changedTouches.length
  }
  if (event.type === "input" || event.type === "change") {
    const target = event.target
    if (target instanceof HTMLInputElement) {
      base.inputType = target.type
      base.value = target.type === "password" ? `[hidden:${target.value.length}]` : target.value
    } else if (target instanceof HTMLTextAreaElement) {
      base.value = target.value
    } else if (target instanceof HTMLSelectElement) {
      base.value = target.value
    } else if (target instanceof HTMLElement && target.isContentEditable) {
      base.value = target.textContent ?? ""
    }
  }
  if (event.type === "submit") {
    const target = event.target
    if (target instanceof HTMLFormElement) {
      base.form = target.getAttribute("id") || target.getAttribute("name") || "form"
    }
  }
  return base
}

function formatTime(ts: number) {
  const date = new Date(ts)
  const time = date.toLocaleTimeString("ko-KR", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
  const ms = `${date.getMilliseconds()}`.padStart(3, "0")
  return `${time}.${ms}`
}

function formatLogLine(entry: DebugLogEntry) {
  const head = `[${formatTime(entry.ts)}] [${entry.level}] [${entry.scope}] ${entry.event}`
  const detail = entry.detail ? ` - ${entry.detail}` : ""
  const data = entry.data !== undefined ? ` ${JSON.stringify(entry.data)}` : ""
  return `${head}${detail}${data}`
}

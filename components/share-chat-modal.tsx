"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { sendShareMessage, subscribeShareMessages } from "@/lib/share"
import type { ShareMessage } from "@/lib/share"

interface ShareChatModalProps {
  isOpen: boolean
  shareId: string | null
  userName: string
  onClose: () => void
}

export function ShareChatModal({ isOpen, shareId, userName, onClose }: ShareChatModalProps) {
  const [messages, setMessages] = useState<ShareMessage[]>([])
  const [draft, setDraft] = useState("")
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen || !shareId) return
    const unsubscribe = subscribeShareMessages(shareId, (items) => {
      setMessages(items)
    })
    return () => unsubscribe()
  }, [isOpen, shareId])

  useEffect(() => {
    if (!isOpen || !listRef.current) return
    listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages, isOpen])

  const canSend = useMemo(() => draft.trim().length > 0, [draft])

  const handleSend = async () => {
    if (!shareId || !canSend) return
    const text = draft.trim()
    setDraft("")
    try {
      await sendShareMessage(shareId, { user: userName || "익명", text })
    } catch {
      setDraft(text)
    }
  }

  if (!isOpen || !shareId) return null

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="fixed right-6 top-24 w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="text-lg font-bold text-slate-900">채팅</div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-slate-400 hover:text-slate-600"
          >
            닫기
          </button>
        </div>
        <div
          ref={listRef}
          className="mt-4 h-64 space-y-3 overflow-y-auto rounded-xl bg-slate-50 px-3 py-3"
        >
          {messages.length === 0 ? (
            <div className="text-xs text-slate-400">아직 메시지가 없습니다</div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className="text-xs text-slate-600">
                <span className="font-semibold text-slate-800">{msg.user}</span>{" "}
                <span>{msg.text}</span>
              </div>
            ))
          )}
        </div>
        <div className="mt-4 flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="메시지 입력"
            className="flex-1 rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                handleSend()
              }
            }}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-white disabled:bg-emerald-200"
          >
            전송
          </button>
        </div>
      </div>
    </div>
  )
}

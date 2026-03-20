import { NextResponse } from "next/server"
import {
  addSelfHostedShareLog,
  banSelfHostedShareMember,
  getSelfHostedShareSnapshot,
  isSelfHostedShareId,
  removeSelfHostedShareMember,
  setSelfHostedShareEnabled,
  setSelfHostedSharePassword,
  updateSelfHostedSharePayload,
  upsertSelfHostedShareMember,
} from "@/lib/self-host-share-store"
import type { ShareLog, ShareMember, SharePayload } from "@/lib/share-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ shareId: string }> }
) {
  const { shareId } = await params
  if (!isSelfHostedShareId(shareId)) {
    return NextResponse.json({ error: "invalid share id" }, { status: 400 })
  }

  const snapshot = await getSelfHostedShareSnapshot(shareId)
  return NextResponse.json(snapshot)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ shareId: string }> }
) {
  const { shareId } = await params
  if (!isSelfHostedShareId(shareId)) {
    return NextResponse.json({ error: "invalid share id" }, { status: 400 })
  }

  const body = (await request.json()) as {
    payload?: SharePayload
    enabled?: boolean
    passwordHash?: string | null
    member?: ShareMember
    removeMemberId?: string
    banMemberId?: string
    log?: ShareLog
  }

  try {
    if (body.payload) {
      await updateSelfHostedSharePayload(shareId, body.payload)
    }
    if (typeof body.enabled === "boolean") {
      await setSelfHostedShareEnabled(shareId, body.enabled)
    }
    if ("passwordHash" in body) {
      await setSelfHostedSharePassword(shareId, body.passwordHash ?? null)
    }
    if (body.member) {
      await upsertSelfHostedShareMember(shareId, body.member)
    }
    if (body.removeMemberId) {
      await removeSelfHostedShareMember(shareId, body.removeMemberId)
    }
    if (body.banMemberId) {
      await banSelfHostedShareMember(shareId, body.banMemberId)
    }
    if (body.log) {
      await addSelfHostedShareLog(shareId, body.log)
    }
  } catch (error) {
    if (error instanceof Error && error.message === "share not found") {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    throw error
  }

  const snapshot = await getSelfHostedShareSnapshot(shareId)
  return NextResponse.json(snapshot)
}

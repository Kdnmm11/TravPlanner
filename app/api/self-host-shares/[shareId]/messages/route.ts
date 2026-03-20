import { NextResponse } from "next/server"
import { addSelfHostedShareMessage, isSelfHostedShareId } from "@/lib/self-host-share-store"
import type { ShareMessage } from "@/lib/share-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ shareId: string }> }
) {
  const { shareId } = await params
  if (!isSelfHostedShareId(shareId)) {
    return NextResponse.json({ error: "invalid share id" }, { status: 400 })
  }

  const body = (await request.json()) as {
    message?: Omit<ShareMessage, "id">
  }

  if (!body.message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 })
  }

  try {
    await addSelfHostedShareMessage(shareId, body.message)
  } catch (error) {
    if (error instanceof Error && error.message === "share not found") {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    throw error
  }

  return NextResponse.json({ ok: true })
}

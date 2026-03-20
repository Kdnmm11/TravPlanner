import { NextResponse } from "next/server"
import { createSelfHostedShare } from "@/lib/self-host-share-store"
import type { SharePayload } from "@/lib/share-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const body = (await request.json()) as {
    payload?: SharePayload
    passwordHash?: string | null
    ownerId?: string
    ownerName?: string
  }

  if (!body.payload || !body.ownerId) {
    return NextResponse.json(
      { error: "payload and ownerId are required" },
      { status: 400 }
    )
  }

  const shareId = await createSelfHostedShare({
    payload: body.payload,
    passwordHash: body.passwordHash,
    ownerId: body.ownerId,
    ownerName: body.ownerName,
  })

  return NextResponse.json({ shareId })
}

import { NextResponse } from "next/server"
import { findSelfHostedShareByTripId } from "@/lib/self-host-share-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params
  const match = await findSelfHostedShareByTripId(tripId)
  if (!match) {
    return NextResponse.json({ error: "share not found" }, { status: 404 })
  }

  return NextResponse.json(match)
}

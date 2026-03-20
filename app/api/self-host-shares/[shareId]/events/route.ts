import { getSelfHostedShareEvents, isSelfHostedShareId, subscribeToSelfHostedShareEvents } from "@/lib/self-host-share-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const encoder = new TextEncoder()

function formatSseEvent(event: string, data: unknown) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ shareId: string }> }
) {
  const { shareId } = await params
  if (!isSelfHostedShareId(shareId)) {
    return new Response("invalid share id", { status: 400 })
  }

  let unsubscribe: (() => void) | null = null
  let keepAlive: ReturnType<typeof setInterval> | null = null

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const initial = await getSelfHostedShareEvents(shareId)
      controller.enqueue(formatSseEvent("snapshot", initial.snapshot))
      controller.enqueue(formatSseEvent("logs", initial.logs))
      controller.enqueue(formatSseEvent("messages", initial.messages))

      unsubscribe = subscribeToSelfHostedShareEvents(shareId, (event) => {
        controller.enqueue(formatSseEvent(event.type, event.data))
      })

      keepAlive = setInterval(() => {
        controller.enqueue(encoder.encode(":keepalive\n\n"))
      }, 15000)
    },
    cancel() {
      if (keepAlive) {
        clearInterval(keepAlive)
      }
      unsubscribe?.()
      return
    },
  })

  request.signal.addEventListener("abort", () => {
    if (keepAlive) {
      clearInterval(keepAlive)
    }
    unsubscribe?.()
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}

import { get } from "@vercel/blob"
import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/data"

export async function GET(request: Request) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ error: "Não autorizado" }, { status: 403 })
  const pathname = new URL(request.url).searchParams.get("pathname")
  if (!pathname) return NextResponse.json({ error: "Foto não encontrada" }, { status: 400 })
  const result = await get(pathname, { access: "private" })
  if (!result) return new NextResponse("Não encontrado", { status: 404 })
  return new NextResponse(result.stream, { headers: { "Content-Type": result.blob.contentType || "application/octet-stream", "Cache-Control": "private, no-cache" } })
}

import { NextResponse } from "next/server"
import { createPromotionNotifications } from "@/lib/promotion-notifications"

export async function POST() {
  await createPromotionNotifications()
  return NextResponse.json({ ok: true })
}

export async function GET() {
  await createPromotionNotifications()
  return NextResponse.json({ ok: true })
}

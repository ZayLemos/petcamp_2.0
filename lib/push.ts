import webpush from "web-push"
import { db } from "@/lib/db"
import { pushSubscriptions } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

let configured = false

function ensureConfigured() {
  if (configured) return true
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) return false
  webpush.setVapidDetails("mailto:contato@petcamp.app", publicKey, privateKey)
  configured = true
  return true
}

type PushPayload = { title: string; body: string; url?: string; tag?: string }

// Envia um web push para todas as inscrições de um usuário. Remove inscrições inválidas.
export async function sendPushToUser(userId: string, payload: PushPayload) {
  if (!ensureConfigured()) return
  const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId))
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys as { p256dh: string; auth: string } },
          JSON.stringify(payload),
        )
      } catch (err: any) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, sub.endpoint))
        }
      }
    }),
  )
}

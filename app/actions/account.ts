"use server"

import { db } from "@/lib/db"
import { user, pushSubscriptions } from "@/lib/db/schema"
import { getCurrentUser } from "@/lib/data"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

const MANAGER_CODE = process.env.MANAGER_ACCESS_CODE ?? "petcamp-gerente"

export async function promoteToManager(code: string) {
  const me = await getCurrentUser()
  if (!me) throw new Error("Não autenticado.")
  if (code.trim() !== MANAGER_CODE) {
    return { ok: false, error: "Código de gerente incorreto." }
  }
  await db.update(user).set({ role: "manager" }).where(eq(user.id, me.id))
  revalidatePath("/", "layout")
  return { ok: true }
}

export async function updateSector(sector: string) {
  const me = await getCurrentUser()
  if (!me) throw new Error("Não autenticado.")
  await db.update(user).set({ sector }).where(eq(user.id, me.id))
  revalidatePath("/", "layout")
  return { ok: true }
}

type BrowserSubscription = {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export async function savePushSubscription(sub: BrowserSubscription) {
  const me = await getCurrentUser()
  if (!me) throw new Error("Não autenticado.")
  const existing = await db
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, sub.endpoint))
    .limit(1)
  if (existing.length > 0) {
    await db
      .update(pushSubscriptions)
      .set({ userId: me.id, keys: sub.keys })
      .where(eq(pushSubscriptions.endpoint, sub.endpoint))
  } else {
    await db.insert(pushSubscriptions).values({ userId: me.id, endpoint: sub.endpoint, keys: sub.keys })
  }
  return { ok: true }
}

export async function removePushSubscription(endpoint: string) {
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint))
  return { ok: true }
}

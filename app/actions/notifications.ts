"use server"

import { db } from "@/lib/db"
import { notifications } from "@/lib/db/schema"
import { getCurrentUser } from "@/lib/data"
import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export async function markAllRead() {
  const me = await getCurrentUser()
  if (!me) return
  await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.userId, me.id), eq(notifications.read, false)))
  revalidatePath("/painel")
}

export async function markRead(id: number) {
  const me = await getCurrentUser()
  if (!me) return
  await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.id, id), eq(notifications.userId, me.id)))
  revalidatePath("/painel")
}

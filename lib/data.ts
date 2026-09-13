import "server-only"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { user, promotions, promotionTasks, notifications } from "@/lib/db/schema"
import { and, desc, eq, or, sql } from "drizzle-orm"
import { headers } from "next/headers"

export async function getSession() {
  return auth.api.getSession({ headers: await headers() })
}

export type CurrentUser = {
  id: string
  name: string
  email: string
  role: string
  sector: string | null
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getSession()
  if (!session?.user) return null
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      sector: user.sector,
    })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1)
  return rows[0] ?? null
}

export async function getEmployees() {
  return db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      sector: user.sector,
    })
    .from(user)
    .orderBy(user.name)
}

export async function getPromotions() {
  return db.select().from(promotions).orderBy(desc(promotions.startDate))
}

export async function getApprovedPromotions() {
  return db.select().from(promotions).orderBy(promotions.startDate)
}

export type TaskWithPromotion = {
  id: number
  promotionId: number
  type: string
  sector: string
  dueDate: string
  completed: boolean
  completedByName: string | null
  completedAt: Date | null
  title: string
  productName: string | null
  oldPrice: string | null
  newPrice: string | null
}

export async function getTasksForSector(sector: string): Promise<TaskWithPromotion[]> {
  let sectors = [sector]
  try {
    const parsed = JSON.parse(sector)
    if (Array.isArray(parsed)) sectors = parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
  } catch {
    // Compatibilidade com contas antigas que armazenam um setor simples.
  }
  const normalizedSectors = sectors.map((item) => item.replace(/^\[|\]$/g, "").replaceAll('"', "").trim())
  const aliases = normalizedSectors.flatMap((item) => {
    const normalized = item.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    if (normalized.includes("sache") && normalized.includes("gato")) return ["Sachês gatos", "Sachês para gatos"]
    if (normalized.includes("sache") && (normalized.includes("cao") || normalized.includes("cachorro"))) return ["Sachês cães", "Sachês para cães"]
    return [item]
  })

  return db
    .select({
      id: promotionTasks.id,
      promotionId: promotionTasks.promotionId,
      type: promotionTasks.type,
      sector: promotionTasks.sector,
      dueDate: promotionTasks.dueDate,
      completed: promotionTasks.completed,
      completedByName: promotionTasks.completedByName,
      completedAt: promotionTasks.completedAt,
      title: promotions.title,
      productName: promotions.productName,
      oldPrice: promotions.oldPrice,
      newPrice: promotions.newPrice,
    })
    .from(promotionTasks)
    .innerJoin(promotions, eq(promotionTasks.promotionId, promotions.id))
    .where(aliases.length === 1 ? eq(promotionTasks.sector, aliases[0]) : or(...aliases.map((item) => eq(promotionTasks.sector, item))))
    .orderBy(promotionTasks.dueDate)
}

export async function getAllTasks(): Promise<TaskWithPromotion[]> {
  return db
    .select({
      id: promotionTasks.id,
      promotionId: promotionTasks.promotionId,
      type: promotionTasks.type,
      sector: promotionTasks.sector,
      dueDate: promotionTasks.dueDate,
      completed: promotionTasks.completed,
      completedByName: promotionTasks.completedByName,
      completedAt: promotionTasks.completedAt,
      title: promotions.title,
      productName: promotions.productName,
      oldPrice: promotions.oldPrice,
      newPrice: promotions.newPrice,
    })
    .from(promotionTasks)
    .innerJoin(promotions, eq(promotionTasks.promotionId, promotions.id))
    .orderBy(promotionTasks.dueDate)
}

export async function getNotifications(userId: string) {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(50)
}

export async function getUnreadCount(userId: string) {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)))
  return rows[0]?.count ?? 0
}

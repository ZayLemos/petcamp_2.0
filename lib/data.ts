import "server-only"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { user, promotions, promotionTasks, notifications } from "@/lib/db/schema"
import { and, desc, eq, sql } from "drizzle-orm"
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
    .where(eq(promotionTasks.sector, sector))
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

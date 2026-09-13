import { and, eq, gte, lte } from "drizzle-orm"
import { db } from "@/lib/db"
import { notifications, promotionTasks, promotions } from "@/lib/db/schema"
import { getEmployees } from "@/lib/data"

function dayBounds(offset: number) {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return date.toISOString().slice(0, 10)
}

export async function createPromotionNotifications() {
  const employees = await getEmployees()
  const today = dayBounds(0)
  const tomorrow = dayBounds(1)
  const tasks = await db
    .select({ id: promotionTasks.id, promotionId: promotionTasks.promotionId, sector: promotionTasks.sector, dueDate: promotionTasks.dueDate, type: promotionTasks.type, title: promotions.title, productName: promotions.productName })
    .from(promotionTasks)
    .innerJoin(promotions, eq(promotionTasks.promotionId, promotions.id))
    .where(and(gte(promotionTasks.dueDate, today), lte(promotionTasks.dueDate, tomorrow)))

  for (const employee of employees) {
    const sectors = employee.sector ? (() => { try { const parsed = JSON.parse(employee.sector); return Array.isArray(parsed) ? parsed : [employee.sector] } catch { return [employee.sector] } })() : []
    for (const task of tasks) {
      if (employee.role !== "manager" && !sectors.includes(task.sector)) continue
      const timing = task.dueDate === today ? "hoje" : "amanhã"
      const action = task.type === "start" ? "inicia" : "vence"
      const title = `Promoção ${action} ${timing}`
      const body = `${task.productName ?? task.title} — setor ${task.sector}.`
      const duplicate = await db.select({ id: notifications.id }).from(notifications).where(and(eq(notifications.userId, employee.id), eq(notifications.promotionId, task.promotionId), eq(notifications.type, `promotion-${task.type}-${timing}`))).limit(1)
      if (duplicate.length === 0) await db.insert(notifications).values({ userId: employee.id, promotionId: task.promotionId, title, body, type: `promotion-${task.type}-${timing}` })
    }
  }
}

import { NextResponse } from "next/server"
import { and, desc, eq, isNotNull, isNull } from "drizzle-orm"
import { getCurrentUser } from "@/lib/data"
import { db } from "@/lib/db"
import { promotionTasks, promotions } from "@/lib/db/schema"

export async function GET() {
  const me = await getCurrentUser()
  if (!me || me.role !== "manager") return NextResponse.json({ error: "Não autorizado" }, { status: 403 })

  const tasks = await db.select({
    id: promotionTasks.id,
    title: promotions.title,
    productName: promotions.productName,
    sector: promotionTasks.sector,
    completedByName: promotionTasks.completedByName,
    completedAt: promotionTasks.completedAt,
  }).from(promotionTasks)
    .innerJoin(promotions, eq(promotionTasks.promotionId, promotions.id))
    .where(and(eq(promotionTasks.completed, true), isNotNull(promotionTasks.completedAt), isNull(promotionTasks.verifiedAt)))
    .orderBy(desc(promotionTasks.completedAt))

  return NextResponse.json({ tasks })
}

export async function PATCH(request: Request) {
  const me = await getCurrentUser()
  if (!me || me.role !== "manager") return NextResponse.json({ error: "Não autorizado" }, { status: 403 })
  const body = await request.json().catch(() => null)
  const taskId = Number(body?.taskId)
  if (!Number.isInteger(taskId) || taskId <= 0) return NextResponse.json({ error: "Tarefa inválida" }, { status: 400 })

  await db.update(promotionTasks).set({ verifiedAt: new Date(), verifiedBy: me.id }).where(and(eq(promotionTasks.id, taskId), isNull(promotionTasks.verifiedAt)))
  return NextResponse.json({ ok: true })
}

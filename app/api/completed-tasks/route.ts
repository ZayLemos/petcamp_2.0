import { NextResponse } from "next/server"
import { and, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm"
import { getCurrentUser } from "@/lib/data"
import { db } from "@/lib/db"
import { promotionTasks, promotions } from "@/lib/db/schema"

export async function GET() {
  const me = await getCurrentUser()
  if (!me || me.role !== "manager") return NextResponse.json({ error: "Não autorizado" }, { status: 403 })

  const rows = await db.select({
    id: promotionTasks.id,
    promotionId: promotionTasks.promotionId,
    type: promotionTasks.type,
    title: promotions.title,
    productName: promotions.productName,
    sector: promotionTasks.sector,
    completedByName: promotionTasks.completedByName,
    completedAt: promotionTasks.completedAt,
  }).from(promotionTasks)
    .innerJoin(promotions, eq(promotionTasks.promotionId, promotions.id))
    .where(and(eq(promotionTasks.completed, true), isNotNull(promotionTasks.completedAt), isNull(promotionTasks.verifiedAt)))
    .orderBy(desc(promotionTasks.completedAt))

  const tasks = Array.from(rows.reduce((groups, row) => {
    const key = `${row.promotionId}-${row.type}-${row.sector}-${row.completedAt?.toISOString().slice(0, 10)}`
    const group = groups.get(key)
    if (group) {
      group.ids.push(row.id)
      group.items.push(row)
    } else {
      groups.set(key, { ...row, ids: [row.id], items: [row] })
    }
    return groups
  }, new Map<string, (typeof rows)[number] & { ids: number[]; items: typeof rows }>()).values())

  return NextResponse.json({ tasks })
}

export async function PATCH(request: Request) {
  const me = await getCurrentUser()
  if (!me || me.role !== "manager") return NextResponse.json({ error: "Não autorizado" }, { status: 403 })
  const body = await request.json().catch(() => null)
  const taskIds = Array.isArray(body?.taskIds) ? body.taskIds.map(Number).filter((id: number) => Number.isInteger(id) && id > 0) : [Number(body?.taskId)]
  if (!taskIds.length) return NextResponse.json({ error: "Grupo inválido" }, { status: 400 })

  await db.update(promotionTasks).set({ verifiedAt: new Date(), verifiedBy: me.id }).where(and(inArray(promotionTasks.id, taskIds), isNull(promotionTasks.verifiedAt)))
  return NextResponse.json({ ok: true })
}

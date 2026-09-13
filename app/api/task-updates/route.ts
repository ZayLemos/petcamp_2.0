import { NextResponse } from "next/server"
import { put } from "@vercel/blob"
import { and, desc, eq, inArray, isNull } from "drizzle-orm"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/data"
import { taskUpdates, taskUpdateReplies, user } from "@/lib/db/schema"

export async function GET() {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ error: "Não autorizado" }, { status: 403 })
  const updates = await db.select({ id: taskUpdates.id, taskId: taskUpdates.taskId, promotionId: taskUpdates.promotionId, employeeId: taskUpdates.employeeId, employeeName: user.name, sector: taskUpdates.sector, updateText: taskUpdates.updateText, photoPath: taskUpdates.photoPath, createdAt: taskUpdates.createdAt, managerReadAt: taskUpdates.managerReadAt, approvedAt: taskUpdates.approvedAt, approvedBy: taskUpdates.approvedBy }).from(taskUpdates).leftJoin(user, eq(taskUpdates.employeeId, user.id)).where(and(isNull(taskUpdates.approvedAt), me.role === "manager" ? undefined : eq(taskUpdates.employeeId, me.id))).orderBy(desc(taskUpdates.createdAt)).limit(100)
  const grouped = Array.from(updates.reduce((map, update) => {
    const dateKey = new Date(update.createdAt).toISOString().slice(0, 10)
    const key = `${update.taskId}-${dateKey}`
    const existing = map.get(key)
    if (existing) {
      existing.updateText = `${existing.updateText}; ${update.updateText}`
      existing.ids.push(update.id)
      if (!update.managerReadAt) existing.managerReadAt = null
    } else {
      map.set(key, { ...update, ids: [update.id], updateText: update.updateText })
    }
    return map
  }, new Map<string, (typeof updates)[number] & { ids: number[] }>()).values())
  const replies = await db.select().from(taskUpdateReplies).orderBy(taskUpdateReplies.createdAt)
  return NextResponse.json({ updates: grouped, replies, isManager: me.role === "manager" })
}

export async function POST(request: Request) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ error: "Não autorizado" }, { status: 403 })
  const form = await request.formData()
  const updateId = Number(form.get("updateId"))
  const message = String(form.get("message") || "").trim()
  const file = form.get("photo")
  if (!Number.isInteger(updateId) || !message) return NextResponse.json({ error: "Mensagem inválida" }, { status: 400 })
  const photoPath = file instanceof File && file.size > 0 ? (await put(`task-updates/${me.id}/${crypto.randomUUID()}-${file.name}`, file, { access: "private" })).pathname : null
  const [reply] = await db.insert(taskUpdateReplies).values({ updateId, authorId: me.id, authorName: me.name, message, photoPath }).returning()
  return NextResponse.json({ reply })
}

export async function PATCH(request: Request) {
  const me = await getCurrentUser()
  if (!me || me.role !== "manager") return NextResponse.json({ error: "Não autorizado" }, { status: 403 })
  const { updateId, action = "read" } = await request.json()
  const ids = Array.isArray(updateId) ? updateId.map(Number).filter(Number.isInteger) : [Number(updateId)]
  await db.update(taskUpdates).set(action === "approve" ? { managerReadAt: new Date(), approvedAt: new Date(), approvedBy: me.id } : { managerReadAt: new Date() }).where(inArray(taskUpdates.id, ids))
  return NextResponse.json({ ok: true })
}

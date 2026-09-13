import { NextResponse } from "next/server"
import { put } from "@vercel/blob"
import { and, desc, eq, inArray, isNull } from "drizzle-orm"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/data"
import { taskUpdates, taskUpdateReplies, user } from "@/lib/db/schema"

export async function GET(request: Request) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ error: "Não autorizado" }, { status: 403 })
  const conditions = me.role === "manager"
    ? isNull(taskUpdates.approvedAt)
    : and(isNull(taskUpdates.approvedAt), eq(taskUpdates.employeeId, me.id))
  const updates = await db.select({ id: taskUpdates.id, taskId: taskUpdates.taskId, promotionId: taskUpdates.promotionId, employeeId: taskUpdates.employeeId, employeeName: user.name, sector: taskUpdates.sector, updateText: taskUpdates.updateText, photoPath: taskUpdates.photoPath, createdAt: taskUpdates.createdAt, managerReadAt: taskUpdates.managerReadAt, approvedAt: taskUpdates.approvedAt, approvedBy: taskUpdates.approvedBy }).from(taskUpdates).leftJoin(user, eq(taskUpdates.employeeId, user.id)).where(conditions).orderBy(desc(taskUpdates.createdAt)).limit(100)
  const grouped = Array.from(updates.reduce((map, update) => {
    const dateKey = new Date(update.createdAt).toISOString().slice(0, 10)
    const key = dateKey
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
  const idsParam = new URL(request.url).searchParams.get("updateIds")
  const replyIds = idsParam ? idsParam.split(",").map(Number).filter(Number.isInteger) : []
  const replies = replyIds.length ? await db.select().from(taskUpdateReplies).where(inArray(taskUpdateReplies.updateId, replyIds)).orderBy(taskUpdateReplies.createdAt) : []
  return NextResponse.json({ updates: grouped, replies, isManager: me.role === "manager" })
}

export async function POST(request: Request) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ error: "Não autorizado" }, { status: 403 })
  const form = await request.formData()
  const updateId = Number(form.get("updateId"))
  const message = String(form.get("message") || "").trim()
  const file = form.get("photo")
  const hasPhoto = file instanceof File && file.size > 0
  if (!Number.isInteger(updateId) || (!message && !hasPhoto)) return NextResponse.json({ error: "Mensagem ou foto obrigatória" }, { status: 400 })
  if (hasPhoto && (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024)) return NextResponse.json({ error: "A foto deve ser uma imagem de até 5 MB" }, { status: 400 })
  const photoPath = hasPhoto ? (await put(`task-updates/${me.id}/${crypto.randomUUID()}.webp`, file, { access: "private" })).pathname : null
  const [reply] = await db.insert(taskUpdateReplies).values({ updateId, authorId: me.id, authorName: me.name, message, photoPath }).returning()
  return NextResponse.json({ reply })
}

export async function PATCH(request: Request) {
  const me = await getCurrentUser()
  if (!me || me.role !== "manager") return NextResponse.json({ error: "Não autorizado" }, { status: 403 })
  const { updateId, action = "read" } = await request.json()
  const ids = Array.isArray(updateId) ? updateId.map(Number).filter(Number.isInteger) : [Number(updateId)]
  if (action === "approve") {
    await db.delete(taskUpdateReplies).where(inArray(taskUpdateReplies.updateId, ids))
    await db.delete(taskUpdates).where(inArray(taskUpdates.id, ids))
  } else {
    await db.update(taskUpdates).set({ managerReadAt: new Date() }).where(inArray(taskUpdates.id, ids))
  }
  return NextResponse.json({ ok: true })
}

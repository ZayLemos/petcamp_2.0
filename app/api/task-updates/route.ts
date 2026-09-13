import { NextResponse } from "next/server"
import { put } from "@vercel/blob"
import { and, desc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/data"
import { taskUpdates, taskUpdateReplies, user } from "@/lib/db/schema"

export async function GET() {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ error: "Não autorizado" }, { status: 403 })
  const updates = await db.select({ id: taskUpdates.id, taskId: taskUpdates.taskId, promotionId: taskUpdates.promotionId, employeeId: taskUpdates.employeeId, employeeName: user.name, sector: taskUpdates.sector, updateText: taskUpdates.updateText, photoPath: taskUpdates.photoPath, createdAt: taskUpdates.createdAt, managerReadAt: taskUpdates.managerReadAt }).from(taskUpdates).leftJoin(user, eq(taskUpdates.employeeId, user.id)).where(me.role === "manager" ? undefined : eq(taskUpdates.employeeId, me.id)).orderBy(desc(taskUpdates.createdAt)).limit(100)
  const replies = await db.select().from(taskUpdateReplies).orderBy(taskUpdateReplies.createdAt)
  return NextResponse.json({ updates, replies })
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
  const { updateId } = await request.json()
  await db.update(taskUpdates).set({ managerReadAt: new Date() }).where(and(eq(taskUpdates.id, Number(updateId))))
  return NextResponse.json({ ok: true })
}

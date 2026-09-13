"use server"

import * as XLSX from "xlsx"
import { db } from "@/lib/db"
import { promotions, promotionTasks, notifications, user, pushSubscriptions, taskUpdates } from "@/lib/db/schema"
import { getCurrentUser } from "@/lib/data"
import { normalizeSector } from "@/lib/sectors"
import { sendPushToUser } from "@/lib/push"
import { and, eq, inArray, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"

async function requireManager() {
  const me = await getCurrentUser()
  if (!me || me.role !== "manager") throw new Error("Apenas o gerente pode fazer isso.")
  return me
}

// Limpa acentos, espaços extras e caracteres invisíveis do Excel (BOM)
function normalizeHeader(value: string): string {
  if (!value) return ""
  return value
    .toString()
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ºª]/g, "")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
}

// Busca as colunas na planilha baseado no cabeçalho limpo
function pick(row: Record<string, any>, keys: string[]): string {
  const normalizedRow: Record<string, any> = {}
  for (const k of Object.keys(row)) {
    normalizedRow[normalizeHeader(k)] = row[k]
  }
  for (const key of keys) {
    const v = normalizedRow[normalizeHeader(key)]
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim()
  }
  return ""
}

// Converte a data brasileira (dd/mm/yyyy) do seu CSV para o padrão YYYY-MM-DD do banco
function toISODate(value: string): string | null {
  if (!value) return null
  const num = Number(value)
  if (!Number.isNaN(num) && num > 20000 && num < 90000) {
    const parsed = XLSX.SSF.parse_date_code(num)
    if (parsed) {
      const mm = String(parsed.m).padStart(2, "0")
      const dd = String(parsed.d).padStart(2, "0")
      return `${parsed.y}-${mm}-${dd}`
    }
  }
  
  const br = value.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/)
  if (br) {
    let [, d, m, y] = br
    if (y.length === 2) y = "20" + y
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
  }
  
  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (iso) {
    const [, y, m, d] = iso
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
  }
  return null
}

function toPrice(value: string): string | null {
  if (!value) return null
  const cleaned = value.replace(/[R$\s]/g, "").replace(/\.(?=\d{3})/g, "").replace(",", ".")
  const n = Number(cleaned)
  return Number.isNaN(n) ? null : n.toFixed(2)
}

export type ImportResult = {
  ok: boolean
  imported: number
  errors: string[]
}

export async function importPromotionsFromExcel(formData: FormData): Promise<ImportResult> {
  const me = await requireManager()
  const file = formData.get("file") as File | null
  if (!file) return { ok: false, imported: 0, errors: ["Nenhum arquivo enviado."] }

  const buffer = Buffer.from(await file.arrayBuffer())
  const extension = file.name.toLowerCase().split(".").pop()
  if (extension !== "xlsx" && extension !== "csv") {
    return { ok: false, imported: 0, errors: ["Formato inválido. Envie um arquivo .xlsx ou .csv."] }
  }

  let rows: Record<string, any>[]
  try {
    const options: any = { type: "buffer", cellDates: true }

    if (extension === "csv") {
      const conteudoTexto = buffer.toString("utf-8")
      const primeiraLinha = conteudoTexto.split(/\r?\n/, 1)[0] ?? ""
      options.FS = (primeiraLinha.match(/;/g) ?? []).length >= (primeiraLinha.match(/,/g) ?? []).length ? ";" : ","
      options.codepage = 65001
    }

    const wb = XLSX.read(buffer, options)
    rows = wb.SheetNames.flatMap((sheetName) => {
      const sheetRows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "" }) as Record<string, any>[]
      return sheetRows.map((row) => ({ ...row, __sheet: sheetName }))
    })
  } catch (e) {
    console.error("Erro na leitura física do XLSX/CSV:", e)
    return { ok: false, imported: 0, errors: ["Não foi possível ler a planilha."] }
  }

  const errors: string[] = []
  let imported = 0
  const affectedSectors = new Set<string>()

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const line = i + 2
    
    // Mapeamento direto batendo com os cabeçalhos em português enviados
    const productName = pick(row, ["produto", "item"])
    const title = pick(row, ["tipo", "titulo"]) || "Promoção"
    const sectorRaw = pick(row, ["setor", "sector"])
    const startRaw = pick(row, ["inicio", "data inicio"])
    const endRaw = pick(row, ["termino", "data fim"])
    const oldPriceRaw = pick(row, ["preco antigo", "preco original"])
    const newPriceRaw = pick(row, ["preco novo", "preco promocional"])

    if (!productName && !sectorRaw && !startRaw && !endRaw) continue

    if (!sectorRaw) {
      errors.push(`Linha ${line}: Coluna de setor ausente.`)
      continue
    }

    const startDate = toISODate(startRaw)
    const endDate = toISODate(endRaw)

    if (!startDate) {
      errors.push(`Linha ${line}: Data de início inválida ("${startRaw}").`)
      continue
    }
    if (!endDate) {
      errors.push(`Linha ${line}: Data de término inválida ("${endRaw}").`)
      continue
    }

    let sector = sectorRaw
    try {
      sector = normalizeSector(sectorRaw)
    } catch (e) {
      // Fallback seguro caso o setor não encontre match rígido no sistema
    }

    const oldPrice = toPrice(oldPriceRaw)
    const newPrice = toPrice(newPriceRaw)

    try {
      const [promo] = await db
        .insert(promotions)
        .values({
          title,
          productName: productName || null,
          sector,
          oldPrice,
          newPrice,
          startDate,
          endDate,
          createdBy: me.id,
        })
        .returning({ id: promotions.id })

      await db.insert(promotionTasks).values([
        { promotionId: promo.id, type: "start", sector, dueDate: startDate },
        { promotionId: promo.id, type: "end", sector, dueDate: endDate },
      ])

      affectedSectors.add(sector)
      imported++
    } catch (dbError: any) {
      console.error(`Erro na inserção da linha ${line}:`, dbError)
      errors.push(`Linha ${line}: Falha ao salvar no banco de dados.`)
    }
  }

  if (affectedSectors.size > 0) {
    try {
      const sectors = Array.from(affectedSectors)
      const employees = await db
        .select({ id: user.id, sector: user.sector })
        .from(user)
        .where(inArray(user.sector, sectors))

      for (const emp of employees) {
        if (!emp.sector) continue
        await db.insert(notifications).values({
          userId: emp.id,
          title: "Novas promoções agendadas",
          body: `Foram adicionadas promoções para o setor ${emp.sector}.`,
          type: "new_promotions",
        })
        await sendPushToUser(emp.id, {
          title: "Novas promoções agendadas",
          body: `Há novas promoções para o setor ${emp.sector}.`,
          url: "/painel",
        })
      }
    } catch (err) {
      console.error("Erro ao enviar notificações:", err)
    }
  }

  revalidatePath("/gerente")
  revalidatePath("/painel")
  revalidatePath("/calendario")
  
  return { ok: errors.length === 0, imported, errors }
}

export async function deletePromotion(promotionId: string) {
  const me = await requireManager()
  await db.delete(promotions).where(and(eq(promotions.id, Number(promotionId)), eq(promotions.createdBy, me.id)))
  revalidatePath("/gerente")
  revalidatePath("/painel")
  revalidatePath("/calendario")
}

const MANAGER_CODE = process.env.MANAGER_ACCESS_CODE ?? "petcamp-gerente"

export async function promoteToManager(code: string) {
  const me = await getCurrentUser()
  if (!me) throw new Error("Não autenticado.")
  if (code.trim() !== MANAGER_CODE) return { ok: false, error: "Código de gerente incorreto." }
  await db.update(user).set({ role: "manager" }).where(eq(user.id, me.id))
  revalidatePath("/", "layout")
  return { ok: true }
}

export async function toggleTaskCompletion(formData: FormData) {
  const taskId = Number(formData.get("taskId"))
  if (!Number.isInteger(taskId) || taskId <= 0) throw new Error("Tarefa inválida.")
  const me = await getCurrentUser()
  if (!me) throw new Error("Não autenticado.")
  const task = await db.select({ id: promotionTasks.id, promotionId: promotionTasks.promotionId, sector: promotionTasks.sector, title: promotions.title, productName: promotions.productName }).from(promotionTasks).innerJoin(promotions, eq(promotionTasks.promotionId, promotions.id)).where(eq(promotionTasks.id, taskId)).limit(1)
  if (!task[0]) throw new Error("Tarefa não encontrada.")
  const allowedSectors = me.sector ? (() => { try { const parsed = JSON.parse(me.sector); return (Array.isArray(parsed) ? parsed : [me.sector]).flatMap((item) => { const value = String(item); const normalized = value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); return normalized.includes("sache") && normalized.includes("gato") ? ["Sachês gatos", "Sachês para gatos"] : normalized.includes("sache") && (normalized.includes("cao") || normalized.includes("cachorro")) ? ["Sachês cães", "Sachês para cães"] : [value] }) } catch { return [me.sector] } })() : []
  if (me.role !== "manager" && !allowedSectors.includes(task[0].sector)) throw new Error("Você não pode concluir esta tarefa.")
  await db.update(promotionTasks).set({ completed: sql`NOT ${promotionTasks.completed}`, completedBy: me.id, completedByName: me.name, completedAt: new Date() }).where(eq(promotionTasks.id, taskId))
  if (me.role !== "manager") {
    await db.insert(taskUpdates).values({ taskId, promotionId: task[0].promotionId, employeeId: me.id, sector: task[0].sector, updateText: `Tarefa concluída: ${task[0].productName || task[0].title}` })
  }
  revalidatePath("/gerente")
  revalidatePath("/painel")
  revalidatePath("/calendario")
}

export async function completeTasks(formData: FormData) {
  const ids = String(formData.get("taskIds") ?? "").split(",").map(Number).filter((id) => Number.isInteger(id) && id > 0)
  if (ids.length === 0) throw new Error("Nenhuma tarefa selecionada.")
  const me = await getCurrentUser()
  if (!me) throw new Error("Não autenticado.")
  const rows = await db.select({ id: promotionTasks.id, promotionId: promotionTasks.promotionId, sector: promotionTasks.sector }).from(promotionTasks).where(inArray(promotionTasks.id, ids))
  const allowedSectors = me.sector ? (() => { try { const parsed = JSON.parse(me.sector); return (Array.isArray(parsed) ? parsed : [me.sector]).flatMap((item) => { const value = String(item); const normalized = value.toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, ""); return normalized.includes("sache") && (normalized.includes("gato") || normalized.includes("cat")) ? ["Sachês gatos", "Sachês para gatos"] : normalized.includes("sache") && (normalized.includes("cao") || normalized.includes("cachorro") || normalized.includes("dog")) ? ["Sachês cães", "Sachês para cães"] : [value] }) } catch { return [me.sector] } })() : []
  const permitted = rows.filter((row) => me.role === "manager" || allowedSectors.includes(row.sector)).map((row) => row.id)
  if (permitted.length > 0) {
    await db.update(promotionTasks).set({ completed: true, completedBy: me.id, completedByName: me.name, completedAt: new Date() }).where(inArray(promotionTasks.id, permitted))
    if (me.role !== "manager") await db.insert(taskUpdates).values(permitted.map((id) => { const row = rows.find((item) => item.id === id)!; return { taskId: row.id, promotionId: row.promotionId, employeeId: me.id, sector: row.sector, updateText: "Tarefa concluída em lote" } }))
  }
  revalidatePath("/gerente")
  revalidatePath("/painel")
  revalidatePath("/calendario")
}

function parseAllowedSectors(value: string | null) {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.map(String) : [value]
  } catch {
    return [value]
  }
}

export async function deleteOwnTask(formData: FormData) {
  const taskId = Number(formData.get("taskId"))
  const promotionId = Number(formData.get("promotionId"))
  const me = await getCurrentUser()
  if (!me || (!Number.isInteger(taskId) && !Number.isInteger(promotionId))) throw new Error("Item inválido.")
  const task = await db.select({ id: promotionTasks.id, promotionId: promotionTasks.promotionId, sector: promotionTasks.sector }).from(promotionTasks).where(Number.isInteger(promotionId) ? eq(promotionTasks.promotionId, promotionId) : eq(promotionTasks.id, taskId)).limit(1)
  if (!task[0]) throw new Error("Tarefa não encontrada.")
  if (me.role !== "manager" && !parseAllowedSectors(me.sector).includes(task[0].sector)) throw new Error("Você não pode alterar esta tarefa.")
  await db.delete(promotionTasks).where(eq(promotionTasks.promotionId, task[0].promotionId))
  revalidatePath("/painel")
  revalidatePath("/calendario")
}

export async function moveOwnTask(formData: FormData) {
  const taskId = Number(formData.get("taskId"))
  const promotionId = Number(formData.get("promotionId"))
  const destination = String(formData.get("destination") ?? "").trim()
  const me = await getCurrentUser()
  if (!me || (!Number.isInteger(taskId) && !Number.isInteger(promotionId)) || !destination) throw new Error("Dados inválidos.")
  const task = await db.select({ id: promotionTasks.id, promotionId: promotionTasks.promotionId, sector: promotionTasks.sector }).from(promotionTasks).where(Number.isInteger(promotionId) ? eq(promotionTasks.promotionId, promotionId) : eq(promotionTasks.id, taskId)).limit(1)
  if (!task[0]) throw new Error("Tarefa não encontrada.")
  if (me.role !== "manager" && !parseAllowedSectors(me.sector).includes(task[0].sector)) throw new Error("Você não pode alterar esta tarefa.")
  await db.update(promotionTasks).set({ sector: destination }).where(eq(promotionTasks.promotionId, task[0].promotionId))
  revalidatePath("/painel")
  revalidatePath("/calendario")
}

export async function updateSector(sector: string) {
  const me = await getCurrentUser()
  if (!me) throw new Error("Não autenticado.")
  if (!sector.trim()) return { ok: false, error: "Selecione ao menos uma opção." }
  await db.update(user).set({ sector: sector.trim() }).where(eq(user.id, me.id))
  revalidatePath("/", "layout")
  return { ok: true }
}

type BrowserSubscription = { endpoint: string; keys: { p256dh: string; auth: string } }

export async function savePushSubscription(sub: BrowserSubscription) {
  const me = await getCurrentUser()
  if (!me) throw new Error("Não autenticado.")
  const existing = await db.select({ id: pushSubscriptions.id }).from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, sub.endpoint)).limit(1)
  if (existing.length > 0) {
    await db.update(pushSubscriptions).set({ userId: me.id, keys: sub.keys }).where(eq(pushSubscriptions.endpoint, sub.endpoint))
  } else {
    await db.insert(pushSubscriptions).values({ userId: me.id, endpoint: sub.endpoint, keys: sub.keys })
  }
  return { ok: true }
}

export async function removePushSubscription(endpoint: string) {
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint))
  return { ok: true }
}

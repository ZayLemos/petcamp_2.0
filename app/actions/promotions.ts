"use server"

import * as XLSX from "xlsx"
import { db } from "@/lib/db"
import { promotions, promotionTasks, notifications, user } from "@/lib/db/schema"
import { getCurrentUser } from "@/lib/data"
import { normalizeSector } from "@/lib/sectors"
import { sendPushToUser } from "@/lib/push"
import { and, eq, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"

async function requireManager() {
  const me = await getCurrentUser()
  if (!me || me.role !== "manager") throw new Error("Apenas o gerente pode fazer isso.")
  return me
}

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
  if (value.includes("%")) {
    const p = parseFloat(value.replace("%", ""))
    return Number.isNaN(p) ? "0.00" : (p / 100).toFixed(2)
  }
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
      const primeiraLinha = conteudoTexto.split(/\r?\n/) || ""
      options.FS = primeiraLinha.includes(";") ? ";" : ","
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
  const affectedSectors = new Set<string>()
  const promotionsToInsert: any[] = []
  const tasksToInsert: any[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const line = i + 2
    
    const productName = pick(row, ["produto", "produto ", "item"])
    const title = pick(row, ["tipo", "titulo"]) || "Promoção"
    const sectorRaw = pick(row, ["setor", "sector"])
    const startRaw = pick(row, ["datainicio", "inicio"])
    const endRaw = pick(row, ["datafinal", "termino", "fim"])
    const oldPriceRaw = pick(row, ["arg1", "preco antigo"])
    const newPriceRaw = pick(row, ["arg2", "preco novo"])

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
    } catch (e) {}

    const oldPrice = toPrice(oldPriceRaw)
    const newPrice = toPrice(newPriceRaw)

    promotionsToInsert.push({
      title,
      productName: productName || null,
      sector,
      oldPrice,
      newPrice,
      startDate,
      endDate,
      createdBy: me.id,
    })

    affectedSectors.add(sector)
  }

  let importedCount = 0
  if (promotionsToInsert.length > 0) {
    try {
      const insertedPromos = await db
        .insert(promotions)
        .values(promotionsToInsert)
        .returning({ id: promotions.id, sector: promotions.sector, startDate: promotions.startDate, endDate: promotions.endDate })

      insertedPromos.forEach((promo) => {
        tasksToInsert.push({ promotionId: promo.id, type: "start", sector: promo.sector, dueDate: promo.startDate })
        tasksToInsert.push({ promotionId: promo.id, type: "end", sector: promo.sector, dueDate: promo.endDate })
      })

      if (tasksToInsert.length > 0) {
        await db.insert(promotionTasks).values(tasksToInsert)
      }

      importedCount = insertedPromos.length
    } catch (bulkError: any) {
      console.error("Erro no Bulk Insert do banco de dados:", bulkError)
      return { ok: false, imported: 0, errors: ["Erro crítico ao salvar o lote no banco."] }
    }
  }

  if (affectedSectors.size > 0 && importedCount > 0) {
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
          body: `Foram adicionadas promoções em lote para o seu setor.`,
          type: "new_promotions",
        })
        await sendPushToUser(emp.id, {
          title: "Novas promoções agendadas",
          body: `Há novas promoções em lote para o seu setor.`,
          url: "/painel",
        })
      }
    } catch (err) {}
  }

  revalidatePath("/gerente")
  revalidatePath("/painel")
  revalidatePath("/calendario")
  
  return { ok: errors.length === 0, imported: importedCount, errors }
}

export async function deletePromotion(promotionId: string) {
  const me = await requireManager()
  await db.delete(promotions).where(and(eq(promotions.id, promotionId), eq(promotions.createdBy, me.id)))
  revalidatePath("/gerente")
  revalidatePath("/painel")
  revalidatePath("/calendario")
}

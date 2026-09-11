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
  try {
    const me = await requireManager()
    const file = formData.get("file") as File | null
    if (!file) return { ok: false, imported: 0, errors: ["Nenhum arquivo enviado."] }

    const buffer = Buffer.from(await file.arrayBuffer())
    const extension = file.name.toLowerCase().split(".").pop()
    
    let rows: Record<string, any>[]
    const options: any = { type: "buffer", cellDates: true }

    if (extension === "csv") {
      const conteudoTexto = buffer.toString("utf-8")
      const primeiraLinha = conteudoTexto.split(/\r?\n/)[0] || ""
      options.FS = primeiraLinha.includes(";") ? ";" : ","
    }

    const wb = XLSX.read(buffer, options)
    rows = wb.SheetNames.flatMap((sheetName) => {
      return XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "" }) as Record<string, any>[]
    })

    const affectedSectors = new Set<string>()
    const promotionsToInsert: any[] = []
    const tasksToInsert: any[] = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      
      const productName = pick(row, ["produto", "produto ", "item"])
      const title = pick(row, ["tipo", "titulo"]) || "Promoção"
      const sectorRaw = pick(row, ["setor", "sector"])
      const startRaw = pick(row, ["datainicio", "inicio"])
      const endRaw = pick(row, ["datafinal", "termino", "fim"])
      const oldPriceRaw = pick(row, ["arg1", "preco antigo"])
      const newPriceRaw = pick(row, ["arg2", "preco novo"])

      if (!productName && !sectorRaw && !startRaw && !endRaw) continue

      const startDate = toISODate(startRaw)
      const endDate = toISODate(endRaw)
      if (!startDate || !endDate) continue

      let sector = sectorRaw
      try {
        sector = normalizeSector(sectorRaw)
      } catch (e) {}

      promotionsToInsert.push({
        title,
        productName: productName || null,
        sector,
        oldPrice: toPrice(oldPriceRaw),
        newPrice: toPrice(newPriceRaw),
        startDate,
        endDate,
        createdBy: me.id,
      })

      affectedSectors.add(sector)
    }

    let importedCount = 0
    if (promotionsToInsert.length > 0) {
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
    }

    revalidatePath("/gerente")
    return { ok: true, imported: importedCount, errors: [] }
  } catch (error: any) {
    console.error(error)
    return { ok: false, imported: 0, errors: [error.message || "Erro desconhecido"] }
  }
}

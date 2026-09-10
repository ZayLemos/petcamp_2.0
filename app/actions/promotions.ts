"use server"

import * as XLSX from "xlsx"
import { db } from "@/lib/db"
import { promotions, promotionTasks, notifications, user } from "@/lib/db/schema"
import { getCurrentUser } from "@/lib/data"
import { normalizeSector } from "@/lib/sectors"
import { sendPushToUser } from "@/lib/push"
import { eq, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"

async function requireManager() {
  const me = await getCurrentUser()
  if (!me) throw new Error("Usuário não está autenticado no sistema (Sessão inválida).")
  if (me.role !== "manager") throw new Error(`Seu usuário tem permissão "${me.role}", mas apenas "manager" pode importar.`);
  return me
}

// Intercepta e limpa acentuações e espaços para encontrar o cabeçalho correto na linha
function pick(row: Record<string, any>, keys: string[]): string {
  const normalizedRow: Record<string, any> = {}
  for (const k of Object.keys(row)) {
    // Normaliza os nomes das chaves (ex: "preço padrão" vira "preco padrao")
    const normalizedKey = k.trim().toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove acentos
    normalizedRow[normalizedKey] = row[k]
  }
  for (const key of keys) {
    const normalizedTargetKey = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    const v = normalizedRow[normalizedTargetKey]
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim()
  }
  return ""
}

// Converte datas no formato brasileiro (DD/MM/YYYY) vindas do seu CSV para ISO (YYYY-MM-DD)
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
  // Mapeia o formato DD/MM/YYYY enviado no seu arquivo
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
  const dt = new Date(value)
  if (!Number.isNaN(dt.getTime())) return dt.toISOString().slice(0, 10)
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
  const errors: string[] = []
  try {
    const me = await requireManager()
    const file = formData.get("file") as File | null
    if (!file) return { ok: false, imported: 0, errors: ["Nenhum arquivo enviado."] }

    const fileNameLower = file.name.toLowerCase()
    const buffer = Buffer.from(await file.arrayBuffer())
    let rows: Record<string, any>[] = []
    
    if (fileNameLower.endsWith(".csv") || file.type === "text/csv") {
      // Lê o conteúdo bruto de texto e normaliza quebras de linha brasileiras do Excel
      const csvString = buffer.toString("utf-8").replace(/\r\n/g, "\n").replace(/\r/g, "\n")
      
      // Força a biblioteca XLSX a usar estritamente o ponto e vírgula como separador estrutural
      const wb = XLSX.read(Buffer.from(csvString, "utf-8"), { 
        type: "buffer", 
        codepage: 65001, // Suporte nativo a acentuação UTF-8
        FS: ";"          // <--- Define ponto e vírgula como separador fixo obrigatório
      })
      
      rows = wb.SheetNames.flatMap((sheetName) => {
        return XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "", raw: false }) as Record<string, any>[]
      })
    } else {
      const wb = XLSX.read(buffer, { type: "buffer", cellDates: true })
      rows = wb.SheetNames.flatMap((sheetName) => {
        return XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "" }) as Record<string, any>[]
      })
    }

    if (!rows || rows.length === 0) {
      return { ok: false, imported: 0, errors: ["Nenhuma linha de dados encontrada de forma legível dentro do arquivo."] }
    }

    let imported = 0
    const affectedSectors = new Set<string>()

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const line = i + 2
      
      // Mapeamento idêntico às colunas reais do arquivo enviado
      const title = pick(row, ["tipo", "promo flex", "titulo", "promocao"])
      const productName = pick(row, ["produto", "descricao", "item"])
      const sectorRaw = pick(row, ["setor", "categoria2", "sector"])
      const startRaw = pick(row, ["datainicio", "data inicio", "inicio"])
      const endRaw = pick(row, ["datafinal", "data termino", "termino"])

      if (!title && !productName && !sectorRaw && !startRaw && !endRaw) continue

      if (!sectorRaw) {
        errors.push(`Linha ${line} [${productName || "Sem Nome"}]: Setor ausente ou ilegível.`)
        continue
      }
      
      const startDate = toISODate(startRaw)
      const endDate = toISODate(endRaw)
      
      if (!startDate) {
        errors.push(`Linha ${line} [${productName || "Sem Nome"}]: Data inicial inválida ("${startRaw}").`)
        continue
      }
      if (!endDate) {
        errors.push(`Linha ${line} [${productName || "Sem Nome"}]: Data final inválida ("${endRaw}").`)
        continue
      }

      const sector = normalizeSector(sectorRaw)
      const oldPrice = toPrice(pick(row, ["preço padrão", "preçopadrao", "preco antigo"]))
      const newPrice = toPrice(pick(row, ["preço promocional", "preçopromocional", "preco novo"]))

      // Insere no banco
      const [promo] = await db
        .insert(promotions)
        .values({
          title: title || productName || "Promoção",
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
    }

    if (affectedSectors.size > 0) {
      const sectors = Array.from(affectedSectors)
      const employees = await db
        .select({ id: user.id, sector: user.sector })
        .from(user)
        .where(inArray(user.sector, sectors))

      for (const emp of employees) {
        await db.insert(notifications).values({
          userId: emp.id,
          title: "Novas promoções agendadas",
          body: `Foram adicionadas promoções para o setor ${emp.sector}.`,
          type: "new_promotions",
        })
        try {
          await sendPushToUser(emp.id, {
            title: "Novas promoções agendadas",
            body: `Há novas promoções para o setor ${emp.sector}.`,
            url: "/painel",
          })
        } catch (pushErr) {
          console.error(pushErr)
        }
      }
    }

    revalidatePath("/gerente")
    revalidatePath("/painel")
    revalidatePath("/calendario")
    
    return { ok: imported > 0, imported, errors }

  } catch (globalError: any) {
    return { ok: false, imported: 0, errors: [globalError?.message || "Erro desconhecido."] }
  }
}

export async function approvePromotion(promotionId: number) {
  await requireManager()
  await db.update(promotions).set({ approved: true, approvedAt: new Date() }).where(eq(promotions.id, promotionId))
  revalidatePath("/gerente")
  revalidatePath("/calendario")
}

export async function unapprovePromotion(promotionId: number) {
  await requireManager()
  await db.update(promotions).set({ approved: false, approvedAt: null }).where(eq(promotions.id, promotionId))
  revalidatePath("/gerente")
  revalidatePath("/calendario")
}

export async function deletePromotion(promotionId: number) {
  await requireManager()
  await db.delete(promotionTasks).where(eq(promotionTasks.promotionId, promotionId))
  await db.delete(promotions).where(eq(promotions.id, promotionId))
  revalidatePath("/gerente")
  revalidatePath("/painel")
  revalidatePath("/calendario")
}

export async function completeTask(taskId: number) {
  const me = await getCurrentUser()
  if (!me) throw new Error("Não autenticado.")
}

"use server"

import * as XLSX from "xlsx"
import { generateText, gateway } from "ai"
import { db } from "@/lib/db"
import { promotions, promotionTasks, notifications, user } from "@/lib/db/schema"
import { getCurrentUser } from "@/lib/data"
import { normalizeSector, SECTORS } from "@/lib/sectors"
import { sendPushToUser } from "@/lib/push"
import { and, eq, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"

async function requireManager() {
  const me = await getCurrentUser()
  if (!me || me.role !== "manager") throw new Error("Apenas o gerente pode fazer isso.")
  return me
}

// Encontra o valor de uma linha testando várias chaves possíveis (planilha flexível).
function normalizeHeader(value: string): string {
  return value
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
  for (const k of Object.keys(row)) normalizedRow[normalizeHeader(k)] = row[k]
  for (const key of keys) {
    const v = normalizedRow[normalizeHeader(key)]
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim()
  }
  return ""
}

// Converte datas do Excel (serial number ou texto) para YYYY-MM-DD.
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
  // dd/mm/yyyy ou dd-mm-yyyy
  const br = value.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/)
  if (br) {
    let [, d, m, y] = br
    if (y.length === 2) y = "20" + y
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
  }
  // yyyy-mm-dd
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

    // 📊 RESOLUÇÃO DO CONFLITO DO CSV: Detecta se o arquivo usa separador por vírgula ou ponto e vírgula
    if (extension === "csv") {
      const conteudoTexto = buffer.toString("utf-8")
      const primeiraLinha = conteudoTexto.split(/\r?\n/) || ""
      const separadorDetectado = primeiraLinha.includes(";") ? ";" : ","
      options.FS = separadorDetectado
    }

    const wb = XLSX.read(buffer, options)
    rows = wb.SheetNames.flatMap((sheetName) => {
      const sheetRows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "" }) as Record<string, any>[]
      return sheetRows.map((row) => ({ ...row, __sheet: sheetName }))
    })
  } catch (e) {
    console.error("Erro na leitura física do XLSX/CSV:", e)
    return { ok: false, imported: 0, errors: ["Não foi possível ler a planilha. Envie um arquivo .xlsx ou .csv válido."] }
  }

  const errors: string[] = []
  let imported = 0
  const affectedSectors = new Set<string>()

  let aiRows = rows
  try {
    // Atualizado para o modelo correto estável do SDK (gpt-4o-mini)
    const { text } = await generateText({
      model: gateway("openai/gpt-4o-mini"),
      system: `Você é um validador de planilhas da PetCamp. Leia todas as linhas recebidas, preserve uma linha por item e normalize os campos. Para cada linha retorne JSON com: originalLine (número), title, productName, sector, startDate, endDate, oldPrice, newPrice. Sector deve ser exatamente um destes: ${JSON.stringify(SECTORS)}. Não invente datas; use null quando estiverem ausentes. Responda somente com um array JSON válido.`,
      prompt: JSON.stringify(rows),
    })
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed) && parsed.length === rows.length) {
      aiRows = rows.map((original, index) => {
        const reviewed = parsed[index]
        if (!reviewed || typeof reviewed !== "object") return original
        return { ...original, ...reviewed }
      })
    }
  } catch (error) {
    // 🛡️ CORREÇÃO DE SEGURANÇA: Se a IA der erro por conta do modelo antigo gpt-5 do v0, 
    // os dados puros locais continuam ativos e não quebram o código.
    console.error("[v0] Falha na revisão da planilha por IA; usando leitura local estável:", error)
    aiRows = rows
  }

  for (let i = 0; i < aiRows.length; i++) {
    const row = aiRows[i]
    const lineValue = pick(row, ["originalLine", "linha original", "linha", "line"])
    const line = lineValue ? Number(lineValue) || i + 2 : i + 2
    const title = pick(row, ["título", "titulo", "promoção", "promocao", "nome", "produto", "title"])
    const productName = pick(row, ["produto", "item", "nome do produto", "productName", "product"])
    const sectorRaw = pick(row, ["setor", "sector", "departamento", "área", "area"])
    const startRaw = pick(row, ["início", "inicio", "data início", "data inicio", "data_inicio", "start", "startDate", "data de início"])
    const endRaw = pick(row, ["término", "termino", "fim", "data fim", "data término", "data_fim", "end", "endDate", "data de término"])

    if (!title && !productName && !sectorRaw && !startRaw && !endRaw) continue // linha vazia

    if (!sectorRaw) {
      errors.push(`Linha ${line}: setor ausente.`)
      continue
    }
    const startDate = toISODate(startRaw)
    const endDate = toISODate(endRaw)
    if (!startDate) {
      errors.push(`Linha ${line}: data de início inválida ("${startRaw}").`)
      continue
    }
    if (!endDate) {
      errors.push(`Linha ${line}: data de término inválida ("${endRaw}").`)
      continue
    }

    const sector = normalizeSector(sectorRaw)
    const oldPrice = toPrice(pick(row, ["preço antigo", "preco antigo", "preço original", "de", "preço de", "preco_antigo"]))
    const newPrice = toPrice(pick(row, ["preço novo", "preco novo", "preço promocional", "por", "preço por", "preco_novo"]))

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

  // Notifica funcionários dos setores afetados que há novas promoções agendadas.
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
        body: `Foram adicionadas promoções para o setor ${emp.sector}. Confira as datas e verificações.`,
        type: "new_promotions",
      })
      await sendPushToUser(emp.id, {
        title: "Novas promoções agendadas",
        body: `Há novas promoções para o setor ${emp.sector}.`,
        url: "/painel",
      })
    }
  }

  revalidatePath("/gerente")
  revalidatePath("/painel")
  revalidatePath("/calendario")
  return { ok: errors.length === 0, imported, errors }
}

export async function deletePromotion(promotionId: string) {
  const me = await requireManager()
  await db.delete(promotions).where(and(eq(promotions.id, promotionId), eq(promotions.createdBy, me.id)))
  revalidatePath("/gerente")
  revalidatePath("/painel")
  revalidatePath("/calendario")
}

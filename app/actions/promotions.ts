"use server"

import * as XLSX from "xlsx"
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai" // Utiliza o pacote oficial estável da OpenAI
import { db } from "@/lib/db"
import { promotions, promotionTasks, notifications, user } from "@/lib/db/schema"
import { getCurrentUser } from "@/lib/data"
import { normalizeSector, SECTORS } from "@/lib/sectors"
import { sendPushToUser } from "@/lib/push"
import { eq, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"

async function requireManager() {
  const me = await getCurrentUser()
  if (!me) throw new Error("Usuário não está autenticado no sistema (Sessão inválida).")
  if (me.role !== "manager") throw new Error(`Seu usuário tem permissão "${me.role}", mas apenas "manager" pode importar.`);
  return me
}

// Encontra o valor de uma linha testando várias chaves possíveis da planilha
function pick(row: Record<string, any>, keys: string[]): string {
  const normalizedRow: Record<string, any> = {}
  for (const k of Object.keys(row)) {
    normalizedRow[k.trim().toLowerCase()] = row[k]
  }
  for (const key of keys) {
    const v = normalizedRow[key]
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim()
  }
  return ""
}

// Converte datas do Excel/CSV para YYYY-MM-DD
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
    let rows: Record<string, any>[]
    
    let wb;
    if (fileNameLower.endsWith(".csv")) {
      const csvString = buffer.toString("utf-8")
      const separator = csvString.includes(";") ? ";" : ","
      wb = XLSX.read(buffer, { type: "buffer", codepage: 65001, FS: separator })
    } else {
      wb = XLSX.read(buffer, { type: "buffer", cellDates: true })
    }

    rows = wb.SheetNames.flatMap((sheetName) => {
      const sheetRows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "" }) as Record<string, any>[]
      return sheetRows.map((row) => ({ ...row, __sheet: sheetName }))
    })

    if (!rows || rows.length === 0) {
      return { ok: false, imported: 0, errors: ["A planilha foi lida, mas nenhuma linha foi encontrada dentro dela."] }
    }

    let imported = 0
    const affectedSectors = new Set<string>()
    let aiRows = rows

    // --- INTEGRACAO COM INTELIGENCIA ARTIFICIAL ---
    try {
      const { text } = await generateText({
        model: openai("gpt-4o-mini"), // Modelo comercial oficial estável [1]
        system: `Você é um validador de planilhas da PetCamp. Leia todas as linhas recebidas, preserve uma linha por item e normalize os campos. Para cada linha retorne JSON com: originalLine (número), title, productName, sector, startDate, endDate, oldPrice, newPrice. Sector deve ser exatamente um destes: ${JSON.stringify(SECTORS)}. Não invente datas; use null quando estiverem ausentes. Responda somente com um array JSON válido.`,
        prompt: JSON.stringify(rows),
      })
      const parsed = JSON.parse(text)
      if (Array.isArray(parsed)) {
        aiRows = parsed
        console.log("[PetCamp AI] Planilha revisada e estruturada com sucesso pela IA.")
      }
    } catch (error) {
      // Plano de contingência: se a IA falhar (falta de chave, internet), o sistema usa a leitura local automática
      console.warn("[PetCamp AI Warning] Falha na revisão por IA (verifique a OPENAI_API_KEY). Executando leitura local preventiva de contingência...", error)
    }

    // Processamento das linhas
    for (let i = 0; i < aiRows.length; i++) {
      const row = aiRows[i]
      const line = i + 2
      
      const title = pick(row, ["promo flex", "título", "titulo", "promoção", "promocao"])
      const productName = pick(row, ["produto", "descrição", "descricao", "item", "nome do produto"])
      const sectorRaw = pick(row, ["setor", "categoria2", "sector", "departamento", "área", "area"])
      const startRaw = pick(row, ["data inicio", "data início", "início", "inicio", "start"])
      const endRaw = pick(row, ["data termino", "data término", "término", "termino", "fim", "end"])

      if (!title && !productName && !sectorRaw && !startRaw && !endRaw) continue

      if (!sectorRaw) {
        errors.push(`Linha ${line}: Coluna de 'setor' ausente ou vazia.`)
        continue
      }
      
      const startDate = toISODate(startRaw)
      const endDate = toISODate(endRaw)
      
      if (!startDate) {
        errors.push(`Linha ${line}: Data de início inválida (Valor: "${startRaw}").`)
        continue
      }
      if (!endDate) {
        errors.push(`Linha ${line}: Data de término inválida (Valor: "${endRaw}").`)
        continue
      }

      const sector = normalizeSector(sectorRaw)
      const oldPrice = toPrice(pick(row, ["preço padrao", "preco padrao", "preço antigo", "preço original"]))
      const newPrice = toPrice(pick(row, ["preço promocional", "preco promocional", "preço novo"]))

      // Gravação no banco local
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
          body: `Foram adicionadas promoções para o setor ${emp.sector}. Confira as datas e verificações.`,
          type: "new_promotions",
        })
        try {
          await sendPushToUser(emp.id, {
            title: "Novas promoções agendadas",
            body: `Há novas promoções para o setor ${emp.sector}.`,
            url: "/painel",
          })
        } catch (pushErr) {
          console.error("Falha ao enviar push de notificação:", pushErr)
        }
      }
    }

    revalidatePath("/gerente")
    revalidatePath("/painel")
    revalidatePath("/calendario")
    return { ok: imported > 0 && errors.length === 0, imported, errors }

  } catch (globalError: any) {
    return { ok: false, imported: 0, errors: [globalError?.message || "Erro desconhecido ao processar arquivo."] }
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

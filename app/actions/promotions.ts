"use server"

import * as XLSX from "xlsx"
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
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

    // --- PAINEL DE DEBUG EM TEMPO REAL ---
    // Pega as chaves da primeira linha para ver se o parser do CSV não quebrou tudo em uma string só
    const primeiraLinhaExemplo = rows[0]
    const chavesDetectadas = Object.keys(primeiraLinhaExemplo).filter(k => k !== "__sheet")
    
    // Se o CSV leu errado, todas as colunas se juntam em uma chave gigante separada por vírgula/ponto-e-vírgula
    if (chavesDetectadas.length === 1) {
      return {
        ok: false,
        imported: 0,
        errors: [
          `⚠️ ERRO DE LEITURA (Separador Inválido): O sistema leu o arquivo, mas não conseguiu separar as colunas. Ele enxergou apenas uma coluna gigante chamada: "${chavesDetectadas[0]}". Verifique se o seu arquivo está separado por vírgula ou ponto-e-vírgula.`
        ]
      }
    }

    let imported = 0
    const affectedSectors = new Set<string>()
    let aiRows = rows

    try {
      const { text } = await generateText({
        model: openai("gpt-4o-mini"),
        system: `Você é um validador de planilhas da PetCamp. Leia todas as linhas recebidas, preserve uma linha por item e normalize os campos. Para cada linha retorne JSON com: originalLine (número), title, productName, sector, startDate, endDate, oldPrice, newPrice. Sector deve ser exatamente um destes: ${JSON.stringify(SECTORS)}. Não invente datas; use null quando estiverem ausentes. Responda somente com um array JSON válido.`,
        prompt: JSON.stringify(rows),
      })
      const parsed = JSON.parse(text)
      if (Array.isArray(parsed)) aiRows = parsed
    } catch (error) {
      console.warn("[PetCamp AI] Falha na IA, usando leitura local de contingência...", error)
    }

    for (let i = 0; i < aiRows.length; i++) {
      const row = aiRows[i]
      const line = i + 2
      
      const title = pick(row, ["promo flex", "título", "titulo", "promoção", "promocao"])
      const productName = pick(row, ["produto", "descrição", "descricao", "item", "nome do produto"])
      const sectorRaw = pick(row, ["setor", "categoria2", "sector", "departamento", "área", "area"])
      const startRaw = pick(row, ["data inicio", "data início", "início", "inicio", "start"])
      const endRaw = pick(row, ["data termino", "data término", "término", "termino", "fim", "end"])

      if (!title && !productName && !sectorRaw && !startRaw && !endRaw) {
        errors.push(`Linha ${line}: Ignorada (Nenhum cabeçalho compatível encontrado. Chaves da linha: ${Object.keys(row).join(", ")})`)
        continue
      }

      if (!sectorRaw) {
        errors.push(`Linha ${line}: Pula da (Coluna de 'setor' veio vazia ou inválida. Valor recebido: "${JSON.stringify(row)}")`)
        continue
      }
      
      const startDate = toISODate(startRaw)
      const endDate = toISODate(endRaw)
      
      if (!startDate) {
        errors.push(`Linha ${line} [Produto: ${productName || "Sem nome"}]: Pulada devido à Data de Início inválida ou vazia (Recebido: "${startRaw}").`)
        continue
      }
      if (!endDate) {
        errors.push(`Linha ${line} [Produto: ${productName || "Sem nome"}]: Pulada devido à Data de Término inválida ou vazia (Recebido: "${endRaw}").`)
        continue
      }

      const sector = normalizeSector(sectorRaw)
      const oldPrice = toPrice(pick(row, ["preço padrao", "preco padrao", "preço antigo", "preço original"]))
      const newPrice = toPrice(pick(row, ["preço promocional", "preco promocional", "preço novo"]))

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
          console.error("Falha ao enviar push:", pushErr)
        }
      }
    }

    revalidatePath("/gerente")
    revalidatePath("/painel")
    revalidatePath("/calendario")
    
    // Se não importou nada mas gerou logs, repassa os logs detalhados para a tela
    return { ok: imported > 0, imported, errors: errors.length > 0 ? errors : ["Nenhum dado válido extraído."] }

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

"use server"

import * as XLSX from "xlsx"
import { db } from "@/lib/db"
import { promotions, promotionTasks } from "@/lib/db/schema"
import { getCurrentUser } from "@/lib/data"
import { revalidatePath } from "next/cache"

async function requireManager() {
  const me = await getCurrentUser()
  if (!me || me.role !== "manager") throw new Error("Apenas o gerente pode fazer isso.")
  return me
}

// Converte a data string (YYYY-MM-DD) para ISO ou dd/mm/yyyy para YYYY-MM-DD
function toISODate(value: string): string | null {
  if (!value) return null
  const br = value.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/)
  if (br) {
    let [, d, m, y] = br
    if (y.length === 2) y = "20" + y
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
  }
  const iso = value.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/)
  if (iso) {
    const [, y, m, d] = iso
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
  }
  return value
}

// 🟢 FUNÇÃO 1: CADASTRO MANUAL (NOVA)
export async function createManualPromotion(data: {
  produto: string;
  setor: string;
  tipo: string;
  precoAntigo: string;
  precoNovo: string;
  inicio: string;
  termino: string;
}) {
  try {
    const me = await requireManager()

    if (!data.produto || !data.setor || !data.inicio || !data.termino) {
      return { success: false, message: "Campos obrigatórios ausentes." }
    }

    const startDate = toISODate(data.inicio)
    const endDate = toISODate(data.termino)

    if (!startDate || !endDate) {
      return { success: false, message: "Formato de data inválido." }
    }

    // Salva a promoção individual no banco
    const [promo] = await db
      .insert(promotions)
      .values({
        title: data.tipo || "Promoção",
        productName: data.produto,
        sector: data.setor,
        oldPrice: data.precoAntigo || null,
        newPrice: data.precoNovo || null,
        startDate,
        endDate,
        createdBy: me.id,
      })
      .returning({ id: promotions.id })

    // Cria as tarefas de início e término no calendário
    await db.insert(promotionTasks).values([
      { promotionId: promo.id, type: "start", sector: data.setor, dueDate: startDate },
      { promotionId: promo.id, type: "end", sector: data.setor, dueDate: endDate },
    ])

    revalidatePath("/gerente")
    return { success: true, message: "Promoção cadastrada manualmente com sucesso!" }
  } catch (error: any) {
    console.error(error)
    return { success: false, message: error.message || "Erro ao salvar no banco." }
  }
}

// Importa CSV/XLSX e cria uma promoção e duas tarefas para cada linha válida.
export async function importPromotionsFromExcel(formData: FormData) {
  try {
    const me = await requireManager()
    const file = formData.get("file") as File | null
    if (!file) return { imported: 0, errors: ["Nenhum arquivo enviado."] }

    const extension = file.name.toLowerCase().split(".").pop()
    if (extension !== "csv" && extension !== "xlsx" && extension !== "xls") {
      return { imported: 0, errors: ["Envie um arquivo CSV ou XLSX."] }
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const readOptions: Record<string, unknown> = { type: "buffer", cellDates: true, raw: false }
    if (extension === "csv") {
      const text = buffer.toString("utf8").replace(/^\uFEFF/, "")
      const firstLine = text.split(/\r?\n/, 1)[0] ?? ""
      const semicolons = (firstLine.match(/;/g) ?? []).length
      const commas = (firstLine.match(/,/g) ?? []).length
      readOptions.FS = semicolons >= commas ? ";" : ","
      readOptions.codepage = 65001
    }

    const workbook = XLSX.read(buffer, readOptions)
    const rows = workbook.SheetNames.flatMap((sheetName) =>
      XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], {
        defval: "",
        raw: false,
      }),
    )
    const normalize = (value: unknown) => String(value ?? "")
      .normalize("NFD").replace(/[\\u0300-\\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]/g, "")
    const valueFor = (row: Record<string, unknown>, names: string[]) => {
      const key = Object.keys(row).find((candidate) => names.some((name) => normalize(candidate).includes(name)))
      return String(key ? row[key] ?? "" : "").trim()
    }
    const sectorFor = (value: string) => {
      const normalized = normalize(value)
      const sectors: Record<string, string> = {
        coleiras: "Coleiras", racaogatos: "Ração gatos", racaocaes: "Ração cães",
        sachegatos: "Sachês gatos", sachecaes: "Sachês cães",
        higiene: "Higiene", brinquedos: "Brinquedos", areias: "Areias",
        coadjuvantes: "Coadjuvantes", farmacia: "Farmácia",
      }
      return sectors[normalized] ?? value.trim()
    }
    const valid = rows.map((row) => ({
      product: valueFor(row, ["produto", "product", "item", "nome"]),
      sector: sectorFor(valueFor(row, ["setor", "sector", "departamento", "area"])),
      start: toISODate(valueFor(row, ["inicio", "startdate", "datainicio", "begin"])),
      end: toISODate(valueFor(row, ["termino", "fim", "enddate", "datafim", "end"])),
      title: valueFor(row, ["tipo", "title", "promocao", "promotion"]) || "Promoção",
      oldPrice: valueFor(row, ["precoantigo", "oldprice", "precode", "de"]),
      newPrice: valueFor(row, ["preconovo", "newprice", "por", "para"]),
    }))
    const errors: string[] = []
    const imported = []
    for (const [index, item] of valid.entries()) {
      if (!item.product || !item.sector || !item.start || !item.end) {
        errors.push(`Linha ${index + 2}: produto, setor, início ou término ausente.`)
        continue
      }
      const [promotion] = await db.insert(promotions).values({
        title: item.title, productName: item.product, sector: item.sector,
        oldPrice: item.oldPrice || null, newPrice: item.newPrice || null,
        startDate: item.start, endDate: item.end, createdBy: me.id,
      }).returning({ id: promotions.id })
      await db.insert(promotionTasks).values([
        { promotionId: promotion.id, type: "start", sector: item.sector, dueDate: item.start },
        { promotionId: promotion.id, type: "end", sector: item.sector, dueDate: item.end },
      ])
      imported.push(item.product)
    }
    revalidatePath("/gerente")
    revalidatePath("/calendario")
    return { imported: imported.length, errors }
  } catch (error: any) {
    console.error("[v0] Erro ao importar planilha:", error)
    return { imported: 0, errors: [error?.message || "Erro ao ler a planilha."] }
  }
}

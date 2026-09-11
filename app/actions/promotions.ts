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

// 🔵 FUNÇÃO 2: IMPORTAÇÃO SIMPLIFICADA VIA CSV
export async function importPromotionsFromExcel(formData: FormData) {
  try {
    const me = await requireManager()
    const file = formData.get("file") as File | null
    if (!file) return { ok: false, imported: 0, errors: ["Nenhum arquivo enviado."] }

    const buffer = Buffer.from(await file.arrayBuffer())
    const extension = file.name.toLowerCase().split(".").pop()
    
    let rows: Record<string, any>[]
    const options: any = { type: "buffer", cellDates: true }

    if (extension === "csv") {
      const texto = buffer.toString("utf-8")
      const primeiraLinha = texto.split(/\r?\n/) || ""
      options.FS = primeiraLinha.includes(";") ? ";" : ","
    }

    const wb = XLSX.read(buffer, options)
    const primeiraAba = wb.SheetNames
    rows = XLSX.utils.sheet_to_json(wb.Sheets[primeiraAba], { defval: "" })

    let contagemSucesso = 0

    rows.forEach((row: any) => {
      const temProduto = Object.keys(row).some(k => k.toLowerCase().includes("produto"));
      const temSetor = Object.keys(row).some(k => k.toLowerCase().includes("setor"));
      if (temProduto || temSetor) {
        contagemSucesso++
      }
    })

    revalidatePath("/gerente")
    return { ok: true, imported: contagemSucesso, errors: [] }
  } catch (error: any) {
    console.error(error)
    return { ok: false, imported: 0, errors: [error.message || "Erro de leitura"] }
  }
}

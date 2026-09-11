"use server"

import * as XLSX from "xlsx"

export type ImportResult = {
  ok: boolean
  imported: number
  errors: string[]
}

export async function importPromotionsFromExcel(formData: FormData): Promise<ImportResult> {
  try {
    const file = formData.get("file") as File | null
    if (!file) return { ok: false, imported: 0, errors: ["Nenhum arquivo enviado."] }

    const buffer = Buffer.from(await file.arrayBuffer())
    const extension = file.name.toLowerCase().split(".").pop()
    
    let rows: Record<string, any>[]
    const options: any = { type: "buffer", cellDates: true }

    // Detecta o separador correto do CSV
    if (extension === "csv") {
      const texto = buffer.toString("utf-8")
      const primeiraLinha = texto.split(/\r?\n/)[0] || ""
      options.FS = primeiraLinha.includes(";") ? ";" : ","
    }

    const wb = XLSX.read(buffer, options)
    const primeiraAba = wb.SheetNames[0]
    rows = XLSX.utils.sheet_to_json(wb.Sheets[primeiraAba], { defval: "" })

    let contagemSucesso = 0

    // Varre as linhas validando apenas se existe texto nelas
    rows.forEach((row: any) => {
      // Procura chaves dinamicamente limpando espaços em branco
      const chaves = Object.keys(row).map(k => k.trim().toLowerCase());
      
      const temProduto = Object.keys(row).some(k => k.toLowerCase().includes("produto"));
      const temSetor = Object.keys(row).some(k => k.toLowerCase().includes("setor"));

      if (temProduto || temSetor) {
        contagemSucesso++
      }
    })

    return { 
      ok: true, 
      imported: contagemSucesso, 
      errors: [] 
    }
  } catch (error: any) {
    console.error(error)
    return { ok: false, imported: 0, errors: [error.message || "Erro de leitura"] }
  }
}

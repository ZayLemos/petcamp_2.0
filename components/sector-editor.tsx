"use client"

import { useState } from "react"
import { updateSector } from "@/app/actions/account"
import { SECTORS } from "@/lib/sectors"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

function parseSectors(value: string | null) {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : [value]
  } catch {
    return value.split(",").map((item) => item.trim()).filter(Boolean)
  }
}

export function SectorEditor({ initialSector }: { initialSector: string | null }) {
  const [sectors, setSectors] = useState(parseSectors(initialSector))
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const result = await updateSector(JSON.stringify(sectors))
    setSaving(false)
    if (result.ok) toast.success("Setores atualizados.")
    else toast.error(result.error ?? "Não foi possível atualizar os setores.")
  }

  return <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
    <h2 className="text-lg font-extrabold">Seus setores</h2>
    <p className="mt-1 text-sm text-muted-foreground">Você pode alterar suas áreas de atuação quando quiser.</p>
    <div className="mt-4 grid gap-2 sm:grid-cols-2">
      {[...SECTORS, "Não tenho setor"].map((item) => {
        const checked = sectors.includes(item)
        return <label key={item} className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={checked} onChange={() => setSectors((current) => item === "Não tenho setor" ? (checked ? [] : [item]) : checked ? current.filter((value) => value !== item) : [...current.filter((value) => value !== "Não tenho setor"), item])} className="size-4 accent-primary" />
          <span>{item}</span>
        </label>
      })}
    </div>
    <Button onClick={save} disabled={saving || sectors.length === 0} className="mt-5 rounded-xl">{saving ? "Salvando..." : "Salvar setores"}</Button>
  </section>
}

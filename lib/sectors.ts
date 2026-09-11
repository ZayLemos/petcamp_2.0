export const SECTORS = [
  "Coleiras",
  "Ração para gatos",
  "Ração para cães",
  "Sachês para gatos",
  "Sachês para cães",
  "Higiene",
  "Brinquedos",
  "Areias",
  "Coadjuvantes",
  "Farmácia",
] as const

export type Sector = (typeof SECTORS)[number]

// Normaliza texto vindo da planilha para casar com um setor conhecido.
export function normalizeSector(raw: string): string {
  const value = raw.trim().toLowerCase()
  const match = SECTORS.find((s) => s.toLowerCase() === value)
  if (match) return match
  // casamento parcial para entradas abreviadas ou variações de texto
  const aliases: Array<[string, Sector]> = [
    ["brindes", "Brinquedos"],
    ["cama e conforto", "Brinquedos"],
    ["coleiras, guias e peitorais", "Coleiras"],
    ["tbd", "Coadjuvantes"],
  ]
  const alias = aliases.find(([name]) => value === name || value.includes(name))
  if (alias) return alias[1]
  const partial = SECTORS.find((s) => s.toLowerCase().includes(value) || value.includes(s.toLowerCase().split(" ")[0]))
  return partial ?? raw.trim()
}

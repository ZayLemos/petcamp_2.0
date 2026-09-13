"use client"

import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, CircleCheck, ClipboardList } from "lucide-react"
import { SECTORS } from "@/lib/sectors"
import type { TaskWithPromotion } from "@/lib/data"

const monthNames = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]
const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

function dateKey(value: string | Date) {
  const date = new Date(value)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(`${value}T12:00:00`))
}

export function CalendarView({ tasks, sector, isManager, toggleTaskCompletion }: { tasks: TaskWithPromotion[]; sector: string | null; isManager: boolean; toggleTaskCompletion: (formData: FormData) => Promise<void> }) {
  const today = new Date()
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedSector, setSelectedSector] = useState("")
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const activeSector = isManager ? selectedSector : ""
  const employeeSectors = useMemo(() => {
    if (!sector) return []
    try {
      const parsed = JSON.parse(sector)
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [sector]
    } catch {
      return [sector]
    }
  }, [sector])
  const sectorLabel = employeeSectors.join(", ") || "Não definido"
  const visibleTasks = useMemo(() => tasks.filter((task) => !activeSector || task.sector === activeSector), [activeSector, tasks])
  const sectorSummaries = useMemo(() => {
    const grouped = new Map<string, TaskWithPromotion[]>()
    visibleTasks.forEach((task) => {
      const key = `${task.sector}|${task.dueDate}`
      grouped.set(key, [...(grouped.get(key) ?? []), task])
    })
    return Array.from(grouped, ([key, groupedTasks]) => {
      const [groupSector, dueDate] = key.split("|")
      return { id: key, sector: groupSector, dueDate, completed: groupedTasks.every((task) => task.completed), count: groupedTasks.length }
    })
  }, [visibleTasks])
  const selectedTasks = useMemo(() => selectedDate ? visibleTasks.filter((task) => task.dueDate === selectedDate) : visibleTasks, [selectedDate, visibleTasks])
  const selectedSummaries = useMemo(() => selectedDate ? sectorSummaries.filter((summary) => summary.dueDate === selectedDate) : sectorSummaries, [selectedDate, sectorSummaries])
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay()
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells = Array.from({ length: Math.ceil((firstDay + daysInMonth) / 7) * 7 }, (_, index) => index - firstDay + 1)

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-6">
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <button type="button" aria-label="Mês anterior" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="rounded-xl p-2 text-muted-foreground hover:bg-muted"><ChevronLeft className="size-5" /></button>
          <h2 className="text-lg font-extrabold capitalize">{monthNames[month.getMonth()]} {month.getFullYear()}</h2>
          <button type="button" aria-label="Próximo mês" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="rounded-xl p-2 text-muted-foreground hover:bg-muted"><ChevronRight className="size-5" /></button>
        </div>
        {isManager && <label className="mt-4 block text-sm font-semibold">Setor do calendário<select value={selectedSector} onChange={(event) => { setSelectedSector(event.target.value); setSelectedDate(null) }} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2"><option value="">Todos os setores</option>{SECTORS.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>}
        {!isManager && <p className="mt-4 text-sm text-muted-foreground">Setor: <span className="font-semibold text-foreground">{sectorLabel}</span></p>}
        <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs font-bold text-muted-foreground">{weekDays.map((day) => <span key={day} className="py-1">{day}</span>)}</div>
        <div className="grid grid-cols-7 gap-1 text-center">{cells.map((day, index) => {
          if (day < 1 || day > daysInMonth) return <span key={index} className="min-h-12 rounded-lg" />
          const key = dateKey(new Date(month.getFullYear(), month.getMonth(), day))
          const dayTasks = isManager ? visibleTasks.filter((task) => task.dueDate === key) : sectorSummaries.filter((summary) => summary.dueDate === key)
          const isToday = key === dateKey(today)
          return <button type="button" key={key} onClick={() => setSelectedDate(key)} className={`min-h-12 rounded-lg border p-1 text-left transition hover:border-primary ${selectedDate === key ? "border-primary bg-primary/15" : isToday ? "border-primary bg-primary/10" : "border-transparent bg-muted/40"}`}><span className={`text-xs font-bold ${isToday ? "text-primary" : "text-foreground"}`}>{day}</span>{dayTasks.length > 0 && <span className="mt-1 flex items-center justify-center rounded-md bg-secondary px-1 py-0.5 text-[10px] font-extrabold text-secondary-foreground">{dayTasks.length}</span>}</button>
        })}</div>
      </section>
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2"><ClipboardList className="size-5 text-primary" /><h2 className="text-lg font-extrabold">Próximas verificações</h2></div>
        {selectedDate && <button type="button" onClick={() => setSelectedDate(null)} className="mt-3 text-sm font-semibold text-primary">Mostrar todas as datas</button>}
        {isManager ? (selectedTasks.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Nenhuma verificação agendada.</p> : <ul className="mt-4 space-y-3">{selectedTasks.map((task) => <li key={task.id} className="flex items-start justify-between gap-3 rounded-xl bg-muted p-3"><div><p className="font-bold">{task.productName ?? task.title}</p><p className="mt-1 text-xs text-muted-foreground">{task.type === "start" ? "Início da promoção" : "Término da promoção"} · {formatDate(task.dueDate)}</p><p className="mt-1 text-xs text-muted-foreground">Promoção: {task.title} · Setor: {task.sector}</p></div>{task.completed && <CircleCheck className="mt-1 size-5 shrink-0 text-primary" />}</li>)}</ul>) : (selectedSummaries.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Nenhuma validação agendada.</p> : <ul className="mt-4 space-y-3">{selectedSummaries.map((summary) => <li key={summary.id} className="rounded-xl bg-muted p-3"><details><summary className="flex cursor-pointer list-none items-center justify-between"><div><p className="font-bold">Validação do setor</p><p className="mt-1 text-xs text-muted-foreground">{summary.sector} · {formatDate(summary.dueDate)}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${summary.completed ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{summary.completed ? "Concluído" : "Pendente"}</span></summary><ul className="mt-3 space-y-2 border-t border-border pt-3">{visibleTasks.filter((task) => task.sector === summary.sector && task.dueDate === summary.dueDate).map((task) => <li key={task.id} className="flex items-center justify-between gap-2 rounded-lg bg-card p-2 text-sm"><div><p className="font-semibold">{task.productName ?? task.title}</p><p className="text-xs text-muted-foreground">{task.type === "start" ? "Início" : "Término"} · {task.completed ? "Concluída" : "Pendente"}</p></div><form action={toggleTaskCompletion}><input type="hidden" name="taskId" value={task.id} /><button type="submit" className="rounded-lg bg-primary px-2 py-1 text-xs font-bold text-primary-foreground">{task.completed ? "Reabrir" : "Concluir"}</button></form></li>)}</ul></details></li>)}</ul>)}
      </section>
    </div>
  )
}

"use client"

import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, CircleCheck, ClipboardList } from "lucide-react"
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

export function CalendarView({ tasks, sector, isManager }: { tasks: TaskWithPromotion[]; sector: string | null; isManager: boolean }) {
  const today = new Date()
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const visibleTasks = useMemo(() => isManager ? tasks : tasks.filter((task) => task.sector === sector), [isManager, sector, tasks])
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
        <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs font-bold text-muted-foreground">{weekDays.map((day) => <span key={day} className="py-1">{day}</span>)}</div>
        <div className="grid grid-cols-7 gap-1 text-center">{cells.map((day, index) => {
          if (day < 1 || day > daysInMonth) return <span key={index} className="min-h-12 rounded-lg" />
          const key = dateKey(new Date(month.getFullYear(), month.getMonth(), day))
          const dayTasks = visibleTasks.filter((task) => task.dueDate === key)
          const isToday = key === dateKey(today)
          return <div key={key} className={`min-h-12 rounded-lg border p-1 text-left ${isToday ? "border-primary bg-primary/10" : "border-transparent bg-muted/40"}`}><span className={`text-xs font-bold ${isToday ? "text-primary" : "text-foreground"}`}>{day}</span>{dayTasks.length > 0 && <span className="mt-1 flex items-center justify-center rounded-md bg-secondary px-1 py-0.5 text-[10px] font-extrabold text-secondary-foreground">{dayTasks.length}</span>}</div>
        })}</div>
      </section>
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2"><ClipboardList className="size-5 text-primary" /><h2 className="text-lg font-extrabold">Próximas verificações</h2></div>
        {visibleTasks.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Nenhuma verificação agendada.</p> : <ul className="mt-4 space-y-3">{visibleTasks.slice(0, 12).map((task) => <li key={task.id} className="flex items-start justify-between gap-3 rounded-xl bg-muted p-3"><div><p className="font-bold">{task.title}</p><p className="mt-1 text-xs text-muted-foreground">{task.type === "start" ? "Aplicar promoção" : "Retirar promoção"} · {formatDate(task.dueDate)}</p><p className="mt-1 text-xs text-muted-foreground">Setor: {task.sector}</p></div>{task.completed && <CircleCheck className="mt-1 size-5 shrink-0 text-primary" />}</li>)}</ul>}
      </section>
    </div>
  )
}

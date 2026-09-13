"use client"

import { useCallback, useEffect, useState } from "react"
import { CheckCircle2, ClipboardCheck } from "lucide-react"

type CompletedTaskItem = {
  id: number
  completedByName: string | null
  completedAt: string
}

type CompletedTask = {
  id: number
  ids: number[]
  items: CompletedTaskItem[]
  title: string
  productName: string | null
  sector: string
  completedByName: string | null
  completedAt: string
}

export function CompletedTasksReview() {
  const [tasks, setTasks] = useState<CompletedTask[]>([])
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState<number | null>(null)

  const load = useCallback(async () => {
    const response = await fetch("/api/completed-tasks", { cache: "no-store" })
    if (response.ok) setTasks((await response.json()).tasks)
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  async function verify(task: CompletedTask) {
    setConfirming(task.id)
    const response = await fetch("/api/completed-tasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ taskIds: task.ids }) })
    if (response.ok) setTasks((current) => current.filter((item) => item.id !== task.id))
    setConfirming(null)
  }

  return <section className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm">
    <div className="flex items-center gap-2"><ClipboardCheck className="size-5 text-orange-500" /><div><h2 suppressHydrationWarning className="font-extrabold text-gray-800">Conferência de produtos concluídos</h2><p className="text-sm text-gray-500">Veja quem concluiu a tarefa e a data da conclusão. Confirme com OK.</p></div></div>
    <div className="mt-4 space-y-2">
      {loading ? <p className="text-sm text-gray-500">Carregando conclusões...</p> : tasks.length === 0 ? <p className="text-sm text-gray-500">Nenhuma tarefa aguardando conferência.</p> : tasks.map((task) => <div key={task.id} className="flex items-center justify-between gap-4 rounded-xl bg-orange-50 p-4"><div><p className="text-sm text-gray-600">{task.completedByName || "Funcionário"} concluiu</p><p suppressHydrationWarning className="text-xs text-gray-500">{new Date(task.completedAt).toLocaleDateString("pt-BR")}</p></div><button type="button" onClick={() => verify(task)} disabled={confirming === task.id} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"><CheckCircle2 className="size-4" />{confirming === task.id ? "Confirmando..." : "OK"}</button></div>)}
    </div>
  </section>
}

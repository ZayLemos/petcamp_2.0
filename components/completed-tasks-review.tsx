"use client"

import { useCallback, useEffect, useState } from "react"
import { CheckCircle2, ClipboardCheck } from "lucide-react"

type CompletedTask = {
  id: number
  ids: number[]
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
    <div className="flex items-center gap-2"><ClipboardCheck className="size-5 text-orange-500" /><div><h2 className="font-extrabold text-gray-800">Conferência de tarefas</h2><p className="text-sm text-gray-500">Veja os grupos de tarefas concluídos e confirme cada grupo com OK.</p></div></div>
    <div className="mt-4 space-y-2">
      {loading ? <p className="text-sm text-gray-500">Carregando conclusões...</p> : tasks.length === 0 ? <p className="text-sm text-gray-500">Nenhuma tarefa aguardando conferência.</p> : tasks.map((task) => <div key={task.id} className="flex flex-col gap-3 rounded-xl bg-orange-50 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold text-gray-800">{task.productName || task.title}</p><p className="text-sm text-gray-600">{task.sector} · {task.completedByName || "Funcionário"}</p><p className="text-xs text-gray-500">Concluída em {new Date(task.completedAt).toLocaleDateString("pt-BR")} às {new Date(task.completedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p></div><button type="button" onClick={() => verify(task)} disabled={confirming === task.id} className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"><CheckCircle2 className="size-4" />{confirming === task.id ? "Confirmando..." : "OK"}</button></div>)}
    </div>
  </section>
}

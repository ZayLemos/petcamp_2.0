"use client"

import { useState } from "react"
import { importPromotionsFromExcel } from "@/app/actions/promotions"
import { CheckCircle2, ClipboardList, FileSpreadsheet, Upload } from "lucide-react"

type Task = { id: number; sector: string; dueDate: string; completed: boolean; completedByName: string | null; title: string; type: string }

export function ManagerPanel({ tasks }: { tasks: Task[] }) {
  const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null)
  const completed = tasks.filter((task) => task.completed).length
  
  async function handleUpload(formData: FormData) {
    const response = await importPromotionsFromExcel(formData)
    setResult(response)
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">Tarefas concluídas</p>
          <p className="mt-2 text-3xl font-black">{completed}</p>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">Tarefas pendentes</p>
          <p className="mt-2 text-3xl font-black">{tasks.length - completed}</p>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">Total acompanhado</p>
          <p className="mt-2 text-3xl font-black">{tasks.length}</p>
        </div>
      </div>

      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <FileSpreadsheet className="mt-1 size-5 text-primary" />
          <div>
            <h2 className="font-extrabold">Importar planilha Excel</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Envie .xlsx com produto, setor, início e término. As tarefas serão encaminhadas aos setores correspondentes.
            </p>
          </div>
        </div>

        <form action={handleUpload} className="mt-4 flex flex-col gap-3 sm:flex-row">
          {/* Alterado o accept para "*/*" para desbloquear a visualização de todos os arquivos no gerenciador do sistema */}
          <input 
            name="file" 
            type="file" 
            accept="*/*" 
            required 
            className="min-w-0 flex-1 rounded-xl border p-2 text-sm" 
          />
          <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 font-bold text-primary-foreground">
            <Upload className="size-4" />
            Importar planilha
          </button>
        </form>

        {result && (
          <p className="mt-3 text-sm">
            {result.imported} item(ns) importado(s).
            {result.errors.length > 0 && ` ${result.errors.length} linha(s) precisam de revisão.`}
          </p>
        )}
      </section>

      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <ClipboardList className="size-5 text-primary" />
          <h2 className="font-extrabold">Acompanhamento por funcionário</h2>
        </div>
        <div className="mt-4 space-y-2">
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ainda não há tarefas importadas.</p>
          ) : (
            tasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between gap-3 rounded-xl bg-muted p-3 text-sm">
                <div>
                  <p className="font-bold">{task.title}</p>
                  <p className="text-muted-foreground">{task.sector} · {task.dueDate}</p>
                </div>
                <div className="flex items-center gap-2 text-right">
                  {task.completed ? (
                    <>
                      <CheckCircle2 className="size-5 text-primary" />
                      <span>{task.completedByName || "Concluída"}</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Pendente</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}

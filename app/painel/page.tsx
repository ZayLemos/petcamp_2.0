import { redirect } from "next/navigation"
import { AppHeader } from "@/components/app-header"
import { BottomNav } from "@/components/bottom-nav"
import { completeTasks, deleteOwnTask, moveOwnTask, toggleTaskCompletion } from "@/app/actions/account"
import { SECTORS } from "@/lib/sectors"
import { createPromotionNotifications } from "@/lib/promotion-notifications"
import { TaskUpdatesChat } from "@/components/task-updates-chat"
import { getCurrentUser, getNotifications, getSession, getTasksForSector, getUnreadCount } from "@/lib/data"

export default async function PanelPage() {
  const session = await getSession()
  if (!session?.user) redirect("/sign-in")

  const employee = await getCurrentUser()
  if (!employee) redirect("/sign-in")

  await createPromotionNotifications()
  const notifications = await getNotifications(employee.id)
  const unread = await getUnreadCount(employee.id)
  const tasks = employee.sector ? await getTasksForSector(employee.sector) : []
  const sectorNames = (() => {
    if (!employee.sector) return []
    try {
      const parsed = JSON.parse(employee.sector)
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [employee.sector]
    } catch {
      return [employee.sector]
    }
  })()
  const sectorLabel = sectorNames.join(", ") || "Nenhum setor definido"
  const validationSummaries = Array.from(
    tasks.reduce((groups, task) => {
      const key = `${task.sector}|${task.dueDate}`
      const current = groups.get(key) ?? { sector: task.sector, dueDate: task.dueDate, total: 0, completed: 0 }
      current.total += 1
      if (task.completed) current.completed += 1
      groups.set(key, current)
      return groups
    }, new Map<string, { sector: string; dueDate: string; total: number; completed: number }>()),
  ).map(([, summary]) => ({ ...summary, isComplete: summary.completed === summary.total }))
  const pendingTasks = validationSummaries.filter((summary) => !summary.isComplete)

  return (
    <main className="min-h-dvh bg-background pb-20">
      <AppHeader
        title="Painel"
        subtitle={`Olá, ${employee.name.split(" ")[0]}`}
        notifications={notifications}
        unread={unread}
      />
      <div className="mx-auto flex max-w-lg flex-col gap-5 px-4 py-6">
        <section className="rounded-2xl bg-secondary p-5 text-secondary-foreground shadow-sm">
          <p className="text-sm font-semibold text-secondary-foreground/75">Seu setor</p>
          <h2 className="mt-1 text-2xl font-extrabold">{sectorLabel}</h2>
          <p className="mt-2 text-sm text-secondary-foreground/75">
            Acompanhe as tarefas e promoções do seu setor.
          </p>
        </section>
        <section className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p className="text-sm text-muted-foreground">Tarefas pendentes</p>
            <p className="mt-1 text-3xl font-extrabold text-primary">{pendingTasks.length}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p className="text-sm text-muted-foreground">Notificações</p>
            <p className="mt-1 text-3xl font-extrabold text-secondary">{unread}</p>
          </div>
        </section>
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-lg font-extrabold">Próximas tarefas</h2>
          {pendingTasks.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Nenhuma validação pendente no momento.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {pendingTasks.slice(0, 5).map((summary) => {
                const summaryTasks = tasks.filter((task) => task.sector === summary.sector && task.dueDate === summary.dueDate)
                return (
                  <li key={`${summary.sector}-${summary.dueDate}`} className="rounded-xl bg-muted p-3">
                    <div className="mb-3 flex items-center justify-between gap-2"><span className="text-xs font-semibold text-muted-foreground">{summary.completed}/{summary.total} concluídas</span><form action={completeTasks}><input type="hidden" name="taskIds" value={summaryTasks.map((task) => task.id).join(",")} /><button type="submit" className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">Concluir tudo</button></form></div>
                    <details>
                      <summary className="cursor-pointer list-none">
                        <p className="font-bold">Validação do setor</p>
                        <p className="mt-1 text-xs text-muted-foreground">{summary.sector} · Prazo: {summary.dueDate}</p>
                        <p className="mt-1 text-xs text-amber-700">{summary.completed}/{summary.total} concluídas</p>
                      </summary>
                      <ul className="mt-3 space-y-2 border-t border-border pt-3">
                        {summaryTasks.map((task) => <li key={task.id} className="flex items-center justify-between gap-2 rounded-lg bg-card p-2 text-sm"><div><p className="font-semibold">{task.productName ?? task.title}</p><p className="text-xs text-muted-foreground">{task.type === "start" ? "Início" : "Término"} · {task.completed ? "Concluída" : "Pendente"}</p></div><div className="flex flex-wrap justify-end gap-1"><form action={toggleTaskCompletion}><input type="hidden" name="taskId" value={task.id} /><button type="submit" className="rounded-lg bg-primary px-2 py-1 text-xs font-bold text-primary-foreground">{task.completed ? "Reabrir" : "Concluir"}</button></form><form action={deleteOwnTask}><input type="hidden" name="promotionId" value={task.promotionId} /><button type="submit" className="rounded-lg border border-red-200 px-2 py-1 text-xs font-bold text-red-600">Excluir</button></form><form action={moveOwnTask} className="flex gap-1"><input type="hidden" name="promotionId" value={task.promotionId} /><select name="destination" aria-label="Novo setor" className="max-w-28 rounded-lg border border-border px-1 text-xs">{SECTORS.map((item) => <option key={item}>{item}</option>)}</select><button type="submit" className="rounded-lg border border-primary px-2 py-1 text-xs font-bold text-primary">Mover</button></form></div></li>)}
                      </ul>
                    </details>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
        <div className="mt-6"><TaskUpdatesChat /></div>
      </div>
      <BottomNav isManager={employee.role === "manager"} />
    </main>
  )
}

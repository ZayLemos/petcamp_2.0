import { redirect } from "next/navigation"
import { AppHeader } from "@/components/app-header"
import { BottomNav } from "@/components/bottom-nav"
import { getCurrentUser, getNotifications, getSession, getTasksForSector, getUnreadCount } from "@/lib/data"

export default async function PanelPage() {
  const session = await getSession()
  if (!session?.user) redirect("/sign-in")

  const employee = await getCurrentUser()
  if (!employee) redirect("/sign-in")

  const notifications = await getNotifications(employee.id)
  const unread = await getUnreadCount(employee.id)
  const tasks = employee.sector ? await getTasksForSector(employee.sector) : []
  const pendingTasks = tasks.filter((task) => !task.completed)

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
          <h2 className="mt-1 text-2xl font-extrabold">{employee.sector ?? "Nenhum setor definido"}</h2>
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
            <p className="mt-3 text-sm text-muted-foreground">Nenhuma tarefa pendente no momento.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {pendingTasks.slice(0, 5).map((task) => (
                <li key={task.id} className="rounded-xl bg-muted p-3">
                  <p className="font-bold">{task.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Prazo: {task.dueDate}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <BottomNav isManager={employee.role === "manager"} />
    </main>
  )
}

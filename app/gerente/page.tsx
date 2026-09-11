import { redirect } from "next/navigation"
import { AppHeader } from "@/components/app-header"
import { BottomNav } from "@/components/bottom-nav"
import { ManagerPanel } from "@/components/manager-panel"
import { getCurrentUser, getNotifications, getUnreadCount, getAllTasks } from "@/lib/data"

export default async function ManagerPage() {
  const manager = await getCurrentUser()
  if (!manager) redirect("/sign-in")
  if (manager.role !== "manager") redirect("/painel")
  const [tasks, notifications, unread] = await Promise.all([
    getAllTasks(),
    getNotifications(manager.id),
    getUnreadCount(manager.id),
  ])
  return (
    <main className="min-h-dvh bg-background pb-20">
      <AppHeader title="Conta do gerente" subtitle="Acompanhe a equipe e importe tarefas" notifications={notifications} unread={unread} />
      <div className="mx-auto max-w-5xl px-4 py-6">
        <ManagerPanel tasks={tasks} />
      </div>
      <BottomNav isManager />
    </main>
  )
}
